import test from "node:test";
import assert from "node:assert/strict";
import { derivePacket76DnaEvidence, deriveRegradeDnaEvidence, estimatePacket76Input, historicalHardBudgetSupportsReplay, isNextOperationalBudgetBridgeRevision, packet76AdmissionBudgetIsAuthorized, packet76ComparisonEligibility, packet76PreDispatchHistorySafe, packet76RunEligibility, resolvePacket76ProviderDispatchLink, validateExactBytesRawOutputBridge, validateOperationalBudgetRebaseline, validatePacket76Cohort, validatePredispatchCohort, validatePredispatchDecisionGate } from "./basis-bridge";
import { OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST } from "./objective-oracle";
import { EvaluationService } from "./evaluation.service";

const method = { judgeId: "judge", judgeDigest: "a".repeat(64), judgeType: "REFERENCE", methodRevision: "REFERENCE_EXACT_BYTES_V1", abstentionPolicy: "ABSTAIN_IF_OUTPUT_OR_ORACLE_UNAVAILABLE", sourceOracleRevision: "REFERENCE_EXACT_BYTES_V1", sourceOracleCodeDigest: OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST };
const source = { id: "source", metricKey: "oic7-objective-exact-match", revision: 1, definitionDigest: "c".repeat(64), definition: { type: "BOOLEAN", unit: "exact_bytes_match", polarity: "HIGH_IS_GOOD", criticality: "REQUIRED", missingSemantics: "Missing output or unknown usage remains unmeasured", applicableDomains: ["reasoning"], minimumEffectiveN: 1, applicableTargetClasses: ["MODEL_WITH_OIC_RUNTIME"], aggregationMethodRevision: "single-trial-boolean-v1", sourceArtifactRequirement: "SEALED_OBJECTIVE_ORACLE", uncertaintyMethodRevision: "not-estimated-n1-v1" } };
const target = { id: "target", metricKey: source.metricKey, revision: 2, definitionDigest: "d".repeat(64), definition: { type: "BOOLEAN", unit: "EXACT_BYTES_MATCH", polarity: "HIGH_IS_GOOD", criticality: "REQUIRED", missingSemantics: "MISSING_OR_UNKNOWN_IS_NOT_MEASURED", applicableDomains: ["reasoning"], minimumEffectiveN: 1, applicableTargetClasses: ["MODEL_WITH_OIC_RUNTIME"], aggregationMethodRevision: "single-trial-boolean-v1", sourceArtifactRequirement: "SEALED_OBJECTIVE_ORACLE", uncertaintyMethodRevision: "not-estimated-n1-v1", rangeOrCategories: { minimum: 0, maximum: 1 }, normalizationRevisionOrNone: "NONE", oracleOrJudgeRevisionId: "judge", methodRevision: "REFERENCE_EXACT_BYTES_V1", metricMeaning: "EXACT_REFERENCE_BYTE_MATCH", scoringAlgorithmRevision: "REFERENCE_EXACT_BYTES_V1", thresholdSemanticsRevision: "BOOLEAN_TRUE_IS_EXACT_MATCH_V1", failureSemanticsRevision: "EXECUTION_FAILURE_FALSE_MISSING_UNMEASURED_V1", languageSemanticsRevision: "BYTEWISE_NO_LOCALE_NORMALIZATION_V1", protectedDataSemanticsRevision: "SEALED_REFERENCE_SERVER_SIDE_ONLY_V1" } };

