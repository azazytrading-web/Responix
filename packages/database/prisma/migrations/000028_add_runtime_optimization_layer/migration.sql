CREATE TYPE "RuntimeOptimizationPackageType" AS ENUM ('COMPILED_PROMPT', 'RENDERED_PROMPT', 'RUNTIME_CONTEXT', 'RETRIEVAL_RUNTIME');
CREATE TABLE "runtime_optimization_packages" (
  "id" UUID NOT NULL, "workspace_id" UUID NOT NULL, "created_by" UUID NOT NULL,
  "type" "RuntimeOptimizationPackageType" NOT NULL, "key_hash" TEXT NOT NULL,
  "source_hash" TEXT NOT NULL, "static_variables_hash" TEXT,
  "payload" JSONB NOT NULL, "asset_references" JSONB NOT NULL DEFAULT '{}',
  "package_hash" TEXT NOT NULL, "checksum" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runtime_optimization_packages_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "runtime_optimization_metrics" (
  "id" UUID NOT NULL, "package_id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "cache_hits" INTEGER NOT NULL DEFAULT 0, "cache_misses" INTEGER NOT NULL DEFAULT 1,
  "reuse_count" INTEGER NOT NULL DEFAULT 0, "compiled_prompt_reuse" INTEGER NOT NULL DEFAULT 0,
  "rendered_prompt_reuse" INTEGER NOT NULL DEFAULT 0, "runtime_snapshot_reuse" INTEGER NOT NULL DEFAULT 0,
  "retrieval_package_reuse" INTEGER NOT NULL DEFAULT 0, "provider_cache_available" BOOLEAN NOT NULL DEFAULT false,
  "provider_cache_usage" INTEGER NOT NULL DEFAULT 0, "estimated_saved_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_saved_requests" INTEGER NOT NULL DEFAULT 0,
  "estimated_saved_compilation_operations" INTEGER NOT NULL DEFAULT 0,
  "estimated_saved_rendering_operations" INTEGER NOT NULL DEFAULT 0,
  "total_lifetime_ms" BIGINT NOT NULL DEFAULT 0, "average_cache_lifetime_ms" INTEGER NOT NULL DEFAULT 0,
  "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "runtime_optimization_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "runtime_optimization_packages_workspace_type_key" ON "runtime_optimization_packages"("workspace_id", "type", "key_hash");
CREATE INDEX "runtime_optimization_packages_workspace_type_idx" ON "runtime_optimization_packages"("workspace_id", "type", "created_at");
CREATE INDEX "runtime_optimization_packages_workspace_hash_idx" ON "runtime_optimization_packages"("workspace_id", "package_hash");
CREATE UNIQUE INDEX "runtime_optimization_metrics_package_id_key" ON "runtime_optimization_metrics"("package_id");
CREATE INDEX "runtime_optimization_metrics_last_accessed_idx" ON "runtime_optimization_metrics"("last_accessed_at");
ALTER TABLE "runtime_optimization_packages" ADD CONSTRAINT "runtime_optimization_packages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runtime_optimization_metrics" ADD CONSTRAINT "runtime_optimization_metrics_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "runtime_optimization_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
