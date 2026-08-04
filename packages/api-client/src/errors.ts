interface BackendErrorBody {
  statusCode?: number;
  code?: string;
  errorCode?: string;
  error?: string;
  message?: string | string[];
  requestId?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export class NetworkError extends ApiError {
  constructor(message = "Network error", options?: ErrorOptions) {
    super(0, "NETWORK_ERROR", message, undefined, undefined, options);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends NetworkError {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export class PermissionDeniedError extends ApiError {
  constructor(message = "You do not have permission to perform this action", requestId?: string) {
    super(403, "PERMISSION_DENIED", message, requestId);
    this.name = "PermissionDeniedError";
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public readonly fields: Record<string, string[]> = {},
    requestId?: string,
    details?: unknown
  ) {
    super(400, "VALIDATION_ERROR", message, requestId, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found", requestId?: string) {
    super(404, "NOT_FOUND", message, requestId);
    this.name = "NotFoundError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBackendErrorBody(value: unknown): value is BackendErrorBody {
  return isRecord(value);
}

function errorMessage(body: BackendErrorBody | undefined, fallback: string): string {
  if (Array.isArray(body?.message)) return body.message.join("; ");
  return body?.message ?? body?.error ?? fallback;
}

export async function normalizeHttpError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  let body: BackendErrorBody | undefined;
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (isBackendErrorBody(parsed)) body = parsed;
    } catch {
      body = undefined;
    }
  }

  const status = body?.statusCode ?? response.status;
  const requestId = body?.requestId ?? response.headers.get("x-request-id") ?? undefined;
  const code = body?.code ?? body?.errorCode ?? `HTTP_${status}`;
  const message = errorMessage(body, response.statusText || `HTTP ${status}`);

  if (status === 403) return new PermissionDeniedError(message, requestId);
  if (status === 404) return new NotFoundError(message, requestId);
  if (status === 400 && (code === "VALIDATION_ERROR" || body?.fieldErrors || Array.isArray(body?.message))) {
    return new ValidationError(message, body?.fieldErrors, requestId, body?.details);
  }
  return new ApiError(status, code, message, requestId, body?.details);
}
