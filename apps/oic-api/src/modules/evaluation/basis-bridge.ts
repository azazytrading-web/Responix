import { OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST, OBJECTIVE_ORACLE_METHOD } from "./objective-oracle";
import { createHash } from "node:crypto";

export type MetricBasis = {
  id: string;
  metricKey: string;
  revision: number;
  definitionDigest: string;
  definition: Record<string, unknown>;
};

export type ReferenceMethodEvidence = {
  judgeId: string;
  judgeDigest: string;
  judgeType: string;
  methodRevision: string;
  abstentionPolicy: string;
  sourceOracleRevision: string;
  sourceOracleCodeDigest: string;
};

export type BudgetRebaselineBudget = {
  id: string;
  applicationId?: string | null;
  tenantId?: string | null;
  planRevisionId?: string | null;
  sourceDigest: string;
  status: string;
  unit: string;
  enforcement: string;
  amount: string;
  reservationUpperBound: string | null;
  unknownLiabilityRule: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export function isNextOperationalBudgetBridgeRevision(revision: number, latestRevision: number | null): boolean {
  return Number.isInteger(revision) && revision > 0 && revision === (latestRevision ?? 0) + 1;
}

export function packet76AdmissionBudgetIsAuthorized(input: {
  sourceBudgetRevisionId: string;
  admissionBudgetRevisionId: string | null;
  admissionCapacityExtensionId: string | null;
  admissionCreatedAt: Date;
  applicationId: string;
  tenantId: string | null;
  runId: string;
  campaignId: string | null;
  cohortKey: string;
  legAmount: string;
  legState: string;
  legUnit: string;
  extension?: {
    id: string;
    applicationId: string;
    tenantId: string | null;
    runId: string;
    campaignId: string;
    cohortKey: string;
    status: string;
    baseBudgetRevisionId: string;
    budgetRevisionId: string;
    authorizedOiu: string;
    perAdmissionLimitOiu: string;
    expiresAt: Date;
    budget: { id: string; status: string; unit: string; enforcement: string; unknownLiabilityRule: string; amount: string; reservationUpperBound: string | null; effectiveFrom: Date; effectiveTo: Date | null };
  };
}): boolean {
  if (input.legState !== "SETTLED" || input.legUnit !== "OIU" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input.legAmount)
    || !Number.isFinite(Number(input.legAmount)) || Number(input.legAmount) > 256) return false;
  if (input.admissionBudgetRevisionId === input.sourceBudgetRevisionId) return input.admissionCapacityExtensionId === null;
  const extension = input.extension;
  if (!extension || input.admissionBudgetRevisionId === null || input.admissionCapacityExtensionId !== extension.id
    || extension.applicationId !== input.applicationId || extension.tenantId !== input.tenantId || extension.runId !== input.runId
    || extension.campaignId !== input.campaignId || extension.cohortKey !== input.cohortKey
    || !["CLOSED", "EXPIRED"].includes(extension.status) || extension.baseBudgetRevisionId !== input.sourceBudgetRevisionId
    || extension.budgetRevisionId !== input.admissionBudgetRevisionId || extension.authorizedOiu !== extension.budget.amount
    || extension.perAdmissionLimitOiu !== "256" || !Number.isFinite(Number(input.legAmount)) || Number(input.legAmount) > Number(extension.perAdmissionLimitOiu)
    || extension.expiresAt < input.admissionCreatedAt || extension.budget.id !== extension.budgetRevisionId
    || extension.budget.status !== "PUBLISHED" || extension.budget.unit !== "OIU" || extension.budget.enforcement !== "HARD"
    || extension.budget.unknownLiabilityRule !== "DENY" || extension.budget.effectiveFrom > input.admissionCreatedAt
    || !extension.budget.effectiveTo || extension.budget.effectiveTo < input.admissionCreatedAt
    || extension.budget.effectiveTo.getTime() !== extension.expiresAt.getTime()
    || extension.budget.reservationUpperBound !== extension.perAdmissionLimitOiu) return false;
  return true;
}

