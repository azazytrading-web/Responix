import "reflect-metadata";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
import { initializePlatformAdmin } from "../../bootstrap-admin";
import { localDatabaseUrl } from "../../bootstrap-operational-admin";
import { FoundationService } from "./foundation.service";
import { PrismaFoundationAuditWriter } from "./foundation-audit-writer";
import type { FoundationAuditWriter } from "./foundation-audit-writer";
import { OIC_FOUNDATION_OPERATOR_SCOPES } from "./foundation-policy";
import { verifyCredential } from "./credential.crypto";
import {
  FileCredentialDelivery, OIC_OPERATIONAL_BOOTSTRAP_CONFIRMATION,
  OIC_OPERATIONAL_BOOTSTRAP_DECISION, OperationalAdminBootstrapService, parseOperationalBootstrapAuthorization
} from "./operational-admin-bootstrap.service";
import type { CredentialDelivery } from "./operational-admin-bootstrap.service";

const workspace = resolve(__dirname, "../../../../../");
function testDatabaseUrl(): string | null {
  const entries = readFileSync(resolve(workspace, ".env.oic.local"), "utf8");
  const value = process.env.OIC_TEST_DATABASE_URL ?? /^OIC_MIGRATION_DATABASE_URL=(.*)$/m.exec(entries)?.[1];
  if (!value) return null;
  const parsed = new URL(value);
  if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(decodeURIComponent(parsed.pathname.slice(1)))) {
    throw new Error("Operational bootstrap tests require the dedicated local migration/test database");
  }
  return value;
}

