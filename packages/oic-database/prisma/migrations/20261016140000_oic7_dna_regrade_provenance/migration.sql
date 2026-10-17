ALTER TABLE "OicEvaluationDnaMeasurement"
ADD COLUMN "provenance" JSONB NOT NULL DEFAULT '{}'::jsonb;