export function resolvePacket76ProviderDispatchLink(input: {
  attempt: { providerAttemptId: string | null; providerDispatchStartedAt: Date | null; admissionId: string | null };
  providerAttempts: Array<{ id: string; admissionId: string | null; status: string; usageStatus: string; providerKey: string; upstreamModelId: string; bindingId: string; connectionId: string; startedAt: Date }>;
  expected: { providerKey: string; upstreamModelId: string; bindingId: string; connectionId: string };
}): { valid: boolean; providerAttemptId: string | null; providerDispatchStartedAt: Date | null; linkage: "DIRECT" | "ADMISSION" | null } {
  const matchesTarget = (row: typeof input.providerAttempts[number]) => row.status === "SUCCEEDED" && row.usageStatus === "REPORTED"
    && row.providerKey === input.expected.providerKey && row.upstreamModelId === input.expected.upstreamModelId
    && row.bindingId === input.expected.bindingId && row.connectionId === input.expected.connectionId;
  if (input.attempt.providerAttemptId && input.attempt.providerDispatchStartedAt) {
    const direct = input.providerAttempts.filter((row) => row.id === input.attempt.providerAttemptId && matchesTarget(row));
    return direct.length === 1 ? { valid: true, providerAttemptId: direct[0]!.id, providerDispatchStartedAt: input.attempt.providerDispatchStartedAt, linkage: "DIRECT" } : { valid: false, providerAttemptId: null, providerDispatchStartedAt: null, linkage: null };
  }
  if (!input.attempt.admissionId) return { valid: false, providerAttemptId: null, providerDispatchStartedAt: null, linkage: null };
  const viaAdmission = input.providerAttempts.filter((row) => row.admissionId === input.attempt.admissionId);
  const match = viaAdmission[0];
  const hasCanonicalDispatchTime = match?.startedAt instanceof Date && Number.isFinite(match.startedAt.getTime());
  return viaAdmission.length === 1 && match && matchesTarget(match) && hasCanonicalDispatchTime
    ? { valid: true, providerAttemptId: match.id, providerDispatchStartedAt: match.startedAt, linkage: "ADMISSION" }
    : { valid: false, providerAttemptId: null, providerDispatchStartedAt: null, linkage: null };
}

