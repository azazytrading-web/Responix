export type AiToolCallStatus = "pending" | "completed" | "failed" | "rejected";

export interface AiToolDefinitionContract {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AiToolCallContract {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: AiToolCallStatus;
  result?: Record<string, unknown>;
}
