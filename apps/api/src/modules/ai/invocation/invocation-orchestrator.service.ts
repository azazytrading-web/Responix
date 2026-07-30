import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiContractError } from "../contracts";
import type {
  AiCostContract, AiResponseContract, AiUsageContract, ProviderExecutionResult,
  ProviderStreamEvent
} from "../contracts";
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
import type { ModelPricing } from "./cost-normalizer.service";

export interface StreamInvocationResult {
  invocationId: string;
  responseContent: string;
  finishReason?: string;
  usage: AiUsageContract | null;
  cost: AiCostContract | null;
  pricing: ModelPricing;
  providerCompletedAt: Date;
  retryCount: number;
}

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
    let providerRetryCount = 0;
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
        const execution = await this.runtime.withLease(activeReservation, (leaseSignal) =>
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
        providerResult = execution.result;
        providerRetryCount = execution.retryCount;
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
        retryCount: providerRetryCount,
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
        const cancelled = normalized.code === "CANCELLED";
        const runtimeFailure = {
          reservation,
          ...(invocationId ? { invocationId } : {}),
          ...(providerId ? { providerId } : {}),
          ...(modelId ? { modelId } : {}),
          retryCount: providerRetryCount,
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

  async stream(
    request: TrustedInvocationRequest, emit: (event: ProviderStreamEvent) => Promise<void>
  ): Promise<StreamInvocationResult> {
    let reservation: RuntimeReservation | undefined;
    let invocationId: string | undefined;
    let providerId: string | undefined;
    let modelId: string | undefined;
    let routing: RoutingDecision | undefined;
    let providerDurationMs = 0;
    const startedAt = Date.now();
    let finalUsage: ProviderExecutionResult["usage"] | undefined;
    let finishReason: string | undefined;
    let responseContent = "";
    let pricing: ModelPricing | undefined;
    let providerRetryCount = 0;
    let providerCompletedAt: Date | undefined;
    try {
      reservation = await this.runtime.begin(request);
      routing = await this.routing.route({ workspaceId: request.workspaceId, streaming: true });
      providerId = routing.providerId; modelId = routing.modelId;
      const resolved = await this.providers.create(request.workspaceId, routing.providerId);
      const model = resolved.provider.models.find(({ modelId: id }) => id === routing!.modelId);
      if (!model || !resolved.adapter.stream) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "The selected provider does not support streaming");
      }
      this.runtime.validateModel(reservation, model);
      pricing = await this.repository.findModelPricing(request.workspaceId, routing.providerId, routing.modelId) ?? undefined;
      if (!pricing) throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model pricing is unavailable");
      const invocation = await this.repository.start({
        requestId: request.requestId, workspaceId: request.workspaceId,
        providerId: routing.providerId, modelId: routing.modelId,
        taskType: request.taskType, messageCount: request.messages.length
      });
      invocationId = invocation.id;
      const providerStartedAt = Date.now();
      await this.runtime.withLease(reservation, async (leaseSignal) => {
        const configuredAttempts = this.config.get?.<number>("ai.retry.maxAttempts") ?? 3;
        const attempts = Math.max(1, Math.min(configuredAttempts, 5));
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          try {
            await this.withTimeout(async (signal) => {
              await this.credentials.useCredential(
                request.workspaceId, routing!.providerId, (credential) =>
                  resolved.adapter.stream!({
                    requestId: request.requestId, modelId: routing!.modelId,
                    modelName: model.modelName, apiBaseUrl: resolved.provider.apiBaseUrl,
                    messages: request.messages,
                    maxOutputTokens: reservation!.estimate.outputTokens, signal
                  }, credential, async (event) => {
                    if (event.usage && event.usage.inputTokens !== undefined &&
                        event.usage.outputTokens !== undefined) {
                      finalUsage = {
                        inputTokens: event.usage.inputTokens,
                        outputTokens: event.usage.outputTokens,
                        ...(event.usage.cachedTokens !== undefined
                          ? { cachedTokens: event.usage.cachedTokens } : {})
                      };
                    }
                    if (event.finishReason) finishReason = event.finishReason;
                    if (event.content) responseContent += event.content;
                    await emit(event);
                  })
              );
            }, leaseSignal, request.signal);
            break;
          } catch (error) {
            const canRecover = responseContent.length === 0 && attempt < attempts &&
              this.retryable(error) && !leaseSignal.aborted && !request.signal?.aborted;
            if (!canRecover) throw error;
            providerRetryCount += 1;
            await this.retryDelay(providerRetryCount, leaseSignal, request.signal);
          }
        }
      });
      providerDurationMs = Date.now() - providerStartedAt;
      providerCompletedAt = new Date();
      const usage = finalUsage ? this.usage.normalize(finalUsage) : null;
      const cost = usage ? this.costs.normalize(usage, pricing) : null;
      const runtimeBase = {
        reservation, invocationId, providerId, modelId,
        retryCount: providerRetryCount,
        executionDurationMs: Date.now() - startedAt, providerDurationMs
      };
      if (usage && cost) {
        await this.repository.complete({
          invocationId, workspaceId: request.workspaceId, providerId, modelId, routing,
          usage, cost, ...(finishReason ? { finishReason } : {}), responseContent,
          runtime: { ...runtimeBase, usage, cost }
        });
      } else {
        await this.repository.completeUnknownUsage({
          invocationId, workspaceId: request.workspaceId, providerId, modelId, routing,
          responseContent, pricing, ...(finishReason ? { finishReason } : {}),
          runtime: runtimeBase
        });
      }
      return {
        invocationId, responseContent, ...(finishReason ? { finishReason } : {}),
        usage, cost, pricing, providerCompletedAt, retryCount: providerRetryCount
      };
    } catch (error: unknown) {
      if (reservation && invocationId) {
        const normalized = this.errors.normalize(error);
        await this.repository.failWithRuntime({
          invocationId, workspaceId: request.workspaceId, error: normalized,
          runtime: {
            reservation, ...(providerId ? { providerId } : {}), ...(modelId ? { modelId } : {}),
            retryCount: providerRetryCount,
            executionDurationMs: Date.now() - startedAt, providerDurationMs,
            failureReason: normalized.code, cancelled: normalized.code === "CANCELLED"
          }
        });
      } else if (reservation) {
        await this.runtime.release(reservation);
      }
      throw error;
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
  }): Promise<{ result: ProviderExecutionResult; retryCount: number }> {
    const configuredAttempts = this.config.get?.<number>("ai.retry.maxAttempts") ?? 3;
    const attempts = Math.max(1, Math.min(configuredAttempts, 5));
    let result: ProviderExecutionResult | undefined;
    let retryCount = 0;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
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
        }, input.leaseSignal, input.request.signal);
        break;
      } catch (error: unknown) {
        if (attempt >= attempts || !this.retryable(error) ||
          input.leaseSignal.aborted || input.request.signal?.aborted) throw error;
        retryCount += 1;
        await this.retryDelay(retryCount, input.leaseSignal, input.request.signal);
      }
    }
    if (!result) throw new AiContractError("RESPONSE_INVALID", "Provider returned no response");
    if (result.usage.outputTokens > input.maxOutputTokens) {
      throw new AiContractError(
        "RESPONSE_INVALID",
        "AI provider output exceeded the reserved token limit"
      );
    }
    return { result, retryCount };
  }

  private async withTimeout(
    operation: (signal: AbortSignal) => Promise<void>,
    parentSignal: AbortSignal,
    requestSignal?: AbortSignal
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutMs = this.config.getOrThrow<number>("ai.requestTimeoutMs");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const abortFromParent = (): void => controller.abort(parentSignal.reason);
    const abortFromRequest = (): void => controller.abort(requestSignal?.reason);
    try {
      if (parentSignal.aborted) abortFromParent();
      else parentSignal.addEventListener("abort", abortFromParent, { once: true });
      if (requestSignal?.aborted) abortFromRequest();
      else requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
      if (controller.signal.aborted) {
        throw new DOMException("AI invocation cancelled", "AbortError");
      }
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
      requestSignal?.removeEventListener("abort", abortFromRequest);
    }
  }

  private retryable(error: unknown): boolean {
    return error instanceof AiContractError &&
      (error.code === "RATE_LIMITED" || error.code === "PROVIDER_UNAVAILABLE");
  }

  private async retryDelay(
    retryCount: number, leaseSignal: AbortSignal, requestSignal?: AbortSignal
  ): Promise<void> {
    const base = this.config.get?.<number>("ai.retry.baseDelayMs") ?? 100;
    const maximum = this.config.get?.<number>("ai.retry.maxDelayMs") ?? 2_000;
    const delay = Math.max(0, Math.min(maximum, base * (2 ** (retryCount - 1))));
    if (!delay) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(done, delay);
      const abort = () => done(new DOMException("AI invocation cancelled", "AbortError"));
      function done(error?: Error): void {
        clearTimeout(timer);
        leaseSignal.removeEventListener("abort", abort);
        requestSignal?.removeEventListener("abort", abort);
        if (error) reject(error); else resolve();
      }
      leaseSignal.addEventListener("abort", abort, { once: true });
      requestSignal?.addEventListener("abort", abort, { once: true });
      if (leaseSignal.aborted || requestSignal?.aborted) abort();
    });
  }
}
