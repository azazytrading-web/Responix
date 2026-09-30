import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateCustomModelDto, ModelCatalogQueryDto, ModelMetadataDto, UpdateCustomModelDto } from "./model-catalog.dto";

export const catalogSelect = {
  id: true, providerId: true, customProviderId: true, ownerWorkspaceId: true,
  providerModelId: true, modelName: true, displayName: true, family: true, version: true,
  contextWindow: true, maxOutputTokens: true, categories: true, source: true, status: true,
  createdAt: true, updatedAt: true, archivedAt: true,
  capabilityEvidence: { orderBy: [{ key: "asc" }, { source: "asc" }] },
  pricingRecords: { orderBy: [{ effectiveFrom: "desc" }, { observedAt: "desc" }, { id: "desc" }] }
} satisfies Prisma.AiModelSelect;
export type CatalogRecord = Prisma.AiModelGetPayload<{ select: typeof catalogSelect }>;
const visible = (workspaceId: string): Prisma.AiModelWhereInput => ({
  OR: [{ source: "BUILT_IN", ownerWorkspaceId: null }, { ownerWorkspaceId: workspaceId }]
});

@Injectable()
export class ModelCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string, query: ModelCatalogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.AiModelWhereInput = {
      AND: [visible(workspaceId)], source: query.source,
      status: query.status ?? { not: "ARCHIVED" },
      providerId: query.providerId, customProviderId: query.customProviderId
    };
    if (query.capability) {
      where.capabilityEvidence = { some: { key: query.capability, source: { not: "WORKSPACE_DECLARED" }, state: "SUPPORTED" } };
      where.NOT = { capabilityEvidence: { some: { key: query.capability, OR: [
        { source: { not: "WORKSPACE_DECLARED" }, state: "UNSUPPORTED" },
        { source: "WORKSPACE_DECLARED", state: { in: ["UNKNOWN", "UNSUPPORTED"] } }
      ] } } };
    }
    return this.prisma.$transaction(async tx => {
      const total = await tx.aiModel.count({ where });
      const items = await tx.aiModel.findMany({ where, select: this.selection(), orderBy: [{ displayName: "asc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit });
      return { items, total, page, limit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(workspaceId: string, id: string) {
    const record = await this.prisma.aiModel.findFirst({ where: { id, ...visible(workspaceId) }, select: this.selection() });
    if (!record) throw new NotFoundException("Model was not found");
    return record;
  }

  create(workspaceId: string, actorId: string, input: CreateCustomModelDto) {
    return this.mutation(async tx => {
      if (input.providerId) {
        const provider = await tx.aiProvider.findFirst({ where: { id: input.providerId, status: "ACTIVE" }, select: { id: true } });
        if (!provider) throw new NotFoundException("Provider target was not found");
      } else {
        // Disabled definitions may hold catalog records; archived/unknown protocols may not.
        const provider = await tx.customAiProvider.findFirst({ where: { id: input.customProviderId, workspaceId, status: { not: "ARCHIVED" }, protocolId: "openai-chat-completions-v1" }, select: { id: true } });
        if (!provider) throw new NotFoundException("Provider target was not found");
      }
      const record = await tx.aiModel.create({ data: {
        ...this.metadata(input), providerId: input.providerId, customProviderId: input.customProviderId,
        ownerWorkspaceId: workspaceId, providerModelId: input.providerModelId, modelName: input.providerModelId,
        source: "CUSTOM", status: "ACTIVE", displayName: input.displayName
      } });
      await this.evidence(tx, record.id, input);
      const after = await tx.aiModel.findUniqueOrThrow({ where: { id: record.id }, select: this.selection() });
      await this.audit(tx, workspaceId, actorId, "created", after.id, null, after);
      await this.auditEvidence(tx, workspaceId, actorId, input, null, after);
      return after;
    });
  }

  update(workspaceId: string, actorId: string, id: string, input: UpdateCustomModelDto) {
    return this.mutation(async tx => {
      const before = await this.owned(tx, workspaceId, id);
      if (before.status === "ARCHIVED") throw new ConflictException("Restore the archived model before updating it");
      await tx.aiModel.update({ where: { id }, data: { ...this.metadata(input), status: input.status } });
      await this.evidence(tx, id, input);
      const after = await tx.aiModel.findUniqueOrThrow({ where: { id }, select: this.selection() });
      await this.audit(tx, workspaceId, actorId, "updated", id, before, after);
      if (before.status !== after.status) await this.audit(tx, workspaceId, actorId, "lifecycle.changed", id, before, after);
      await this.auditEvidence(tx, workspaceId, actorId, input, before, after);
      return after;
    });
  }

  transition(workspaceId: string, actorId: string, id: string, action: "archive" | "restore") {
    return this.mutation(async tx => {
      const before = await this.owned(tx, workspaceId, id);
      if (action === "restore" && before.status !== "ARCHIVED") throw new ConflictException("Model is not archived");
      if (action === "archive") {
        const refs = await tx.aiAgent.count({ where: { modelId: id, status: { in: ["ACTIVE", "PUBLISHED"] }, archivedAt: null, deletedAt: null } });
        if (refs > 0) throw new ConflictException("MODEL_HAS_ACTIVE_AGENT_REFERENCES");
        if (before.status === "ARCHIVED") return before;
      }
      const after = await tx.aiModel.update({ where: { id }, data: { status: action === "archive" ? "ARCHIVED" : "DISABLED", archivedAt: action === "archive" ? new Date() : null }, select: this.selection() });
      await this.audit(tx, workspaceId, actorId, action === "archive" ? "archived" : "restored", id, before, after);
      await this.audit(tx, workspaceId, actorId, "lifecycle.changed", id, before, after);
      return after;
    });
  }

  private selection() {
    // Read only the effective candidate; do not return an unbounded price history.
    return { ...catalogSelect, pricingRecords: { ...catalogSelect.pricingRecords, where: { effectiveFrom: { lte: new Date() } }, take: 1 } };
  }
  private async owned(tx: Prisma.TransactionClient, workspaceId: string, id: string) {
    const record = await tx.aiModel.findFirst({ where: { id, ownerWorkspaceId: workspaceId, source: "CUSTOM" }, select: this.selection() });
    if (!record) throw new NotFoundException("Model was not found");
    return record;
  }
  private metadata(input: Partial<ModelMetadataDto>) {
    return { displayName: input.displayName, family: input.family, version: input.version,
      contextWindow: input.contextWindow, maxOutputTokens: input.maxOutputTokens, categories: input.categories };
  }
  private async evidence(tx: Prisma.TransactionClient, modelId: string, input: Partial<ModelMetadataDto>) {
    for (const capability of input.capabilities ?? []) {
      await tx.aiModelCapability.upsert({ where: { modelId_key_source: { modelId, key: capability.key, source: "WORKSPACE_DECLARED" } },
        create: { modelId, key: capability.key, state: capability.state, source: "WORKSPACE_DECLARED" },
        update: { state: capability.state, observedAt: new Date() } });
    }
    if (input.pricing) {
      await tx.aiModelPrice.create({ data: { ...input.pricing, modelId,
        effectiveFrom: new Date(input.pricing.effectiveFrom), effectiveTo: input.pricing.effectiveTo ? new Date(input.pricing.effectiveTo) : null } });
    }
  }
  private async mutation<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2034" && attempt < 2) continue;
          if (error.code === "P2002") throw new ConflictException("Model identity already exists in this scope");
          if (error.code === "P2034") throw new ConflictException("Model changed concurrently; retry the operation");
          if (error.code === "P2003") throw new NotFoundException("Provider target was not found");
        }
        throw error;
      }
    }
  }
  private summary(value: CatalogRecord | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!value) return Prisma.JsonNull;
    return { id: value.id, providerModelId: value.providerModelId, displayName: value.displayName, status: value.status,
      family: value.family, version: value.version, contextWindow: value.contextWindow, maxOutputTokens: value.maxOutputTokens,
      categories: value.categories,
      capabilities: value.capabilityEvidence.map(item => ({ key: item.key, state: item.state, source: item.source })),
      pricing: value.pricingRecords.map(item => ({ state: item.state, source: item.source, inputRate: item.inputRate?.toString() ?? null,
        outputRate: item.outputRate?.toString() ?? null, cachedInputRate: item.cachedInputRate?.toString() ?? null, currency: item.currency,
        unit: item.unit, effectiveFrom: item.effectiveFrom.toISOString(), effectiveTo: item.effectiveTo?.toISOString() ?? null })) };
  }
  private audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string, action: string, id: string, before: CatalogRecord | null, after: CatalogRecord) {
    return tx.auditLog.create({ data: { workspaceId, userId: actorId, action: `ai.custom-model.${action}`, entityType: "AiModel", entityId: id,
      oldValues: this.summary(before), newValues: this.summary(after) } });
  }
  private async auditEvidence(tx: Prisma.TransactionClient, workspaceId: string, actorId: string, input: Partial<ModelMetadataDto>, before: CatalogRecord | null, after: CatalogRecord) {
    if (input.capabilities !== undefined) await this.audit(tx, workspaceId, actorId, "capabilities.changed", after.id, before, after);
    if (input.pricing !== undefined) {
      // Include the submitted effective-dated price even when scheduled in the future.
      await tx.auditLog.create({ data: { workspaceId, userId: actorId, action: "ai.custom-model.pricing.changed", entityType: "AiModel", entityId: after.id,
        oldValues: this.summary(before), newValues: { ...input.pricing } } });
    }
  }
}
