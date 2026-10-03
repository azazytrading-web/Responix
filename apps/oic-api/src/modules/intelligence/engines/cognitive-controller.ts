import type { OicIntelligenceProfilePolicy } from "@oic/contracts";
import type { TaskAnalysis } from "./types";

export type CognitiveDepth = 0 | 1 | 2 | 3 | 4 | 5;
export type CognitiveAction = "DIRECT_EXECUTION" | "ANALYZE_TASK" | "DECOMPOSE" | "RECALL_MEMORY" | "RETRIEVE" | "RETRIEVE_COUNTER_EVIDENCE" | "RETRIEVE_DISCRIMINATING_EVIDENCE" | "EXPAND_HYPOTHESES" | "GENERATE_HYPOTHESES" | "TEST_HYPOTHESIS" | "GENERATE_CANDIDATE" | "GENERATE_ALTERNATIVE" | "SEARCH_EXPAND" | "USE_TOOL" | "VERIFY" | "CRITIQUE" | "REPAIR" | "BACKTRACK" | "REPLAN" | "SYNTHESIZE" | "STOP";
export type ComputeValue = "STOP_NOW" | "LOW_VALUE_CONTINUE" | "CONTINUE" | "HIGH_VALUE_CONTINUE";
export type StrategyName = "DIRECT" | "DECOMPOSE_AND_SOLVE" | "PLAN_EXECUTE" | "EVIDENCE_FIRST" | "HYPOTHESIS_TEST" | "CONSTRAINT_DRIVEN" | "MULTI_CANDIDATE" | "COUNTERFACTUAL" | "VERIFY_REPAIR" | "ITERATIVE_REFINEMENT" | "BOUNDED_SEARCH";
export type CognitiveActionRecord = { action: CognitiveAction; reason: string; fromStrategy: StrategyName; depth: CognitiveDepth; strategy: StrategyName; stageIndex: number; resourceUsage: CognitiveResourceUsage; budgetRemaining: Omit<CognitiveBudget, "deadlineAt">; valueOfCompute?: ComputeValue };
export type CognitiveProblem = {
  taskType: TaskAnalysis["taskType"];
  goalCount: number;
  goalFingerprints: string[];
  constraintCount: number;
  constraintKinds: string[];
  requiresEvidence: boolean;
  requiresTool: boolean;
  completionConditions: string[];
  ambiguity: "LOW" | "MEDIUM" | "HIGH";
  hallucinationRisk: "LOW" | "MEDIUM" | "HIGH";
};
export type EpistemicState = { facts: Array<{ id: string; fingerprint: string; status: "KNOWN" | "SUPPORTED" | "ASSUMED" | "INFERRED" | "UNKNOWN" | "CONFLICTED" | "SUPERSEDED" | "UNVERIFIED"; evidenceId: string; trust: string; freshness: number }>; coverage: "NONE" | "PARTIAL" | "ADEQUATE" | "CONFLICTED"; unresolvedCount: number; missingEvidenceCount: number };
export type CognitiveBudget = { stages: number; providerCalls: number; candidates: number; retrievalRounds: number; verificationRounds: number; repairRounds: number; backtracks: number; toolCalls: number; deadlineAt: number };
export type CognitiveConstraintState = { id: string; status: "NO_EVIDENCE" | "PARTIAL" | "SUPPORTED" | "CONFLICTED"; evidenceIds: string[] };
export type CognitiveCandidateState = { id: string; fingerprint: string; strategy: string; verificationStatus: "NOT_RUN" | "PASS" | "PASS_WITH_WARNINGS" | "REVISE" | "FAIL"; selected: boolean };
export type CognitiveResourceUsage = { stages: number; providerCalls: number; retrievalQueries: number; memoryReads: number; toolCalls: number; verificationRounds: number; repairRounds: number; backtracks: number };
export type CognitiveCheckpoint = {
  id: string;
  problem: CognitiveProblem;
  epistemicState: EpistemicState | null;
  strategy: StrategyName;
  previousStrategies: StrategyName[];
  depth: CognitiveDepth;
  evidenceIds: string[];
  conflictedEvidenceIds: string[];
  unresolvedCount: number;
  memorySelections: Array<{ id: string; kind: string; score: number; reason: string }>;
  constraints: CognitiveConstraintState[];
  searchParentId: string | null;
  candidates: CognitiveCandidateState[];
  actionIndex: number;
};
export type CognitiveExecutionState = {
  problem: CognitiveProblem;
  depth: CognitiveDepth;
  strategy: StrategyName;
  previousStrategies: StrategyName[];
  actions: CognitiveActionRecord[];
  evidenceIds: string[];
  conflictedEvidenceIds: string[];
  unresolvedCount: number;
  repeatedFindingCount: number;
  budget: CognitiveBudget;
  checkpoints?: CognitiveCheckpoint[];
  failedPathFingerprints?: string[];
  epistemicState?: EpistemicState | null;
  memorySelections?: Array<{ id: string; kind: string; score: number; reason: string }>;
  constraints?: CognitiveConstraintState[];
  searchParentId?: string | null;
  candidates?: CognitiveCandidateState[];
  resourceUsage?: CognitiveResourceUsage;
  stop: "RUNNING" | "STOPPED";
};
export type ComputeSignals = { hardConstraintsOpen: number; uncertainty: "LOW" | "MEDIUM" | "HIGH"; evidenceCoverage: "NONE" | "PARTIAL" | "ADEQUATE" | "CONFLICTED"; incomplete: boolean; candidateDisagreement: boolean; verifierBlocking: boolean; recentProgress: boolean; budgetAvailable: boolean };

