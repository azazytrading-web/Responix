import type { HypothesisAssessment } from "./hypothesis-engine";

export type CognitiveSearchLimits = { maxDepth: number; maxBranchFactor: number; maxTotalNodes: number; maxProviderCalls: number; maxWallClockTimeMs: number; maxBacktracks: number; maxExpansionsWithoutProgress: number };
export type CognitiveSearchNode = { id: string; parentId: string | null; depth: number; stateKind: CognitiveSearchAlternative["kind"] | "ROOT"; strategy: string; problemStateFingerprint: string; hypothesisRefs: string[]; constraintStatus: "OPEN" | "SATISFIED" | "FAILED"; constraintsSatisfied: string[]; evidenceCoverage: "NONE" | "PARTIAL" | "ADEQUATE" | "CONFLICTED"; verificationStatus: "NOT_RUN" | "PASS" | "FAIL"; resourceCost: number; progressScore: number; terminalStatus: "OPEN" | "SELECTED" | "PRUNED" | "LIMIT_REACHED"; pruneReason?: string };
export type CognitiveSearchAlternative = { id: string; kind: "PLAN" | "HYPOTHESIS" | "CONSTRAINT" | "CANDIDATE" | "TOOL" | "RETRIEVAL"; parentId?: string; stateFingerprint: string; strategy: string; constraintsSatisfied: string[]; constraintStatus: "OPEN" | "SATISFIED" | "FAILED"; evidenceCoverage: "NONE" | "PARTIAL" | "ADEQUATE" | "CONFLICTED"; verificationStatus: "NOT_RUN" | "PASS" | "FAIL"; resourceCost: number; providerCalls: number; progressScore: number; references?: string[]; pruneReason?: string };
export type CognitiveSearchResult = { limits: CognitiveSearchLimits; nodes: CognitiveSearchNode[]; operations: Array<{ operation: "EXPAND" | "EVALUATE" | "PRUNE" | "BACKTRACK" | "SELECT" | "STOP"; nodeId?: string; reason: string }>; selectedNodeId: string | null; failedStateFingerprints: string[]; stopReason: "SELECTED_SURVIVING_PATH" | "NO_SURVIVING_PATH" | "RESOURCE_LIMIT" | "NO_HYPOTHESES"; usage: { nodes: number; expansions: number; backtracks: number; providerCalls: number; elapsedMs: number } };

const safeLimit = (value: number, max: number) => Math.max(0, Math.min(max, Math.floor(value)));

