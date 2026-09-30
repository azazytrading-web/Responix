import "reflect-metadata";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { OicResolvedModel, OicRuntimeContext, OicRuntimeRequest } from "@oic/contracts";
import { encryptProviderCredential } from "../control-plane/provider-credential.crypto";
import { LocalProviderHttpFixture } from "./provider-http.fixture";
import { ProviderRuntimeExecutor } from "./provider-runtime-executor";
import { OicRuntimeException } from "./runtime-errors";

const context: OicRuntimeContext = { requestId: "fixture-request", traceId: "fixture-trace", applicationId: "app-id", principalId: "principal-id", tenantId: "tenant-id" };
const request: OicRuntimeRequest = { model: "oi-fixture", input: [
  { speaker: "instruction", content: [{ type: "text", text: "be concise" }] },
  { speaker: "user", content: [{ type: "text", text: "hello" }] }
], maxOutputUnits: 77 };
const model: OicResolvedModel & { bindingId: string } = { id: "oi-fixture", displayName: "Fixture Oi model", capabilities: ["text.generate", "text.stream"], resolverVersion: "test", bindingId: "binding-id" };

void test("provider Chat Completions executor exercises actual controlled HTTP request and response mapping", async (t) => {
  const fixture = new LocalProviderHttpFixture();
  const previousKey = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const endpointUrl = await fixture.start();
  const connectionId = "connection-id";
  const encrypted = encryptProviderCredential("fixture-secret-never-log", connectionId, 1);
  let binding = {
    connectionId,
    connection: {
      status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: new Date(), endpointUrl,
      transportProfile: "openai-chat-completions-v1", providerDefinition: { key: "openai", authStrategy: "BEARER" },
      credentials: [{ ...encrypted, version: 1 }]
    },
    variant: { transportProfile: "openai-chat-completions-v1", upstreamModel: { upstreamModelId: "provider-private-model" } }
  };
  const db = { oicRuntimeBinding: { findFirst: () => Promise.resolve(binding) } };
  const executor = ProviderRuntimeExecutor.forTest(db as never, {
    timeoutMs: 75,
    resolveEndpoint(input) {
      const url = new URL(input);
      if (url.hostname !== "provider-fixture.test" || url.protocol !== "http:") throw new Error("fixture endpoint rejected");
      return Promise.resolve({ url, hostname: url.hostname, addresses: [{ address: "127.0.0.1", family: 4 }] });
    },
    request(url, headers, body, signal, timeoutMs) {
      return new Promise((resolve, reject) => {
        let response: IncomingMessage | undefined;
        const req = httpRequest(url, {
          method: "POST", headers, signal, timeout: timeoutMs,
          lookup: (_hostname, options, callback) => options.all
            ? callback(null, [{ address: "127.0.0.1", family: 4 }])
            : callback(null, "127.0.0.1", 4)
        }, (incoming) => { response = incoming; resolve(incoming); });
        req.on("timeout", () => {
          const error = new Error("fixture timeout");
          if (response) response.destroy(error);
          else req.destroy(error);
        });
        req.on("error", reject);
        req.end(body);
      });
    }
  });
  try {
    await t.test("wire request translates model, roles, content, generation limit and bearer auth", async () => {
      fixture.mode = "success";
      const result = await executor.execute(model, request, context);
      assert.equal(result.outputText, "fixture answer");
      assert.equal(result.finishReason, "completed");
      assert.deepEqual(result.usage, { inputTokens: 11, cachedInputTokens: 2, outputTokens: 4, reasoningTokens: 1 });
      const sent = fixture.captured.at(-1)!;
      assert.equal(sent.authorization, "Bearer fixture-secret-never-log");
      assert.equal(sent.contentType, "application/json");
      const body = JSON.parse(sent.body) as { model: string; messages: Array<{ role: string; content: string }>; max_tokens: number; stream: boolean };
      assert.equal(body.model, "provider-private-model");
      assert.deepEqual(body.messages, [{ role: "system", content: "be concise" }, { role: "user", content: "hello" }]);
      assert.equal(body.max_tokens, 77);
      assert.equal(body.stream, false);
      assert.equal(JSON.stringify(result).includes("provider-private-model"), false);
      assert.equal(JSON.stringify(result).includes("fixture-secret-never-log"), false);
    });

    await t.test("stream translates multiple events and usage to OIC chunks", async () => {
      fixture.mode = "stream";
      const chunks = [];
      for await (const chunk of executor.stream(model, { ...request }, context)) chunks.push(chunk);
      assert.deepEqual(chunks, [
        { type: "content.delta", text: "part-1" }, { type: "content.delta", text: "part-2" },
        { type: "usage.updated", usage: { inputTokens: 7, cachedInputTokens: 2, outputTokens: 3 } }
      ]);
      const body = JSON.parse(fixture.captured.at(-1)!.body) as { stream: boolean; stream_options: { include_usage: boolean } };
      assert.equal(body.stream, true);
      assert.equal(body.stream_options.include_usage, true);
    });

    await t.test("provider-side OpenAI Responses transport maps its request, result, stream and usage", async () => {
      binding = {
        ...binding,
        connection: { ...binding.connection, transportProfile: "openai-responses-v1" },
        variant: { ...binding.variant, transportProfile: "openai-responses-v1" }
      };
      fixture.mode = "success";
      const result = await executor.execute(model, request, context);
      assert.equal(result.outputText, "fixture answer");
      assert.equal(result.executorVersion, "openai-responses-v1");
      assert.deepEqual(result.usage, { inputTokens: 11, cachedInputTokens: 2, outputTokens: 4, reasoningTokens: 1 });
      const sent = fixture.captured.at(-1)!;
      assert.equal(new URL(endpointUrl).pathname, "/v1");
      const body = JSON.parse(sent.body) as { model: string; input: Array<{ role: string; content: Array<{ type: string; text: string }> }>; max_output_tokens: number; stream: boolean };
      assert.equal(body.model, "provider-private-model");
      assert.deepEqual(body.input, [
        { role: "developer", content: [{ type: "input_text", text: "be concise" }] },
        { role: "user", content: [{ type: "input_text", text: "hello" }] }
      ]);
      assert.equal(body.max_output_tokens, 77);
      assert.equal(body.stream, false);
      fixture.mode = "stream";
      const chunks = [];
      for await (const chunk of executor.stream(model, request, context)) chunks.push(chunk);
      assert.deepEqual(chunks, [
        { type: "content.delta", text: "part-1" }, { type: "content.delta", text: "part-2" },
        { type: "usage.updated", usage: { inputTokens: 7, cachedInputTokens: 2, outputTokens: 3 } }
      ]);
      const streamBody = JSON.parse(fixture.captured.at(-1)!.body) as { stream: boolean; max_output_tokens: number; input: unknown[] };
      assert.equal(streamBody.stream, true);
      assert.equal(streamBody.max_output_tokens, 77);
      assert.equal(streamBody.input.length, 2);
      binding = {
        ...binding,
        connection: { ...binding.connection, transportProfile: "openai-chat-completions-v1" },
        variant: { ...binding.variant, transportProfile: "openai-chat-completions-v1" }
      };
    });

    await t.test("provider statuses normalize and raw error bodies stay hidden", async () => {
      const expected = { "400": "PROVIDER_REQUEST_REJECTED", "401": "PROVIDER_AUTHENTICATION_FAILED", "403": "PROVIDER_AUTHORIZATION_FAILED", "404": "UPSTREAM_MODEL_UNAVAILABLE", "408": "UPSTREAM_TIMEOUT", "429": "RATE_LIMITED", "500": "PROVIDER_UNAVAILABLE", "502": "PROVIDER_UNAVAILABLE", "503": "PROVIDER_UNAVAILABLE" } as const;
      for (const status of Object.keys(expected) as Array<keyof typeof expected>) {
        fixture.mode = status;
        await assert.rejects(executor.execute(model, request, context), (error: unknown) => error instanceof OicRuntimeException && error.code === expected[status] && !error.message.includes("fixture-only"));
      }
    });

    await t.test("malformed, truncated, oversized and unexpected content are rejected", async () => {
      for (const mode of ["malformed", "truncated", "oversized", "unexpected-content-type"] as const) {
        fixture.mode = mode;
        await assert.rejects(executor.execute(model, request, context), OicRuntimeException);
      }
    });

    await t.test("redirects are not followed", async () => {
      fixture.mode = "unsafe-redirect";
      const before = fixture.captured.length;
      await assert.rejects(executor.execute(model, request, context), OicRuntimeException);
      assert.equal(fixture.captured.length, before + 1);
    });

    await t.test("caller cancellation aborts an in-flight stream and fixture observes disconnect", async () => {
      fixture.mode = "slow-stream";
      fixture.delayMs = 500;
      const controller = new AbortController();
      const iterator = executor.stream(model, request, context, controller.signal)[Symbol.asyncIterator]();
      assert.deepEqual(await iterator.next(), { done: false, value: { type: "content.delta", text: "part-1" } });
      controller.abort();
      await assert.rejects(iterator.next());
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.ok(fixture.cancellationCount > 0);
    });

    await t.test("request timeout is bounded and normalized", async () => {
      fixture.mode = "delay";
      fixture.delayMs = 500;
      await assert.rejects(executor.execute(model, request, context), (error: unknown) => error instanceof OicRuntimeException && error.code === "UPSTREAM_TIMEOUT");
    });

    await t.test("stream timeout and malformed/provider-error/oversized events normalize", async () => {
      fixture.mode = "slow-stream";
      fixture.delayMs = 500;
      const consume = async () => { for await (const chunk of executor.stream(model, request, context)) assert.ok(chunk); };
      await assert.rejects(consume(), (error: unknown) => error instanceof OicRuntimeException && error.code === "UPSTREAM_TIMEOUT");
      for (const [mode, code] of [["malformed-stream", "PROVIDER_RESPONSE_INVALID"], ["stream-provider-error", "PROVIDER_STREAM_INTERRUPTED"], ["oversized-stream", "PROVIDER_RESPONSE_TOO_LARGE"]] as const) {
        fixture.mode = mode;
        await assert.rejects(consume(), (error: unknown) => error instanceof OicRuntimeException && error.code === code);
      }
    });

    await t.test("stream close before terminal event is rejected", async () => {
      fixture.mode = "close-mid-stream";
      const read = async () => { for await (const chunk of executor.stream(model, request, context)) assert.ok(chunk); };
      await assert.rejects(read(), (error: unknown) => error instanceof OicRuntimeException && error.code === "PROVIDER_STREAM_INTERRUPTED");
    });
  } finally {
    await fixture.stop();
    if (previousKey === undefined) delete process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = previousKey;
  }
});
