CREATE TYPE "RuntimeOrchestrationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ExecutionProfileVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');
CREATE TYPE "ExecutionBindingTarget" AS ENUM ('WORKFLOW', 'AGENT', 'PROMPT', 'KNOWLEDGE', 'TOOL', 'PROVIDER', 'WORKSPACE');

CREATE TABLE "queue_definitions" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL, "description" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "queue_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "queue_definitions_workspace_id_name_key" ON "queue_definitions"("workspace_id", "name");
CREATE UNIQUE INDEX "queue_definitions_workspace_id_slug_key" ON "queue_definitions"("workspace_id", "slug");

CREATE TABLE "execution_priority_levels" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL, "value" INTEGER NOT NULL, "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_priority_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_priority_levels_workspace_id_name_key" ON "execution_priority_levels"("workspace_id", "name");
CREATE UNIQUE INDEX "execution_priority_levels_workspace_id_slug_key" ON "execution_priority_levels"("workspace_id", "slug");
CREATE UNIQUE INDEX "execution_priority_levels_workspace_id_value_key" ON "execution_priority_levels"("workspace_id", "value");

CREATE TABLE "execution_profiles" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "queue_definition_id" UUID,
  "priority_level_id" UUID, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "description" TEXT, "status" "RuntimeOrchestrationStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "ExecutionProfileVisibility" NOT NULL DEFAULT 'WORKSPACE',
  "revision" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by" UUID NOT NULL, "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3), "deleted_at" TIMESTAMP(3),
  CONSTRAINT "execution_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_profiles_workspace_id_name_key" ON "execution_profiles"("workspace_id", "name");
CREATE UNIQUE INDEX "execution_profiles_workspace_id_slug_key" ON "execution_profiles"("workspace_id", "slug");
CREATE INDEX "execution_profiles_workspace_id_status_visibility_deleted_at_idx" ON "execution_profiles"("workspace_id", "status", "visibility", "deleted_at");
CREATE INDEX "execution_profiles_queue_definition_id_idx" ON "execution_profiles"("queue_definition_id");
CREATE INDEX "execution_profiles_priority_level_id_idx" ON "execution_profiles"("priority_level_id");

CREATE TABLE "execution_policies" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}', "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_policies_profile_id_key" ON "execution_policies"("profile_id");

CREATE TABLE "execution_limits" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "max_steps" INTEGER,
  "max_tokens" INTEGER, "max_cost_minor" INTEGER, "max_payload_bytes" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_limits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_limits_profile_id_key" ON "execution_limits"("profile_id");

CREATE TABLE "execution_timeouts" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "total_ms" INTEGER NOT NULL,
  "step_ms" INTEGER, "idle_ms" INTEGER, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_timeouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_timeouts_profile_id_key" ON "execution_timeouts"("profile_id");

CREATE TABLE "execution_retry_policies" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL,
  "max_attempts" INTEGER NOT NULL DEFAULT 1, "initial_delay_ms" INTEGER NOT NULL DEFAULT 0,
  "max_delay_ms" INTEGER NOT NULL DEFAULT 0,
  "multiplier" DECIMAL(6,3) NOT NULL DEFAULT 1, "jitter" BOOLEAN NOT NULL DEFAULT false,
  "retry_on" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_retry_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_retry_policies_profile_id_key" ON "execution_retry_policies"("profile_id");

CREATE TABLE "execution_failure_policies" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "strategy" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}', "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_failure_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_failure_policies_profile_id_key" ON "execution_failure_policies"("profile_id");

CREATE TABLE "execution_fallback_policies" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "strategy" TEXT NOT NULL,
  "target_type" "ExecutionBindingTarget", "target_reference_id" UUID,
  "config" JSONB NOT NULL DEFAULT '{}', "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_fallback_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_fallback_policies_profile_id_key" ON "execution_fallback_policies"("profile_id");
CREATE INDEX "execution_fallback_policies_target_reference_id_idx" ON "execution_fallback_policies"("target_reference_id");

CREATE TABLE "execution_concurrency_policies" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL,
  "max_parallel" INTEGER NOT NULL DEFAULT 1, "max_queued" INTEGER NOT NULL DEFAULT 0,
  "strategy" TEXT NOT NULL, "key_template" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_concurrency_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_concurrency_policies_profile_id_key" ON "execution_concurrency_policies"("profile_id");

