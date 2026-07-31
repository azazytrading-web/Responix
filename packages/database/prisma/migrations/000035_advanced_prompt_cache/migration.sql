ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE IF NOT EXISTS 'PROVIDER_PROMPT';
ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE IF NOT EXISTS 'CONVERSATION_PREFIX';
ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE IF NOT EXISTS 'STUDIO_CONFIGURATION';
ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE IF NOT EXISTS 'TOOL_DEFINITION';
ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE IF NOT EXISTS 'WORKFLOW_PACKAGE';
ALTER TYPE "RuntimeOptimizationPackageType" ADD VALUE IF NOT EXISTS 'EXECUTION_PLAN';

CREATE TYPE "RuntimeOptimizationPackageStatus" AS ENUM ('ACTIVE', 'INVALIDATED');

ALTER TABLE "runtime_optimization_packages"
  ADD COLUMN "status" "RuntimeOptimizationPackageStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "scope_key" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publisher_id" UUID,
  ADD COLUMN "invalidated_at" TIMESTAMP(3),
  ADD COLUMN "invalidated_by_id" UUID,
  ADD COLUMN "invalidation_reason" TEXT;

ALTER TABLE "runtime_optimization_packages"
  DROP CONSTRAINT "runtime_optimization_packages_workspace_type_key";
CREATE UNIQUE INDEX "runtime_optimization_packages_active_key"
  ON "runtime_optimization_packages"("workspace_id", "type", "key_hash")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "runtime_optimization_packages_workspace_type_key_idx"
  ON "runtime_optimization_packages"("workspace_id", "type", "key_hash");

ALTER TABLE "runtime_optimization_metrics"
  ADD COLUMN "provider_cache_hits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "provider_cache_misses" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "estimated_saved_cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
  ADD COLUMN "estimated_latency_gain_ms" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "compile_time_ms" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "runtime_optimization_provider_outcomes" (
  "id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "model_id" UUID NOT NULL,
  "native_supported" BOOLEAN NOT NULL,
  "cache_hit" BOOLEAN NOT NULL,
  "cached_tokens" INTEGER NOT NULL DEFAULT 0,
  "provider_cache_id" TEXT,
  "ttl_seconds" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runtime_optimization_provider_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "runtime_optimization_packages_scope_status_idx"
  ON "runtime_optimization_packages"("workspace_id", "type", "scope_key", "status");
CREATE INDEX "runtime_optimization_provider_outcomes_workspace_idx"
  ON "runtime_optimization_provider_outcomes"("workspace_id", "provider_id", "cache_hit", "created_at");
CREATE INDEX "runtime_optimization_provider_outcomes_package_idx"
  ON "runtime_optimization_provider_outcomes"("package_id", "created_at");

ALTER TABLE "runtime_optimization_provider_outcomes"
  ADD CONSTRAINT "runtime_optimization_provider_outcomes_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "runtime_optimization_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runtime_optimization_provider_outcomes"
  ADD CONSTRAINT "runtime_optimization_provider_outcomes_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runtime_optimization_provider_outcomes"
  ADD CONSTRAINT "runtime_optimization_provider_outcomes_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "runtime_optimization_provider_outcomes"
  ADD CONSTRAINT "runtime_optimization_provider_outcomes_model_id_fkey"
  FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
