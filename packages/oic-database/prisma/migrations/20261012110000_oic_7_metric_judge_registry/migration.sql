CREATE TABLE "OicEvaluationMetricRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "metricKey" VARCHAR(96) NOT NULL,
    "revision" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "definitionDigest" CHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OicEvaluationMetricRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicEvaluationMetricRevision_applicationId_tenantId_metricKey_revision_key" ON "OicEvaluationMetricRevision"("applicationId", "tenantId", "metricKey", "revision");
CREATE UNIQUE INDEX "OicEvaluationMetricRevision_applicationId_tenantId_definitionDigest_key" ON "OicEvaluationMetricRevision"("applicationId", "tenantId", "definitionDigest");
CREATE INDEX "OicEvaluationMetricRevision_applicationId_tenantId_status_metricKey_idx" ON "OicEvaluationMetricRevision"("applicationId", "tenantId", "status", "metricKey");
ALTER TABLE "OicEvaluationMetricRevision" ADD CONSTRAINT "OicEvaluationMetricRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationMetricRevision" ADD CONSTRAINT "OicEvaluationMetricRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OicEvaluationJudgeRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "judgeKey" VARCHAR(96) NOT NULL,
    "revision" INTEGER NOT NULL,
    "judgeType" VARCHAR(16) NOT NULL,
    "definition" JSONB NOT NULL,
    "definitionDigest" CHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OicEvaluationJudgeRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicEvaluationJudgeRevision_applicationId_tenantId_judgeKey_revision_key" ON "OicEvaluationJudgeRevision"("applicationId", "tenantId", "judgeKey", "revision");
CREATE UNIQUE INDEX "OicEvaluationJudgeRevision_applicationId_tenantId_definitionDigest_key" ON "OicEvaluationJudgeRevision"("applicationId", "tenantId", "definitionDigest");
CREATE INDEX "OicEvaluationJudgeRevision_applicationId_tenantId_status_judgeType_idx" ON "OicEvaluationJudgeRevision"("applicationId", "tenantId", "status", "judgeType");
ALTER TABLE "OicEvaluationJudgeRevision" ADD CONSTRAINT "OicEvaluationJudgeRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationJudgeRevision" ADD CONSTRAINT "OicEvaluationJudgeRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
