import type { ToolAuthenticationType, ToolDefinitionType, ToolVisibility } from "@prisma/client";

export type ToolRuntimeParameter = { name: string; location: string; required?: boolean;
  schema: Record<string, unknown>; metadata?: Record<string, unknown>; sortOrder?: number };
export type ToolRuntimeSnapshot = {
  categoryId: string | null; groupId: string | null; name: string; slug: string;
  description: string | null; type: ToolDefinitionType; visibility: ToolVisibility;
  authenticationType: ToolAuthenticationType; metadata: Record<string, unknown>;
  providerMetadata: Record<string, unknown>; authenticationMetadata: Record<string, unknown>;
  rateLimitMetadata: Record<string, unknown>; executionPolicyMetadata: Record<string, unknown>;
  timeoutMetadata: Record<string, unknown>; retryPolicyMetadata: Record<string, unknown>;
  costMetadata: Record<string, unknown>; compatibilityMetadata: Record<string, unknown>;
  healthMetadata: Record<string, unknown>; mcpMetadata: Record<string, unknown>;
  parameters: ToolRuntimeParameter[];
  schemas: Array<{ kind: string; schema: Record<string, unknown>; metadata?: Record<string, unknown> }>;
  capabilities: Array<{ code: string; enabled: boolean; metadata?: Record<string, unknown> }>;
  permissions: Array<{ permissionCode: string; metadata?: Record<string, unknown> }>;
};
export type ToolExecutionContext = { workspaceId: string; actorId: string; executionId: string;
  executionRunId: string; correlationId: string; traceId: string; input: Record<string, unknown>;
  retrieval?: unknown; promptVariables: Record<string, unknown>; metadata: Record<string, unknown> };
export type ToolExecutorResult = { output: unknown; responseBytes?: number;
  partialOutputs?: unknown[]; metadata?: Record<string, unknown> };
export interface ToolInternalExecutor {
  execute(context: ToolExecutionContext, signal: AbortSignal): Promise<ToolExecutorResult>;
}
export type ProviderNeutralToolContract = { name: string; description: string;
  inputSchema: Record<string, unknown>; version: string; capabilities: string[] };
