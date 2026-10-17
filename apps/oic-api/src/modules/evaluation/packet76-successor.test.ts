import test from "node:test";
import assert from "node:assert/strict";
import { PACKET76_SUCCESSOR_SCOPE, packet76SafeSuccessorPreDispatchFailure, packet76SuccessorAccountingRunEligible, packet76SuccessorBaseBudgetEligible, packet76SuccessorResumeHistoryEligible } from "./packet76-successor";

const now = new Date("2026-10-16T23:50:00.000Z");
const baseBudget = {
  runId: PACKET76_SUCCESSOR_SCOPE.runId,
  campaignId: PACKET76_SUCCESSOR_SCOPE.campaignId,
  manifestId: PACKET76_SUCCESSOR_SCOPE.manifestId,
  cohortKey: PACKET76_SUCCESSOR_SCOPE.cohortKey,
  budgetRevisionId: PACKET76_SUCCESSOR_SCOPE.budgetRevisionId,
  budgetRevisionDigest: "a".repeat(64),
  protocolBound: "256",
  retryLimit: 1,
  automaticRetry: false,
  applicationId: PACKET76_SUCCESSOR_SCOPE.applicationId,
  tenantId: null,
  campaignStatus: "ACTIVE",
  campaignBudgetRevisionId: PACKET76_SUCCESSOR_SCOPE.budgetRevisionId,
  campaignLimit: "768",
  campaignPerAdmission: "256",
  budgetStatus: "PUBLISHED",
  budgetApplicationId: PACKET76_SUCCESSOR_SCOPE.applicationId,
  budgetTenantId: null,
  budgetPlanRevisionId: PACKET76_SUCCESSOR_SCOPE.planRevisionId,
  budgetSourceDigest: "a".repeat(64),
  budgetAmount: "768",
  budgetUpperBound: "256",
  budgetUnit: "OIU",
  budgetEnforcement: "HARD",
  unknownLiabilityRule: "DENY",
  budgetEffectiveFrom: new Date(now.getTime() - 1000),
  budgetEffectiveTo: new Date(now.getTime() + 60_000),
  now
};

void test("successor base admission uses only the exact published 768 OIU hard DENY authority", () => {
  assert.equal(packet76SuccessorBaseBudgetEligible(baseBudget), true);
  assert.equal(packet76SuccessorBaseBudgetEligible({ ...baseBudget, budgetAmount: "1024" }), false);
  assert.equal(packet76SuccessorBaseBudgetEligible({ ...baseBudget, unknownLiabilityRule: "HOLD_MAXIMUM" }), false);
  assert.equal(packet76SuccessorBaseBudgetEligible({ ...baseBudget, budgetPlanRevisionId: "1b5561bd-2e32-4552-831c-87e77b9aa987" }), false);
  assert.equal(packet76SuccessorBaseBudgetEligible({ ...baseBudget, automaticRetry: true }), false);
});

void test("successor accounting accepts completed runs only when both planned cases executed", () => {
  assert.equal(packet76SuccessorAccountingRunEligible("PARTIAL", ["EXECUTED", "FAILED"]), true);
  assert.equal(packet76SuccessorAccountingRunEligible("EXECUTED", ["EXECUTED", "EXECUTED"]), true);
  assert.equal(packet76SuccessorAccountingRunEligible("EXECUTED", ["EXECUTED", "FAILED"]), false);
  assert.equal(packet76SuccessorAccountingRunEligible("RUNNING", ["EXECUTED", "EXECUTED"]), false);
});

void test("only the exact no-admission, no-dispatch capacity-extension preflight failure can resume", () => {
  const failure = {
    runId: PACKET76_SUCCESSOR_SCOPE.runId,
    manifestId: PACKET76_SUCCESSOR_SCOPE.manifestId,
    campaignId: PACKET76_SUCCESSOR_SCOPE.campaignId,
    applicationId: PACKET76_SUCCESSOR_SCOPE.applicationId,
    cohortKey: PACKET76_SUCCESSOR_SCOPE.cohortKey,
    failureClass: "PACKET76_CAPACITY_EXTENSION_UNAVAILABLE",
    failureStage: "ADMISSION_PREFLIGHT",
    safeErrorCode: "PACKET76_CAPACITY_EXTENSION_UNAVAILABLE",
    status: "INFRA_FAILURE",
    admissionId: null,
    providerAttemptId: null,
    providerDispatchStartedAt: null,
    artifactManifestPresent: false,
    evidenceDigestPresent: false,
    attemptOrdinal: 1,
    repetitionOrdinal: 1
  };
  assert.equal(packet76SafeSuccessorPreDispatchFailure(failure), true);
  assert.equal(packet76SafeSuccessorPreDispatchFailure({ ...failure, providerDispatchStartedAt: now }), false);
  assert.equal(packet76SafeSuccessorPreDispatchFailure({ ...failure, admissionId: "admission" }), false);
  assert.equal(packet76SafeSuccessorPreDispatchFailure({ ...failure, failureClass: "PROVIDER_UNAVAILABLE" }), false);
  assert.equal(packet76SafeSuccessorPreDispatchFailure({ ...failure, repetitionOrdinal: 3 }), false);
  assert.equal(packet76SafeSuccessorPreDispatchFailure({ ...failure, failureClass: "WORKER_LEASE_EXPIRED", failureStage: "PREFLIGHT_PROTOCOL", safeErrorCode: null, attemptOrdinal: 2 }), true);
  assert.equal(packet76SafeSuccessorPreDispatchFailure({ ...failure, failureClass: "WORKER_LEASE_EXPIRED", failureStage: "PROVIDER_DISPATCH_STARTED", safeErrorCode: null, attemptOrdinal: 2 }), false);
});

