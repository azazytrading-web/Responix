import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { ProviderControlService } from "./provider-control.service";
import { hasOicConsoleManage } from "../identity/foundation-policy";
import { registeredProvider } from "./provider-registry";

export const OIC_UPSTREAM_CAPABILITIES = ["text.generate", "text.stream", "json.mode", "tool.use", "vision.image", "audio.input", "audio.output", "embedding.create", "reasoning"] as const;
export type OicUpstreamCapability = typeof OIC_UPSTREAM_CAPABILITIES[number];
export type CapabilityEvidenceInput = { capability: OicUpstreamCapability; status: "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN"; sourceRef?: string };
export type PricingEvidenceInput = {
  status: "KNOWN" | "UNKNOWN";
  inputRate?: number | null;
  outputRate?: number | null;
  cachedInputRate?: number | null;
  currency?: "USD" | null;
  unit?: "USD_PER_MILLION_TOKENS";
  sourceRef?: string;
  effectiveAt?: string | null;
};
export type ManualModelInput = {
  upstreamModelId: string;
  displayName: string;
  family?: string;
  contextLimit?: number;
  outputLimit?: number;
  capabilities?: CapabilityEvidenceInput[];
  pricing?: PricingEvidenceInput;
};

type ModelLifecycle = "DRAFT" | "EXPERIMENTAL" | "CANDIDATE" | "CANARY" | "PRODUCTION" | "MAINTENANCE" | "DEPRECATED" | "RETIRED";
const EDITION_TRANSITIONS: Record<ModelLifecycle, readonly ModelLifecycle[]> = {
  DRAFT: ["EXPERIMENTAL", "CANDIDATE", "RETIRED"],
  EXPERIMENTAL: ["CANDIDATE", "RETIRED"],
  CANDIDATE: ["CANARY", "PRODUCTION", "RETIRED"],
  CANARY: ["PRODUCTION", "CANDIDATE", "MAINTENANCE", "RETIRED"],
  PRODUCTION: ["CANARY", "MAINTENANCE", "DEPRECATED"],
  MAINTENANCE: ["PRODUCTION", "DEPRECATED", "RETIRED"],
  DEPRECATED: ["RETIRED"],
  RETIRED: []
};
type CatalogLifecycle = "ACTIVE" | "DISABLED" | "DEPRECATED" | "ARCHIVED";
const CATALOG_TRANSITIONS: Record<CatalogLifecycle, readonly CatalogLifecycle[]> = {
  ACTIVE: ["DISABLED", "DEPRECATED", "ARCHIVED"],
  DISABLED: ["ACTIVE", "DEPRECATED", "ARCHIVED"],
  DEPRECATED: ["ARCHIVED"],
  ARCHIVED: []
};
export function canTransitionUpstreamCatalogLifecycle(current: CatalogLifecycle, next: CatalogLifecycle): boolean {
  return CATALOG_TRANSITIONS[current].includes(next);
}
const hasControlCharacters = (value: string) => [...value].some((character) => {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
});

@Injectable()
export class ModelFabricService {
  constructor(private readonly db: OicDatabaseService, private readonly providers: ProviderControlService) {}

  private requireScope(actor: AuthenticatedPrincipal, scope: string): void {
    if (!actor.scopes.includes("oic:foundation:admin") && !actor.scopes.includes(scope)) throw new ForbiddenException();
  }

  private async authorizedConnection(actor: AuthenticatedPrincipal, connectionId: string, write: boolean) {
    return this.providers.requireConnectionAccess(actor, connectionId, write ? "oic:catalog:manage" : "oic:catalog:read");
  }

  private validateManualCatalog(models: ManualModelInput[]): void {
    if (models.length > 500) throw new ConflictException("Catalog sync is too large");
    const seen = new Set<string>();
    for (const model of models) {
      if (!model.upstreamModelId.trim() || hasControlCharacters(model.upstreamModelId) || model.upstreamModelId.length > 256) throw new ConflictException("Upstream model identity is invalid");
      if (seen.has(model.upstreamModelId)) throw new ConflictException("Catalog sync contains duplicate upstream model identities");
      seen.add(model.upstreamModelId);
      if ((model.contextLimit !== undefined && model.contextLimit <= 0) || (model.outputLimit !== undefined && model.outputLimit <= 0)) throw new ConflictException("Model limits must be positive");
      if (model.pricing) this.validatePricing(model.pricing);
    }
  }

