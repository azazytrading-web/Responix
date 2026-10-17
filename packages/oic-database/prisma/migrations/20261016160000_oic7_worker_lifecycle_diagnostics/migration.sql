ALTER TABLE "OicEvaluationAttempt"
  ADD COLUMN "lifecycleStage" VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  ADD COLUMN "lifecycleUpdatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "leaseOwner" VARCHAR(128),
  ADD COLUMN "leaseAcquiredAt" TIMESTAMPTZ(6),
  ADD COLUMN "leaseExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN "leaseHeartbeatAt" TIMESTAMPTZ(6),
  ADD COLUMN "providerAttemptId" UUID,
  ADD COLUMN "providerDispatchStartedAt" TIMESTAMPTZ(6);

ALTER TABLE "OicEvaluationWorkItem"
  ADD COLUMN "leaseAcquiredAt" TIMESTAMPTZ(6),
  ADD COLUMN "leaseHeartbeatAt" TIMESTAMPTZ(6),
  ADD COLUMN "leaseHeartbeatCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OicEvaluationAttempt"
  ADD CONSTRAINT "OicEvaluationAttempt_lifecycle_stage_check"
    CHECK ("lifecycleStage" IN ('CREATED','LEASE_ACQUIRED','PREFLIGHT','ADMISSION_REQUESTED','ADMISSION_GRANTED','PROVIDER_ATTEMPT_CREATED','PROVIDER_DISPATCH_STARTED','PROVIDER_RESPONSE_RECEIVED','EVIDENCE_PERSISTING','REPORTING','COMPLETED','FAILED')),
  ADD CONSTRAINT "OicEvaluationAttempt_lifecycle_dispatch_check"
    CHECK ("providerDispatchStartedAt" IS NULL OR "providerAttemptId" IS NOT NULL);

CREATE INDEX "OicEvaluationAttempt_lifecycle_updated_idx"
  ON "OicEvaluationAttempt" ("lifecycleStage", "lifecycleUpdatedAt");
