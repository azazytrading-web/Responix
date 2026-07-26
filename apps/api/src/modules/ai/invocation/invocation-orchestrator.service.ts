import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiContractError } from "../contracts";
import type { AiResponseContract, ProviderExecutionResult } from "../contracts";
import { ProviderCredentialService } from "../providers/provider-credential.service";
import { ProviderFactory } from "../providers/provider.factory";
import type { AiProviderAdapter } from "../providers/provider-adapter.interface";
import { RoutingService } from "../router/routing.service";
import type { RoutingDecision } from "../router/routing.types";
import { CostNormalizerService } from "./cost-normalizer.service";
import { ErrorNormalizerService, InvocationTimeoutError } from "./error-normalizer.service";
import { InvocationRepository } from "./invocation.repository";
import type { TrustedInvocationRequest } from "./request-normalizer.service";
import { ResponseNormalizerService } from "./response-normalizer.service";
import { UsageNormalizerService } from "./usage-normalizer.service";
import { RuntimeProtectionService } from "../runtime/runtime-protection.service";
import type { RuntimeReservation } from "../runtime/runtime.types";

@Injectable()
export class InvocationOrchestratorService {
  private readonly logger = new Logger(InvocationOrchestratorService.name);

  constructor(
    private readonly routing: RoutingService,
    private readonly providers: ProviderFactory,
    private readonly credentials: ProviderCredentialService,
    private readonly repository: InvocationRepository,
    private readonly usage: UsageNormalizerService,
    private readonly costs: CostNormalizerService,
    private readonly responses: ResponseNormalizerService,
    private readonly errors: ErrorNormalizerService,
    private readonly config: ConfigService,
    private readonly runtime: RuntimeProtectionService
  ) {}

  async invoke(request: TrustedInvocationRequest): Promise<AiResponseContract> {
    let invocationId: string | undefined;
    let providerId: string | undefined;
    let modelId: string | undefined;
    let reservation: RuntimeReservation | undefined;
    let runtimeFinalized = false;
    let durableFinalizationStaged = false;
    let providerDurationMs = 0;
    const executionStartedAt = Date.now();
    try {
      reservation = await this.runtime.begin(request);
      const routing = await this.routing.route({
        workspaceId: request.workspaceId
      });
      providerId = routing.providerId;
      modelId = routing.modelId;
      const resolved = await this.providers.create(request.workspaceId, routing.providerId);
      const model = resolved.provider.models.find(({ modelId }) => modelId === routing.modelId);
      if (!model) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model is unavailable");
      }
      this.runtime.validateModel(reservation, model);
      const pricing = await this.repository.findModelPricing(
        request.workspaceId,
        routing.providerId,
        routing.modelId
      );
      if (!pricing) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model pricing is unavailable");
      }
      const invocation = await this.repository.start({
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        providerId: routing.providerId,
        modelId: routing.modelId,
        taskType: request.taskType,
        messageCount: request.messages.length
      });
      invocationId = invocation.id;