const budgetProtocol = (id: string, budgetDigest: string) => ({
  targetIdentity: { model: "deepseek" }, targetClass: "MODEL_WITH_OIC_RUNTIME", releaseId: "release", releaseDigest: "release-digest",
  caseSchedule: ["case"], harnessRevision: "h1", harnessDigest: "h".repeat(64), environment: { revisionId: "env", digest: "e".repeat(64) },
  requiredCapabilities: ["OIC6_ADMISSION", "TEXT_GENERATION"], oracleRevision: "REFERENCE_EXACT_BYTES_V1", metricRevisions: [{ id: "metric", digest: "m".repeat(64) }],
  judgeRevisions: [{ id: "judge", digest: "j".repeat(64) }], repetitionPolicy: { plannedRepetitions: 2, seedRoot: "seed-root-123" },
  retryPolicy: { maxAttempts: 1, automaticRetry: false, manualRetry: "DISABLED" }, samplingPolicy: { mode: "FULL_SUITE", plannedCases: 1 }, statisticsRevision: "stats-v1",
  budgetPolicy: { budgetRevisionId: id, budgetRevisionDigest: budgetDigest, reservationUpperBoundOiu: "256", maxInputUnits: 112, maxOutputUnits: 128, maxExecutionMs: 20000 },
  artifactPolicy: { oracleAccess: "SEALED_EVALUATOR_ONLY" }, verificationTier: "OIC_EXECUTED_VERIFIED", evaluationPurpose: "TARGET_EXECUTION", cohort: { cohortKey: "packet76-cohort-v1" }
});
const budgetRow = (id: string, sourceDigest: string, effectiveFrom: Date, effectiveTo: Date | null, amount: string, reservationUpperBound: string | null, planRevisionId: string) => ({ id, applicationId: "app", tenantId: null, planRevisionId, sourceDigest, status: "PUBLISHED", unit: "OIU", enforcement: "HARD", amount, reservationUpperBound, unknownLiabilityRule: "DENY", effectiveFrom, effectiveTo });
const planContinuity = { source: { id: "plan-old", planKey: "oic7-deepseek-canary", applicationId: "app", status: "PUBLISHED", models: ["deepseek"], maxOutputUnits: 128, maxConcurrency: 1 }, target: { id: "plan-new", planKey: "oic7-deepseek-canary", applicationId: "app", status: "PUBLISHED", effectiveFrom: new Date("2026-10-16T11:00:00.000Z"), effectiveTo: new Date("2026-10-16T20:00:00.000Z"), models: ["deepseek"], maxOutputUnits: 128, maxConcurrency: 1 }, modelId: "deepseek" };

void test("operational budget bridge accepts only identical Packet 7.6 basis with a currently active bounded 768 OIU policy", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const result = validateOperationalBudgetRebaseline({ sourceManifestId: "source-manifest", sourceDigest: "a".repeat(64), sourceProtocol: budgetProtocol("old", "c".repeat(64)), targetManifestId: "target-manifest", targetDigest: "b".repeat(64), targetProtocol: budgetProtocol("new", "d".repeat(64)), sourceBudget: budgetRow("old", "c".repeat(64), new Date("2026-10-16T02:00:00.000Z"), new Date("2026-10-16T06:00:00.000Z"), "1280", "256", "plan-old"), targetBudget: budgetRow("new", "d".repeat(64), new Date("2026-10-16T11:00:00.000Z"), new Date("2026-10-16T20:00:00.000Z"), "768", "256", "plan-new"), admissionPlanContinuity: planContinuity, now });
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.evidence.result, "VALID");
  assert.deepEqual(result.evidence.changedFields, ["budgetPolicy.budgetRevisionId", "budgetPolicy.budgetRevisionDigest", "OIC6.validity", "OIC6.planRevisionId"]);
});

