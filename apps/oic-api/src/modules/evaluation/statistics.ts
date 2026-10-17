export type TrialValue = { caseId: string; trial: number; value: number | null };
export type PairedEstimate = {
  availability: "MEASURED" | "INSUFFICIENT";
  estimate: number | null;
  interval: { lower: number; upper: number; confidence: number } | null;
  pairedCases: number;
  pairedTrials: number;
  plannedPairs: number;
  missingPairs: number;
  coverage: number | null;
  method: "STRATIFIED_PAIRED_BOOTSTRAP_V1";
};

function generator(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export function pairedStratifiedBootstrap(
  baseline: readonly TrialValue[],
  candidate: readonly TrialValue[],
  options: { plannedPairs: number; minimumCases: number; resamples?: number; confidence?: number; seed: number }
): PairedEstimate {
  const b = new Map(baseline.map((item) => [`${item.caseId}\u0000${item.trial}`, item.value]));
  const c = new Map(candidate.map((item) => [`${item.caseId}\u0000${item.trial}`, item.value]));
  const byCase = new Map<string, number[]>();
  for (const [key, base] of b) {
    const next = c.get(key);
    if (typeof base !== "number" || !Number.isFinite(base) || typeof next !== "number" || !Number.isFinite(next)) continue;
    const caseId = key.split("\u0000", 1)[0] ?? "";
    const differences = byCase.get(caseId) ?? [];
    differences.push(next - base);
    byCase.set(caseId, differences);
  }
  const strata = [...byCase.values()].filter((items) => items.length > 0);
  const pairedTrials = strata.reduce((sum, items) => sum + items.length, 0);
  const pairedCases = strata.length;
  const plannedPairs = Math.max(0, Math.floor(options.plannedPairs));
  const missingPairs = Math.max(0, plannedPairs - pairedTrials);
  const coverage = plannedPairs === 0 ? null : pairedTrials / plannedPairs;
  const values = strata.flat();
  const estimate = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  if (estimate === null || pairedCases < Math.max(1, options.minimumCases) || missingPairs > 0) {
    return { availability: "INSUFFICIENT", estimate, interval: null, pairedCases, pairedTrials, plannedPairs, missingPairs, coverage, method: "STRATIFIED_PAIRED_BOOTSTRAP_V1" };
  }
  const resamples = Math.min(50_000, Math.max(1_000, Math.floor(options.resamples ?? 5_000)));
  const confidence = Math.min(0.999, Math.max(0.5, options.confidence ?? 0.95));
  const random = generator(options.seed);
  const draws: number[] = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    let total = 0;
    let count = 0;
    for (let caseSample = 0; caseSample < strata.length; caseSample += 1) {
      const stratum = strata[Math.floor(random() * strata.length)] ?? [];
      for (let trialSample = 0; trialSample < stratum.length; trialSample += 1) {
        const value = stratum[Math.floor(random() * stratum.length)];
        if (value !== undefined) { total += value; count += 1; }
      }
    }
    if (count) draws.push(total / count);
  }
  draws.sort((left, right) => left - right);
  const tail = (1 - confidence) / 2;
  const lower = draws[Math.floor(tail * (draws.length - 1))];
  const upper = draws[Math.ceil((1 - tail) * (draws.length - 1))];
  if (lower === undefined || upper === undefined) return { availability: "INSUFFICIENT", estimate, interval: null, pairedCases, pairedTrials, plannedPairs, missingPairs, coverage, method: "STRATIFIED_PAIRED_BOOTSTRAP_V1" };
  return { availability: "MEASURED", estimate, interval: { lower, upper, confidence }, pairedCases, pairedTrials, plannedPairs, missingPairs, coverage, method: "STRATIFIED_PAIRED_BOOTSTRAP_V1" };
}

export function holmAdjustedPValues(pValues: readonly number[]): number[] {
  const ordered = pValues.map((p, index) => ({ p: Math.min(1, Math.max(0, p)), index })).sort((a, b) => a.p - b.p);
  const result = Array<number>(pValues.length).fill(1);
  let floor = 0;
  ordered.forEach((item, rank) => {
    floor = Math.max(floor, Math.min(1, item.p * (ordered.length - rank)));
    result[item.index] = floor;
  });
  return result;
}