/** Configured intensities are ceilings. Current task complexity determines the effective capability used. */
export function resolveTaskPolicy<T extends OicIntelligenceProfilePolicy>(profile: T, task: TaskAnalysis, memoryRelevant = false): { policy: T; depth: CognitiveDepth; reasons: string[] } {
  const trivial = task.complexity < 25 && task.subtaskCount === 1 && !task.evidenceRequired && !task.structuredOutput && task.uncertainty === "LOW_UNCERTAINTY" && !memoryRelevant;
  const depth: CognitiveDepth = trivial ? 0 : memoryRelevant ? 1 : task.evidenceRequired ? profile.reasoningIntensity >= 85 && task.complexity >= 65 || task.uncertainty === "HIGH_UNCERTAINTY" ? 4 : 3 : task.complexity >= 70 ? 4 : task.complexity >= 45 ? 2 : task.complexity >= 25 ? 1 : 0;
  const reasoningCap = depth === 0 ? 15 : depth === 1 ? 25 : depth === 2 ? 50 : depth === 3 ? 75 : depth === 4 ? 100 : 100;
  const effective = {
    ...profile,
    memoryIntensity: trivial ? 0 : profile.memoryIntensity,
    retrievalIntensity: trivial ? 0 : profile.retrievalIntensity,
    reasoningIntensity: Math.min(profile.reasoningIntensity, reasoningCap),
    verificationIntensity: trivial && !task.structuredOutput ? Math.min(profile.verificationIntensity, 10) : profile.verificationIntensity,
    maxCandidates: depth >= 4 ? profile.maxCandidates : 1,
    ...(trivial ? { maxProviderCalls: 1, maxStages: Math.min(profile.maxStages, 4), maxRetrievalQueries: 0, maxMemoryItems: 0, maxVerificationRounds: 0, allowRevision: false } : {})
  } as T;
  return { policy: effective, depth, reasons: trivial ? ["simple task has no evidence, ambiguity, or multiple deliverables; optional cognitive stages are suppressed"] : [`task requirements resolved to depth ${depth}; profile settings remain capability ceilings`] };
}