void test("operational budget bridge rejects a semantic change or any budget outside the owner authorization", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const base = { sourceManifestId: "source-manifest", sourceDigest: "a".repeat(64), sourceProtocol: budgetProtocol("old", "c".repeat(64)), targetManifestId: "target-manifest", targetDigest: "b".repeat(64), targetProtocol: budgetProtocol("new", "d".repeat(64)), sourceBudget: budgetRow("old", "c".repeat(64), new Date("2026-10-16T02:00:00.000Z"), new Date("2026-10-16T06:00:00.000Z"), "1280", "256", "plan-old"), targetBudget: budgetRow("new", "d".repeat(64), new Date("2026-10-16T11:00:00.000Z"), new Date("2026-10-16T20:00:00.000Z"), "768", "256", "plan-new"), admissionPlanContinuity: planContinuity, now };
  assert.ok(validateOperationalBudgetRebaseline({ ...base, targetProtocol: { ...base.targetProtocol, retryPolicy: { maxAttempts: 2, automaticRetry: false, manualRetry: "DISABLED" } } }).reasonCodes.includes("NON_BUDGET_PROTOCOL_DIMENSION_CHANGED"));
  assert.ok(validateOperationalBudgetRebaseline({ ...base, targetBudget: { ...base.targetBudget, amount: "1024" } }).reasonCodes.includes("TARGET_BUDGET_CAPACITY_OUTSIDE_AUTHORIZATION"));
  assert.ok(validateOperationalBudgetRebaseline({ ...base, targetBudget: { ...base.targetBudget, effectiveTo: null } }).reasonCodes.includes("TARGET_BUDGET_NOT_ACTIVE_BOUNDED_HARD_DENY"));
  assert.ok(validateOperationalBudgetRebaseline({ ...base, targetBudget: { ...base.targetBudget, unknownLiabilityRule: "HOLD_MAXIMUM" } }).reasonCodes.includes("TARGET_BUDGET_NOT_ACTIVE_BOUNDED_HARD_DENY"));
});

void test("Parent rebaseline can verify a missing attempt-level dispatch pointer only through one matching succeeded provider attempt on its settled admission", () => {
  const expected = { providerKey: "openai-compatible", upstreamModelId: "deepseek-flash", bindingId: "binding", connectionId: "connection" };
  const providerAttempts = [{ id: "provider-attempt", admissionId: "admission", status: "SUCCEEDED", usageStatus: "REPORTED", startedAt: new Date("2026-10-16T12:00:00.000Z"), ...expected }];
  const fallback = resolvePacket76ProviderDispatchLink({ attempt: { providerAttemptId: null, providerDispatchStartedAt: null, admissionId: "admission" }, providerAttempts, expected });
  assert.deepEqual(fallback, { valid: true, providerAttemptId: "provider-attempt", providerDispatchStartedAt: new Date("2026-10-16T12:00:00.000Z"), linkage: "ADMISSION" });
  assert.equal(resolvePacket76ProviderDispatchLink({ attempt: { providerAttemptId: null, providerDispatchStartedAt: null, admissionId: "admission" }, providerAttempts: [...providerAttempts, { ...providerAttempts[0]!, id: "duplicate" }], expected }).valid, false);
  assert.equal(resolvePacket76ProviderDispatchLink({ attempt: { providerAttemptId: null, providerDispatchStartedAt: null, admissionId: "admission" }, providerAttempts: [{ ...providerAttempts[0]!, usageStatus: "UNKNOWN" }], expected }).valid, false);
});

void test("operational budget bridge revisions advance exactly once without reopening historical revisions", () => {
  assert.equal(isNextOperationalBudgetBridgeRevision(1, null), true);
  assert.equal(isNextOperationalBudgetBridgeRevision(2, 1), true);
  assert.equal(isNextOperationalBudgetBridgeRevision(1, 1), false);
  assert.equal(isNextOperationalBudgetBridgeRevision(3, 1), false);
  assert.equal(isNextOperationalBudgetBridgeRevision(2.5, 1), false);
});

