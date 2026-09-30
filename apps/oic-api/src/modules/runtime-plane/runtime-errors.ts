import type { OicRuntimeErrorCode } from "@oic/contracts";
import { HttpException } from "@nestjs/common";

const STATUS_BY_CODE: Record<OicRuntimeErrorCode, number> = {
  AUTHENTICATION_FAILED: 401,
  AUTHORIZATION_DENIED: 403,
  TENANT_NOT_ALLOWED: 404,
  INVALID_REQUEST: 400,
  MODEL_NOT_FOUND: 404,
  MODEL_NOT_AVAILABLE: 503,
  CAPABILITY_NOT_SUPPORTED: 400,
  RATE_LIMITED: 429,
  PROVIDER_AUTHENTICATION_FAILED: 503,
  PROVIDER_AUTHORIZATION_FAILED: 503,
  UPSTREAM_MODEL_UNAVAILABLE: 503,
  UPSTREAM_TIMEOUT: 504,
  PROVIDER_REQUEST_REJECTED: 502,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_RESPONSE_INVALID: 502,
  PROVIDER_RESPONSE_TOO_LARGE: 502,
  PROVIDER_STREAM_INTERRUPTED: 502,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  STREAMING_IDEMPOTENCY_UNSUPPORTED: 400,
  RUNTIME_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500
};

const SAFE_MESSAGES: Record<OicRuntimeErrorCode, string> = {
  AUTHENTICATION_FAILED: "Authentication failed",
  AUTHORIZATION_DENIED: "The requested operation is not authorized",
  TENANT_NOT_ALLOWED: "The requested tenant is not available to this principal",
  INVALID_REQUEST: "The runtime request is invalid",
  MODEL_NOT_FOUND: "The requested Oi Model was not found",
  MODEL_NOT_AVAILABLE: "The requested Oi Model has no approved runtime binding",
  CAPABILITY_NOT_SUPPORTED: "The requested capability is not supported",
  RATE_LIMITED: "The request exceeds an allowed runtime boundary",
  PROVIDER_AUTHENTICATION_FAILED: "The configured provider authentication was rejected",
  PROVIDER_AUTHORIZATION_FAILED: "The configured provider connection is not authorized",
  UPSTREAM_MODEL_UNAVAILABLE: "The configured model implementation is unavailable",
  UPSTREAM_TIMEOUT: "The provider did not complete the request in time",
  PROVIDER_REQUEST_REJECTED: "The provider could not accept the normalized request",
  PROVIDER_UNAVAILABLE: "The provider is temporarily unavailable",
  PROVIDER_RESPONSE_INVALID: "The provider returned an invalid response",
  PROVIDER_RESPONSE_TOO_LARGE: "The provider response exceeded the allowed size",
  PROVIDER_STREAM_INTERRUPTED: "The provider stream ended before completion",
  IDEMPOTENCY_CONFLICT: "The idempotency key conflicts with another request",
  IDEMPOTENCY_IN_PROGRESS: "A request with this idempotency key is still running",
  STREAMING_IDEMPOTENCY_UNSUPPORTED: "Streaming request replay is not supported",
  RUNTIME_UNAVAILABLE: "The runtime is temporarily unavailable",
  INTERNAL_ERROR: "The runtime request could not be completed"
};

export class OicRuntimeException extends HttpException {
  constructor(readonly code: OicRuntimeErrorCode, message = SAFE_MESSAGES[code]) {
    super({ code, message }, STATUS_BY_CODE[code]);
    this.name = "OicRuntimeException";
  }
}

export function runtimeErrorMessage(code: OicRuntimeErrorCode): string {
  return SAFE_MESSAGES[code];
}