export function planMemoryKinds(input: { task: TaskAnalysis; requestText: string; hasSession: boolean; eligibleKinds: string[] }): { kinds: string[]; reasons: string[] } {
  const text = input.requestText.toLocaleLowerCase();
  const planned = new Set<string>();
  const reasons: string[] = [];
  if (input.hasSession && (input.task.taskType === "SIMPLE_FACTUAL" || input.task.taskType === "CONVERSATION" || /\b(previous|earlier|remember|continue|we discussed|our session)\b/.test(text))) { planned.add("SESSION"); reasons.push("session context may contain a task-relevant current fact"); }
  if (/\b(previous execution|last time|similar incident|prior case|what happened before)\b/.test(text)) { planned.add("EPISODIC"); reasons.push("task asks for a comparable prior execution"); }
  if (/\b(what do we know|known fact|approved fact|remember that|stored fact)\b/.test(text)) { planned.add("SEMANTIC"); reasons.push("task asks for a durable known fact"); }
  if (/\b(application rule|our application|app-specific|operating policy|approved preference)\b/.test(text)) { planned.add("APPLICATION"); reasons.push("task asks for an application-scoped rule or preference"); }
  if (/\b(approved method|standard procedure|how do we|how should we|runbook|workflow)\b/.test(text)) { planned.add("PROCEDURAL"); reasons.push("task asks for an approved reusable method"); }
  const kinds = input.eligibleKinds.filter((kind) => planned.has(kind));
  return { kinds, reasons: reasons.length ? reasons : ["no request signal justifies a persistent-memory lookup"] };
}

export function buildCognitiveProblem(task: TaskAnalysis, input: { goals: string[]; requiresTool: boolean }): CognitiveProblem {
  const completionConditions = ["deliverable_present", ...(task.structuredOutput ? ["requested_structure_valid"] : []), ...(task.evidenceRequired ? ["required_evidence_grounded"] : []), ...(input.requiresTool ? ["deterministic_tool_consistent"] : []), ...(task.subtaskCount > 1 ? ["all_detected_goals_addressed"] : [])];
  const constraintKinds = [...(task.structuredOutput ? ["OUTPUT_STRUCTURE"] : []), ...(task.evidenceRequired ? ["EVIDENCE_GROUNDING"] : []), ...(input.requiresTool ? ["TOOL_RESULT"] : []), ...(task.uncertainty !== "LOW_UNCERTAINTY" ? ["UNCERTAINTY_DISCLOSURE"] : [])];
  const ambiguity = task.uncertainty === "HIGH_UNCERTAINTY" ? "HIGH" : task.uncertainty === "MEDIUM_UNCERTAINTY" ? "MEDIUM" : "LOW";
  const hallucinationRisk = task.evidenceRequired || task.uncertainty !== "LOW_UNCERTAINTY" ? "HIGH" : task.complexity >= 50 ? "MEDIUM" : "LOW";
  return { taskType: task.taskType, goalCount: Math.max(1, Math.min(8, input.goals.length)), goalFingerprints: input.goals.slice(0, 8).map(safeFingerprint), constraintCount: constraintKinds.length, constraintKinds, requiresEvidence: task.evidenceRequired, requiresTool: input.requiresTool, completionConditions, ambiguity, hallucinationRisk };
}