export type ComparabilityInput = {
  targetClass: string;
  treatmentKey: string;
  releaseId: string;
  harnessDigest: string;
  environmentDigest: string;
  oracleRevision: string;
  metricRevision: string;
  judgeRevision: string;
  samplingRevision: string;
  retryRevision: string;
  caseIds: readonly string[];
  verificationTier: string;
  holdoutCompromised?: boolean;
  releaseEligible?: boolean;
  evidenceComplete?: boolean;
  bridgeValidated?: boolean;
  decisionGateAllowsBridge?: boolean;
};
export type Comparability = {
  status: "DIRECTLY_COMPARABLE" | "MATCHED_SUBSET_COMPARABLE" | "NORMALIZED_COMPARISON_AVAILABLE" | "DESCRIPTIVE_ONLY" | "NOT_COMPARABLE";
  reasonCodes: string[];
  commonCaseIds: string[];
  decisionEligible: boolean;
};

export function compareProtocols(left: ComparabilityInput, right: ComparabilityInput): Comparability {
  const reasons: string[] = [];
  if (left.holdoutCompromised || right.holdoutCompromised) reasons.push("HOLDOUT_EXPOSED");
  if (left.releaseEligible === false || right.releaseEligible === false) reasons.push("RELEASE_INVALID");
  if (left.evidenceComplete === false || right.evidenceComplete === false) reasons.push("EVIDENCE_INVALID");
  if (left.targetClass !== right.targetClass) reasons.push("TARGET_CLASS_MISMATCH");
  if (left.verificationTier !== "OIC_EXECUTED_VERIFIED" || right.verificationTier !== "OIC_EXECUTED_VERIFIED") reasons.push("EXTERNAL_UNVERIFIED");
  if (reasons.includes("HOLDOUT_EXPOSED") || reasons.includes("RELEASE_INVALID") || reasons.includes("EVIDENCE_INVALID") || reasons.includes("TARGET_CLASS_MISMATCH")) return { status: "NOT_COMPARABLE", reasonCodes: reasons, commonCaseIds: [], decisionEligible: false };
  const commonCaseIds = [...new Set(left.caseIds)].filter((id) => new Set(right.caseIds).has(id)).sort();
  if (!commonCaseIds.length) return { status: "NOT_COMPARABLE", reasonCodes: ["INSUFFICIENT_COMMON_CASES", ...reasons], commonCaseIds, decisionEligible: false };
  const exact = left.releaseId === right.releaseId && left.harnessDigest === right.harnessDigest && left.environmentDigest === right.environmentDigest && left.oracleRevision === right.oracleRevision && left.metricRevision === right.metricRevision && left.judgeRevision === right.judgeRevision && left.samplingRevision === right.samplingRevision && left.retryRevision === right.retryRevision;
  if (!exact) {
    for (const [field, code] of [["releaseId", "RELEASE_MISMATCH"], ["harnessDigest", "HARNESS_REVISION_MISMATCH"], ["environmentDigest", "ENVIRONMENT_MISMATCH"], ["oracleRevision", "ORACLE_REVISION_MISMATCH"], ["metricRevision", "METRIC_REVISION_MISMATCH"], ["judgeRevision", "JUDGE_REVISION_MISMATCH"], ["samplingRevision", "SAMPLING_POLICY_MISMATCH"], ["retryRevision", "RETRY_POLICY_MISMATCH"]] as const) if (left[field] !== right[field]) reasons.push(code);
    // A caller-supplied flag is not evidence of a published, cohort-specific
    // bridge study. Normalized comparisons require that persisted evidence.
    if (left.bridgeValidated || right.bridgeValidated) reasons.push("BRIDGE_UNVALIDATED");
    return { status: "DESCRIPTIVE_ONLY", reasonCodes: reasons, commonCaseIds, decisionEligible: false };
  }
  const sameCases = new Set(left.caseIds).size === new Set(right.caseIds).size && commonCaseIds.length === new Set(left.caseIds).size;
  if (sameCases) return { status: "DIRECTLY_COMPARABLE", reasonCodes: reasons, commonCaseIds, decisionEligible: false };
  return { status: "MATCHED_SUBSET_COMPARABLE", reasonCodes: [...reasons, "CASE_SET_MISMATCH"], commonCaseIds, decisionEligible: false };
}