      const providerStartedAt = Date.now();
      let providerResult: ProviderExecutionResult;
      const activeReservation = reservation;
      try {
        providerResult = await this.runtime.withLease(activeReservation, (leaseSignal) =>
          this.executeProvider({
            workspaceId: request.workspaceId,
            providerId: routing.providerId,
            routing,
            modelName: model.modelName,
            apiBaseUrl: resolved.provider.apiBaseUrl,
            adapter: resolved.adapter,
            request,
            maxOutputTokens: activeReservation.estimate.outputTokens,
            leaseSignal
          })
        );
      } finally {
        providerDurationMs = Date.now() - providerStartedAt;
      }
      const usage = this.usage.normalize(providerResult.usage);
      const cost = this.costs.normalize(usage, pricing);
      const response = this.responses.normalize({
        requestId: request.requestId,
        providerResult,
        routing,
        usage,
        cost
      });
      const runtimeCompletion = {
        reservation,
        invocationId,
        providerId: routing.providerId,
        modelId: routing.modelId,
        usage,
        cost,
        retryCount: 0,
        executionDurationMs: Date.now() - executionStartedAt,
        providerDurationMs
      };
      const completion = {
        invocationId,
        workspaceId: request.workspaceId,
        providerId: routing.providerId,
        modelId: routing.modelId,
        routing,
        usage,
        cost,
        runtime: runtimeCompletion,
        ...(providerResult.finishReason ? { finishReason: providerResult.finishReason } : {})
      };
      const recoveryId = await this.repository.stageSuccess(completion);
      durableFinalizationStaged = true;
      await this.completeWithRetry({ ...completion, recoveryId });
      runtimeFinalized = true;
      this.logger.log({
        event: "ai.invocation.succeeded",
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        providerId: routing.providerId,
        modelId: routing.modelId
      });
      return response;
    } catch (error: unknown) {
      const normalized = this.errors.normalize(error);
      if (durableFinalizationStaged) {
        this.logger.error({
          event: "ai.invocation.finalization_deferred",
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          errorCode: normalized.code
        });
        throw new AiContractError(normalized.code, normalized.message);
      }
      if (reservation && !runtimeFinalized) {
        const timedOut = /timed out|timeout/i.test(normalized.message);
        const cancelled =
          error instanceof Error &&
          (error.name === "AbortError" || /aborted|cancelled/i.test(error.message));
        const runtimeFailure = {
          reservation,
          ...(invocationId ? { invocationId } : {}),
          ...(providerId ? { providerId } : {}),
          ...(modelId ? { modelId } : {}),
          retryCount: 0,
          executionDurationMs: Date.now() - executionStartedAt,
          providerDurationMs,
          failureReason: normalized.code,
          ...(timedOut ? { timeoutReason: normalized.message } : {}),
          cancelled
        };
        if (invocationId) {
          const failure = {
            invocationId,
            workspaceId: request.workspaceId,
            error: normalized,
            runtime: runtimeFailure
          };
          const recoveryId = await this.repository.stageFailure(failure);
          durableFinalizationStaged = true;
          await this.failWithRetry({ ...failure, recoveryId });
        } else {
          await this.runtime.recordFailure(runtimeFailure);
        }
        runtimeFinalized = true;
      } else if (invocationId) {
        await this.repository.fail(invocationId, request.workspaceId, normalized);
      }
      this.logger.error({
        event: "ai.invocation.failed",
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        errorCode: normalized.code
      });
      throw new AiContractError(normalized.code, normalized.message);
    } finally {
      if (reservation && !runtimeFinalized && !durableFinalizationStaged) {
        try {
          await this.runtime.release(reservation);
        } catch {
          this.logger.error({
            event: "ai.runtime.reservation_release_failed",
            requestId: request.requestId,
            workspaceId: request.workspaceId
          });
        }
      }
    }
  }

  private async completeWithRetry(
    input: Parameters<InvocationRepository["complete"]>[0]
  ): Promise<void> {
    try {
      await this.repository.complete(input);
    } catch {
      await this.repository.complete(input);
    }
  }

  private async failWithRetry(
    input: Parameters<InvocationRepository["failWithRuntime"]>[0]
  ): Promise<void> {
    try {
      await this.repository.failWithRuntime(input);
    } catch {
      await this.repository.failWithRuntime(input);
    }
  }

  private async executeProvider(input: {
    workspaceId: string;
    providerId: string;
    routing: RoutingDecision;
    modelName: string;
    apiBaseUrl: string | null;
    adapter: AiProviderAdapter;
    request: TrustedInvocationRequest;
    maxOutputTokens: number;
    leaseSignal: AbortSignal;
  }): Promise<ProviderExecutionResult> {
    let result: ProviderExecutionResult | undefined;
    await this.withTimeout(async (signal) => {
      await this.credentials.useCredential(
        input.workspaceId,
        input.providerId,
        async (credential) => {
          result = await input.adapter.invoke(
            {
              requestId: input.request.requestId,
              modelId: input.routing.modelId,
              modelName: input.modelName,
              apiBaseUrl: input.apiBaseUrl,
              messages: input.request.messages,
              maxOutputTokens: input.maxOutputTokens,
              signal
            },
            credential
          );
        }
      );
    }, input.leaseSignal);
    if (!result) throw new AiContractError("RESPONSE_INVALID", "Provider returned no response");
    if (result.usage.outputTokens > input.maxOutputTokens) {
      throw new AiContractError(
        "RESPONSE_INVALID",
        "AI provider output exceeded the reserved token limit"
      );
    }
    return result;
  }

  private async withTimeout(
    operation: (signal: AbortSignal) => Promise<void>,
    parentSignal: AbortSignal
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutMs = this.config.getOrThrow<number>("ai.requestTimeoutMs");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const abortFromParent = (): void => controller.abort(parentSignal.reason);
    try {
      if (parentSignal.aborted) abortFromParent();
      else parentSignal.addEventListener("abort", abortFromParent, { once: true });
      await Promise.race([
        operation(controller.signal),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new InvocationTimeoutError());
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abortFromParent);
    }
  }
}