void test("Parent reconciliation accepts only the same run's settled, bounded historical supplemental admission", () => {
  const baseBudget = { sourceBudgetRevisionId: "base", admissionBudgetRevisionId: "base", admissionCapacityExtensionId: null, admissionCreatedAt: new Date("2026-10-16T02:15:47.132Z"), applicationId: "app", tenantId: null, runId: "run", campaignId: "campaign", cohortKey: "cohort", legAmount: "256", legState: "SETTLED", legUnit: "OIU" };
  assert.equal(packet76AdmissionBudgetIsAuthorized(baseBudget), true);
  const base = { sourceBudgetRevisionId: "base", admissionBudgetRevisionId: "supplemental", admissionCapacityExtensionId: "extension", admissionCreatedAt: new Date("2026-10-16T19:21:36.909Z"), applicationId: "app", tenantId: null, runId: "run", campaignId: "campaign", cohortKey: "cohort", legAmount: "256", legState: "SETTLED", legUnit: "OIU" };
  const extension = { id: "extension", applicationId: "app", tenantId: null, runId: "run", campaignId: "campaign", cohortKey: "cohort", status: "CLOSED", baseBudgetRevisionId: "base", budgetRevisionId: "supplemental", authorizedOiu: "1536", perAdmissionLimitOiu: "256", expiresAt: new Date("2026-10-16T22:58:21.883Z"), budget: { id: "supplemental", status: "PUBLISHED", unit: "OIU", enforcement: "HARD", unknownLiabilityRule: "DENY", amount: "1536", reservationUpperBound: "256", effectiveFrom: new Date("2026-10-16T10:58:21.883Z"), effectiveTo: new Date("2026-10-16T22:58:21.883Z") } };
  assert.equal(packet76AdmissionBudgetIsAuthorized({ ...base, extension }), true);
  assert.equal(packet76AdmissionBudgetIsAuthorized({ ...base, admissionCapacityExtensionId: null, extension }), false);
  assert.equal(packet76AdmissionBudgetIsAuthorized({ ...base, extension: { ...extension, runId: "other-run" } }), false);
  assert.equal(packet76AdmissionBudgetIsAuthorized({ ...base, extension: { ...extension, budget: { ...extension.budget, unknownLiabilityRule: "HOLD_MAXIMUM" } } }), false);
  assert.equal(packet76AdmissionBudgetIsAuthorized({ ...base, legAmount: "257", extension }), false);
});

void test("accepts only the explicit metadata aliases for exact-byte raw-output regrade", () => {
  const result = validateExactBytesRawOutputBridge(source, target, method);
  assert.equal(result.valid, true);
  assert.equal(result.evidence.result, "VALID");
  assert.deepEqual(result.changedFields, []);
});

void test("rejects scoring, threshold, benchmark-domain, and oracle semantic changes", () => {
  for (const [key, value] of [["polarity", "HIGH_IS_BAD"], ["rangeOrCategories", { minimum: 0, maximum: 0 }], ["applicableDomains", ["coding"]], ["methodRevision", "DIFFERENT_ORACLE"], ["failureSemanticsRevision", "ASSUME_SUCCESS_V1"], ["languageSemanticsRevision", "NORMALIZE_LOCALE_V1"], ["protectedDataSemanticsRevision", "EXPOSE_REFERENCE_V1"]] as const) {
    const result = validateExactBytesRawOutputBridge(source, { ...target, definition: { ...target.definition, [key]: value } }, method);
    assert.equal(result.valid, false);
  }
});

void test("requires pinned reference judge and source oracle code evidence", () => {
  const result = validateExactBytesRawOutputBridge(source, target, { ...method, sourceOracleCodeDigest: "unknown" });
  assert.equal(result.valid, false);
  assert.ok(result.reasonCodes.includes("SEMANTIC_MISMATCH_REFERENCEMETHODEVIDENCE"));
});

void test("basis draft cannot be published by its author", async () => {
  const authorId = "c73fcd8d-670c-4ca1-9f42-7a152418bd87";
  const app = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
  const draft = { id: "e2000000-0000-4000-8000-000000000001", applicationId: app, tenantId: null, kind: "METRIC", draftKey: "metric-v2", payload: { metricKey: "metric.test", revision: 2, definition: {} }, payloadDigest: "a".repeat(64), status: "DRAFT", createdByPrincipalId: authorId };
  const db = { oicEvaluationBasisDraft: { findFirst: () => Promise.resolve(draft) } };
  const service = new EvaluationService(db as never, {} as never);
  await assert.rejects(service.publishBasisDraft({ id: authorId, applicationId: app, scopes: ["oic:evaluation:manage"], tenantIds: [] }, draft.id), /DISTINCT_PUBLISHER_REQUIRED/);
});

