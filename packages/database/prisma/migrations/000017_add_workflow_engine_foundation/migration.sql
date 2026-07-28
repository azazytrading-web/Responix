ALTER TYPE "WorkflowStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
CREATE TYPE "WorkflowVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');
CREATE TYPE "WorkflowNodeType" AS ENUM (
  'START', 'END', 'AGENT', 'PROMPT', 'KNOWLEDGE', 'TOOL', 'WEBHOOK', 'REST',
  'CONDITION', 'DELAY', 'LOOP', 'MANUAL', 'DECISION', 'TRANSFORM', 'VARIABLE',
  'SUBFLOW', 'CUSTOM'
);

ALTER TABLE "workflows"
  ADD COLUMN "category_id" UUID,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "visibility" "WorkflowVisibility" NOT NULL DEFAULT 'WORKSPACE',
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "archived_at" TIMESTAMP(3);

UPDATE "workflows"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
  || '-' || substr("id"::text, 1, 8)
WHERE "slug" IS NULL;

ALTER TABLE "workflows"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "version" SET DEFAULT 0,
  ALTER COLUMN "trigger_type" SET DEFAULT 'MANUAL',
  ALTER COLUMN "workflow_json" SET DEFAULT '{}';

DROP INDEX IF EXISTS "workflows_workspace_id_name_version_key";
CREATE UNIQUE INDEX "workflows_workspace_id_slug_key" ON "workflows"("workspace_id", "slug");
CREATE INDEX "workflows_workspace_id_category_id_idx" ON "workflows"("workspace_id", "category_id");

CREATE TABLE "workflow_categories" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_categories_workspace_id_slug_key" ON "workflow_categories"("workspace_id", "slug");
CREATE INDEX "workflow_categories_workspace_id_name_idx" ON "workflow_categories"("workspace_id", "name");

CREATE TABLE "workflow_variables" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}',
  "default_value" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_variables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_variables_workflow_id_name_key" ON "workflow_variables"("workflow_id", "name");

CREATE TABLE "workflow_parameters" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_parameters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_parameters_workflow_id_name_key" ON "workflow_parameters"("workflow_id", "name");

CREATE TABLE "workflow_inputs" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_inputs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_inputs_workflow_id_name_key" ON "workflow_inputs"("workflow_id", "name");

CREATE TABLE "workflow_outputs" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_outputs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_outputs_workflow_id_name_key" ON "workflow_outputs"("workflow_id", "name");

CREATE TABLE "workflow_nodes" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "node_key" TEXT NOT NULL,
  "type" "WorkflowNodeType" NOT NULL,
  "name" TEXT,
  "reference_id" UUID,
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "position" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_nodes_workflow_id_node_key_key" ON "workflow_nodes"("workflow_id", "node_key");
CREATE INDEX "workflow_nodes_workflow_id_type_idx" ON "workflow_nodes"("workflow_id", "type");
CREATE INDEX "workflow_nodes_reference_id_idx" ON "workflow_nodes"("reference_id");

CREATE TABLE "workflow_edges" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "edge_key" TEXT NOT NULL,
  "source_node_key" TEXT NOT NULL,
  "target_node_key" TEXT NOT NULL,
  "label" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_edges_workflow_id_edge_key_key" ON "workflow_edges"("workflow_id", "edge_key");
CREATE INDEX "workflow_edges_workflow_id_source_node_key_idx" ON "workflow_edges"("workflow_id", "source_node_key");
CREATE INDEX "workflow_edges_workflow_id_target_node_key_idx" ON "workflow_edges"("workflow_id", "target_node_key");

CREATE TABLE "workflow_conditions" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "node_key" TEXT,
  "edge_key" TEXT,
  "expression" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_conditions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_conditions_workflow_id_key_key" ON "workflow_conditions"("workflow_id", "key");

CREATE TABLE "workflow_branches" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "node_key" TEXT NOT NULL,
  "branch_key" TEXT NOT NULL,
  "label" TEXT,
  "condition" JSONB NOT NULL,
  "target_node_key" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_branches_workflow_id_node_key_branch_key_key" ON "workflow_branches"("workflow_id", "node_key", "branch_key");

CREATE TABLE "workflow_labels" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_labels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_labels_workflow_id_name_key" ON "workflow_labels"("workflow_id", "name");

CREATE TABLE "workflow_tags" (
  "id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_tags_workspace_id_slug_key" ON "workflow_tags"("workspace_id", "slug");
CREATE INDEX "workflow_tags_workspace_id_name_idx" ON "workflow_tags"("workspace_id", "name");

CREATE TABLE "workflow_tag_assignments" (
  "workflow_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_tag_assignments_pkey" PRIMARY KEY ("workflow_id", "tag_id")
);
CREATE INDEX "workflow_tag_assignments_tag_id_idx" ON "workflow_tag_assignments"("tag_id");

CREATE TABLE "workflow_notes" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_permissions" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "permission_code" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_permissions_workflow_id_permission_code_key" ON "workflow_permissions"("workflow_id", "permission_code");

CREATE TABLE "workflow_versions" (
  "id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "change_summary" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_versions_workflow_id_revision_key" ON "workflow_versions"("workflow_id", "revision");
CREATE INDEX "workflow_versions_workflow_id_published_at_idx" ON "workflow_versions"("workflow_id", "published_at");

ALTER TABLE "workflow_categories" ADD CONSTRAINT "workflow_categories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "workflow_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_variables" ADD CONSTRAINT "workflow_variables_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_parameters" ADD CONSTRAINT "workflow_parameters_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_inputs" ADD CONSTRAINT "workflow_inputs_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_outputs" ADD CONSTRAINT "workflow_outputs_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_branches" ADD CONSTRAINT "workflow_branches_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_labels" ADD CONSTRAINT "workflow_labels_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_tag_assignments" ADD CONSTRAINT "workflow_tag_assignments_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_tag_assignments" ADD CONSTRAINT "workflow_tag_assignments_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "workflow_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_notes" ADD CONSTRAINT "workflow_notes_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_permissions" ADD CONSTRAINT "workflow_permissions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
