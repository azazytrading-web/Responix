export const PACKET76_SUCCESSOR_SCOPE = Object.freeze({
  applicationId: "7f25c69e-bdbb-4949-ad7b-ef6412119850",
  runId: "733615b4-15c7-42a9-a247-1e24b4218ae7",
  campaignId: "fc8a3bc9-ae98-4f22-b26c-77c23a690d39",
  manifestId: "9a16d64f-ea1f-4ae2-b50d-35fefc30d0c0",
  budgetRevisionId: "e87bf0a7-571a-47b3-b567-137f3ad042d5",
  planRevisionId: "8b7e4ad4-01cd-4909-8e9c-83cf3dc03771",
  cohortKey: "packet76-cohort-20261016-v1",
  authorizedOiu: "768",
  perAdmissionOiu: "256",
  baseCampaignLimitOiu: "768"
});

export function packet76SuccessorBaseBudgetEligible(input: {
  runId: string;
  campaignId: string | null;
  manifestId: string;
  cohortKey: unknown;
  budgetRevisionId: unknown;
  budgetRevisionDigest: unknown;
  protocolBound: unknown;
  retryLimit: unknown;
  automaticRetry: unknown;
  applicationId: string;
  tenantId: string | null;
  campaignStatus: string;
  campaignBudgetRevisionId: string;
  campaignLimit: string;
  campaignPerAdmission: string;
  budgetStatus: string;
  budgetApplicationId: string | null;
  budgetTenantId: string | null;
  budgetPlanRevisionId: string | null;
  budgetSourceDigest: string;
  budgetAmount: string;
  budgetUpperBound: string | null;
  budgetUnit: string;
  budgetEnforcement: string;
  unknownLiabilityRule: string;
  budgetEffectiveFrom: Date;
  budgetEffectiveTo: Date | null;
  now: Date;
}): boolean {
  const scope = PACKET76_SUCCESSOR_SCOPE;
  return input.runId === scope.runId
    && input.campaignId === scope.campaignId
    && input.manifestId === scope.manifestId
    && input.applicationId === scope.applicationId
    && input.tenantId === null
    && input.cohortKey === scope.cohortKey
    && input.budgetRevisionId === scope.budgetRevisionId
    && typeof input.budgetRevisionDigest === "string"
    && /^[a-f0-9]{64}$/.test(input.budgetRevisionDigest)
    && input.protocolBound === scope.perAdmissionOiu
    && input.retryLimit === 1
    && input.automaticRetry === false
    && input.campaignStatus === "ACTIVE"
    && input.campaignBudgetRevisionId === scope.budgetRevisionId
    && input.campaignLimit === scope.baseCampaignLimitOiu
    && input.campaignPerAdmission === scope.perAdmissionOiu
    && input.budgetStatus === "PUBLISHED"
    && input.budgetApplicationId === scope.applicationId
    && input.budgetTenantId === null
    && input.budgetPlanRevisionId === scope.planRevisionId
    && input.budgetSourceDigest === input.budgetRevisionDigest
    && input.budgetAmount === scope.authorizedOiu
    && input.budgetUpperBound === scope.perAdmissionOiu
    && input.budgetUnit === "OIU"
    && input.budgetEnforcement === "HARD"
    && input.unknownLiabilityRule === "DENY"
    && input.budgetEffectiveFrom <= input.now
    && input.budgetEffectiveTo !== null
    && input.budgetEffectiveTo > input.now;
}

export function packet76SuccessorAccountingRunEligible(runStatus: string, caseStatuses: string[]): boolean {
  return runStatus === "PARTIAL"
    || (runStatus === "EXECUTED" && caseStatuses.length === 2 && caseStatuses.every((status) => status === "EXECUTED"));
}

export function packet76SafeSuccessorPreDispatchFailure(input: {
  runId: string;
  manifestId: string;
  campaignId: string | null;
  applicationId: string;
  cohortKey: unknown;
  failureClass: string | null;
  failureStage: string | null;
  safeErrorCode: string | null;
  status: string;
  admissionId: string | null;
  providerAttemptId: string | null;
  providerDispatchStartedAt: Date | null;
  artifactManifestPresent: boolean;
  evidenceDigestPresent: boolean;
  attemptOrdinal: number;
  repetitionOrdinal: number;
}): boolean {
  const exactInitialCapacityFailure = input.failureClass === "PACKET76_CAPACITY_EXTENSION_UNAVAILABLE"
    && input.failureStage === "ADMISSION_PREFLIGHT"
    && input.safeErrorCode === "PACKET76_CAPACITY_EXTENSION_UNAVAILABLE"
    && input.attemptOrdinal === 1;
  const exactLocalResumeLeaseExpiry = input.failureClass === "WORKER_LEASE_EXPIRED"
    && input.failureStage === "PREFLIGHT_PROTOCOL"
    && input.safeErrorCode === null
    && input.attemptOrdinal === 2;
  return input.runId === PACKET76_SUCCESSOR_SCOPE.runId
    && input.manifestId === PACKET76_SUCCESSOR_SCOPE.manifestId
    && input.campaignId === PACKET76_SUCCESSOR_SCOPE.campaignId
    && input.applicationId === PACKET76_SUCCESSOR_SCOPE.applicationId
    && input.cohortKey === PACKET76_SUCCESSOR_SCOPE.cohortKey
    && input.status === "INFRA_FAILURE"
    && (exactInitialCapacityFailure || exactLocalResumeLeaseExpiry)
    && input.admissionId === null
    && input.providerAttemptId === null
    && input.providerDispatchStartedAt === null
    && !input.artifactManifestPresent
    && !input.evidenceDigestPresent
    && input.attemptOrdinal === (exactInitialCapacityFailure ? 1 : 2)
    && (input.repetitionOrdinal === 1 || input.repetitionOrdinal === 2);
}

