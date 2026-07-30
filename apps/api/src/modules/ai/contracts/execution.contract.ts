import type { AiMessageContract, AiRequestContract } from "./request.contract";
import type { AiUsageContract } from "./usage.contract";

export interface NormalizedInvocationRequest {
  requestId: string;
  workspaceId: string;
  membershipId: string;
  taskType: string;
  messages: Array<Pick<AiMessageContract, "role" | "content">>;
  language?: string;
  signal?: AbortSignal;
}

export interface ProviderExecutionRequest {
  requestId: string;
  modelId: string;
  modelName: string;
  apiBaseUrl: string | null;
  messages: NormalizedInvocationRequest["messages"];
  maxOutputTokens: number;
  signal: AbortSignal;
}

export interface ProviderExecutionCredential {
  id: string;
  secret: string;
}

export interface ProviderExecutionResult {
  content: string;
  finishReason?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
}

export interface ProviderStreamEvent {
  type: "delta" | "completed";
  content?: string;
  role?: "system" | "user" | "assistant";
  finishReason?: string;
  usage?: Partial<ProviderExecutionResult["usage"]>;
  providerMetadata?: Record<string, unknown>;
}

export interface NormalizedProviderResult {
  content: string;
  finishReason?: string;
  usage: AiUsageContract;
}

export type AuthenticatedInvocationRequest = Omit<
  AiRequestContract,
  "workspaceId" | "membershipId"
> & { signal?: AbortSignal };