void test("successor resume history admits only audited no-dispatch local failures and the active bounded attempt", () => {
  const caseExecutionId = "243be845-22c2-4176-8193-67a01bc39050";
  const attempts = [
    { id: "prior-1", attemptOrdinal: 1, status: "INFRA_FAILURE", failureClass: "PACKET76_CAPACITY_EXTENSION_UNAVAILABLE", failureStage: "ADMISSION_PREFLIGHT", lastDurableStage: "ADMISSION_PREFLIGHT", safeErrorCode: "PACKET76_CAPACITY_EXTENSION_UNAVAILABLE", admissionId: null, providerAttemptId: null, providerDispatchStartedAt: null, artifactManifestPresent: false, evidenceDigestPresent: false, recoveryGenerationId: null, repetitionOrdinal: 1 },
    { id: "prior-2", attemptOrdinal: 2, status: "INFRA_FAILURE", failureClass: "WORKER_LEASE_EXPIRED", failureStage: null, lastDurableStage: "PREFLIGHT_PROTOCOL", safeErrorCode: null, admissionId: null, providerAttemptId: null, providerDispatchStartedAt: null, artifactManifestPresent: false, evidenceDigestPresent: false, recoveryGenerationId: null, repetitionOrdinal: 1 },
    { id: "current-3", attemptOrdinal: 3, status: "CREATED", failureClass: null, failureStage: null, lastDurableStage: null, safeErrorCode: null, admissionId: null, providerAttemptId: null, providerDispatchStartedAt: null, artifactManifestPresent: false, evidenceDigestPresent: false, recoveryGenerationId: null, repetitionOrdinal: 1 }
  ];
  const resumeMarkers = [
    { requestId: `p76-successor-pre-dispatch-${caseExecutionId}`, metadata: { runId: PACKET76_SUCCESSOR_SCOPE.runId, previousAttemptId: "prior-1", repetitionOrdinal: 1, providerDispatchOccurredBeforeResume: false, priorAdmissionPresent: false, additionalBudgetReserved: false, maxPhysicalAttemptsAfterResume: 2 } },
    { requestId: `p76-successor-pre-dispatch-${caseExecutionId}-attempt-3`, metadata: { runId: PACKET76_SUCCESSOR_SCOPE.runId, previousAttemptId: "prior-2", repetitionOrdinal: 1, providerDispatchOccurredBeforeResume: false, priorAdmissionPresent: false, additionalBudgetReserved: false, maxPhysicalAttemptsAfterResume: 3 } }
  ];
  const history = {
    runId: PACKET76_SUCCESSOR_SCOPE.runId, manifestId: PACKET76_SUCCESSOR_SCOPE.manifestId,
    campaignId: PACKET76_SUCCESSOR_SCOPE.campaignId, applicationId: PACKET76_SUCCESSOR_SCOPE.applicationId,
    cohortKey: PACKET76_SUCCESSOR_SCOPE.cohortKey, caseExecutionId, workStatus: "LEASED",
    workAttemptCount: 3, workMaxAttempts: 3, currentAttemptId: "current-3", attempts, resumeMarkers
  };
  assert.equal(packet76SuccessorResumeHistoryEligible(history), true);
  assert.equal(packet76SuccessorResumeHistoryEligible({ ...history, resumeMarkers: [resumeMarkers[0]!] }), false);
  assert.equal(packet76SuccessorResumeHistoryEligible({ ...history, attempts: attempts.map((item, index) => index === 1 ? { ...item, providerDispatchStartedAt: now } : item) }), false);
  assert.equal(packet76SuccessorResumeHistoryEligible({ ...history, currentAttemptId: "other" }), false);
});
