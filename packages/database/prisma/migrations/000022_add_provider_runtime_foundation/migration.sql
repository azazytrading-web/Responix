CREATE TYPE "ProviderRuntimeStatus" AS ENUM ('PREPARED', 'VALIDATED', 'REJECTED', 'SNAPSHOTTED');

CREATE TABLE "provider_runtime_requests" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "compiled_prompt_id" UUID NOT NULL,
    "agent_runtime_snapshot_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "provider_configuration_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "execution_profile_id" UUID NOT NULL,
    "execution_profile_version_id" UUID NOT NULL,
    "execution_request_id" UUID NOT NULL,
    "execution_run_id" UUID,
    "conversation_id" UUID,
    "provider_type" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "status" "ProviderRuntimeStatus" NOT NULL DEFAULT 'PREPARED',
    "preparation_input" JSONB NOT NULL,
    "prepared_request" JSONB NOT NULL,
    "capability_metadata" JSONB NOT NULL,
    "validation_result" JSONB NOT NULL,
    "request_hash" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "latest_snapshot_revision" INTEGER NOT NULL DEFAULT 0,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_runtime_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_request_snapshots" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "created_by" UUID NOT NULL,
    "compiled_prompt_id" UUID NOT NULL,
    "agent_runtime_snapshot_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "provider_configuration_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "execution_profile_id" UUID NOT NULL,
    "execution_profile_version_id" UUID NOT NULL,
    "provider_type" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "request_package" JSONB NOT NULL,
    "capability_metadata" JSONB NOT NULL,
    "validation_result" JSONB NOT NULL,
    "request_hash" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_request_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_runtime_requests_workspace_status_idx"
ON "provider_runtime_requests"("workspace_id", "status", "created_at");
CREATE INDEX "provider_runtime_requests_provider_model_idx"
ON "provider_runtime_requests"("workspace_id", "provider_id", "model_id", "created_at");
CREATE INDEX "provider_runtime_requests_execution_idx"
ON "provider_runtime_requests"("workspace_id", "execution_request_id");
CREATE INDEX "provider_runtime_requests_hash_idx"
ON "provider_runtime_requests"("workspace_id", "request_hash");
CREATE UNIQUE INDEX "provider_request_snapshots_request_revision_key"
ON "provider_request_snapshots"("request_id", "revision");
CREATE INDEX "provider_request_snapshots_workspace_created_idx"
ON "provider_request_snapshots"("workspace_id", "created_at");
CREATE INDEX "provider_request_snapshots_provider_model_idx"
ON "provider_request_snapshots"("workspace_id", "provider_id", "model_id");
CREATE INDEX "provider_request_snapshots_hash_idx"
ON "provider_request_snapshots"("workspace_id", "request_hash");

ALTER TABLE "provider_runtime_requests"
ADD CONSTRAINT "provider_runtime_requests_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_request_snapshots"
ADD CONSTRAINT "provider_request_snapshots_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_request_snapshots"
ADD CONSTRAINT "provider_request_snapshots_request_id_fkey"
FOREIGN KEY ("request_id") REFERENCES "provider_runtime_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
