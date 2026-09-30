export class OicClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly traceId?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "OicClientError";
  }
}

export class OicClientTimeoutError extends OicClientError {
  constructor(public readonly timeoutMs: number) {
    super(0, "CLIENT_TIMEOUT", `OIC request timed out after ${timeoutMs}ms`);
    this.name = "OicClientTimeoutError";
  }
}

export class OicClientAbortError extends OicClientError {
  constructor() {
    super(0, "CLIENT_ABORTED", "OIC request was cancelled by the caller");
    this.name = "OicClientAbortError";
  }
}
