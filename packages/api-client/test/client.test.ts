import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  NetworkError,
  PermissionDeniedError,
  TimeoutError,
  ValidationError,
} from "../src/errors";
import { createApiClient, type ApiRequestContext } from "../src/client";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("ApiClient", () => {
  it("binds the default fetch implementation to the global object", async () => {
    const originalFetch = globalThis.fetch;
    const receiverAwareFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = receiverAwareFetch;

    try {
      const client = createApiClient({ baseUrl: "http://localhost:4000" });
      await expect(client.get("/health")).resolves.toEqual({ ok: true });
      expect(receiverAwareFetch).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns raw Nest DTO responses without requiring an envelope", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: "workspace-1" }));
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });

    await expect(client.get<{ id: string }>("/api/v1/workspaces/current")).resolves.toEqual({
      id: "workspace-1",
    });
  });

  it("serializes existing and configured query parameters", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const client = createApiClient({ baseUrl: "http://localhost:4000/", fetch: fetchMock });
    const date = new Date("2026-08-01T00:00:00.000Z");

    await client.get("/api/v1/items?existing=yes", {
      query: {
        page: 2,
        active: false,
        tag: ["one", "two"],
        since: date,
        omitted: undefined,
      },
    });

    const requestInput = fetchMock.mock.calls[0]?.[0];
    const requestedUrl = new URL(
      typeof requestInput === "string"
        ? requestInput
        : requestInput instanceof URL
          ? requestInput.href
          : requestInput!.url
    );
    expect(requestedUrl.origin + requestedUrl.pathname).toBe("http://localhost:4000/api/v1/items");
    expect(requestedUrl.searchParams.get("existing")).toBe("yes");
    expect(requestedUrl.searchParams.get("page")).toBe("2");
    expect(requestedUrl.searchParams.get("active")).toBe("false");
    expect(requestedUrl.searchParams.getAll("tag")).toEqual(["one", "two"]);
    expect(requestedUrl.searchParams.get("since")).toBe(date.toISOString());
    expect(requestedUrl.searchParams.has("omitted")).toBe(false);
  });

  it("returns undefined for 204 and empty successful responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });

    await expect(client.delete<void>("/api/v1/item")).resolves.toBeUndefined();
    await expect(client.get<void>("/api/v1/empty")).resolves.toBeUndefined();
  });

  it("serializes JSON bodies including false and zero", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ updated: true }));
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });

    await client.post("/api/v1/flags", { enabled: false, limit: 0 });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe('{"enabled":false,"limit":0}');
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("propagates request metadata as headers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createApiClient({
      baseUrl: "http://localhost:4000",
      fetch: fetchMock,
      requestIdFactory: () => "generated-id",
    });

    await client.get("/api/v1/health", {
      metadata: {
        requestId: "request-id",
        correlationId: "correlation-id",
        idempotencyKey: "idempotency-key",
      },
    });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-request-id")).toBe("request-id");
    expect(headers.get("x-correlation-id")).toBe("correlation-id");
    expect(headers.get("idempotency-key")).toBe("idempotency-key");
  });

  it("normalizes backend permission and validation errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 403, code: "PERMISSION_DENIED", message: "Forbidden" },
          { status: 403 }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 400, message: ["email must be valid"] }, { status: 400 })
      );
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });

    await expect(client.get("/api/v1/protected")).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(client.post("/api/v1/input", {})).rejects.toBeInstanceOf(ValidationError);
  });

  it("preserves unknown backend error codes and request IDs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { statusCode: 409, code: "STATE_CONFLICT", message: "Conflict", requestId: "body-id" },
        { status: 409 }
      )
    );
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });

    const error = await client.get("/api/v1/conflict").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "STATE_CONFLICT", requestId: "body-id" });
  });

  it("distinguishes timeouts from network failures", async () => {
    const timeoutFetch = vi.fn<typeof fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    );
    const timeoutClient = createApiClient({
      baseUrl: "http://localhost:4000",
      fetch: timeoutFetch,
      defaultTimeoutMs: 5,
    });
    await expect(timeoutClient.get("/api/v1/slow")).rejects.toBeInstanceOf(TimeoutError);

    const networkClient = createApiClient({
      baseUrl: "http://localhost:4000",
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("socket closed")),
    });
    await expect(networkClient.get("/api/v1/down")).rejects.toBeInstanceOf(NetworkError);
  });

  it("runs interceptors in order and supports one-request replay", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });
    const requestAttempts: number[] = [];

    client.addRequestInterceptor((context) => {
      requestAttempts.push(context.attempt);
      return context;
    });
    client.addResponseInterceptor(async ({ request, response, replay }) => {
      if (response.status === 401 && request.attempt === 0) {
        return replay({ headers: { Authorization: "Bearer replacement" } });
      }
    });

    await expect(client.get("/api/v1/protected")).resolves.toEqual({ ok: true });
    expect(requestAttempts).toEqual([0, 1]);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("authorization")).toBe(
      "Bearer replacement"
    );
  });

  it("allows interceptors to be removed", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: "http://localhost:4000", fetch: fetchMock });
    const interceptor = vi.fn((context: ApiRequestContext) => context);
    const remove = client.addRequestInterceptor(interceptor);
    remove();

    await client.get("/api/v1/health");
    expect(interceptor).not.toHaveBeenCalled();
  });
});