CREATE TABLE "execution_contexts" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}', "value" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_contexts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_contexts_profile_id_name_key" ON "execution_contexts"("profile_id", "name");

CREATE TABLE "execution_variables" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}', "default_value" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false, "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_variables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_variables_profile_id_name_key" ON "execution_variables"("profile_id", "name");

CREATE TABLE "execution_inputs" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}', "required" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_inputs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_inputs_profile_id_name_key" ON "execution_inputs"("profile_id", "name");

CREATE TABLE "execution_outputs" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "schema" JSONB NOT NULL DEFAULT '{}', "metadata" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_outputs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_outputs_profile_id_name_key" ON "execution_outputs"("profile_id", "name");

CREATE TABLE "execution_bindings" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "key" TEXT NOT NULL,
  "target_type" "ExecutionBindingTarget" NOT NULL, "reference_id" UUID NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true, "config" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_bindings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_bindings_profile_id_key_key" ON "execution_bindings"("profile_id", "key");
CREATE INDEX "execution_bindings_reference_id_idx" ON "execution_bindings"("reference_id");

CREATE TABLE "execution_dependencies" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "binding_key" TEXT NOT NULL,
  "depends_on_binding_key" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_dependencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_dependencies_profile_binding_dependency_key"
  ON "execution_dependencies"("profile_id", "binding_key", "depends_on_binding_key");

CREATE TABLE "execution_labels" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "color" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_labels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_labels_profile_id_name_key" ON "execution_labels"("profile_id", "name");

CREATE TABLE "execution_tags" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_tags_workspace_id_name_key" ON "execution_tags"("workspace_id", "name");
CREATE UNIQUE INDEX "execution_tags_workspace_id_slug_key" ON "execution_tags"("workspace_id", "slug");

CREATE TABLE "execution_tag_assignments" (
  "profile_id" UUID NOT NULL, "tag_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_tag_assignments_pkey" PRIMARY KEY ("profile_id", "tag_id")
);
CREATE INDEX "execution_tag_assignments_tag_id_idx" ON "execution_tag_assignments"("tag_id");

CREATE TABLE "execution_notes" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "execution_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "execution_profile_versions" (
  "id" UUID NOT NULL, "profile_id" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL, "change_summary" TEXT, "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_profile_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_profile_versions_profile_id_revision_key" ON "execution_profile_versions"("profile_id", "revision");
CREATE INDEX "execution_profile_versions_profile_id_published_at_idx" ON "execution_profile_versions"("profile_id", "published_at");

ALTER TABLE "queue_definitions" ADD CONSTRAINT "queue_definitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_priority_levels" ADD CONSTRAINT "execution_priority_levels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_profiles" ADD CONSTRAINT "execution_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_profiles" ADD CONSTRAINT "execution_profiles_queue_definition_id_fkey" FOREIGN KEY ("queue_definition_id") REFERENCES "queue_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_profiles" ADD CONSTRAINT "execution_profiles_priority_level_id_fkey" FOREIGN KEY ("priority_level_id") REFERENCES "execution_priority_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_policies" ADD CONSTRAINT "execution_policies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_limits" ADD CONSTRAINT "execution_limits_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_timeouts" ADD CONSTRAINT "execution_timeouts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_retry_policies" ADD CONSTRAINT "execution_retry_policies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_failure_policies" ADD CONSTRAINT "execution_failure_policies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_fallback_policies" ADD CONSTRAINT "execution_fallback_policies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_concurrency_policies" ADD CONSTRAINT "execution_concurrency_policies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_contexts" ADD CONSTRAINT "execution_contexts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_variables" ADD CONSTRAINT "execution_variables_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_inputs" ADD CONSTRAINT "execution_inputs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_outputs" ADD CONSTRAINT "execution_outputs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_bindings" ADD CONSTRAINT "execution_bindings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_dependencies" ADD CONSTRAINT "execution_dependencies_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_labels" ADD CONSTRAINT "execution_labels_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_tags" ADD CONSTRAINT "execution_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_tag_assignments" ADD CONSTRAINT "execution_tag_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_tag_assignments" ADD CONSTRAINT "execution_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "execution_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_notes" ADD CONSTRAINT "execution_notes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_profile_versions" ADD CONSTRAINT "execution_profile_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "execution_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
