import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import type { OicRuntimeContext, OicRuntimeRequest } from "@oic/contracts";
import type { OicIntelligenceProfilePolicy } from "@oic/contracts";
import { LocalFeatureEmbeddingProvider, rankEvidence } from "./engines/hybrid-retrieval";
import { planQueries } from "./engines/query-planner";
import { analyzeTask } from "./engines/task-analyzer";
import { decideMemoryWrite } from "./engines/memory-policy";
import { fuseMemoryRecords } from "./engines/memory-fusion";
import type { OicEvidence } from "./engines/types";
import type { TaskAnalysis } from "./engines/types";

const sensitive = /\b(password|passcode|secret|api[ _-]?key|token|credential|credit[ _-]?card|ssn|social security|private key)\b/i;
const remember = /^\s*(?:please\s+)?remember(?:\s+that)?\s*[:,-]?\s*/i;
const preferApplication = /^\s*remember\s+for\s+(?:the\s+)?application\b/i;
const procedural = /^\s*when\s+i\s+ask\s+you\b/i;

export function memoryTypesForIntensity(intensity: number): string[] {
  if (intensity <= 0) return [];
  if (intensity <= 25) return ["SESSION", "EPISODIC"];
  if (intensity <= 50) return ["SESSION", "EPISODIC", "SEMANTIC"];
  if (intensity <= 75) return ["SESSION", "EPISODIC", "SEMANTIC", "APPLICATION"];
  return ["SESSION", "EPISODIC", "SEMANTIC", "APPLICATION", "PROCEDURAL"];
}

export function memoryScopesForContext(context: Pick<OicRuntimeContext, "tenantId" | "sessionId" | "principalId">) {
  return [
    { tenantId: null, kind: { not: "SESSION" as const } },
    ...(context.tenantId ? [{ tenantId: context.tenantId, kind: { not: "SESSION" as const } }] : []),
    ...(context.sessionId ? [{ tenantId: context.tenantId, sessionId: context.sessionId, actorPrincipalId: context.principalId, kind: "SESSION" as const }] : [])
  ];
}

@Injectable()
export class OicMemoryRepository {
  private readonly embedder = new LocalFeatureEmbeddingProvider();
  constructor(private readonly db: OicDatabaseService) {}

