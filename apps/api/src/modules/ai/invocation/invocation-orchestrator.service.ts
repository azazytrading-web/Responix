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
    private readonly config: ConfigService
  ) {}

  async invoke(request: TrustedInvocationRequest): Promise<AiResponseContract> {
    let invocationId: string | undefined;
    try {
      const routing = await this.routing.route({
        workspaceId: request.workspaceId
      });
      const resolved = await this.providers.create(request.workspaceId, routing.providerId);
      const model = resolved.provider.models.find(({ modelId }) => modelId === routing.modelId);
      if (!model) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "Routed model is unavailable");
      }
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

      const providerResult = await this.executeProvider({
        workspaceId: request.workspaceId,
        providerId: routing.providerId,
        routing,
        modelName: model.modelName,
        apiBaseUrl: resolved.provider.apiBaseUrl,
        adapter: resolved.adapter,
        request
      });
      const usage = this.usage.normalize(providerResult.usage);
      const cost = this.costs.normalize(usage, pricing);
      const response = this.responses.normalize({
        requestId: request.requestId,
        providerResult,
        routing,
        usage,
        cost
      });
      await this.repository.complete({
        invocationId,
        workspaceId: request.workspaceId,
        providerId: routing.providerId,
        modelId: routing.modelId,
        routing,
        usage,
        cost,
        ...(providerResult.finishReason ? { finishReason: providerResult.finishReason } : {})
      });
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
      if (invocationId) {
        await this.repository.fail(invocationId, request.workspaceId, normalized);
      }
      this.logger.error({
        event: "ai.invocation.failed",
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        errorCode: normalized.code
      });
      throw new AiContractError(normalized.code, normalized.message);
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
              signal
            },
            credential
          );
        }
      );
    });
    if (!result) throw new AiContractError("RESPONSE_INVALID", "Provider returned no response");
    return result;
  }

  private async withTimeout(operation: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const controller = new AbortController();
    const timeoutMs = this.config.getOrThrow<number>("ai.requestTimeoutMs");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
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
    }
  }
}
