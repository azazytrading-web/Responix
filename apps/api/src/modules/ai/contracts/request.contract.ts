import type { AiToolDefinitionContract } from "./tool.contract";

export type AiMessageRole = "system" | "user" | "assistant" | "tool";

export type AiInvocationMode = "sync" | "stream";

export interface AiMessageContract {
  role: AiMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AiRequestContract {
  requestId: string;
  workspaceId: string;
  membershipId: string;
  taskType: string;
  messages: AiMessageContract[];
  mode: AiInvocationMode;
  language?: string;
  agentId?: string;
  conversationId?: string;
  customerId?: string;
  tools?: AiToolDefinitionContract[];
  metadata?: Record<string, unknown>;
}
