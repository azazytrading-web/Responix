CREATE TYPE "CustomAiProviderStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

CREATE TABLE "custom_ai_providers" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "protocol_id" TEXT NOT NULL,
  "base_url" TEXT NOT NULL,
  "validation_model_id" TEXT NOT NULL,
  "status" "CustomAiProviderStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_ai_providers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_ai_providers_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "custom_ai_providers_workspace_id_normalized_name_key"
  ON "custom_ai_providers"("workspace_id", "normalized_name");
CREATE UNIQUE INDEX "custom_ai_providers_id_workspace_id_key"
  ON "custom_ai_providers"("id", "workspace_id");
CREATE INDEX "custom_ai_providers_workspace_id_status_idx"
  ON "custom_ai_providers"("workspace_id", "status");

CREATE TABLE "custom_ai_provider_credentials" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "custom_provider_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "encrypted_secret" TEXT NOT NULL,
  "encryption_version" INTEGER NOT NULL DEFAULT 1,
  "key_fingerprint" TEXT NOT NULL,
  "status" "AiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "custom_ai_provider_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_ai_provider_credentials_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custom_ai_provider_credentials_provider_workspace_fkey"
    FOREIGN KEY ("custom_provider_id", "workspace_id")
    REFERENCES "custom_ai_providers"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "custom_ai_provider_credentials_workspace_provider_name_key"
  ON "custom_ai_provider_credentials"("workspace_id", "custom_provider_id", "name");
CREATE UNIQUE INDEX "custom_ai_provider_credentials_workspace_provider_fprint_key"
  ON "custom_ai_provider_credentials"("workspace_id", "custom_provider_id", "key_fingerprint");
CREATE INDEX "custom_ai_provider_credentials_workspace_provider_status_priority_idx"
  ON "custom_ai_provider_credentials"("workspace_id", "custom_provider_id", "status", "priority");
