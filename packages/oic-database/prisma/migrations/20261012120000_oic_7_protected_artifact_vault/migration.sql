CREATE TABLE "OicEvaluationArtifact" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "purpose" VARCHAR(24) NOT NULL,
    "exposureTier" VARCHAR(32) NOT NULL,
    "digest" CHAR(64) NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" CHAR(24) NOT NULL,
    "authTag" CHAR(32) NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OicEvaluationArtifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OicEvaluationArtifact_purpose_check" CHECK ("purpose" IN ('INPUT', 'ORACLE', 'RUBRIC', 'OUTPUT', 'EVIDENCE')),
    CONSTRAINT "OicEvaluationArtifact_tier_check" CHECK ("exposureTier" IN ('PUBLIC', 'INTERNAL', 'PRIVATE_HOLDOUT', 'PROTECTED_CERTIFICATION')),
    CONSTRAINT "OicEvaluationArtifact_status_check" CHECK ("status" IN ('AVAILABLE', 'REDACTED'))
);

CREATE INDEX "OicEvaluationArtifact_applicationId_tenantId_tier_status_idx"
  ON "OicEvaluationArtifact"("applicationId", "tenantId", "exposureTier", "status");
CREATE INDEX "OicEvaluationArtifact_applicationId_tenantId_digest_idx"
  ON "OicEvaluationArtifact"("applicationId", "tenantId", "digest");
ALTER TABLE "OicEvaluationArtifact" ADD CONSTRAINT "OicEvaluationArtifact_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationArtifact" ADD CONSTRAINT "OicEvaluationArtifact_tenantId_applicationId_fkey"
  FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL's ordinary UNIQUE constraint treats NULL tenant IDs as distinct.
-- These indexes close the global-scope replay gap in the initial OIC-7 tables.
CREATE UNIQUE INDEX "OicEvaluationMetricRevision_global_key_revision_uidx"
  ON "OicEvaluationMetricRevision"("applicationId", "metricKey", "revision") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationMetricRevision_global_digest_uidx"
  ON "OicEvaluationMetricRevision"("applicationId", "definitionDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationJudgeRevision_global_key_revision_uidx"
  ON "OicEvaluationJudgeRevision"("applicationId", "judgeKey", "revision") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationJudgeRevision_global_digest_uidx"
  ON "OicEvaluationJudgeRevision"("applicationId", "definitionDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationPackRevision_global_key_revision_uidx"
  ON "OicEvaluationPackRevision"("applicationId", "packKey", "revision") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationPackRevision_global_digest_uidx"
  ON "OicEvaluationPackRevision"("applicationId", "manifestDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationRelease_global_pack_revision_uidx"
  ON "OicEvaluationRelease"("applicationId", "packId", "revision") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationRelease_global_digest_uidx"
  ON "OicEvaluationRelease"("applicationId", "manifestDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationProtocolManifest_global_digest_uidx"
  ON "OicEvaluationProtocolManifest"("applicationId", "canonicalDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationCampaign_global_idempotency_uidx"
  ON "OicEvaluationCampaign"("applicationId", "idempotencyKey") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationRun_global_idempotency_uidx"
  ON "OicEvaluationRun"("applicationId", "idempotencyKey") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationCandidate_global_key_uidx"
  ON "OicEvaluationCandidate"("applicationId", "candidateKey") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationCandidate_global_digest_uidx"
  ON "OicEvaluationCandidate"("applicationId", "changeDigest") WHERE "tenantId" IS NULL;
