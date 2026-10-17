CREATE TABLE "OicEvaluationValidationJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "packId" UUID NOT NULL,
  "manifestDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "report" JSONB NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationValidationJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationValidationJob_status_check" CHECK ("status" IN ('PENDING', 'SUCCEEDED', 'FAILED'))
);

CREATE UNIQUE INDEX "OicEvaluationValidationJob_packId_manifestDigest_key"
  ON "OicEvaluationValidationJob"("packId", "manifestDigest");
CREATE UNIQUE INDEX "OicEvaluationValidationJob_id_applicationId_tenantId_key"
  ON "OicEvaluationValidationJob"("id", "applicationId", "tenantId");
CREATE INDEX "OicEvaluationValidationJob_applicationId_tenantId_status_createdAt_idx"
  ON "OicEvaluationValidationJob"("applicationId", "tenantId", "status", "createdAt");

ALTER TABLE "OicEvaluationValidationJob"
  ADD CONSTRAINT "OicEvaluationValidationJob_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationValidationJob"
  ADD CONSTRAINT "OicEvaluationValidationJob_tenantId_applicationId_fkey"
  FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationValidationJob"
  ADD CONSTRAINT "OicEvaluationValidationJob_packId_applicationId_tenantId_fkey"
  FOREIGN KEY ("packId", "applicationId", "tenantId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