  async previewManualCatalog(actor: AuthenticatedPrincipal, connectionId: string, models: ManualModelInput[]) {
    const connection = await this.authorizedConnection(actor, connectionId, true);
    if (connection.status === "ARCHIVED") throw new ConflictException("Archived provider connections cannot update catalog entries");
    this.validateManualCatalog(models);
    const existing = models.length
      ? await this.db.oicUpstreamModel.findMany({
          where: { connectionId, upstreamModelId: { in: models.map((model) => model.upstreamModelId) } },
          select: { upstreamModelId: true }
        })
      : [];
    const existingIds = new Set(existing.map((model) => model.upstreamModelId));
    const preview = models.map((model) => ({
      upstreamModelId: model.upstreamModelId,
      displayName: model.displayName,
      operation: existingIds.has(model.upstreamModelId) ? "UPDATE" : "CREATE",
      capabilities: model.capabilities?.map(({ capability, status, sourceRef }) => ({ capability, status, sourceRef })) ?? [],
      pricing: model.pricing
        ? {
            status: model.pricing.status,
            inputRate: model.pricing.status === "KNOWN" ? model.pricing.inputRate ?? null : null,
            outputRate: model.pricing.status === "KNOWN" ? model.pricing.outputRate ?? null : null,
            cachedInputRate: model.pricing.status === "KNOWN" ? model.pricing.cachedInputRate ?? null : null,
            currency: model.pricing.status === "KNOWN" ? model.pricing.currency ?? "USD" : null,
            sourceRef: model.pricing.sourceRef ?? null,
            effectiveAt: model.pricing.status === "KNOWN" ? model.pricing.effectiveAt ?? null : null
          }
        : null
    }));
    const allCapabilities = preview.flatMap((model) => model.capabilities);
    const knownPricing = preview.filter((model) => model.pricing?.status === "KNOWN");
    return {
      connectionId,
      total: preview.length,
      createdCount: preview.filter((model) => model.operation === "CREATE").length,
      updatedCount: preview.filter((model) => model.operation === "UPDATE").length,
      supportedCapabilityCount: allCapabilities.filter((item) => item.status === "SUPPORTED").length,
      unsupportedCapabilityCount: allCapabilities.filter((item) => item.status === "UNSUPPORTED").length,
      unknownCapabilityCount: allCapabilities.filter((item) => item.status === "UNKNOWN").length,
      knownZeroPricingCount: knownPricing.filter((model) => {
        const rates = [model.pricing?.inputRate, model.pricing?.outputRate, model.pricing?.cachedInputRate];
        return rates.some((rate) => rate === 0) && rates.every((rate) => rate === null || rate === 0);
      }).length,
      unknownPricingCount: preview.filter((model) => model.pricing?.status === "UNKNOWN").length,
      models: preview
    };
  }

