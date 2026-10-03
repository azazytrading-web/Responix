import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { LocalFeatureEmbeddingProvider } from "./engines/hybrid-retrieval";

export type IntelligenceDataAudit = { requestId?: string; traceId?: string };
type AuditClient = Pick<Prisma.TransactionClient, "oicAuditEvent">;
const key = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

@Injectable()
export class IntelligenceDataService {
  private readonly embedder = new LocalFeatureEmbeddingProvider();
  constructor(private readonly db: OicDatabaseService) {}
  private read(actor: AuthenticatedPrincipal) { if (!actor.scopes.includes("oic:models:read")) throw new NotFoundException(); }
  private manage(actor: AuthenticatedPrincipal) { if (!actor.scopes.includes("oic:models:manage")) throw new NotFoundException(); }
  private async audit(client: AuditClient, actor: AuthenticatedPrincipal, ctx: IntelligenceDataAudit, action: string, type: string, id: string, metadata: Prisma.InputJsonObject) {
    await client.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: actor.applicationId, action, targetType: type, targetId: id, requestId: ctx.requestId, traceId: ctx.traceId, metadata } });
  }
  private async scopedTenant(actor: AuthenticatedPrincipal, tenantId?: string | null) {
    if (!tenantId) return null;
    const tenant = await this.db.oicTenant.findFirst({ where: { id: tenantId, applicationId: actor.applicationId, status: "ACTIVE" }, select: { id: true } });
    if (!tenant || !actor.tenantIds.includes(tenant.id)) throw new NotFoundException();
    return tenant.id;
  }

  async listKnowledge(actor: AuthenticatedPrincipal, filter: { tenantId?: string; q?: string; lifecycle?: "ACTIVE" | "DISABLED" | "ARCHIVED" }) {
    this.read(actor); const tenantId = await this.scopedTenant(actor, filter.tenantId);
    const scope = tenantId ? [{ tenantId: null }, { tenantId }] : [{ tenantId: null }, ...actor.tenantIds.map((id) => ({ tenantId: id }))];
    return this.db.oicIntelligenceKnowledge.findMany({ where: { applicationId: actor.applicationId, OR: scope, ...(filter.lifecycle ? { lifecycle: filter.lifecycle } : {}), ...(filter.q ? { AND: [{ OR: [{ title: { contains: filter.q, mode: "insensitive" } }, { sourceKey: { contains: filter.q, mode: "insensitive" } }, { sourceRef: { contains: filter.q, mode: "insensitive" } }] }] } : {}) }, orderBy: [{ lifecycle: "asc" }, { sourcePriority: "desc" }, { updatedAt: "desc" }], take: 200, select: { id: true, tenantId: true, sourceKey: true, sourceRef: true, title: true, embeddingModel: true, embeddingDimensions: true, authority: true, sourcePriority: true, lifecycle: true, publishedAt: true, createdAt: true, updatedAt: true, archivedAt: true, dependsOn: true } });
  }
  async inspectKnowledge(actor: AuthenticatedPrincipal, id: string) {
    this.read(actor);
    const row = await this.db.oicIntelligenceKnowledge.findFirst({ where: { id, applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] } });
    if (!row) throw new NotFoundException();
    return row;
  }
  async createKnowledge(actor: AuthenticatedPrincipal, input: { tenantId?: string; sourceKey: string; sourceRef: string; title: string; content: string; dependsOn?: Array<{ sourceKey: string; sourceRef: string }>; authority: number; sourcePriority: number }, ctx: IntelligenceDataAudit = {}) {
    this.manage(actor); const tenantId = await this.scopedTenant(actor, input.tenantId);
    if (!key.test(input.sourceKey) || !input.sourceRef.trim() || input.sourceRef.length > 512 || !input.title.trim() || input.title.length > 240 || !input.content.trim() || input.content.length > 200_000 || !Number.isInteger(input.authority) || input.authority < 0 || input.authority > 100 || !Number.isInteger(input.sourcePriority) || input.sourcePriority < 0 || input.sourcePriority > 100) throw new ConflictException("Knowledge item is invalid");
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.oicIntelligenceKnowledge.create({ data: { applicationId: actor.applicationId, tenantId, sourceKey: input.sourceKey, sourceRef: input.sourceRef.trim(), title: input.title.trim(), content: input.content.trim(), dependsOn: input.dependsOn ?? [], embedding: this.embedder.embed(`${input.title}\n${input.content}`), embeddingModel: `${this.embedder.providerKey}/${this.embedder.modelKey}`, embeddingDimensions: this.embedder.dimensions, authority: input.authority, sourcePriority: input.sourcePriority } });
        await this.audit(tx, actor, ctx, "intelligence.knowledge.created", "intelligence-knowledge", row.id, { tenantId, sourceKey: row.sourceKey, embeddingModel: row.embeddingModel });
        return row;
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Knowledge source reference already exists in this scope"); throw error; }
  }
  async updateKnowledge(actor: AuthenticatedPrincipal, id: string, input: { title?: string; authority?: number; sourcePriority?: number; dependsOn?: Array<{ sourceKey: string; sourceRef: string }>; lifecycle?: "ACTIVE" | "DISABLED" | "ARCHIVED" }, ctx: IntelligenceDataAudit = {}) {
    this.manage(actor);
    return this.db.$transaction(async (tx) => {
      const current = await tx.oicIntelligenceKnowledge.findFirst({ where: { id, applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, select: { id: true, tenantId: true, lifecycle: true, content: true } });
      if (!current) throw new NotFoundException();
      if (current.lifecycle === "ARCHIVED" && input.lifecycle && input.lifecycle !== "ARCHIVED") throw new ConflictException("Archived knowledge cannot be restored");
      const data: Prisma.OicIntelligenceKnowledgeUpdateInput = {};
      if (input.title !== undefined) { if (!input.title.trim() || input.title.length > 240) throw new ConflictException("Knowledge title is invalid"); data.title = input.title.trim(); data.embedding = this.embedder.embed(`${input.title}\n${current.content}`); data.embeddingModel = `${this.embedder.providerKey}/${this.embedder.modelKey}`; data.embeddingDimensions = this.embedder.dimensions; }
      if (input.authority !== undefined) { if (!Number.isInteger(input.authority) || input.authority < 0 || input.authority > 100) throw new ConflictException("Authority must be between 0 and 100"); data.authority = input.authority; }
      if (input.sourcePriority !== undefined) { if (!Number.isInteger(input.sourcePriority) || input.sourcePriority < 0 || input.sourcePriority > 100) throw new ConflictException("Source priority must be between 0 and 100"); data.sourcePriority = input.sourcePriority; }
      if (input.dependsOn !== undefined) { if (input.dependsOn.length > 16 || input.dependsOn.some((item) => !key.test(item.sourceKey) || !item.sourceRef.trim() || item.sourceRef.length > 512)) throw new ConflictException("Knowledge dependencies are invalid"); data.dependsOn = input.dependsOn; }
      if (input.lifecycle) { data.lifecycle = input.lifecycle; if (input.lifecycle === "ARCHIVED") data.archivedAt = new Date(); if (input.lifecycle === "ACTIVE") data.archivedAt = null; }
      const updated = await tx.oicIntelligenceKnowledge.update({ where: { id }, data });
      await this.audit(tx, actor, ctx, "intelligence.knowledge.updated", "intelligence-knowledge", id, { lifecycle: updated.lifecycle, tenantId: updated.tenantId });
      return { ...updated, content: "[content omitted from lifecycle response]" };
    });
  }

  async listMemory(actor: AuthenticatedPrincipal, filter: { tenantId?: string; q?: string; kind?: string; lifecycle?: string }) {
    this.read(actor); const tenantId = await this.scopedTenant(actor, filter.tenantId);
    const scope = tenantId ? [{ tenantId: null }, { tenantId }] : [{ tenantId: null }, ...actor.tenantIds.map((id) => ({ tenantId: id }))];
    // The admin API has no authenticated runtime-session context. Keep SESSION
    // memory inside runtime retrieval, which applies the exact session scope.
    const rows = await this.db.oicIntelligenceMemory.findMany({ where: { applicationId: actor.applicationId, AND: [{ OR: scope }, { OR: [{ actorPrincipalId: actor.id }, { actorPrincipalId: null }] }, { kind: { not: "SESSION" } }, ...(filter.q ? [{ OR: [{ title: { contains: filter.q, mode: "insensitive" as const } }, { sourceType: { contains: filter.q, mode: "insensitive" as const } }, { sourceRef: { contains: filter.q, mode: "insensitive" as const } }] }] : [])], ...(filter.kind ? { kind: filter.kind as never } : {}), ...(filter.lifecycle ? { lifecycle: filter.lifecycle as never } : {}) }, orderBy: [{ lifecycle: "asc" }, { salience: "desc" }, { updatedAt: "desc" }], take: 200, select: { id: true, tenantId: true, actorPrincipalId: true, sessionId: true, kind: true, lifecycle: true, sensitivity: true, title: true, entityKey: true, sourceType: true, sourceRef: true, confidence: true, salience: true, validUntil: true, lastConfirmedAt: true, createdAt: true, updatedAt: true } });
    return rows;
  }
  async createMemory(actor: AuthenticatedPrincipal, input: { tenantId?: string; kind: "EPISODIC" | "SEMANTIC" | "PROCEDURAL" | "SESSION" | "APPLICATION"; sensitivity: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED"; title: string; content: string; sourceType: string; sourceRef?: string; confidence: number; salience: number; sessionId?: string; validUntil?: string }, ctx: IntelligenceDataAudit = {}) {
    this.manage(actor); const tenantId = await this.scopedTenant(actor, input.tenantId);
    if (!input.title.trim() || input.title.length > 240 || !input.content.trim() || input.content.length > 20_000 || !key.test(input.sourceType) || (input.sourceRef?.length ?? 0) > 256 || input.confidence < 0 || input.confidence > 100 || input.salience < 0 || input.salience > 100 || input.kind === "SESSION" || input.sessionId !== undefined) throw new ConflictException("Memory record is invalid");
    const lifecycle = input.kind === "PROCEDURAL" || input.sensitivity === "SENSITIVE" || input.sensitivity === "RESTRICTED" ? "UNVERIFIED" : "ACTIVE";
    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.oicIntelligenceMemory.create({ data: { applicationId: actor.applicationId, tenantId: input.kind === "APPLICATION" ? null : tenantId, actorPrincipalId: input.kind === "SESSION" ? actor.id : null, sessionId: input.sessionId ?? null, kind: input.kind, lifecycle, sensitivity: input.sensitivity, title: input.title.trim(), content: input.content.trim(), embedding: this.embedder.embed(`${input.title}\n${input.content}`), entityKey: null, sourceType: input.sourceType, sourceRef: input.sourceRef ?? null, confidence: input.confidence, salience: input.salience, validUntil: input.validUntil ? new Date(input.validUntil) : null } });
      await this.audit(tx, actor, ctx, "intelligence.memory.created", "intelligence-memory", created.id, { kind: created.kind, lifecycle: created.lifecycle, tenantId: created.tenantId });
      return created;
    });
    return { ...row, content: "[content omitted from creation response]" };
  }
  async inspectMemory(actor: AuthenticatedPrincipal, id: string) {
    this.read(actor);
    const row = await this.db.oicIntelligenceMemory.findFirst({ where: { id, applicationId: actor.applicationId, kind: { not: "SESSION" }, AND: [{ OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, { OR: [{ actorPrincipalId: null }, { actorPrincipalId: actor.id }] }] } });
    if (!row) throw new NotFoundException();
    return row.sensitivity === "SENSITIVE" || row.sensitivity === "RESTRICTED" ? { ...row, content: "[sensitive memory content is hidden]" } : row;
  }
  async updateMemory(actor: AuthenticatedPrincipal, id: string, input: { lifecycle?: "ACTIVE" | "STALE" | "SUPERSEDED" | "CONFLICTED" | "UNVERIFIED" | "ARCHIVED"; sensitivity?: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED"; validUntil?: string | null }, ctx: IntelligenceDataAudit = {}) {
    this.manage(actor);
    return this.db.$transaction(async (tx) => {
      const current = await tx.oicIntelligenceMemory.findFirst({ where: { id, applicationId: actor.applicationId, kind: { not: "SESSION" }, AND: [{ OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, { OR: [{ actorPrincipalId: null }, { actorPrincipalId: actor.id }] }] }, select: { id: true, lifecycle: true, sensitivity: true, tenantId: true } });
      if (!current) throw new NotFoundException();
      if (current.lifecycle === "ARCHIVED" && input.lifecycle && input.lifecycle !== "ARCHIVED") throw new ConflictException("Archived memory cannot be restored");
      const updated = await tx.oicIntelligenceMemory.update({ where: { id }, data: { ...(input.lifecycle ? { lifecycle: input.lifecycle, archivedAt: input.lifecycle === "ARCHIVED" ? new Date() : null } : {}), ...(input.sensitivity ? { sensitivity: input.sensitivity } : {}), ...(input.validUntil !== undefined ? { validUntil: input.validUntil ? new Date(input.validUntil) : null } : {}) }, select: { id: true, tenantId: true, kind: true, lifecycle: true, sensitivity: true, confidence: true, salience: true, validUntil: true, updatedAt: true } });
      await this.audit(tx, actor, ctx, "intelligence.memory.lifecycle.changed", "intelligence-memory", id, { from: current.lifecycle, to: updated.lifecycle, tenantId: updated.tenantId });
      return updated;
    });
  }
}
