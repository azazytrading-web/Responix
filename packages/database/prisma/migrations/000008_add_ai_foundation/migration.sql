CREATE TYPE "AiCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
CREATE TYPE "AiInvocationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED');
CREATE TYPE "AiMemoryScope" AS ENUM ('WORKSPACE', 'CUSTOMER', 'CONVERSATION', 'AGENT', 'SESSION');
CREATE TYPE "AiCacheStatus" AS ENUM ('ACTIVE', 'INVALIDATED', 'EXPIRED');

CREATE TABLE "ai_provider_credentials" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "encrypted_secret" TEXT NOT NULL,
  "encryption_version" INTEGER NOT NULL DEFAULT 1,
  "key_fingerprint" TEXT NOT NULL,
  "status" "AiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "daily_request_limit" INTEGER,
  "daily_token_limit" INTEGER,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_provider_configurations" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "ai_provider_configurations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_provider_health_records" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "credential_id" UUID,
  "available" BOOLEAN NOT NULL,
  "latency_ms" INTEGER,
  "error_code" TEXT,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_provider_health_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_prompt_templates" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "content" TEXT NOT NULL,
  "output_format" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_invocation_logs" (
  "id" UUID NOT NULL,
  "request_id" TEXT NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider_id" UUID,
  "model_id" UUID,
  "agent_id" UUID,
  "prompt_template_id" UUID,
  "status" "AiInvocationStatus" NOT NULL DEFAULT 'PENDING',
  "task_type" TEXT NOT NULL,
  "input_metadata" JSONB,
  "output_metadata" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "fallback_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_invocation_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_usage_records" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "invocation_id" UUID NOT NULL,
  "provider_id" UUID,
  "model_id" UUID,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_usage_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_cost_records" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "invocation_id" UUID NOT NULL,
  "provider_id" UUID,
  "model_id" UUID,
  "input_cost" DECIMAL(14, 6) NOT NULL DEFAULT 0,
  "output_cost" DECIMAL(14, 6) NOT NULL DEFAULT 0,
  "total_cost" DECIMAL(14, 6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_cost_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_memory_records" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "agent_id" UUID,
  "scope" "AiMemoryScope" NOT NULL,
  "subject_id" UUID NOT NULL,
  "memory_key" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "ai_memory_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_routing_metadata" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "invocation_id" UUID NOT NULL,
  "selected_provider_id" UUID,
  "selected_model_id" UUID,
  "decision_factors" JSONB NOT NULL,
  "candidate_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_routing_metadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_cache_metadata" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider_id" UUID,
  "model_id" UUID,
  "key_hash" TEXT NOT NULL,
  "status" "AiCacheStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "invalidated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_cache_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_provider_credentials_workspace_id_provider_id_name_key"
  ON "ai_provider_credentials"("workspace_id", "provider_id", "name");
CREATE UNIQUE INDEX "ai_provider_credentials_workspace_id_provider_id_key_fingerprint_key"
  ON "ai_provider_credentials"("workspace_id", "provider_id", "key_fingerprint");
CREATE INDEX "ai_provider_credentials_workspace_id_provider_id_status_priority_idx"
  ON "ai_provider_credentials"("workspace_id", "provider_id", "status", "priority");
CREATE INDEX "ai_provider_credentials_provider_id_status_idx"
  ON "ai_provider_credentials"("provider_id", "status");

CREATE UNIQUE INDEX "ai_provider_configurations_workspace_id_provider_id_key"
  ON "ai_provider_configurations"("workspace_id", "provider_id");
CREATE INDEX "ai_provider_configurations_workspace_id_enabled_idx"
  ON "ai_provider_configurations"("workspace_id", "enabled");

CREATE INDEX "ai_provider_health_records_workspace_id_provider_id_checked_at_idx"
  ON "ai_provider_health_records"("workspace_id", "provider_id", "checked_at");
CREATE INDEX "ai_provider_health_records_credential_id_checked_at_idx"
  ON "ai_provider_health_records"("credential_id", "checked_at");

CREATE UNIQUE INDEX "ai_prompt_templates_workspace_id_name_version_key"
  ON "ai_prompt_templates"("workspace_id", "name", "version");
CREATE INDEX "ai_prompt_templates_workspace_id_active_created_at_idx"
  ON "ai_prompt_templates"("workspace_id", "active", "created_at");
CREATE INDEX "ai_prompt_templates_created_by_user_id_idx"
  ON "ai_prompt_templates"("created_by_user_id");

CREATE UNIQUE INDEX "ai_invocation_logs_request_id_key" ON "ai_invocation_logs"("request_id");
CREATE INDEX "ai_invocation_logs_workspace_id_created_at_idx"
  ON "ai_invocation_logs"("workspace_id", "created_at");
CREATE INDEX "ai_invocation_logs_workspace_id_status_created_at_idx"
  ON "ai_invocation_logs"("workspace_id", "status", "created_at");
CREATE INDEX "ai_invocation_logs_provider_id_created_at_idx"
  ON "ai_invocation_logs"("provider_id", "created_at");
CREATE INDEX "ai_invocation_logs_model_id_created_at_idx"
  ON "ai_invocation_logs"("model_id", "created_at");

CREATE UNIQUE INDEX "ai_usage_records_invocation_id_key" ON "ai_usage_records"("invocation_id");
CREATE INDEX "ai_usage_records_workspace_id_recorded_at_idx"
  ON "ai_usage_records"("workspace_id", "recorded_at");
CREATE INDEX "ai_usage_records_provider_id_recorded_at_idx"
  ON "ai_usage_records"("provider_id", "recorded_at");
CREATE INDEX "ai_usage_records_model_id_recorded_at_idx"
  ON "ai_usage_records"("model_id", "recorded_at");

CREATE UNIQUE INDEX "ai_cost_records_invocation_id_key" ON "ai_cost_records"("invocation_id");
CREATE INDEX "ai_cost_records_workspace_id_recorded_at_idx"
  ON "ai_cost_records"("workspace_id", "recorded_at");
CREATE INDEX "ai_cost_records_provider_id_recorded_at_idx"
  ON "ai_cost_records"("provider_id", "recorded_at");
CREATE INDEX "ai_cost_records_model_id_recorded_at_idx"
  ON "ai_cost_records"("model_id", "recorded_at");

CREATE UNIQUE INDEX "ai_memory_records_workspace_id_scope_subject_id_memory_key_key"
  ON "ai_memory_records"("workspace_id", "scope", "subject_id", "memory_key");
CREATE INDEX "ai_memory_records_workspace_id_scope_subject_id_idx"
  ON "ai_memory_records"("workspace_id", "scope", "subject_id");
CREATE INDEX "ai_memory_records_workspace_id_expires_at_idx"
  ON "ai_memory_records"("workspace_id", "expires_at");

CREATE UNIQUE INDEX "ai_routing_metadata_invocation_id_key" ON "ai_routing_metadata"("invocation_id");
CREATE INDEX "ai_routing_metadata_workspace_id_created_at_idx"
  ON "ai_routing_metadata"("workspace_id", "created_at");
CREATE INDEX "ai_routing_metadata_selected_provider_id_created_at_idx"
  ON "ai_routing_metadata"("selected_provider_id", "created_at");
CREATE INDEX "ai_routing_metadata_selected_model_id_created_at_idx"
  ON "ai_routing_metadata"("selected_model_id", "created_at");

CREATE UNIQUE INDEX "ai_cache_metadata_workspace_id_key_hash_key"
  ON "ai_cache_metadata"("workspace_id", "key_hash");
CREATE INDEX "ai_cache_metadata_workspace_id_status_expires_at_idx"
  ON "ai_cache_metadata"("workspace_id", "status", "expires_at");
CREATE INDEX "ai_cache_metadata_provider_id_model_id_idx"
  ON "ai_cache_metadata"("provider_id", "model_id");

ALTER TABLE "ai_provider_credentials"
  ADD CONSTRAINT "ai_provider_credentials_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_provider_credentials_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_provider_configurations"
  ADD CONSTRAINT "ai_provider_configurations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_provider_configurations_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_provider_health_records"
  ADD CONSTRAINT "ai_provider_health_records_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_provider_health_records_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_provider_health_records_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "ai_provider_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_prompt_templates"
  ADD CONSTRAINT "ai_prompt_templates_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_invocation_logs"
  ADD CONSTRAINT "ai_invocation_logs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_invocation_logs_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_invocation_logs_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_invocation_logs_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_invocation_logs_prompt_template_id_fkey"
  FOREIGN KEY ("prompt_template_id") REFERENCES "ai_prompt_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_records"
  ADD CONSTRAINT "ai_usage_records_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_usage_records_invocation_id_fkey"
  FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_usage_records_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_usage_records_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_cost_records"
  ADD CONSTRAINT "ai_cost_records_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_cost_records_invocation_id_fkey"
  FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_cost_records_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_cost_records_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_memory_records"
  ADD CONSTRAINT "ai_memory_records_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_memory_records_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_routing_metadata"
  ADD CONSTRAINT "ai_routing_metadata_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_routing_metadata_invocation_id_fkey"
  FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_routing_metadata_selected_provider_id_fkey"
  FOREIGN KEY ("selected_provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_routing_metadata_selected_model_id_fkey"
  FOREIGN KEY ("selected_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_cache_metadata"
  ADD CONSTRAINT "ai_cache_metadata_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_cache_metadata_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_cache_metadata_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
