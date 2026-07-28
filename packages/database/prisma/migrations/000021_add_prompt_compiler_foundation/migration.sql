CREATE TABLE "compiled_prompts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "agent_version_id" UUID,
    "agent_runtime_snapshot_id" UUID,
    "execution_request_id" UUID,
    "conversation_id" UUID,
    "compiler_version" TEXT NOT NULL,
    "compiled_package" JSONB NOT NULL,
    "resolved_prompt" JSONB NOT NULL,
    "variable_map" JSONB NOT NULL,
    "variable_metadata" JSONB NOT NULL,
    "prompt_metadata" JSONB NOT NULL,
    "diagnostics" JSONB NOT NULL DEFAULT '[]',
    "dependency_map" JSONB NOT NULL DEFAULT '{}',
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hash" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "compiled_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compiled_prompts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compiled_prompts_workspace_compiled_idx"
    ON "compiled_prompts"("workspace_id", "compiled_at");
CREATE INDEX "compiled_prompts_workspace_prompt_idx"
    ON "compiled_prompts"("workspace_id", "prompt_id", "compiled_at");
CREATE INDEX "compiled_prompts_workspace_prompt_version_idx"
    ON "compiled_prompts"("workspace_id", "prompt_version_id");
CREATE INDEX "compiled_prompts_workspace_agent_version_idx"
    ON "compiled_prompts"("workspace_id", "agent_version_id");
CREATE INDEX "compiled_prompts_workspace_hash_idx"
    ON "compiled_prompts"("workspace_id", "hash");

ALTER TABLE "compiled_prompts"
    ADD CONSTRAINT "compiled_prompts_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