  async retrieve(request: OicRuntimeRequest, context: OicRuntimeContext, profile: OicIntelligenceProfilePolicy, plannedKinds?: string[]): Promise<{ evidence: OicEvidence[]; selected: Array<{ id: string; kind: string; score: number; reason: string }>; conflictCount: number; conflictCheckCount: number; lookedUp: number; consideredKinds: string[]; staleCount: number; fusion: { relationships: Array<{ from: string; to: string; relation: string; reason: string }>; decisions: Array<{ id: string; reason: string }> } }> {
    if (profile.memoryIntensity <= 0 || profile.maxMemoryItems <= 0) return { evidence: [], selected: [], conflictCount: 0, conflictCheckCount: 0, lookedUp: 0, consideredKinds: [], staleCount: 0, fusion: { relationships: [], decisions: [] } };
    const allowedKinds = memoryTypesForIntensity(profile.memoryIntensity).filter((kind) => !plannedKinds || plannedKinds.includes(kind));
    if (!allowedKinds.length) return { evidence: [], selected: [], conflictCount: 0, conflictCheckCount: 0, lookedUp: 0, consideredKinds: [], staleCount: 0, fusion: { relationships: [], decisions: [] } };
    // SESSION records use a separate branch so a tenant/application scope can
    // never accidentally make another session's working context visible.
    const scopes = memoryScopesForContext(context);
    const rows = await this.db.oicIntelligenceMemory.findMany({
      where: { applicationId: context.applicationId, OR: scopes, AND: [{ OR: [{ actorPrincipalId: null }, { actorPrincipalId: context.principalId }] }], kind: { in: allowedKinds as never[] }, lifecycle: { in: ["ACTIVE", "CONFLICTED"] }, sensitivity: { in: ["PUBLIC", "INTERNAL"] } },
      orderBy: [{ salience: "desc" }, { confidence: "desc" }, { lastConfirmedAt: "desc" }, { updatedAt: "desc" }], take: 160,
      select: { id: true, applicationId: true, tenantId: true, actorPrincipalId: true, sessionId: true, kind: true, lifecycle: true, title: true, content: true, embedding: true, entityKey: true, sourceType: true, sourceRef: true, confidence: true, salience: true, validUntil: true, lastConfirmedAt: true, createdAt: true, updatedAt: true }
    });
    const now = Date.now();
    const stale = rows.filter((row) => row.validUntil && row.validUntil.getTime() <= now).map((row) => row.id);
    if (stale.length) await this.db.oicIntelligenceMemory.updateMany({ where: { id: { in: stale }, applicationId: context.applicationId }, data: { lifecycle: "STALE" } });
    const nonExpired = rows.filter((row) => !stale.includes(row.id));
    const fusion = fuseMemoryRecords(nonExpired, now);
    const available = nonExpired.filter((row) => fusion.selectedIds.includes(row.id));
    const pairs = fusion.relationships.filter((item) => item.relation === "CONTRADICTS").map((item) => ({ leftId: item.from, rightId: item.to }));
    const conflicted = [...new Set(pairs.flatMap((pair) => [pair.leftId, pair.rightId]))];
    if (conflicted.length) await this.db.oicIntelligenceMemory.updateMany({ where: { id: { in: conflicted }, applicationId: context.applicationId, lifecycle: "ACTIVE" }, data: { lifecycle: "CONFLICTED" } });
    const task = analyzeTask(request);
    const queries = planQueries(request, task, profile.memoryIntensity, Math.min(4, Math.max(1, profile.maxMemoryItems)));
    const ranked = rankEvidence(queries.map((item) => item.query), available.map((row) => ({
      id: row.id, title: row.title, content: row.content, source: row.sourceType, sourceRef: row.sourceRef ?? "unspecified", trust: "MEMORY_UNTRUSTED" as const, scope: row.tenantId ? `tenant:${row.tenantId}` : "application", applicationId: row.applicationId, tenantId: row.tenantId,
      authority: Math.round((row.confidence * 0.7 + row.salience * 0.3)), relevance: 0, freshness: (row.lastConfirmedAt ?? row.updatedAt ?? row.createdAt).getTime(), kind: "MEMORY" as const, embedding: row.embedding,
      relationship: conflicted.includes(row.id) ? "CONTRADICTS" as const : undefined
    })), profile.maxMemoryItems, this.embedder);
    const evidence = ranked.map((item) => ({ ...item, sourceRef: item.sourceRef || "unspecified" }));
    return {
      evidence, conflictCount: pairs.length, conflictCheckCount: available.length * (available.length - 1) / 2, lookedUp: rows.length, consideredKinds: allowedKinds, staleCount: stale.length, fusion: { relationships: fusion.relationships, decisions: fusion.decisions },
      selected: ranked.map((item) => ({ id: item.id, kind: available.find((row) => row.id === item.id)?.kind ?? "UNKNOWN", score: Number(item.fusedScore.toFixed(4)), reason: conflicted.includes(item.id) ? "relevant; conflict preserved and surfaced" : "scope, task relevance, confidence, salience, freshness and provenance ranking" }))
    };
  }