/** General bounded search over safe plan, hypothesis, constraint, candidate, tool, and retrieval states. */
export function searchCognitiveStates(alternatives: CognitiveSearchAlternative[], options: { limits: CognitiveSearchLimits; problemFingerprint: string; evidenceCount?: number; now?: () => number }): CognitiveSearchResult {
  const now = options.now ?? Date.now;
  const start = now();
  const limits: CognitiveSearchLimits = {
    maxDepth: safeLimit(options.limits.maxDepth, 8), maxBranchFactor: safeLimit(options.limits.maxBranchFactor, 8),
    maxTotalNodes: safeLimit(options.limits.maxTotalNodes, 64), maxProviderCalls: safeLimit(options.limits.maxProviderCalls, 16),
    maxWallClockTimeMs: safeLimit(options.limits.maxWallClockTimeMs, 60_000), maxBacktracks: safeLimit(options.limits.maxBacktracks, 16),
    maxExpansionsWithoutProgress: safeLimit(options.limits.maxExpansionsWithoutProgress, 8)
  };
  const nodes: CognitiveSearchNode[] = [];
  const operations: CognitiveSearchResult["operations"] = [];
  const failedStateFingerprints: string[] = [];
  if (!alternatives.length || limits.maxTotalNodes === 0 || limits.maxDepth === 0 || limits.maxWallClockTimeMs === 0) {
    operations.push({ operation: "STOP", reason: !alternatives.length ? "no structured search alternatives were available" : "a zero-valued hard resource bound prevents expansion" });
    return { limits, nodes, operations, selectedNodeId: null, failedStateFingerprints, stopReason: !alternatives.length ? "NO_HYPOTHESES" : "RESOURCE_LIMIT", usage: { nodes: 0, expansions: 0, backtracks: 0, providerCalls: 0, elapsedMs: 0 } };
  }
  const root: CognitiveSearchNode = { id: "S0", parentId: null, depth: 0, stateKind: "ROOT", strategy: "BOUNDED_SEARCH", problemStateFingerprint: options.problemFingerprint, hypothesisRefs: [], constraintStatus: "OPEN", constraintsSatisfied: [], evidenceCoverage: options.evidenceCount ? "PARTIAL" : "NONE", verificationStatus: "NOT_RUN", resourceCost: 0, progressScore: 0, terminalStatus: "OPEN" };
  nodes.push(root);
  const nodeByAlternativeId = new Map<string, CognitiveSearchNode>();
  const branchCounts = new Map<string, number>();
  const spentCalls = new Map<string, number>([[root.id, 0]]);
  const spentCost = new Map<string, number>([[root.id, 0]]);
  const seenStates = new Set<string>([options.problemFingerprint]);
  let selectedNodeId: string | null = null;
  let backtracks = 0;
  let expansionsWithoutProgress = 0;
  let providerCalls = 0;
  operations.push({ operation: "EXPAND", nodeId: root.id, reason: `bounded search allows ${Math.min(limits.maxBranchFactor, limits.maxTotalNodes - 1)} root alternatives` });
  for (const alternative of alternatives) {
    const elapsed = now() - start;
    if (elapsed >= limits.maxWallClockTimeMs || nodes.length >= limits.maxTotalNodes) { operations.push({ operation: "STOP", reason: "wall-clock or total-node bound reached" }); break; }
    const parent = alternative.parentId ? nodeByAlternativeId.get(alternative.parentId) : root;
    if (!parent || parent.terminalStatus === "PRUNED") { failedStateFingerprints.push(alternative.stateFingerprint); operations.push({ operation: "PRUNE", reason: !parent ? "parent state is unavailable; branch cannot be restored safely" : "parent path was pruned; descendants are unreachable" }); continue; }
    const parentKey = parent.id;
    const branchCount = branchCounts.get(parentKey) ?? 0;
    if (branchCount >= limits.maxBranchFactor) { operations.push({ operation: "STOP", nodeId: parent.id, reason: "branch factor bound reached" }); break; }
    const depth = parent.depth + 1;
    if (depth > limits.maxDepth) { parent.terminalStatus = "LIMIT_REACHED"; operations.push({ operation: "STOP", nodeId: parent.id, reason: "maximum search depth reached" }); break; }
    branchCounts.set(parentKey, branchCount + 1);
    const branchCalls = Math.max(0, Math.floor(alternative.providerCalls));
    const nextCalls = (spentCalls.get(parentKey) ?? 0) + branchCalls;
    if (nextCalls > limits.maxProviderCalls || providerCalls + branchCalls > limits.maxProviderCalls) { operations.push({ operation: "PRUNE", nodeId: parent.id, reason: "branch provider-call cost exceeds remaining search budget" }); failedStateFingerprints.push(alternative.stateFingerprint); continue; }
    const nodeId = `S${nodes.length}`;
    const fingerprint = `${options.problemFingerprint}:${alternative.stateFingerprint}`;
    const node: CognitiveSearchNode = { id: nodeId, parentId: parent.id, depth, stateKind: alternative.kind, strategy: alternative.strategy, problemStateFingerprint: fingerprint, hypothesisRefs: alternative.references ?? [], constraintStatus: alternative.constraintStatus, constraintsSatisfied: [...alternative.constraintsSatisfied].slice(0, 16), evidenceCoverage: alternative.evidenceCoverage, verificationStatus: alternative.verificationStatus, resourceCost: (spentCost.get(parentKey) ?? 0) + Math.max(0, alternative.resourceCost), progressScore: alternative.progressScore, terminalStatus: "OPEN" };
    nodes.push(node); nodeByAlternativeId.set(alternative.id, node); spentCalls.set(node.id, nextCalls); spentCost.set(node.id, node.resourceCost); providerCalls += branchCalls;
    operations.push({ operation: "EVALUATE", nodeId, reason: `structured ${alternative.kind.toLocaleLowerCase()} state evaluated under shared constraints and evidence coverage` });
    const duplicate = seenStates.has(fingerprint);
    const unrecoverable = alternative.constraintStatus === "FAILED" || alternative.verificationStatus === "FAIL";
    if (duplicate || unrecoverable) {
      node.terminalStatus = "PRUNED";
      node.pruneReason = duplicate ? "duplicate problem state" : alternative.pruneReason ?? (alternative.constraintStatus === "FAILED" ? "hard constraint failure" : "verifier marked path unrecoverable");
      failedStateFingerprints.push(alternative.stateFingerprint);
      operations.push({ operation: "PRUNE", nodeId, reason: node.pruneReason });
      if (backtracks < limits.maxBacktracks) { backtracks++; operations.push({ operation: "BACKTRACK", nodeId: parent.id, reason: `restore parent after pruning failed state ${alternative.stateFingerprint}` }); }
      expansionsWithoutProgress++;
      if (expansionsWithoutProgress >= limits.maxExpansionsWithoutProgress) { operations.push({ operation: "STOP", reason: "no-progress expansion bound reached" }); break; }
      continue;
    }
    seenStates.add(fingerprint);
    if (node.progressScore <= parent.progressScore) expansionsWithoutProgress++; else expansionsWithoutProgress = 0;
    if (node.verificationStatus !== "FAIL" && (!selectedNodeId || node.progressScore > (nodes.find((item) => item.id === selectedNodeId)?.progressScore ?? Number.NEGATIVE_INFINITY))) selectedNodeId = node.id;
    if (expansionsWithoutProgress >= limits.maxExpansionsWithoutProgress) { operations.push({ operation: "STOP", reason: "no-progress expansion bound reached" }); break; }
  }
  if (selectedNodeId) {
    const selected = nodes.find((item) => item.id === selectedNodeId)!;
    selected.terminalStatus = "SELECTED";
    operations.push({ operation: "SELECT", nodeId: selectedNodeId, reason: selected.verificationStatus === "PASS" ? "best surviving verified state selected" : "best surviving state selected with verification still required" });
  }
  if (!operations.some((item) => item.operation === "STOP")) operations.push({ operation: "STOP", reason: selectedNodeId ? "bounded structured alternatives evaluated" : "all structured alternatives were pruned" });
  const elapsedMs = Math.max(0, now() - start);
  const limitReached = nodes.length >= limits.maxTotalNodes || elapsedMs >= limits.maxWallClockTimeMs;
  return { limits, nodes, operations, selectedNodeId, failedStateFingerprints, stopReason: selectedNodeId ? "SELECTED_SURVIVING_PATH" : limitReached ? "RESOURCE_LIMIT" : "NO_SURVIVING_PATH", usage: { nodes: nodes.length, expansions: nodes.length - 1, backtracks, providerCalls, elapsedMs } };
}

/** Maps shared-graph hypothesis assessments into the general cognitive search state machine. */
export function searchHypothesisPaths(assessments: HypothesisAssessment[], options: { limits: CognitiveSearchLimits; problemFingerprint: string; evidenceCount: number; now?: () => number }): CognitiveSearchResult {
  const alternatives: CognitiveSearchAlternative[] = assessments.map((item) => ({
    id: item.id, kind: "HYPOTHESIS", stateFingerprint: item.fingerprint, strategy: "HYPOTHESIS_TEST", constraintsSatisfied: [],
    constraintStatus: "OPEN",
    evidenceCoverage: item.supportingEvidenceIds.length ? item.contradictingEvidenceIds.length ? "CONFLICTED" : "ADEQUATE" : options.evidenceCount ? "PARTIAL" : "NONE",
    verificationStatus: item.assessment === "CONTRADICTED" ? "FAIL" : "NOT_RUN", resourceCost: 1, providerCalls: 0, progressScore: item.supportingEvidenceIds.length - item.contradictingEvidenceIds.length, references: [item.id], pruneReason: item.assessment === "CONTRADICTED" ? "shared evidence contradicts this hypothesis" : undefined
  }));
  return searchCognitiveStates(alternatives, options);
}
