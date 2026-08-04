import { ApiError, NetworkError, TimeoutError, normalizeHttpError } from "./errors";

export type QueryPrimitive = string | number | boolean | Date;
export type QueryValue = QueryPrimitive | readonly QueryPrimitive[] | null | undefined;
export type QueryParams = Readonly<Record<string, QueryValue>>;

export interface RequestMetadata {
  requestId?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface ApiRequestConfig extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  query?: QueryParams;
  timeoutMs?: number;
  metadata?: RequestMetadata;
}

export interface ApiRequestContext {
  url: string;
  path: string;
  config: ApiRequestConfig;
  attempt: number;
}

export interface ApiResponseContext {
  request: ApiRequestContext;
  response: Response;
  replay: (overrides?: Partial<ApiRequestConfig>) => Promise<Response>;
}

export type ApiRequestInterceptor = (
  context: ApiRequestContext
) => ApiRequestContext | Promise<ApiRequestContext>;

export type ApiResponseInterceptor = (
  context: ApiResponseContext
) => Response | void | Promise<Response | void>;

export interface ApiClientOptions {
  baseUrl: string;
  defaultTimeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  requestIdFactory?: () => string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function appendQuery(url: string, query?: QueryParams): string {
  if (!query) return url;

  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      parsed.searchParams.append(key, item instanceof Date ? item.toISOString() : String(item));
    }
  }
  return parsed.toString();
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now().toString(36)}`;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function mergeConfig(
  current: ApiRequestConfig,
  overrides: Partial<ApiRequestConfig> = {}
): ApiRequestConfig {
  return {
    ...current,
    ...overrides,
    headers: mergeHeaders(current.headers, overrides.headers),
    metadata: { ...current.metadata, ...overrides.metadata },
  };
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof ReadableStream
  );
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly requestIdFactory: () => string;
  private readonly requestInterceptors: ApiRequestInterceptor[] = [];
  private readonly responseInterceptors: ApiResponseInterceptor[] = [];

  constructor(options: ApiClientOptions | string) {
    const resolved = typeof options === "string" ? { baseUrl: options } : options;
    this.baseUrl = trimTrailingSlash(resolved.baseUrl);
    this.defaultTimeoutMs = resolved.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImplementation = resolved.fetch ?? globalThis.fetch.bind(globalThis);
    this.requestIdFactory = resolved.requestIdFactory ?? createRequestId;
  }

  addRequestInterceptor(interceptor: ApiRequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index >= 0) this.requestInterceptors.splice(index, 1);
    };
  }

  addResponseInterceptor(interceptor: ApiResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index >= 0) this.responseInterceptors.splice(index, 1);
    };
  }

  async request<T>(path: string, config: ApiRequestConfig = {}): Promise<T> {
    const response = await this.dispatch(this.createContext(path, config, 0));
    if (!response.ok) throw await normalizeHttpError(response);
    return this.parseSuccess<T>(response);
  }

  get<T>(path: string, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>(path, { ...config, method: "GET" });
  }

  post<T>(path: string, body?: unknown, config?: ApiRequestConfig): Promise<T> {
    return this.requestWithBody<T>("POST", path, body, config);
  }

  put<T>(path: string, body?: unknown, config?: ApiRequestConfig): Promise<T> {
    return this.requestWithBody<T>("PUT", path, body, config);
  }

  patch<T>(path: string, body?: unknown, config?: ApiRequestConfig): Promise<T> {
    return this.requestWithBody<T>("PATCH", path, body, config);
  }

  delete<T>(path: string, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>(path, { ...config, method: "DELETE" });
  }

  private createContext(
    path: string,
    config: ApiRequestConfig,
    attempt: number
  ): ApiRequestContext {
    const metadata: RequestMetadata = {
      requestId: config.metadata?.requestId ?? this.requestIdFactory(),
      ...config.metadata,
    };
    const headers = mergeHeaders({ Accept: "application/json" }, config.headers);
    if (metadata.requestId) headers.set("x-request-id", metadata.requestId);
    if (metadata.correlationId) headers.set("x-correlation-id", metadata.correlationId);
    if (metadata.idempotencyKey) headers.set("idempotency-key", metadata.idempotencyKey);

    const absoluteUrl = /^https?:\/\//i.test(path)
      ? path
      : `${this.baseUrl}/${path.replace(/^\/+/, "")}`;

    return {
      path,
      url: appendQuery(absoluteUrl, config.query),
      attempt,
      config: { ...config, headers, metadata },
    };
  }

  private async applyRequestInterceptors(
    initial: ApiRequestContext
  ): Promise<ApiRequestContext> {
    let context = initial;
    for (const interceptor of this.requestInterceptors) {
      context = await interceptor(context);
    }
    return context;
  }

  private async dispatch(initial: ApiRequestContext): Promise<Response> {
    const context = await this.applyRequestInterceptors(initial);
    const { query: _query, timeoutMs = this.defaultTimeoutMs, metadata: _metadata, signal, ...init } =
      context.config;
    void _query;
    void _metadata;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeoutId = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

    try {
      let response = await this.fetchImplementation(context.url, {
        ...init,
        signal: controller.signal,
      });

      for (const interceptor of this.responseInterceptors) {
        const intercepted = await interceptor({
          request: context,
          response,
          replay: async (overrides) => {
            const replayConfig = mergeConfig(context.config, overrides);
            return this.dispatch(this.createContext(context.path, replayConfig, context.attempt + 1));
          },
        });
        if (intercepted) response = intercepted;
      }

      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) {
        if (signal?.aborted) throw error;
        throw new TimeoutError(timeoutMs);
      }
      throw new NetworkError(error instanceof Error ? error.message : "Unknown network error", {
        cause: error,
      });
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private requestWithBody<T>(
    method: "POST" | "PUT" | "PATCH",
    path: string,
    body?: unknown,
    config: ApiRequestConfig = {}
  ): Promise<T> {
    if (body === undefined) return this.request<T>(path, { ...config, method });
    if (body === null || isBodyInit(body)) {
      return this.request<T>(path, { ...config, method, body });
    }

    const headers = mergeHeaders(config.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return this.request<T>(path, {
      ...config,
      method,
      headers,
      body: JSON.stringify(body),
    });
  }

  private async parseSuccess<T>(response: Response): Promise<T> {
    if (response.status === 204 || response.status === 205) return undefined as T;
    const text = await response.text();
    if (text.length === 0) return undefined as T;

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("json")) {
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new NetworkError("The API returned invalid JSON", { cause: error });
      }
    }
    return text as T;
  }
}

export function createApiClient(options: ApiClientOptions | string): ApiClient {
  return new ApiClient(options);
}

export const apiClient = createApiClient({ baseUrl: API_BASE_URL });
