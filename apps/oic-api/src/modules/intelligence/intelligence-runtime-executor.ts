import { Injectable } from "@nestjs/common";
import type { OicResolvedModel, OicRuntimeContext, OicRuntimeExecutionResult, OicRuntimeExecutor, OicRuntimeExecutionStreamChunk, OicRuntimeRequest } from "@oic/contracts";
import { OicDatabaseService, Prisma } from "@oic/database";
import { analyzeTask } from "./engines/task-analyzer";
import { selectAdaptiveDepth } from "./engines/adaptive-depth";
import { compileContext } from "./engines/context-compiler";
import { planQueries } from "./engines/query-planner";
import { rankEvidence, LocalFeatureEmbeddingProvider } from "./engines/hybrid-retrieval";
import { verifyCandidate } from "./engines/verifier";
import { createRevisionInstruction } from "./engines/revision-planner";
import { chooseStop } from "./engines/execution-controller";
import type { OicEvidence, VerificationResult } from "./engines/types";
import { FAST_POLICY } from "./engines/profile-policy";
import { OicMemoryRepository, memoryTypesForIntensity } from "./memory.repository";
import { selectReasoningStrategy } from "./engines/strategy-selector";
import { OicToolRegistry, calculatorExpression, unitConversionArguments } from "./engines/tool-registry";
import type { OicToolResult } from "./engines/tool-registry";
import { buildSubproblemGraph, scoreCandidate } from "./engines/reasoning-engine";
import { OicArtifactCache } from "./engines/artifact-cache";
import { knowledgeScopeWhere } from "./engines/retrieval-scope";
import { OicWorkingMemory } from "./engines/working-memory";
import { compareCandidates, deduplicateCandidates } from "./engines/candidate-comparator";
import type { CandidateComparison } from "./engines/candidate-comparator";
import { buildEvidenceGraph } from "./engines/evidence-graph";
import type { EvidenceGraph } from "./engines/evidence-graph";
import { runAdversarialCritic } from "./engines/adversarial-critic";
import type { CriticResult } from "./engines/adversarial-critic";
import { assessHypotheses, extractHypotheses, planHypothesisEvidenceQueries } from "./engines/hypothesis-engine";
import { searchCognitiveStates, searchHypothesisPaths } from "./engines/bounded-search";
import type { CognitiveSearchResult } from "./engines/bounded-search";
import { buildEvidenceCoverageMatrix } from "./engines/evidence-coverage";
import type { EvidenceCoverageMatrix } from "./engines/evidence-coverage";
import { assessMemoryUtility } from "./engines/memory-utility";
import { backtrackCognitiveState, buildCognitiveProblem, buildEpistemicState, checkpointCognitiveState, chooseNextAction, planMemoryKinds, recordCognitiveAction, resolveTaskPolicy, safeFingerprint, stopCognitiveState } from "./engines/cognitive-controller";
import type { CognitiveExecutionState, CognitiveProblem, EpistemicState } from "./engines/cognitive-controller";

type Stage = { stageType: string; status: string; strategy?: string; durationMs: number; resourceUse: Prisma.InputJsonObject; metadata: Prisma.InputJsonObject; startedAt: Date; completedAt: Date };
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Bounded provider-independent orchestration around the credential-safe provider adapter. Trace persistence intentionally excludes prompts and outputs. */
@Injectable()
export class IntelligenceRuntimeExecutor implements OicRuntimeExecutor {
  private readonly embedder = new LocalFeatureEmbeddingProvider();
  private readonly tools = new OicToolRegistry();
  private readonly retrievalCache = new OicArtifactCache<ReturnType<typeof rankEvidence>>(128, 30_000);
  private readonly toolCache = new OicArtifactCache<OicToolResult>(128, 60_000);
  constructor(private readonly db: OicDatabaseService, private readonly provider: OicRuntimeExecutor, private readonly memories: OicMemoryRepository) {}

