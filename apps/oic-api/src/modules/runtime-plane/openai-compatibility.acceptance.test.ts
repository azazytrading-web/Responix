import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { OicRuntimeRequest, OicRuntimeResponse, OicRuntimeStreamEvent, OicVisibleModel } from "@oic/contracts";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { OicRuntimeException, runtimeErrorMessage } from "./runtime-errors";
import { OpenAICompatibilityController, compatibilityContract } from "./openai-compatibility.controller";

const actor: AuthenticatedPrincipal = { id: "principal-1", applicationId: "application-1", scopes: ["oic:runtime:invoke", "oic:runtime:models:read"], tenantIds: [] };
const response: OicRuntimeResponse = {
  object: "oic.runtime.response", id: "response-1", model: "oi-1.7", output: [{ role: "assistant", content: [{ type: "text", text: "hello" }] }],
  finishReason: "completed", usage: { inputTokens: 3, outputTokens: 1 }, createdAt: new Date(1_700_000_000_000).toISOString(), requestId: "request-1", traceId: "trace-1", execution: { runtimeVersion: "1", durationMs: 12 }
};
function fakeRequest(headers: Record<string, string | string[]> = {}) {
  return { headers, requestId: "request-1", once() { return this; }, off() { return this; } } as never;
}
function fakeResponse() {
  const chunks: string[] = [];
  const headers = new Map<string, string>();
  const target = {
    chunks, headers, statusCode: 0, writableEnded: false, headersSent: false,
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
    flushHeaders() { this.headersSent = true; },
    write(value: string) { this.headersSent = true; chunks.push(value); return true; },
    end() { this.writableEnded = true; },
    once() { return this; }, off() { return this; }
  };
  return target;
}