export function buildEpistemicState(evidence: Array<{ id: string; title: string; sourceRef: string; trust: string; freshness: number }>, graph: { conflicts: Array<{ evidenceIds: [string, string]; unresolved?: boolean }>; edges?: Array<{ from: string; to: string; relation: string }> }, requiresEvidence: boolean): EpistemicState {
  const unresolved = graph.conflicts.filter((conflict) => conflict.unresolved !== false);
  const conflicted = new Set(unresolved.flatMap((conflict) => conflict.evidenceIds));
  const superseded = new Set((graph.edges ?? []).filter((edge) => edge.relation === "SUPERSEDES").map((edge) => edge.to));
  const superseders = new Set((graph.edges ?? []).filter((edge) => edge.relation === "SUPERSEDES").map((edge) => edge.from));
  const dependencyAffected = new Set((graph.edges ?? []).filter((edge) => edge.relation === "DEPENDS_ON" && (conflicted.has(edge.to) || superseded.has(edge.to))).map((edge) => edge.from));
  const facts = evidence.map((item) => ({ id: `fact-${item.id}`, fingerprint: safeFingerprint(`${item.title}:${item.sourceRef}`), status: superseded.has(item.id) ? "SUPERSEDED" as const : superseders.has(item.id) ? "SUPPORTED" as const : conflicted.has(item.id) ? "CONFLICTED" as const : dependencyAffected.has(item.id) ? "UNVERIFIED" as const : item.trust === "TOOL_TRUSTED" ? "KNOWN" as const : "UNVERIFIED" as const, evidenceId: item.id, trust: item.trust, freshness: item.freshness }));
  const coverage = unresolved.length ? "CONFLICTED" : !facts.length && requiresEvidence ? "NONE" : facts.length && requiresEvidence ? "ADEQUATE" : facts.length ? "PARTIAL" : "ADEQUATE";
  return { facts, coverage, unresolvedCount: unresolved.length, missingEvidenceCount: !facts.length && requiresEvidence ? 1 : 0 };
}

