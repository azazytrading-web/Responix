ALTER TYPE "WorkflowNodeType" ADD VALUE IF NOT EXISTS 'SUBWORKFLOW';
ALTER TYPE "WorkflowNodeType" ADD VALUE IF NOT EXISTS 'PARALLEL';
ALTER TYPE "WorkflowNodeType" ADD VALUE IF NOT EXISTS 'MERGE';
ALTER TYPE "WorkflowNodeType" ADD VALUE IF NOT EXISTS 'APPROVAL';

CREATE TYPE "WorkflowRuntimeStatus" AS ENUM (
  'CREATED','QUEUED','PREPARING','RUNNING','WAITING','PAUSED','COMPLETED',
  'CANCELLED','FAILED','TIMED_OUT','COMPENSATED'
);
CREATE TYPE "WorkflowNodeRuntimeStatus" AS ENUM (
  'PENDING','PREPARING','RUNNING','WAITING','COMPLETED','SKIPPED','CANCELLED',
  'FAILED','TIMED_OUT','COMPENSATED'
);

ALTER TABLE "workflow_versions" ADD COLUMN "snapshot_hash" TEXT;
ALTER TABLE "workflow_versions" ADD COLUMN "checksum" TEXT;
ALTER TABLE "workflow_versions" ADD COLUMN "compatibility_version" TEXT;

-- Historical versions predate canonical application-level hashing. Mark them as
-- unverified and non-executable while enforcing integrity metadata for every row.
UPDATE "workflow_versions"
SET "snapshot_hash" = md5("id"::text || "snapshot"::text) ||
                      md5("snapshot"::text || "id"::text),
    "checksum" = md5("id"::text || "snapshot"::text || 'checksum') ||
                 md5('checksum' || "id"::text || "snapshot"::text),
    "compatibility_version" = 'legacy-unverified'
WHERE "snapshot_hash" IS NULL;
ALTER TABLE "workflow_versions" ALTER COLUMN "snapshot_hash" SET NOT NULL;
ALTER TABLE "workflow_versions" ALTER COLUMN "checksum" SET NOT NULL;
ALTER TABLE "workflow_versions" ALTER COLUMN "compatibility_version" SET NOT NULL;

CREATE TABLE "workflow_runtime_executions" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL,
  "workflow_id" UUID NOT NULL, "workflow_version_id" UUID NOT NULL,
  "execution_request_id" UUID NOT NULL, "execution_run_id" UUID NOT NULL,
  "parent_execution_id" UUID, "status" "WorkflowRuntimeStatus" NOT NULL DEFAULT 'CREATED',
  "state_version" INTEGER NOT NULL DEFAULT 0, "correlation_id" TEXT NOT NULL,
  "trace_id" TEXT NOT NULL, "idempotency_key" TEXT NOT NULL, "depth" INTEGER NOT NULL DEFAULT 0,
  "max_depth" INTEGER NOT NULL DEFAULT 10, "max_node_executions" INTEGER NOT NULL DEFAULT 1000,
  "timeout_ms" INTEGER NOT NULL, "deadline_at" TIMESTAMP(3) NOT NULL,
  "input" JSONB NOT NULL DEFAULT '{}', "context_snapshot" JSONB NOT NULL, "runtime_context" JSONB NOT NULL,
  "output" JSONB NOT NULL DEFAULT '{}', "pending_node_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "completed_node_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "compensation_plan" JSONB NOT NULL DEFAULT '[]', "workflow_snapshot_hash" TEXT NOT NULL,
  "context_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "failure_code" TEXT,
  "failure_message" TEXT, "cancellation_reason" TEXT, "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3), "duration_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_runtime_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_runtime_executions_workspace_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workflow_runtime_executions_version_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workflow_runtime_executions_request_fkey" FOREIGN KEY ("execution_request_id") REFERENCES "execution_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workflow_runtime_executions_run_fkey" FOREIGN KEY ("execution_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workflow_runtime_executions_execution_run_id_key" ON "workflow_runtime_executions"("execution_run_id");
CREATE UNIQUE INDEX "workflow_runtime_executions_workspace_idempotency_key" ON "workflow_runtime_executions"("workspace_id","idempotency_key");
CREATE INDEX "workflow_runtime_executions_workspace_status_idx" ON "workflow_runtime_executions"("workspace_id","status","created_at");
CREATE INDEX "workflow_runtime_executions_workspace_workflow_idx" ON "workflow_runtime_executions"("workspace_id","workflow_id","created_at");
CREATE INDEX "workflow_runtime_executions_parent_idx" ON "workflow_runtime_executions"("parent_execution_id");

CREATE TABLE "workflow_runtime_node_executions" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "node_key" TEXT NOT NULL,
  "node_type" "WorkflowNodeType" NOT NULL, "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" "WorkflowNodeRuntimeStatus" NOT NULL DEFAULT 'PENDING', "input" JSONB NOT NULL DEFAULT '{}',
  "output" JSONB NOT NULL DEFAULT '{}', "error" JSONB NOT NULL DEFAULT '{}',
  "selected_branch" TEXT, "agent_execution_id" UUID, "stream_session_id" UUID,
  "retry_delay_ms" INTEGER NOT NULL DEFAULT 0, "started_at" TIMESTAMP(3), "ended_at" TIMESTAMP(3),
  "duration_ms" INTEGER, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_runtime_node_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_runtime_nodes_execution_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_runtime_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workflow_runtime_nodes_execution_node_attempt_key" ON "workflow_runtime_node_executions"("execution_id","node_key","attempt");
CREATE INDEX "workflow_runtime_nodes_execution_status_idx" ON "workflow_runtime_node_executions"("execution_id","status","created_at");

CREATE TABLE "workflow_runtime_state_history" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "from_status" "WorkflowRuntimeStatus", "to_status" "WorkflowRuntimeStatus" NOT NULL,
  "actor_id" UUID, "reason" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_runtime_state_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_runtime_states_execution_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_runtime_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workflow_runtime_states_execution_sequence_key" ON "workflow_runtime_state_history"("execution_id","sequence");

CREATE TABLE "workflow_runtime_diagnostics" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "node_key" TEXT,
  "severity" TEXT NOT NULL, "code" TEXT NOT NULL, "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_runtime_diagnostics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_runtime_diagnostics_execution_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_runtime_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "workflow_runtime_diagnostics_execution_idx" ON "workflow_runtime_diagnostics"("execution_id","severity","created_at");

CREATE TABLE "workflow_runtime_metrics" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "node_count" INTEGER NOT NULL DEFAULT 0,
  "completed_node_count" INTEGER NOT NULL DEFAULT 0, "failed_node_count" INTEGER NOT NULL DEFAULT 0,
  "retry_count" INTEGER NOT NULL DEFAULT 0, "parallel_branch_count" INTEGER NOT NULL DEFAULT 0,
  "agent_node_count" INTEGER NOT NULL DEFAULT 0, "streamed_node_count" INTEGER NOT NULL DEFAULT 0,
  "compensation_count" INTEGER NOT NULL DEFAULT 0, "wait_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "execution_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_runtime_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_runtime_metrics_execution_id_key" UNIQUE ("execution_id"),
  CONSTRAINT "workflow_runtime_metrics_execution_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_runtime_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
