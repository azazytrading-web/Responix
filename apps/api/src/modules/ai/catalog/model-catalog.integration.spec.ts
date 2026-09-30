import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ModelCatalogRepository } from "./model-catalog.repository";
import { ModelCatalogService } from "./model-catalog.service";
import { ProviderRepository } from "../providers/provider.repository";
import { RoutingRepository } from "../router/routing.repository";
import { InvocationRepository } from "../invocation/invocation.repository";

const integration = process.env.MOD2_CATALOG_TEST === "1" ? describe : describe.skip;
integration("MOD-2 dedicated PostgreSQL catalog", () => {
  let prisma: PrismaClient;
  let catalog: ModelCatalogService;
  let owner: string;
  let other: string;
  let actor: string;
  let otherActor: string;
  let providerId: string;
  let customProviderId: string;
  let otherProviderId: string;
  const prefix = randomUUID();
  const create = (slug = randomUUID()) => catalog.create(owner, actor, { providerId, providerModelId: slug, displayName: `Catalog ${slug}` });
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/responix_mod2_catalog_test") throw new Error("Dedicated local MOD-2 database required");
    prisma = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
    const database = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(database[0]!.name).toBe("responix_mod2_catalog_test");
    owner = (await prisma.workspace.create({ data: { name: "Catalog owner fixture", slug: `mod2-owner-${prefix}` } })).id;
    other = (await prisma.workspace.create({ data: { name: "Catalog other fixture", slug: `mod2-other-${prefix}` } })).id;
    actor = (await prisma.user.create({ data: { workspaceId: owner, fullName: "Catalog test actor", email: `${prefix}@example.invalid`, passwordHash: "not-a-login-hash" } })).id;
    otherActor = (await prisma.user.create({ data: { workspaceId: other, fullName: "Other test actor", email: `${prefix}@example.invalid`, passwordHash: "not-a-login-hash" } })).id;
    providerId = (await prisma.aiProvider.findUniqueOrThrow({ where: { providerName: "OpenAI" }, select: { id: true } })).id;
    const providerData = { displayName: "Catalog provider", normalizedName: "catalog provider", protocolId: "openai-chat-completions-v1", baseUrl: "https://example.invalid/v1", validationModelId: "test", status: "DISABLED" as const };
    customProviderId = (await prisma.customAiProvider.create({ data: { ...providerData, workspaceId: owner } })).id;
    otherProviderId = (await prisma.customAiProvider.create({ data: { ...providerData, workspaceId: other } })).id;
    catalog = new ModelCatalogService(new ModelCatalogRepository(prisma as never));
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it("creates against global provider and remains outside production integration", async () => {
    const model = await create();
    expect(model).toMatchObject({ source: "CUSTOM", ownerWorkspaceId: owner, providerId, productionIntegration: "SPRINT_C_REQUIRED", pricing: { state: "UNKNOWN" } });
    expect(model.modelName).toBe(model.providerModelId);
  });
  it("creates against a same-workspace disabled registered provider", async () => {
    const model = await catalog.create(owner, actor, { customProviderId, providerModelId: `Custom/${prefix}`, displayName: "Custom target" });
    expect(model.customProviderId).toBe(customProviderId); expect(model).not.toHaveProperty("providerId");
  });
  it("rejects other-workspace, unknown and archived provider targets", async () => {
    const input = { providerModelId: randomUUID(), displayName: "Rejected" };
    await expect(catalog.create(owner, actor, { ...input, customProviderId: otherProviderId })).rejects.toThrow("Provider target was not found");
    await expect(catalog.create(owner, actor, { ...input, providerId: randomUUID() })).rejects.toThrow("Provider target was not found");
    const archived = await prisma.customAiProvider.create({ data: { workspaceId: owner, normalizedName: randomUUID(), displayName: "Archived", protocolId: "openai-chat-completions-v1", baseUrl: "https://example.invalid", validationModelId: "x", status: "ARCHIVED" } });
    await expect(catalog.create(owner, actor, { ...input, customProviderId: archived.id })).rejects.toThrow("Provider target was not found");
  });
  it("preserves case-sensitive IDs and rejects exact duplicates", async () => {
    const slug = `Exact/${prefix}`;
    const first = await create(slug);
    const second = await create(slug.toLowerCase());
    expect(first.id).not.toBe(second.id);
    await expect(create(slug)).rejects.toThrow("Model identity already exists");
  });
  it("allows the same identity in separate workspace scopes", async () => {
    const slug = `shared-${prefix}`;
    const first = await create(slug);
    const second = await catalog.create(other, otherActor, { providerId, providerModelId: slug, displayName: "Other" });
    expect(first.id).not.toBe(second.id);
  });
  it("isolates get/update/archive/restore and workspace pricing mutations", async () => {
    const model = await create();
    await expect(catalog.get(other, model.id)).rejects.toThrow("Model was not found");
    await expect(catalog.update(other, otherActor, model.id, { displayName: "Hijack" })).rejects.toThrow("Model was not found");
    await expect(catalog.transition(other, otherActor, model.id, "archive")).rejects.toThrow("Model was not found");
    await expect(catalog.transition(other, otherActor, model.id, "restore")).rejects.toThrow("Model was not found");
    await expect(catalog.update(other, otherActor, model.id, { pricing: { state: "KNOWN", source: "WORKSPACE_DECLARED", inputRate: "0", outputRate: "0", currency: "USD", unit: "PER_MILLION_TOKENS", effectiveFrom: "2026-01-01T00:00:00Z" } })).rejects.toThrow("Model was not found");
  });
  it("updates mutable metadata, archives, reserves identity and restores disabled", async () => {
    const model = await create();
    const updated = await catalog.update(owner, actor, model.id, { displayName: "Renamed", family: "family", version: "v2", contextWindow: 4096, maxOutputTokens: 100, categories: ["CHAT"], status: "DEPRECATED" });
    expect(updated).toMatchObject({ id: model.id, displayName: "Renamed", status: "DEPRECATED" });
    const archived = await catalog.transition(owner, actor, model.id, "archive");
    expect(archived.status).toBe("ARCHIVED");
    expect((await catalog.list(owner, { source: "CUSTOM" })).items.map(item => item.id)).not.toContain(model.id);
    expect((await catalog.list(owner, { status: "ARCHIVED", source: "CUSTOM" })).items.map(item => item.id)).toContain(model.id);
    await expect(create(model.providerModelId)).rejects.toThrow("Model identity already exists");
    await expect(catalog.update(owner, actor, model.id, { displayName: "No" })).rejects.toThrow("Restore");
    expect((await catalog.transition(owner, actor, model.id, "restore")).status).toBe("DISABLED");
  });
  it.each(["ACTIVE", "PUBLISHED"] as const)("blocks archive with %s Agent references without mutation", async status => {
    const model = await create();
    const agent = await prisma.aiAgent.create({ data: { workspaceId: owner, name: `Reference guard ${status}`, prompt: "test", providerId, modelId: model.id, maxTokens: 10, status } });
    await expect(catalog.transition(owner, actor, model.id, "archive")).rejects.toThrow("MODEL_HAS_ACTIVE_AGENT_REFERENCES");
    expect((await prisma.aiAgent.findUniqueOrThrow({ where: { id: agent.id } })).status).toBe(status);
    expect((await catalog.get(owner, model.id)).status).toBe("ACTIVE");
  });
  it("keeps builtin catalog visible and returns bounded pagination/source filters", async () => {
    const page = await catalog.list(owner, { page: 1, limit: 2, source: "BUILT_IN" });
    expect(page.items).toHaveLength(2); expect(page.total).toBeGreaterThanOrEqual(6);
    const mine = await catalog.list(owner, { source: "CUSTOM", providerId, limit: 100 });
    expect(mine.items.every(item => item.ownerWorkspaceId === owner && item.providerId === providerId)).toBe(true);
  });
  it("resolves capability restrictions and SQL filters consistently", async () => {
    const model = await create();
    await prisma.aiModelCapability.create({ data: { modelId: model.id, key: "TOOLS", source: "PLATFORM_CURATED", state: "SUPPORTED" } });
    expect((await catalog.get(owner, model.id)).capabilities.find(cap => cap.key === "TOOLS")!.catalogState).toBe("SUPPORTED");
    expect((await catalog.list(owner, { capability: "TOOLS", source: "CUSTOM" })).items.map(item => item.id)).toContain(model.id);
    await catalog.update(owner, actor, model.id, { capabilities: [{ key: "TOOLS", state: "UNSUPPORTED" }, { key: "VISION_INPUT", state: "SUPPORTED" }] });
    const value = await catalog.get(owner, model.id);
    expect(value.capabilities.find(cap => cap.key === "TOOLS")!.catalogState).toBe("UNSUPPORTED");
    expect(value.capabilities.find(cap => cap.key === "VISION_INPUT")!.catalogState).toBe("UNKNOWN");
    expect((await catalog.list(owner, { capability: "TOOLS", source: "CUSTOM" })).items.map(item => item.id)).not.toContain(model.id);
  });
  it("stores known price provenance, zero declarations, unknown and effective history", async () => {
    const model = await create();
    const pricing = { state: "KNOWN" as const, source: "WORKSPACE_DECLARED" as const, inputRate: "1.25", outputRate: "2.5", currency: "USD", unit: "PER_MILLION_TOKENS" as const, effectiveFrom: "2026-01-01T00:00:00Z" };
    expect((await catalog.update(owner, actor, model.id, { pricing })).pricing).toMatchObject({ state: "KNOWN", inputRate: "1.250000", source: "WORKSPACE_DECLARED" });
    expect((await catalog.update(owner, actor, model.id, { pricing: { ...pricing, inputRate: "0", outputRate: "0", effectiveFrom: "2026-01-02T00:00:00Z" } })).pricing).toMatchObject({ state: "KNOWN", inputRate: "0.000000" });
    expect((await catalog.update(owner, actor, model.id, { pricing: { ...pricing, state: "UNKNOWN", inputRate: undefined, outputRate: undefined, effectiveFrom: "2026-01-03T00:00:00Z" } })).pricing).toMatchObject({ state: "UNKNOWN" });
    expect((await catalog.get(owner, model.id)).pricing).not.toHaveProperty("inputRate");
    expect(await prisma.aiModelPrice.count({ where: { modelId: model.id } })).toBe(3);
  });
  it("audits creation/metadata/lifecycle/evidence without endpoint or secret material", async () => {
    const model = await create();
    await catalog.update(owner, actor, model.id, { capabilities: [{ key: "TOOLS", state: "UNKNOWN" }], pricing: { state: "UNKNOWN", source: "WORKSPACE_DECLARED", currency: "USD", unit: "PER_MILLION_TOKENS", effectiveFrom: "2099-01-01T00:00:00Z" } });
    await catalog.transition(owner, actor, model.id, "archive"); await catalog.transition(owner, actor, model.id, "restore");
    const audits = await prisma.auditLog.findMany({ where: { workspaceId: owner, entityId: model.id } });
    expect(audits.map(event => event.action)).toEqual(expect.arrayContaining(["ai.custom-model.created", "ai.custom-model.updated", "ai.custom-model.capabilities.changed", "ai.custom-model.pricing.changed", "ai.custom-model.archived", "ai.custom-model.restored", "ai.custom-model.lifecycle.changed"]));
    expect(JSON.stringify(audits)).not.toMatch(/baseUrl|encryptedSecret|passwordHash|apiKey|example.invalid/);
    expect(audits.find(event => event.action === "ai.custom-model.pricing.changed")!.newValues).toMatchObject({ effectiveFrom: "2099-01-01T00:00:00Z" });
  });
  it("rolls back mutation when audit actor FK fails", async () => {
    const slug = `rollback-${prefix}`;
    await expect(catalog.create(owner, randomUUID(), { providerId, providerModelId: slug, displayName: "Rollback" })).rejects.toThrow();
    expect(await prisma.aiModel.count({ where: { providerModelId: slug } })).toBe(0);
  });
  it("enforces target XOR and source ownership in PostgreSQL", async () => {
    const data = { displayName: "Invalid", modelName: randomUUID(), providerModelId: "" };
    data.providerModelId = data.modelName;
    await expect(prisma.aiModel.create({ data: { ...data } })).rejects.toThrow();
    await expect(prisma.aiModel.create({ data: { ...data, providerId, customProviderId, source: "CUSTOM", ownerWorkspaceId: owner } })).rejects.toThrow();
    await expect(prisma.aiModel.create({ data: { ...data, providerId, source: "CUSTOM" } })).rejects.toThrow();
    await expect(prisma.aiModel.create({ data: { ...data, providerId, source: "BUILT_IN", ownerWorkspaceId: owner } })).rejects.toThrow();
  });
  it("enforces composite Custom Provider workspace FK", async () => {
    await expect(prisma.aiModel.create({ data: { displayName: "Invalid workspace", modelName: prefix, providerModelId: prefix, source: "CUSTOM", customProviderId: otherProviderId, ownerWorkspaceId: owner } })).rejects.toThrow();
  });
  it("enforces all three scoped identity unique indexes", async () => {
    const slug = `identity-${prefix}`;
    await prisma.aiModel.create({ data: { providerId, modelName: slug, providerModelId: slug, displayName: "Global identity", source: "BUILT_IN" } });
    await expect(prisma.aiModel.create({ data: { providerId, modelName: slug, providerModelId: slug, displayName: "Duplicate global" } })).rejects.toThrow();
    await create(slug); await expect(create(slug)).rejects.toThrow();
    const input = { customProviderId, providerModelId: slug, displayName: "Custom target identity" };
    await catalog.create(owner, actor, input); await expect(catalog.create(owner, actor, input)).rejects.toThrow();
  });
  it("enforces immutable identity and no hard delete in PostgreSQL", async () => {
    const model = await create();
    for (const data of [{ providerModelId: "changed", modelName: "changed" }, { ownerWorkspaceId: other }, { source: "PROVIDER_SYNCED" as const }]) {
      await expect(prisma.aiModel.update({ where: { id: model.id }, data })).rejects.toThrow();
    }
    await expect(prisma.aiModel.delete({ where: { id: model.id } })).rejects.toThrow();
  });
  it("enforces price consistency, dates and currency in PostgreSQL", async () => {
    const model = await create();
    const data = { modelId: model.id, source: "WORKSPACE_DECLARED" as const, effectiveFrom: new Date("2026-01-01") };
    for (const extra of [{ state: "UNKNOWN" as const, inputRate: 0 }, { state: "KNOWN" as const }, { currency: "usd" }, { effectiveTo: new Date("2025-01-01") }]) {
      await expect(prisma.aiModelPrice.create({ data: { ...data, ...extra } })).rejects.toThrow();
    }
  });
  it("keeps workspace models out of discovery, routing and pricing lookup", async () => {
    const model = await create();
    const discovery = await new ProviderRepository(prisma as never).discover(owner);
    expect(discovery.flatMap(p => p.models.map(m => m.modelId))).not.toContain(model.id);
    const candidates = await new RoutingRepository(prisma as never).findCandidates(owner);
    expect(candidates.map(c => c.modelId)).not.toContain(model.id);
    expect(await new InvocationRepository(prisma as never).findModelPricing(owner, providerId, model.id)).toBeNull();
  });
  it("registers ai.models.write in the permission table", async () => {
    expect(await prisma.permission.findUnique({ where: { code: "ai.models.write" } })).not.toBeNull();
  });
});