  async writeExplicitCandidate(request: OicRuntimeRequest, context: OicRuntimeContext, profile: OicIntelligenceProfilePolicy, traceId: string): Promise<{ decision: string; kind?: string }> {
    if (!profile.allowMemoryWrites) return { decision: "IGNORE" };
    const lastUser = request.input.filter((message) => message.speaker === "user").flatMap((message) => message.content.map((part) => part.text)).at(-1)?.trim() ?? "";
    const isProcedure = procedural.test(lastUser);
    const isApp = preferApplication.test(lastUser);
    const match = remember.exec(lastUser);
    if (!match && !isProcedure && !isApp) return { decision: "WORKING_ONLY" };
    const content = lastUser.replace(isProcedure ? procedural : isApp ? preferApplication : remember, "").trim().slice(0, 2000);
    if (content.length < 8 || sensitive.test(content)) return { decision: "WORKING_ONLY" };
    const kind = isProcedure ? "PROCEDURAL" : isApp ? "APPLICATION" : context.sessionId ? "SESSION" : "SEMANTIC";
    if (kind === "SESSION" && !context.sessionId) return { decision: "WORKING_ONLY" };
    const duplicate = await this.db.oicIntelligenceMemory.findFirst({ where: { applicationId: context.applicationId, tenantId: isApp ? null : context.tenantId, ...(kind === "SESSION" ? { actorPrincipalId: context.principalId, sessionId: context.sessionId } : {}), kind, lifecycle: { in: ["ACTIVE", "UNVERIFIED"] }, content: { equals: content, mode: "insensitive" } }, select: { id: true } });
    const decision = decideMemoryWrite({ novelty: duplicate ? 0 : 85, durability: kind === "SESSION" ? 35 : 80, usefulness: 75, futureReuse: kind === "SESSION" ? 35 : 80, confidence: 75, sourceQuality: 75, contradictionRisk: 0, sensitivity: "INTERNAL", duplicateSimilarity: duplicate ? 1 : 0, kind, applicationPolicyAllows: true, explicitlyApproved: true });
    if (["IGNORE", "WORKING_ONLY"].includes(decision.decision)) return { decision: decision.decision };
    const lifecycle = decision.decision === "PROCEDURAL_CANDIDATE" ? "UNVERIFIED" : "ACTIVE";
    await this.db.oicIntelligenceMemory.create({ data: {
      applicationId: context.applicationId, tenantId: isApp ? null : context.tenantId, actorPrincipalId: kind === "SESSION" || kind === "SEMANTIC" ? context.principalId : null,
      sessionId: kind === "SESSION" ? context.sessionId : null, kind: kind as never, lifecycle,
      sensitivity: "INTERNAL", title: content.slice(0, 240), content, embedding: this.embedder.embed(content), entityKey: null,
      sourceType: "explicit-runtime-memory-request", sourceRef: traceId, confidence: decision.score, salience: 70,
      validUntil: kind === "SESSION" ? new Date(Date.now() + 30 * 86_400_000) : null, lastConfirmedAt: new Date()
    } });
    return { decision: decision.decision, kind };
  }

