import type { AiCostContract, AiUsageContract } from "../ai/contracts";
import type { ModelPricing } from "../ai/invocation/cost-normalizer.service";

export interface StreamingCompletion {
  invocationId: string;
  responseContent: string;
  finishReason?: string;
  usage: AiUsageContract | null;
  cost: AiCostContract | null;
  pricing: ModelPricing;
  providerCompletedAt: Date;
}

export interface StreamingChunkInput {
  sequence: number;
  content: string;
  role?: string;
  delta?: boolean;
  finishReason?: string;
  providerMetadata?: Record<string, unknown>;
}