void test("OpenAI chat and Responses requests translate only the supported text contract", () => {
  const chat = compatibilityContract.nativeChatRequest({ model: "oi-1.7", messages: [
    { role: "system", content: "follow the contract" },
    { role: "user", content: [{ type: "text", text: "hello" }] }
  ] });
  assert.equal(chat.request.input[0]?.speaker, "instruction");
  assert.equal(chat.request.input[1]?.speaker, "user");
  assert.equal(chat.request.input[1]?.content[0]?.text, "hello");
  const responses = compatibilityContract.nativeResponsesRequest({ model: "oi-1.7", instructions: "be concise", input: "hello" });
  assert.equal(responses.request.input[0]?.speaker, "instruction");
  assert.equal(responses.request.input[1]?.speaker, "user");
  assert.throws(() => compatibilityContract.nativeChatRequest({ model: "oi-1.7", messages: [{ role: "user", content: "hello" }], tools: [] }), (error: unknown) => error instanceof OicRuntimeException && error.code === "CAPABILITY_NOT_SUPPORTED");
  assert.throws(() => compatibilityContract.nativeChatRequest({ model: "oi-1.7", messages: [{ role: "user", content: "hello" }], max_tokens: 20 }), OicRuntimeException);
  assert.throws(() => compatibilityContract.nativeChatRequest({ model: "gpt-4o", messages: [{ role: "user", content: "hello" }] }), OicRuntimeException);
  assert.throws(() => compatibilityContract.nativeResponsesRequest({ model: "oi-1.7", input: "hello", store: true }), OicRuntimeException);
  assert.throws(() => compatibilityContract.nativeChatRequest({ model: "oi-1.7", messages: [{ role: "tool", content: "result" }] }), (error: unknown) => error instanceof OicRuntimeException && error.code === "CAPABILITY_NOT_SUPPORTED");
  assert.throws(() => compatibilityContract.nativeChatRequest({ model: "oi-1.7", messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://invalid" } }] }] }), OicRuntimeException);
});

void test("compatibility outputs preserve Oi identity and omit unknown usage", () => {
  const chat = compatibilityContract.chatResponse(response) as { model: string; choices: Array<{ message: { content: string } }>; usage: Record<string, number> };
  assert.equal(chat.model, "oi-1.7");
  assert.equal(chat.choices[0]?.message.content, "hello");
  assert.deepEqual(chat.usage, { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 });
  const responseWithoutUsage = { ...response, usage: null };
  const responses = compatibilityContract.responsesResponse(responseWithoutUsage);
  assert.equal("usage" in responses, false);
  const listed: OicVisibleModel[] = [{ id: "oi-1.7", displayName: "Oi 1.7", capabilities: ["text.generate"] }];
  assert.deepEqual(listed.map(({ id }) => id), ["oi-1.7"]);
  assert.equal(runtimeErrorMessage("MODEL_NOT_AVAILABLE").includes("provider"), false);
});

void test("compatibility controllers call native runtime and translate chat/Responses SSE", async () => {
  const invocations: Array<{ request: OicRuntimeRequest; operation: string | undefined }> = [];
  const runtime = {
    invoke(_actor: AuthenticatedPrincipal, request: OicRuntimeRequest, _identity: unknown, _key: string | undefined, _signal: unknown, operation?: string) {
      invocations.push({ request, operation });
      return Promise.resolve(response);
    },
    stream(): Promise<AsyncIterable<OicRuntimeStreamEvent>> {
      const events: OicRuntimeStreamEvent[] = [
        { type: "response.started", responseId: "stream-1", model: "oi-1.7", requestId: "request-1", traceId: "trace-1" },
        { type: "content.delta", responseId: "stream-1", text: "hello" },
        { type: "usage.updated", responseId: "stream-1", usage: { outputTokens: 1 } },
        { type: "response.completed", response: { ...response, id: "stream-1", usage: { outputTokens: 1 } } }
      ];
      return Promise.resolve({ async *[Symbol.asyncIterator]() { for (const event of events) { await Promise.resolve(); yield event; } } });
    },
    listVisibleModels(): Promise<{ context: never; models: OicVisibleModel[] }> { return Promise.resolve({ context: undefined as never, models: [{ id: "oi-1.7", displayName: "Oi 1.7", capabilities: ["text.generate", "text.stream"] }] }); }
  };
  const controller = new OpenAICompatibilityController(runtime as never);
  const chatResult = await controller.chatCompletions(actor, { model: "oi-1.7", messages: [{ role: "user", content: "hello" }], tenant_id: "00000000-0000-4000-8000-000000000001" }, fakeRequest(), fakeResponse() as never) as Record<string, unknown>;
  assert.equal(chatResult.object, "chat.completion");
  assert.equal(invocations[0]?.request.tenant?.kind, "id");
  assert.equal(invocations[0]?.operation, "compat.chat.v1");
  const responsesResult = await controller.responses(actor, { model: "oi-1.7", input: "hello" }, fakeRequest(), fakeResponse() as never) as Record<string, unknown>;
  assert.equal(responsesResult.object, "response");
  assert.equal(invocations[1]?.operation, "compat.responses.v1");

  const chatWire = fakeResponse();
  await controller.chatCompletions(actor, { model: "oi-1.7", messages: [{ role: "user", content: "hello" }], stream: true }, fakeRequest(), chatWire as never);
  assert.ok(chatWire.chunks.some((chunk) => chunk.includes("chat.completion.chunk")));
  assert.ok(chatWire.chunks.some((chunk) => chunk === "data: [DONE]\n\n"));
  const responsesWire = fakeResponse();
  await controller.responses(actor, { model: "oi-1.7", input: "hello", stream: true }, fakeRequest(), responsesWire as never);
  assert.ok(responsesWire.chunks.some((chunk) => chunk.includes("response.output_text.delta")));
  assert.ok(responsesWire.chunks.some((chunk) => chunk.includes("response.completed")));

  const unavailableRuntime = { ...runtime, stream: () => Promise.reject(new OicRuntimeException("MODEL_NOT_AVAILABLE")) };
  const unavailableController = new OpenAICompatibilityController(unavailableRuntime as never);
  const unavailableWire = fakeResponse();
  await assert.rejects(unavailableController.chatCompletions(actor, { model: "oi-1.7", stream: true, messages: [{ role: "user", content: "hello" }] }, fakeRequest(), unavailableWire as never), (error: unknown) => error instanceof OicRuntimeException && error.code === "MODEL_NOT_AVAILABLE");
  assert.equal(unavailableWire.headersSent, false);
  assert.equal(unavailableWire.writableEnded, false);
});
