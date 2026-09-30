import assert from "node:assert/strict";
import test from "node:test";
import type { OicRuntimeRequest, OicRuntimeResponse } from "@oic/contracts";
import type { OicApiPath } from "./generated/oic-api.paths";
import { OicClient, createOicClient } from "./client";
import { OicClientAbortError, OicClientError, OicClientTimeoutError } from "./errors";

const request: OicRuntimeRequest = { model: "oi-1.7", input: [{ speaker: "user", content: [{ type: "text", text: "hello" }] }] };
const response: OicRuntimeResponse = {
  object: "oic.runtime.response", id: "response-1", model: "oi-1.7", output: [{ role: "assistant", content: [{ type: "text", text: "hello" }] }],
  finishReason: "completed", usage: null, createdAt: new Date(1_700_000_000_000).toISOString(), requestId: "request-1", traceId: "trace-1", execution: { runtimeVersion: "1", durationMs: 2 }
};

const generatedRuntimePath: OicApiPath = "/api/v1/runtime/invocations";
assert.equal(generatedRuntimePath, "/api/v1/runtime/invocations");

void test("OIC client injects auth and request metadata and invokes Native Runtime", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const secret = "oic_v1.selector.secret-not-to-log";
  const client = createOicClient({
    baseUrl: "http://oic.local", credential: secret, tenantId: "00000000-0000-4000-8000-000000000001", requestIdFactory: () => "generated-request",
    fetch: async (input, init) => { calls.push({ url: String(input), init: init ?? {} }); return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } }); }
  });
  const actual = await client.invoke(request, { traceId: "trace-1", idempotencyKey: "once", requestId: "caller-request" });
  assert.equal(actual.output[0]?.content[0]?.text, "hello");
  assert.equal(calls[0]?.url, "http://oic.local/api/v1/runtime/invocations");
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get("authorization"), `Bearer ${secret}`);
  assert.equal(headers.get("x-request-id"), "caller-request");
  assert.equal(headers.get("x-trace-id"), "trace-1");
  assert.equal(headers.get("idempotency-key"), "once");
  assert.equal(headers.get("x-oic-tenant-id"), "00000000-0000-4000-8000-000000000001");
  assert.equal(JSON.parse(String(calls[0]?.init.body)).tenant, undefined);
});

void test("OIC client normalizes typed API errors without echoing credentials", async () => {
  const secret = "oic_v1.selector.secret-not-to-log";
  const client = new OicClient({ baseUrl: "https://oic.local", credential: secret, fetch: async () => new Response(JSON.stringify({ error: { code: "MODEL_NOT_AVAILABLE", message: "No approved Oi Model binding", requestId: "request-9", traceId: "trace-9" } }), { status: 503, headers: { "content-type": "application/json" } }) });
  await assert.rejects(client.invoke(request), (error: unknown) => error instanceof OicClientError && error.status === 503 && error.code === "MODEL_NOT_AVAILABLE" && error.requestId === "request-9" && !error.message.includes(secret));
});

void test("OIC client honors timeout and caller cancellation", async () => {
  const stalledFetch: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(new Error("aborted"));
    else signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  const client = new OicClient({ baseUrl: "https://oic.local", credential: "credential", fetch: stalledFetch, timeoutMs: 1000 });
  await assert.rejects(client.invoke(request, { timeoutMs: 10 }), (error: unknown) => error instanceof OicClientTimeoutError && error.timeoutMs === 10);
  const controller = new AbortController();
  const cancelled = client.invoke(request, { signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled, OicClientAbortError);
});

void test("OIC client parses native SSE and cancels the stream reader on early exit", async () => {
  let cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: response.started\ndata: ${JSON.stringify({ type: "response.started", responseId: "r1", model: "oi-1.7", requestId: "q1", traceId: "t1" })}\n\nevent: content.delta\ndata: ${JSON.stringify({ type: "content.delta", responseId: "r1", text: "hello" })}\n\n`));
    },
    cancel() { cancelled = true; }
  });
  const client = new OicClient({ baseUrl: "https://oic.local", credential: "secret", fetch: async () => new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }) });
  const iterator = client.stream(request)[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value?.type, "response.started");
  assert.equal((await iterator.next()).value?.type, "content.delta");
  await iterator.return?.();
  assert.equal(cancelled, true);
});

void test("OIC client rejects stream replay keys and surfaces normalized stream errors", async () => {
  const client = new OicClient({ baseUrl: "https://oic.local", credential: "secret", fetch: async () => new Response(`event: response.error\ndata: ${JSON.stringify({ type: "response.error", error: { code: "RUNTIME_UNAVAILABLE", message: "Safe message", requestId: "q", traceId: "t" } })}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } }) });
  await assert.rejects(async () => { for await (const _event of client.stream(request, { idempotencyKey: "not-supported" })) { void _event; } }, (error: unknown) => error instanceof OicClientError && error.code === "STREAMING_IDEMPOTENCY_UNSUPPORTED");
  await assert.rejects(async () => { for await (const _event of client.stream(request)) { void _event; } }, (error: unknown) => error instanceof OicClientError && error.code === "RUNTIME_UNAVAILABLE");
});

void test("OIC client rejects conflicting Tenant selections and unsafe base URLs", async () => {
  const client = new OicClient({ baseUrl: "https://oic.local", credential: "secret", tenantId: "00000000-0000-4000-8000-000000000001" });
  await assert.rejects(client.invoke({ ...request, tenant: { kind: "external-reference", sourceType: "x", externalId: "y" } }), (error: unknown) => error instanceof OicClientError && error.code === "TENANT_SELECTION_CONFLICT");
  assert.throws(() => new OicClient({ baseUrl: "https://user:pass@oic.local", credential: "secret" }), TypeError);
});
