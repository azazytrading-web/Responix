-- Runtime success replay requires storing the canonical Native response and an in-flight claim.
ALTER TYPE "OicIdempotencyStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TABLE "OicIdempotencyRecord"
  ADD COLUMN "result" JSONB;

CREATE INDEX "OicIdempotencyRecord_status_createdAt_idx"
  ON "OicIdempotencyRecord"("status", "createdAt");
