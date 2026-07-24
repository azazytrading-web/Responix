-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'WEB', 'SMS', 'API');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'FILE', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'DISABLED', 'UNHEALTHY');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'INDEXING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "IndexingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";

-- DropIndex
DROP INDEX "users_workspace_id_idx";

-- DropIndex
DROP INDEX "users_status_idx";

-- DropIndex
DROP INDEX "audit_logs_actor_id_idx";

-- Preserve the Sprint 1 user and audit-log values before expanding the schema.
ALTER TABLE "users" RENAME COLUMN "name" TO "full_name";
ALTER TABLE "audit_logs" RENAME COLUMN "actor_id" TO "user_id";

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "api_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "current_storage_usage" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "current_token_usage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "max_agents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_messages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_storage" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "max_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_users" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "owner_user_id" UUID,
ADD COLUMN     "plan_id" UUID,
ADD COLUMN     "primary_color" TEXT,
ADD COLUMN     "secondary_color" TEXT,
ADD COLUMN     "subscription_id" UUID,
ADD COLUMN     "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "WorkspaceStatus" USING UPPER("status")::"WorkspaceStatus",
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "department_id" UUID,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role_id" UUID,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "UserStatus" USING UPPER("status")::"UserStatus",
ALTER COLUMN "status" SET DEFAULT 'INVITED';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "new_values" JSONB,
ADD COLUMN     "old_values" JSONB,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_agent" TEXT;

