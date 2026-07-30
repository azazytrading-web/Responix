CREATE TYPE "StreamUsageStatus" AS ENUM ('AVAILABLE', 'UNKNOWN');

ALTER TABLE "stream_sessions"
  ADD COLUMN "invocation_id" UUID,
  ADD COLUMN "usage_status" "StreamUsageStatus",
  ADD COLUMN "first_token_at" TIMESTAMP(3),
  ADD COLUMN "last_token_at" TIMESTAMP(3),
  ADD COLUMN "provider_completed_at" TIMESTAMP(3),
  ADD COLUMN "runtime_completed_at" TIMESTAMP(3),
  ADD COLUMN "response_content" TEXT,
  ADD COLUMN "input_tokens" INTEGER,
  ADD COLUMN "output_tokens" INTEGER,
  ADD COLUMN "cached_tokens" INTEGER,
  ADD COLUMN "total_tokens" INTEGER,
  ADD COLUMN "input_cost" DECIMAL(14,6),
  ADD COLUMN "output_cost" DECIMAL(14,6),
  ADD COLUMN "total_cost" DECIMAL(14,6),
  ADD COLUMN "cost_currency" TEXT,
  ADD COLUMN "pricing_metadata" JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "stream_sessions_invocation_id_key"
  ON "stream_sessions"("invocation_id");

ALTER TABLE "stream_sessions"
  ADD CONSTRAINT "stream_sessions_invocation_id_fkey"
  FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation_logs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_runtime_accounting"
  ALTER COLUMN "actual_prompt_tokens" DROP NOT NULL,
  ALTER COLUMN "actual_prompt_tokens" DROP DEFAULT,
  ALTER COLUMN "actual_completion_tokens" DROP NOT NULL,
  ALTER COLUMN "actual_completion_tokens" DROP DEFAULT,
  ALTER COLUMN "actual_cached_tokens" DROP NOT NULL,
  ALTER COLUMN "actual_cached_tokens" DROP DEFAULT,
  ALTER COLUMN "actual_total_tokens" DROP NOT NULL,
  ALTER COLUMN "actual_total_tokens" DROP DEFAULT,
  ALTER COLUMN "actual_cost" DROP NOT NULL,
  ALTER COLUMN "actual_cost" DROP DEFAULT;
