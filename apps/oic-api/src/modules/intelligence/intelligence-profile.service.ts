import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { policyFromRevision, policyInputSchema } from "./engines/profile-policy";
import type { ProfilePolicyInput } from "./engines/profile-policy";

export type IntelligenceAuditContext = { requestId?: string; traceId?: string };
const keySchema = /^[a-z][a-z0-9._-]{1,63}$/;

@Injectable()
export class IntelligenceProfileService {
  constructor(private readonly db: OicDatabaseService) {}

  private requireManage(actor: AuthenticatedPrincipal) {
    if (!actor.scopes.includes("oic:models:manage")) throw new NotFoundException();
  }
  private async audit(tx: Prisma.TransactionClient, actor: AuthenticatedPrincipal, context: IntelligenceAuditContext, action: string, type: string, id: string, metadata: Prisma.InputJsonObject = {}) {
    await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, action, targetType: type, targetId: id, requestId: context.requestId, traceId: context.traceId, metadata } });
  }

  async list(actor: AuthenticatedPrincipal) {
    if (!actor.scopes.includes("oic:models:read")) throw new NotFoundException();
    return this.db.oicIntelligenceProfile.findMany({
      orderBy: [{ source: "asc" }, { profileKey: "asc" }],
      include: { revisions: { orderBy: { revision: "desc" }, take: 1, include: { _count: { select: { modelRevisions: true } } } }, _count: { select: { revisions: true } } }
    });
  }

  async get(actor: AuthenticatedPrincipal, id: string) {
    if (!actor.scopes.includes("oic:models:read")) throw new NotFoundException();
    const profile = await this.db.oicIntelligenceProfile.findUnique({ where: { id }, include: { revisions: { orderBy: { revision: "desc" }, include: { _count: { select: { modelRevisions: true } } } } } });
    if (!profile) throw new NotFoundException();
    return profile;
  }

  async create(actor: AuthenticatedPrincipal, input: { profileKey: string; displayName: string; description?: string; policy: unknown }, context: IntelligenceAuditContext = {}) {
    this.requireManage(actor);
    const policy = policyInputSchema.safeParse(input.policy);
    if (!policy.success || !keySchema.test(input.profileKey) || !input.displayName.trim() || input.displayName.length > 160 || (input.description?.length ?? 0) > 1000) throw new ConflictException("Intelligence profile configuration is invalid");
    return this.makeProfile(actor, { ...input, policy: policy.data }, context);
  }

  async clone(actor: AuthenticatedPrincipal, sourceRevisionId: string, input: { profileKey: string; displayName: string; description?: string }, context: IntelligenceAuditContext = {}) {
    this.requireManage(actor);
    if (!keySchema.test(input.profileKey) || !input.displayName.trim() || input.displayName.length > 160) throw new ConflictException("Intelligence profile identity is invalid");
    const source = await this.db.oicIntelligenceProfileRevision.findUnique({ where: { id: sourceRevisionId }, include: { profile: true } });
    if (!source || source.profile.lifecycle === "ARCHIVED") throw new NotFoundException();
    const policy: ProfilePolicyInput = {
      contextIntensity: source.contextIntensity, memoryIntensity: source.memoryIntensity, retrievalIntensity: source.retrievalIntensity, reasoningIntensity: source.reasoningIntensity, toolsIntensity: source.toolsIntensity, verificationIntensity: source.verificationIntensity, synthesisIntensity: source.synthesisIntensity, efficiencyIntensity: source.efficiencyIntensity,
      maxStages: source.maxStages, maxProviderCalls: source.maxProviderCalls, maxToolCalls: source.maxToolCalls, maxRetrievalQueries: source.maxRetrievalQueries, maxMemoryItems: source.maxMemoryItems, maxCandidates: source.maxCandidates, maxVerificationRounds: source.maxVerificationRounds, maxContextTokens: source.maxContextTokens, maxExecutionMs: source.maxExecutionMs,
      allowMemoryWrites: source.allowMemoryWrites, allowRevision: source.allowRevision, requireEvidence: source.requireEvidence
    };
    return this.makeProfile(actor, { ...input, policy }, context);
  }

  private async makeProfile(actor: AuthenticatedPrincipal, input: { profileKey: string; displayName: string; description?: string; policy: ProfilePolicyInput }, context: IntelligenceAuditContext) {
    try {
      return await this.db.$transaction(async (tx) => {
        const profile = await tx.oicIntelligenceProfile.create({ data: { profileKey: input.profileKey, displayName: input.displayName.trim(), description: input.description?.trim() ?? "", source: "CUSTOM" } });
        const revision = await tx.oicIntelligenceProfileRevision.create({ data: { profileId: profile.id, revision: 1, ...input.policy } });
        await this.audit(tx, actor, context, "intelligence.profile.created", "intelligence-profile", profile.id, { profileKey: profile.profileKey, revision: 1 });
        return { ...profile, revisions: [revision] };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Intelligence profile key already exists");
      throw error;
    }
  }

  async createRevision(actor: AuthenticatedPrincipal, profileId: string, value: unknown, context: IntelligenceAuditContext = {}) {
    this.requireManage(actor);
    const parsed = policyInputSchema.safeParse(value);
    if (!parsed.success) throw new ConflictException("Intelligence profile configuration is invalid");
    return this.db.$transaction(async (tx) => {
      const profile = await tx.oicIntelligenceProfile.findUnique({ where: { id: profileId }, include: { revisions: { orderBy: { revision: "desc" }, take: 1 } } });
      if (!profile || profile.source === "BUILTIN" || profile.lifecycle !== "ACTIVE") throw new NotFoundException();
      const revision = await tx.oicIntelligenceProfileRevision.create({ data: { profileId, revision: (profile.revisions[0]?.revision ?? 0) + 1, ...parsed.data } });
      await this.audit(tx, actor, context, "intelligence.profile.revision.created", "intelligence-profile-revision", revision.id, { profileId, revision: revision.revision });
      return revision;
    });
  }

  async changeLifecycle(actor: AuthenticatedPrincipal, id: string, lifecycle: "ACTIVE" | "DISABLED" | "ARCHIVED", context: IntelligenceAuditContext = {}) {
    this.requireManage(actor);
    return this.db.$transaction(async (tx) => {
      const profile = await tx.oicIntelligenceProfile.findUnique({ where: { id } });
      if (!profile || profile.source === "BUILTIN") throw new NotFoundException();
      if (profile.lifecycle === "ARCHIVED" && lifecycle !== "ARCHIVED") throw new ConflictException("Archived intelligence profiles cannot be restored");
      const updated = await tx.oicIntelligenceProfile.update({ where: { id }, data: { lifecycle } });
      await this.audit(tx, actor, context, "intelligence.profile.lifecycle.changed", "intelligence-profile", id, { from: profile.lifecycle, to: lifecycle });
      return updated;
    });
  }

  async resolveRevision(id: string) {
    const revision = await this.db.oicIntelligenceProfileRevision.findUnique({ where: { id }, include: { profile: true } });
    if (!revision || revision.profile.lifecycle !== "ACTIVE") throw new NotFoundException();
    return policyFromRevision(revision);
  }

  async listExecutions(actor: AuthenticatedPrincipal, limit = 50) {
    if (!actor.scopes.includes("oic:models:read")) throw new NotFoundException();
    const items = await this.db.oicIntelligenceExecution.findMany({ where: { applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, orderBy: { startedAt: "desc" }, take: Math.max(1, Math.min(100, limit)), select: { id: true, traceId: true, requestId: true, tenantId: true, modelId: true, modelRevisionId: true, profileRevisionId: true, status: true, strategy: true, taskType: true, uncertainty: true, stageCount: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, contextTokens: true, inputTokens: true, outputTokens: true, verificationStatus: true, summary: true, startedAt: true, completedAt: true } });
    return items;
  }

  async getExecution(actor: AuthenticatedPrincipal, traceId: string) {
    if (!actor.scopes.includes("oic:models:read")) throw new NotFoundException();
    const execution = await this.db.oicIntelligenceExecution.findFirst({ where: { traceId, applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, select: { id: true, traceId: true, requestId: true, tenantId: true, modelId: true, modelRevisionId: true, profileRevisionId: true, status: true, strategy: true, taskType: true, uncertainty: true, stageCount: true, providerCallCount: true, retrievalQueryCount: true, memoryLookupCount: true, contextTokens: true, inputTokens: true, outputTokens: true, verificationStatus: true, summary: true, startedAt: true, completedAt: true, stages: { orderBy: { stageIndex: "asc" }, select: { stageIndex: true, stageType: true, status: true, strategy: true, durationMs: true, resourceUse: true, metadata: true, startedAt: true, completedAt: true } } } });
    if (!execution) throw new NotFoundException();
    return execution;
  }
}