ALTER TABLE "audit_logs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT,
    "city" TEXT,
    "language" TEXT DEFAULT 'en',
    "gender" TEXT,
    "birth_date" DATE,
    "notes" TEXT,
    "lead_score" INTEGER NOT NULL DEFAULT 0,
    "pipeline_stage_id" UUID,
    "assigned_user_id" UUID,
    "ai_summary" TEXT,
    "sentiment_score" DECIMAL(5,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "assigned_agent_id" UUID,
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ConversationPriority" NOT NULL DEFAULT 'NORMAL',
    "language" TEXT DEFAULT 'en',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "ai_messages" INTEGER NOT NULL DEFAULT 0,
    "human_messages" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "sentiment" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "sender_id" UUID,
    "message_type" "MessageType" NOT NULL,
    "content" TEXT,
    "translated_content" TEXT,
    "attachment_url" TEXT,
    "model_used" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "latency" INTEGER,
    "confidence" DECIMAL(5,2),
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL,
    "provider_name" TEXT NOT NULL,
    "api_base_url" TEXT,
    "authentication_type" TEXT,
    "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "average_latency" INTEGER,
    "health_score" DECIMAL(5,2),
    "daily_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "monthly_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "context_window" INTEGER NOT NULL,
    "input_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "output_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "supports_audio" BOOLEAN NOT NULL DEFAULT false,
    "supports_tools" BOOLEAN NOT NULL DEFAULT false,
    "supports_reasoning" BOOLEAN NOT NULL DEFAULT false,
    "supports_streaming" BOOLEAN NOT NULL DEFAULT false,
    "max_output_tokens" INTEGER,
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agents" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "personality" TEXT,
    "prompt" TEXT NOT NULL,
    "model_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL,
    "top_p" DECIMAL(3,2),
    "memory_enabled" BOOLEAN NOT NULL DEFAULT false,
    "knowledge_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tools_enabled" BOOLEAN NOT NULL DEFAULT false,
    "fallback_enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "total_documents" INTEGER NOT NULL DEFAULT 0,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "total_embeddings" INTEGER NOT NULL DEFAULT 0,
    "embedding_model" TEXT,
    "vector_database" TEXT NOT NULL DEFAULT 'pgvector',
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "knowledge_base_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "total_pages" INTEGER,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "indexing_status" "IndexingStatus" NOT NULL DEFAULT 'PENDING',
    "upload_status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_number" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "vector_id" TEXT NOT NULL,
    "vector" vector(1536),
    "embedding_model" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "trigger_type" TEXT NOT NULL,
    "workflow_json" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "customer_id" UUID,
    "conversation_id" UUID,
    "execution_time" INTEGER,
    "execution_status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_price" DECIMAL(14,2) NOT NULL,
    "yearly_price" DECIMAL(14,2) NOT NULL,
    "max_users" INTEGER NOT NULL DEFAULT 0,
    "max_agents" INTEGER NOT NULL DEFAULT 0,
    "max_messages" INTEGER NOT NULL DEFAULT 0,
    "max_storage" BIGINT NOT NULL DEFAULT 0,
    "max_tokens" INTEGER NOT NULL DEFAULT 0,
    "features_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "started_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "next_payment" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "invoice_id" UUID,
    "payment_provider" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "permissions_json" JSONB NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_statistics" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "total_ai_requests" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "storage_usage" BIGINT NOT NULL DEFAULT 0,
    "api_calls" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "feature_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roles_workspace_id_priority_idx" ON "roles"("workspace_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "roles_workspace_id_name_key" ON "roles"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "customers_workspace_id_created_at_idx" ON "customers"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "customers_workspace_id_phone_idx" ON "customers"("workspace_id", "phone");

-- CreateIndex
CREATE INDEX "customers_workspace_id_email_idx" ON "customers"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "customers_assigned_user_id_idx" ON "customers"("assigned_user_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_status_idx" ON "conversations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_created_at_idx" ON "conversations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_customer_id_workspace_id_idx" ON "conversations"("customer_id", "workspace_id");

-- CreateIndex
CREATE INDEX "conversations_assigned_user_id_idx" ON "conversations"("assigned_user_id");

-- CreateIndex
CREATE INDEX "conversations_assigned_agent_id_idx" ON "conversations"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_customer_id_idx" ON "messages"("customer_id");

-- CreateIndex
CREATE INDEX "messages_workspace_id_created_at_idx" ON "messages"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_provider_name_key" ON "ai_providers"("provider_name");

-- CreateIndex
CREATE INDEX "ai_providers_status_priority_idx" ON "ai_providers"("status", "priority");

-- CreateIndex
CREATE INDEX "ai_models_provider_id_status_idx" ON "ai_models"("provider_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_provider_id_model_name_key" ON "ai_models"("provider_id", "model_name");

-- CreateIndex
CREATE INDEX "ai_agents_workspace_id_status_idx" ON "ai_agents"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ai_agents_model_id_idx" ON "ai_agents"("model_id");

-- CreateIndex
CREATE INDEX "ai_agents_provider_id_idx" ON "ai_agents"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agents_workspace_id_name_key" ON "ai_agents"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "knowledge_bases_workspace_id_status_idx" ON "knowledge_bases"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_bases_workspace_id_name_key" ON "knowledge_bases"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "knowledge_documents_workspace_id_created_at_idx" ON "knowledge_documents"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_knowledge_base_id_indexing_status_idx" ON "knowledge_documents"("knowledge_base_id", "indexing_status");

-- CreateIndex
CREATE INDEX "knowledge_documents_upload_status_idx" ON "knowledge_documents"("upload_status");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_vector_id_key" ON "embeddings"("vector_id");

-- CreateIndex
CREATE INDEX "embeddings_embedding_model_idx" ON "embeddings"("embedding_model");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_document_id_chunk_number_key" ON "embeddings"("document_id", "chunk_number");

-- CreateIndex
CREATE INDEX "workflows_workspace_id_status_idx" ON "workflows"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "workflows_created_by_idx" ON "workflows"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_workspace_id_name_version_key" ON "workflows"("workspace_id", "name", "version");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_id_created_at_idx" ON "workflow_runs"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_runs_customer_id_idx" ON "workflow_runs"("customer_id");

-- CreateIndex
CREATE INDEX "workflow_runs_conversation_id_idx" ON "workflow_runs"("conversation_id");

-- CreateIndex
CREATE INDEX "workflow_runs_execution_status_idx" ON "workflow_runs"("execution_status");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE INDEX "plans_active_idx" ON "plans"("active");

-- CreateIndex
CREATE INDEX "subscriptions_workspace_id_status_idx" ON "subscriptions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "payments_workspace_id_created_at_idx" ON "payments"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_api_key_hash_key" ON "api_keys"("api_key_hash");

-- CreateIndex
CREATE INDEX "api_keys_workspace_id_status_idx" ON "api_keys"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_workspace_id_name_key" ON "api_keys"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_created_at_idx" ON "notifications"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "usage_statistics_date_idx" ON "usage_statistics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "usage_statistics_workspace_id_date_key" ON "usage_statistics"("workspace_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_feature_name_key" ON "feature_flags"("feature_name");

-- CreateIndex
CREATE INDEX "feature_flags_workspace_id_idx" ON "feature_flags"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "channels_name_key" ON "channels"("name");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- CreateIndex
CREATE INDEX "workspaces_created_at_idx" ON "workspaces"("created_at");

-- CreateIndex
CREATE INDEX "users_workspace_id_status_idx" ON "users"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_statistics" ADD CONSTRAINT "usage_statistics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- pgvector similarity-search index. The extension is enabled by migration 000001.
CREATE INDEX "embeddings_vector_cosine_idx" ON "embeddings" USING hnsw ("vector" vector_cosine_ops);

