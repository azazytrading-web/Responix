CREATE TABLE "OicEvaluationSchedulerCursor" (
  "id" VARCHAR(16) NOT NULL DEFAULT 'EVALUATION',
  "lastScopeKey" VARCHAR(80),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicEvaluationSchedulerCursor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationSchedulerCursor_singleton_check" CHECK ("id" = 'EVALUATION')
);

INSERT INTO "OicEvaluationSchedulerCursor" ("id", "lastScopeKey")
VALUES ('EVALUATION', NULL)
ON CONFLICT ("id") DO NOTHING;
