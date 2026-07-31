CREATE TYPE "MemoryRuntimeType" AS ENUM ('CONVERSATION','SESSION','WORKSPACE','AGENT','EXECUTION','TEMPORARY_RUNTIME','SHARED_RUNTIME','REFERENCE');
CREATE TYPE "MemoryRuntimeStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE "MemoryReferenceKind" AS ENUM ('DEPENDENCY','REFERENCE');
ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE 'MEMORY_RUNTIME';

CREATE TABLE "memory_runtimes" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL, "identifier" TEXT NOT NULL, "name" TEXT NOT NULL,
  "type" "MemoryRuntimeType" NOT NULL, "scope_key" TEXT NOT NULL,
  "status" "MemoryRuntimeStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 0, "state_version" INTEGER NOT NULL DEFAULT 0,
  "compatibility_version" TEXT NOT NULL, "execution_request_id" UUID,
  "execution_run_id" UUID, "content" JSONB NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memory_runtimes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtimes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memory_runtimes_workspace_identifier_key" ON "memory_runtimes"("workspace_id","identifier");
CREATE INDEX "memory_runtimes_workspace_type_status_idx" ON "memory_runtimes"("workspace_id","type","status","updated_at");
CREATE INDEX "memory_runtimes_workspace_scope_idx" ON "memory_runtimes"("workspace_id","scope_key");

CREATE TABLE "memory_runtime_snapshots" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "runtime_id" UUID NOT NULL,
  "version" INTEGER NOT NULL, "revision" INTEGER NOT NULL, "created_by" UUID NOT NULL,
  "compatibility_version" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memory_runtime_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtime_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "memory_runtime_snapshots_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memory_runtime_snapshots_runtime_revision_key" ON "memory_runtime_snapshots"("runtime_id","revision");
CREATE INDEX "memory_runtime_snapshots_workspace_created_idx" ON "memory_runtime_snapshots"("workspace_id","created_at");

CREATE TABLE "memory_runtime_versions" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "version" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL, "source_revision" INTEGER, "snapshot" JSONB NOT NULL,
  "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memory_runtime_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtime_versions_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memory_runtime_versions_runtime_revision_key" ON "memory_runtime_versions"("runtime_id","revision");
CREATE INDEX "memory_runtime_versions_runtime_created_idx" ON "memory_runtime_versions"("runtime_id","created_at");

CREATE TABLE "memory_runtime_references" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "target_runtime_id" UUID NOT NULL,
  "target_revision" INTEGER, "reference_key" TEXT NOT NULL, "kind" "MemoryReferenceKind" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memory_runtime_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtime_references_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "memory_runtime_references_target_runtime_id_fkey" FOREIGN KEY ("target_runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memory_runtime_references_runtime_key_key" ON "memory_runtime_references"("runtime_id","reference_key");
CREATE INDEX "memory_runtime_references_target_idx" ON "memory_runtime_references"("target_runtime_id");

CREATE TABLE "memory_runtime_diagnostics" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "severity" TEXT NOT NULL,
  "code" TEXT NOT NULL, "path" TEXT NOT NULL, "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memory_runtime_diagnostics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtime_diagnostics_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "memory_runtime_diagnostics_runtime_severity_idx" ON "memory_runtime_diagnostics"("runtime_id","severity","created_at");

CREATE TABLE "memory_runtime_metrics" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "load_count" INTEGER NOT NULL DEFAULT 0,
  "cache_hit_count" INTEGER NOT NULL DEFAULT 0, "write_count" INTEGER NOT NULL DEFAULT 0,
  "resolution_duration_ms" INTEGER NOT NULL DEFAULT 0, "last_resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memory_runtime_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtime_metrics_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memory_runtime_metrics_runtime_id_key" ON "memory_runtime_metrics"("runtime_id");

CREATE TABLE "memory_runtime_lifecycle" (
  "id" UUID NOT NULL, "runtime_id" UUID NOT NULL, "actor_id" UUID NOT NULL,
  "from_status" "MemoryRuntimeStatus", "to_status" "MemoryRuntimeStatus" NOT NULL,
  "state_version" INTEGER NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memory_runtime_lifecycle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_runtime_lifecycle_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "memory_runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "memory_runtime_lifecycle_runtime_state_key" ON "memory_runtime_lifecycle"("runtime_id","state_version");
