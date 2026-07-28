CREATE TYPE "AgentRuntimeStatus" AS ENUM ('PREPARED', 'VALIDATED', 'REJECTED', 'SNAPSHOTTED');

CREATE TABLE "agent_runtime_preparations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "provider_configuration_id" UUID NOT NULL,
    "execution_profile_id" UUID NOT NULL,
    "execution_profile_version_id" UUID NOT NULL,
    "execution_request_id" UUID NOT NULL,
    "execution_run_id" UUID,
    "conversation_id" UUID,
    "status" "AgentRuntimeStatus" NOT NULL DEFAULT 'PREPARED',
    "locale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "preparation_input" JSONB NOT NULL,
    "runtime_context" JSONB NOT NULL,
    "prompt_structure" JSONB NOT NULL,
    "runtime_variables" JSONB NOT NULL,
    "validation_result" JSONB NOT NULL,
    "execution_configuration" JSONB NOT NULL,
    "runtime_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "validated_at" TIMESTAMP(3),

    CONSTRAINT "agent_runtime_preparations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_runtime_conversations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "runtime_id" UUID NOT NULL,
    "conversation_id" UUID,
    "parent_execution_run_id" UUID,
    "history_references" JSONB NOT NULL DEFAULT '[]',
    "memory_references" JSONB NOT NULL DEFAULT '[]',
    "participant_metadata" JSONB NOT NULL DEFAULT '{}',
    "token_accounting_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runtime_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_runtime_snapshots" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "runtime_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "provider_configuration_id" UUID NOT NULL,
    "execution_profile_id" UUID NOT NULL,
    "execution_profile_version_id" UUID NOT NULL,
    "execution_request_id" UUID NOT NULL,
    "execution_run_id" UUID,
    "conversation_id" UUID,
    "correlation_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "runtime_context" JSONB NOT NULL,
    "prompt_references" JSONB NOT NULL,
    "prompt_structure" JSONB NOT NULL,
    "runtime_variables" JSONB NOT NULL,
    "runtime_metadata" JSONB NOT NULL DEFAULT '{}',
    "execution_configuration" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runtime_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_runtime_conversations_runtime_id_key"
    ON "agent_runtime_conversations"("runtime_id");
CREATE UNIQUE INDEX "agent_runtime_snapshots_runtime_id_key"
    ON "agent_runtime_snapshots"("runtime_id");
CREATE INDEX "agent_runtime_preparations_workspace_status_idx"
    ON "agent_runtime_preparations"("workspace_id", "status", "created_at");
CREATE INDEX "agent_runtime_preparations_workspace_agent_idx"
    ON "agent_runtime_preparations"("workspace_id", "agent_id", "created_at");
CREATE INDEX "agent_runtime_preparations_workspace_conversation_idx"
    ON "agent_runtime_preparations"("workspace_id", "conversation_id", "created_at");
CREATE INDEX "agent_runtime_preparations_request_idx"
    ON "agent_runtime_preparations"("execution_request_id");
CREATE INDEX "agent_runtime_preparations_run_idx"
    ON "agent_runtime_preparations"("execution_run_id");
CREATE INDEX "agent_runtime_conversations_workspace_conversation_idx"
    ON "agent_runtime_conversations"("workspace_id", "conversation_id", "created_at");
CREATE INDEX "agent_runtime_conversations_parent_run_idx"
    ON "agent_runtime_conversations"("parent_execution_run_id");
CREATE INDEX "agent_runtime_snapshots_workspace_agent_idx"
    ON "agent_runtime_snapshots"("workspace_id", "agent_id", "created_at");
CREATE INDEX "agent_runtime_snapshots_workspace_hash_idx"
    ON "agent_runtime_snapshots"("workspace_id", "content_hash");

ALTER TABLE "agent_runtime_preparations"
    ADD CONSTRAINT "agent_runtime_preparations_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runtime_conversations"
    ADD CONSTRAINT "agent_runtime_conversations_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runtime_conversations"
    ADD CONSTRAINT "agent_runtime_conversations_runtime_id_fkey"
    FOREIGN KEY ("runtime_id") REFERENCES "agent_runtime_preparations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runtime_snapshots"
    ADD CONSTRAINT "agent_runtime_snapshots_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runtime_snapshots"
    ADD CONSTRAINT "agent_runtime_snapshots_runtime_id_fkey"
    FOREIGN KEY ("runtime_id") REFERENCES "agent_runtime_preparations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
