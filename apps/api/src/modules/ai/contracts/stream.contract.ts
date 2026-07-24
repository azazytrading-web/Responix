import type { AiToolCallContract } from "./tool.contract";
import type { AiUsageContract } from "./usage.contract";

export interface AiStreamChunkContract {
  requestId: string;
  sequence: number;
  delta?: string;
  toolCall?: AiToolCallContract;
  usage?: Partial<AiUsageContract>;
  done: boolean;
}
