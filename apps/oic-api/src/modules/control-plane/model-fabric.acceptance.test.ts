import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
import type { Prisma } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { ProviderControlService } from "./provider-control.service";
import { ModelFabricService } from "./model-fabric.service";
import { DatabaseOicModelResolver } from "../runtime-plane/model-resolver";

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
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(database)) throw new Error("Model Fabric acceptance requires the dedicated local OIC migration-test database");
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

type ModelGraph = { appId: string; connectionId: string; upstreamId: string; revisionId: string; editionId: string; publicId: string; familyId: string; variantId: string; bindingId: string };
async function createGraph(tx: Prisma.TransactionClient, suffix: string): Promise<ModelGraph> {
  const app = await tx.oicApplication.create({ data: { key: `MF${suffix}`, displayName: "Model Fabric acceptance" } });
  const definition = await tx.oicProviderDefinition.create({ data: { key: `fixture-${suffix.toLowerCase()}`, displayName: "Test-only transactional provider", authStrategy: "NONE", transportProfiles: ["openai-chat-completions-v1"] } });
  const validatedAt = new Date();
  const connection = await tx.oicProviderConnection.create({ data: {
    providerDefinitionId: definition.id, scope: "APPLICATION", applicationId: app.id,
    displayName: "Transactional fixture", endpointUrl: "https://fixture.invalid/v1", transportProfile: "openai-chat-completions-v1",
    status: "ACTIVE", healthStatus: "HEALTHY", lastValidatedAt: validatedAt
  } });
  const upstream = await tx.oicUpstreamModel.create({ data: {
    providerDefinitionId: definition.id, connectionId: connection.id, upstreamModelId: "Vendor.Model-ExactCase",
    displayName: "Fixture upstream", source: "MANUAL"
  } });
  await tx.oicUpstreamCapabilityEvidence.createMany({ data: [
    { upstreamModelId: upstream.id, capability: "text.generate", status: "UNKNOWN", source: "PROVIDER_DECLARED", observedAt: new Date("2025-01-01T00:00:00Z") },
    { upstreamModelId: upstream.id, capability: "text.generate", status: "SUPPORTED", source: "PLATFORM_CURATED", sourceRef: "acceptance-source", observedAt: new Date("2025-01-02T00:00:00Z") }
  ] });
  await tx.oicUpstreamPricingEvidence.createMany({ data: [
    { upstreamModelId: upstream.id, status: "UNKNOWN", observedAt: new Date("2025-01-01T00:00:00Z") },
    { upstreamModelId: upstream.id, status: "KNOWN", inputRate: "0", currency: "USD", sourceRef: "verified-free-fixture", effectiveAt: new Date("2025-01-02T00:00:00Z"), observedAt: new Date("2025-01-02T00:00:00Z") }
  ] });
  const family = await tx.oicModelFamily.create({ data: { familyKey: `family-${suffix.toLowerCase()}`, displayName: "Fixture family" } });
  const publicId = `oi-fixture-${suffix.toLowerCase()}`;
  const edition = await tx.oicModelEdition.create({ data: { familyId: family.id, publicId, editionKey: "default", displayName: "Fixture Oi model", lifecycle: "PRODUCTION" } });
  const revision = await tx.oicModelRevision.create({ data: { editionId: edition.id, revision: 1, instructions: "immutable fixture revision" } });
  const variant = await tx.oicModelVariant.create({ data: {
    revisionId: revision.id, variantKey: "primary", kind: "EXTERNAL_PROVIDER", providerDefinitionId: definition.id,
    upstreamModelId: upstream.id, transportProfile: "openai-chat-completions-v1"
  } });
  const binding = await tx.oicRuntimeBinding.create({ data: {
    editionId: edition.id, variantId: variant.id, connectionId: connection.id,
    scope: "APPLICATION", applicationId: app.id, status: "ACTIVE", environment: "production"
  } });
  await tx.oicApplicationModelVisibility.create({ data: { applicationId: app.id, editionId: edition.id } });
  return { appId: app.id, connectionId: connection.id, upstreamId: upstream.id, revisionId: revision.id, editionId: edition.id, publicId, familyId: family.id, variantId: variant.id, bindingId: binding.id };
}

