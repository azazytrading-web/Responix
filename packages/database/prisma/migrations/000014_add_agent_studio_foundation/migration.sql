ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE TYPE "AgentVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');
CREATE TYPE "AgentPromptRole" AS ENUM ('SYSTEM', 'DEVELOPER', 'USER_TEMPLATE', 'LIBRARY');

ALTER TABLE "ai_agents"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "avatar_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "color_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "icon_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "stop_sequences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "streaming_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
  ADD COLUMN "retry_policy" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "fallback_strategy" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "runtime_configuration" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "provider_configuration_id" UUID,
  ADD COLUMN "provider_configuration" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "model_configuration" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "capabilities_metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "vision_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reasoning_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voice_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "image_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderation_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "visibility" "AgentVisibility" NOT NULL DEFAULT 'WORKSPACE',
  ADD COLUMN "created_by" UUID,
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "ai_agents" ALTER COLUMN "version" SET DEFAULT 0;

CREATE UNIQUE INDEX "ai_agents_workspace_id_slug_key"
  ON "ai_agents"("workspace_id", "slug");

ALTER TABLE "ai_agents"
  ADD CONSTRAINT "ai_agents_provider_configuration_id_fkey"
  FOREIGN KEY ("provider_configuration_id")
  REFERENCES "ai_provider_configurations"("id")
  ON DELETE SET NULL;

CREATE TABLE "agent_prompt_bindings" (
  "id" UUID NOT NULL,
  "agent_id" UUID NOT NULL,
  "role" "AgentPromptRole" NOT NULL,
  "prompt_id" UUID NOT NULL,
  "prompt_version_id" UUID,
  "variable_metadata" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_prompt_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_prompt_bindings_agent_id_role_prompt_id_key"
  ON "agent_prompt_bindings"("agent_id", "role", "prompt_id");
CREATE INDEX "agent_prompt_bindings_prompt_id_idx"
  ON "agent_prompt_bindings"("prompt_id");
CREATE INDEX "agent_prompt_bindings_prompt_version_id_idx"
  ON "agent_prompt_bindings"("prompt_version_id");

ALTER TABLE "agent_prompt_bindings"
  ADD CONSTRAINT "agent_prompt_bindings_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE;
ALTER TABLE "agent_prompt_bindings"
  ADD CONSTRAINT "agent_prompt_bindings_prompt_id_fkey"
  FOREIGN KEY ("prompt_id") REFERENCES "prompt_library_items"("id") ON DELETE RESTRICT;
ALTER TABLE "agent_prompt_bindings"
  ADD CONSTRAINT "agent_prompt_bindings_prompt_version_id_fkey"
  FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_library_versions"("id") ON DELETE RESTRICT;

CREATE TABLE "ai_agent_versions" (
  "id" UUID NOT NULL,
  "agent_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "change_summary" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_agent_versions_agent_id_revision_key"
  ON "ai_agent_versions"("agent_id", "revision");
CREATE INDEX "ai_agent_versions_agent_id_published_at_idx"
  ON "ai_agent_versions"("agent_id", "published_at");

ALTER TABLE "ai_agent_versions"
  ADD CONSTRAINT "ai_agent_versions_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE;

INSERT INTO "permissions" ("id", "code", "created_at", "updated_at")
SELECT gen_random_uuid(), code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('agent.studio.read'),
  ('agent.studio.write'),
  ('agent.studio.publish'),
  ('agent.studio.rollback'),
  ('agent.studio.archive'),
  ('agent.studio.delete')
) AS agent_permissions(code)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), roles.id, permissions.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" roles
CROSS JOIN "permissions" permissions
WHERE roles."workspace_id" IS NULL
  AND roles."name" IN ('Owner', 'Administrator')
  AND permissions."code" LIKE 'agent.studio.%'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
