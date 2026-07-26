CREATE TYPE "AiRuntimeReservationStatus" AS ENUM ('QUEUED', 'ACTIVE', 'RELEASED');
CREATE TYPE "AiRuntimeExecutionStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'REJECTED');
CREATE TYPE "AiRuntimeFinalizationKind" AS ENUM ('SUCCESS', 'FAILURE');
CREATE TYPE "AiRuntimeFinalizationStatus" AS ENUM ('PENDING', 'COMPLETED');

ALTER TABLE "ai_models"
ADD COLUMN "supports_json" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ai_workspace_runtime_limits" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "daily_request_limit" INTEGER,
  "monthly_request_limit" INTEGER,
  "daily_token_limit" INTEGER,
  "monthly_token_limit" INTEGER,
  "daily_cost_limit" DECIMAL(14, 6),
  "monthly_cost_limit" DECIMAL(14, 6),
  "max_concurrent_invocations" INTEGER,
  "max_queue_depth" INTEGER,
  "max_context_tokens" INTEGER,
  "max_output_tokens" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_workspace_runtime_limits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_runtime_reservations" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "request_id" TEXT NOT NULL,
  "owner_token" UUID NOT NULL,
  "status" "AiRuntimeReservationStatus" NOT NULL DEFAULT 'QUEUED',
  "estimated_input_tokens" INTEGER NOT NULL,
  "estimated_output_tokens" INTEGER NOT NULL,
  "estimated_total_tokens" INTEGER NOT NULL,
  "estimated_cost" DECIMAL(14, 6) NOT NULL,
  "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_at" TIMESTAMP(3),
  "heartbeat_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_runtime_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_runtime_accounting" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "invocation_id" UUID,
  "provider_id" UUID,
  "model_id" UUID,
  "request_id" TEXT NOT NULL,
  "estimated_input_tokens" INTEGER NOT NULL,
  "estimated_output_tokens" INTEGER NOT NULL,
  "estimated_total_tokens" INTEGER NOT NULL,
  "estimated_cost" DECIMAL(14, 6) NOT NULL,
  "actual_prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "actual_completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "actual_cached_tokens" INTEGER NOT NULL DEFAULT 0,
  "actual_total_tokens" INTEGER NOT NULL DEFAULT 0,
  "actual_cost" DECIMAL(14, 6) NOT NULL DEFAULT 0,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "queue_wait_ms" INTEGER NOT NULL DEFAULT 0,
  "reservation_ms" INTEGER NOT NULL DEFAULT 0,
  "execution_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "provider_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "status" "AiRuntimeExecutionStatus" NOT NULL,
  "failure_reason" TEXT,
  "timeout_reason" TEXT,
  "cancelled" BOOLEAN NOT NULL DEFAULT false,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_runtime_accounting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_runtime_finalizations" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "invocation_id" UUID NOT NULL,
  "request_id" TEXT NOT NULL,
  "kind" "AiRuntimeFinalizationKind" NOT NULL,
  "status" "AiRuntimeFinalizationStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_runtime_finalizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_workspace_runtime_limits_workspace_id_key" ON "ai_workspace_runtime_limits"("workspace_id");
CREATE UNIQUE INDEX "ai_runtime_reservations_request_id_key" ON "ai_runtime_reservations"("request_id");
CREATE INDEX "ai_runtime_reservations_workspace_id_status_created_at_idx" ON "ai_runtime_reservations"("workspace_id", "status", "created_at");
CREATE INDEX "ai_runtime_reservations_expires_at_status_idx" ON "ai_runtime_reservations"("expires_at", "status");
CREATE INDEX "ai_runtime_reservations_workspace_id_id_owner_token_status_idx" ON "ai_runtime_reservations"("workspace_id", "id", "owner_token", "status");
CREATE UNIQUE INDEX "ai_runtime_accounting_invocation_id_key" ON "ai_runtime_accounting"("invocation_id");
CREATE UNIQUE INDEX "ai_runtime_accounting_request_id_key" ON "ai_runtime_accounting"("request_id");
CREATE INDEX "ai_runtime_accounting_workspace_id_recorded_at_status_idx" ON "ai_runtime_accounting"("workspace_id", "recorded_at", "status");
CREATE INDEX "ai_runtime_accounting_provider_id_recorded_at_idx" ON "ai_runtime_accounting"("provider_id", "recorded_at");
CREATE INDEX "ai_runtime_accounting_model_id_recorded_at_idx" ON "ai_runtime_accounting"("model_id", "recorded_at");
CREATE UNIQUE INDEX "ai_runtime_finalizations_invocation_id_key" ON "ai_runtime_finalizations"("invocation_id");
CREATE UNIQUE INDEX "ai_runtime_finalizations_request_id_key" ON "ai_runtime_finalizations"("request_id");
CREATE INDEX "ai_runtime_finalizations_status_created_at_idx" ON "ai_runtime_finalizations"("status", "created_at");
CREATE INDEX "ai_runtime_finalizations_workspace_id_status_created_at_idx" ON "ai_runtime_finalizations"("workspace_id", "status", "created_at");

ALTER TABLE "ai_workspace_runtime_limits" ADD CONSTRAINT "ai_workspace_runtime_limits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_reservations" ADD CONSTRAINT "ai_runtime_reservations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_accounting" ADD CONSTRAINT "ai_runtime_accounting_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_accounting" ADD CONSTRAINT "ai_runtime_accounting_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_accounting" ADD CONSTRAINT "ai_runtime_accounting_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_accounting" ADD CONSTRAINT "ai_runtime_accounting_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_finalizations" ADD CONSTRAINT "ai_runtime_finalizations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_runtime_finalizations" ADD CONSTRAINT "ai_runtime_finalizations_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
