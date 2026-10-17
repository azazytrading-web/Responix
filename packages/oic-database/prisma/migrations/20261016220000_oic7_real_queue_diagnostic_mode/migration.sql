ALTER TABLE "OicEvaluationRun"
  ADD COLUMN "diagnosticOnly" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "diagnosticSourceRunId" UUID;

ALTER TABLE "OicEvaluationRun"
  ADD CONSTRAINT "OicEvaluationRun_diagnostic_source_check"
  CHECK (("diagnosticOnly" = FALSE AND "diagnosticSourceRunId" IS NULL) OR
         ("diagnosticOnly" = TRUE AND "diagnosticSourceRunId" IS NOT NULL));


ALTER TABLE "OicEvaluationWorkItem"
  ADD COLUMN "executionMode" VARCHAR(16) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "diagnosticProbeId" UUID,
  ADD CONSTRAINT "OicEvaluationWorkItem_execution_mode_check"
    CHECK (("executionMode" = 'STANDARD' AND "diagnosticProbeId" IS NULL) OR
           ("executionMode" = 'DIAGNOSTIC' AND "diagnosticProbeId" IS NOT NULL));

ALTER TABLE "OicEvaluationPreflightDiagnostic"
  ADD COLUMN "queueRunId" UUID,
  ADD COLUMN "queueWorkItemId" UUID,
  ADD COLUMN "queueCaseExecutionId" UUID,
  ADD COLUMN "workerAttemptId" UUID,
  ADD COLUMN "leaseOwner" VARCHAR(128),
  ADD COLUMN "claimedAt" TIMESTAMPTZ(6),
  ADD COLUMN "leaseAcquiredAt" TIMESTAMPTZ(6),
  ADD COLUMN "leaseHeartbeatCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "OicEvaluationPreflightDiagnostic_queueWorkItemId_key"
  ON "OicEvaluationPreflightDiagnostic"("queueWorkItemId")
  WHERE "queueWorkItemId" IS NOT NULL;
