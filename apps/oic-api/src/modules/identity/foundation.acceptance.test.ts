import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ForbiddenException, HttpException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { OicDatabaseService } from "@oic/database";
import { OicAuthenticationGuard } from "./auth.guard";
import type { AuthenticatedPrincipal } from "./auth.guard";
import { PrismaFoundationAuditWriter } from "./foundation-audit-writer";
import type { FoundationAuditWriter } from "./foundation-audit-writer";
import { FoundationService, OIC_SCOPES } from "./foundation.service";
import { verifyCredential } from "./credential.crypto";
import { assertBootstrapAuthorized, initializePlatformAdmin } from "../../bootstrap-admin";

function prepareDedicatedTestDatabase(): boolean {
  const envPath = resolve(__dirname, "../../../../../.env.oic.local");
  try {
    const entries = new Map<string, string>();
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = /^([^#=]+)=(.*)$/.exec(line);
      if (match) entries.set(match[1]!, match[2]!);
    }
    const url = process.env.OIC_TEST_DATABASE_URL ?? entries.get("OIC_MIGRATION_DATABASE_URL");
    if (!url) return false;
    const parsed = new URL(url);
    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(databaseName)) {
      throw new Error("OIC Foundation integration tests require the dedicated local OIC migration/test database");
    }
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

const hasDedicatedDatabase = prepareDedicatedTestDatabase();
void test("OIC Foundation database acceptance suite", { skip: !hasDedicatedDatabase }, async (t) => {
  const db = new OicDatabaseService();
  await db.$connect();
  const auditWriter = new PrismaFoundationAuditWriter();
  const service = new FoundationService(db, auditWriter);
  const actor: AuthenticatedPrincipal = { id: randomUUID(), applicationId: "", scopes: [...OIC_SCOPES], tenantIds: [] };
  const suffix = randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
  const appInput = { key: `T${suffix}`, displayName: "Foundation acceptance application" };

  try {
    await t.test("initial bootstrap requires the exact process authorization", () => {
      assert.throws(() => assertBootstrapAuthorized([], {}), /explicit operator authorization/);
      assert.throws(() => assertBootstrapAuthorized(["--authorize-bootstrap"], {}), /explicit operator authorization/);
      assert.throws(() => assertBootstrapAuthorized(["--authorize-bootstrap", "extra"], { OIC_BOOTSTRAP_AUTHORIZED: "true" }), /explicit operator authorization/);
      assert.doesNotThrow(() => assertBootstrapAuthorized(["--authorize-bootstrap"], { OIC_BOOTSTRAP_AUTHORIZED: "true" }));
    });

    await t.test("bootstrap is creation-only and refuses suspended canonical state", async () => {
      let app = await db.oicApplication.findUnique({ where: { key: "OIC_PLATFORM" } });
      if (!app) {
        const initial = await initializePlatformAdmin(db, auditWriter);
        initial.credential = "";
        app = await db.oicApplication.findUniqueOrThrow({ where: { key: "OIC_PLATFORM" } });
      }
      const principal = await db.oicServicePrincipal.findUniqueOrThrow({
        where: { applicationId_key: { applicationId: app.id, key: "platform-admin" } }
      });
      await db.oicApplication.update({ where: { id: app.id }, data: { status: "SUSPENDED" } });
      await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "SUSPENDED" } });
      try {
        await assert.rejects(initializePlatformAdmin(db, auditWriter), /bootstrap state already exists/);
      } finally {
        await db.oicApplication.update({ where: { id: app.id }, data: { status: "ACTIVE" } });
        await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "ACTIVE" } });
      }
    });

    actor.applicationId = randomUUID();
    const first = service.createApplication(actor, appInput, `same-${suffix}`, {});
    const second = service.createApplication(actor, appInput, `same-${suffix}`, {});
    const [createdA, createdB] = await Promise.all([first, second]);
    assert.equal(createdA.value.id, createdB.value.id);
    assert.equal(await db.oicApplication.count({ where: { key: appInput.key } }), 1);
    const createAuditCount = await db.oicAuditEvent.count({ where: { action: "application.created", targetId: createdA.value.id } });
    assert.equal(createAuditCount, 1);
    assert.equal([createdA.replayed, createdB.replayed].filter(Boolean).length, 1);

    await t.test("concurrent same-key different-payload requests conflict without a second effect", async () => {
      const key = `race-${suffix}`;
      const left = { key: `L${suffix}`, displayName: "Concurrent left" };
      const right = { key: `R${suffix}`, displayName: "Concurrent right" };
      const results = await Promise.allSettled([
        service.createApplication(actor, left, key, {}),
        service.createApplication(actor, right, key, {})
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      assert.equal(await db.oicApplication.count({ where: { key: { in: [left.key, right.key] } } }), 1);
    });

    await t.test("isolation, mapping uniqueness, scope and lifecycle rules", async () => {
      const app = await db.oicApplication.findUniqueOrThrow({ where: { key: appInput.key } });
      actor.applicationId = app.id;
      const otherApp = await db.oicApplication.create({ data: { key: `U${suffix}`, displayName: "Other app" } });
      const tenantA = await db.oicTenant.create({ data: { applicationId: app.id, key: `a${suffix}`, displayName: "Tenant A" } });
      const tenantB = await db.oicTenant.create({ data: { applicationId: app.id, key: `b${suffix}`, displayName: "Tenant B" } });
      const foreignTenant = await db.oicTenant.create({ data: { applicationId: otherApp.id, displayName: "Foreign tenant" } });
      const principal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `p${suffix}`, displayName: "Reader" } });
      const reader: AuthenticatedPrincipal = { id: principal.id, applicationId: app.id, scopes: ["oic:tenants:read"], tenantIds: [tenantA.id] };
      assert.equal((await service.getTenant(reader, tenantA.id)).id, tenantA.id);
      await assert.rejects(service.getTenant(reader, tenantB.id));
      await assert.rejects(service.getTenant(reader, foreignTenant.id));
      await assert.rejects(service.getApplication(reader, otherApp.id));

      const managerPrincipal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `m${suffix}`, displayName: "Tenant manager" } });
      const manager: AuthenticatedPrincipal = { id: managerPrincipal.id, applicationId: app.id, scopes: ["oic:applications:read", "oic:tenants:read", "oic:tenants:manage"], tenantIds: [] };
      const managedTenant = await db.oicTenant.create({ data: { applicationId: app.id, key: `m${suffix}`, displayName: "Newly provisioned tenant" } });
      const managedReference = { sourceType: "acceptance", externalId: `managed-${suffix}` };
      await service.createExternalReference(manager, app.id, managedTenant.id, managedReference, `managed-ext-${suffix}`, {});
      assert.equal((await service.getTenantByExternalReference(manager, app.id, managedReference.sourceType, managedReference.externalId)).id, managedTenant.id);
      await assert.rejects(service.getTenant(manager, managedTenant.id));
      await service.grantTenant(manager, app.id, managerPrincipal.id, managedTenant.id, `managed-grant-${suffix}`, {});
      assert.equal((await db.oicPrincipalTenantGrant.findUniqueOrThrow({ where: { principalId_tenantId: { principalId: managerPrincipal.id, tenantId: managedTenant.id } } })).revokedAt, null);

      const extInput = { sourceType: "acceptance", externalId: `opaque-${suffix}` };
      await service.createExternalReference(actor, app.id, tenantA.id, extInput, `ext-${suffix}`, {});
      await assert.rejects(service.createExternalReference(actor, app.id, tenantB.id, extInput, `extdup-${suffix}`, {}));
      await assert.rejects(service.grantScope(actor, app.id, principal.id, "oic:unknown:admin", `bad-${suffix}`, {}), ForbiddenException);
      const insufficient: AuthenticatedPrincipal = { ...reader, scopes: ["oic:tenants:read"] };
      await assert.rejects(service.grantScope(insufficient, app.id, principal.id, "oic:principals:manage", `esc-${suffix}`, {}), ForbiddenException);

      const alphaGrant = await service.grantTenant(actor, app.id, principal.id, tenantA.id, `grant-${suffix}`, {});
      assert.equal(alphaGrant.value.tenantId, tenantA.id);
      await service.changeLifecycle(actor, "tenant", app.id, tenantB.id, "ARCHIVED", {});
      await assert.rejects(service.changeLifecycle(actor, "tenant", app.id, tenantB.id, "ACTIVE", {}));
    });

    await t.test("credential one-time disclosure, verifier-only storage, rotation, expiry, revoke and rate limit", async () => {
      const app = await db.oicApplication.findUniqueOrThrow({ where: { key: appInput.key } });
      actor.applicationId = app.id;
      const principal = await db.oicServicePrincipal.findFirstOrThrow({ where: { applicationId: app.id, key: `p${suffix}` } });
      const issue = await service.issueCredential(actor, app.id, principal.id, null, null, `cred-${suffix}`, {});
      const issueSecret = issue.credential;
      assert.ok(issueSecret);
      const row = await db.oicMachineCredential.findUniqueOrThrow({ where: { id: issue.id } });
      assert.notEqual(row.verifier, issueSecret);
      assert.equal(await verifyCredential(issueSecret.split(".")[2]!, row.verifier), true);
      const replay = await service.issueCredential(actor, app.id, principal.id, null, null, `cred-${suffix}`, {});
      assert.equal(replay.credential, null);
      assert.equal(replay.replayed, true);

      const rotated = await service.issueCredential(actor, app.id, principal.id, null, issue.id, `rotate-${suffix}`, {});
      assert.ok(rotated.credential);
      assert.equal((await db.oicMachineCredential.findUniqueOrThrow({ where: { id: issue.id } })).status, "REVOKED");
      const expired = await service.issueCredential(actor, app.id, principal.id, null, null, `expire-${suffix}`, {});
      await db.oicMachineCredential.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const guard = new OicAuthenticationGuard(db);
      const request = (token: string, ip: string): { headers: Record<string, string>; ip: string; principal?: AuthenticatedPrincipal } => ({ headers: { authorization: `Bearer ${token}` }, ip });
      const context = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;
      await assert.rejects(guard.canActivate(context(request(issueSecret, "192.0.2.10"))), UnauthorizedException);
      await assert.rejects(guard.canActivate(context(request(expired.credential!, "192.0.2.11"))), UnauthorizedException);
      await assert.rejects(guard.canActivate(context({ headers: {}, ip: "192.0.2.13" })), UnauthorizedException);
      const authenticatedRequest = request(rotated.credential, "192.0.2.14");
      assert.equal(await guard.canActivate(context(authenticatedRequest)), true);
      const grantedTenant = await db.oicTenant.findUniqueOrThrow({ where: { applicationId_key: { applicationId: app.id, key: `a${suffix}` } } });
      assert.deepEqual(authenticatedRequest.principal?.tenantIds, [grantedTenant.id]);
      assert.equal((await service.getTenant(authenticatedRequest.principal, grantedTenant.id)).id, grantedTenant.id);
      const ungrantedTenant = await db.oicTenant.findUniqueOrThrow({ where: { applicationId_key: { applicationId: app.id, key: `b${suffix}` } } });
      await assert.rejects(service.getTenant(authenticatedRequest.principal, ungrantedTenant.id));
      const revoked = await service.issueCredential(actor, app.id, principal.id, null, null, `revoke-${suffix}`, {});
      await service.revokeCredential(actor, app.id, revoked.id, {});
      await assert.rejects(guard.canActivate(context(request(revoked.credential!, "192.0.2.12"))), UnauthorizedException);

      const oldLimit = process.env.OIC_AUTH_REQUESTS_PER_MINUTE;
      process.env.OIC_AUTH_REQUESTS_PER_MINUTE = "2";
      try {
        const limited = new OicAuthenticationGuard(db);
        const limitedContext = context(request("", `192.0.2.${100 + Math.floor(Math.random() * 100)}`));
        await assert.rejects(limited.canActivate(limitedContext), UnauthorizedException);
        await assert.rejects(limited.canActivate(limitedContext), UnauthorizedException);
        await assert.rejects(limited.canActivate(limitedContext), (error: unknown) => error instanceof HttpException && error.getStatus() === 429);
      } finally {
        if (oldLimit === undefined) delete process.env.OIC_AUTH_REQUESTS_PER_MINUTE;
        else process.env.OIC_AUTH_REQUESTS_PER_MINUTE = oldLimit;
      }
    });

    await t.test("scoped audit and append-only trigger", async () => {
      const app = await db.oicApplication.findUniqueOrThrow({ where: { key: appInput.key } });
      const reader: AuthenticatedPrincipal = { id: randomUUID(), applicationId: app.id, scopes: ["oic:audit:read"], tenantIds: [] };
      const events = await service.readAudit(reader, app.id, 100);
      assert.ok(events.length > 0);
      assert.ok(events.every((event) => event.applicationId === app.id && event.tenantId === null));
      const event = await db.oicAuditEvent.findFirstOrThrow({ where: { applicationId: app.id } });
      await assert.rejects(db.oicAuditEvent.update({ where: { id: event.id }, data: { action: event.action } }));
    });

    await t.test("audit failures roll back resource, credential, scope, grant and idempotency mutations", async () => {
      const brokenWriter: FoundationAuditWriter = { write: () => Promise.reject(new Error("injected test audit failure")) };
      const failing = new FoundationService(db, brokenWriter);
      const input = { key: `Z${suffix}`, displayName: "Must roll back" };
      await assert.rejects(failing.createApplication(actor, input, `fail-app-${suffix}`, {}));
      assert.equal(await db.oicApplication.count({ where: { key: input.key } }), 0);
      assert.equal(await db.oicIdempotencyRecord.count({ where: { principalId: actor.id, key: `fail-app-${suffix}` } }), 0);

      const app = await db.oicApplication.findUniqueOrThrow({ where: { key: appInput.key } });
      const principal = await db.oicServicePrincipal.findFirstOrThrow({ where: { applicationId: app.id, key: `p${suffix}` } });
      const rollbackTenant = await db.oicTenant.create({ data: { applicationId: app.id, key: `r${suffix}`, displayName: "Grant rollback" } });
      await assert.rejects(failing.grantTenant(actor, app.id, principal.id, rollbackTenant.id, `fail-tenant-${suffix}`, {}));
      assert.equal(await db.oicPrincipalTenantGrant.count({ where: { principalId: principal.id, tenantId: rollbackTenant.id, revokedAt: null } }), 0);
      const scope = `oic:principals:read`;
      await assert.rejects(failing.grantScope(actor, app.id, principal.id, scope, `fail-scope-${suffix}`, {}));
      assert.equal(await db.oicPrincipalScopeGrant.count({ where: { principalId: principal.id, scope } }), 0);
      const active = await db.oicMachineCredential.findFirstOrThrow({ where: { principalId: principal.id, status: "ACTIVE" } });
      const beforeCount = await db.oicMachineCredential.count({ where: { principalId: principal.id } });
      await assert.rejects(failing.issueCredential(actor, app.id, principal.id, null, active.id, `fail-rotate-${suffix}`, {}));
      assert.equal((await db.oicMachineCredential.findUniqueOrThrow({ where: { id: active.id } })).status, "ACTIVE");
      assert.equal(await db.oicMachineCredential.count({ where: { principalId: principal.id } }), beforeCount);
      await assert.rejects(failing.revokeCredential(actor, app.id, active.id, {}));
      assert.equal((await db.oicMachineCredential.findUniqueOrThrow({ where: { id: active.id } })).status, "ACTIVE");
    });
  } finally {
    await db.$disconnect();
  }
});
