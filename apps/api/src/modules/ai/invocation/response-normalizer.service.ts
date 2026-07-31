import { Injectable } from "@nestjs/common";
import type {
  AiCostContract,
  AiResponseContract,
  AiUsageContract,
  ProviderExecutionResult
} from "../contracts";
import type { RoutingDecision } from "../router/routing.types";

@Injectable()
export class ResponseNormalizerService {
  normalize(input: {
    requestId: string;
    providerResult: ProviderExecutionResult;
    routing: RoutingDecision;
    usage: AiUsageContract;
    cost: AiCostContract;
    metadata?: Record<string, unknown>;
  }): AiResponseContract {
    return {
      requestId: input.requestId,
      providerId: input.routing.providerId,
      modelId: input.routing.modelId,
      content: input.providerResult.content,
      ...(input.providerResult.finishReason
        ? { finishReason: input.providerResult.finishReason }
        : {}),
      toolCalls: input.providerResult.toolCalls ?? [],
      usage: input.usage,
      cost: input.cost,
      routing: input.routing,
      ...(input.metadata ? { metadata: input.metadata } : {})
    };
  }
}
