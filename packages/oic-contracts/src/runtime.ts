export type OicModelReference = `oi-${string}`;
export type OicTenantSelector =
  | { kind: "id"; tenantId: string }
  | { kind: "external-reference"; sourceType: string; externalId: string };

export type OicRuntimeMessage = {
  speaker: "instruction" | "user" | "assistant" | "context";
  content: Array<{ type: "text"; text: string }>;
};

export type OicRuntimeRequest = {
  model: OicModelReference;
  input: OicRuntimeMessage[];
  tenant?: OicTenantSelector;
  maxOutputUnits?: number;
};

export type OicRuntimeContext = {
  requestId: string;
  traceId: string;
  applicationId: string;
  principalId: string;
  tenantId: string | null;
  callerRequestId?: string;
};

export type OicRawUsageEvidence = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  internalComputeUnits?: number;
  retrievalUnits?: number;
  toolUnits?: number;
};

export type OicRuntimeOutput = {
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
};

export type OicRuntimeResponse = {
  object: "oic.runtime.response";
  id: string;
  model: OicModelReference;
  output: OicRuntimeOutput[];
  finishReason: "completed" | "output-limit";
  usage: OicRawUsageEvidence | null;
  createdAt: string;
  requestId: string;
  traceId: string;
  execution: { runtimeVersion: "1"; durationMs: number };
};

export type OicRuntimeErrorCode =
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_DENIED"
  | "TENANT_NOT_ALLOWED"
  | "INVALID_REQUEST"
  | "MODEL_NOT_FOUND"
  | "MODEL_NOT_AVAILABLE"
  | "CAPABILITY_NOT_SUPPORTED"
  | "RATE_LIMITED"
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "PROVIDER_AUTHORIZATION_FAILED"
  | "UPSTREAM_MODEL_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "PROVIDER_REQUEST_REJECTED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_RESPONSE_TOO_LARGE"
  | "PROVIDER_STREAM_INTERRUPTED"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "STREAMING_IDEMPOTENCY_UNSUPPORTED"
  | "RUNTIME_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type OicRuntimeError = {
  error: {
    code: OicRuntimeErrorCode;
    message: string;
    requestId?: string;
    traceId?: string;
  };
};

export type OicRuntimeStreamEvent =
  | { type: "response.started"; responseId: string; model: OicModelReference; requestId: string; traceId: string }
  | { type: "content.delta"; responseId: string; text: string }
  | { type: "usage.updated"; responseId: string; usage: OicRawUsageEvidence }
  | { type: "response.completed"; response: OicRuntimeResponse }
  | { type: "response.error"; error: OicRuntimeError["error"] };

export type OicRuntimeExecutionStreamChunk =
  | { type: "content.delta"; text: string }
  | { type: "usage.updated"; usage: OicRawUsageEvidence };

export type OicVisibleModel = {
  id: OicModelReference;
  displayName: string;
  capabilities: Array<"text.generate" | "text.stream">;
};

export type OicResolvedModel = OicVisibleModel & { resolverVersion: string; tenantRequired?: boolean };

export type OicRuntimeExecutionResult = {
  outputText: string;
  usage?: OicRawUsageEvidence;
  finishReason: "completed" | "output-limit";
  executorVersion: string;
};

export interface OicModelResolver {
  resolve(model: OicModelReference, context: OicRuntimeContext): Promise<OicResolvedModel | null>;
  listVisible(context: OicRuntimeContext): Promise<OicVisibleModel[]>;
}

export interface OicRuntimeExecutor {
  execute(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): Promise<OicRuntimeExecutionResult>;
  stream(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): AsyncIterable<OicRuntimeExecutionStreamChunk>;
}

export type OicRuntimePolicyDecision = {
  allowed: boolean;
  maxInputMessages: number;
  maxInputCharacters: number;
  maxOutputUnits: number;
  maxExecutionMs: number;
  allowedCapabilities: Array<"text.generate" | "text.stream">;
};

export interface OicRuntimePolicy {
  evaluate(request: OicRuntimeRequest, context: OicRuntimeContext): Promise<OicRuntimePolicyDecision>;
}