export function packet76SuccessorResumeHistoryEligible(input: {
  runId: string;
  manifestId: string;
  campaignId: string | null;
  applicationId: string;
  cohortKey: unknown;
  caseExecutionId: string;
  workStatus: string;
  workAttemptCount: number;
  workMaxAttempts: number;
  currentAttemptId: string;
  attempts: Array<{
    id: string;
    attemptOrdinal: number;
    status: string;
    failureClass: string | null;
    failureStage: string | null;
    lastDurableStage: string | null;
    safeErrorCode: string | null;
    admissionId: string | null;
    providerAttemptId: string | null;
    providerDispatchStartedAt: Date | null;
    artifactManifestPresent: boolean;
    evidenceDigestPresent: boolean;
    recoveryGenerationId: string | null;
    repetitionOrdinal: number;
  }>;
  resumeMarkers: Array<{ requestId: string | null; metadata: unknown }>;
}): boolean {
  const attemptCount = input.attempts.length;
  if (input.runId !== PACKET76_SUCCESSOR_SCOPE.runId
    || input.manifestId !== PACKET76_SUCCESSOR_SCOPE.manifestId
    || input.campaignId !== PACKET76_SUCCESSOR_SCOPE.campaignId
    || input.applicationId !== PACKET76_SUCCESSOR_SCOPE.applicationId
    || input.cohortKey !== PACKET76_SUCCESSOR_SCOPE.cohortKey
    || input.workStatus !== "LEASED"
    || attemptCount < 2 || attemptCount > 3
    || input.workAttemptCount !== attemptCount || input.workMaxAttempts !== attemptCount
    || input.resumeMarkers.length !== attemptCount - 1
    || input.attempts.at(-1)?.id !== input.currentAttemptId) return false;

  for (let index = 0; index < attemptCount - 1; index += 1) {
    const attempt = input.attempts[index]!;
    const failureStage = attempt.failureStage ?? attempt.lastDurableStage;
    if (attempt.attemptOrdinal !== index + 1 || attempt.repetitionOrdinal < 1 || attempt.repetitionOrdinal > 2
      || attempt.status !== "INFRA_FAILURE" || attempt.admissionId || attempt.providerAttemptId || attempt.providerDispatchStartedAt
      || attempt.artifactManifestPresent || attempt.evidenceDigestPresent || attempt.recoveryGenerationId) return false;
    const exactFailure = packet76SafeSuccessorPreDispatchFailure({
      runId: input.runId, manifestId: input.manifestId, campaignId: input.campaignId, applicationId: input.applicationId,
      cohortKey: input.cohortKey, failureClass: attempt.failureClass, failureStage,
      safeErrorCode: attempt.safeErrorCode, status: attempt.status, admissionId: attempt.admissionId,
      providerAttemptId: attempt.providerAttemptId, providerDispatchStartedAt: attempt.providerDispatchStartedAt,
      artifactManifestPresent: attempt.artifactManifestPresent, evidenceDigestPresent: attempt.evidenceDigestPresent,
      attemptOrdinal: attempt.attemptOrdinal, repetitionOrdinal: attempt.repetitionOrdinal
    });
    if (!exactFailure) return false;
    const markerKey = index === 0
      ? `p76-successor-pre-dispatch-${input.caseExecutionId}`
      : `p76-successor-pre-dispatch-${input.caseExecutionId}-attempt-${index + 2}`;
    const marker = input.resumeMarkers.find((item) => item.requestId === markerKey);
    if (!marker || typeof marker.metadata !== "object" || marker.metadata === null || Array.isArray(marker.metadata)) return false;
    const metadata = marker.metadata as Record<string, unknown>;
    if (metadata.runId !== input.runId || metadata.previousAttemptId !== attempt.id
      || metadata.repetitionOrdinal !== attempt.repetitionOrdinal || metadata.providerDispatchOccurredBeforeResume !== false
      || metadata.priorAdmissionPresent !== false || typeof metadata.additionalBudgetReserved !== "boolean"
      || (metadata.additionalBudgetReserved && (metadata.withinExistingAuthorization !== true || metadata.reservedOiu !== PACKET76_SUCCESSOR_SCOPE.perAdmissionOiu))
      || metadata.maxPhysicalAttemptsAfterResume !== index + 2) return false;
  }
  const current = input.attempts[attemptCount - 1]!;
  if (current.attemptOrdinal !== attemptCount || current.status !== "CREATED" || current.admissionId || current.providerAttemptId
    || current.providerDispatchStartedAt || current.artifactManifestPresent || current.evidenceDigestPresent || current.recoveryGenerationId
    || current.repetitionOrdinal < 1 || current.repetitionOrdinal > 2) return false;
  return true;
}