void test("candidate decision gate is frozen with paired, cost, settlement and fresh-holdout requirements", () => {
  const gate = { gateKey: "packet76-pre-dispatch", revision: "oic-paired-gate-v1", minimumEffectiveN: 2, confidenceLevel: 0.95, criticalSlices: ["reasoning"], requireFreshHoldout: true, requirePairedUncertainty: true, requireSettledOic6: true, requireCostCoverage: true };
  assert.equal(validatePredispatchDecisionGate(gate).valid, true);
  assert.ok(validatePredispatchDecisionGate({ ...gate, minimumEffectiveN: 1 }).reasonCodes.includes("GATE_SAMPLE_SIZE_INADEQUATE"));
  assert.equal(validatePredispatchDecisionGate({ ...gate, requireCostCoverage: false }).valid, false);
  assert.deepEqual(validatePredispatchCohort(gate, 1), { valid: false, reasonCodes: ["GATE_SAMPLE_SIZE_EXCEEDS_COHORT"] });
  assert.deepEqual(validatePredispatchCohort(gate, 2), { valid: true, reasonCodes: [] });
});

void test("Packet 7.6 report eligibility requires exactly two verified, admitted, settled, bounded observations", () => {
  const attempts = [1, 2].map(() => ({ status: "SUCCEEDED", admitted: true, evidenceDigestPresent: true, artifactVerified: true, admissionSettled: true, usageAssessed: true, costAssessed: true, reportedInputTokens: 12, reportedOutputTokens: 1 }));
  const common = { cohortKey: "packet76-cohort-v1", plannedRepetitions: 2, minimumEffectiveN: 2, verificationTier: "OIC_EXECUTED_VERIFIED", releaseValid: true, holdoutFresh: true, analysisStatus: "COMPLETE", plannedCases: 2, terminalCases: 2, attempts };
  assert.deepEqual(packet76RunEligibility(common), { eligible: true, reasonCodes: [] });
  assert.ok(packet76RunEligibility({ ...common, attempts: [attempts[0]!] }).reasonCodes.includes("PHYSICAL_ATTEMPT_DENOMINATOR_MISMATCH"));
  assert.ok(packet76RunEligibility({ ...common, attempts: [attempts[0]!, { ...attempts[1]!, reportedInputTokens: null }] }).reasonCodes.includes("INPUT_TOKEN_LIMIT_UNVERIFIED"));
  assert.ok(packet76RunEligibility({ ...common, attempts: [attempts[0]!, { ...attempts[1]!, costAssessed: false }] }).reasonCodes.includes("USAGE_OR_COST_UNKNOWN"));
  assert.ok(packet76RunEligibility({ ...common, holdoutFresh: false }).reasonCodes.includes("FRESH_HOLDOUT_REQUIRED"));
  assert.ok(packet76RunEligibility({ ...common, verificationTier: "OIC_EXECUTED_PARTIAL" }).reasonCodes.includes("EXECUTION_NOT_VERIFIED"));
});

void test("Packet 7.6 allows a successful observation after only safely reconciled pre-dispatch failures", () => {
  const history = ["RELEASED", "RELEASED", null].map((admissionStatus) => ({ status: "INFRA_FAILURE", providerDispatched: false, evidenceDigestPresent: false, artifactPresent: false, admissionStatus, linkedProviderAttemptCount: 0 }));
  assert.equal(packet76PreDispatchHistorySafe(history), true);
  assert.equal(packet76PreDispatchHistorySafe([{ ...history[0]!, providerDispatched: true }]), false);
  assert.equal(packet76PreDispatchHistorySafe([{ ...history[0]!, admissionStatus: "SETTLED" }]), false);
  assert.equal(packet76PreDispatchHistorySafe([{ ...history[0]!, linkedProviderAttemptCount: 1 }]), false);
  assert.equal(packet76PreDispatchHistorySafe([{ ...history[0]!, evidenceDigestPresent: true }]), false);
  assert.ok(packet76RunEligibility({
    cohortKey: "packet76-cohort-v1", plannedRepetitions: 2, minimumEffectiveN: 2,
    verificationTier: "OIC_EXECUTED_VERIFIED", releaseValid: true, holdoutFresh: true,
    analysisStatus: "COMPLETE", plannedCases: 2, terminalCases: 2,
    attempts: [1, 2].map(() => ({ status: "SUCCEEDED", admitted: true, evidenceDigestPresent: true, artifactVerified: true, admissionSettled: true, usageAssessed: true, costAssessed: true, reportedInputTokens: 12, reportedOutputTokens: 1 })),
    recoveryHistoryValid: true
  }).eligible);
  assert.ok(packet76RunEligibility({
    cohortKey: "packet76-cohort-v1", plannedRepetitions: 2, minimumEffectiveN: 2,
    verificationTier: "OIC_EXECUTED_VERIFIED", releaseValid: true, holdoutFresh: true,
    analysisStatus: "COMPLETE", plannedCases: 2, terminalCases: 2,
    attempts: [1, 2].map(() => ({ status: "SUCCEEDED", admitted: true, evidenceDigestPresent: true, artifactVerified: true, admissionSettled: true, usageAssessed: true, costAssessed: true, reportedInputTokens: 12, reportedOutputTokens: 1 })),
    recoveryHistoryValid: false
  }).reasonCodes.includes("UNSAFE_PRE_DISPATCH_RECOVERY_HISTORY"));
});

