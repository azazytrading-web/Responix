export type AiErrorCode =
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "CAPABILITY_UNAVAILABLE"
  | "CONTEXT_LIMIT_EXCEEDED"
  | "CREDENTIAL_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "RESPONSE_INVALID"
  | "SAFETY_BLOCKED"
  | "TOOL_REJECTED"
  | "UNKNOWN";

export class AiContractError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AiContractError";
  }
}
