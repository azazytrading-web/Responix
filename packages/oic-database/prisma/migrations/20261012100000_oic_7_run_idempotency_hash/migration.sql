ALTER TABLE "OicEvaluationRun"
ADD COLUMN "requestHash" CHAR(64);

UPDATE "OicEvaluationRun"
SET "requestHash" = repeat('0', 64)
WHERE "requestHash" IS NULL;

ALTER TABLE "OicEvaluationRun"
ALTER COLUMN "requestHash" SET NOT NULL;
