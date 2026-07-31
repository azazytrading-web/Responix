ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'INTERNAL';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'HTTP';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'DATABASE';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'FILE';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'STORAGE';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'WORKFLOW';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'AGENT';
ALTER TYPE "ToolDefinitionType" ADD VALUE IF NOT EXISTS 'COMPOSITE';

CREATE TYPE "ToolRuntimeStatus" AS ENUM ('CREATED', 'QUEUED', 'PREPARING', 'RUNNING', 'STREAMING', 'COMPLETED', 'CANCELLED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "ToolAttemptStatus" AS ENUM ('RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "ToolExecutionMode" AS ENUM ('SYNC', 'STREAM');

ALTER TABLE "tool_versions" ADD COLUMN "snapshot_hash" TEXT;
ALTER TABLE "tool_versions" ADD COLUMN "checksum" TEXT;
ALTER TABLE "tool_versions" ADD COLUMN "compatibility_version" TEXT;
UPDATE "tool_versions"
SET "snapshot_hash" = md5("id"::text || "snapshot"::text) || md5("snapshot"::text || "id"::text),
    "checksum" = md5("id"::text || "snapshot"::text || 'checksum') || md5('checksum' || "id"::text || "snapshot"::text),
    "compatibility_version" = 'legacy-unverified'
WHERE "snapshot_hash" IS NULL;
ALTER TABLE "tool_versions" ALTER COLUMN "snapshot_hash" SET NOT NULL;
ALTER TABLE "tool_versions" ALTER COLUMN "checksum" SET NOT NULL;
ALTER TABLE "tool_versions" ALTER COLUMN "compatibility_version" SET NOT NULL;

CREATE TABLE "tool_runtime_executions" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "tool_id" UUID NOT NULL,
  "tool_version_id" UUID NOT NULL,
  "execution_request_id" UUID NOT NULL,
  "execution_run_id" UUID NOT NULL,
  "parent_execution_id" UUID,
  "parent_execution_run_id" UUID,
  "status" "ToolRuntimeStatus" NOT NULL DEFAULT 'CREATED',
  "mode" "ToolExecutionMode" NOT NULL DEFAULT 'SYNC',
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "correlation_id" TEXT NOT NULL,
  "trace_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "normalized_input" JSONB NOT NULL,
  "context_snapshot" JSONB NOT NULL,
  "tool_snapshot" JSONB NOT NULL,
  "policy_snapshot" JSONB NOT NULL,
  "output" JSONB,
  "partial_output" JSONB,
  "tool_snapshot_hash" TEXT NOT NULL,
  "input_hash" TEXT NOT NULL,
  "context_hash" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "timeout_ms" INTEGER NOT NULL,
  "deadline_at" TIMESTAMP(3) NOT NULL,
  "failure_code" TEXT,
  "failure_message" TEXT,
  "cancellation_reason" TEXT,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_runtime_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_runtime_attempts" (
  "id" UUID NOT NULL,
  "execution_id" UUID NOT NULL,
  "attempt" INTEGER NOT NULL,
  "status" "ToolAttemptStatus" NOT NULL DEFAULT 'RUNNING',
  "request" JSONB NOT NULL,
  "response" JSONB,
  "error" JSONB,
  "response_bytes" INTEGER NOT NULL DEFAULT 0,
  "retry_delay_ms" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tool_runtime_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_runtime_state_history" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "from_status" "ToolRuntimeStatus", "to_status" "ToolRuntimeStatus" NOT NULL,
  "actor_id" UUID NOT NULL, "reason" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tool_runtime_state_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_runtime_diagnostics" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "attempt" INTEGER,
  "severity" TEXT NOT NULL, "code" TEXT NOT NULL, "path" TEXT, "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tool_runtime_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_runtime_events" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "type" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tool_runtime_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_runtime_metrics" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "retry_count" INTEGER NOT NULL DEFAULT 0, "request_bytes" INTEGER NOT NULL DEFAULT 0,
  "response_bytes" INTEGER NOT NULL DEFAULT 0, "execution_duration_ms" INTEGER,
  "transport_duration_ms" INTEGER, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_runtime_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tool_runtime_executions_workspace_id_idempotency_key_key" ON "tool_runtime_executions"("workspace_id", "idempotency_key");
CREATE INDEX "tool_runtime_executions_workspace_id_status_created_at_idx" ON "tool_runtime_executions"("workspace_id", "status", "created_at");
CREATE INDEX "tool_runtime_executions_workspace_id_tool_id_created_at_idx" ON "tool_runtime_executions"("workspace_id", "tool_id", "created_at");
CREATE INDEX "tool_runtime_executions_execution_run_id_idx" ON "tool_runtime_executions"("execution_run_id");
CREATE INDEX "tool_runtime_executions_parent_execution_id_idx" ON "tool_runtime_executions"("parent_execution_id");
CREATE INDEX "tool_runtime_executions_deadline_at_status_idx" ON "tool_runtime_executions"("deadline_at", "status");
CREATE UNIQUE INDEX "tool_runtime_attempts_execution_id_attempt_key" ON "tool_runtime_attempts"("execution_id", "attempt");
CREATE INDEX "tool_runtime_attempts_execution_id_created_at_idx" ON "tool_runtime_attempts"("execution_id", "created_at");
CREATE UNIQUE INDEX "tool_runtime_state_history_execution_id_sequence_key" ON "tool_runtime_state_history"("execution_id", "sequence");
CREATE INDEX "tool_runtime_state_history_execution_id_created_at_idx" ON "tool_runtime_state_history"("execution_id", "created_at");
CREATE INDEX "tool_runtime_diagnostics_execution_id_created_at_idx" ON "tool_runtime_diagnostics"("execution_id", "created_at");
CREATE INDEX "tool_runtime_diagnostics_execution_id_code_idx" ON "tool_runtime_diagnostics"("execution_id", "code");
CREATE UNIQUE INDEX "tool_runtime_events_execution_id_sequence_key" ON "tool_runtime_events"("execution_id", "sequence");
CREATE INDEX "tool_runtime_events_execution_id_created_at_idx" ON "tool_runtime_events"("execution_id", "created_at");
CREATE UNIQUE INDEX "tool_runtime_metrics_execution_id_key" ON "tool_runtime_metrics"("execution_id");

ALTER TABLE "tool_runtime_executions" ADD CONSTRAINT "tool_runtime_executions_tool_version_id_fkey" FOREIGN KEY ("tool_version_id") REFERENCES "tool_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tool_runtime_attempts" ADD CONSTRAINT "tool_runtime_attempts_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "tool_runtime_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_runtime_state_history" ADD CONSTRAINT "tool_runtime_state_history_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "tool_runtime_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_runtime_diagnostics" ADD CONSTRAINT "tool_runtime_diagnostics_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "tool_runtime_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_runtime_events" ADD CONSTRAINT "tool_runtime_events_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "tool_runtime_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_runtime_metrics" ADD CONSTRAINT "tool_runtime_metrics_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "tool_runtime_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