/** Proves that two published execution bases differ only by a bounded OIC-6 budget identity. */
export function validateOperationalBudgetRebaseline(input: {
  sourceManifestId: string;
  sourceDigest: string;
  sourceProtocol: Record<string, unknown>;
  targetManifestId: string;
  targetDigest: string;
  targetProtocol: Record<string, unknown>;
  sourceBudget: BudgetRebaselineBudget;
  targetBudget: BudgetRebaselineBudget;
  admissionPlanContinuity?: {
    source: { id: string; planKey: string; applicationId: string; status: string; models: string[]; maxOutputUnits: number | null; maxConcurrency: number | null };
    target: { id: string; planKey: string; applicationId: string; status: string; effectiveFrom: Date; effectiveTo: Date | null; models: string[]; maxOutputUnits: number | null; maxConcurrency: number | null };
    modelId: string;
  };
  now: Date;
}): { valid: boolean; reasonCodes: string[]; evidence: Record<string, unknown> } {
  const reasons = new Set<string>();
  const sourceProtocol = structuredClone(input.sourceProtocol);
  const targetProtocol = structuredClone(input.targetProtocol);
  const sourceBudgetRef = record(sourceProtocol.budgetPolicy);
  const targetBudgetRef = record(targetProtocol.budgetPolicy);
  const sourceBudgetId = sourceBudgetRef.budgetRevisionId;
  const targetBudgetId = targetBudgetRef.budgetRevisionId;
  const sourceBudgetDigestValue = sourceBudgetRef.budgetRevisionDigest;
  const targetBudgetDigestValue = targetBudgetRef.budgetRevisionDigest;
  delete sourceBudgetRef.budgetRevisionId;
  delete sourceBudgetRef.budgetRevisionDigest;
  delete targetBudgetRef.budgetRevisionId;
  delete targetBudgetRef.budgetRevisionDigest;
  if (canonical(sourceProtocol) !== canonical(targetProtocol)) reasons.add("NON_BUDGET_PROTOCOL_DIMENSION_CHANGED");
  const source = input.sourceBudget;
  const target = input.targetBudget;
  const digestValid = (value: string) => /^[a-f0-9]{64}$/.test(value);
  if (!digestValid(input.sourceDigest) || !digestValid(input.targetDigest)) reasons.add("MANIFEST_DIGEST_INVALID");
  if (input.sourceManifestId === input.targetManifestId) reasons.add("MANIFEST_IDENTITY_NOT_REVISED");
  if (source.id !== sourceBudgetId || target.id !== targetBudgetId
    || source.sourceDigest !== sourceBudgetDigestValue || target.sourceDigest !== targetBudgetDigestValue) reasons.add("BUDGET_REFERENCE_MISMATCH");
  if (source.applicationId !== undefined && target.applicationId !== undefined && source.applicationId !== target.applicationId) reasons.add("BUDGET_APPLICATION_SCOPE_CHANGED");
  if ((source.tenantId ?? null) !== (target.tenantId ?? null)) reasons.add("BUDGET_TENANT_SCOPE_CHANGED");
  if (source.status !== "PUBLISHED" || source.unit !== "OIU" || source.enforcement !== "HARD" || source.unknownLiabilityRule !== "DENY" || !source.effectiveTo || source.effectiveTo > input.now) reasons.add("SOURCE_BUDGET_NOT_EXPIRED_HARD_DENY");
  if (target.status !== "PUBLISHED" || target.unit !== "OIU" || target.enforcement !== "HARD" || target.unknownLiabilityRule !== "DENY" || target.effectiveFrom > input.now || !target.effectiveTo || target.effectiveTo <= input.now) reasons.add("TARGET_BUDGET_NOT_ACTIVE_BOUNDED_HARD_DENY");
  const targetWindowMs = target.effectiveTo ? target.effectiveTo.getTime() - target.effectiveFrom.getTime() : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(targetWindowMs) || targetWindowMs <= 0 || targetWindowMs > 24 * 60 * 60 * 1000) reasons.add("TARGET_BUDGET_WINDOW_NOT_BOUNDED");
  if (target.amount !== "768" || target.reservationUpperBound !== "256") reasons.add("TARGET_BUDGET_CAPACITY_OUTSIDE_AUTHORIZATION");
  if (source.reservationUpperBound !== target.reservationUpperBound || sourceBudgetRef.maxInputUnits !== targetBudgetRef.maxInputUnits || sourceBudgetRef.maxOutputUnits !== targetBudgetRef.maxOutputUnits || sourceBudgetRef.maxExecutionMs !== targetBudgetRef.maxExecutionMs) reasons.add("BUDGET_EXECUTION_CONTROL_CHANGED");
  const continuity = input.admissionPlanContinuity;
  if (!continuity || source.planRevisionId !== continuity.source.id || target.planRevisionId !== continuity.target.id
    || continuity.source.applicationId !== continuity.target.applicationId || continuity.source.planKey !== continuity.target.planKey
    || continuity.source.status !== "PUBLISHED" || continuity.target.status !== "PUBLISHED"
    || continuity.target.effectiveFrom > input.now || !continuity.target.effectiveTo || continuity.target.effectiveTo <= input.now
    || canonical(continuity.source.models) !== canonical(continuity.target.models)
    || !continuity.target.models.includes(continuity.modelId)
    || continuity.source.maxOutputUnits !== continuity.target.maxOutputUnits
    || (continuity.target.maxOutputUnits !== null && Number(targetBudgetRef.maxOutputUnits) > continuity.target.maxOutputUnits)
    || continuity.source.maxConcurrency !== continuity.target.maxConcurrency || continuity.target.maxConcurrency !== 1) reasons.add("ADMISSION_PLAN_CONTINUITY_INVALID");
  const evidence = {
    compatibilityType: "OPERATIONAL_BUDGET_REBASELINE",
    sourceManifest: { id: input.sourceManifestId, digest: input.sourceDigest },
    targetManifest: { id: input.targetManifestId, digest: input.targetDigest },
    changedFields: ["budgetPolicy.budgetRevisionId", "budgetPolicy.budgetRevisionDigest", "OIC6.validity", "OIC6.planRevisionId"],
    preservedFields: ["targetIdentity", "targetClass", "release", "cases", "harness", "environment", "capabilities", "oracle", "metrics", "judges", "repetition", "sampling", "statistics", "retry", "inputBound", "outputBound", "executionBound", "artifactPolicy", "verificationTier", "candidateTreatment", "decisionGate"],
    admissionPlanContinuity: continuity ? { source: { id: continuity.source.id, planKey: continuity.source.planKey, models: continuity.source.models, maxOutputUnits: continuity.source.maxOutputUnits, maxConcurrency: continuity.source.maxConcurrency }, target: { id: continuity.target.id, planKey: continuity.target.planKey, effectiveFrom: continuity.target.effectiveFrom.toISOString(), effectiveTo: continuity.target.effectiveTo?.toISOString() ?? null, models: continuity.target.models, maxOutputUnits: continuity.target.maxOutputUnits, maxConcurrency: continuity.target.maxConcurrency }, modelId: continuity.modelId } : null,
    sourceBudget: { id: source.id, digest: source.sourceDigest, status: source.status, unit: source.unit, enforcement: source.enforcement, amount: source.amount, reservationUpperBound: source.reservationUpperBound, unknownLiabilityRule: source.unknownLiabilityRule, effectiveFrom: source.effectiveFrom.toISOString(), effectiveTo: source.effectiveTo?.toISOString() ?? null },
    targetBudget: { id: target.id, digest: target.sourceDigest, status: target.status, unit: target.unit, enforcement: target.enforcement, amount: target.amount, reservationUpperBound: target.reservationUpperBound, unknownLiabilityRule: target.unknownLiabilityRule, effectiveFrom: target.effectiveFrom.toISOString(), effectiveTo: target.effectiveTo?.toISOString() ?? null },
    result: reasons.size ? "INVALID" : "VALID"
  };
  return { valid: reasons.size === 0, reasonCodes: [...reasons].sort(), evidence };
}

const digest = /^[a-f0-9]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targetKeys = new Set([
  "type", "unit", "polarity", "applicableTargetClasses", "applicableDomains", "rangeOrCategories",
  "missingSemantics", "oracleOrJudgeRevisionId", "aggregationMethodRevision", "uncertaintyMethodRevision",
  "minimumEffectiveN", "criticality", "normalizationRevisionOrNone", "sourceArtifactRequirement", "methodRevision",
  "metricMeaning", "scoringAlgorithmRevision", "thresholdSemanticsRevision", "failureSemanticsRevision",
  "languageSemanticsRevision", "protectedDataSemanticsRevision"
]);

