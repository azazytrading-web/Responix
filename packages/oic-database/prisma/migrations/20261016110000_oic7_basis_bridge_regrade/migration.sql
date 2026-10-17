-- Additive Packet 7.6 evidence-basis bridge and replay records.
ALTER TABLE "OicEvaluationReport"
  ADD COLUMN "regradePassId" UUID,
  ADD COLUMN "effectiveGradingManifestId" UUID,
  ADD COLUMN "sourceReportId" UUID;

CREATE UNIQUE INDEX "OicEvaluationReport_regradePassId_key" ON "OicEvaluationReport"("regradePassId");
CREATE TABLE "OicEvaluationBasisDraft" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "kind" VARCHAR(24) NOT NULL,
  "draftKey" VARCHAR(128) NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  "createdByPrincipalId" UUID NOT NULL,
  "publishedByPrincipalId" UUID,
  "publishedEntityId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationBasisDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationBasisDraft_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationBasisDraft_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicEvaluationBasisDraft_applicationId_tenantId_kind_draftKey_key"
  ON "OicEvaluationBasisDraft"("applicationId", "tenantId", "kind", "draftKey");
CREATE UNIQUE INDEX "OicEvaluationBasisDraft_applicationId_tenantId_payloadDigest_key"
  ON "OicEvaluationBasisDraft"("applicationId", "tenantId", "payloadDigest");
CREATE INDEX "OicEvaluationBasisDraft_applicationId_tenantId_status_createdAt_idx"
  ON "OicEvaluationBasisDraft"("applicationId", "tenantId", "status", "createdAt");

CREATE TABLE "OicEvaluationBasisBridgeRevision" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "bridgeKey" VARCHAR(96) NOT NULL,
  "revision" INTEGER NOT NULL,
  "bridgeType" VARCHAR(32) NOT NULL,
  "sourceManifestId" UUID NOT NULL,
  "targetGradingManifestId" UUID NOT NULL,
  "sourceMetricRevisionId" UUID NOT NULL,
  "targetMetricRevisionId" UUID NOT NULL,
  "sourceMethodRevision" VARCHAR(128),
  "targetMethodRevision" VARCHAR(128) NOT NULL,
  "validationEvidence" JSONB NOT NULL,
  "validationEvidenceDigest" CHAR(64) NOT NULL,
  "bridgeDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "authorPrincipalId" UUID NOT NULL,
  "publisherPrincipalId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationBasisBridgeRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationBasisBridgeRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationBasisBridgeRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationBasisBridgeRevision_sourceManifestId_fkey" FOREIGN KEY ("sourceManifestId") REFERENCES "OicEvaluationProtocolManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationBasisBridgeRevision_targetGradingManifestId_fkey" FOREIGN KEY ("targetGradingManifestId") REFERENCES "OicEvaluationProtocolManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationBasisBridgeRevision_sourceMetricRevisionId_fkey" FOREIGN KEY ("sourceMetricRevisionId") REFERENCES "OicEvaluationMetricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationBasisBridgeRevision_targetMetricRevisionId_fkey" FOREIGN KEY ("targetMetricRevisionId") REFERENCES "OicEvaluationMetricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicEvalBasisBridge_app_tenant_key_rev_uq" ON "OicEvaluationBasisBridgeRevision"("applicationId", "tenantId", "bridgeKey", "revision");
CREATE UNIQUE INDEX "OicEvalBasisBridge_app_tenant_digest_uq" ON "OicEvaluationBasisBridgeRevision"("applicationId", "tenantId", "bridgeDigest");
CREATE INDEX "OicEvaluationBasisBridgeRevision_applicationId_tenantId_status_publishedAt_idx"
  ON "OicEvaluationBasisBridgeRevision"("applicationId", "tenantId", "status", "publishedAt");

