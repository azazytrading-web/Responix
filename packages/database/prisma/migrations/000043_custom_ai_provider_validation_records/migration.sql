CREATE TABLE "custom_ai_provider_validation_records" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "custom_provider_id" UUID NOT NULL,
  "protocol_id" TEXT NOT NULL,
  "available" BOOLEAN NOT NULL,
  "latency_ms" INTEGER NOT NULL,
  "error_code" TEXT,
  "provider_status" INTEGER,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_ai_provider_validation_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custom_ai_provider_validation_records_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custom_ai_provider_validation_records_provider_workspace_fkey"
    FOREIGN KEY ("custom_provider_id", "workspace_id")
    REFERENCES "custom_ai_providers"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "custom_ai_provider_validation_records_workspace_provider_checked_at_idx"
  ON "custom_ai_provider_validation_records"("workspace_id", "custom_provider_id", "checked_at");
