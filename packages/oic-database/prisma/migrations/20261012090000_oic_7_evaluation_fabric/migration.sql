-- CreateTable
CREATE TABLE "OicEvaluationPackRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "packKey" VARCHAR(96) NOT NULL,
    "revision" INTEGER NOT NULL,
    "domain" VARCHAR(64) NOT NULL,
    "taskTypes" JSONB NOT NULL DEFAULT '[]',
    "targetClasses" JSONB NOT NULL DEFAULT '[]',
    "license" VARCHAR(256) NOT NULL,
    "securityTier" VARCHAR(32) NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestDigest" CHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicEvaluationPackRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationCaseRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "packId" UUID NOT NULL,
    "caseKey" VARCHAR(128) NOT NULL,
    "revision" INTEGER NOT NULL,
    "taskType" VARCHAR(64) NOT NULL,
    "language" VARCHAR(32) NOT NULL DEFAULT 'und',
    "slices" JSONB NOT NULL DEFAULT '[]',
    "inputArtifact" JSONB NOT NULL,
    "oracle" JSONB NOT NULL,
    "rights" JSONB NOT NULL,
    "sourceDigest" CHAR(64) NOT NULL,
    "oracleDigest" CHAR(64) NOT NULL,
    "exposureTier" VARCHAR(32) NOT NULL DEFAULT 'INTERNAL',
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationCaseRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationRelease" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "packId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "releaseTier" VARCHAR(32) NOT NULL,
    "caseManifest" JSONB NOT NULL,
    "protocol" JSONB NOT NULL,
    "manifestDigest" CHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "verificationTier" VARCHAR(32) NOT NULL DEFAULT 'OIC_EXECUTED_VERIFIED',
    "changelog" VARCHAR(1000) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),
    "compromisedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicEvaluationRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationProtocolManifest" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "releaseId" UUID NOT NULL,
    "protocolVersion" VARCHAR(32) NOT NULL,
    "targetClass" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "canonicalDigest" CHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "OicEvaluationProtocolManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationCampaign" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "releaseId" UUID NOT NULL,
    "campaignKey" VARCHAR(96) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "createdBy" UUID NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationRun" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "campaignId" UUID,
    "manifestId" UUID NOT NULL,
    "targetClass" VARCHAR(40) NOT NULL,
    "targetFingerprint" CHAR(64) NOT NULL,
    "targetIdentity" JSONB NOT NULL,
    "plannedTrials" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    "verificationTier" VARCHAR(32) NOT NULL DEFAULT 'OIC_EXECUTED_VERIFIED',
    "plannedDenominator" INTEGER NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "createdBy" UUID NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationCaseExecution" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "caseRevisionId" UUID NOT NULL,
    "repetitionOrdinal" INTEGER NOT NULL,
    "seed" VARCHAR(128) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    "outcome" JSONB,
    "leaseGeneration" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicEvaluationCaseExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationAttempt" (
    "id" UUID NOT NULL,
    "caseExecutionId" UUID NOT NULL,
    "physicalKey" VARCHAR(128) NOT NULL,
    "attemptOrdinal" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'CREATED',
    "admissionId" UUID,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "failureClass" VARCHAR(40),
    "verificationTier" VARCHAR(32) NOT NULL DEFAULT 'OIC_EXECUTED_PARTIAL',
    "artifactManifest" JSONB,
    "evidenceDigest" CHAR(64),

    CONSTRAINT "OicEvaluationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationMeasurement" (
    "id" UUID NOT NULL,
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
    "uncertainty" JSONB,
    "evaluatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationReport" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "analysisRevision" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "resultDigest" CHAR(64) NOT NULL,
    "summary" JSONB NOT NULL,
    "verificationTier" VARCHAR(32) NOT NULL,
    "decisionEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationComparison" (
    "id" UUID NOT NULL,
    "baselineReportId" UUID NOT NULL,
    "candidateReportId" UUID NOT NULL,
    "outcome" VARCHAR(40) NOT NULL,
    "reasonCodes" JSONB NOT NULL,
    "commonCases" INTEGER NOT NULL DEFAULT 0,
    "coverage" JSONB NOT NULL,
    "estimates" JSONB NOT NULL,
    "methodRevision" VARCHAR(64) NOT NULL,
    "decisionEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationDnaMeasurement" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "targetClass" VARCHAR(40) NOT NULL,
    "targetFingerprint" CHAR(64) NOT NULL,
    "contextKey" VARCHAR(256) NOT NULL,
    "traitKey" VARCHAR(64) NOT NULL,
    "value" JSONB,
    "uncertainty" JSONB,
    "availability" VARCHAR(24) NOT NULL,
    "evidenceStrength" VARCHAR(16) NOT NULL,
    "sourceDigest" CHAR(64) NOT NULL,
    "evaluatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationDnaMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationCandidate" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "candidateKey" VARCHAR(96) NOT NULL,
    "parentIds" JSONB NOT NULL,
    "changeDigest" CHAR(64) NOT NULL,
    "targetClass" VARCHAR(40) NOT NULL,
    "targetFingerprint" CHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicEvaluationPromotionDecision" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "verdict" VARCHAR(24) NOT NULL,
    "verdictDigest" CHAR(64) NOT NULL,
    "expectedBindingVersion" INTEGER NOT NULL,
    "approvalPrincipalId" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicEvaluationPromotionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OicEvaluationPackRevision_applicationId_tenantId_domain_sta_idx" ON "OicEvaluationPackRevision"("applicationId", "tenantId", "domain", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationPackRevision_applicationId_tenantId_packKey_re_key" ON "OicEvaluationPackRevision"("applicationId", "tenantId", "packKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationPackRevision_applicationId_tenantId_manifestDi_key" ON "OicEvaluationPackRevision"("applicationId", "tenantId", "manifestDigest");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationPackRevision_id_applicationId_key" ON "OicEvaluationPackRevision"("id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationPackRevision_id_applicationId_tenantId_key" ON "OicEvaluationPackRevision"("id", "applicationId", "tenantId");

-- CreateIndex
CREATE INDEX "OicEvaluationCaseRevision_applicationId_tenantId_taskType_l_idx" ON "OicEvaluationCaseRevision"("applicationId", "tenantId", "taskType", "language");

-- CreateIndex
CREATE INDEX "OicEvaluationCaseRevision_sourceDigest_idx" ON "OicEvaluationCaseRevision"("sourceDigest");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCaseRevision_packId_caseKey_revision_key" ON "OicEvaluationCaseRevision"("packId", "caseKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCaseRevision_id_applicationId_tenantId_key" ON "OicEvaluationCaseRevision"("id", "applicationId", "tenantId");

-- CreateIndex
CREATE INDEX "OicEvaluationRelease_applicationId_tenantId_releaseTier_sta_idx" ON "OicEvaluationRelease"("applicationId", "tenantId", "releaseTier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationRelease_applicationId_tenantId_packId_revision_key" ON "OicEvaluationRelease"("applicationId", "tenantId", "packId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationRelease_applicationId_tenantId_manifestDigest_key" ON "OicEvaluationRelease"("applicationId", "tenantId", "manifestDigest");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationRelease_id_applicationId_key" ON "OicEvaluationRelease"("id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationRelease_id_applicationId_tenantId_key" ON "OicEvaluationRelease"("id", "applicationId", "tenantId");

-- CreateIndex
CREATE INDEX "OicEvaluationProtocolManifest_applicationId_tenantId_releas_idx" ON "OicEvaluationProtocolManifest"("applicationId", "tenantId", "releaseId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationProtocolManifest_applicationId_tenantId_canoni_key" ON "OicEvaluationProtocolManifest"("applicationId", "tenantId", "canonicalDigest");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationProtocolManifest_id_applicationId_key" ON "OicEvaluationProtocolManifest"("id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationProtocolManifest_id_applicationId_tenantId_key" ON "OicEvaluationProtocolManifest"("id", "applicationId", "tenantId");

-- CreateIndex
CREATE INDEX "OicEvaluationCampaign_applicationId_tenantId_status_created_idx" ON "OicEvaluationCampaign"("applicationId", "tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCampaign_id_applicationId_tenantId_key" ON "OicEvaluationCampaign"("id", "applicationId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCampaign_applicationId_tenantId_idempotencyKey_key" ON "OicEvaluationCampaign"("applicationId", "tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCampaign_id_applicationId_key" ON "OicEvaluationCampaign"("id", "applicationId");

-- CreateIndex
CREATE INDEX "OicEvaluationRun_applicationId_tenantId_status_createdAt_idx" ON "OicEvaluationRun"("applicationId", "tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OicEvaluationRun_targetClass_targetFingerprint_createdAt_idx" ON "OicEvaluationRun"("targetClass", "targetFingerprint", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationRun_applicationId_tenantId_idempotencyKey_key" ON "OicEvaluationRun"("applicationId", "tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OicEvaluationCaseExecution_status_leaseUntil_idx" ON "OicEvaluationCaseExecution"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCaseExecution_runId_caseRevisionId_repetitionO_key" ON "OicEvaluationCaseExecution"("runId", "caseRevisionId", "repetitionOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationAttempt_physicalKey_key" ON "OicEvaluationAttempt"("physicalKey");

-- CreateIndex
CREATE INDEX "OicEvaluationAttempt_status_startedAt_idx" ON "OicEvaluationAttempt"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationAttempt_caseExecutionId_attemptOrdinal_key" ON "OicEvaluationAttempt"("caseExecutionId", "attemptOrdinal");

-- CreateIndex
CREATE INDEX "OicEvaluationMeasurement_metricKey_metricRevision_availabil_idx" ON "OicEvaluationMeasurement"("metricKey", "metricRevision", "availability");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationMeasurement_caseExecutionId_metricKey_metricRe_key" ON "OicEvaluationMeasurement"("caseExecutionId", "metricKey", "metricRevision", "judgeType");

-- CreateIndex
CREATE INDEX "OicEvaluationReport_status_decisionEligible_createdAt_idx" ON "OicEvaluationReport"("status", "decisionEligible", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationReport_runId_analysisRevision_key" ON "OicEvaluationReport"("runId", "analysisRevision");

-- CreateIndex
CREATE INDEX "OicEvaluationComparison_outcome_decisionEligible_idx" ON "OicEvaluationComparison"("outcome", "decisionEligible");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationComparison_baselineReportId_candidateReportId__key" ON "OicEvaluationComparison"("baselineReportId", "candidateReportId", "methodRevision");

-- CreateIndex
CREATE INDEX "OicEvaluationDnaMeasurement_targetClass_targetFingerprint_c_idx" ON "OicEvaluationDnaMeasurement"("targetClass", "targetFingerprint", "contextKey", "traitKey", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationDnaMeasurement_reportId_targetClass_targetFing_key" ON "OicEvaluationDnaMeasurement"("reportId", "targetClass", "targetFingerprint", "contextKey", "traitKey", "sourceDigest");

-- CreateIndex
CREATE INDEX "OicEvaluationCandidate_applicationId_tenantId_status_create_idx" ON "OicEvaluationCandidate"("applicationId", "tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCandidate_applicationId_tenantId_candidateKey_key" ON "OicEvaluationCandidate"("applicationId", "tenantId", "candidateKey");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationCandidate_applicationId_tenantId_changeDigest_key" ON "OicEvaluationCandidate"("applicationId", "tenantId", "changeDigest");

-- CreateIndex
CREATE UNIQUE INDEX "OicEvaluationPromotionDecision_candidateId_key" ON "OicEvaluationPromotionDecision"("candidateId");

-- AddForeignKey
ALTER TABLE "OicEvaluationPackRevision" ADD CONSTRAINT "OicEvaluationPackRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationPackRevision" ADD CONSTRAINT "OicEvaluationPackRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCaseRevision" ADD CONSTRAINT "OicEvaluationCaseRevision_packId_applicationId_fkey" FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRelease" ADD CONSTRAINT "OicEvaluationRelease_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRelease" ADD CONSTRAINT "OicEvaluationRelease_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRelease" ADD CONSTRAINT "OicEvaluationRelease_packId_applicationId_fkey" FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationProtocolManifest" ADD CONSTRAINT "OicEvaluationProtocolManifest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationProtocolManifest" ADD CONSTRAINT "OicEvaluationProtocolManifest_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationProtocolManifest" ADD CONSTRAINT "OicEvaluationProtocolManifest_releaseId_applicationId_fkey" FOREIGN KEY ("releaseId", "applicationId") REFERENCES "OicEvaluationRelease"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCampaign" ADD CONSTRAINT "OicEvaluationCampaign_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCampaign" ADD CONSTRAINT "OicEvaluationCampaign_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCampaign" ADD CONSTRAINT "OicEvaluationCampaign_releaseId_applicationId_fkey" FOREIGN KEY ("releaseId", "applicationId") REFERENCES "OicEvaluationRelease"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRun" ADD CONSTRAINT "OicEvaluationRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRun" ADD CONSTRAINT "OicEvaluationRun_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRun" ADD CONSTRAINT "OicEvaluationRun_campaignId_applicationId_tenantId_fkey" FOREIGN KEY ("campaignId", "applicationId", "tenantId") REFERENCES "OicEvaluationCampaign"("id", "applicationId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationRun" ADD CONSTRAINT "OicEvaluationRun_manifestId_applicationId_fkey" FOREIGN KEY ("manifestId", "applicationId") REFERENCES "OicEvaluationProtocolManifest"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCaseExecution" ADD CONSTRAINT "OicEvaluationCaseExecution_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OicEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationAttempt" ADD CONSTRAINT "OicEvaluationAttempt_caseExecutionId_fkey" FOREIGN KEY ("caseExecutionId") REFERENCES "OicEvaluationCaseExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationMeasurement" ADD CONSTRAINT "OicEvaluationMeasurement_caseExecutionId_fkey" FOREIGN KEY ("caseExecutionId") REFERENCES "OicEvaluationCaseExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationReport" ADD CONSTRAINT "OicEvaluationReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OicEvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationComparison" ADD CONSTRAINT "OicEvaluationComparison_baselineReportId_fkey" FOREIGN KEY ("baselineReportId") REFERENCES "OicEvaluationReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationComparison" ADD CONSTRAINT "OicEvaluationComparison_candidateReportId_fkey" FOREIGN KEY ("candidateReportId") REFERENCES "OicEvaluationReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationDnaMeasurement" ADD CONSTRAINT "OicEvaluationDnaMeasurement_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "OicEvaluationReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCandidate" ADD CONSTRAINT "OicEvaluationCandidate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationCandidate" ADD CONSTRAINT "OicEvaluationCandidate_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicEvaluationPromotionDecision" ADD CONSTRAINT "OicEvaluationPromotionDecision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "OicEvaluationCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
