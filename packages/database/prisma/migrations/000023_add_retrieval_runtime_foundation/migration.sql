CREATE TYPE "RetrievalRuntimeStatus" AS ENUM ('PREPARED', 'PUBLISHED', 'ARCHIVED', 'REJECTED');
CREATE TYPE "RetrievalDiagnosticSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

CREATE TABLE "retrieval_runtimes" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL, "name" TEXT NOT NULL, "language" TEXT,
  "allowed_mime_types" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" "RetrievalRuntimeStatus" NOT NULL DEFAULT 'PREPARED',
  "metadata" JSONB NOT NULL DEFAULT '{}', "retrieval_package" JSONB NOT NULL,
  "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
  "latest_snapshot_revision" INTEGER NOT NULL DEFAULT 0, "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "retrieval_runtimes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "retrieval_runtime_snapshots" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "runtime_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL, "created_by" UUID NOT NULL, "knowledge_base_id" UUID NOT NULL,
  "retrieval_package" JSONB NOT NULL, "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_runtime_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "retrieval_runtime_sources" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "document_id" UUID NOT NULL,
  "version_id" UUID NOT NULL, "source_type" "KnowledgeSourceType" NOT NULL,
  "mime_type" TEXT NOT NULL, "language" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_runtime_sources_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "retrieval_runtime_collections" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "collection_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_runtime_collections_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "retrieval_runtime_filters" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "key" TEXT NOT NULL, "operator" TEXT NOT NULL,
  "value" JSONB NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_runtime_filters_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "retrieval_runtime_variables" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL,
  "value" JSONB NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_runtime_variables_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "retrieval_runtime_diagnostics" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "severity" "RetrievalDiagnosticSeverity" NOT NULL,
  "code" TEXT NOT NULL, "path" TEXT NOT NULL, "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retrieval_runtime_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "retrieval_runtimes_workspace_status_idx" ON "retrieval_runtimes"("workspace_id", "status", "created_at");
CREATE INDEX "retrieval_runtimes_workspace_space_idx" ON "retrieval_runtimes"("workspace_id", "knowledge_base_id", "created_at");
CREATE INDEX "retrieval_runtimes_workspace_hash_idx" ON "retrieval_runtimes"("workspace_id", "package_hash");
CREATE UNIQUE INDEX "retrieval_runtime_snapshots_runtime_revision_key" ON "retrieval_runtime_snapshots"("runtime_id", "revision");
CREATE INDEX "retrieval_runtime_snapshots_workspace_published_idx" ON "retrieval_runtime_snapshots"("workspace_id", "published_at");
CREATE INDEX "retrieval_runtime_snapshots_workspace_hash_idx" ON "retrieval_runtime_snapshots"("workspace_id", "package_hash");
CREATE UNIQUE INDEX "retrieval_runtime_sources_runtime_document_key" ON "retrieval_runtime_sources"("runtime_id", "document_id");
CREATE UNIQUE INDEX "retrieval_runtime_sources_runtime_version_key" ON "retrieval_runtime_sources"("runtime_id", "version_id");
CREATE INDEX "retrieval_runtime_sources_type_mime_idx" ON "retrieval_runtime_sources"("runtime_id", "source_type", "mime_type");
CREATE UNIQUE INDEX "retrieval_runtime_collections_runtime_collection_key" ON "retrieval_runtime_collections"("runtime_id", "collection_id");
CREATE UNIQUE INDEX "retrieval_runtime_filters_runtime_key_operator_key" ON "retrieval_runtime_filters"("runtime_id", "key", "operator");
CREATE INDEX "retrieval_runtime_filters_key_idx" ON "retrieval_runtime_filters"("runtime_id", "key");
CREATE UNIQUE INDEX "retrieval_runtime_variables_runtime_name_key" ON "retrieval_runtime_variables"("runtime_id", "name");
CREATE INDEX "retrieval_runtime_diagnostics_severity_code_idx" ON "retrieval_runtime_diagnostics"("runtime_id", "severity", "code");

ALTER TABLE "retrieval_runtimes" ADD CONSTRAINT "retrieval_runtimes_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_snapshots" ADD CONSTRAINT "retrieval_runtime_snapshots_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_snapshots" ADD CONSTRAINT "retrieval_runtime_snapshots_runtime_id_fkey"
FOREIGN KEY ("runtime_id") REFERENCES "retrieval_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_sources" ADD CONSTRAINT "retrieval_runtime_sources_runtime_id_fkey"
FOREIGN KEY ("runtime_id") REFERENCES "retrieval_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_collections" ADD CONSTRAINT "retrieval_runtime_collections_runtime_id_fkey"
FOREIGN KEY ("runtime_id") REFERENCES "retrieval_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_filters" ADD CONSTRAINT "retrieval_runtime_filters_runtime_id_fkey"
FOREIGN KEY ("runtime_id") REFERENCES "retrieval_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_variables" ADD CONSTRAINT "retrieval_runtime_variables_runtime_id_fkey"
FOREIGN KEY ("runtime_id") REFERENCES "retrieval_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retrieval_runtime_diagnostics" ADD CONSTRAINT "retrieval_runtime_diagnostics_runtime_id_fkey"
FOREIGN KEY ("runtime_id") REFERENCES "retrieval_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