/** Validates the one explicitly approved raw-output bridge; this never translates a v1 score. */
export function validateExactBytesRawOutputBridge(
  source: MetricBasis,
  target: MetricBasis,
  method: ReferenceMethodEvidence
): { valid: boolean; changedFields: string[]; reasonCodes: string[]; evidence: Record<string, unknown> } {
  const sourceDefinition = source.definition;
  const targetDefinition = target.definition;
  const reasons: string[] = [];
  const changedFields: string[] = [];
  const mismatch = (key: string) => { changedFields.push(key); reasons.push(`SEMANTIC_MISMATCH_${key.toUpperCase()}`); };

  if (source.metricKey !== target.metricKey || source.revision !== 1 || target.revision <= source.revision) reasons.push("METRIC_IDENTITY_INVALID");
  if (!digest.test(source.definitionDigest) || !digest.test(target.definitionDigest)) reasons.push("METRIC_DIGEST_INVALID");
  if (sourceDefinition.type !== "BOOLEAN" || targetDefinition.type !== "BOOLEAN") mismatch("type");
  if (sourceDefinition.polarity !== "HIGH_IS_GOOD" || targetDefinition.polarity !== sourceDefinition.polarity) mismatch("polarity");
  if (sourceDefinition.criticality !== "REQUIRED" || targetDefinition.criticality !== sourceDefinition.criticality) mismatch("criticality");
  if (sourceDefinition.minimumEffectiveN !== 1 || targetDefinition.minimumEffectiveN !== sourceDefinition.minimumEffectiveN) mismatch("minimumEffectiveN");
  if (canonical(sourceDefinition.applicableDomains) !== canonical(targetDefinition.applicableDomains)) mismatch("applicableDomains");
  if (canonical(sourceDefinition.applicableTargetClasses) !== canonical(targetDefinition.applicableTargetClasses)) mismatch("applicableTargetClasses");
  if (sourceDefinition.aggregationMethodRevision !== "single-trial-boolean-v1" || targetDefinition.aggregationMethodRevision !== sourceDefinition.aggregationMethodRevision) mismatch("aggregationMethodRevision");
  if (sourceDefinition.uncertaintyMethodRevision !== "not-estimated-n1-v1" || targetDefinition.uncertaintyMethodRevision !== sourceDefinition.uncertaintyMethodRevision) mismatch("uncertaintyMethodRevision");
  if (sourceDefinition.sourceArtifactRequirement !== "SEALED_OBJECTIVE_ORACLE" || targetDefinition.sourceArtifactRequirement !== sourceDefinition.sourceArtifactRequirement) mismatch("sourceArtifactRequirement");
  if (sourceDefinition.unit !== "exact_bytes_match" || targetDefinition.unit !== "EXACT_BYTES_MATCH") mismatch("unitAlias");
  if (sourceDefinition.missingSemantics !== "Missing output or unknown usage remains unmeasured" || targetDefinition.missingSemantics !== "MISSING_OR_UNKNOWN_IS_NOT_MEASURED") mismatch("missingSemanticsAlias");
  const range = record(targetDefinition.rangeOrCategories);
  if (range.minimum !== 0 || range.maximum !== 1) mismatch("booleanRange");
  if (targetDefinition.normalizationRevisionOrNone !== "NONE") mismatch("normalization");
  if (targetDefinition.oracleOrJudgeRevisionId !== method.judgeId) mismatch("oracleOrJudgeRevisionId");
  if (targetDefinition.methodRevision !== OBJECTIVE_ORACLE_METHOD || method.methodRevision !== OBJECTIVE_ORACLE_METHOD || method.sourceOracleRevision !== OBJECTIVE_ORACLE_METHOD) mismatch("methodRevision");
  const explicitSemantics = {
    metricMeaning: "EXACT_REFERENCE_BYTE_MATCH",
    scoringAlgorithmRevision: OBJECTIVE_ORACLE_METHOD,
    thresholdSemanticsRevision: "BOOLEAN_TRUE_IS_EXACT_MATCH_V1",
    failureSemanticsRevision: "EXECUTION_FAILURE_FALSE_MISSING_UNMEASURED_V1",
    languageSemanticsRevision: "BYTEWISE_NO_LOCALE_NORMALIZATION_V1",
    protectedDataSemanticsRevision: "SEALED_REFERENCE_SERVER_SIDE_ONLY_V1"
  };
  for (const [key, value] of Object.entries(explicitSemantics)) if (targetDefinition[key] !== value) mismatch(key);
  if (method.judgeType !== "REFERENCE" || method.abstentionPolicy !== "ABSTAIN_IF_OUTPUT_OR_ORACLE_UNAVAILABLE" || !digest.test(method.judgeDigest) || method.sourceOracleCodeDigest !== OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST) mismatch("referenceMethodEvidence");
  if (Object.keys(targetDefinition).some((key) => !targetKeys.has(key))) reasons.push("UNSUPPORTED_TARGET_METHOD_FIELD");

  const evidence = {
    compatibilityType: "RAW_OUTPUT_REGRADE",
    sourceMetric: { id: source.id, key: source.metricKey, revision: source.revision, digest: source.definitionDigest },
    targetMetric: { id: target.id, key: target.metricKey, revision: target.revision, digest: target.definitionDigest },
    method: { judgeId: method.judgeId, judgeDigest: method.judgeDigest, methodRevision: method.methodRevision, sourceOracleRevision: method.sourceOracleRevision, sourceOracleCodeDigest: method.sourceOracleCodeDigest },
    explicitAliases: { unit: [sourceDefinition.unit, targetDefinition.unit], missingSemantics: [sourceDefinition.missingSemantics, targetDefinition.missingSemantics] },
    semanticFieldsCompared: ["type", "polarity", "criticality", "minimumEffectiveN", "applicableDomains", "applicableTargetClasses", "aggregationMethodRevision", "uncertaintyMethodRevision", "sourceArtifactRequirement", "rangeOrCategories", "normalizationRevisionOrNone", "oracleOrJudgeRevisionId", "methodRevision", "metricMeaning", "scoringAlgorithmRevision", "thresholdSemanticsRevision", "failureSemanticsRevision", "languageSemanticsRevision", "protectedDataSemanticsRevision", "abstentionPolicy"],
    changedFields: [...new Set(changedFields)].sort(),
    result: reasons.length ? "INVALID" : "VALID"
  };
  return { valid: reasons.length === 0, changedFields: [...new Set(changedFields)].sort(), reasonCodes: [...new Set(reasons)].sort(), evidence };
}

