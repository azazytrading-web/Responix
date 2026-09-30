import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { OicDatabaseService } from "@oic/database";
import { AppModule } from "../../app/app.module";
import { initializePlatformAdmin } from "../../bootstrap-admin";
import type { FoundationAuditWriter } from "./foundation-audit-writer";
import { PrismaFoundationAuditWriter } from "./foundation-audit-writer";
import { OIC_FOUNDATION_ADMIN_SCOPES } from "./foundation-policy";
import { AdminRecoveryService, OIC_RECOVERY_CONFIRMATION, parseRecoveryAuthorization } from "./admin-recovery.service";
import { issueCredential, verifyCredential } from "./credential.crypto";

function prepareTestDatabase(): boolean {
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
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(decodeURIComponent(parsed.pathname.slice(1)))) {
      throw new Error("Recovery tests require the dedicated local OIC migration/test database");
    }
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

const hasTestDatabase = prepareTestDatabase();
void test("OIC protected administrator recovery acceptance", { skip: !hasTestDatabase }, async (t) => {
  const db = new OicDatabaseService();
  await db.$connect();
  const writer = new PrismaFoundationAuditWriter();
  const service = new AdminRecoveryService(db, writer);
  try {
    let application = await db.oicApplication.findUnique({ where: { key: "OIC_PLATFORM" } });
    if (!application) {
      const initial = await initializePlatformAdmin(db, writer);
      initial.credential = "";
      application = await db.oicApplication.findUniqueOrThrow({ where: { key: "OIC_PLATFORM" } });
    }
    const principal = await db.oicServicePrincipal.findUnique({
      where: { applicationId_key: { applicationId: application.id, key: "platform-admin" } }
    });
    assert.ok(principal, "canonical admin must exist; recovery cannot recreate missing records");

    await t.test("operator authorization is explicit, bounded and target-fixed", () => {
      const env: NodeJS.ProcessEnv = {
        OIC_OPERATOR_RECOVERY_AUTHORIZED: "1",
        OIC_OPERATOR_RECOVERY_CONFIRMATION: OIC_RECOVERY_CONFIRMATION,
        OIC_OPERATOR_RECOVERY_OPERATION_ID: `authorized-${randomUUID()}`,
        OIC_OPERATOR_RECOVERY_REASON: "Restore suspended operator access"
      };
      assert.equal(parseRecoveryAuthorization(["--recover-admin"], env).reason, env.OIC_OPERATOR_RECOVERY_REASON);
      assert.throws(() => parseRecoveryAuthorization(["--recover-admin"], { ...env, OIC_OPERATOR_RECOVERY_AUTHORIZED: undefined }));
      assert.throws(() => parseRecoveryAuthorization(["--recover-admin"], { ...env, OIC_OPERATOR_RECOVERY_CONFIRMATION: "wrong" }));
      assert.throws(() => parseRecoveryAuthorization(["--recover-admin"], { ...env, OIC_OPERATOR_RECOVERY_REASON: "short" }));
      assert.throws(() => parseRecoveryAuthorization(["--recover-admin", "--application-id", randomUUID()], env));
      assert.throws(() => parseRecoveryAuthorization(["--recover-admin", "--principal-id", randomUUID()], env));
      assert.throws(() => parseRecoveryAuthorization(["--recover-admin"], { ...env, OIC_OPERATOR_RECOVERY_REASON: "oic_v1.selector.secret" }));
    });

    await t.test("suspended canonical identities recover atomically and return one credential", async () => {
      const reason = "Restore suspended platform administrator";
      const operationId = `recover-${randomUUID()}`;
      const issuedOld = await issueCredential();
      await db.oicMachineCredential.create({ data: { principalId: principal.id, selector: issuedOld.selector, verifier: issuedOld.verifier } });
      await db.oicPrincipalScopeGrant.update({
        where: { principalId_scope: { principalId: principal.id, scope: OIC_FOUNDATION_ADMIN_SCOPES[0] } }, data: { revokedAt: new Date() }
      });
      await db.oicPrincipalScopeGrant.upsert({
        where: { principalId_scope: { principalId: principal.id, scope: "oic:future:scope" } },
        create: { applicationId: application.id, principalId: principal.id, scope: "oic:future:scope" },
        update: { revokedAt: null }
      });
      const before = await db.oicMachineCredential.findMany({ where: { principalId: principal.id, status: "ACTIVE" }, select: { id: true } });
      await db.oicApplication.update({ where: { id: application.id }, data: { status: "SUSPENDED" } });
      await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "SUSPENDED" } });

      const result = await service.recover({ operationId, reason });
      assert.equal(result.replayed, false);
      assert.ok(result.credential);
      assert.equal(result.revokedCredentialCount, before.length);
      const recoveredApp = await db.oicApplication.findUniqueOrThrow({ where: { id: application.id } });
      const recoveredPrincipal = await db.oicServicePrincipal.findUniqueOrThrow({ where: { id: principal.id } });
      assert.equal(recoveredApp.status, "ACTIVE");
      assert.equal(recoveredPrincipal.status, "ACTIVE");
      const activeCredentials = await db.oicMachineCredential.findMany({ where: { principalId: principal.id, status: "ACTIVE" } });
      assert.equal(activeCredentials.length, 1);
      assert.equal(activeCredentials[0]!.id, result.credentialId);
      for (const old of before) assert.equal((await db.oicMachineCredential.findUniqueOrThrow({ where: { id: old.id } })).status, "REVOKED");
      const scopes = await db.oicPrincipalScopeGrant.findMany({ where: { principalId: principal.id, revokedAt: null }, select: { scope: true }, orderBy: { scope: "asc" } });
      assert.deepEqual(scopes.map((entry) => entry.scope), [...OIC_FOUNDATION_ADMIN_SCOPES].sort());
      const verifier = activeCredentials[0]!.verifier;
      assert.notEqual(verifier, result.credential);
      assert.equal(await verifyCredential(result.credential.split(".")[2]!, verifier), true);
      const audit = await db.oicAuditEvent.findFirstOrThrow({ where: { action: "foundation.admin.recovered", requestId: operationId } });
      const auditText = JSON.stringify(audit.metadata);
      assert.ok(auditText.includes(reason));
      assert.ok(!auditText.includes(result.credential));
      assert.ok(!auditText.includes(verifier));
      assert.equal(audit.actorPrincipalId, null);

      const countBeforeReplay = await db.oicMachineCredential.count({ where: { principalId: principal.id } });
      const replay = await service.recover({ operationId, reason });
      assert.equal(replay.replayed, true);
      assert.equal(replay.credential, null);
      assert.equal(await db.oicMachineCredential.count({ where: { principalId: principal.id } }), countBeforeReplay);
      await assert.rejects(service.recover({ operationId, reason: "Different recovery reason" }));

      const { OicAuthenticationGuard } = await import("./auth.guard");
      const guard = new OicAuthenticationGuard(db);
      const contextFor = (token: string, ip: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` }, ip }) }) }) as never;
      await assert.rejects(guard.canActivate(contextFor(issuedOld.token, "192.0.2.41")));
      assert.equal(await guard.canActivate(contextFor(result.credential, "192.0.2.42")), true);
      issuedOld.token = ""; issuedOld.verifier = "";
    });

    await t.test("simultaneous recovery retries commit one credential and one audit event", async () => {
      const operationId = `recover-race-${randomUUID()}`;
      const input = { operationId, reason: "Concurrent operator recovery test" };
      await db.oicApplication.update({ where: { id: application.id }, data: { status: "SUSPENDED" } });
      await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "SUSPENDED" } });
      const [left, right] = await Promise.all([service.recover(input), service.recover(input)]);
      assert.equal([left, right].filter((item) => !item.replayed).length, 1);
      assert.equal([left, right].filter((item) => item.credential !== null).length, 1);
      assert.equal(await db.oicAdminRecoveryRecord.count({ where: { operationId } }), 1);
      assert.equal(await db.oicAuditEvent.count({ where: { action: "foundation.admin.recovered", requestId: operationId } }), 1);
      assert.equal(await db.oicMachineCredential.count({ where: { principalId: principal.id, status: "ACTIVE" } }), 1);
    });

    await t.test("audit failure rolls back every recovery transition and credential", async () => {
      const operationId = `recover-fail-${randomUUID()}`;
      const input = { operationId, reason: "Audit failure rollback test" };
      const priorCredential = await issueCredential();
      await db.oicMachineCredential.create({ data: { principalId: principal.id, selector: priorCredential.selector, verifier: priorCredential.verifier } });
      const beforeCredentials = await db.oicMachineCredential.count({ where: { principalId: principal.id } });
      await db.oicApplication.update({ where: { id: application.id }, data: { status: "SUSPENDED" } });
      await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "SUSPENDED" } });
      const brokenWriter: FoundationAuditWriter = { write: () => Promise.reject(new Error("injected audit failure")) };
      try {
        await assert.rejects(new AdminRecoveryService(db, brokenWriter).recover(input));
        assert.equal((await db.oicApplication.findUniqueOrThrow({ where: { id: application.id } })).status, "SUSPENDED");
        assert.equal((await db.oicServicePrincipal.findUniqueOrThrow({ where: { id: principal.id } })).status, "SUSPENDED");
        assert.equal(await db.oicMachineCredential.count({ where: { principalId: principal.id } }), beforeCredentials);
        assert.equal((await db.oicMachineCredential.findUniqueOrThrow({ where: { selector: priorCredential.selector } })).status, "ACTIVE");
        assert.equal(await db.oicAdminRecoveryRecord.count({ where: { operationId } }), 0);
        assert.equal(await db.oicAuditEvent.count({ where: { action: "foundation.admin.recovered", requestId: operationId } }), 0);
      } finally {
        const recovery = await service.recover({ operationId: `recover-clean-${randomUUID()}`, reason: "Restore test platform state" });
        recovery.credential = null;
        priorCredential.token = ""; priorCredential.verifier = "";
      }
    });

    await t.test("missing and terminal recovery targets fail closed; recovery has no HTTP route", async () => {
      const fakeTx = { oicApplication: { findUnique: () => Promise.resolve(null) } };
      const fakeDb = { $transaction: (fn: (tx: typeof fakeTx) => Promise<unknown>) => Promise.resolve(fn(fakeTx)) };
      await assert.rejects(new AdminRecoveryService(fakeDb as unknown as OicDatabaseService).recover({
        operationId: `recover-missing-${randomUUID()}`, reason: "Missing target fail closed"
      }), /missing/);

      await db.oicApplication.update({ where: { id: application.id }, data: { status: "ARCHIVED" } });
      try {
        await assert.rejects(service.recover({ operationId: `recover-terminal-${randomUUID()}`, reason: "Terminal target fail closed" }), /Terminal/);
      } finally {
        await db.oicApplication.update({ where: { id: application.id }, data: { status: "ACTIVE" } });
        await db.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "ACTIVE" } });
      }

      const app = await NestFactory.create(AppModule, { logger: false });
      app.setGlobalPrefix("api");
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
      try {
        await app.listen(0, "127.0.0.1");
        const httpServer = app.getHttpServer() as Server;
        const address = httpServer.address();
        assert.ok(address && typeof address !== "string");
        const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/recover-admin`, { method: "POST" });
        assert.equal(response.status, 404);
      } finally { await app.close(); }
    });
  } finally {
    await db.$disconnect();
  }
});
