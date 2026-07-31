ALTER TYPE "ChannelMessageState" ADD VALUE 'UNKNOWN';

ALTER TABLE "channel_connections"
  ALTER COLUMN "business_account_id" DROP NOT NULL,
  ALTER COLUMN "phone_number_id" DROP NOT NULL,
  ALTER COLUMN "api_version" DROP NOT NULL,
  ALTER COLUMN "encrypted_access_token" DROP NOT NULL,
  ALTER COLUMN "access_token_fingerprint" DROP NOT NULL,
  ALTER COLUMN "encrypted_verify_token" DROP NOT NULL,
  ALTER COLUMN "encrypted_app_secret" DROP NOT NULL,
  ADD COLUMN "token_expires_at" TIMESTAMP(3),
  ADD COLUMN "provider_configuration" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "channel_capabilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "provider_id" UUID NOT NULL, "capability" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_capabilities_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_credential_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "connection_id" UUID NOT NULL,
  "name" TEXT NOT NULL, "version" INTEGER NOT NULL, "encrypted_secret" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3), "revoked_at" TIMESTAMP(3), "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channel_credential_references_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_webhooks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "connection_id" UUID NOT NULL,
  "path_key" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "signature_type" TEXT NOT NULL,
  "maximum_age_ms" INTEGER NOT NULL DEFAULT 300000, "configuration" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_webhooks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_health" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "connection_id" UUID NOT NULL,
  "status" "ChannelConnectionState" NOT NULL, "latency_ms" INTEGER NOT NULL, "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "detail" JSONB NOT NULL DEFAULT '{}', "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_health_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_transports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL, "kind" TEXT NOT NULL,
  "configuration" JSONB NOT NULL DEFAULT '{}', "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channel_transports_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_rate_limits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL, "scope" TEXT NOT NULL,
  "window_ms" INTEGER NOT NULL, "maximum" INTEGER NOT NULL, "burst" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL DEFAULT '{}', CONSTRAINT "channel_rate_limits_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_retry_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL, "maximum_attempts" INTEGER NOT NULL DEFAULT 3,
  "initial_delay_ms" INTEGER NOT NULL DEFAULT 500, "maximum_delay_ms" INTEGER NOT NULL DEFAULT 30000,
  "multiplier" DECIMAL(5,2) NOT NULL DEFAULT 2, "retryable_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "channel_retry_policies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_message_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL, "batch_key" TEXT NOT NULL,
  "message_ids" UUID[], "status" TEXT NOT NULL, "checksum" TEXT NOT NULL, "scheduled_at" TIMESTAMP(3) NOT NULL,
  "processed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_message_batches_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_presence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL,
  "external_id" TEXT NOT NULL, "state" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "observed_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_capabilities_provider_capability_key" ON "channel_capabilities"("provider_id", "capability");
CREATE UNIQUE INDEX "channel_credentials_connection_name_version_key" ON "channel_credential_references"("connection_id", "name", "version");
CREATE INDEX "channel_credentials_workspace_active_idx" ON "channel_credential_references"("workspace_id", "connection_id", "name", "revoked_at");
CREATE UNIQUE INDEX "channel_webhooks_path_key_key" ON "channel_webhooks"("path_key");
CREATE INDEX "channel_webhooks_workspace_enabled_idx" ON "channel_webhooks"("workspace_id", "enabled");
CREATE INDEX "channel_health_workspace_connection_idx" ON "channel_health"("workspace_id", "connection_id", "checked_at");
CREATE UNIQUE INDEX "channel_transports_connection_kind_key" ON "channel_transports"("connection_id", "kind");
CREATE UNIQUE INDEX "channel_rate_limits_connection_scope_key" ON "channel_rate_limits"("connection_id", "scope");
CREATE UNIQUE INDEX "channel_retry_policies_connection_id_key" ON "channel_retry_policies"("connection_id");
CREATE UNIQUE INDEX "channel_batches_connection_key_key" ON "channel_message_batches"("connection_id", "batch_key");
CREATE INDEX "channel_batches_status_scheduled_idx" ON "channel_message_batches"("status", "scheduled_at");
CREATE UNIQUE INDEX "channel_presence_channel_external_key" ON "channel_presence"("channel_id", "external_id");
CREATE INDEX "channel_presence_workspace_observed_idx" ON "channel_presence"("workspace_id", "observed_at");

ALTER TABLE "channel_capabilities" ADD CONSTRAINT "channel_capabilities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_credential_references" ADD CONSTRAINT "channel_credential_references_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_credential_references" ADD CONSTRAINT "channel_credential_references_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_webhooks" ADD CONSTRAINT "channel_webhooks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_webhooks" ADD CONSTRAINT "channel_webhooks_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_health" ADD CONSTRAINT "channel_health_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_health" ADD CONSTRAINT "channel_health_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_transports" ADD CONSTRAINT "channel_transports_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_rate_limits" ADD CONSTRAINT "channel_rate_limits_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_retry_policies" ADD CONSTRAINT "channel_retry_policies_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_message_batches" ADD CONSTRAINT "channel_message_batches_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_presence" ADD CONSTRAINT "channel_presence_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_presence" ADD CONSTRAINT "channel_presence_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
