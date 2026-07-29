CREATE TYPE "ExecutionPipelineStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED','DELETED');
CREATE TABLE "execution_pipelines" (
 "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL, "updated_by" UUID NOT NULL,
 "cloned_from_id" UUID, "name" TEXT NOT NULL, "status" "ExecutionPipelineStatus" NOT NULL DEFAULT 'DRAFT',
 "revision" INTEGER NOT NULL DEFAULT 0, "compatibility_version" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "plan" JSONB NOT NULL, "plan_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "published_at" TIMESTAMP(3),
 "archived_at" TIMESTAMP(3), "deleted_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "execution_pipelines_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "execution_pipeline_revisions" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "revision" INTEGER NOT NULL, "source_revision" INTEGER,
 "plan" JSONB NOT NULL, "plan_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "created_by" UUID NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "execution_pipeline_revisions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "execution_pipeline_snapshots" (
 "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "revision" INTEGER NOT NULL,
 "created_by" UUID NOT NULL, "snapshot" JSONB NOT NULL, "plan_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "execution_pipeline_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_nodes" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "node_key" TEXT NOT NULL, "stage" TEXT NOT NULL,
 "ordinal" INTEGER NOT NULL, "asset_type" TEXT, "asset_id" UUID, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_nodes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_dependencies" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "dependency_key" TEXT NOT NULL, "from_node_key" TEXT NOT NULL,
 "to_node_key" TEXT NOT NULL, "required" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_dependencies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_validations" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "valid" BOOLEAN NOT NULL, "result" JSONB NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_validations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_audits" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "actor_id" UUID NOT NULL, "event_type" TEXT NOT NULL,
 "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "pipeline_audits_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_metadata" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "key" TEXT NOT NULL, "value" JSONB NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_metadata_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_labels" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "value" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_labels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_tags" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "value" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_tags_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_variables" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL,
 "value" JSONB NOT NULL, "required" BOOLEAN NOT NULL DEFAULT false,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_variables_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pipeline_diagnostics" (
 "id" UUID NOT NULL, "pipeline_id" UUID NOT NULL, "severity" TEXT NOT NULL, "code" TEXT NOT NULL,
 "path" TEXT NOT NULL, "message" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pipeline_diagnostics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "execution_pipelines_workspace_name_key" ON "execution_pipelines"("workspace_id","name");
CREATE INDEX "execution_pipelines_workspace_status_idx" ON "execution_pipelines"("workspace_id","status","deleted_at","updated_at");
CREATE INDEX "execution_pipelines_workspace_hash_idx" ON "execution_pipelines"("workspace_id","plan_hash");
CREATE UNIQUE INDEX "execution_pipeline_revisions_pipeline_revision_key" ON "execution_pipeline_revisions"("pipeline_id","revision");
CREATE INDEX "execution_pipeline_revisions_pipeline_created_idx" ON "execution_pipeline_revisions"("pipeline_id","created_at");
CREATE UNIQUE INDEX "execution_pipeline_snapshots_pipeline_revision_key" ON "execution_pipeline_snapshots"("pipeline_id","revision");
CREATE INDEX "execution_pipeline_snapshots_workspace_created_idx" ON "execution_pipeline_snapshots"("workspace_id","created_at");
CREATE UNIQUE INDEX "pipeline_nodes_pipeline_key_key" ON "pipeline_nodes"("pipeline_id","node_key");
CREATE UNIQUE INDEX "pipeline_nodes_pipeline_stage_key" ON "pipeline_nodes"("pipeline_id","stage");
CREATE UNIQUE INDEX "pipeline_dependencies_pipeline_key_key" ON "pipeline_dependencies"("pipeline_id","dependency_key");
CREATE INDEX "pipeline_validations_pipeline_created_idx" ON "pipeline_validations"("pipeline_id","created_at");
CREATE INDEX "pipeline_audits_pipeline_created_idx" ON "pipeline_audits"("pipeline_id","created_at");
CREATE UNIQUE INDEX "pipeline_metadata_pipeline_key_key" ON "pipeline_metadata"("pipeline_id","key");
CREATE UNIQUE INDEX "pipeline_labels_pipeline_value_key" ON "pipeline_labels"("pipeline_id","value");
CREATE UNIQUE INDEX "pipeline_tags_pipeline_value_key" ON "pipeline_tags"("pipeline_id","value");
CREATE UNIQUE INDEX "pipeline_variables_pipeline_name_key" ON "pipeline_variables"("pipeline_id","name");
CREATE INDEX "pipeline_diagnostics_pipeline_severity_idx" ON "pipeline_diagnostics"("pipeline_id","severity","created_at");
ALTER TABLE "execution_pipelines" ADD CONSTRAINT "execution_pipelines_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_pipeline_snapshots" ADD CONSTRAINT "execution_pipeline_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_pipeline_revisions" ADD CONSTRAINT "execution_pipeline_revisions_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "execution_pipeline_snapshots" ADD CONSTRAINT "execution_pipeline_snapshots_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_nodes" ADD CONSTRAINT "pipeline_nodes_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_dependencies" ADD CONSTRAINT "pipeline_dependencies_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_validations" ADD CONSTRAINT "pipeline_validations_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_audits" ADD CONSTRAINT "pipeline_audits_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_metadata" ADD CONSTRAINT "pipeline_metadata_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_labels" ADD CONSTRAINT "pipeline_labels_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_tags" ADD CONSTRAINT "pipeline_tags_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_variables" ADD CONSTRAINT "pipeline_variables_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_diagnostics" ADD CONSTRAINT "pipeline_diagnostics_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "execution_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