export function validatePredispatchDecisionGate(value: unknown): { valid: boolean; reasonCodes: string[] } {
  const gate = record(value);
  const requiredKeys = ["gateKey", "revision", "minimumEffectiveN", "confidenceLevel", "criticalSlices", "requireFreshHoldout", "requirePairedUncertainty", "requireSettledOic6", "requireCostCoverage"];
  const cohortKeys = ["cohortKey", "parentManifestId", "parentManifestDigest"];
  const hasCohortBinding = cohortKeys.some((key) => key in gate);
  const expectedKeys = hasCohortBinding ? [...requiredKeys, ...cohortKeys] : requiredKeys;
  const reasonCodes: string[] = [];
  if (Object.keys(gate).sort().join(",") !== expectedKeys.slice().sort().join(",")) reasonCodes.push("GATE_SHAPE_INVALID");
  if (typeof gate.gateKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(gate.gateKey) || typeof gate.revision !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(gate.revision)) reasonCodes.push("GATE_IDENTITY_INVALID");
  if (!Number.isInteger(gate.minimumEffectiveN) || Number(gate.minimumEffectiveN) < 2 || Number(gate.minimumEffectiveN) > 1_000_000) reasonCodes.push("GATE_SAMPLE_SIZE_INADEQUATE");
  if (typeof gate.confidenceLevel !== "number" || !Number.isFinite(gate.confidenceLevel) || gate.confidenceLevel < 0.9 || gate.confidenceLevel >= 1) reasonCodes.push("GATE_UNCERTAINTY_POLICY_INVALID");
  if (!Array.isArray(gate.criticalSlices) || gate.criticalSlices.length < 1 || gate.criticalSlices.length > 64 || gate.criticalSlices.some((item) => typeof item !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(item))) reasonCodes.push("GATE_CRITICAL_SLICES_INVALID");
  for (const key of ["requireFreshHoldout", "requirePairedUncertainty", "requireSettledOic6", "requireCostCoverage"]) if (gate[key] !== true) reasonCodes.push(`GATE_${key.toUpperCase()}_REQUIRED`);
  if (hasCohortBinding && (typeof gate.cohortKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(gate.cohortKey) || typeof gate.parentManifestId !== "string" || !uuid.test(gate.parentManifestId) || typeof gate.parentManifestDigest !== "string" || !digest.test(gate.parentManifestDigest))) reasonCodes.push("GATE_COHORT_BINDING_INVALID");
  return { valid: reasonCodes.length === 0, reasonCodes: [...new Set(reasonCodes)].sort() };
}

export function packet76PreDispatchHistorySafe(attempts: Array<{
  status: string;
  providerDispatched: boolean;
  evidenceDigestPresent: boolean;
  artifactPresent: boolean;
  admissionStatus: string | null;
  linkedProviderAttemptCount: number;
}>): boolean {
  return attempts.every((attempt) => attempt.status === "INFRA_FAILURE"
    && !attempt.providerDispatched
    && !attempt.evidenceDigestPresent
    && !attempt.artifactPresent
    && attempt.linkedProviderAttemptCount === 0
    && (attempt.admissionStatus === null || attempt.admissionStatus === "RELEASED" || attempt.admissionStatus === "DENIED"));
}

