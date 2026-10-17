ALTER TABLE "OicEvaluationAttempt"
  ADD COLUMN "failureStage" VARCHAR(48),
  ADD COLUMN "safeErrorCode" VARCHAR(64),
  ADD COLUMN "safeErrorType" VARCHAR(64),
  ADD COLUMN "safeErrorMessage" VARCHAR(240),
  ADD COLUMN "errorFingerprint" CHAR(64),
  ADD COLUMN "failureRecordedAt" TIMESTAMPTZ(6);

CREATE TABLE "OicEvaluationPreflightDiagnostic" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "runId" UUID NOT NULL,
  "workItemId" UUID NOT NULL,
  "caseExecutionId" UUID NOT NULL,
  "sourceAttemptId" UUID NOT NULL,
  "manifestId" UUID NOT NULL,
  "releaseId" UUID NOT NULL,
  "cohortKey" VARCHAR(96) NOT NULL,
  "pairKey" VARCHAR(96) NOT NULL,
  "repetitionOrdinal" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'RUNNING',
  "lastCompletedStage" VARCHAR(48),
  "failingStage" VARCHAR(48),
  "safeErrorCode" VARCHAR(64),
  "safeErrorType" VARCHAR(64),
  "safeErrorMessage" VARCHAR(240),
  "errorFingerprint" CHAR(64),
  "result" JSONB,
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  "initiatedByPrincipalId" UUID NOT NULL,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationPreflightDiagnostic_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OicEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "OicEvaluationWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_caseExecutionId_fkey" FOREIGN KEY ("caseExecutionId") REFERENCES "OicEvaluationCaseExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "OicEvaluationAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "OicEvaluationProtocolManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "OicEvaluationRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_initiatedByPrincipalId_fkey" FOREIGN KEY ("initiatedByPrincipalId") REFERENCES "OicServicePrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationPreflightDiagnostic_repetitionOrdinal_check" CHECK ("repetitionOrdinal" >= 1),
  CONSTRAINT "OicEvaluationPreflightDiagnostic_status_check" CHECK ("status" IN ('RUNNING', 'READY', 'FAILED')),
  CONSTRAINT "OicEvaluationPreflightDiagnostic_errorFingerprint_check" CHECK ("errorFingerprint" IS NULL OR "errorFingerprint" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "OicEvaluationPreflightDiagnostic_applicationId_runId_startedAt_idx" ON "OicEvaluationPreflightDiagnostic"("applicationId", "runId", "startedAt");
CREATE INDEX "OicEvaluationPreflightDiagnostic_workItemId_startedAt_idx" ON "OicEvaluationPreflightDiagnostic"("workItemId", "startedAt");
CREATE INDEX "OicEvaluationPreflightDiagnostic_status_startedAt_idx" ON "OicEvaluationPreflightDiagnostic"("status", "startedAt");
