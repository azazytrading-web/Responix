CREATE TYPE "AgentExecutionOrchestrationStatus" AS ENUM ('PREPARING', 'READY', 'FAILED', 'CANCELLED');

CREATE TABLE "agent_execution_orchestrations" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "execution_request_id" UUID NOT NULL,
  "execution_run_id" UUID NOT NULL,
  "agent_runtime_snapshot_id" UUID NOT NULL,
  "prompt_execution_payload_id" UUID NOT NULL,
  "provider_runtime_snapshot_id" UUID NOT NULL,
  "conversation_runtime_snapshot_id" UUID,
  "execution_pipeline_snapshot_id" UUID NOT NULL,
  "status" "AgentExecutionOrchestrationStatus" NOT NULL DEFAULT 'PREPARING',
  "correlation_id" TEXT NOT NULL,
  "orchestration_plan" JSONB NOT NULL,
  "runtime_diagnostics" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "plan_hash" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "ready_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_execution_orchestrations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "agent_execution_diagnostics" (
  "id" UUID NOT NULL,
  "orchestration_id" UUID NOT NULL,
  "severity" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_execution_diagnostics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_execution_orchestrations_execution_run_id_key" ON "agent_execution_orchestrations"("execution_run_id");
CREATE UNIQUE INDEX "agent_execution_orchestrations_workspace_request_key" ON "agent_execution_orchestrations"("workspace_id", "execution_request_id");
CREATE INDEX "agent_execution_orchestrations_workspace_status_idx" ON "agent_execution_orchestrations"("workspace_id", "status", "created_at");
CREATE INDEX "agent_execution_orchestrations_workspace_correlation_idx" ON "agent_execution_orchestrations"("workspace_id", "correlation_id", "created_at");
CREATE INDEX "agent_execution_diagnostics_orchestration_severity_idx" ON "agent_execution_diagnostics"("orchestration_id", "severity", "created_at");
ALTER TABLE "agent_execution_orchestrations" ADD CONSTRAINT "agent_execution_orchestrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_execution_diagnostics" ADD CONSTRAINT "agent_execution_diagnostics_orchestration_id_fkey" FOREIGN KEY ("orchestration_id") REFERENCES "agent_execution_orchestrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
