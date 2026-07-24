import type { AiRoutingDecisionContract } from "./routing.contract";
import type { AiToolCallContract } from "./tool.contract";
import type { AiCostContract, AiUsageContract } from "./usage.contract";

export interface AiResponseContract {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  finishReason?: string;
  toolCalls: AiToolCallContract[];
  usage: AiUsageContract;
  cost: AiCostContract;
  routing: AiRoutingDecisionContract;
  metadata?: Record<string, unknown>;
}