const hasDedicatedDatabase = prepareDedicatedDatabase();
void test("OIC Model Fabric resolver and catalog history acceptance rolls back all fixture rows", { skip: !hasDedicatedDatabase }, async () => {
  const db = new OicDatabaseService();
  await db.$connect();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16).toLowerCase();
  const rollback = new Error("rollback model fabric acceptance fixtures");
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const graph = await createGraph(tx, suffix);
      const context = { requestId: "r", traceId: "t", applicationId: graph.appId, principalId: "test-principal", tenantId: null };
      const resolver = new DatabaseOicModelResolver(tx as never);
      const resolved = await resolver.resolve(graph.publicId as `oi-${string}`, context);
      assert.equal(resolved?.id, graph.publicId);
      assert.equal((resolved as { bindingId?: string } | null)?.bindingId, graph.bindingId);
      assert.equal(JSON.stringify(resolved).includes("Vendor.Model-ExactCase"), false);
      assert.equal(JSON.stringify(resolved).includes(graph.connectionId), false);
      assert.deepEqual(await resolver.listVisible(context), [{ id: graph.publicId, displayName: "Fixture Oi model", capabilities: ["text.generate", "text.stream"] }]);
      assert.equal(await resolver.resolve(graph.publicId as `oi-${string}`, { ...context, applicationId: randomUUID() }), null);

      const actor: AuthenticatedPrincipal = { id: randomUUID(), applicationId: graph.appId, scopes: ["oic:catalog:read", "oic:catalog:manage"], tenantIds: [] };
      const serviceDb = new Proxy(tx, { get(target, property) {
        if (property === "$transaction") return (callback: (transaction: Prisma.TransactionClient) => unknown) => callback(tx);
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === "function" ? (...args: unknown[]): unknown => Reflect.apply(value, target, args) as unknown : value;
      } });
      const providerService = new ProviderControlService(serviceDb as never);
      const catalogService = new ModelFabricService(serviceDb as never, providerService);
      const catalog = await catalogService.listUpstreamModels(actor, graph.connectionId);
      assert.equal(catalog[0]?.upstreamModelId, "Vendor.Model-ExactCase");
      assert.equal(catalog[0]?.capabilities[0]?.status, "SUPPORTED");
      assert.equal(catalog[0]?.capabilities[0]?.source, "PLATFORM_CURATED");
      assert.equal(catalog[0]?.pricing.status, "KNOWN");
      assert.equal(String(catalog[0]?.pricing.inputRate), "0");
      assert.equal(await tx.oicUpstreamCapabilityEvidence.count({ where: { upstreamModelId: graph.upstreamId } }), 2);
      assert.equal(await tx.oicUpstreamPricingEvidence.count({ where: { upstreamModelId: graph.upstreamId } }), 2);

      const runsBeforePreview = await tx.oicProviderSyncRun.count({ where: { connectionId: graph.connectionId } });
      const preview = await catalogService.previewManualCatalog(actor, graph.connectionId, [
        {
          upstreamModelId: "Vendor.Model-ExactCase", displayName: "Updated fixture",
          capabilities: [
            { capability: "text.generate", status: "SUPPORTED", sourceRef: "verified-source" },
            { capability: "vision.image", status: "UNKNOWN" },
            { capability: "audio.output", status: "UNSUPPORTED" }
          ],
          pricing: { status: "KNOWN", inputRate: 0, currency: "USD", effectiveAt: "2025-01-03T00:00:00.000Z", sourceRef: "verified-zero" }
        },
        { upstreamModelId: "New.Model-ExactCase", displayName: "New fixture", pricing: { status: "UNKNOWN" } }
      ]);
      assert.equal(preview.createdCount, 1);
      assert.equal(preview.updatedCount, 1);
      assert.equal(preview.supportedCapabilityCount, 1);
      assert.equal(preview.unsupportedCapabilityCount, 1);
      assert.equal(preview.unknownCapabilityCount, 1);
      assert.equal(preview.knownZeroPricingCount, 1);
      assert.equal(preview.unknownPricingCount, 1);
      assert.equal(await tx.oicProviderSyncRun.count({ where: { connectionId: graph.connectionId } }), runsBeforePreview);
      assert.equal(await tx.oicUpstreamModel.count({ where: { connectionId: graph.connectionId } }), 1);

      const unknownSync = await catalogService.syncManualCatalog(actor, graph.connectionId, [{
        upstreamModelId: "Vendor.Model-ExactCase", displayName: "Updated fixture", capabilities: [{ capability: "text.generate", status: "UNKNOWN", sourceRef: "unverified" }],
        pricing: { status: "UNKNOWN", sourceRef: "awaiting-source" }
      }], "catalog-sync-unknown", "trace-catalog");
      assert.deepEqual(unknownSync, { runId: unknownSync.runId, status: "SUCCEEDED", discoveredCount: 1, createdCount: 0, updatedCount: 1 });
      const unknownCatalog = await catalogService.listUpstreamModels(actor, graph.connectionId);
      assert.equal(unknownCatalog[0]?.displayName, "Updated fixture");
      assert.equal(unknownCatalog[0]?.capabilities.find((item) => item.capability === "text.generate")?.status, "UNKNOWN");
      assert.equal(unknownCatalog[0]?.pricing.status, "UNKNOWN");
      await assert.rejects(catalogService.syncManualCatalog(actor, graph.connectionId, [{
        upstreamModelId: "Vendor.Model-ExactCase", displayName: "Invalid pricing", pricing: { status: "UNKNOWN", inputRate: 0 }
      }]));
      const knownZeroSync = await catalogService.syncManualCatalog(actor, graph.connectionId, [{
        upstreamModelId: "Vendor.Model-ExactCase", displayName: "Updated fixture", capabilities: [{ capability: "text.generate", status: "SUPPORTED", sourceRef: "curated-again" }],
        pricing: { status: "KNOWN", inputRate: 0, currency: "USD", effectiveAt: "2025-01-03T00:00:00.000Z", sourceRef: "free-fixture-v2" }
      }], "catalog-sync-known", "trace-catalog");
      assert.equal(knownZeroSync.updatedCount, 1);
      const knownCatalog = await catalogService.listUpstreamModels(actor, graph.connectionId);
      assert.equal(knownCatalog[0]?.capabilities.find((item) => item.capability === "text.generate")?.status, "SUPPORTED");
      assert.equal(String(knownCatalog[0]?.pricing.inputRate), "0");
      assert.equal(knownCatalog[0]?.pricing.effectiveAt?.toISOString(), "2025-01-03T00:00:00.000Z");
      assert.equal(await tx.oicUpstreamCapabilityEvidence.count({ where: { upstreamModelId: graph.upstreamId } }), 4);
      assert.equal(await tx.oicUpstreamPricingEvidence.count({ where: { upstreamModelId: graph.upstreamId } }), 4);
      assert.equal(await tx.oicProviderSyncRun.count({ where: { connectionId: graph.connectionId, status: "SUCCEEDED" } }), 2);
      assert.equal(await tx.oicAuditEvent.count({ where: { action: "provider.catalog.manual-sync", targetId: graph.connectionId } }), 2);

      throw rollback;
    }, { timeout: 15_000 }), (error: unknown) => error === rollback);
  } finally { await db.$disconnect(); }
});

void test("OIC database trigger rejects mutation of immutable model revisions", { skip: !hasDedicatedDatabase }, async () => {
  const db = new OicDatabaseService();
  await db.$connect();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16).toLowerCase();
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const graph = await createGraph(tx, suffix);
      await tx.oicModelRevision.update({ where: { id: graph.revisionId }, data: { instructions: "tampered" } });
    }));
  } finally { await db.$disconnect(); }
});

void test("OIC database trigger rejects bindings outside a connection owner scope", { skip: !hasDedicatedDatabase }, async () => {
  const db = new OicDatabaseService();
  await db.$connect();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16).toLowerCase();
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const graph = await createGraph(tx, suffix);
      const foreignApp = await tx.oicApplication.create({ data: { key: `FX${suffix}`, displayName: "Foreign fixture app" } });
      await tx.oicRuntimeBinding.create({ data: {
        editionId: graph.editionId, variantId: graph.variantId, connectionId: graph.connectionId,
        scope: "APPLICATION", applicationId: foreignApp.id, status: "DRAFT", environment: "production"
      } });
    }));
  } finally { await db.$disconnect(); }
});