export function packet76RunEligibility(input: {
  cohortKey: unknown;
  plannedRepetitions: unknown;
  minimumEffectiveN: unknown;
  verificationTier?: unknown;
  releaseValid: boolean;
  holdoutFresh?: boolean;
  analysisStatus: string;
  plannedCases: number;
  terminalCases: number;
  attempts: Array<{ status: string; admitted: boolean; evidenceDigestPresent: boolean; artifactVerified: boolean; admissionSettled: boolean; usageAssessed: boolean; costAssessed: boolean; reportedInputTokens: number | null; reportedOutputTokens: number | null }>;
  recoveryHistoryValid?: boolean;
}): { eligible: boolean; reasonCodes: string[] } {
  const reasons = new Set<string>();
  if (typeof input.cohortKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(input.cohortKey)) reasons.add("COHORT_IDENTITY_INVALID");
  if (!Number.isInteger(input.plannedRepetitions) || input.plannedRepetitions !== 2 || input.minimumEffectiveN !== 2) reasons.add("COHORT_SAMPLE_PLAN_INVALID");
  if (!input.releaseValid) reasons.add("RELEASE_INVALID");
  if (input.verificationTier !== undefined && input.verificationTier !== "OIC_EXECUTED_VERIFIED") reasons.add("EXECUTION_NOT_VERIFIED");
  if (input.holdoutFresh === false) reasons.add("FRESH_HOLDOUT_REQUIRED");
  if (input.analysisStatus !== "COMPLETE" || input.terminalCases !== input.plannedCases || input.plannedCases !== 2) reasons.add("REPORT_EVIDENCE_INCOMPLETE");
  if (input.attempts.length !== input.plannedCases) reasons.add("PHYSICAL_ATTEMPT_DENOMINATOR_MISMATCH");
  if (input.recoveryHistoryValid === false) reasons.add("UNSAFE_PRE_DISPATCH_RECOVERY_HISTORY");
  for (const attempt of input.attempts) {
    if (attempt.status !== "SUCCEEDED" || !attempt.admitted || !attempt.admissionSettled) reasons.add("OIC6_ADMISSION_NOT_SETTLED");
    if (!attempt.evidenceDigestPresent || !attempt.artifactVerified) reasons.add("OUTPUT_EVIDENCE_UNVERIFIED");
    if (!attempt.usageAssessed || !attempt.costAssessed) reasons.add("USAGE_OR_COST_UNKNOWN");
    if (attempt.reportedInputTokens === null || attempt.reportedInputTokens < 0 || attempt.reportedInputTokens > 128) reasons.add("INPUT_TOKEN_LIMIT_UNVERIFIED");
    if (attempt.reportedOutputTokens === null || attempt.reportedOutputTokens < 0 || attempt.reportedOutputTokens > 128) reasons.add("OUTPUT_TOKEN_LIMIT_UNVERIFIED");
  }
  return { eligible: reasons.size === 0, reasonCodes: [...reasons].sort() };
}

export function derivePacket76DnaEvidence(input: {
  reportId: string;
  reportDigest: string;
  reportStatus: string;
  reportDecisionEligible: boolean;
  cohortKey: unknown;
  plannedRepetitions: unknown;
  measurements: Array<{ id: string; caseExecutionId: string; caseRevisionId: string; repetitionOrdinal: number; metricKey: string; metricRevision: number; valueType: string; value: unknown; availability: string; evidenceDigest: string | null }>;
}): { traitKey: "objective_exact_match"; availability: "MEASURED" | "INSUFFICIENT"; evidenceStrength: "STRONG" | "WEAK"; value: Record<string, unknown> | null; uncertainty: Record<string, unknown> | null; sourceDigest: string; provenance: Record<string, unknown> } {
  const reasons = new Set<string>();
  const cohortKey = typeof input.cohortKey === "string" && /^[a-z0-9][a-z0-9._-]{1,95}$/.test(input.cohortKey) ? input.cohortKey : null;
  if (!cohortKey) reasons.add("COHORT_IDENTITY_INVALID");
  if (input.reportStatus !== "COMPLETE") reasons.add("REPORT_INCOMPLETE");
  if (input.reportDecisionEligible !== true) reasons.add("REPORT_NOT_DECISION_ELIGIBLE");
  if (input.plannedRepetitions !== 2 || input.measurements.length !== 2) reasons.add("MINIMUM_EVIDENCE_COHORT_NOT_MET");
  if (input.measurements.some((item) => item.metricKey !== "oic7-objective-exact-match" || item.metricRevision !== 2 || item.valueType !== "BOOLEAN" || typeof item.value !== "boolean" || item.availability !== "MEASURED" || !item.evidenceDigest || !digest.test(item.evidenceDigest))) reasons.add("SOURCE_MEASUREMENTS_UNSUPPORTED");
  if (new Set(input.measurements.map((item) => `${item.caseRevisionId}:${item.repetitionOrdinal}`)).size !== 2 || input.measurements.some((item) => item.repetitionOrdinal !== 1 && item.repetitionOrdinal !== 2)) reasons.add("REPETITION_PAIRING_INVALID");
  const valid = reasons.size === 0;
  const values: number[] = valid ? input.measurements.map((item) => item.value === true ? 1 : 0) : [];
  const mean = values.length === 2 ? values.reduce<number>((sum, value) => sum + value, 0) / values.length : null;
  const provenance = {
    provenance: "PACKET76_COHORT_METRIC",
    cohortKey,
    reportId: input.reportId,
    reportDigest: input.reportDigest,
    measurementIds: input.measurements.map((item) => item.id).sort(),
    caseExecutionIds: input.measurements.map((item) => item.caseExecutionId).sort(),
    repetitionOrdinals: input.measurements.map((item) => item.repetitionOrdinal).sort((a, b) => a - b),
    metricRevisions: [...new Set(input.measurements.map((item) => `${item.metricKey}@${item.metricRevision}`))].sort(),
    methodRevision: OBJECTIVE_ORACLE_METHOD,
    pairedN: valid ? 2 : input.measurements.length,
    decisionEligibilityState: input.reportDecisionEligible,
    reasonCodes: [...reasons].sort()
  };
  const sourceDigest = createHash("sha256").update(JSON.stringify({ provenance, value: mean, uncertaintyMethod: "TWO_REPETITION_EMPIRICAL_RANGE_V1" })).digest("hex");
  return {
    traitKey: "objective_exact_match",
    availability: valid ? "MEASURED" : "INSUFFICIENT",
    evidenceStrength: valid ? "STRONG" : "WEAK",
    value: valid ? { metricKey: "oic7-objective-exact-match", revision: 2, mean, n: 2, successes: values.reduce<number>((sum, value) => sum + value, 0) } : null,
    uncertainty: valid ? { method: "TWO_REPETITION_EMPIRICAL_RANGE_V1", lower: Math.min(...values), upper: Math.max(...values), n: 2 } : null,
    sourceDigest,
    provenance
  };
}