  async execute(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): Promise<OicRuntimeExecutionResult> {
    const configuredPolicy = model.intelligenceProfile ?? { ...FAST_POLICY, id: "builtin-fast-unassigned", profileId: "builtin-fast-unassigned", profileKey: "FAST", displayName: "Fast (default)", revision: 1 };
    let policy = configuredPolicy;
    const startedAt = Date.now(); const deadlineAt = startedAt + policy.maxExecutionMs;
    const stages: Stage[] = []; let calls = 0; let queries = 0; let memoryLookups = 0; let toolCalls = 0; let toolFailed = false; let cacheHits = 0; let cacheMisses = 0; let verificationPasses = 0; let revisions = 0; let candidateCount = 1; let contextTokens = 0; let inputTokens = 0; let outputTokens = 0; let inputUsageKnown = true; let outputUsageKnown = true; let verificationStatus = "NOT_RUN"; let uncertainty = "LOW_UNCERTAINTY"; let stopReason = "SUCCESS"; let task = analyzeTask(request);
    const workingMemory = new OicWorkingMemory(task);
    const requestText = request.input.filter((item) => item.speaker === "user").flatMap((item) => item.content.map((part) => part.text)).join("\n");
    const captureUsage = (result: OicRuntimeExecutionResult) => {
      if (result.usage?.inputTokens === undefined) inputUsageKnown = false; else inputTokens += result.usage.inputTokens;
      if (result.usage?.outputTokens === undefined) outputUsageKnown = false; else outputTokens += result.usage.outputTokens;
    };
    let memorySelection: Array<{ id: string; kind: string; score: number; reason: string }> = [];
    let candidateNotes: Array<{ id: string; strategy: string; score: number; verification: string }> = [];
    let candidateDiversitySummary: { planned: number; evaluated: number; duplicateCount: number; structuralFingerprints: Array<{ id: string; fingerprint: string }> } | null = null;
    let duplicateCandidateCount = 0;
    let candidateComparison: CandidateComparison | null = null;
    let candidateSearch: CognitiveSearchResult | null = null;
    let evidenceGraph: EvidenceGraph | null = null;
    let hypothesisSummary: ReturnType<typeof assessHypotheses> = [];
    let cognitiveSearch: CognitiveSearchResult | null = null;
    let evidenceCoverage: EvidenceCoverageMatrix | null = null;
    let problemModel: CognitiveProblem | null = null;
    let epistemicState: EpistemicState | null = null;
    let cognitiveState: CognitiveExecutionState | null = null;
    let backtrackCheckpointSummary: { id: string; problemStateRestored: boolean; constraintsRestored: number; epistemicFactsRestored: number; evidenceReferencesRestored: number; memorySelectionsRestored: number; candidateStatesRestored: number; resourceUsagePreserved: boolean } | null = null;
    let effectiveDepth = 0;
    let taskResolutionReasons: string[] = [];
    let effectiveRetrievalMode = "OFF";
    let memoryPlanSummary: { kinds: string[]; reasons: string[] } | null = null;
    let memoryFusionSummary: { relationships: Array<{ from: string; to: string; relation: string; reason: string }>; decisions: Array<{ id: string; reason: string }> } | null = null;
    let contextMemoryIds: string[] = [];
    let claimEvidenceSummary: VerificationResult["claimEvidence"];
    let criticResult: CriticResult | null = null;
    const recordControllerAction = (state: CognitiveExecutionState, action: Parameters<typeof recordCognitiveAction>[1], reason: string, strategy?: Parameters<typeof recordCognitiveAction>[3], value?: Parameters<typeof recordCognitiveAction>[4]) => recordCognitiveAction({ ...state, resourceUsage: { stages: stages.length, providerCalls: calls, retrievalQueries: queries, memoryReads: memoryLookups, toolCalls, verificationRounds: verificationPasses, repairRounds: revisions, backtracks: state.actions.filter((item) => item.action === "BACKTRACK").length } }, action, reason, strategy, value);
    const stage = async <T>(kind: string, details: { strategy?: string; metadata?: Record<string, unknown> }, run: () => T | Promise<T>): Promise<T> => {
      if (stages.length >= policy.maxStages || Date.now() >= deadlineAt || signal?.aborted) throw new Error("intelligence_resource_limit");
      const begin = new Date(); let status = "SUCCEEDED";
      try { return await run(); } catch (error) { status = "FAILED"; throw error; }
      finally { const done = new Date(); stages.push({ stageType: kind, status, strategy: details.strategy, durationMs: Math.max(0, done.getTime() - begin.getTime()), resourceUse: { providerCalls: calls, retrievalQueries: queries, memoryLookups, contextTokens }, metadata: asJson(details.metadata ?? {}) as Prisma.InputJsonObject, startedAt: begin, completedAt: done }); }
    };
    const traceId = context.traceId.slice(0, 128);
    const execution = await this.db.oicIntelligenceExecution.create({ data: {
      traceId, requestId: context.requestId.slice(0, 128), applicationId: context.applicationId, tenantId: context.tenantId, principalId: context.principalId,
      modelId: model.id, modelRevisionId: model.revisionId ?? null, profileRevisionId: policy.id === "builtin-fast-unassigned" ? null : policy.id,
      strategy: "PENDING", taskType: "PENDING", uncertainty: "LOW_UNCERTAINTY", verificationStatus: "NOT_RUN", summary: { profileKey: policy.profileKey, profileRevision: policy.revision }
    } });
    let status: "SUCCEEDED" | "FAILED" | "CANCELLED" = "FAILED";
    try {
      const taskMetadata: Record<string, unknown> = { taskType: task.taskType, complexity: task.complexity, uncertainty: task.uncertainty, subtaskCount: task.subtaskCount, reasons: task.reasons };
      task = await stage("TASK_ANALYSIS", { metadata: taskMetadata }, () => {
        const memoryRelevant = Boolean(context.sessionId && (task.taskType === "SIMPLE_FACTUAL" || task.taskType === "CONVERSATION"));
        const requiresTool = /\b(convert|calculate|compute|solve)\b/i.test(requestText);
        const resolution = resolveTaskPolicy(configuredPolicy, task, memoryRelevant || requiresTool);
        policy = resolution.policy;
        effectiveDepth = resolution.depth;
        taskResolutionReasons = resolution.reasons;
        const goals = requestText.split(/(?:\n+|[.!?;]+|\b(?:and then|then|also|compare|versus|while|because)\b)/i).map((part) => part.trim()).filter((part) => part.length >= 12);
        problemModel = buildCognitiveProblem(task, { goals, requiresTool });
        cognitiveState = { problem: problemModel, depth: effectiveDepth as CognitiveExecutionState["depth"], strategy: "DIRECT", previousStrategies: [], actions: [], evidenceIds: [], conflictedEvidenceIds: [], unresolvedCount: 0, repeatedFindingCount: 0, budget: { stages: policy.maxStages, providerCalls: policy.maxProviderCalls, candidates: policy.maxCandidates, retrievalRounds: policy.maxRetrievalQueries, verificationRounds: policy.maxVerificationRounds, repairRounds: policy.allowRevision ? policy.maxVerificationRounds : 0, backtracks: 1, toolCalls: policy.maxToolCalls, deadlineAt }, checkpoints: [], failedPathFingerprints: [], epistemicState: null, memorySelections: [], constraints: [], searchParentId: null, candidates: [], resourceUsage: { stages: 0, providerCalls: 0, retrievalQueries: 0, memoryReads: 0, toolCalls: 0, verificationRounds: 0, repairRounds: 0, backtracks: 0 }, stop: "RUNNING" };
        cognitiveState = recordControllerAction(cognitiveState, "ANALYZE_TASK", "problem model built from task type, deliverables, constraints, evidence/tool needs and ambiguity");
        cognitiveState = recordControllerAction(cognitiveState, effectiveDepth === 0 ? "DIRECT_EXECUTION" : problemModel.requiresEvidence ? "RETRIEVE" : problemModel.goalCount > 1 ? "DECOMPOSE" : "VERIFY", taskResolutionReasons[0] ?? "controller selected initial cognitive depth");
        Object.assign(taskMetadata, { effectiveDepth, effectiveReasoningIntensity: policy.reasoningIntensity, effectiveRetrievalIntensity: policy.retrievalIntensity, effectiveMemoryIntensity: policy.memoryIntensity, problemModel, depthReasons: taskResolutionReasons });
        return task;
      });
      const hasSource = policy.retrievalIntensity > 0;
      const depth = selectAdaptiveDepth(task, policy, hasSource);
      const hypothesisLimit = Math.min(6, policy.maxStages > 10 ? 6 : 3, Math.max(1, policy.maxRetrievalQueries));
      const hypothesisLimits = {
        maxHypotheses: hypothesisLimit,
        maxEvidenceQueriesPerHypothesis: Math.min(4, Math.max(1, Math.floor(policy.maxRetrievalQueries / hypothesisLimit))),
        maxCounterEvidenceQueries: Math.min(4, policy.maxRetrievalQueries),
        maxHypothesisRounds: policy.reasoningIntensity >= 90 ? 2 : 1
      };
      const hypotheses = policy.reasoningIntensity >= 75 ? extractHypotheses(requestText, hypothesisLimits) : [];
      if (hypotheses.length && cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "GENERATE_HYPOTHESES", `${hypotheses.length} bounded task-derived explanations generated before evidence acquisition`);
      const memoryPlan = planMemoryKinds({ task, requestText, hasSession: Boolean(context.sessionId), eligibleKinds: memoryTypesForIntensity(policy.memoryIntensity) });
      memoryPlanSummary = memoryPlan;
      const memoryMetadata: Record<string, unknown> = { intensity: policy.memoryIntensity, plannedKinds: memoryPlan.kinds, planReasons: memoryPlan.reasons };
      const memoryResult = policy.memoryIntensity > 0 && memoryPlan.kinds.length > 0
        ? await stage("MEMORY_SELECTION", { strategy: "scoped-memory-rank-v1", metadata: memoryMetadata }, async () => {
          const selected = await this.memories.retrieve(request, context, policy, memoryPlan.kinds);
          Object.assign(memoryMetadata, { typesConsidered: selected.consideredKinds, candidateCount: selected.lookedUp, selectedCount: selected.selected.length, conflictChecks: selected.conflictCheckCount, conflicts: selected.conflictCount, staleCount: selected.staleCount, fusionRelationshipCount: selected.fusion.relationships.length, fusionDecisionCount: selected.fusion.decisions.length });
          return selected;
        })
        : { evidence: [] as OicEvidence[], selected: [] as Array<{ id: string; kind: string; score: number; reason: string }>, conflictCount: 0, conflictCheckCount: 0, lookedUp: 0, consideredKinds: [] as string[], staleCount: 0, fusion: { relationships: [] as Array<{ from: string; to: string; relation: string; reason: string }>, decisions: [] as Array<{ id: string; reason: string }> } };
      memoryLookups = memoryResult.lookedUp;
      memorySelection = memoryResult.selected;
      if (cognitiveState) cognitiveState = { ...cognitiveState, memorySelections: memorySelection.map((item) => ({ ...item })) };
      memoryFusionSummary = memoryResult.fusion;
      if (cognitiveState && memoryPlan.kinds.length > 0) cognitiveState = recordControllerAction(cognitiveState, "RECALL_MEMORY", memoryLookups ? `${memorySelection.length} scoped memories selected from ${memoryLookups} eligible records` : "planned memory categories returned no in-scope candidate records");
      const retrievalMetadata: Record<string, unknown> = {};
      const knowledgeEvidence: OicEvidence[] = depth.retrieve ? await stage("RETRIEVAL", { strategy: "hybrid-feature-rank-fusion-v1", metadata: retrievalMetadata }, async () => {
        const retrievalTier = policy.retrievalIntensity >= 90 ? "MAX" : policy.retrievalIntensity >= 75 ? "DEEP" : policy.retrievalIntensity >= 50 ? "BALANCED" : "LIGHT";
        effectiveRetrievalMode = retrievalTier;
        const standardQueries = planQueries(request, task, policy.retrievalIntensity, policy.maxRetrievalQueries);
        const targetedQueries = hypotheses.length ? planHypothesisEvidenceQueries(requestText, hypotheses, hypothesisLimits) : [];
        const planned = (targetedQueries.length ? [...targetedQueries, ...standardQueries.filter((item) => item.type !== "FOLLOWUP_QUERY")] : standardQueries).slice(0, policy.maxRetrievalQueries);
        Object.assign(retrievalMetadata, { intensity: policy.retrievalIntensity, tier: retrievalTier, plannedQueryCount: planned.length, queryIntents: planned.map((item) => ({ type: item.type, intentFingerprint: "intentFingerprint" in item ? item.intentFingerprint : safeFingerprint(item.query), hypothesisIds: "hypothesisIds" in item ? item.hypothesisIds : [], reason: "reason" in item ? item.reason : "task-derived retrieval query" })), ranking: "HYBRID_RANK_FUSION", queryMode: retrievalTier === "LIGHT" ? "SINGLE_NORMALIZED" : retrievalTier === "BALANCED" ? "MULTI_QUERY" : "ITERATIVE_MULTI_QUERY", contradictionSearch: retrievalTier === "MAX" || targetedQueries.some((item) => item.type === "HYPOTHESIS_COUNTER" || item.type === "DISCRIMINATING_EVIDENCE") });
        const rows = await this.db.oicIntelligenceKnowledge.findMany({ where: knowledgeScopeWhere(context.applicationId, context.tenantId), take: 120, orderBy: [{ sourcePriority: "desc" }, { updatedAt: "desc" }], select: { id: true, applicationId: true, tenantId: true, title: true, content: true, sourceKey: true, sourceRef: true, dependsOn: true, authority: true, sourcePriority: true, publishedAt: true, updatedAt: true, embedding: true } });
        const rowByReference = new Map(rows.map((row) => [`${row.sourceKey}\u0000${row.sourceRef}`, row.id]));
        const candidates = rows.map((row) => ({ id: row.id, title: row.title, content: row.content, source: row.sourceKey, sourceRef: row.sourceRef, trust: "RETRIEVED_UNTRUSTED" as const, authority: Math.round((row.authority * 0.65) + (row.sourcePriority * 0.35)), relevance: 0, freshness: (row.publishedAt ?? row.updatedAt).getTime(), kind: "KNOWLEDGE" as const, scope: row.tenantId ? `tenant:${row.tenantId}` : "application", applicationId: row.applicationId, tenantId: row.tenantId, embedding: row.embedding, relationship: undefined, dependsOnEvidenceIds: (Array.isArray(row.dependsOn) ? row.dependsOn : []).flatMap((dependency) => dependency && typeof dependency === "object" && !Array.isArray(dependency) && typeof dependency.sourceKey === "string" && typeof dependency.sourceRef === "string" ? [rowByReference.get(`${dependency.sourceKey}\u0000${dependency.sourceRef}`)].filter((id): id is string => Boolean(id)) : []) }));
        const knowledgeDependencyFingerprint = candidates.map((item) => `${item.id}:${item.freshness}:${JSON.stringify(item.dependsOnEvidenceIds)}`).join("|");
        const memoryDependencyFingerprint = safeFingerprint(memoryResult.evidence
          .map((item) => `${item.id}:${item.freshness}:${safeFingerprint(item.content)}`)
          .sort()
          .join("|"));
        const cacheKey = this.retrievalCache.key({ applicationId: context.applicationId, tenantId: context.tenantId, modelRevisionId: model.revisionId ?? null, profileRevisionId: policy.id, engineVersion: "hybrid-feature-rank-fusion-v1", dependencyFingerprint: `${knowledgeDependencyFingerprint}:memory:${memoryDependencyFingerprint}` }, planned.map((item) => item.query));
        const cached = this.retrievalCache.get(cacheKey);
        if (cached) {
          cacheHits++;
          Object.assign(retrievalMetadata, { cache: "HIT", queryCount: 0, candidateCount: candidates.length, selectedCount: cached.length, iterationCount: 0 });
          return cached;
        }
        cacheMisses++;
        const batchSize = policy.retrievalIntensity >= 75 ? 1 : Math.max(1, Math.min(2, planned.length));
        const selected = new Map<string, ReturnType<typeof rankEvidence>[number]>();
        let cursor = 0; let previousCount = 0; let iteration = 0;
        const iterationLimit = policy.retrievalIntensity >= 90 ? Math.min(5, policy.maxRetrievalQueries) : policy.retrievalIntensity >= 75 ? 3 : 1;
        while (cursor < planned.length && queries < policy.maxRetrievalQueries && iteration < iterationLimit && Date.now() < deadlineAt && stages.length < policy.maxStages) {
          const batch = planned.slice(cursor, cursor + batchSize); cursor += batch.length; iteration++; queries += batch.length;
          const ranked = rankEvidence(batch.map((item) => item.query), candidates, 8, this.embedder);
          for (const item of ranked) if (!selected.has(item.id) || selected.get(item.id)!.fusedScore < item.fusedScore) selected.set(item.id, item);
          const coverage = new Set([...selected.values()].flatMap((item) => item.content.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []));
          const gapsRemain = planned.slice(cursor).some((item) => item.query.toLocaleLowerCase().split(/\s+/).some((term) => term.length > 3 && !coverage.has(term)));
          const counterEvidencePending = planned.slice(cursor).some((item) => item.type === "FOLLOWUP_QUERY" || item.type === "HYPOTHESIS_COUNTER" || item.type === "DISCRIMINATING_EVIDENCE" || item.type === "INFORMATION_GAIN");
          if (iteration > 1 && selected.size <= previousCount && !counterEvidencePending) break;
          previousCount = selected.size;
          if (policy.retrievalIntensity < 75 || (!gapsRemain && !counterEvidencePending)) break;
        }
        const rankedFinal = [...selected.values()].sort((left, right) => right.fusedScore - left.fusedScore).slice(0, 8);
        const includeDependencies = (items: ReturnType<typeof rankEvidence>) => {
          const selectedIds = new Set(items.map((item) => item.id));
          const requiredIds = new Set(items.flatMap((item) => item.dependsOnEvidenceIds ?? []));
          const dependencies = candidates.filter((item) => requiredIds.has(item.id) && !selectedIds.has(item.id)).slice(0, Math.max(0, 16 - items.length)).map((item) => ({ ...item, lexicalScore: 0, semanticScore: 0, fusedScore: 0 }));
          return [...items, ...dependencies];
        };
        const final = includeDependencies(rankedFinal);
        this.retrievalCache.set(cacheKey, final);
        Object.assign(retrievalMetadata, { cache: "MISS", queryTypes: planned.slice(0, queries).map((item) => item.type), iterationCount: iteration, queryCount: queries, candidateCount: candidates.length, selectedCount: final.length, dependencyEvidenceCount: final.length - rankedFinal.length, contradictionCount: final.filter((item) => item.relationship === "CONTRADICTS").length, stopReason: cursor >= planned.length || queries >= policy.maxRetrievalQueries ? "RESOURCE_LIMIT_OR_EXHAUSTED" : "EVIDENCE_COVERAGE_OR_NO_PROGRESS" });
        return final;
      }) : [];
      const baseSelection = selectAdaptiveDepth(task, policy, policy.retrievalIntensity > 0);
      let selection = selectReasoningStrategy({ task, profile: policy, base: baseSelection, requestText, hasEvidence: memoryResult.evidence.length + knowledgeEvidence.length > 0, model });
      const evidence: OicEvidence[] = [...memoryResult.evidence, ...knowledgeEvidence];
      if (cognitiveState && depth.retrieve) {
        const retrievalTypes = Array.isArray(retrievalMetadata.queryTypes) ? retrievalMetadata.queryTypes as string[] : [];
        const retrievalMode = typeof retrievalMetadata.tier === "string" ? retrievalMetadata.tier : "retrieval";
        cognitiveState = recordControllerAction(cognitiveState, "RETRIEVE", `${retrievalMode} pass selected ${knowledgeEvidence.length} evidence items`);
        if (retrievalTypes.some((type) => ["FOLLOWUP_QUERY", "HYPOTHESIS_COUNTER"].includes(type))) cognitiveState = recordControllerAction(cognitiveState, "RETRIEVE_COUNTER_EVIDENCE", "controller issued bounded counter-evidence queries against competing explanations");
        if (retrievalTypes.includes("DISCRIMINATING_EVIDENCE")) cognitiveState = recordControllerAction(cognitiveState, "RETRIEVE_DISCRIMINATING_EVIDENCE", "controller targeted the evidence gap separating competing hypotheses");
      }
      workingMemory.recordEvidence(evidence);
      if (selection.toolDecision === "TOOL_REQUIRED" && toolCalls < policy.maxToolCalls) {
        if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "USE_TOOL", `task analyzer selected ${selection.toolKey ?? "registered deterministic tool"} as required`);
        const toolKey = selection.toolKey ?? "oic.calculator";
        const args = toolKey === "oic.unit-converter" ? unitConversionArguments(requestText) : (() => { const expression = calculatorExpression(requestText); return expression ? { expression } : null; })();
        const toolMetadata: Record<string, unknown> = { tool: toolKey, decision: selection.toolDecision, outcome: "PENDING", cache: "BYPASS" };
        const toolResult = await stage("TOOL_EXECUTION", { strategy: "registered-tool-v1", metadata: toolMetadata }, () => {
          if (!args) { toolMetadata.outcome = "NOT_INVOKED_NO_VALID_ARGUMENTS"; return null; }
          try {
            const cacheKey = this.toolCache.key({ applicationId: context.applicationId, tenantId: context.tenantId, modelRevisionId: model.revisionId ?? null, profileRevisionId: policy.id, engineVersion: `${toolKey}:v1`, dependencyFingerprint: JSON.stringify(args) }, []);
            const cached = this.toolCache.get(cacheKey);
            if (cached) { cacheHits++; toolMetadata.cache = "HIT"; toolMetadata.outcome = "SUCCEEDED"; return cached; }
            cacheMisses++; toolMetadata.cache = "MISS";
            toolCalls++;
            const value = this.tools.invoke(toolKey, args, policy.toolsIntensity > 0);
            if (value.cacheable) this.toolCache.set(cacheKey, value);
            toolMetadata.outcome = "SUCCEEDED"; return value;
          } catch (error) {
            toolMetadata.outcome = "FAILED";
            toolMetadata.failureCode = error instanceof Error && /^calculator_[a-z_]+$/.test(error.message) ? error.message : "tool_invocation_failed";
            return null;
          }
        });
        if (toolResult) {
          evidence.push({ id: `tool-${context.traceId}`, title: "Calculator result", content: toolResult.output, source: toolResult.toolKey, sourceRef: context.traceId, trust: "TOOL_TRUSTED", authority: 100, relevance: 1, freshness: Date.now(), kind: "TOOL", applicationId: context.applicationId, tenantId: context.tenantId });
          workingMemory.recordToolResult(toolResult.toolKey, context.traceId);
        }
        else if (toolMetadata.outcome === "FAILED") { uncertainty = "HIGH_UNCERTAINTY"; toolFailed = true; if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "REPLAN", "registered tool failed; controller switched to a bounded fallback strategy"); }
      }
      evidenceGraph = buildEvidenceGraph(evidence, { applicationId: context.applicationId, tenantId: context.tenantId });
      epistemicState = buildEpistemicState(evidence, evidenceGraph, task.evidenceRequired);
      const unresolvedConflicts = evidenceGraph.conflicts.filter((conflict) => conflict.unresolved !== false);
      if (unresolvedConflicts.length && configuredPolicy.reasoningIntensity >= 75 && effectiveDepth < 4) {
        effectiveDepth = 4;
        taskResolutionReasons = [...taskResolutionReasons, "retrieval surfaced unresolved contradictions; effective reasoning depth escalated to 4"];
        policy = { ...policy, reasoningIntensity: configuredPolicy.reasoningIntensity, maxCandidates: configuredPolicy.maxCandidates };
        const escalatedBase = selectAdaptiveDepth(task, policy, policy.retrievalIntensity > 0);
        selection = selectReasoningStrategy({ task, profile: policy, base: escalatedBase, requestText, hasEvidence: true, model });
        if (cognitiveState) {
          cognitiveState = { ...cognitiveState, depth: 4, budget: { ...cognitiveState.budget, candidates: policy.maxCandidates }, evidenceIds: evidence.map((item) => item.id), conflictedEvidenceIds: unresolvedConflicts.flatMap((item) => item.evidenceIds), unresolvedCount: unresolvedConflicts.length };
          cognitiveState = recordControllerAction(cognitiveState, "EXPAND_HYPOTHESES", "retrieval exposed unresolved contradictions; controller escalated to the configured reasoning ceiling");
          if (selection.candidateCount > 1) cognitiveState = recordControllerAction(cognitiveState, "GENERATE_CANDIDATE", `unresolved evidence disagreement enabled ${selection.candidateCount} independently evaluated candidates within the remaining budget`);
        }
      }
      if (hypotheses.length) {
        const hypothesisMetadata: Record<string, unknown> = {};
        hypothesisSummary = await stage("HYPOTHESIS_ASSESSMENT", { strategy: "bounded-evidence-overlap-v1", metadata: hypothesisMetadata }, () => assessHypotheses(hypotheses, evidence, evidenceGraph!));
        workingMemory.recordHypotheses(hypothesisSummary.map((item) => ({ id: item.id, assessment: item.assessment, evidenceRefs: [...item.supportingEvidenceIds, ...item.contradictingEvidenceIds] })));
        Object.assign(hypothesisMetadata, { limits: hypothesisLimits, count: hypothesisSummary.length, hypotheses: hypotheses.map(({ id, fingerprint, requiredEvidenceTypes }) => ({ id, fingerprint, requiredEvidenceTypes, initialState: "PROPOSED" })), assessments: hypothesisSummary.map(({ id, fingerprint, assessment, supportingEvidenceIds, contradictingEvidenceIds, unresolvedGaps }) => ({ id, fingerprint, state: assessment, transitions: ["PROPOSED", "UNDER_TEST", assessment], supportingEvidenceIds, contradictingEvidenceIds, unresolvedGapCount: unresolvedGaps.length })) });
        cognitiveSearch = searchHypothesisPaths(hypothesisSummary, { problemFingerprint: safeFingerprint(requestText), evidenceCount: evidence.length, limits: { maxDepth: effectiveDepth >= 4 ? 4 : 2, maxBranchFactor: hypothesisLimit, maxTotalNodes: Math.min(32, Math.max(1, policy.maxStages - stages.length)), maxProviderCalls: policy.maxProviderCalls - calls, maxWallClockTimeMs: Math.max(0, deadlineAt - Date.now()), maxBacktracks: Math.min(4, policy.maxVerificationRounds + 1), maxExpansionsWithoutProgress: Math.min(4, hypothesisLimit) } });
        if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "TEST_HYPOTHESIS", "hypotheses assessed against shared support and counter-evidence references");
        if (cognitiveState && cognitiveSearch.usage.expansions > 0) cognitiveState = recordControllerAction(cognitiveState, "SEARCH_EXPAND", `bounded search evaluated ${cognitiveSearch.usage.expansions} hypothesis branches`);
        if (hypothesisSummary.some((item) => item.assessment === "INSUFFICIENT_EVIDENCE" || item.assessment === "WEAKLY_SUPPORTED")) uncertainty = "HIGH_UNCERTAINTY";
      }
      const coverageGoals = requestText.split(/(?:\n+|[.!?;]+|\b(?:and then|then|also|compare|versus|while|because)\b)/i).map((part) => part.trim()).filter((part) => part.length >= 12);
      evidenceCoverage = buildEvidenceCoverageMatrix({ goals: coverageGoals, task, evidence, graph: evidenceGraph, hypotheses: hypothesisSummary });
      if (cognitiveState) cognitiveState = {
        ...cognitiveState,
        evidenceIds: evidence.map((item) => item.id),
        conflictedEvidenceIds: unresolvedConflicts.flatMap((item) => item.evidenceIds),
        unresolvedCount: unresolvedConflicts.length,
        epistemicState,
        constraints: evidenceCoverage.items.filter((item) => item.kind === "CONSTRAINT").map((item) => ({ id: item.id, status: item.status, evidenceIds: [...item.evidenceIds] })),
        searchParentId: cognitiveSearch?.selectedNodeId ?? null
      };
      if (cognitiveState) cognitiveState = checkpointCognitiveState(cognitiveState, safeFingerprint(`stable:${context.traceId}:${evidence.map((item) => item.id).sort().join("|")}`));
      if (cognitiveState && cognitiveSearch?.usage.backtracks && cognitiveSearch.failedStateFingerprints.length && cognitiveSearch.selectedNodeId) {
        const checkpoint = cognitiveState.checkpoints?.at(-1);
        const failedFingerprint = cognitiveSearch.failedStateFingerprints[0]!;
        if (checkpoint) {
          const before = cognitiveState.resourceUsage;
          cognitiveState = backtrackCognitiveState(cognitiveState, failedFingerprint, "bounded hypothesis search pruned a contradicted branch and selected its surviving alternate");
          backtrackCheckpointSummary = { id: checkpoint.id, problemStateRestored: cognitiveState.problem.goalFingerprints.join("|") === checkpoint.problem.goalFingerprints.join("|"), constraintsRestored: cognitiveState.constraints?.length ?? 0, epistemicFactsRestored: cognitiveState.epistemicState?.facts.length ?? 0, evidenceReferencesRestored: cognitiveState.evidenceIds.length, memorySelectionsRestored: cognitiveState.memorySelections?.length ?? 0, candidateStatesRestored: cognitiveState.candidates?.length ?? 0, resourceUsagePreserved: JSON.stringify(cognitiveState.resourceUsage) === JSON.stringify(before) };
        }
      }
      const contextMetadata: Record<string, unknown> = {};
      const compiled = await stage("CONTEXT_COMPILATION", { strategy: "priority-budget-trust-v1", metadata: contextMetadata }, () => {
        const value = compileContext(request.input, evidence, policy);
        Object.assign(contextMetadata, { originalTokenEstimate: value.originalTokenEstimate, tokenEstimate: value.tokenEstimate, categoryTokens: value.categoryTokens, truncatedCategories: value.truncatedCategories, compression: value.compression });
        return value;
      });
      contextTokens = compiled.tokenEstimate;
      contextMemoryIds = compiled.evidence.filter((item) => item.kind === "MEMORY").map((item) => item.id);
      candidateCount = selection.candidateCount;
      let result: OicRuntimeExecutionResult;
      let finalVerification: VerificationResult | undefined;
      candidateNotes = [];
      const runProvider = async (stageType: string, stageInstruction: string, extraMessages: OicRuntimeRequest["input"] = []) => stage(stageType, { strategy: selection.strategy, metadata: { strategy: selection.strategy } }, async () => {
        if (calls >= policy.maxProviderCalls) throw new Error("provider_call_budget");
        calls++;
        const uncertaintyInstruction = hypothesisSummary.some((item) => item.assessment === "WEAKLY_SUPPORTED" || item.assessment === "INSUFFICIENT_EVIDENCE") ? [{ speaker: "instruction" as const, content: [{ type: "text" as const, text: "The explicit alternatives lack consistent supporting evidence. State the uncertainty and evidence gaps; do not present an unsupported alternative as established." }] }] : [];
        const response = await this.provider.execute(model, { ...request, input: [...compiled.input, ...(stageInstruction ? [{ speaker: "instruction" as const, content: [{ type: "text" as const, text: stageInstruction }] }] : []), ...uncertaintyInstruction, ...extraMessages] }, context, signal);
        captureUsage(response); return response;
      });
      const recoveryReserve = selection.verify && policy.allowRevision ? Math.min(selection.revisionRounds, Math.max(0, policy.maxProviderCalls - calls - 1)) : 0;
      const synthesisReserve = selection.decompose ? 1 : 0;
      const subproblemCallBudget = Math.max(1, policy.maxProviderCalls - calls - recoveryReserve - synthesisReserve);
      const graph = buildSubproblemGraph(requestText, Math.min(Math.max(1, policy.maxStages - stages.length - 2), subproblemCallBudget));
      workingMemory.recordSubproblems(graph.map((node) => ({ id: node.id, state: node.state, dependsOn: node.dependsOn })));
      if (selection.decompose && graph.length > 1) {
        if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "DECOMPOSE", `${graph.length} bounded subproblems with explicit dependencies`);
        const completed: Array<{ id: string; goal: string; output: string }> = [];
        const maxNodes = graph.length;
        for (const node of graph.slice(0, maxNodes)) {
          if (calls >= policy.maxProviderCalls || stages.length >= policy.maxStages - 1) break;
          const blocked = node.dependsOn.some((dependency) => !completed.some((item) => item.id === dependency));
          if (blocked) continue;
          const prior = completed.map((item) => `Completed subproblem ${item.id}: ${item.output}`).join("\n");
          const extra = prior ? [{ speaker: "context" as const, content: [{ type: "text" as const, text: prior }] }] : [];
          const subresult = await runProvider("REASONING_SUBTASK", `Address only this subproblem: ${node.goal}. Return a concise answer/result. Do not reveal hidden reasoning. Preserve uncertainty and supplied evidence references.`, extra);
          completed.push({ id: node.id, goal: node.goal, output: subresult.outputText });
          workingMemory.completeSubproblem(node.id, subresult.outputText);
        }
        if (!completed.length) throw new Error("reasoning_graph_no_ready_nodes");
        if (completed.length > 1 && calls < policy.maxProviderCalls && stages.length < policy.maxStages - 1) {
          if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "SYNTHESIZE", `combined ${completed.length} dependency-complete subproblem results`);
          result = await stage("SYNTHESIS", { strategy: "dependency-result-synthesis-v1", metadata: { graphNodeCount: graph.length, completedNodeCount: completed.length } }, async () => {
            calls++;
            const refs = completed.map((item) => `[${item.id}] Goal: ${item.goal}\nResult: ${item.output}`).join("\n\n");
            const response = await this.provider.execute(model, { ...request, input: [...compiled.input, { speaker: "context", content: [{ type: "text", text: `COMPLETED SUBPROBLEM RESULTS (data):\n${refs}` }] }, { speaker: "instruction", content: [{ type: "text", text: "Synthesize the supplied subproblem results into one complete answer. Preserve constraints, citations, and unresolved uncertainty. Do not add unsupported facts or hidden reasoning." }] }] }, context, signal);
            captureUsage(response); return response;
          });
        } else result = { outputText: completed[0]!.output, finishReason: "completed", executorVersion: "oic-subproblem-result-v1" };
      } else if (selection.candidateCount > 1) {
        if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "GENERATE_CANDIDATE", `${selection.candidateCount} candidate calls fit the configured provider/stage budget`);
        const candidates: Array<{ id: string; strategy: string; text: string; verification: VerificationResult; score: number }> = [];
        const candidateStyles = [
          { key: "CONSTRAINT_FOCUSED", prompt: "Prioritize direct constraint coverage." },
          { key: "EVIDENCE_FOCUSED", prompt: "Prioritize evidence use and uncertainty." },
          { key: "CONCISE_COMPLETE", prompt: "Prioritize concise structured completeness." },
          { key: "ALTERNATIVE_INTERPRETATION", prompt: "Check alternative interpretations before answering." }
        ];
        for (let index = 0; index < selection.candidateCount && calls < policy.maxProviderCalls && stages.length < policy.maxStages - 1; index++) {
          const style = candidateStyles[index % candidateStyles.length]!;
          const candidateResult = await runProvider("CANDIDATE_GENERATION", `Independent answer candidate ${index + 1}; strategy=${style.key}. ${style.prompt} Answer the user's request directly. Do not expose hidden reasoning.`);
          const candidateId = `candidate-${index + 1}`;
          const diversity = deduplicateCandidates([...candidates.map((item) => ({ id: item.id, text: item.text })), { id: candidateId, text: candidateResult.outputText }]);
          if (diversity.nearDuplicatePairs.some((pair) => pair[1] === candidateId)) {
            duplicateCandidateCount++;
            candidateDiversitySummary = { planned: selection.candidateCount, evaluated: candidates.length, duplicateCount: duplicateCandidateCount, structuralFingerprints: diversity.fingerprints };
            continue;
          }
          const verified = verifyCandidate({ request: request.input, output: candidateResult.outputText, task, evidence, evidenceGraph });
          verificationPasses++;
          candidates.push({ id: candidateId, strategy: style.key, text: candidateResult.outputText, verification: verified, score: 0 });
          candidates[candidates.length - 1]!.score = scoreCandidate(candidates[candidates.length - 1]!);
          candidateDiversitySummary = { planned: selection.candidateCount, evaluated: candidates.length, duplicateCount: duplicateCandidateCount, structuralFingerprints: diversity.fingerprints };
        }
        if (!candidates.length) throw new Error("candidate_budget_exhausted");
        candidateComparison = compareCandidates(candidates.map((item) => ({ id: item.id, text: item.text, verification: item.verification, resourceCost: 1 })), policy.synthesisIntensity >= 50 && calls < policy.maxProviderCalls && stages.length < policy.maxStages - 1);
        const searchDiversity = deduplicateCandidates(candidates.map((item) => ({ id: item.id, text: item.text })));
        candidateSearch = searchCognitiveStates(candidates.map((item) => {
          const constraintFailures = item.verification.findings.filter((finding) => ["STRUCTURE", "COMPLETENESS", "TASK_COMPLETION", "INSTRUCTION_COMPLIANCE"].includes(finding.dimension) && finding.status === "FAIL");
          const evidenceFindings = item.verification.findings.filter((finding) => finding.dimension === "EVIDENCE_GROUNDING");
          return { id: item.id, kind: "CANDIDATE" as const, stateFingerprint: searchDiversity.fingerprints.find((entry) => entry.id === item.id)?.fingerprint ?? safeFingerprint(item.text), strategy: item.strategy, constraintsSatisfied: item.verification.findings.filter((finding) => finding.status === "PASS").map((finding) => finding.code).slice(0, 12), constraintStatus: constraintFailures.length ? "FAILED" as const : item.verification.status === "PASS" ? "SATISFIED" as const : "OPEN" as const, evidenceCoverage: evidenceFindings.some((finding) => finding.status === "FAIL") ? "CONFLICTED" as const : evidenceFindings.some((finding) => finding.status === "PASS") ? "ADEQUATE" as const : evidenceFindings.length ? "PARTIAL" as const : evidence.length ? "PARTIAL" as const : "NONE" as const, verificationStatus: item.verification.status === "PASS" ? "PASS" as const : item.verification.status === "FAIL" ? "FAIL" as const : "NOT_RUN" as const, resourceCost: 1, providerCalls: 0, progressScore: item.score, references: [item.id] };
        }), { problemFingerprint: safeFingerprint(requestText), limits: { maxDepth: 1, maxBranchFactor: policy.maxCandidates, maxTotalNodes: Math.min(policy.maxStages, policy.maxCandidates + 1), maxProviderCalls: Math.max(0, policy.maxProviderCalls - calls), maxWallClockTimeMs: Math.max(0, deadlineAt - Date.now()), maxBacktracks: Math.min(policy.maxVerificationRounds, policy.maxCandidates), maxExpansionsWithoutProgress: Math.min(4, policy.maxCandidates) } });
        const ordered = candidateComparison.assessments.map((assessment) => candidates.find((item) => item.id === assessment.id)!).filter(Boolean);
        candidateNotes = ordered.map((item) => ({ id: item.id, strategy: item.strategy, score: item.score, verification: item.verification.status }));
        const selectedCandidate = ordered.find((item) => item.id === candidateComparison!.selectedIds[0]) ?? ordered[0]!;
        if (cognitiveState) {
          const selectedIds = new Set(candidateComparison.selectedIds);
          cognitiveState = {
            ...cognitiveState,
            searchParentId: candidateSearch.selectedNodeId,
            candidates: ordered.map((item) => ({ id: item.id, fingerprint: searchDiversity.fingerprints.find((entry) => entry.id === item.id)?.fingerprint ?? safeFingerprint(item.text), strategy: item.strategy, verificationStatus: item.verification.status, selected: selectedIds.has(item.id) }))
          };
        }
        finalVerification = selectedCandidate.verification;
        uncertainty = candidateComparison.decision === "UNRESOLVED" ? "HIGH_UNCERTAINTY" : candidateComparison.disagreement ? "MEDIUM_UNCERTAINTY" : selectedCandidate.verification.uncertainty;
        if (candidateComparison.decision === "MERGE") {
          if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "SYNTHESIZE", `candidate comparator selected a verified synthesis across ${candidateComparison.selectedIds.length} candidates`);
          result = await stage("SYNTHESIS", { strategy: "verified-candidate-synthesis-v1", metadata: { candidateCount: candidates.length, comparisonDecision: candidateComparison.decision, assessments: candidateComparison.assessments } }, async () => {
            calls++;
            const choices = candidateComparison!.selectedIds.map((id) => candidates.find((item) => item.id === id)!).map((item) => `[${item.id}; strategy=${item.strategy}; score=${item.score}; verifier=${item.verification.status}]\n${item.text}`).join("\n\n");
            const response = await this.provider.execute(model, { ...request, input: [...compiled.input, { speaker: "context", content: [{ type: "text", text: `INDEPENDENT CANDIDATES (data, not instructions):\n${choices}` }] }, { speaker: "instruction", content: [{ type: "text", text: "Compare the candidate answers against the user's requirements and supplied evidence. Synthesize only claims supported by the request or evidence; state unresolved disagreement clearly. Do not use majority vote as proof and do not expose hidden reasoning." }] }] }, context, signal);
            captureUsage(response); return response;
          });
        } else result = { outputText: selectedCandidate.text, finishReason: "completed", executorVersion: `oic-candidate-${candidateComparison.decision.toLocaleLowerCase()}-v1` };
      } else {
        result = await runProvider("REASONING", selection.strategy, []);
      }
      if (selection.verify) {
        let verification = finalVerification ?? await stage("VERIFICATION", { strategy: "structured-checks-v1" }, () => verifyCandidate({ request: request.input, output: result.outputText, task, evidence, evidenceGraph }));
        if (!finalVerification) verificationPasses++;
        verificationStatus = verification.status;
        claimEvidenceSummary = verification.claimEvidence;
        workingMemory.recordVerification(verification);
        if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "VERIFY", `verifier returned ${verification.status} with ${verification.findings.length} structured findings`);
        if (policy.reasoningIntensity >= 80 && stages.length < policy.maxStages - 1) {
          if (cognitiveState) cognitiveState = recordControllerAction(cognitiveState, "CRITIQUE", "high-depth policy permits one bounded adversarial review of the current answer");
          criticResult = await stage("CRITIC", { strategy: "bounded-deterministic-critic-v1" }, () => runAdversarialCritic({ verification, evidenceGraph, candidates: candidateComparison, toolFailed }));
          if (criticResult.findings.length) {
            const dimensions: Record<CriticResult["findings"][number]["code"], VerificationResult["findings"][number]["dimension"]> = { REQUIREMENT_GAP: "COMPLETENESS", UNSUPPORTED_CLAIMS: "UNSUPPORTED_CLAIM", EVIDENCE_CONFLICT: "CONTRADICTION", CANDIDATE_DISAGREEMENT: "LOGICAL_CONSISTENCY", TOOL_INCONSISTENCY: "TOOL_CONSISTENCY" };
            const criticFindings = criticResult.findings.map((item) => ({ dimension: dimensions[item.code], status: "WARNING" as const, code: `critic_${item.code.toLocaleLowerCase()}`, evidenceIds: item.references }));
            verification = { ...verification, status: verification.status === "PASS" ? "PASS_WITH_WARNINGS" : verification.status, findings: [...verification.findings, ...criticFindings], uncertainty: criticResult.decision === "QUALIFY" || criticResult.decision === "REVISE" ? "HIGH_UNCERTAINTY" : verification.uncertainty };
            verificationStatus = verification.status;
            workingMemory.recordVerification(verification);
          }
        }
        if (cognitiveState) {
          cognitiveState = {
            ...cognitiveState,
            epistemicState,
            constraints: verification.findings.filter((finding) => ["STRUCTURE", "COMPLETENESS", "TASK_COMPLETION", "INSTRUCTION_COMPLIANCE", "EVIDENCE_GROUNDING"].includes(finding.dimension)).map((finding) => ({ id: finding.code, status: finding.status === "PASS" ? "SUPPORTED" : finding.status === "WARNING" ? "PARTIAL" : "CONFLICTED", evidenceIds: [...finding.evidenceIds] })),
            resourceUsage: { stages: stages.length, providerCalls: calls, retrievalQueries: queries, memoryReads: memoryLookups, toolCalls, verificationRounds: verificationPasses, repairRounds: revisions, backtracks: cognitiveState.actions.filter((item) => item.action === "BACKTRACK").length }
          };
          cognitiveState = checkpointCognitiveState(cognitiveState, safeFingerprint(`verified-candidate:${context.traceId}:${result.executorVersion ?? "candidate"}:${safeFingerprint(result.outputText)}`));
        }
        let previousFindingSignature: string | null = null;
        let lastStableResult = result;
        for (let round = 0; round < selection.revisionRounds && createRevisionInstruction(verification) && calls < policy.maxProviderCalls; round++) {
          const findingSignature = verification.findings.map((finding) => `${finding.dimension}:${finding.code}`).sort().join("|");
          const stagnated = previousFindingSignature !== null && findingSignature === previousFindingSignature;
          if (cognitiveState && stagnated) cognitiveState = { ...cognitiveState, repeatedFindingCount: cognitiveState.repeatedFindingCount + 1 };
          const controllerDecision = chooseNextAction({ state: cognitiveState!, signals: { hardConstraintsOpen: verification.findings.filter((finding) => finding.status === "FAIL").length, uncertainty: verification.uncertainty.replace("_UNCERTAINTY", "") as "LOW" | "MEDIUM" | "HIGH", evidenceCoverage: evidenceCoverage?.summary.overall ?? epistemicState?.coverage ?? (task.evidenceRequired ? "NONE" : "ADEQUATE"), incomplete: verification.status !== "PASS", candidateDisagreement: candidateComparison?.disagreement ?? false, verifierBlocking: verification.status === "REVISE" || verification.status === "FAIL", recentProgress: !stagnated, budgetAvailable: !stagnated && calls < policy.maxProviderCalls && round < selection.revisionRounds }, candidateCount, maxCandidates: policy.maxCandidates, counterEvidenceAttempted: Array.isArray(retrievalMetadata.queryTypes) && (retrievalMetadata.queryTypes as string[]).some((type) => ["FOLLOWUP_QUERY", "HYPOTHESIS_COUNTER", "DISCRIMINATING_EVIDENCE"].includes(type)) });
          if (cognitiveState) cognitiveState = stagnated
            ? backtrackCognitiveState({ ...cognitiveState, resourceUsage: { stages: stages.length, providerCalls: calls, retrievalQueries: queries, memoryReads: memoryLookups, toolCalls, verificationRounds: verificationPasses, repairRounds: revisions, backtracks: cognitiveState.actions.filter((item) => item.action === "BACKTRACK").length } }, safeFingerprint(`${result.executorVersion ?? "candidate"}:${findingSignature}`), "repeated verifier findings exhausted repair value; returned to the last stable answer")
            : recordControllerAction(cognitiveState, controllerDecision.action, controllerDecision.reason, cognitiveState.strategy, controllerDecision.value);
          if (stagnated || controllerDecision.action === "STOP") { if (stagnated) result = lastStableResult; stopReason = "NO_USEFUL_PROGRESS"; break; }
          if (controllerDecision.action !== "REPAIR") break;
          const instruction = createRevisionInstruction(verification)!;
          result = await stage("REVISION", { strategy: "targeted-revision-v1", metadata: { round: round + 1, findingCodes: verification.findings.map((finding) => finding.code) } }, async () => {
            calls++;
            const response = await this.provider.execute(model, { ...request, input: [...compiled.input, { speaker: "instruction", content: [{ type: "text", text: instruction }] }, { speaker: "assistant", content: [{ type: "text", text: result.outputText }] }] }, context, signal);
            captureUsage(response); return response;
          });
          revisions++;
          verification = await stage("VERIFICATION", { strategy: "structured-checks-v1", metadata: { round: round + 1 } }, () => verifyCandidate({ request: request.input, output: result.outputText, task, evidence, evidenceGraph }));
          verificationPasses++;
          verificationStatus = verification.status;
          claimEvidenceSummary = verification.claimEvidence;
          workingMemory.recordVerification(verification);
          previousFindingSignature = findingSignature;
          if (verification.status === "PASS") lastStableResult = result;
          if (chooseStop({ budget: { maxStages: policy.maxStages, maxProviderCalls: policy.maxProviderCalls, maxQueries: Math.max(1, policy.maxRetrievalQueries), deadlineAt, startedAt }, stageCount: stages.length, providerCalls: calls, queryCount: queries, verification, evidenceCount: evidence.length })) break;
        }
        finalVerification = verification;
      }
      if (uncertainty === "LOW_UNCERTAINTY" && (memoryResult.conflictCount > 0 || knowledgeEvidence.some((item) => item.relationship === "CONTRADICTS"))) uncertainty = "HIGH_UNCERTAINTY";
      if (finalVerification && finalVerification.uncertainty !== "LOW_UNCERTAINTY") uncertainty = finalVerification.uncertainty;
      const policyStopReason = chooseStop({ budget: { maxStages: policy.maxStages, maxProviderCalls: policy.maxProviderCalls, maxQueries: Math.max(1, policy.maxRetrievalQueries), deadlineAt, startedAt }, stageCount: stages.length, providerCalls: calls, queryCount: queries, verification: finalVerification, evidenceCount: evidence.length });
      if (stopReason !== "NO_USEFUL_PROGRESS") stopReason = policyStopReason ?? (Date.now() >= deadlineAt ? "TIME_LIMIT" : "SUCCESS");
      if (stopReason !== "NO_USEFUL_PROGRESS" && uncertainty === "HIGH_UNCERTAINTY" && (evidenceGraph?.conflicts.some((conflict) => conflict.unresolved !== false) || toolFailed || hypothesisSummary.some((item) => item.assessment === "WEAKLY_SUPPORTED" || item.assessment === "INSUFFICIENT_EVIDENCE"))) stopReason = "UNRESOLVED_UNCERTAINTY";
      if (cognitiveState) {
        cognitiveState = recordControllerAction(cognitiveState, "STOP", `stop policy selected ${stopReason}`);
        cognitiveState = stopCognitiveState(cognitiveState);
      }
      if (policy.allowMemoryWrites) {
        const writeMetadata: Record<string, unknown> = { selectedMemoryIds: memorySelection.map((item) => item.id) };
        await stage("MEMORY_WRITE_DECISION", { strategy: "conservative-explicit-consent-v1", metadata: writeMetadata }, async () => {
          let memoryWrite = await this.memories.writeExplicitCandidate(request, context, policy, context.traceId);
          if (memoryWrite.decision === "WORKING_ONLY") {
            const selectedStrategy = stages.find((item) => ["REASONING", "REASONING_SUBTASK", "CANDIDATE_GENERATION"].includes(item.stageType))?.strategy ?? "DIRECT";
            memoryWrite = await this.memories.writeExecutionEpisode({ context, profile: policy, traceId: context.traceId, task, strategy: selectedStrategy, verificationStatus, uncertainty, providerCalls: calls, toolCalls, retrievalQueries: queries, memoryReads: memoryLookups, stageTypes: stages.map((item) => item.stageType), durationMs: Date.now() - startedAt });
            const candidate = await this.memories.writeProceduralCandidate({ context, profile: policy, traceId: context.traceId, task, strategy: selectedStrategy, verificationStatus, uncertainty });
            Object.assign(writeMetadata, { proceduralCandidate: candidate.decision, proceduralCandidateKind: candidate.kind ?? null });
          }
          Object.assign(writeMetadata, { decision: memoryWrite.decision, kind: memoryWrite.kind ?? null });
          return memoryWrite;
        });
      }
      status = "SUCCEEDED";
      return result;
    } catch (error) {
      status = signal?.aborted ? "CANCELLED" : "FAILED";
      throw error;
    } finally {
      const finishedAt = new Date();
      await this.db.$transaction(async (tx) => {
        for (const [index, item] of stages.entries()) await tx.oicIntelligenceExecutionStage.create({ data: { executionId: execution.id, stageIndex: index, ...item } });
        const actualStrategy = stages.find((item) => ["REASONING", "REASONING_SUBTASK", "CANDIDATE_GENERATION"].includes(item.stageType))?.strategy ?? "DIRECT";
        const cognitiveActions = cognitiveState?.actions ?? [];
        const supportedClaimEvidenceIds = (claimEvidenceSummary?.claims ?? []).filter((claim) => claim.status === "SUPPORTED").flatMap((claim) => claim.evidenceIds);
        const conflictSignals = (evidenceGraph?.conflicts ?? []).flatMap((conflict) => conflict.unresolved === false ? [] : conflict.evidenceIds.flatMap((memoryId) => memorySelection.some((item) => item.id === memoryId) ? conflict.evidenceIds.filter((otherId) => otherId !== memoryId).map((otherEvidenceId) => ({ memoryId, otherEvidenceId })) : []));
        const supersessionSignals = (evidenceGraph?.edges ?? []).filter((edge) => edge.relation === "SUPERSEDES" && memorySelection.some((item) => item.id === edge.to)).map((edge) => ({ memoryId: edge.to, otherEvidenceId: edge.from }));
        const memoryUtility = assessMemoryUtility({ selected: memorySelection.map((item) => ({ id: item.id })), contextMemoryIds, supportedClaimEvidenceIds, conflicts: [...conflictSignals, ...supersessionSignals], verificationStatus, revisions });
        await tx.oicIntelligenceExecution.update({ where: { id: execution.id }, data: {
          status, strategy: actualStrategy, taskType: task.taskType, uncertainty, stageCount: stages.length, providerCallCount: calls,
          inputTokens: inputUsageKnown ? inputTokens : null, outputTokens: outputUsageKnown ? outputTokens : null,
          retrievalQueryCount: queries, memoryLookupCount: memoryLookups, contextTokens, verificationStatus, completedAt: finishedAt,
          summary: {
            durationMs: finishedAt.getTime() - startedAt, bounded: true, stageTypes: stages.map((item) => item.stageType),
            workingMemory: workingMemory.snapshot(), problemModel, epistemicState, evidenceGraph, evidenceCoverage, memoryPlan: memoryPlanSummary, memoryFusion: memoryFusionSummary, memoryUtility,
            cognitiveKernel: {
              depth: effectiveDepth, depthReasons: taskResolutionReasons, strategy: cognitiveState?.strategy ?? actualStrategy,
              previousStrategies: cognitiveState?.previousStrategies ?? [], actions: cognitiveActions,
              controllerTransitions: cognitiveActions.map((item) => ({ from: item.fromStrategy, to: item.strategy, action: item.action, reason: item.reason, effectiveDepth: item.depth, budgetImpact: { resourceUsage: item.resourceUsage, budgetRemaining: item.budgetRemaining } })),
              strategyTransitions: cognitiveActions.filter((item) => item.fromStrategy !== item.strategy).map((item) => ({ from: item.fromStrategy, to: item.strategy, action: item.action, reason: item.reason, effectiveDepth: item.depth, budgetImpact: { resourceUsage: item.resourceUsage, budgetRemaining: item.budgetRemaining } })),
              checkpointCount: cognitiveState?.checkpoints?.length ?? 0, failedPathFingerprints: cognitiveState?.failedPathFingerprints ?? [], backtrackCheckpoint: backtrackCheckpointSummary,
              budget: { limits: cognitiveState?.budget ?? null, used: { stages: stages.length, providerCalls: calls, candidates: candidateCount, retrievalRounds: queries, verificationRounds: verificationPasses, repairRounds: revisions, backtracks: cognitiveActions.filter((item) => item.action === "BACKTRACK").length, toolCalls } }
            },
            cognitiveSignature: {
              profileRevision: policy.id, taskClass: `${task.taskType}:${Math.floor(task.complexity / 20) * 20}`, taskFingerprint: safeFingerprint(requestText),
              effectiveDepth, strategies: [...new Set(cognitiveActions.map((item) => item.strategy))], memoryModes: [...new Set(memorySelection.map((item) => item.kind))],
              retrievalMode: effectiveRetrievalMode, candidateCount, criticUsed: criticResult !== null,
              verificationRounds: verificationPasses, backtracks: cognitiveActions.filter((item) => item.action === "BACKTRACK").length, stopReason
            },
            hypotheses: hypothesisSummary.map(({ id, fingerprint, assessment, supportingEvidenceIds, contradictingEvidenceIds, unresolvedGaps }) => ({ id, fingerprint, state: assessment, transitions: ["PROPOSED", "UNDER_TEST", assessment], assessment, supportingEvidenceIds, contradictingEvidenceIds, unresolvedGapCount: unresolvedGaps.length })), cognitiveSearch,
            claimEvidence: claimEvidenceSummary ?? null, critic: criticResult, memorySelection, candidateCount, candidateNotes, candidateComparison, candidateDiversity: candidateDiversitySummary, candidateSearch,
            toolCalls, cacheHits, cacheMisses, verificationPasses, revisions, stopReason, streamingMode: "BUFFERED_VERIFIED",
            usageAccounting: { inputTokens: inputUsageKnown ? inputTokens : "UNKNOWN", outputTokens: outputUsageKnown ? outputTokens : "UNKNOWN" },
            effectiveProfile: {
              requestedProfileKey: policy.profileKey, resolvedRevisionId: policy.id, revision: policy.revision, taskType: task.taskType, strategy: actualStrategy,
              budgets: { maxStages: policy.maxStages, maxProviderCalls: policy.maxProviderCalls, maxRetrievalQueries: policy.maxRetrievalQueries, maxMemoryItems: policy.maxMemoryItems, maxToolCalls: policy.maxToolCalls, maxCandidates: policy.maxCandidates, maxExecutionMs: policy.maxExecutionMs },
              intensity: { context: policy.contextIntensity, memory: policy.memoryIntensity, retrieval: policy.retrievalIntensity, reasoning: policy.reasoningIntensity, tools: policy.toolsIntensity, verification: policy.verificationIntensity, synthesis: policy.synthesisIntensity, efficiency: policy.efficiencyIntensity },
              capabilityCeilings: { memory: configuredPolicy.memoryIntensity, retrieval: configuredPolicy.retrievalIntensity, reasoning: configuredPolicy.reasoningIntensity, verification: configuredPolicy.verificationIntensity },
              modelCapabilities: model.capabilities, capabilityAdjustments: taskResolutionReasons
            }
          }
        } });
      }).catch(() => undefined);
    }
  }

  async *stream(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): AsyncIterable<OicRuntimeExecutionStreamChunk> {
    const result = await this.execute(model, request, context, signal);
    if (result.outputText) yield { type: "content.delta", text: result.outputText };
    if (result.usage) yield { type: "usage.updated", usage: result.usage };
  }
}
