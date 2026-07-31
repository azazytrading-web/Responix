CREATE TYPE "RetrievalExecutionMode" AS ENUM ('KEYWORD', 'SEMANTIC', 'HYBRID');
CREATE TYPE "RetrievalExecutionStatus" AS ENUM ('COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "retrieval_executions" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL,
  "retrieval_runtime_snapshot_id" UUID NOT NULL, "execution_request_id" UUID,
  "execution_run_id" UUID, "mode" "RetrievalExecutionMode" NOT NULL,
  "status" "RetrievalExecutionStatus" NOT NULL, "normalized_query" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL, "source_hash" TEXT NOT NULL,
  "compatibility_version" TEXT NOT NULL, "retrieval_package" JSONB NOT NULL,
  "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
  "cache_hit" BOOLEAN NOT NULL DEFAULT false, "duration_ms" INTEGER NOT NULL,
  "candidate_count" INTEGER NOT NULL DEFAULT 0, "result_count" INTEGER NOT NULL DEFAULT 0,
  "token_count" INTEGER NOT NULL DEFAULT 0, "failure_code" TEXT, "failure_message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retrieval_executions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "retrieval_executions_snapshot_id_fkey" FOREIGN KEY ("retrieval_runtime_snapshot_id") REFERENCES "retrieval_runtime_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "retrieval_executions_workspace_status_idx" ON "retrieval_executions"("workspace_id", "status", "created_at");
CREATE INDEX "retrieval_executions_workspace_request_hash_idx" ON "retrieval_executions"("workspace_id", "request_hash", "created_at");
CREATE INDEX "retrieval_executions_workspace_snapshot_idx" ON "retrieval_executions"("workspace_id", "retrieval_runtime_snapshot_id");

CREATE TABLE "retrieval_execution_diagnostics" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "severity" TEXT NOT NULL,
  "code" TEXT NOT NULL, "path" TEXT NOT NULL, "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_execution_diagnostics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retrieval_execution_diagnostics_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "retrieval_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "retrieval_execution_diagnostics_execution_idx" ON "retrieval_execution_diagnostics"("execution_id", "severity", "created_at");

CREATE TABLE "retrieval_execution_metrics" (
  "id" UUID NOT NULL, "execution_id" UUID NOT NULL, "query_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "filter_duration_ms" INTEGER NOT NULL DEFAULT 0, "ranking_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "packaging_duration_ms" INTEGER NOT NULL DEFAULT 0, "cache_lookup_ms" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_execution_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retrieval_execution_metrics_execution_id_key" UNIQUE ("execution_id"),
  CONSTRAINT "retrieval_execution_metrics_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "retrieval_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
