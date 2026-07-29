CREATE TYPE "ConversationRuntimeStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED','DELETED');
CREATE TYPE "ConversationRuntimeStateType" AS ENUM ('INITIALIZED','READY','ACTIVE','PAUSED','CLOSED');
CREATE TYPE "ConversationRuntimeParticipantType" AS ENUM ('CUSTOMER','USER','AGENT','SYSTEM','EXTERNAL');
CREATE TYPE "ConversationRuntimeMessageRole" AS ENUM ('SYSTEM','DEVELOPER','USER','ASSISTANT','TOOL');
CREATE TYPE "ConversationRuntimeAttachmentType" AS ENUM ('FILE','IMAGE','AUDIO','VIDEO','OTHER');

CREATE TABLE "conversation_runtimes" (
 "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL, "updated_by" UUID NOT NULL,
 "source_conversation_id" UUID, "cloned_from_id" UUID, "name" TEXT NOT NULL,
 "status" "ConversationRuntimeStatus" NOT NULL DEFAULT 'DRAFT', "revision" INTEGER NOT NULL DEFAULT 0,
 "compatibility_version" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "runtime_package" JSONB NOT NULL, "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
 "published_at" TIMESTAMP(3), "archived_at" TIMESTAMP(3), "deleted_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "conversation_runtimes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_snapshots" (
 "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "revision" INTEGER NOT NULL,
 "created_by" UUID NOT NULL, "compatibility_version" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_contexts" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "context_key" TEXT NOT NULL,
 "agent_runtime_snapshot_id" UUID, "retrieval_snapshot_id" UUID, "compiled_prompt_id" UUID,
 "provider_snapshot_id" UUID, "execution_request_id" UUID, "execution_run_id" UUID,
 "locale" TEXT, "timezone" TEXT, "correlation_id" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_contexts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_variables" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL,
 "value" JSONB NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_variables_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_messages" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "message_identifier" TEXT NOT NULL, "ordinal" INTEGER NOT NULL,
 "role" "ConversationRuntimeMessageRole" NOT NULL, "participant_key" TEXT, "content_hash" TEXT,
 "metadata" JSONB NOT NULL DEFAULT '{}', "token_metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_messages_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_participants" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "participant_key" TEXT NOT NULL,
 "type" "ConversationRuntimeParticipantType" NOT NULL, "reference_id" UUID,
 "display_metadata" JSONB NOT NULL DEFAULT '{}', "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_participants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_attachments" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "attachment_identifier" TEXT NOT NULL,
 "message_identifier" TEXT, "type" "ConversationRuntimeAttachmentType" NOT NULL, "mime_type" TEXT NOT NULL,
 "file_name" TEXT, "size_bytes" BIGINT, "checksum" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_attachments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_labels" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "value" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "conversation_runtime_labels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_tags" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "value" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "conversation_runtime_tags_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_notes" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "note_key" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "conversation_runtime_notes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_settings" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "compatibility_version" TEXT NOT NULL,
 "settings" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_settings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_states" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "state" "ConversationRuntimeStateType" NOT NULL DEFAULT 'INITIALIZED',
 "sequence" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB NOT NULL DEFAULT '{}', "updated_by" UUID NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "conversation_runtime_states_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_versions" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "revision" INTEGER NOT NULL, "source_revision" INTEGER,
 "compatibility_version" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "package_hash" TEXT NOT NULL,
 "checksum" TEXT NOT NULL, "created_by" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "conversation_runtime_audit_metadata" (
 "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "actor_id" UUID NOT NULL, "event_type" TEXT NOT NULL,
 "correlation_id" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "conversation_runtime_audit_metadata_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_runtimes_workspace_status_idx" ON "conversation_runtimes"("workspace_id","status","deleted_at","updated_at");
CREATE INDEX "conversation_runtimes_workspace_source_idx" ON "conversation_runtimes"("workspace_id","source_conversation_id");
CREATE INDEX "conversation_runtimes_workspace_hash_idx" ON "conversation_runtimes"("workspace_id","package_hash");
CREATE UNIQUE INDEX "conversation_runtime_snapshots_runtime_revision_key" ON "conversation_runtime_snapshots"("runtime_id","revision");
CREATE INDEX "conversation_runtime_snapshots_workspace_created_idx" ON "conversation_runtime_snapshots"("workspace_id","created_at");
CREATE UNIQUE INDEX "conversation_runtime_contexts_runtime_key_key" ON "conversation_runtime_contexts"("runtime_id","context_key");
CREATE UNIQUE INDEX "conversation_runtime_variables_runtime_name_key" ON "conversation_runtime_variables"("runtime_id","name");
CREATE UNIQUE INDEX "conversation_runtime_messages_runtime_identifier_key" ON "conversation_runtime_messages"("runtime_id","message_identifier");
CREATE UNIQUE INDEX "conversation_runtime_messages_runtime_ordinal_key" ON "conversation_runtime_messages"("runtime_id","ordinal");
CREATE UNIQUE INDEX "conversation_runtime_participants_runtime_key_key" ON "conversation_runtime_participants"("runtime_id","participant_key");
CREATE UNIQUE INDEX "conversation_runtime_attachments_runtime_identifier_key" ON "conversation_runtime_attachments"("runtime_id","attachment_identifier");
CREATE UNIQUE INDEX "conversation_runtime_labels_runtime_value_key" ON "conversation_runtime_labels"("runtime_id","value");
CREATE UNIQUE INDEX "conversation_runtime_tags_runtime_value_key" ON "conversation_runtime_tags"("runtime_id","value");
CREATE UNIQUE INDEX "conversation_runtime_notes_runtime_key_key" ON "conversation_runtime_notes"("runtime_id","note_key");
CREATE UNIQUE INDEX "conversation_runtime_settings_runtime_id_key" ON "conversation_runtime_settings"("runtime_id");
CREATE UNIQUE INDEX "conversation_runtime_states_runtime_id_key" ON "conversation_runtime_states"("runtime_id");
CREATE UNIQUE INDEX "conversation_runtime_versions_runtime_revision_key" ON "conversation_runtime_versions"("runtime_id","revision");
CREATE INDEX "conversation_runtime_versions_runtime_created_idx" ON "conversation_runtime_versions"("runtime_id","created_at");
CREATE INDEX "conversation_runtime_audit_metadata_runtime_created_idx" ON "conversation_runtime_audit_metadata"("runtime_id","created_at");

ALTER TABLE "conversation_runtimes" ADD CONSTRAINT "conversation_runtimes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_snapshots" ADD CONSTRAINT "conversation_runtime_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_snapshots" ADD CONSTRAINT "conversation_runtime_snapshots_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_contexts" ADD CONSTRAINT "conversation_runtime_contexts_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_variables" ADD CONSTRAINT "conversation_runtime_variables_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_messages" ADD CONSTRAINT "conversation_runtime_messages_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_participants" ADD CONSTRAINT "conversation_runtime_participants_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_attachments" ADD CONSTRAINT "conversation_runtime_attachments_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_labels" ADD CONSTRAINT "conversation_runtime_labels_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_tags" ADD CONSTRAINT "conversation_runtime_tags_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_notes" ADD CONSTRAINT "conversation_runtime_notes_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_settings" ADD CONSTRAINT "conversation_runtime_settings_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_states" ADD CONSTRAINT "conversation_runtime_states_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_versions" ADD CONSTRAINT "conversation_runtime_versions_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_runtime_audit_metadata" ADD CONSTRAINT "conversation_runtime_audit_metadata_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "conversation_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
