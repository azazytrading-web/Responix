CREATE TYPE "ExecutionKernelStatus" AS ENUM (
  'REQUESTED', 'QUEUED', 'STARTING', 'RUNNING', 'PAUSED',
  'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'
);
CREATE TYPE "ExecutionStepStatus" AS ENUM (
  'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'SKIPPED'
);
CREATE TYPE "ExecutionSourceType" AS ENUM (
  'PROFILE', 'WORKFLOW', 'AGENT', 'PROMPT', 'KNOWLEDGE',
  'TOOL', 'PROVIDER', 'WORKSPACE', 'MANUAL', 'SYSTEM'
);
CREATE TYPE "ExecutionEventActorType" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "ExecutionLogLevel" AS ENUM ('TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR');

CREATE TABLE "execution_requests" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "requested_by" UUID NOT NULL,
  "source_type" "ExecutionSourceType" NOT NULL,
  "source_reference_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "correlation_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_requests_workspace_idempotency_key"
  ON "execution_requests"("workspace_id", "idempotency_key");
CREATE INDEX "execution_requests_workspace_correlation_idx"
  ON "execution_requests"("workspace_id", "correlation_id", "requested_at");
CREATE INDEX "execution_requests_workspace_source_idx"
  ON "execution_requests"("workspace_id", "source_type", "source_reference_id");
CREATE INDEX "execution_requests_actor_requested_idx"
  ON "execution_requests"("requested_by", "requested_at");

CREATE TABLE "execution_runs" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "request_id" UUID NOT NULL,
  "parent_run_id" UUID,
  "status" "ExecutionKernelStatus" NOT NULL DEFAULT 'REQUESTED',
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "event_sequence" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "failure_code" TEXT,
  "failure_message" TEXT,
  "failure_metadata" JSONB,
  "runtime_metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "execution_runs_workspace_status_idx"
  ON "execution_runs"("workspace_id", "status", "created_at");
CREATE INDEX "execution_runs_request_created_idx"
  ON "execution_runs"("request_id", "created_at");
CREATE INDEX "execution_runs_parent_idx" ON "execution_runs"("parent_run_id");

CREATE TABLE "execution_steps" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "step_type" TEXT NOT NULL,
  "name" TEXT,
  "status" "ExecutionStepStatus" NOT NULL DEFAULT 'PENDING',
  "input_metadata" JSONB NOT NULL DEFAULT '{}',
  "output_metadata" JSONB NOT NULL DEFAULT '{}',
  "error_metadata" JSONB NOT NULL DEFAULT '{}',
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_steps_run_sequence_key"
  ON "execution_steps"("run_id", "sequence");
CREATE INDEX "execution_steps_workspace_status_idx"
  ON "execution_steps"("workspace_id", "status", "created_at");

CREATE TABLE "execution_events" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "previous_status" "ExecutionKernelStatus",
  "current_status" "ExecutionKernelStatus",
  "message" TEXT,
  "actor_type" "ExecutionEventActorType" NOT NULL,
  "actor_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_events_run_sequence_key"
  ON "execution_events"("run_id", "sequence");
CREATE INDEX "execution_events_workspace_type_idx"
  ON "execution_events"("workspace_id", "event_type", "occurred_at");

CREATE TABLE "execution_logs" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "step_id" UUID,
  "level" "ExecutionLogLevel" NOT NULL,
  "message" TEXT NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "execution_logs_workspace_level_idx"
  ON "execution_logs"("workspace_id", "level", "created_at");
CREATE INDEX "execution_logs_run_created_idx"
  ON "execution_logs"("run_id", "created_at");
CREATE INDEX "execution_logs_correlation_created_idx"
  ON "execution_logs"("correlation_id", "created_at");

ALTER TABLE "execution_requests" ADD CONSTRAINT "execution_requests_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "execution_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_parent_run_id_fkey"
  FOREIGN KEY ("parent_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_step_id_fkey"
  FOREIGN KEY ("step_id") REFERENCES "execution_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