CREATE TABLE "OicEvaluationRegradePass" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "sourceRunId" UUID NOT NULL,
  "sourceManifestId" UUID NOT NULL,
  "gradingManifestId" UUID NOT NULL,
  "bridgeRevisionId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "sourceSetDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  "resultDigest" CHAR(64),
  "createdByPrincipalId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationRegradePass_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationRegradePass_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradePass_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradePass_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "OicEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradePass_sourceManifestId_fkey" FOREIGN KEY ("sourceManifestId") REFERENCES "OicEvaluationProtocolManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradePass_gradingManifestId_fkey" FOREIGN KEY ("gradingManifestId") REFERENCES "OicEvaluationProtocolManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradePass_bridgeRevisionId_fkey" FOREIGN KEY ("bridgeRevisionId") REFERENCES "OicEvaluationBasisBridgeRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicEvaluationRegradePass_applicationId_tenantId_idempotencyKey_key" ON "OicEvaluationRegradePass"("applicationId", "tenantId", "idempotencyKey");
CREATE INDEX "OicEvaluationRegradePass_applicationId_tenantId_status_createdAt_idx" ON "OicEvaluationRegradePass"("applicationId", "tenantId", "status", "createdAt");

CREATE TABLE "OicEvaluationRegradeSource" (
  "id" UUID NOT NULL,
  "regradePassId" UUID NOT NULL,
  "caseExecutionId" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "outputDigest" CHAR(64) NOT NULL,
  "oracleEvidenceDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicEvaluationRegradeSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationRegradeSource_regradePassId_fkey" FOREIGN KEY ("regradePassId") REFERENCES "OicEvaluationRegradePass"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradeSource_caseExecutionId_fkey" FOREIGN KEY ("caseExecutionId") REFERENCES "OicEvaluationCaseExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradeSource_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "OicEvaluationAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicEvaluationRegradeSource_regradePassId_caseExecutionId_key" ON "OicEvaluationRegradeSource"("regradePassId", "caseExecutionId");
CREATE INDEX "OicEvaluationRegradeSource_caseExecutionId_createdAt_idx" ON "OicEvaluationRegradeSource"("caseExecutionId", "createdAt");

CREATE TABLE "OicEvaluationRegradeMeasurement" (
  "id" UUID NOT NULL,
  "regradePassId" UUID NOT NULL,
  "regradeSourceId" UUID NOT NULL,
  "caseExecutionId" UUID NOT NULL,
  "metricKey" VARCHAR(96) NOT NULL,
  "metricRevision" INTEGER NOT NULL,
  "judgeType" VARCHAR(16) NOT NULL,
  "valueType" VARCHAR(16) NOT NULL,
  "value" JSONB,
  "unit" VARCHAR(64) NOT NULL,
  "polarity" VARCHAR(24) NOT NULL,
  "availability" VARCHAR(24) NOT NULL,
  "evidenceDigest" CHAR(64),
  "provenance" VARCHAR(16) NOT NULL DEFAULT 'REGRADE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicEvaluationRegradeMeasurement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicEvaluationRegradeMeasurement_regradePassId_fkey" FOREIGN KEY ("regradePassId") REFERENCES "OicEvaluationRegradePass"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradeMeasurement_regradeSourceId_fkey" FOREIGN KEY ("regradeSourceId") REFERENCES "OicEvaluationRegradeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicEvaluationRegradeMeasurement_caseExecutionId_fkey" FOREIGN KEY ("caseExecutionId") REFERENCES "OicEvaluationCaseExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicEvaluationRegradeMeasurement_caseExecutionId_metricKey_metricRevision_judgeType_key"
  ON "OicEvaluationRegradeMeasurement"("caseExecutionId", "metricKey", "metricRevision", "judgeType");
CREATE INDEX "OicEvaluationRegradeMeasurement_metricKey_metricRevision_availability_idx"
  ON "OicEvaluationRegradeMeasurement"("metricKey", "metricRevision", "availability");

ALTER TABLE "OicEvaluationReport"
  ADD CONSTRAINT "OicEvaluationReport_regradePassId_fkey" FOREIGN KEY ("regradePassId") REFERENCES "OicEvaluationRegradePass"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "OicEvaluationReport_effectiveGradingManifestId_fkey" FOREIGN KEY ("effectiveGradingManifestId") REFERENCES "OicEvaluationProtocolManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "OicEvaluationReport_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "OicEvaluationReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
