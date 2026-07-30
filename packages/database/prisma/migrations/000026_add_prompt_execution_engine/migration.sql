CREATE TABLE "prompt_execution_payloads" (
 "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL,
 "compiled_prompt_id" UUID NOT NULL, "agent_runtime_snapshot_id" UUID,
 "conversation_runtime_snapshot_id" UUID, "provider_runtime_snapshot_id" UUID,
 "execution_pipeline_snapshot_id" UUID, "execution_request_id" UUID, "execution_run_id" UUID,
 "renderer_version" TEXT NOT NULL, "messages" JSONB NOT NULL, "resolved_variables" JSONB NOT NULL,
 "context_metadata" JSONB NOT NULL DEFAULT '{}', "execution_payload" JSONB NOT NULL,
 "prompt_hash" TEXT NOT NULL, "payload_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "prompt_execution_payloads_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "prompt_execution_diagnostics" (
 "id" UUID NOT NULL, "payload_id" UUID NOT NULL, "severity" TEXT NOT NULL, "code" TEXT NOT NULL,
 "path" TEXT NOT NULL, "message" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "prompt_execution_diagnostics_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prompt_execution_payloads_workspace_created_idx" ON "prompt_execution_payloads"("workspace_id","created_at");
CREATE INDEX "prompt_execution_payloads_workspace_prompt_idx" ON "prompt_execution_payloads"("workspace_id","compiled_prompt_id","created_at");
CREATE INDEX "prompt_execution_payloads_workspace_request_idx" ON "prompt_execution_payloads"("workspace_id","execution_request_id");
CREATE INDEX "prompt_execution_payloads_workspace_hash_idx" ON "prompt_execution_payloads"("workspace_id","payload_hash");
CREATE INDEX "prompt_execution_diagnostics_payload_severity_idx" ON "prompt_execution_diagnostics"("payload_id","severity","created_at");
ALTER TABLE "prompt_execution_payloads" ADD CONSTRAINT "prompt_execution_payloads_workspace_id_fkey"
 FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prompt_execution_diagnostics" ADD CONSTRAINT "prompt_execution_diagnostics_payload_id_fkey"
 FOREIGN KEY ("payload_id") REFERENCES "prompt_execution_payloads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
