import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { decryptProviderCredential } from "./provider-credential.crypto";
import { ProviderControlService } from "./provider-control.service";

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
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(database)) throw new Error("Provider acceptance requires the dedicated OIC migration-test database");
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

void test("OIC Provider Fabric persistence and credential boundary acceptance", { skip: !prepareDedicatedDatabase() }, async () => {
  const previousKey = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const db = new OicDatabaseService();
  const service = new ProviderControlService(db);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
  let appId: string | undefined;
  const tenantIds: string[] = [];
  const connectionIds: string[] = [];
  try {
    await db.$connect();
    const definition = await db.oicProviderDefinition.findUniqueOrThrow({ where: { key: "openai" } });
    const app = await db.oicApplication.create({ data: { key: `PV${suffix}`, displayName: "Provider acceptance app" } });
    appId = app.id;
    const tenant = await db.oicTenant.create({ data: { applicationId: app.id, key: `t${suffix}`, displayName: "Provider acceptance tenant" } });
    const foreignTenant = await db.oicTenant.create({ data: { applicationId: app.id, key: `f${suffix}`, displayName: "Other provider acceptance tenant" } });
    tenantIds.push(tenant.id, foreignTenant.id);
    const principalId = randomUUID();
    const actor: AuthenticatedPrincipal = { id: principalId, applicationId: app.id, scopes: ["oic:providers:read", "oic:connections:manage"], tenantIds: [tenant.id] };
    const connection = await db.oicProviderConnection.create({ data: {
      providerDefinitionId: definition.id, scope: "APPLICATION", applicationId: app.id,
      displayName: "Acceptance connection", endpointUrl: "https://provider.example/v1", transportProfile: "openai-chat-completions-v1"
    } });
    connectionIds.push(connection.id);

    const tenantConnection = await db.oicProviderConnection.create({ data: {
      providerDefinitionId: definition.id, scope: "TENANT", applicationId: app.id, tenantId: tenant.id,
      displayName: "Tenant connection", endpointUrl: "https://provider.example/v1", transportProfile: "openai-chat-completions-v1"
    } });
    const foreignTenantConnection = await db.oicProviderConnection.create({ data: {
      providerDefinitionId: definition.id, scope: "TENANT", applicationId: app.id, tenantId: foreignTenant.id,
      displayName: "Other tenant connection", endpointUrl: "https://provider.example/v1", transportProfile: "openai-chat-completions-v1"
    } });
    const platformConnection = await db.oicProviderConnection.create({ data: {
      providerDefinitionId: definition.id, scope: "PLATFORM", applicationId: null, tenantId: null,
      displayName: "Platform connection", endpointUrl: "https://provider.example/v1", transportProfile: "openai-chat-completions-v1"
    } });
    connectionIds.push(tenantConnection.id, foreignTenantConnection.id, platformConnection.id);
    assert.equal((await service.getConnection(actor, tenantConnection.id)).tenantId, tenant.id);
    await assert.rejects(service.getConnection(actor, foreignTenantConnection.id));
    await assert.rejects(service.getConnection(actor, platformConnection.id));
    const visibleConnectionIds = (await service.listConnections(actor)).map((item) => item.id);
    assert.ok(visibleConnectionIds.includes(connection.id));
    assert.ok(visibleConnectionIds.includes(tenantConnection.id));
    assert.equal(visibleConnectionIds.includes(foreignTenantConnection.id), false);
    assert.equal(visibleConnectionIds.includes(platformConnection.id), false);

    const secret = `temporary-${randomBytes(24).toString("hex")}`;
    const first = await service.setCredential(actor, connection.id, secret);
    assert.equal("credential" in first, false);
    const stored = await db.oicProviderCredential.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(stored.ciphertext.includes(secret), false);
    assert.equal(decryptProviderCredential(stored, connection.id, stored.version), secret);

    const rotated = await service.setCredential(actor, connection.id, `${secret}-rotated`);
    assert.equal(rotated.version, first.version + 1);
    assert.equal(await db.oicProviderCredential.count({ where: { connectionId: connection.id, status: "ACTIVE" } }), 1);
    const visible = await service.getConnection(actor, connection.id);
    assert.equal(JSON.stringify(visible).includes(secret), false);
    assert.equal(JSON.stringify(visible).includes(stored.ciphertext), false);
    await assert.rejects(service.getConnection({ ...actor, applicationId: randomUUID(), tenantIds: [] }, connection.id));

    await service.revokeCredential(actor, connection.id, rotated.id);
    assert.equal(await db.oicProviderCredential.count({ where: { connectionId: connection.id, status: "ACTIVE" } }), 0);
    await assert.rejects(db.oicProviderConnection.create({ data: {
      providerDefinitionId: definition.id, scope: "PLATFORM", applicationId: app.id,
      displayName: "Invalid ownership", endpointUrl: "https://provider.example/v1", transportProfile: "openai-chat-completions-v1"
    } }));
  } finally {
    if (connectionIds.length) {
      await db.oicProviderCredential.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await db.oicProviderHealthCheck.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await db.oicProviderConnection.deleteMany({ where: { id: { in: connectionIds } } });
    }
    if (tenantIds.length) await db.oicTenant.deleteMany({ where: { id: { in: tenantIds } } });
    if (appId) await db.oicApplication.delete({ where: { id: appId } });
    await db.$disconnect();
    if (previousKey === undefined) delete process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = previousKey;
  }
});
