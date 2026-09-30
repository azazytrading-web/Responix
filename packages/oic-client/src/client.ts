import type { OicRuntimeRequest, OicRuntimeResponse, OicRuntimeStreamEvent } from "@oic/contracts";
import { OicClientAbortError, OicClientError, OicClientTimeoutError } from "./errors";

export type OicClientOptions = {
  baseUrl: string;
  credential: string | (() => string);
  tenantId?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  requestIdFactory?: () => string;
};
export type OicCallOptions = {
  requestId?: string;
  traceId?: string;
  idempotencyKey?: string;
  tenantId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};
type ManagedRequest = { controller: AbortController; timedOut: () => boolean; timeoutMs: number; cleanup: () => void };
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_SSE_BUFFER_CHARS = 262_144;

function managedRequest(timeoutMs: number, parent?: AbortSignal): ManagedRequest {
  const controller = new AbortController();
  let expired = false;
  const onAbort = () => controller.abort(parent?.reason);
  if (parent?.aborted) onAbort();
  else parent?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => { expired = true; controller.abort(new Error("OIC client timeout")); }, timeoutMs);
  return { controller, timedOut: () => expired, timeoutMs, cleanup: () => { clearTimeout(timer); parent?.removeEventListener("abort", onAbort); } };
}
function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `oic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
async function responseError(response: Response): Promise<OicClientError> {
  let parsed: Record<string, unknown> | undefined;
  try { parsed = jsonRecord(await response.json()); } catch { parsed = undefined; }
  const native = jsonRecord(parsed?.error);
  const code = typeof native?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(native.code) ? native.code : `HTTP_${response.status}`;
  const message = typeof native?.message === "string" ? native.message.slice(0, 512) : "OIC request could not be completed";
  const requestId = typeof native?.requestId === "string" ? native.requestId.slice(0, 128) : undefined;
  const traceId = typeof native?.traceId === "string" ? native.traceId.slice(0, 128) : undefined;
  return new OicClientError(response.status, code, message, requestId, traceId);
}
function buildHeaders(credential: string, metadata: OicCallOptions, accept: string): Headers {
  if (!credential || credential.length > 256 || /[\r\n]/.test(credential)) throw new OicClientError(0, "INVALID_CREDENTIAL", "The OIC credential configuration is invalid");
  const headers = new Headers({ authorization: `Bearer ${credential}`, accept, "content-type": "application/json" });
  headers.set("x-request-id", metadata.requestId ?? requestId());
  if (metadata.traceId) headers.set("x-trace-id", metadata.traceId);
  if (metadata.idempotencyKey) headers.set("idempotency-key", metadata.idempotencyKey);
  const tenantId = metadata.tenantId;
  if (tenantId) headers.set("x-oic-tenant-id", tenantId);
  return headers;
}
function mergeTenant(request: OicRuntimeRequest, tenantId?: string): OicRuntimeRequest {
  if (!tenantId) return request;
  if (request.tenant && (request.tenant.kind !== "id" || request.tenant.tenantId !== tenantId)) {
    throw new OicClientError(0, "TENANT_SELECTION_CONFLICT", "The OIC request contains conflicting Tenant selections");
  }
  return request;
}
function getMessageCode(event: unknown): OicClientError | undefined {
  const record = jsonRecord(event);
  if (record?.type !== "response.error") return undefined;
  const error = jsonRecord(record.error);
  if (!error || typeof error.code !== "string") return new OicClientError(503, "RUNTIME_UNAVAILABLE", "OIC runtime stream failed");
  const message = typeof error.message === "string" ? error.message.slice(0, 512) : "OIC runtime stream failed";
  return new OicClientError(503, error.code, message, typeof error.requestId === "string" ? error.requestId : undefined, typeof error.traceId === "string" ? error.traceId : undefined);
}

export class OicClient {
  private readonly baseUrl: string;
  private readonly credential: string | (() => string);
  private readonly defaultTenantId?: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly requestIdFactory: () => string;

  constructor(options: OicClientOptions) {
    const parsed = new URL(options.baseUrl);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new TypeError("OIC baseUrl must be an HTTP(S) URL without embedded credentials or query parameters");
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.credential = options.credential;
    this.defaultTenantId = options.tenantId;
    this.defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.requestIdFactory = options.requestIdFactory ?? requestId;
  }

  async invoke(request: OicRuntimeRequest, options: OicCallOptions = {}): Promise<OicRuntimeResponse> {
    const tenantId = options.tenantId ?? this.defaultTenantId;
    const metadata = { ...options, tenantId, requestId: options.requestId ?? this.requestIdFactory() };
    const body = mergeTenant(request, tenantId);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const managed = managedRequest(timeoutMs, options.signal);
    try {
      const response = await this.fetchImplementation(`${this.baseUrl}/api/v1/runtime/invocations`, {
        method: "POST", headers: buildHeaders(this.getCredential(), metadata, "application/json"),
        body: JSON.stringify(body), signal: managed.controller.signal
      });
      if (!response.ok) throw await responseError(response);
      return await response.json() as OicRuntimeResponse;
    } catch (error) { throw this.normalizeTransportError(error, managed, options.signal); }
    finally { managed.cleanup(); }
  }

  async *stream(request: OicRuntimeRequest, options: OicCallOptions = {}): AsyncIterable<OicRuntimeStreamEvent> {
    if (options.idempotencyKey) throw new OicClientError(400, "STREAMING_IDEMPOTENCY_UNSUPPORTED", "OIC does not support replay for streaming invocations");
    const tenantId = options.tenantId ?? this.defaultTenantId;
    const metadata = { ...options, tenantId, requestId: options.requestId ?? this.requestIdFactory() };
    const body = mergeTenant(request, tenantId);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const managed = managedRequest(timeoutMs, options.signal);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await this.fetchImplementation(`${this.baseUrl}/api/v1/runtime/stream`, {
        method: "POST", headers: buildHeaders(this.getCredential(), metadata, "text/event-stream"),
        body: JSON.stringify(body), signal: managed.controller.signal
      });
      if (!response.ok) throw await responseError(response);
      if (!response.body) throw new OicClientError(502, "INVALID_STREAM", "OIC returned an empty event stream");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        if (buffer.length > MAX_SSE_BUFFER_CHARS) throw new OicClientError(502, "INVALID_STREAM", "OIC event stream exceeded the client buffer limit");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary).replace(/\r/g, "");
          buffer = buffer.slice(boundary + 2);
          const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
          if (data && data !== "[DONE]") {
            let event: unknown;
            try { event = JSON.parse(data); } catch { throw new OicClientError(502, "INVALID_STREAM", "OIC returned an invalid stream event"); }
            const error = getMessageCode(event);
            if (error) throw error;
            yield event as OicRuntimeStreamEvent;
          }
          boundary = buffer.indexOf("\n\n");
        }
        if (chunk.done) break;
      }
    } catch (error) { throw this.normalizeTransportError(error, managed, options.signal); }
    finally {
      if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      managed.cleanup();
    }
  }

  private getCredential(): string {
    const value = typeof this.credential === "function" ? this.credential() : this.credential;
    if (typeof value !== "string") throw new OicClientError(0, "INVALID_CREDENTIAL", "The OIC credential configuration is invalid");
    return value;
  }

  private normalizeTransportError(error: unknown, managed: ManagedRequest, parent?: AbortSignal): Error {
    if (error instanceof OicClientError) return error;
    if (managed.timedOut()) return new OicClientTimeoutError(managed.timeoutMs);
    if (parent?.aborted) return new OicClientAbortError();
    return new OicClientError(0, "NETWORK_ERROR", "OIC request failed before a response was received", undefined, undefined, { cause: error });
  }
}

export function createOicClient(options: OicClientOptions): OicClient {
  return new OicClient(options);
}