export function validatePredispatchCohort(gate: unknown, plannedEvidenceN: number): { valid: boolean; reasonCodes: string[] } {
  const configured = record(gate);
  if (!Number.isInteger(plannedEvidenceN) || plannedEvidenceN < 0 || !Number.isInteger(configured.minimumEffectiveN) || Number(configured.minimumEffectiveN) > plannedEvidenceN) return { valid: false, reasonCodes: ["GATE_SAMPLE_SIZE_EXCEEDS_COHORT"] };
  return { valid: true, reasonCodes: [] };
}

export function validatePacket76Cohort(value: unknown, caseSchedule: readonly string[], plannedRepetitions: number): { valid: boolean; reasonCodes: string[] } {
  const cohort = record(value);
  const reasons = new Set<string>();
  if (Object.keys(cohort).sort().join(",") !== "cohortKey,minimumEffectiveN,pairingPolicy,slots" || typeof cohort.cohortKey !== "string" || !/^[a-z0-9][a-z0-9._-]{1,95}$/.test(cohort.cohortKey)) reasons.add("COHORT_IDENTITY_INVALID");
  if (cohort.minimumEffectiveN !== 2 || plannedRepetitions !== 2 || caseSchedule.length !== 1) reasons.add("COHORT_PLAN_INVALID");
  if (cohort.pairingPolicy !== "CASE_REVISION_ID_AND_REPETITION_ORDINAL_V1") reasons.add("COHORT_PAIRING_POLICY_INVALID");
  const slots = Array.isArray(cohort.slots) ? cohort.slots : [];
  if (slots.length !== 2 || !caseSchedule.length) reasons.add("COHORT_SLOT_COUNT_INVALID");
  for (const [index, value] of slots.entries()) {
    const slot = record(value);
    if (Object.keys(slot).sort().join(",") !== "caseRevisionId,pairKey,repetitionOrdinal" || slot.caseRevisionId !== caseSchedule[0] || slot.pairKey !== `pair-${index + 1}` || slot.repetitionOrdinal !== index + 1) reasons.add("COHORT_SLOT_IDENTITY_INVALID");
  }
  return { valid: reasons.size === 0, reasonCodes: [...reasons].sort() };
}

/** Conservative local-only estimate for the bounded Packet 7.6 visible prompt. */
export function estimatePacket76Input(textParts: readonly string[]): { valid: boolean; visibleBytes: number; estimatedTokensUpperBound: number; reasonCodes: string[] } {
  const visibleBytes = textParts.reduce((sum, text) => sum + Buffer.byteLength(text, "utf8"), 0);
  const estimatedTokensUpperBound = Math.ceil(visibleBytes / 3) + 8;
  const reasonCodes = [
    ...(visibleBytes > 112 ? ["VISIBLE_INPUT_BUDGET_EXCEEDED"] : []),
    ...(estimatedTokensUpperBound > 120 ? ["ESTIMATED_INPUT_TOKEN_BUDGET_EXCEEDED"] : [])
  ];
  return { valid: reasonCodes.length === 0, visibleBytes, estimatedTokensUpperBound, reasonCodes };
}

