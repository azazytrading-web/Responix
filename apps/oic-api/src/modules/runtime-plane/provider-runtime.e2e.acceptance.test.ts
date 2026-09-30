import "reflect-metadata";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { RuntimeContextResolver } from "./runtime-context";
import { DatabaseOicModelResolver } from "./model-resolver";
import { BoundedRuntimePolicy } from "./runtime-policy";
import { OicRuntimeService } from "./runtime.service";
import { OpenAICompatibilityController } from "./openai-compatibility.controller";
import { encryptProviderCredential } from "../control-plane/provider-credential.crypto";
import { ProviderRuntimeExecutor } from "./provider-runtime-executor";
import { LocalProviderHttpFixture } from "./provider-http.fixture";

function useDedicatedDatabase(): boolean {
  const file = resolve(__dirname, "../../../../../.env.oic.local");
  try {
    const values = new Map<string, string>();
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([^#=]+)=(.*)$/.exec(line);
      if (match) values.set(match[1]!, match[2]!.trim().replace(/^['"]|['"]$/g, ""));
    }
    const url = process.env.OIC_TEST_DATABASE_URL ?? values.get("OIC_MIGRATION_DATABASE_URL");
    if (!url) return false;
    const parsed = new URL(url);
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(decodeURIComponent(parsed.pathname.slice(1)))) throw new Error("Provider runtime E2E requires the local OIC migration-test database");
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function requestObject() {
  const request = new EventEmitter() as EventEmitter & { headers: Record<string, string>; requestId: string };
  request.headers = {};
  request.requestId = randomUUID();
  return request;
}
function responseObject() {
  const response = new EventEmitter() as EventEmitter & { chunks: string[]; headers: Map<string, string>; statusCode: number; writableEnded: boolean; headersSent: boolean; setHeader(name: string, value: string): void; flushHeaders(): void; write(value: string): boolean; end(): void };
  response.chunks = [];
  response.headers = new Map();
  response.statusCode = 0;
  response.writableEnded = false;
  response.headersSent = false;
  response.setHeader = (name, value) => { response.headers.set(name, value); };
  response.flushHeaders = () => { response.headersSent = true; };
  response.write = (value) => { response.headersSent = true; response.chunks.push(value); return true; };
  response.end = () => { response.writableEnded = true; };
  return response;
}

const enabled = useDedicatedDatabase();
void test("Native Runtime and compatibility execute through the DB resolver, provider executor and counted HTTP fixture", { skip: !enabled }, async (t) => {
  const fixture = new LocalProviderHttpFixture();
  const endpointUrl = await fixture.start();
  const priorKey = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const db = new OicDatabaseService();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 15).toUpperCase();
  let appId: string | undefined;
  let principalId: string | undefined;
  let connectionId: string | undefined;
  let upstreamId: string | undefined;
  let familyId: string | undefined;
  let editionId: string | undefined;
  let revisionId: string | undefined;
  let variantId: string | undefined;
  let bindingId: string | undefined;
  try {
    await db.$connect();
    const app = await db.oicApplication.create({ data: { key: `E2${suffix}`, displayName: "Provider Runtime E2E" } });
    appId = app.id;
    const principal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `e2e-${suffix.toLowerCase()}`, displayName: "Runtime E2E principal" } });
    principalId = principal.id;
    const scopes = ["oic:runtime:invoke", "oic:runtime:models:read"];
    await db.oicPrincipalScopeGrant.createMany({ data: scopes.map((scope) => ({ applicationId: app.id, principalId: principal.id, scope })) });
    const actor: AuthenticatedPrincipal = { id: principal.id, applicationId: app.id, scopes, tenantIds: [] };
    const definition = await db.oicProviderDefinition.findUniqueOrThrow({ where: { key: "openai" } });
    const connection = await db.oicProviderConnection.create({ data: { providerDefinitionId: definition.id, scope: "APPLICATION", applicationId: app.id, displayName: "E2E local fixture", endpointUrl, transportProfile: "openai-chat-completions-v1", status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: new Date() } });
    connectionId = connection.id;
    const encrypted = encryptProviderCredential("e2e-only-secret", connection.id, 1);
    await db.oicProviderCredential.create({ data: { connectionId: connection.id, version: 1, ...encrypted } });
    const upstream = await db.oicUpstreamModel.create({ data: { providerDefinitionId: definition.id, connectionId: connection.id, upstreamModelId: "fixture-private-upstream", displayName: "Fixture upstream", source: "MANUAL" } });
    upstreamId = upstream.id;
    await db.oicUpstreamCapabilityEvidence.createMany({ data: ["text.generate", "text.stream"].map((capability) => ({ upstreamModelId: upstream.id, capability, status: "SUPPORTED", source: "PLATFORM_CURATED" })) });
    const family = await db.oicModelFamily.create({ data: { familyKey: `e2e-${suffix.toLowerCase()}`, displayName: "E2E Oi Family", lifecycle: "PRODUCTION" } });
    familyId = family.id;
    const publicId = `oi-e2e-${suffix.toLowerCase()}`;
    const edition = await db.oicModelEdition.create({ data: { familyId: family.id, publicId, editionKey: "default", displayName: "E2E Oi Model", lifecycle: "PRODUCTION" } });
    editionId = edition.id;
    const revision = await db.oicModelRevision.create({ data: { editionId: edition.id, revision: 1, instructions: "acceptance" } });
    revisionId = revision.id;
    const variant = await db.oicModelVariant.create({ data: { revisionId: revision.id, variantKey: "primary", kind: "EXTERNAL_PROVIDER", providerDefinitionId: definition.id, upstreamModelId: upstream.id, transportProfile: "openai-chat-completions-v1" } });
    variantId = variant.id;
    const binding = await db.oicRuntimeBinding.create({ data: { editionId: edition.id, variantId: variant.id, connectionId: connection.id, scope: "APPLICATION", applicationId: app.id, status: "ACTIVE", environment: "production" } });
    bindingId = binding.id;
    await db.oicApplicationModelVisibility.create({ data: { applicationId: app.id, editionId: edition.id } });

    const resolver = new DatabaseOicModelResolver(db);
    const network = {
      timeoutMs: 500,
      resolveEndpoint(input: string) {
        const url = new URL(input);
        if (url.hostname !== "provider-fixture.test" || url.protocol !== "http:") throw new Error("non-fixture network path");
        return Promise.resolve({ url, hostname: url.hostname, addresses: [{ address: "127.0.0.1", family: 4 as const }] });
      },
      request(url: URL, headers: Record<string, string>, body: Buffer, signal: AbortSignal | undefined, timeoutMs: number) {
        return new Promise<IncomingMessage>((resolveResponse, reject) => {
          let incoming: IncomingMessage | undefined;
          const outgoing = httpRequest(url, { method: "POST", headers, signal, timeout: timeoutMs, lookup: (_host, options, callback) => options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) }, (response) => { incoming = response; resolveResponse(response); });
          outgoing.on("timeout", () => { const error = new Error("fixture timeout"); incoming?.destroy(error); outgoing.destroy(error); });
          outgoing.on("error", reject);
          outgoing.end(body);
        });
      }
    };
    const executor = ProviderRuntimeExecutor.forTest(db, network);
    const runtime = new OicRuntimeService(db, new RuntimeContextResolver(db), resolver, executor, new BoundedRuntimePolicy());
    const model = publicId as `oi-${string}`;
    const body = { model, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "hello from Native Runtime" }] }] };
    const identity = { requestId: `e2e-${suffix}`, traceId: `trace-${suffix}` };

    await t.test("Native Runtime uses actual provider fixture and idempotency replays one upstream call", async () => {
      fixture.mode = "success";
      const before = fixture.captured.length;
      const [first, replay] = await Promise.all([runtime.invoke(actor, body, identity, `e2e-${suffix}`), runtime.invoke(actor, body, identity, `e2e-${suffix}`)]);
      assert.deepEqual(first, replay);
      assert.equal(first.output[0]?.content[0]?.text, "fixture answer");
      assert.deepEqual(first.usage, { inputTokens: 11, cachedInputTokens: 2, outputTokens: 4, reasoningTokens: 1 });
      assert.equal(fixture.captured.length - before, 1);
      assert.equal(JSON.stringify(first).includes("fixture-private-upstream"), false);
      assert.equal(JSON.stringify(first).includes("e2e-only-secret"), false);
      const models = await runtime.listVisibleModels(actor, undefined, identity);
      assert.deepEqual(models.models.map((item) => item.id), [model]);
      assert.equal(JSON.stringify(models).includes("fixture-private-upstream"), false);
    });

    await t.test("Native Runtime streaming consumes provider SSE and returns raw usage evidence", async () => {
      fixture.mode = "stream";
      const events = [];
      for await (const event of await runtime.stream(actor, body, identity, undefined)) events.push(event);
      assert.deepEqual(events.map((event) => event.type), ["response.started", "content.delta", "content.delta", "usage.updated", "response.completed"]);
      assert.equal(events.filter((event) => event.type === "content.delta").map((event) => event.text).join(""), "part-1part-2");
      assert.deepEqual(events.find((event) => event.type === "usage.updated")?.usage, { inputTokens: 7, cachedInputTokens: 2, outputTokens: 3 });
    });

    const compatibility = new OpenAICompatibilityController(runtime);
    await t.test("Chat Completions and Responses compatibility traverse the real runtime and provider", async () => {
      fixture.mode = "success";
      const chat = await compatibility.chatCompletions(actor, { model, messages: [{ role: "user", content: "compat chat" }] }, requestObject() as never, responseObject() as never) as { object: string; model: string; choices: Array<{ message: { content: string } }> };
      assert.equal(chat.object, "chat.completion");
      assert.equal(chat.model, model);
      assert.equal(chat.choices[0]?.message.content, "fixture answer");
      const responses = await compatibility.responses(actor, { model, input: "compat responses", instructions: "be concise" }, requestObject() as never, responseObject() as never) as { object: string; model: string; output: Array<{ content: Array<{ text: string }> }> };
      assert.equal(responses.object, "response");
      assert.equal(responses.model, model);
      assert.equal(responses.output[0]?.content[0]?.text, "fixture answer");
      assert.ok(fixture.captured.at(-2)?.body.includes('"messages"'));
      assert.ok(fixture.captured.at(-1)?.body.includes('"messages"'));
    });

    await t.test("compatibility streaming maps both consumer protocols over provider SSE", async () => {
      fixture.mode = "stream";
      const chatRequest = requestObject();
      const chatResponse = responseObject();
      await compatibility.chatCompletions(actor, { model, messages: [{ role: "user", content: "chat stream" }], stream: true }, chatRequest as never, chatResponse as never);
      assert.ok(chatResponse.chunks.some((chunk) => chunk.includes("chat.completion.chunk")));
      assert.ok(chatResponse.chunks.some((chunk) => chunk.includes("[DONE]")));
      const responsesResponse = responseObject();
      await compatibility.responses(actor, { model, input: "responses stream", stream: true }, requestObject() as never, responsesResponse as never);
      assert.ok(responsesResponse.chunks.some((chunk) => chunk.includes("response.output_text.delta")));
      assert.ok(responsesResponse.chunks.some((chunk) => chunk.includes("response.completed")));
    });
  } finally {
    if (principalId) await db.oicIdempotencyRecord.deleteMany({ where: { principalId } }).catch(() => undefined);
    if (editionId) await db.oicApplicationModelVisibility.deleteMany({ where: { editionId } }).catch(() => undefined);
    if (bindingId) await db.oicRuntimeBinding.deleteMany({ where: { id: bindingId } }).catch(() => undefined);
    if (variantId) await db.oicModelVariant.deleteMany({ where: { id: variantId } }).catch(() => undefined);
    if (revisionId) await db.oicModelRevision.deleteMany({ where: { id: revisionId } }).catch(() => undefined);
    if (editionId) await db.oicModelEdition.deleteMany({ where: { id: editionId } }).catch(() => undefined);
    if (familyId) await db.oicModelFamily.deleteMany({ where: { id: familyId } }).catch(() => undefined);
    if (upstreamId) {
      await db.oicUpstreamCapabilityEvidence.deleteMany({ where: { upstreamModelId: upstreamId } }).catch(() => undefined);
      await db.oicUpstreamPricingEvidence.deleteMany({ where: { upstreamModelId: upstreamId } }).catch(() => undefined);
      await db.oicUpstreamModel.deleteMany({ where: { id: upstreamId } }).catch(() => undefined);
    }
    if (connectionId) {
      await db.oicProviderHealthCheck.deleteMany({ where: { connectionId } }).catch(() => undefined);
      await db.oicProviderCredential.deleteMany({ where: { connectionId } }).catch(() => undefined);
      await db.oicProviderConnection.deleteMany({ where: { id: connectionId } }).catch(() => undefined);
    }
    if (principalId) {
      await db.oicPrincipalScopeGrant.deleteMany({ where: { principalId } }).catch(() => undefined);
      await db.oicServicePrincipal.deleteMany({ where: { id: principalId } }).catch(() => undefined);
    }
    if (appId) await db.oicApplication.deleteMany({ where: { id: appId } }).catch(() => undefined);
    await db.$disconnect();
    await fixture.stop();
    if (priorKey === undefined) delete process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = priorKey;
  }
});
