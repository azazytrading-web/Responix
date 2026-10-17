ALTER TABLE "OicEvaluationSchedulerCursor"
  ADD COLUMN "workerInstanceId" VARCHAR(128),
  ADD COLUMN "workerGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workerState" VARCHAR(16),
  ADD COLUMN "workerReasonCode" VARCHAR(48),
  ADD COLUMN "workerStartedAt" TIMESTAMPTZ(6),
  ADD COLUMN "workerHeartbeatAt" TIMESTAMPTZ(6),
  ADD COLUMN "workerLeaseUntil" TIMESTAMPTZ(6),
  ADD COLUMN "workerCapabilities" JSONB;

ALTER TABLE "OicEvaluationSchedulerCursor"
  ADD CONSTRAINT "OicEvaluationSchedulerCursor_worker_state_check"
  CHECK ("workerState" IS NULL OR "workerState" IN ('STARTING', 'READY', 'DEGRADED', 'DRAINING'));
