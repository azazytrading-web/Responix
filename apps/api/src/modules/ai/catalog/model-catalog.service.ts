import { BadRequestException, Injectable } from "@nestjs/common";
import { ModelCapabilityKey } from "@prisma/client";
import type { CatalogModelResponseDto, CreateCustomModelDto, ModelCatalogQueryDto, UpdateCustomModelDto } from "./model-catalog.dto";
import { ModelCatalogRepository } from "./model-catalog.repository";
import type { CatalogRecord } from "./model-catalog.repository";
import { effectiveCapability, validatePrice } from "./model-catalog.semantics";

@Injectable()
export class ModelCatalogService {
  constructor(private readonly repository: ModelCatalogRepository) {}
  async list(workspaceId: string, query: ModelCatalogQueryDto) {
    const page = await this.repository.list(workspaceId, query);
    return { ...page, items: page.items.map(item => this.serialize(item)) };
  }
  async get(workspaceId: string, id: string) { return this.serialize(await this.repository.get(workspaceId, id)); }
  async create(workspaceId: string, actorId: string, input: CreateCustomModelDto) {
    if (Number(input.providerId !== undefined) + Number(input.customProviderId !== undefined) !== 1) throw new BadRequestException("Exactly one provider target is required");
    validatePrice(input.pricing);
    return this.serialize(await this.repository.create(workspaceId, actorId, input));
  }
  async update(workspaceId: string, actorId: string, id: string, input: UpdateCustomModelDto) {
    validatePrice(input.pricing);
    return this.serialize(await this.repository.update(workspaceId, actorId, id, input));
  }
  async transition(workspaceId: string, actorId: string, id: string, action: "archive" | "restore") {
    return this.serialize(await this.repository.transition(workspaceId, actorId, id, action));
  }
  serialize(record: CatalogRecord, now = new Date()): CatalogModelResponseDto {
    const price = record.pricingRecords.find(item => item.effectiveFrom <= now);
    const current = price && (!price.effectiveTo || price.effectiveTo > now);
    const priceMetadata = price ? { source: price.source, effectiveFrom: price.effectiveFrom.toISOString(),
      ...(price.effectiveTo ? { effectiveTo: price.effectiveTo.toISOString() } : {}), observedAt: price.observedAt.toISOString() } : {};
    return {
      id: record.id, providerModelId: record.providerModelId, modelName: record.modelName, displayName: record.displayName,
      ...(record.providerId ? { providerId: record.providerId } : {}), ...(record.customProviderId ? { customProviderId: record.customProviderId } : {}),
      ...(record.ownerWorkspaceId ? { ownerWorkspaceId: record.ownerWorkspaceId } : {}),
      ...(record.family === null ? {} : { family: record.family }), ...(record.version === null ? {} : { version: record.version }),
      ...(record.contextWindow === null ? {} : { contextWindow: record.contextWindow }), ...(record.maxOutputTokens === null ? {} : { maxOutputTokens: record.maxOutputTokens }),
      categories: record.categories, source: record.source, status: record.status,
      productionIntegration: record.source !== "BUILT_IN" ? "SPRINT_C_REQUIRED" : record.status === "ACTIVE" ? "LEGACY_BUILT_IN_PATH" : "LIFECYCLE_BLOCKED",
      warnings: record.status === "DEPRECATED" ? ["DEPRECATED_NO_NEW_ASSIGNMENTS"] : [],
      capabilities: Object.values(ModelCapabilityKey).map(key => ({ key, catalogState: effectiveCapability(key, record.capabilityEvidence),
        evidence: record.capabilityEvidence.filter(item => item.key === key).map(item => ({ state: item.state, source: item.source, observedAt: item.observedAt.toISOString() })) })),
      pricing: current && price.state === "KNOWN" && price.inputRate !== null && price.outputRate !== null
        ? { state: "KNOWN", ...priceMetadata, inputRate: price.inputRate.toFixed(6), outputRate: price.outputRate.toFixed(6),
          ...(price.cachedInputRate === null ? {} : { cachedInputRate: price.cachedInputRate.toFixed(6) }), currency: price.currency, unit: price.unit }
        : { state: "UNKNOWN", ...priceMetadata },
      createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
      ...(record.archivedAt ? { archivedAt: record.archivedAt.toISOString() } : {})
    };
  }
}