void test("Packet 7.6 DNA projection carries exactly two cohort measurements and fails closed otherwise", () => {
  const measurements = [1, 2].map((repetitionOrdinal) => ({ id: `m${repetitionOrdinal}`, caseExecutionId: `e${repetitionOrdinal}`, caseRevisionId: "case", repetitionOrdinal, metricKey: "oic7-objective-exact-match", metricRevision: 2, valueType: "BOOLEAN", value: true, availability: "MEASURED", evidenceDigest: "a".repeat(64) }));
  const common = { reportId: "report", reportDigest: "b".repeat(64), reportStatus: "COMPLETE", reportDecisionEligible: true, cohortKey: "packet76-cohort-v1", plannedRepetitions: 2, measurements };
  const measured = derivePacket76DnaEvidence(common);
  assert.equal(measured.availability, "MEASURED");
  assert.deepEqual(measured.value, { metricKey: "oic7-objective-exact-match", revision: 2, mean: 1, n: 2, successes: 2 });
  assert.deepEqual(measured.provenance.measurementIds, ["m1", "m2"]);
  assert.equal(derivePacket76DnaEvidence({ ...common, reportDecisionEligible: false }).availability, "INSUFFICIENT");
  assert.equal(derivePacket76DnaEvidence({ ...common, measurements: [measurements[0]!] }).availability, "INSUFFICIENT");
});

void test("Packet 7.6 local token preflight enforces visible bytes and an eight-token margin without provider tokenization", () => {
  const safe = estimatePacket76Input(["Follow requested format only.", "Reply exactly: YES."]);
  assert.equal(safe.valid, true);
  assert.ok(safe.estimatedTokensUpperBound <= 120);
  assert.equal(estimatePacket76Input(["x".repeat(113)]).valid, false);
});

void test("Packet 7.6 freezes exactly two explicit repetition pairing slots for one case", () => {
  const caseId = "c73fcd8d-670c-4ca1-9f42-7a152418bd87";
  const cohort = { cohortKey: "packet76-cohort-v1", minimumEffectiveN: 2, pairingPolicy: "CASE_REVISION_ID_AND_REPETITION_ORDINAL_V1", slots: [1, 2].map((repetitionOrdinal) => ({ pairKey: `pair-${repetitionOrdinal}`, caseRevisionId: caseId, repetitionOrdinal })) };
  assert.equal(validatePacket76Cohort(cohort, [caseId], 2).valid, true);
  assert.equal(validatePacket76Cohort({ ...cohort, slots: [cohort.slots[0]!] }, [caseId], 2).valid, false);
  assert.equal(validatePacket76Cohort(cohort, [caseId], 1).valid, false);
});

