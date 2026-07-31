CREATE TYPE "ChannelState" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'DISCONNECTED', 'ARCHIVED');
CREATE TYPE "ChannelConnectionState" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'DEGRADED', 'FAILED');
CREATE TYPE "ChannelMessageDirection" AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE "ChannelMessageState" AS ENUM ('QUEUED', 'PREPARING', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'EXPIRED', 'CANCELLED', 'DELETED', 'RETRIED');
CREATE TYPE "ChannelMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT', 'REACTION', 'REPLY', 'FORWARD', 'QUOTE', 'BUTTON', 'INTERACTIVE', 'LIST', 'TEMPLATE', 'REFERRAL', 'UNKNOWN');

CREATE TABLE "channel_runtime_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "provider_id" UUID NOT NULL,
  "name" TEXT NOT NULL, "state" "ChannelState" NOT NULL DEFAULT 'DRAFT', "compatibility_version" TEXT NOT NULL DEFAULT '1.0',
  "version" INTEGER NOT NULL DEFAULT 1, "state_version" INTEGER NOT NULL DEFAULT 0, "configuration_hash" TEXT NOT NULL,
  "checksum" TEXT NOT NULL, "created_by" UUID NOT NULL, "updated_by" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, "archived_at" TIMESTAMP(3), CONSTRAINT "channel_runtime_channels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL,
  "state" "ChannelConnectionState" NOT NULL DEFAULT 'DISCONNECTED', "state_version" INTEGER NOT NULL DEFAULT 0,
  "business_account_id" TEXT NOT NULL, "phone_number_id" TEXT NOT NULL, "display_phone_number" TEXT, "api_version" TEXT NOT NULL,
  "webhook_path_key" TEXT NOT NULL, "encrypted_access_token" TEXT NOT NULL, "access_token_fingerprint" TEXT NOT NULL,
  "encrypted_verify_token" TEXT NOT NULL, "encrypted_app_secret" TEXT NOT NULL, "capabilities" JSONB NOT NULL DEFAULT '{}',
  "health" JSONB NOT NULL DEFAULT '{}', "last_health_check_at" TIMESTAMP(3), "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL, "hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channel_configurations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL, "hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channel_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "connection_id" UUID NOT NULL,
  "external_user_id" TEXT NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "session_id" UUID NOT NULL,
  "conversation_runtime_id" UUID, "external_conversation_id" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_conversations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "connection_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL, "direction" "ChannelMessageDirection" NOT NULL, "type" "ChannelMessageType" NOT NULL,
  "state" "ChannelMessageState" NOT NULL, "state_version" INTEGER NOT NULL DEFAULT 0, "provider_message_id" TEXT,
  "idempotency_key" TEXT NOT NULL, "reply_to_message_id" UUID, "normalized_payload" JSONB NOT NULL, "payload_hash" TEXT NOT NULL,
  "checksum" TEXT NOT NULL, "queued_at" TIMESTAMP(3), "sent_at" TIMESTAMP(3), "delivered_at" TIMESTAMP(3), "read_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "message_id" UUID,
  "provider_media_id" TEXT, "storage_reference" TEXT, "file_name" TEXT, "mime_type" TEXT NOT NULL, "size_bytes" BIGINT NOT NULL,
  "checksum" TEXT NOT NULL, "content" BYTEA, "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_attachments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "message_id" UUID NOT NULL, "state" "ChannelMessageState" NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1, "provider_code" TEXT, "detail" JSONB NOT NULL DEFAULT '{}', "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "channel_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "message_id" UUID,
  "type" TEXT NOT NULL, "external_id" TEXT, "payload" JSONB NOT NULL, "payload_hash" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_metrics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "channel_id" UUID NOT NULL, "date" DATE NOT NULL,
  "incoming_count" INTEGER NOT NULL DEFAULT 0, "outgoing_count" INTEGER NOT NULL DEFAULT 0, "conversation_count" INTEGER NOT NULL DEFAULT 0,
  "retry_count" INTEGER NOT NULL DEFAULT 0, "failure_count" INTEGER NOT NULL DEFAULT 0, "attachment_bytes" BIGINT NOT NULL DEFAULT 0,
  "media_count" INTEGER NOT NULL DEFAULT 0, "delivery_latency_ms" BIGINT NOT NULL DEFAULT 0, "read_latency_ms" BIGINT NOT NULL DEFAULT 0,
  "traffic_bytes" BIGINT NOT NULL DEFAULT 0, CONSTRAINT "channel_metrics_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_diagnostics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "workspace_id" UUID NOT NULL, "channel_id" UUID NOT NULL, "severity" TEXT NOT NULL,
  "code" TEXT NOT NULL, "message" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_diagnostics_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "channel_id" UUID NOT NULL, "actor_id" UUID, "action" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_audits_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "channel_webhook_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "connection_id" UUID NOT NULL, "event_id" TEXT NOT NULL, "payload_hash" TEXT NOT NULL,
  "signature" TEXT NOT NULL, "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processed_at" TIMESTAMP(3),
  CONSTRAINT "channel_webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_runtime_channels_workspace_name_key" ON "channel_runtime_channels"("workspace_id", "name");