  async writeExecutionEpisode(input: { context: OicRuntimeContext; profile: OicIntelligenceProfilePolicy; traceId: string; task: TaskAnalysis; strategy: string; verificationStatus: string; uncertainty: string; providerCalls: number; toolCalls: number; retrievalQueries: number; memoryReads: number; stageTypes: string[]; durationMs: number }): Promise<{ decision: string; kind?: string }> {
    if (!input.profile.allowMemoryWrites || input.profile.memoryIntensity < 50 || input.task.complexity < 40) return { decision: "WORKING_ONLY" };
    if (input.stageTypes.includes("MEMORY_WRITE_DECISION") || input.stageTypes.includes("HARD_FAILURE")) return { decision: "WORKING_ONLY" };
    const taskFingerprint = createHash("sha256").update(`${input.task.taskType}:${input.task.complexity}:${input.strategy}`).digest("hex").slice(0, 24);
    const sourceRef = input.traceId.slice(0, 128);
    const exists = await this.db.oicIntelligenceMemory.findFirst({ where: { applicationId: input.context.applicationId, tenantId: input.context.tenantId, actorPrincipalId: input.context.principalId, kind: "EPISODIC", sourceRef }, select: { id: true } });
    if (exists) return { decision: "IGNORE" };
    const content = JSON.stringify({ version: 1, taskFingerprint, taskType: input.task.taskType, complexityBand: Math.floor(input.task.complexity / 20) * 20, strategy: input.strategy, outcome: "SUCCEEDED", verificationStatus: input.verificationStatus, uncertainty: input.uncertainty, providerCalls: input.providerCalls, toolCalls: input.toolCalls, retrievalQueries: input.retrievalQueries, memoryReads: input.memoryReads, stageTypes: input.stageTypes, durationMs: input.durationMs });
    await this.db.oicIntelligenceMemory.create({ data: {
      applicationId: input.context.applicationId, tenantId: input.context.tenantId, actorPrincipalId: input.context.principalId, sessionId: null,
      kind: "EPISODIC", lifecycle: "ACTIVE", sensitivity: "INTERNAL", title: `Execution episode · ${input.task.taskType} · ${input.strategy}`,
      content, embedding: this.embedder.embed(`${input.task.taskType} ${input.strategy} ${input.task.reasons.join(" ")}`), entityKey: `episode:${taskFingerprint}`,
      sourceType: "oic-execution-episode-v1", sourceRef, confidence: input.verificationStatus === "PASS" ? 85 : 65, salience: Math.min(80, 35 + input.task.complexity / 2),
      validUntil: new Date(Date.now() + 180 * 86_400_000), lastConfirmedAt: new Date()
    } });
    return { decision: "EPISODIC", kind: "EPISODIC" };
  }

  /** Record a reusable strategy for operator review; candidates are never active runtime policy. */
  async writeProceduralCandidate(input: { context: OicRuntimeContext; profile: OicIntelligenceProfilePolicy; traceId: string; task: TaskAnalysis; strategy: string; verificationStatus: string; uncertainty: string }): Promise<{ decision: string; kind?: string }> {
    if (!input.profile.allowMemoryWrites || input.profile.memoryIntensity < 75 || input.task.complexity < 60 || input.verificationStatus !== "PASS" || input.uncertainty !== "LOW_UNCERTAINTY" || input.strategy === "DIRECT") return { decision: "WORKING_ONLY" };
    const taskClass = `${input.task.taskType}:${Math.floor(input.task.complexity / 20) * 20}`;
    const entityKey = `procedure:${createHash("sha256").update(`${taskClass}:${input.strategy}`).digest("hex").slice(0, 24)}`;
    const existing = await this.db.oicIntelligenceMemory.findFirst({ where: { applicationId: input.context.applicationId, tenantId: input.context.tenantId, kind: "PROCEDURAL", entityKey, lifecycle: { in: ["ACTIVE", "UNVERIFIED"] } }, select: { id: true } });
    if (existing) return { decision: "IGNORE", kind: "PROCEDURAL" };
    const content = JSON.stringify({ version: 1, taskClass, strategy: input.strategy, conditions: { minimumComplexity: 60, verificationStatus: "PASS", uncertainty: "LOW_UNCERTAINTY", profilePermissionRequired: true }, outcome: { status: "SUCCEEDED", verified: true }, approval: "UNAPPROVED" });
    await this.db.oicIntelligenceMemory.create({ data: {
      applicationId: input.context.applicationId, tenantId: input.context.tenantId, actorPrincipalId: null, sessionId: null,
      kind: "PROCEDURAL", lifecycle: "UNVERIFIED", sensitivity: "INTERNAL", title: `Strategy candidate · ${input.task.taskType} · ${input.strategy}`,
      content, embedding: this.embedder.embed(`${input.task.taskType} ${input.strategy} reusable execution strategy`), entityKey,
      sourceType: "oic-procedural-candidate-v1", sourceRef: input.traceId.slice(0, 128), confidence: 55, salience: 45,
      validUntil: null, lastConfirmedAt: new Date()
    } });
    return { decision: "PROCEDURAL_CANDIDATE", kind: "PROCEDURAL" };
  }
}