  async syncManualCatalog(actor: AuthenticatedPrincipal, connectionId: string, models: ManualModelInput[], requestId?: string, traceId?: string) {
    const connection = await this.authorizedConnection(actor, connectionId, true);
    if (connection.status === "ARCHIVED") throw new ConflictException("Archived provider connections cannot update catalog entries");
    this.validateManualCatalog(models);
    const result = await this.db.$transaction(async (tx) => {
      const run = await tx.oicProviderSyncRun.create({ data: { providerDefinitionId: connection.providerDefinitionId, connectionId, status: "RUNNING" } });
      let createdCount = 0;
      let updatedCount = 0;
      for (const model of models) {
        const existing = await tx.oicUpstreamModel.findUnique({ where: { connectionId_upstreamModelId: { connectionId, upstreamModelId: model.upstreamModelId } }, select: { id: true } });
        const values = {
          providerDefinitionId: connection.providerDefinitionId,
          connectionId,
          upstreamModelId: model.upstreamModelId,
          displayName: model.displayName,
          family: model.family ?? null,
          source: "MANUAL" as const,
          contextLimit: model.contextLimit ?? null,
          outputLimit: model.outputLimit ?? null
        };
        const upstream = existing
          ? await tx.oicUpstreamModel.update({ where: { id: existing.id }, data: values })
          : await tx.oicUpstreamModel.create({ data: values });
        if (existing) updatedCount += 1; else createdCount += 1;
        for (const evidence of model.capabilities ?? []) {
          await tx.oicUpstreamCapabilityEvidence.create({ data: {
            upstreamModelId: upstream.id, capability: evidence.capability, status: evidence.status,
            source: "PLATFORM_CURATED", sourceRef: evidence.sourceRef ?? null
          } });
        }
        if (model.pricing) {
          const pricing = model.pricing;
          await tx.oicUpstreamPricingEvidence.create({ data: {
            upstreamModelId: upstream.id, status: pricing.status,
            inputRate: pricing.inputRate == null ? null : new Prisma.Decimal(pricing.inputRate),
            outputRate: pricing.outputRate == null ? null : new Prisma.Decimal(pricing.outputRate),
            cachedInputRate: pricing.cachedInputRate == null ? null : new Prisma.Decimal(pricing.cachedInputRate),
            currency: pricing.currency ?? null, unit: pricing.unit ?? "USD_PER_MILLION_TOKENS",
            sourceRef: pricing.sourceRef ?? null, effectiveAt: pricing.effectiveAt ? new Date(pricing.effectiveAt) : null
          } });
        }
      }
      await tx.oicProviderSyncRun.update({ where: { id: run.id }, data: {
        status: "SUCCEEDED", discoveredCount: models.length, createdCount, updatedCount, completedAt: new Date()
      } });
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: connection.applicationId, tenantId: connection.tenantId,
        action: "provider.catalog.manual-sync", targetType: "provider-connection", targetId: connectionId,
        requestId, traceId, metadata: { count: models.length, createdCount, updatedCount } satisfies Prisma.InputJsonObject
      } });
      return { runId: run.id, status: "SUCCEEDED", discoveredCount: models.length, createdCount, updatedCount };
    });
    return result;
  }

  async previewFixtureCatalog(actor: AuthenticatedPrincipal, connectionId: string) {
    const models = await this.providers.localFixtureCatalog(actor, connectionId);
    return this.previewManualCatalog(actor, connectionId, models);
  }

  async syncFixtureCatalog(actor: AuthenticatedPrincipal, connectionId: string, requestId?: string, traceId?: string) {
    const models = await this.providers.localFixtureCatalog(actor, connectionId);
    return this.syncManualCatalog(actor, connectionId, models, requestId, traceId);
  }

  private validatePricing(pricing: PricingEvidenceInput): void {
    const rates = [pricing.inputRate, pricing.outputRate, pricing.cachedInputRate];
    if (rates.some((rate) => rate != null && (!Number.isFinite(rate) || rate < 0))) throw new ConflictException("Pricing rates must be finite and non-negative");
    if (pricing.status === "UNKNOWN") {
      if (rates.some((rate) => rate != null) || pricing.currency != null || pricing.effectiveAt != null) throw new ConflictException("Unknown pricing cannot contain numeric rates, currency or an effective date");
      return;
    }
    if (pricing.currency !== "USD" || !pricing.effectiveAt || rates.every((rate) => rate == null)) throw new ConflictException("Known pricing requires USD, an effective date and at least one evidenced rate");
    if (!Number.isFinite(Date.parse(pricing.effectiveAt))) throw new ConflictException("Pricing effective date is invalid");
  }

  async listUpstreamModels(actor: AuthenticatedPrincipal, connectionId: string) {
    await this.authorizedConnection(actor, connectionId, false);
    const models = await this.db.oicUpstreamModel.findMany({
      where: { connectionId }, orderBy: [{ displayName: "asc" }, { upstreamModelId: "asc" }],
      include: { capabilityEvidence: { orderBy: [{ observedAt: "desc" }, { id: "desc" }] }, pricingEvidence: { orderBy: [{ observedAt: "desc" }, { id: "desc" }], take: 1 } }
    });
    return models.map((model) => {
      const latest = new Map<string, (typeof model.capabilityEvidence)[number]>();
      for (const item of model.capabilityEvidence) if (!latest.has(item.capability)) latest.set(item.capability, item);
      return {
        id: model.id, connectionId: model.connectionId, providerDefinitionId: model.providerDefinitionId,
        upstreamModelId: model.upstreamModelId, displayName: model.displayName, family: model.family,
        source: model.source, lifecycle: model.lifecycle, contextLimit: model.contextLimit, outputLimit: model.outputLimit,
        capabilities: [...latest.values()].map(({ capability, status, source, observedAt }) => ({ capability, status, source, observedAt })),
        pricing: model.pricingEvidence[0] ?? { status: "UNKNOWN", inputRate: null, outputRate: null, cachedInputRate: null, currency: null, effectiveAt: null }
      };
    });
  }

  async changeUpstreamModelLifecycle(actor: AuthenticatedPrincipal, upstreamModelId: string, lifecycle: CatalogLifecycle, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:catalog:manage");
    const model = await this.db.oicUpstreamModel.findUnique({ where: { id: upstreamModelId }, select: { id: true, connectionId: true, lifecycle: true } });
    if (!model) throw new NotFoundException();
    const connection = await this.providers.requireConnectionAccess(actor, model.connectionId, "oic:catalog:manage");
    if (!canTransitionUpstreamCatalogLifecycle(model.lifecycle, lifecycle)) throw new ConflictException("Upstream catalog lifecycle transition is not allowed");
    if (lifecycle !== "ACTIVE") {
      const activeBinding = await this.db.oicModelVariant.findFirst({ where: { upstreamModelId, bindings: { some: { status: "ACTIVE", edition: { lifecycle: { not: "RETIRED" } }, connection: { status: { not: "ARCHIVED" } } } } }, select: { id: true } });
      if (activeBinding) throw new ConflictException("Disable active runtime bindings before changing upstream model lifecycle");
    }
    return this.db.$transaction(async (tx) => {
      const updated = await tx.oicUpstreamModel.update({ where: { id: upstreamModelId }, data: { lifecycle } });
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: connection.applicationId, tenantId: connection.tenantId,
        action: "provider.upstream-model.lifecycle.changed", targetType: "upstream-model", targetId: upstreamModelId,
        requestId, traceId, metadata: { from: model.lifecycle, to: lifecycle, connectionId: model.connectionId } satisfies Prisma.InputJsonObject
      } });
      return updated;
    });
  }

  async createFamily(actor: AuthenticatedPrincipal, input: { familyKey: string; displayName: string }, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    try {
      return await this.db.$transaction(async (tx) => {
        const family = await tx.oicModelFamily.create({ data: input });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action: "model-family.created", targetType: "model-family", targetId: family.id, requestId, traceId, metadata: { familyKey: family.familyKey } } });
        return family;
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Model family key is already in use"); throw error; }
  }

  async retireFamily(actor: AuthenticatedPrincipal, familyId: string, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    return this.db.$transaction(async (tx) => {
      const family = await tx.oicModelFamily.findUnique({ where: { id: familyId }, include: { editions: { select: { id: true, lifecycle: true } } } });
      if (!family) throw new NotFoundException();
      if (family.lifecycle === "RETIRED") throw new ConflictException("Model family is already retired");
      if (family.editions.some((edition) => edition.lifecycle !== "RETIRED")) throw new ConflictException("Retire all model editions before retiring their family");
      const updated = await tx.oicModelFamily.update({ where: { id: familyId }, data: { lifecycle: "RETIRED" } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action: "model-family.lifecycle.changed", targetType: "model-family", targetId: familyId, requestId, traceId, metadata: { from: family.lifecycle, to: "RETIRED" } } });
      return updated;
    });
  }

  async createEdition(actor: AuthenticatedPrincipal, familyId: string, input: { publicId: string; editionKey: string; displayName: string; domain?: string }, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    const family = await this.db.oicModelFamily.findUnique({ where: { id: familyId }, select: { id: true, lifecycle: true } });
    if (!family || family.lifecycle === "RETIRED") throw new NotFoundException();
    try {
      return await this.db.$transaction(async (tx) => {
        const edition = await tx.oicModelEdition.create({ data: { familyId, ...input } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action: "model-edition.created", targetType: "model-edition", targetId: edition.id, requestId, traceId, metadata: { publicId: edition.publicId, familyId } } });
        return edition;
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Model edition identity is already in use"); throw error; }
  }

  async createRevision(actor: AuthenticatedPrincipal, editionId: string, input: { instructions?: string; specification?: string }, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    const edition = await this.db.oicModelEdition.findUnique({ where: { id: editionId }, select: { id: true, lifecycle: true } });
    if (!edition || edition.lifecycle === "RETIRED") throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      const latest = await tx.oicModelRevision.findFirst({ where: { editionId }, orderBy: { revision: "desc" }, select: { revision: true } });
      const revision = await tx.oicModelRevision.create({ data: { editionId, revision: (latest?.revision ?? 0) + 1, ...input } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action: "model-revision.created", targetType: "model-revision", targetId: revision.id, requestId, traceId, metadata: { editionId, revision: revision.revision } } });
      return revision;
    });
  }

  async createVariant(actor: AuthenticatedPrincipal, revisionId: string, input: { variantKey: string; upstreamModelId: string; transportProfile: string }, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    const [upstream, revision] = await Promise.all([
      this.db.oicUpstreamModel.findUnique({ where: { id: input.upstreamModelId }, include: { providerDefinition: true } }),
      this.db.oicModelRevision.findUnique({ where: { id: revisionId }, include: { edition: { select: { lifecycle: true } } } })
    ]);
    if (!revision || revision.edition.lifecycle === "RETIRED") throw new NotFoundException();
    if (!upstream || upstream.lifecycle !== "ACTIVE") throw new NotFoundException();
    const registration = registeredProvider(upstream.providerDefinition.key);
    if (!registration || !registration.transportProfiles.includes(input.transportProfile) || !upstream.providerDefinition.transportProfiles.includes(input.transportProfile)) throw new ConflictException("Provider transport is not registered");
    try {
      return await this.db.$transaction(async (tx) => {
        const variant = await tx.oicModelVariant.create({ data: {
          revisionId, variantKey: input.variantKey, kind: "EXTERNAL_PROVIDER",
          providerDefinitionId: upstream.providerDefinitionId, upstreamModelId: upstream.id, transportProfile: input.transportProfile
        } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action: "model-variant.created", targetType: "model-variant", targetId: variant.id, requestId, traceId, metadata: { revisionId, variantKey: variant.variantKey } } });
        return variant;
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Variant key already exists for this revision"); throw error; }
  }

  async createBinding(actor: AuthenticatedPrincipal, editionId: string, input: {
    variantId: string; connectionId: string; scope: "PLATFORM" | "APPLICATION" | "TENANT";
    applicationId?: string; tenantId?: string; environment?: string;
  }, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    const [edition, variant, connection] = await Promise.all([
      this.db.oicModelEdition.findUnique({ where: { id: editionId }, select: { id: true, lifecycle: true } }),
      this.db.oicModelVariant.findUnique({ where: { id: input.variantId }, include: { revision: { select: { editionId: true } } } }),
      this.providers.requireConnectionAccess(actor, input.connectionId, "oic:models:manage")
    ]);
    if (!edition || edition.lifecycle === "RETIRED" || !variant || variant.revision.editionId !== editionId || variant.kind !== "EXTERNAL_PROVIDER") throw new NotFoundException();
    if (connection.providerDefinitionId !== variant.providerDefinitionId) throw new ConflictException("Runtime binding provider does not match the model variant");
    if ((input.scope === "PLATFORM" && (input.applicationId || input.tenantId || connection.scope !== "PLATFORM")) ||
      (input.scope === "APPLICATION" && (!input.applicationId || input.tenantId || (connection.scope !== "PLATFORM" && connection.applicationId !== input.applicationId))) ||
      (input.scope === "TENANT" && (!input.applicationId || !input.tenantId || (connection.scope !== "PLATFORM" && connection.applicationId !== input.applicationId) || (connection.scope === "TENANT" && connection.tenantId !== input.tenantId)))) {
      throw new ConflictException("Runtime binding scope exceeds provider connection scope");
    }
    if (input.scope !== "PLATFORM") {
      const app = await this.db.oicApplication.findFirst({ where: { id: input.applicationId, status: "ACTIVE" }, select: { id: true } });
      if (!app) throw new NotFoundException();
    }
    if (input.scope === "TENANT") {
      const tenant = await this.db.oicTenant.findFirst({ where: { id: input.tenantId, applicationId: input.applicationId, status: "ACTIVE" }, select: { id: true } });
      if (!tenant) throw new NotFoundException();
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const binding = await tx.oicRuntimeBinding.create({ data: {
          editionId, variantId: input.variantId, connectionId: input.connectionId,
          scope: input.scope, applicationId: input.applicationId ?? null, tenantId: input.tenantId ?? null,
          environment: input.environment ?? "production"
        } });
        await tx.oicAuditEvent.create({ data: {
          actorPrincipalId: actor.id, applicationId: input.applicationId ?? null, tenantId: input.tenantId ?? null,
          action: "model-runtime-binding.created", targetType: "runtime-binding", targetId: binding.id,
          requestId, traceId, metadata: { editionId, variantId: input.variantId, scope: input.scope, environment: binding.environment }
        } });
        return binding;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Runtime binding already exists for this scope");
      throw error;
    }
  }

  async changeBindingStatus(actor: AuthenticatedPrincipal, bindingId: string, status: "DRAFT" | "ACTIVE" | "DISABLED", requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    return this.db.$transaction(async (tx) => {
      const binding = await tx.oicRuntimeBinding.findUnique({ where: { id: bindingId }, include: { edition: true, connection: { include: { providerDefinition: true } } } });
      if (!binding) throw new NotFoundException();
      if (!hasOicConsoleManage(actor.scopes) && (binding.scope === "PLATFORM" || binding.applicationId !== actor.applicationId || (binding.scope === "TENANT" && !actor.tenantIds.includes(binding.tenantId ?? "")))) throw new NotFoundException();
      if (status === "ACTIVE" && (binding.edition.lifecycle === "RETIRED" || binding.connection.status === "ARCHIVED")) throw new ConflictException("Retired models and archived connections cannot be activated");
      if (status === "ACTIVE") {
        if (!["CANDIDATE", "CANARY", "PRODUCTION"].includes(binding.edition.lifecycle)) throw new ConflictException("Model binding requires a candidate or published edition");
        if (binding.connection.status !== "ACTIVE" || binding.connection.healthStatus !== "HEALTHY" || !binding.connection.lastValidatedAt) throw new ConflictException("Provider connection must pass a connection test before activation");
        if (binding.connection.providerDefinition.authStrategy !== "NONE" && await tx.oicProviderCredential.count({ where: { connectionId: binding.connectionId, status: "ACTIVE" } }) === 0) throw new ConflictException("Active provider credential is required");
      }
      const updated = await tx.oicRuntimeBinding.update({ where: { id: bindingId }, data: { status } });
      await tx.oicAuditEvent.create({ data: {
        actorPrincipalId: actor.id, applicationId: binding.applicationId, tenantId: binding.tenantId,
        action: "model-runtime-binding.status.changed", targetType: "runtime-binding", targetId: binding.id,
        requestId, traceId, metadata: { from: binding.status, to: status }
      } });
      return updated;
    });
  }

  async setVisibility(actor: AuthenticatedPrincipal, applicationId: string, editionId: string, visible: boolean, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    if (!hasOicConsoleManage(actor.scopes) && actor.applicationId !== applicationId) throw new NotFoundException();
    const edition = await this.db.oicModelEdition.findUnique({ where: { id: editionId }, select: { id: true } });
    if (!edition) throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      if (visible) {
        await tx.oicApplicationModelVisibility.upsert({ where: { applicationId_editionId: { applicationId, editionId } }, create: { applicationId, editionId }, update: {} });
      } else {
        await tx.oicApplicationModelVisibility.deleteMany({ where: { applicationId, editionId } });
      }
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId, action: visible ? "model.visibility.granted" : "model.visibility.revoked", targetType: "model-edition", targetId: editionId, requestId, traceId, metadata: {} } });
      return { visible };
    });
  }

  async changeEditionLifecycle(actor: AuthenticatedPrincipal, editionId: string, lifecycle: ModelLifecycle, requestId?: string, traceId?: string) {
    this.requireScope(actor, "oic:models:manage");
    return this.db.$transaction(async (tx) => {
      const current = await tx.oicModelEdition.findUnique({ where: { id: editionId }, select: { id: true, lifecycle: true } });
      if (!current) throw new NotFoundException();
      if (!EDITION_TRANSITIONS[current.lifecycle].includes(lifecycle)) throw new ConflictException("Model edition lifecycle transition is not allowed");
      if (lifecycle === "RETIRED" && await tx.oicRuntimeBinding.findFirst({ where: { editionId, status: "ACTIVE" }, select: { id: true } })) throw new ConflictException("Disable active runtime bindings before retiring the model edition");
      if (lifecycle === "CANARY" || lifecycle === "PRODUCTION") {
        const activeBinding = await tx.oicRuntimeBinding.findFirst({ where: { editionId, status: "ACTIVE", environment: "production" }, select: { id: true } });
        if (!activeBinding) throw new ConflictException("A model cannot be published without an active production binding");
      }
      const updated = await tx.oicModelEdition.update({ where: { id: editionId }, data: { lifecycle } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action: "model-edition.lifecycle.changed", targetType: "model-edition", targetId: editionId, requestId, traceId, metadata: { from: current.lifecycle, to: lifecycle } } });
      return updated;
    });
  }
}
