CREATE TYPE "ToolRegistryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ToolDefinitionType" AS ENUM ('REST', 'WEBHOOK', 'OPENAPI', 'INTERNAL_SERVICE', 'FUNCTION', 'MCP');
CREATE TYPE "ToolVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');
CREATE TYPE "ToolAuthenticationType" AS ENUM ('NONE', 'API_KEY', 'OAUTH2', 'BASIC', 'BEARER', 'CUSTOM');
CREATE TYPE "ToolParameterLocation" AS ENUM ('PATH', 'QUERY', 'HEADER', 'BODY', 'COOKIE');
CREATE TYPE "ToolSchemaKind" AS ENUM ('INPUT', 'OUTPUT');

CREATE TABLE "tool_categories" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_categories_workspace_id_slug_key" ON "tool_categories"("workspace_id", "slug");

CREATE TABLE "tool_groups" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "category_id" UUID,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_groups_workspace_id_slug_key" ON "tool_groups"("workspace_id", "slug");
CREATE INDEX "tool_groups_workspace_id_category_id_idx" ON "tool_groups"("workspace_id", "category_id");

CREATE TABLE "tool_definitions" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "category_id" UUID,
  "group_id" UUID,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "type" "ToolDefinitionType" NOT NULL,
  "status" "ToolRegistryStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "ToolVisibility" NOT NULL DEFAULT 'WORKSPACE',
  "authentication_type" "ToolAuthenticationType" NOT NULL DEFAULT 'NONE',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "provider_metadata" JSONB NOT NULL DEFAULT '{}',
  "authentication_metadata" JSONB NOT NULL DEFAULT '{}',
  "rate_limit_metadata" JSONB NOT NULL DEFAULT '{}',
  "execution_policy_metadata" JSONB NOT NULL DEFAULT '{}',
  "timeout_metadata" JSONB NOT NULL DEFAULT '{}',
  "retry_policy_metadata" JSONB NOT NULL DEFAULT '{}',
  "cost_metadata" JSONB NOT NULL DEFAULT '{}',
  "compatibility_metadata" JSONB NOT NULL DEFAULT '{}',
  "health_metadata" JSONB NOT NULL DEFAULT '{}',
  "mcp_metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "tool_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_definitions_workspace_id_slug_key" ON "tool_definitions"("workspace_id", "slug");
CREATE INDEX "tool_definitions_workspace_id_status_visibility_deleted_at_idx" ON "tool_definitions"("workspace_id", "status", "visibility", "deleted_at");
CREATE INDEX "tool_definitions_category_id_group_id_idx" ON "tool_definitions"("category_id", "group_id");

CREATE TABLE "tool_parameters" (
  "id" UUID NOT NULL,
  "tool_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "location" "ToolParameterLocation" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "schema" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_parameters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_parameters_tool_id_name_location_key" ON "tool_parameters"("tool_id", "name", "location");
CREATE INDEX "tool_parameters_tool_id_sort_order_idx" ON "tool_parameters"("tool_id", "sort_order");

CREATE TABLE "tool_schemas" (
  "id" UUID NOT NULL,
  "tool_id" UUID NOT NULL,
  "kind" "ToolSchemaKind" NOT NULL,
  "schema" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_schemas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_schemas_tool_id_kind_key" ON "tool_schemas"("tool_id", "kind");

CREATE TABLE "tool_capabilities" (
  "id" UUID NOT NULL,
  "tool_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_capabilities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_capabilities_tool_id_code_key" ON "tool_capabilities"("tool_id", "code");

CREATE TABLE "tool_permissions" (
  "id" UUID NOT NULL,
  "tool_id" UUID NOT NULL,
  "permission_code" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_permissions_tool_id_permission_code_key" ON "tool_permissions"("tool_id", "permission_code");

CREATE TABLE "tool_versions" (
  "id" UUID NOT NULL,
  "tool_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "change_summary" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tool_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_versions_tool_id_revision_key" ON "tool_versions"("tool_id", "revision");
CREATE INDEX "tool_versions_tool_id_published_at_idx" ON "tool_versions"("tool_id", "published_at");

ALTER TABLE "tool_categories" ADD CONSTRAINT "tool_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "tool_groups" ADD CONSTRAINT "tool_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
ALTER TABLE "tool_groups" ADD CONSTRAINT "tool_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tool_categories"("id") ON DELETE SET NULL;
ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tool_categories"("id") ON DELETE SET NULL;
ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tool_groups"("id") ON DELETE SET NULL;
ALTER TABLE "tool_parameters" ADD CONSTRAINT "tool_parameters_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tool_definitions"("id") ON DELETE CASCADE;
ALTER TABLE "tool_schemas" ADD CONSTRAINT "tool_schemas_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tool_definitions"("id") ON DELETE CASCADE;
ALTER TABLE "tool_capabilities" ADD CONSTRAINT "tool_capabilities_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tool_definitions"("id") ON DELETE CASCADE;
ALTER TABLE "tool_permissions" ADD CONSTRAINT "tool_permissions_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tool_definitions"("id") ON DELETE CASCADE;
ALTER TABLE "tool_versions" ADD CONSTRAINT "tool_versions_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tool_definitions"("id") ON DELETE CASCADE;

INSERT INTO "permissions" ("id", "code", "created_at", "updated_at")
SELECT gen_random_uuid(), code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('tool.registry.read'),
  ('tool.registry.write'),
  ('tool.registry.publish'),
  ('tool.registry.rollback'),
  ('tool.registry.archive'),
  ('tool.registry.delete'),
  ('tool.registry.manage')
) AS tool_registry_permissions(code)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), roles.id, permissions.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" roles
CROSS JOIN "permissions" permissions
WHERE roles."workspace_id" IS NULL
  AND roles."name" IN ('Owner', 'Administrator')
  AND permissions."code" LIKE 'tool.registry.%'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