export function packet76ComparisonEligibility(input: {
  gate: unknown;
  cohortValid: boolean;
  reportsEligible: boolean;
  freshHoldout: boolean;
  criticalSliceCovered: boolean;
  directlyComparable: boolean;
  estimates: Array<{ availability: string; pairedTrials: number; plannedPairs: number; missingPairs: number; confidence: number | null }>;
}): { eligible: boolean; reasonCodes: string[] } {
  const gate = record(input.gate);
  const reasons = new Set(validatePredispatchDecisionGate(gate).reasonCodes);
  if (!input.cohortValid) reasons.add("COHORT_PAIRING_OR_LINEAGE_INVALID");
  if (!input.reportsEligible) reasons.add("REPORT_EVIDENCE_NOT_DECISION_ELIGIBLE");
  if (!input.freshHoldout) reasons.add("FRESH_HOLDOUT_INVALID");
  if (!input.criticalSliceCovered) reasons.add("CRITICAL_SLICE_COVERAGE_INCOMPLETE");
  if (!input.directlyComparable) reasons.add("PROTOCOLS_NOT_DIRECTLY_COMPARABLE");
  if (input.estimates.length !== 1 || input.estimates.some((estimate) => estimate.availability !== "MEASURED" || estimate.pairedTrials !== 2 || estimate.plannedPairs !== 2 || estimate.missingPairs !== 0 || estimate.confidence !== gate.confidenceLevel)) reasons.add("PAIRED_UNCERTAINTY_INSUFFICIENT");
  return { eligible: reasons.size === 0, reasonCodes: [...reasons].sort() };
}

export function historicalHardBudgetSupportsReplay(input: {
  sourceManifestId: string;
  sourceBudgetRevisionId: string;
  sourceBudgetDigest: string;
  sourceRunCreatedAt: Date;
  policy: { id: string; sourceDigest: string; status: string; unit: string; enforcement: string; effectiveFrom: Date; effectiveTo: Date | null };
}): boolean {
  const { policy } = input;
  return policy.status === "PUBLISHED" && policy.unit === "OIU" && policy.enforcement === "HARD" &&
    input.sourceBudgetRevisionId === policy.id && input.sourceBudgetDigest === policy.sourceDigest &&
    input.sourceRunCreatedAt >= policy.effectiveFrom && (!policy.effectiveTo || input.sourceRunCreatedAt < policy.effectiveTo) &&
    uuid.test(input.sourceManifestId);
}

export function deriveRegradeDnaEvidence(input: {
  reportId: string;
  reportDigest: string;
  reportStatus: string;
  decisionEligible: boolean;
  sourceReportId: string;
  sourceRunId: string;
  sourceManifestId: string;
  gradingManifestId: string;
  bridgeRevisionId: string;
  regradePassId: string;
  plannedCases: number;
  measurements: Array<{ id: string; caseExecutionId: string; metricKey: string; metricRevision: number; judgeType: string; availability: string; evidenceDigest: string | null; provenance: string }>;
  methodRevision: string;
}): { traitKey: string; availability: "INSUFFICIENT"; evidenceStrength: "WEAK"; value: null; provenance: Record<string, unknown> } {
  const reasonCodes = new Set<string>();
  if (input.reportStatus !== "COMPLETE") reasonCodes.add("REPORT_INCOMPLETE");
  if (input.decisionEligible !== true) reasonCodes.add("REPORT_NOT_DECISION_ELIGIBLE");
  if (input.measurements.length < 2 || input.measurements.length < input.plannedCases) reasonCodes.add("MINIMUM_EVIDENCE_COHORT_NOT_MET");
  if (!input.measurements.length || input.measurements.some((item) => item.availability !== "MEASURED" || item.provenance !== "REGRADE" || !item.evidenceDigest || !digest.test(item.evidenceDigest))) reasonCodes.add("SOURCE_MEASUREMENTS_UNSUPPORTED");
  // No published DNA trait definition maps this exact-byte metric to a broader capability trait.
  reasonCodes.add("DNA_TRAIT_DEFINITION_UNAVAILABLE");
  return {
    traitKey: "objective_exact_match",
    availability: "INSUFFICIENT",
    evidenceStrength: "WEAK",
    value: null,
    provenance: {
      provenance: "REGRADE",
      reportId: input.reportId,
      reportDigest: input.reportDigest,
      sourceReportId: input.sourceReportId,
      sourceRunId: input.sourceRunId,
      sourceManifestId: input.sourceManifestId,
      gradingManifestId: input.gradingManifestId,
      bridgeRevisionId: input.bridgeRevisionId,
      regradePassId: input.regradePassId,
      measurementIds: input.measurements.map((item) => item.id).sort(),
      metricRevisions: [...new Set(input.measurements.map((item) => `${item.metricKey}@${item.metricRevision}`))].sort(),
      methodRevision: input.methodRevision,
      completenessState: input.reportStatus,
      decisionEligibilityState: input.decisionEligible,
      plannedCases: input.plannedCases,
      measuredSources: input.measurements.length,
      reasonCodes: [...reasonCodes].sort()
    }
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(record(value)).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value);
}