void test("OIC operational Foundation administrator bootstrap", { skip: !testDatabaseUrl() }, async (t) => {
  const baseUrl = testDatabaseUrl()!;
  const schema = `oic_foundation_bootstrap_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const priorUrl = process.env.OIC_DATABASE_URL;
  const base = new URL(baseUrl);
  base.searchParams.set("schema", "public");
  process.env.OIC_DATABASE_URL = base.toString();
  const administrator = new OicDatabaseService();
  let db: OicDatabaseService | null = null;
  const secretDir = await mkdtemp(join(tmpdir(), "oic-foundation-bootstrap-"));
  try {
    await administrator.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const isolated = new URL(baseUrl);
    isolated.searchParams.set("schema", schema);
    const prismaCli = require.resolve("prisma/build/index.js", { paths: [resolve(workspace, "packages/oic-database")] });
    const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", resolve(workspace, "packages/oic-database/prisma/schema.prisma")], {
      cwd: workspace, env: { ...process.env, OIC_DATABASE_URL: isolated.toString() }, encoding: "utf8", timeout: 180_000
    });
    if (migration.status !== 0) {
      const safeDiagnostic = (migration.stderr || migration.stdout || "unknown migration failure")
        .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]")
        .replace(/oic_v1\.[A-Za-z0-9_.-]+/g, "[credential redacted]");
      throw new Error(`Isolated OIC test schema migration failed: ${safeDiagnostic.slice(-1200)}`);
    }
    process.env.OIC_DATABASE_URL = isolated.toString();
    db = new OicDatabaseService();
    const foundation = new FoundationService(db, new PrismaFoundationAuditWriter());
    const initial = await initializePlatformAdmin(db);
    const recoveryProof = initial.credential;
    initial.credential = "";
    const app = await db.oicApplication.findUniqueOrThrow({ where: { key: "OIC_PLATFORM" } });
    const recovery = await db.oicServicePrincipal.findUniqueOrThrow({ where: { applicationId_key: { applicationId: app.id, key: "platform-admin" } } });
    const operationId = `foundation-${randomUUID()}`;
    const input = { operationId, reason: "Owner-approved isolated Foundation bootstrap test", decisionRef: OIC_OPERATIONAL_BOOTSTRAP_DECISION };
    const service = new OperationalAdminBootstrapService(db);
    const deliveryPath = join(secretDir, "oic-foundation-operator.credential");

    await t.test("explicit authorization and fixed command", () => {
      const env: NodeJS.ProcessEnv = {
        OIC_OPERATOR_BOOTSTRAP_AUTHORIZED: "1", OIC_OPERATOR_BOOTSTRAP_CONFIRMATION: OIC_OPERATIONAL_BOOTSTRAP_CONFIRMATION,
        OIC_OPERATOR_BOOTSTRAP_OPERATION_ID: operationId, OIC_OPERATOR_BOOTSTRAP_REASON: input.reason,
        OIC_OPERATOR_BOOTSTRAP_DECISION: OIC_OPERATIONAL_BOOTSTRAP_DECISION
      };
      assert.deepEqual(parseOperationalBootstrapAuthorization(["--bootstrap-operational-admin"], env), input);
      for (const args of [[], ["--bootstrap-operational-admin", "--principal-id", randomUUID()]]) {
        assert.throws(() => parseOperationalBootstrapAuthorization(args, env));
      }
      assert.throws(() => parseOperationalBootstrapAuthorization(["--bootstrap-operational-admin"], { ...env, OIC_OPERATOR_BOOTSTRAP_AUTHORIZED: undefined }));
      assert.throws(() => parseOperationalBootstrapAuthorization(["--bootstrap-operational-admin"], { ...env, OIC_OPERATOR_BOOTSTRAP_DECISION: "unapproved" }));
      const prior = process.env.OIC_DATABASE_URL;
      try {
        process.env.OIC_DATABASE_URL = "postgresql://oic_test:unused@127.0.0.1:5432/oic_development?schema=wrong";
        assert.throws(localDatabaseUrl, /dedicated local OIC development database/);
        process.env.OIC_DATABASE_URL = "postgresql://oic_test:unused@127.0.0.1:5432/not_oic";
        assert.throws(localDatabaseUrl, /dedicated local OIC development database/);
        process.env.OIC_DATABASE_URL = "postgresql://oic_test:unused@127.0.0.1:5432/oic_migration_test";
        assert.throws(localDatabaseUrl, /dedicated local OIC development database/);
      } finally { process.env.OIC_DATABASE_URL = prior; }
    });

    await t.test("invalid recovery proof, inactive target and partial administrator fail closed", async () => {
      await assert.rejects(service.bootstrap(input, "invalid", new FileCredentialDelivery(deliveryPath)), /Recovery proof is invalid/);
      await db!.oicServicePrincipal.update({ where: { id: recovery.id }, data: { status: "SUSPENDED" } });
      try { await assert.rejects(service.bootstrap(input, recoveryProof, new FileCredentialDelivery(deliveryPath)), /must be active/); }
      finally { await db!.oicServicePrincipal.update({ where: { id: recovery.id }, data: { status: "ACTIVE" } }); }
      const partial = await db!.oicServicePrincipal.create({ data: { applicationId: app.id, key: "oic-foundation-operator", displayName: "Partial fixture" } });
      try { await assert.rejects(service.bootstrap(input, recoveryProof, new FileCredentialDelivery(deliveryPath)), /explicit repair/); }
      finally { await db!.oicServicePrincipal.delete({ where: { id: partial.id } }); }
      assert.equal(await db!.oicOperationalAdminBootstrapRecord.count(), 0);
    });

    await t.test("existing normal administrator refuses a second bootstrap", async () => {
      const other = await db!.oicServicePrincipal.create({ data: { applicationId: app.id, key: "existing-normal-admin", displayName: "Existing fixture" } });
      await db!.oicPrincipalScopeGrant.createMany({ data: OIC_FOUNDATION_OPERATOR_SCOPES.map((scope) => ({ applicationId: app.id, principalId: other.id, scope })) });
      try { await assert.rejects(service.bootstrap(input, recoveryProof, new FileCredentialDelivery(deliveryPath)), /already exists/); }
      finally {
        await db!.oicPrincipalScopeGrant.deleteMany({ where: { principalId: other.id } });
        await db!.oicServicePrincipal.delete({ where: { id: other.id } });
      }
    });

    await t.test("filesystem and audit failures roll back all identity state", async () => {
      const failedDelivery: CredentialDelivery = {
        deliver: () => Promise.reject(new Error("injected file failure")), readBack: () => Promise.resolve(""), removeIfOwned: () => Promise.resolve()
      };
      await assert.rejects(service.bootstrap(input, recoveryProof, failedDelivery), /injected file failure/);
      const wrongRead = new FileCredentialDelivery(join(secretDir, "wrong-read.credential"));
      await assert.rejects(service.bootstrap(input, recoveryProof, { ...wrongRead, deliver: (credential) => wrongRead.deliver(credential),
        readBack: () => Promise.resolve("invalid"), removeIfOwned: () => wrongRead.removeIfOwned() }), /Durable credential verification failed/);
      const brokenAudit: FoundationAuditWriter = { write: (tx, data) => data.action === "foundation.operational-bootstrap.completed"
        ? Promise.reject(new Error("injected audit failure")) : new PrismaFoundationAuditWriter().write(tx, data) };
      await assert.rejects(new OperationalAdminBootstrapService(db!, brokenAudit).bootstrap(input, recoveryProof,
        new FileCredentialDelivery(join(secretDir, "audit-failure.credential"))), /injected audit failure/);
      await assert.rejects(readFile(join(secretDir, "wrong-read.credential"), "utf8"));
      await assert.rejects(readFile(join(secretDir, "audit-failure.credential"), "utf8"));
      assert.equal(await db!.oicServicePrincipal.count({ where: { applicationId: app.id, key: "oic-foundation-operator" } }), 0);
      assert.equal(await db!.oicOperationalAdminBootstrapRecord.count(), 0);
      assert.ok((await db!.oicMachineCredential.count({ where: { principalId: recovery.id, status: "ACTIVE" } })) > 0);
    });

    await t.test("concurrent execution commits once, replays safely and rejects a new operation", async () => {
      const [left, right] = await Promise.all([
        service.bootstrap(input, recoveryProof, new FileCredentialDelivery(deliveryPath)),
        service.bootstrap(input, recoveryProof, new FileCredentialDelivery(deliveryPath))
      ]);
      assert.equal([left, right].filter((result) => !result.replayed).length, 1);
      assert.equal(await db!.oicOperationalAdminBootstrapRecord.count(), 1);
      assert.equal(await db!.oicServicePrincipal.count({ where: { applicationId: app.id, key: "oic-foundation-operator" } }), 1);
      await assert.rejects(service.bootstrap({ ...input, operationId: `other-${randomUUID()}` }, recoveryProof,
        new FileCredentialDelivery(join(secretDir, "second.credential"))), /already complete/);
      await assert.rejects(service.bootstrap({ ...input, reason: "Different owner reason" }, recoveryProof,
        new FileCredentialDelivery(join(secretDir, "conflict.credential"))), /conflicts/);
      assert.equal(await db!.oicMachineCredential.count({ where: { principalId: recovery.id, status: "ACTIVE" } }), 0);
      const principal = await db!.oicServicePrincipal.findUniqueOrThrow({ where: { id: left.principalId }, include: { scopes: { where: { revokedAt: null } } } });
      assert.deepEqual(principal.scopes.map((grant) => grant.scope).sort(), [...OIC_FOUNDATION_OPERATOR_SCOPES].sort());
      assert.equal(principal.applicationId, app.id);
      const persisted = await db!.oicMachineCredential.findUniqueOrThrow({ where: { id: left.credentialId } });
      const secret = await readFile(deliveryPath, "utf8");
      assert.equal(await verifyCredential(secret.split(".")[2]!, persisted.verifier), true);
      assert.notEqual(secret, persisted.verifier);
      const audits = await db!.oicAuditEvent.findMany({ where: { requestId: operationId } });
      const actions = audits.map((event) => event.action);
      for (const action of ["foundation.operational-bootstrap.owner-approved", "foundation.operational-bootstrap.requested", "foundation.operational-bootstrap.authorized",
        "foundation.operational-bootstrap.recovery-used", "principal.created", "principal.scope.granted", "credential.issued",
        "foundation.operational-bootstrap.recovery-credentials-revoked", "foundation.operational-bootstrap.completed"]) assert.ok(actions.includes(action));
      assert.equal(actions.filter((action) => action === "principal.scope.granted").length, OIC_FOUNDATION_OPERATOR_SCOPES.length);
      assert.ok(!JSON.stringify(audits).includes(secret));
      assert.ok(!JSON.stringify(audits).includes(persisted.verifier));
    });

    await t.test("normal rotation and successor replacement stay application-scoped", async () => {
      const operator = await db!.oicServicePrincipal.findUniqueOrThrow({ where: { applicationId_key: { applicationId: app.id, key: "oic-foundation-operator" } } });
      const actor = { id: operator.id, applicationId: app.id, scopes: [...OIC_FOUNDATION_OPERATOR_SCOPES], tenantIds: [] };
      const old = await db!.oicMachineCredential.findFirstOrThrow({ where: { principalId: operator.id, status: "ACTIVE" } });
      const rotated = await foundation.issueCredential(actor, app.id, operator.id, null, old.id, `rotate-${randomUUID()}`, {});
      assert.ok(rotated.credential);
      assert.equal((await db!.oicMachineCredential.findUniqueOrThrow({ where: { id: old.id } })).status, "REVOKED");
      const successor = await foundation.createPrincipal(actor, app.id,
        { key: `foundation-successor-${randomUUID().slice(0, 8)}`, displayName: "Successor fixture" }, `successor-${randomUUID()}`, {});
      for (const scope of OIC_FOUNDATION_OPERATOR_SCOPES) {
        await foundation.grantScope(actor, app.id, successor.value.id, scope, `grant-${randomUUID()}`, {});
      }
      const credential = await foundation.issueCredential(actor, app.id, successor.value.id, null, null, `issue-${randomUUID()}`, {});
      assert.ok(credential.credential);
      const successorActor = { ...actor, id: successor.value.id };
      await foundation.revokeCredential(successorActor, app.id, rotated.id, {});
      await foundation.changeLifecycle(successorActor, "principal", app.id, operator.id, "SUSPENDED", {});
      assert.equal((await db!.oicServicePrincipal.findUniqueOrThrow({ where: { id: operator.id } })).status, "SUSPENDED");
      const foreign = await db!.oicApplication.create({ data: { key: `F${randomUUID().replace(/-/g, "").slice(0, 20)}`, displayName: "Foreign fixture" } });
      await assert.rejects(foundation.createPrincipal(successorActor, foreign.id,
        { key: "foreign-target", displayName: "Denied" }, `foreign-${randomUUID()}`, {}));
    });
  } finally {
    await db?.$disconnect();
    await rm(secretDir, { recursive: true, force: true });
    if (/^oic_foundation_bootstrap_[a-f0-9]{20}$/.test(schema)) await administrator.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.$disconnect();
    if (priorUrl === undefined) delete process.env.OIC_DATABASE_URL;
    else process.env.OIC_DATABASE_URL = priorUrl;
  }
});
