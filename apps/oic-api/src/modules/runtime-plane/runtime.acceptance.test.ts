import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { OicDatabaseService } from "@oic/database";
import type { OicModelResolver, OicResolvedModel, OicRuntimeExecutionResult, OicRuntimeExecutor, OicRuntimeRequest, OicRuntimeExecutionStreamChunk, OicVisibleModel } from "@oic/contracts";
import { OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { issueCredential } from "../identity/credential.crypto";
import { OIC_RUNTIME_SCOPES } from "./runtime-scopes";
import { RuntimeContextResolver } from "./runtime-context";
import { parseOicRuntimeRequest, validateRuntimeHeaders } from "./runtime-request";
import { BoundedRuntimePolicy } from "./runtime-policy";
import { UnavailableOicModelResolver } from "./model-resolver";
import { UnavailableOicRuntimeExecutor } from "./runtime-executor";
import { OicRuntimeService } from "./runtime.service";
import { OicRuntimeException } from "./runtime-errors";

function prepareDedicatedDatabase(): boolean {
  const path = resolve(__dirname, "../../../../../.env.oic.local");
  try {
    const values = new Map<string, string>();
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const entry = /^([^#=]+)=(.*)$/.exec(line);
      if (entry) values.set(entry[1]!, entry[2]!);
    }
    const url = process.env.OIC_TEST_DATABASE_URL ?? values.get("OIC_MIGRATION_DATABASE_URL");
    if (!url) return false;
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(database)) throw new Error("OIC runtime tests require the dedicated local migration/test database");
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

const hasDedicatedDatabase = prepareDedicatedDatabase();

void test("Native Runtime request schema rejects identity spoofing and bounds identifiers", () => {
  const base = { model: "oi-1.7", input: [{ speaker: "user", content: [{ type: "text", text: "hello" }] }] };
  assert.equal(parseOicRuntimeRequest(base).model, "oi-1.7");
  assert.throws(() => parseOicRuntimeRequest({ ...base, applicationId: randomUUID() }), OicRuntimeException);
  assert.throws(() => parseOicRuntimeRequest({ ...base, principalId: randomUUID() }), OicRuntimeException);
  assert.throws(() => parseOicRuntimeRequest({ ...base, model: "gpt-4o" }), OicRuntimeException);
  assert.throws(() => validateRuntimeHeaders({ "x-trace-id": "x".repeat(129) }), OicRuntimeException);
  assert.throws(() => validateRuntimeHeaders({ "idempotency-key": "bad key" }), OicRuntimeException);
});

void test("OIC Runtime context, security and kernel acceptance", { skip: !hasDedicatedDatabase }, async (t) => {
  const db = new OicDatabaseService();
  await db.$connect();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
  const app = await db.oicApplication.create({ data: { key: `R${suffix}`, displayName: "Runtime acceptance app" } });
  const otherApp = await db.oicApplication.create({ data: { key: `S${suffix}`, displayName: "Foreign runtime app" } });
  const tenantA = await db.oicTenant.create({ data: { applicationId: app.id, key: `a${suffix}`, displayName: "Granted tenant A" } });
  const tenantB = await db.oicTenant.create({ data: { applicationId: app.id, key: `b${suffix}`, displayName: "Granted tenant B" } });
  const foreignTenant = await db.oicTenant.create({ data: { applicationId: otherApp.id, key: `f${suffix}`, displayName: "Foreign tenant" } });
  const principal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `rt${suffix}`, displayName: "Runtime principal" } });
  const principalB = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `rb${suffix}`, displayName: "Second runtime principal" } });
  for (const current of [principal, principalB]) {
    await db.oicPrincipalScopeGrant.createMany({ data: OIC_RUNTIME_SCOPES.map((scope) => ({ applicationId: app.id, principalId: current.id, scope })) });
    for (const tenant of [tenantA, tenantB]) await db.oicPrincipalTenantGrant.create({ data: { applicationId: app.id, principalId: current.id, tenantId: tenant.id } });
  }
  const externalReference = await db.oicTenantExternalReference.create({ data: { applicationId: app.id, tenantId: tenantA.id, sourceType: "runtime-test", externalId: `external-${suffix}` } });
  const issued = await issueCredential();
  const credential = await db.oicMachineCredential.create({ data: { principalId: principal.id, selector: issued.selector, verifier: issued.verifier } });
  const guard = new OicAuthenticationGuard(db);
  const authContext = (headers: Record<string, string | string[] | undefined>, ip: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers, ip }) }) }) as unknown as ExecutionContext;
  const actorForToken = async (token: string): Promise<AuthenticatedPrincipal> => {
    const req: { headers: Record<string, string | string[] | undefined>; ip: string; principal?: AuthenticatedPrincipal } = { headers: { authorization: `Bearer ${token}` }, ip: `192.0.2.${Math.floor(Math.random() * 200) + 1}` };
    const enriched: { headers: Record<string, string | string[] | undefined>; ip: string; principal?: AuthenticatedPrincipal } = req;
    const actualContext = { switchToHttp: () => ({ getRequest: () => enriched }) } as unknown as ExecutionContext;
    assert.equal(await guard.canActivate(actualContext), true);
    return enriched.principal!;
  };
  const contextResolver = new RuntimeContextResolver(db);
  const actor = await actorForToken(issued.token);

  try {
    await t.test("missing, invalid, revoked and suspended credentials fail closed", async () => {
      await assert.rejects(guard.canActivate(authContext({}, `192.0.2.${Math.floor(Math.random() * 200) + 1}`)), UnauthorizedException);
      await assert.rejects(guard.canActivate(authContext({ authorization: "Bearer not-a-token" }, `192.0.2.${Math.floor(Math.random() * 200) + 1}`)), UnauthorizedException);
      const bad = `oic_v1.${randomUUID().replace(/-/g, "").slice(0, 22)}.${"A".repeat(43)}`;
      await assert.rejects(guard.canActivate(authContext({ authorization: `Bearer ${bad}` }, `192.0.2.${Math.floor(Math.random() * 200) + 1}`)), UnauthorizedException);
      const revokedSecret = await issueCredential();
      const revoked = await db.oicMachineCredential.create({ data: { principalId: principal.id, selector: revokedSecret.selector, verifier: revokedSecret.verifier, status: "REVOKED", revokedAt: new Date() } });
      await assert.rejects(guard.canActivate(authContext({ authorization: `Bearer ${revokedSecret.token}` }, `192.0.2.${Math.floor(Math.random() * 200) + 1}`)), UnauthorizedException);
      await db.oicMachineCredential.delete({ where: { id: revoked.id } });
      await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "SUSPENDED" } });
      await assert.rejects(guard.canActivate(authContext({ authorization: `Bearer ${issued.token}` }, `192.0.2.${Math.floor(Math.random() * 200) + 1}`)), UnauthorizedException);
      await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "ACTIVE" } });
      assert.ok(credential.id);
    });

    await t.test("authenticated Application and Tenant grants define runtime context", async () => {
      const contextA = await contextResolver.resolve(actor, { tenant: { kind: "id", tenantId: tenantA.id } }, { requestId: `request-${suffix}`, traceId: `trace-${suffix}` });
      assert.equal(contextA.applicationId, app.id);
      assert.equal(contextA.principalId, principal.id);
      assert.equal(contextA.tenantId, tenantA.id);
      assert.equal(contextA.requestId, `request-${suffix}`);
      assert.equal(contextA.traceId, `trace-${suffix}`);
      const externalContext = await contextResolver.resolve(actor, { tenant: { kind: "external-reference", sourceType: externalReference.sourceType, externalId: externalReference.externalId } }, {});
      assert.equal(externalContext.tenantId, tenantA.id);
      await assert.rejects(contextResolver.resolve(actor, { tenant: { kind: "id", tenantId: foreignTenant.id } }, {}), (error: unknown) => error instanceof OicRuntimeException && error.code === "TENANT_NOT_ALLOWED");
      await assert.rejects(contextResolver.resolve(actor, { tenant: { kind: "external-reference", sourceType: "other-app", externalId: "opaque" } }, {}), OicRuntimeException);
      await db.oicTenant.update({ where: { id: tenantA.id }, data: { status: "SUSPENDED" } });
      await assert.rejects(contextResolver.resolve(actor, { tenant: { kind: "id", tenantId: tenantA.id } }, {}), OicRuntimeException);
      await db.oicTenant.update({ where: { id: tenantA.id }, data: { status: "ACTIVE" } });
      await db.oicTenantExternalReference.update({ where: { id: externalReference.id }, data: { revokedAt: new Date() } });
      await assert.rejects(contextResolver.resolve(actor, { tenant: { kind: "external-reference", sourceType: externalReference.sourceType, externalId: externalReference.externalId } }, {}), OicRuntimeException);
    });

    await t.test("runtime invoke scope is checked independently from authentication", () => {
      const reflector = { getAllAndOverride: () => ["oic:runtime:invoke"] } as unknown as Reflector;
      const scopeGuard = new OicScopeGuard(reflector);
      const contextFor = (principalValue: AuthenticatedPrincipal) => ({
        switchToHttp: () => ({ getRequest: () => ({ principal: principalValue }) }),
        getHandler: () => ({}), getClass: () => ({})
      }) as unknown as ExecutionContext;
      assert.equal(scopeGuard.canActivate(contextFor(actor)), true);
      assert.throws(() => scopeGuard.canActivate(contextFor({ ...actor, scopes: [] })), ForbiddenException);
    });

    await t.test("test-only execution, raw usage, request identity and scoped idempotency", async () => {
      let executions = 0;
      const resolver: OicModelResolver = {
        resolve(model): Promise<OicResolvedModel> { return Promise.resolve({ id: model, displayName: "Test Oi model", capabilities: ["text.generate", "text.stream"], resolverVersion: "test", tenantRequired: true }); },
        listVisible(): Promise<OicVisibleModel[]> { return Promise.resolve([{ id: "oi-demo", displayName: "Test Oi model", capabilities: ["text.generate", "text.stream"] }]); }
      };
      const executor: OicRuntimeExecutor = {
        async execute(_model, _request, _context, signal): Promise<OicRuntimeExecutionResult> {
          if (signal?.aborted) throw new Error("cancelled");
          executions += 1;
          await new Promise((resolve) => setTimeout(resolve, 60));
          return { outputText: "test-only deterministic result", usage: { inputTokens: 5, outputTokens: 4 }, finishReason: "completed", executorVersion: "test" };
        },
        async *stream(): AsyncIterable<OicRuntimeExecutionStreamChunk> {
          await Promise.resolve();
          yield { type: "content.delta", text: "streamed" };
          yield { type: "usage.updated", usage: { outputTokens: 1 } };
        }
      };
      const service = new OicRuntimeService(db, contextResolver, resolver, executor, new BoundedRuntimePolicy());
      const request: OicRuntimeRequest = parseOicRuntimeRequest({ model: "oi-demo", input: [{ speaker: "user", content: [{ type: "text", text: "hello" }] }], tenant: { kind: "id", tenantId: tenantA.id } });
      const identity = { requestId: `same-${suffix}`, traceId: `trace-${suffix}` };
      const [first, replay] = await Promise.all([
        service.invoke(actor, request, identity, `runtime-${suffix}`),
        service.invoke(actor, request, identity, `runtime-${suffix}`)
      ]);
      assert.equal(executions, 1);
      assert.deepEqual(first, replay);
      assert.deepEqual(first.usage, { inputTokens: 5, outputTokens: 4 });
      assert.equal(first.requestId, `same-${suffix}`);
      assert.equal(first.traceId, `trace-${suffix}`);
      assert.equal(first.output[0]?.content[0]?.text, "test-only deterministic result");
      await assert.rejects(service.invoke(actor, { ...request, input: [{ speaker: "user", content: [{ type: "text", text: "different" }] }] }, identity, `runtime-${suffix}`), (error: unknown) => error instanceof OicRuntimeException && error.code === "IDEMPOTENCY_CONFLICT");
      const tenantBRequest = { ...request, tenant: { kind: "id" as const, tenantId: tenantB.id } };
      await service.invoke(actor, tenantBRequest, identity, `runtime-${suffix}`);
      assert.equal(executions, 2);
      const actorB = await actorForToken((await issueCredentialForPrincipal(db, principalB.id)).token);
      await service.invoke(actorB, request, identity, `runtime-${suffix}`);
      assert.equal(executions, 3);
      const available = await service.listVisibleModels(actor, undefined, identity);
      assert.deepEqual(available.models.map((model) => model.id), ["oi-demo"]);

      const events = [];
      for await (const event of await service.stream(actor, request, identity, undefined)) events.push(event);
      assert.deepEqual(events.map((event) => event.type), ["response.started", "content.delta", "usage.updated", "response.completed"]);
      assert.equal(events.at(-1)?.type, "response.completed");
      await assert.rejects(service.stream(actor, request, identity, "stream-replay"), (error: unknown) => error instanceof OicRuntimeException && error.code === "STREAMING_IDEMPOTENCY_UNSUPPORTED");

      let executorCleaned = false;
      const cancelExecutor: OicRuntimeExecutor = {
        execute: () => Promise.resolve({ outputText: "unused", finishReason: "completed", executorVersion: "test" }),
        stream: async function* (_model, _request, _context, signal) {
          try {
            yield { type: "content.delta", text: "first" };
            await new Promise<void>((resolve) => {
              if (signal?.aborted) resolve();
              else signal?.addEventListener("abort", () => resolve(), { once: true });
            });
          } finally { executorCleaned = true; }
        }
      };
      const cancelService = new OicRuntimeService(db, contextResolver, resolver, cancelExecutor, new BoundedRuntimePolicy());
      const cancellation = new AbortController();
      const cancelEvents = (await cancelService.stream(actor, request, identity, undefined, cancellation.signal))[Symbol.asyncIterator]();
      const started = await cancelEvents.next();
      assert.equal(started.done, false);
      const content = await cancelEvents.next();
      assert.equal(content.done, false);
      if (!content.done) assert.equal(content.value.type, "content.delta");
      cancellation.abort();
      assert.equal((await cancelEvents.next()).done, true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(executorCleaned, true);

      const failingExecutor: OicRuntimeExecutor = {
        execute: () => Promise.resolve({ outputText: "unused", finishReason: "completed", executorVersion: "test" }),
        async *stream() { await Promise.resolve(); yield { type: "content.delta", text: "before failure" }; throw new Error("provider_secret=must-not-leak"); }
      };
      const failingService = new OicRuntimeService(db, contextResolver, resolver, failingExecutor, new BoundedRuntimePolicy());
      const failedEvents = [];
      for await (const event of await failingService.stream(actor, request, identity, undefined)) failedEvents.push(event);
      const terminal = failedEvents.at(-1);
      assert.equal(terminal?.type, "response.error");
      if (terminal?.type === "response.error") assert.equal(terminal.error.message.includes("provider_secret"), false);
    });

    await t.test("production runtime has no model listing or fake inference", async () => {
      const productionService = new OicRuntimeService(db, contextResolver, new UnavailableOicModelResolver(), new UnavailableOicRuntimeExecutor(), new BoundedRuntimePolicy());
      assert.deepEqual(await productionService.listVisibleModels(actor, undefined, {}).then((value) => value.models), []);
      await assert.rejects(productionService.invoke(actor, { model: "oi-1.7", input: [{ speaker: "user", content: [{ type: "text", text: "hello" }] }] }, {}, undefined), (error: unknown) => error instanceof OicRuntimeException && error.code === "MODEL_NOT_AVAILABLE");
    });
  } finally {
    await db.$disconnect();
  }
});

async function issueCredentialForPrincipal(db: OicDatabaseService, principalId: string) {
  const issued = await issueCredential();
  await db.oicMachineCredential.create({ data: { principalId, selector: issued.selector, verifier: issued.verifier } });
  return issued;
}