CREATE INDEX "channel_runtime_channels_workspace_state_idx" ON "channel_runtime_channels"("workspace_id", "state", "updated_at");
CREATE UNIQUE INDEX "channel_connections_webhook_path_key_key" ON "channel_connections"("webhook_path_key");
CREATE UNIQUE INDEX "channel_connections_workspace_phone_key" ON "channel_connections"("workspace_id", "channel_id", "phone_number_id");
CREATE INDEX "channel_connections_workspace_state_idx" ON "channel_connections"("workspace_id", "state");
CREATE UNIQUE INDEX "channel_configurations_connection_revision_key" ON "channel_configurations"("connection_id", "revision");
CREATE UNIQUE INDEX "channel_snapshots_channel_revision_key" ON "channel_snapshots"("channel_id", "revision");
CREATE INDEX "channel_snapshots_workspace_created_idx" ON "channel_snapshots"("workspace_id", "created_at");
CREATE UNIQUE INDEX "channel_sessions_connection_user_key" ON "channel_sessions"("connection_id", "external_user_id");
CREATE INDEX "channel_sessions_workspace_expiry_idx" ON "channel_sessions"("workspace_id", "expires_at");
CREATE UNIQUE INDEX "channel_conversations_channel_external_key" ON "channel_conversations"("channel_id", "external_conversation_id");
CREATE INDEX "channel_conversations_workspace_updated_idx" ON "channel_conversations"("workspace_id", "updated_at");
CREATE UNIQUE INDEX "channel_messages_workspace_idempotency_key" ON "channel_messages"("workspace_id", "idempotency_key");
CREATE UNIQUE INDEX "channel_messages_connection_provider_key" ON "channel_messages"("connection_id", "provider_message_id");
CREATE INDEX "channel_messages_workspace_state_idx" ON "channel_messages"("workspace_id", "state", "created_at");
CREATE INDEX "channel_attachments_workspace_created_idx" ON "channel_attachments"("workspace_id", "created_at");
CREATE INDEX "channel_deliveries_message_occurred_idx" ON "channel_deliveries"("message_id", "occurred_at");
CREATE UNIQUE INDEX "channel_events_channel_external_key" ON "channel_events"("channel_id", "external_id");
CREATE INDEX "channel_events_workspace_type_idx" ON "channel_events"("workspace_id", "type", "created_at");
CREATE UNIQUE INDEX "channel_metrics_channel_date_key" ON "channel_metrics"("channel_id", "date");
CREATE INDEX "channel_diagnostics_workspace_code_idx" ON "channel_diagnostics"("workspace_id", "code", "created_at");
CREATE INDEX "channel_audits_channel_created_idx" ON "channel_audits"("channel_id", "created_at");
CREATE UNIQUE INDEX "channel_webhook_receipts_connection_event_key" ON "channel_webhook_receipts"("connection_id", "event_id");
CREATE INDEX "channel_webhook_receipts_received_idx" ON "channel_webhook_receipts"("received_at");

ALTER TABLE "channel_runtime_channels" ADD CONSTRAINT "channel_runtime_channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_runtime_channels" ADD CONSTRAINT "channel_runtime_channels_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_configurations" ADD CONSTRAINT "channel_configurations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_snapshots" ADD CONSTRAINT "channel_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_snapshots" ADD CONSTRAINT "channel_snapshots_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_conversations" ADD CONSTRAINT "channel_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_conversations" ADD CONSTRAINT "channel_conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_conversations" ADD CONSTRAINT "channel_conversations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "channel_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "channel_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "channel_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_attachments" ADD CONSTRAINT "channel_attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_attachments" ADD CONSTRAINT "channel_attachments_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_attachments" ADD CONSTRAINT "channel_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "channel_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_deliveries" ADD CONSTRAINT "channel_deliveries_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "channel_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_events" ADD CONSTRAINT "channel_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_events" ADD CONSTRAINT "channel_events_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_events" ADD CONSTRAINT "channel_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "channel_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_metrics" ADD CONSTRAINT "channel_metrics_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_diagnostics" ADD CONSTRAINT "channel_diagnostics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_diagnostics" ADD CONSTRAINT "channel_diagnostics_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_audits" ADD CONSTRAINT "channel_audits_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel_runtime_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_webhook_receipts" ADD CONSTRAINT "channel_webhook_receipts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