void test("Packet 7.6 comparison eligibility fails closed on missing cohort, reports, slice, holdout, or paired uncertainty", () => {
  const gate = { gateKey: "packet76-pre-dispatch", revision: "oic-paired-gate-v1", minimumEffectiveN: 2, confidenceLevel: 0.95, criticalSlices: ["reasoning"], requireFreshHoldout: true, requirePairedUncertainty: true, requireSettledOic6: true, requireCostCoverage: true };
  const estimate = { availability: "MEASURED", pairedTrials: 2, plannedPairs: 2, missingPairs: 0, confidence: 0.95 };
  const common = { gate, cohortValid: true, reportsEligible: true, freshHoldout: true, criticalSliceCovered: true, directlyComparable: true, estimates: [estimate] };
  assert.deepEqual(packet76ComparisonEligibility(common), { eligible: true, reasonCodes: [] });
  assert.ok(packet76ComparisonEligibility({ ...common, reportsEligible: false }).reasonCodes.includes("REPORT_EVIDENCE_NOT_DECISION_ELIGIBLE"));
  assert.ok(packet76ComparisonEligibility({ ...common, freshHoldout: false }).reasonCodes.includes("FRESH_HOLDOUT_INVALID"));
  assert.ok(packet76ComparisonEligibility({ ...common, criticalSliceCovered: false }).reasonCodes.includes("CRITICAL_SLICE_COVERAGE_INCOMPLETE"));
  assert.ok(packet76ComparisonEligibility({ ...common, estimates: [{ ...estimate, pairedTrials: 1 }] }).reasonCodes.includes("PAIRED_UNCERTAINTY_INSUFFICIENT"));
  assert.ok(packet76ComparisonEligibility({ ...common, gate: { ...gate, requireCostCoverage: false } }).reasonCodes.includes("GATE_REQUIRECOSTCOVERAGE_REQUIRED"));
});

void test("historical hard budget supports replay only when it covered the source run", () => {
  const policy = { id: "budget", sourceDigest: "a".repeat(64), status: "PUBLISHED", unit: "OIU", enforcement: "HARD", effectiveFrom: new Date("2026-10-14T12:00:00.000Z"), effectiveTo: new Date("2026-10-15T03:14:00.000Z") };
  const common = { sourceManifestId: "b2ad125a-9d34-4b41-9231-3d25b75bceea", sourceBudgetRevisionId: policy.id, sourceBudgetDigest: policy.sourceDigest, policy };
  assert.equal(historicalHardBudgetSupportsReplay({ ...common, sourceRunCreatedAt: new Date("2026-10-14T13:18:00.000Z") }), true);
  assert.equal(historicalHardBudgetSupportsReplay({ ...common, sourceRunCreatedAt: new Date("2026-10-15T03:14:00.000Z") }), false);
  assert.equal(historicalHardBudgetSupportsReplay({ ...common, sourceBudgetDigest: "b".repeat(64), sourceRunCreatedAt: new Date("2026-10-14T13:18:00.000Z") }), false);
  assert.equal(historicalHardBudgetSupportsReplay({ ...common, sourceRunCreatedAt: new Date("2026-10-14T11:59:59.999Z") }), false);
});

void test("regrade DNA projection records source lineage but stays insufficient without cohort and trait gates", () => {
  const projection = deriveRegradeDnaEvidence({
    reportId: "report", reportDigest: "a".repeat(64), reportStatus: "COMPLETE", decisionEligible: false,
    sourceReportId: "old-report", sourceRunId: "run", sourceManifestId: "source-epm", gradingManifestId: "grading-epm",
    bridgeRevisionId: "bridge", regradePassId: "pass", plannedCases: 1, methodRevision: "REFERENCE_EXACT_BYTES_V1",
    measurements: [{ id: "measurement", caseExecutionId: "case-execution", metricKey: "oic7-objective-exact-match", metricRevision: 2, judgeType: "REFERENCE", availability: "MEASURED", evidenceDigest: "b".repeat(64), provenance: "REGRADE" }]
  });
  assert.equal(projection.value, null);
  assert.equal(projection.availability, "INSUFFICIENT");
  assert.equal(projection.provenance.provenance, "REGRADE");
  assert.deepEqual(projection.provenance.measurementIds, ["measurement"]);
  assert.ok((projection.provenance.reasonCodes as string[]).includes("REPORT_NOT_DECISION_ELIGIBLE"));
  assert.ok((projection.provenance.reasonCodes as string[]).includes("MINIMUM_EVIDENCE_COHORT_NOT_MET"));
  assert.ok((projection.provenance.reasonCodes as string[]).includes("DNA_TRAIT_DEFINITION_UNAVAILABLE"));
});