export function safeFingerprint(value: string): string {
  // Stable compact trace reference; input text itself is never returned.
  let hash = 2166136261;
  for (const character of value.toLocaleLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function recordCognitiveAction(state: CognitiveExecutionState, action: CognitiveAction, reason: string, strategy = state.strategy, value?: ComputeValue): CognitiveExecutionState {
  if (state.stop === "STOPPED") return state;
  const transition = transitionStrategy(state.strategy, action);
  const nextStrategy = transition?.strategy ?? strategy;
  const strategies = nextStrategy === state.strategy ? state.previousStrategies : [...state.previousStrategies, state.strategy];
  const resourceUsage = state.resourceUsage ?? { stages: 0, providerCalls: 0, retrievalQueries: 0, memoryReads: 0, toolCalls: 0, verificationRounds: 0, repairRounds: 0, backtracks: 0 };
  const remaining = (ceiling: number, used: number) => Math.max(0, ceiling - used);
  const budgetRemaining = { stages: remaining(state.budget.stages, resourceUsage.stages), providerCalls: remaining(state.budget.providerCalls, resourceUsage.providerCalls), candidates: state.budget.candidates, retrievalRounds: remaining(state.budget.retrievalRounds, resourceUsage.retrievalQueries), verificationRounds: remaining(state.budget.verificationRounds, resourceUsage.verificationRounds), repairRounds: remaining(state.budget.repairRounds, resourceUsage.repairRounds), backtracks: remaining(state.budget.backtracks, resourceUsage.backtracks), toolCalls: remaining(state.budget.toolCalls, resourceUsage.toolCalls) };
  const record: CognitiveActionRecord = { action, reason: transition?.reason ?? reason, fromStrategy: state.strategy, depth: state.depth, strategy: nextStrategy, stageIndex: state.actions.length, resourceUsage: { ...resourceUsage }, budgetRemaining, ...(value ? { valueOfCompute: value } : {}) };
  return { ...state, strategy: nextStrategy, previousStrategies: strategies.slice(-8), actions: [...state.actions, record] };
}

export function stopCognitiveState(state: CognitiveExecutionState): CognitiveExecutionState { return { ...state, stop: "STOPPED" }; }

/** Saves only structured controller state; checkpoints never contain prompts or model reasoning. */
export function checkpointCognitiveState(state: CognitiveExecutionState, id: string): CognitiveExecutionState {
  const checkpoints = state.checkpoints ?? [];
  if (checkpoints.some((checkpoint) => checkpoint.id === id)) return state;
  const checkpoint: CognitiveCheckpoint = {
    id,
    problem: { ...state.problem, goalFingerprints: [...state.problem.goalFingerprints], constraintKinds: [...state.problem.constraintKinds], completionConditions: [...state.problem.completionConditions] },
    epistemicState: state.epistemicState ? { ...state.epistemicState, facts: state.epistemicState.facts.map((fact) => ({ ...fact })) } : null,
    strategy: state.strategy,
    previousStrategies: [...state.previousStrategies],
    depth: state.depth,
    evidenceIds: [...state.evidenceIds],
    conflictedEvidenceIds: [...state.conflictedEvidenceIds],
    unresolvedCount: state.unresolvedCount,
    memorySelections: (state.memorySelections ?? []).map((memory) => ({ ...memory })),
    constraints: (state.constraints ?? []).map((constraint) => ({ ...constraint, evidenceIds: [...constraint.evidenceIds] })),
    searchParentId: state.searchParentId ?? null,
    candidates: (state.candidates ?? []).map((candidate) => ({ ...candidate })),
    actionIndex: state.actions.length
  };
  return { ...state, checkpoints: [...checkpoints, checkpoint].slice(-4) };
}

/** Restores stable epistemic/controller fields but keeps spent budgets and the complete action history. */
export function backtrackCognitiveState(state: CognitiveExecutionState, failedFingerprint: string, reason: string, maximum = state.budget.backtracks): CognitiveExecutionState {
  const failed = state.failedPathFingerprints ?? [];
  const used = state.actions.filter((item) => item.action === "BACKTRACK").length;
  const checkpoint = state.checkpoints?.at(-1);
  if (state.stop === "STOPPED" || !checkpoint || used >= maximum || failed.includes(failedFingerprint)) return state;
  const restored: CognitiveExecutionState = {
    ...state,
    depth: checkpoint.depth,
    strategy: checkpoint.strategy,
    problem: { ...checkpoint.problem, goalFingerprints: [...checkpoint.problem.goalFingerprints], constraintKinds: [...checkpoint.problem.constraintKinds], completionConditions: [...checkpoint.problem.completionConditions] },
    previousStrategies: [...checkpoint.previousStrategies],
    evidenceIds: [...checkpoint.evidenceIds],
    conflictedEvidenceIds: [...checkpoint.conflictedEvidenceIds],
    unresolvedCount: checkpoint.unresolvedCount,
    epistemicState: checkpoint.epistemicState ? { ...checkpoint.epistemicState, facts: checkpoint.epistemicState.facts.map((fact) => ({ ...fact })) } : null,
    memorySelections: checkpoint.memorySelections.map((memory) => ({ ...memory })),
    constraints: checkpoint.constraints.map((constraint) => ({ ...constraint, evidenceIds: [...constraint.evidenceIds] })),
    searchParentId: checkpoint.searchParentId,
    candidates: checkpoint.candidates.map((candidate) => ({ ...candidate })),
    failedPathFingerprints: [...failed, failedFingerprint].slice(-16)
  };
  return recordCognitiveAction(restored, "BACKTRACK", `${reason}; restored checkpoint ${checkpoint.id} and excluded failed path`, "PLAN_EXECUTE");
}

export function valueOfCompute(signals: ComputeSignals): ComputeValue {
  if (!signals.budgetAvailable || (!signals.incomplete && signals.hardConstraintsOpen === 0 && signals.evidenceCoverage === "ADEQUATE" && !signals.verifierBlocking && !signals.candidateDisagreement)) return "STOP_NOW";
  if (signals.recentProgress && (signals.hardConstraintsOpen > 0 || signals.uncertainty === "HIGH" || signals.evidenceCoverage === "NONE" || signals.evidenceCoverage === "CONFLICTED" || signals.verifierBlocking)) return "HIGH_VALUE_CONTINUE";
  if (!signals.recentProgress && (signals.uncertainty === "LOW" || signals.evidenceCoverage === "ADEQUATE") && !signals.verifierBlocking) return "LOW_VALUE_CONTINUE";
  return "CONTINUE";
}

export function detectStagnation(history: CognitiveActionRecord[], current: Omit<CognitiveActionRecord, "stageIndex">): boolean {
  const recent = history.slice(-3);
  if (recent.length < 2) return false;
  const repeats = recent.filter((item) => item.action === current.action && item.reason === current.reason).length;
  return repeats >= 2 && recent.every((item) => item.strategy === current.strategy);
}

export function chooseNextAction(input: { state: CognitiveExecutionState; signals: ComputeSignals; candidateCount: number; maxCandidates: number; counterEvidenceAttempted: boolean }): { action: CognitiveAction; reason: string; value: ComputeValue } {
  if (input.state.stop === "STOPPED") return { action: "STOP", reason: "execution is terminal", value: "STOP_NOW" };
  const value = valueOfCompute(input.signals);
  if (value === "STOP_NOW") return { action: "STOP", reason: "completion conditions are met or cognitive budget is exhausted", value };
  if (!input.signals.recentProgress && input.state.repeatedFindingCount > 0) return { action: "STOP", reason: "the same blocking findings repeated without measurable progress", value: "LOW_VALUE_CONTINUE" };
  if (input.signals.verifierBlocking) return { action: "REPAIR", reason: "blocking verifier finding remains and repair budget is available", value };
  if (input.signals.evidenceCoverage === "CONFLICTED" && !input.counterEvidenceAttempted) return { action: "RETRIEVE_COUNTER_EVIDENCE", reason: "evidence conflicts and no counter-evidence pass has been attempted", value };
  if (input.signals.evidenceCoverage === "NONE" && input.state.problem.requiresEvidence) return { action: "RETRIEVE", reason: "required evidence has no coverage", value };
  if (input.signals.uncertainty === "HIGH" && input.state.depth >= 4) return { action: "EXPAND_HYPOTHESES", reason: "high uncertainty remains within deep reasoning capability", value };
  if (input.signals.candidateDisagreement && input.signals.evidenceCoverage !== "ADEQUATE" && !input.counterEvidenceAttempted) return { action: "RETRIEVE_DISCRIMINATING_EVIDENCE", reason: "candidate disagreement identifies a discriminating evidence gap", value };
  if (input.signals.candidateDisagreement && input.candidateCount < input.maxCandidates) return { action: "GENERATE_ALTERNATIVE", reason: "candidate disagreement justifies a bounded strategically different candidate", value };
  if (!input.signals.recentProgress) return { action: "REPLAN", reason: "recent cognitive action did not improve evidence or completion", value };
  return { action: "VERIFY", reason: "the current answer has made progress and needs a completion check", value };
}

export function transitionStrategy(current: StrategyName, action: CognitiveAction): { strategy: StrategyName; reason: string } | null {
  const next: Partial<Record<CognitiveAction, StrategyName>> = { RETRIEVE: "EVIDENCE_FIRST", RETRIEVE_COUNTER_EVIDENCE: "COUNTERFACTUAL", RETRIEVE_DISCRIMINATING_EVIDENCE: "EVIDENCE_FIRST", REPAIR: "VERIFY_REPAIR", BACKTRACK: "PLAN_EXECUTE", REPLAN: "ITERATIVE_REFINEMENT", EXPAND_HYPOTHESES: "HYPOTHESIS_TEST", GENERATE_HYPOTHESES: "HYPOTHESIS_TEST", TEST_HYPOTHESIS: "HYPOTHESIS_TEST", GENERATE_CANDIDATE: "MULTI_CANDIDATE", GENERATE_ALTERNATIVE: "MULTI_CANDIDATE", SEARCH_EXPAND: "BOUNDED_SEARCH" };
  const strategy = next[action];
  return strategy && strategy !== current ? { strategy, reason: `controller action ${action} changes strategy from ${current} to ${strategy}` } : null;
}

export function canBacktrack(state: CognitiveExecutionState, maximum: number): boolean { return state.actions.filter((item) => item.action === "BACKTRACK").length < maximum && state.actions.length > 0; }
