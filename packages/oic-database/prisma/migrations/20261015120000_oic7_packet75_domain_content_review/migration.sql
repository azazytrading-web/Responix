CREATE TABLE "OicReviewerQualificationAttestation" (
  "id" UUID NOT NULL,
  "humanIdentityId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "qualificationKey" VARCHAR(96) NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "proficiency" VARCHAR(24) NOT NULL,
  "isPrimaryLanguage" BOOLEAN NOT NULL,
  "attestationSource" VARCHAR(32) NOT NULL,
  "attestationDigest" CHAR(64) NOT NULL,
  "attestedByPrincipalId" UUID NOT NULL,
  "attestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicReviewerQualificationAttestation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicReviewerQualificationAttestation_humanIdentityId_applicationId_qualificationKey_key"
  ON "OicReviewerQualificationAttestation"("humanIdentityId", "applicationId", "qualificationKey");
CREATE INDEX "OicReviewerQualificationAttestation_applicationId_qualificationKey_language_proficiency_idx"
  ON "OicReviewerQualificationAttestation"("applicationId", "qualificationKey", "language", "proficiency");
ALTER TABLE "OicReviewerQualificationAttestation" ADD CONSTRAINT "OicReviewerQualificationAttestation_humanIdentityId_fkey"
  FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicReviewerQualificationAttestation" ADD CONSTRAINT "OicReviewerQualificationAttestation_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OicDomainReviewBatch" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "packId" UUID NOT NULL,
  "manifestDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PREPARED',
  "reconciliationDigest" CHAR(64),
  "reconciliationEvidence" JSONB,
  "reconciledAt" TIMESTAMPTZ(6),
  "createdByPrincipalId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicDomainReviewBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicDomainReviewBatch_packId_manifestDigest_key"
  ON "OicDomainReviewBatch"("packId", "manifestDigest");
CREATE INDEX "OicDomainReviewBatch_applicationId_status_createdAt_idx"
  ON "OicDomainReviewBatch"("applicationId", "status", "createdAt");
ALTER TABLE "OicDomainReviewBatch" ADD CONSTRAINT "OicDomainReviewBatch_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewBatch" ADD CONSTRAINT "OicDomainReviewBatch_packId_applicationId_fkey"
  FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OicDomainReviewAssignment" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "packId" UUID NOT NULL,
  "caseRevisionId" UUID NOT NULL,
  "humanIdentityId" UUID NOT NULL,
  "reviewerRole" VARCHAR(24) NOT NULL,
  "blindedItemId" VARCHAR(128) NOT NULL,
  "blindProjection" JSONB NOT NULL,
  "eligibilitySnapshot" JSONB NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicDomainReviewAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicDomainReviewAssignment_batchId_caseRevisionId_humanIdentityId_key"
  ON "OicDomainReviewAssignment"("batchId", "caseRevisionId", "humanIdentityId");
CREATE INDEX "OicDomainReviewAssignment_applicationId_humanIdentityId_status_assignedAt_idx"
  ON "OicDomainReviewAssignment"("applicationId", "humanIdentityId", "status", "assignedAt");
CREATE INDEX "OicDomainReviewAssignment_batchId_reviewerRole_status_idx"
  ON "OicDomainReviewAssignment"("batchId", "reviewerRole", "status");
CREATE UNIQUE INDEX "OicEvaluationCaseRevision_id_applicationId_key"
  ON "OicEvaluationCaseRevision"("id", "applicationId");
ALTER TABLE "OicDomainReviewAssignment" ADD CONSTRAINT "OicDomainReviewAssignment_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "OicDomainReviewBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewAssignment" ADD CONSTRAINT "OicDomainReviewAssignment_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewAssignment" ADD CONSTRAINT "OicDomainReviewAssignment_packId_applicationId_fkey"
  FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewAssignment" ADD CONSTRAINT "OicDomainReviewAssignment_caseRevisionId_applicationId_fkey"
  FOREIGN KEY ("caseRevisionId", "applicationId") REFERENCES "OicEvaluationCaseRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewAssignment" ADD CONSTRAINT "OicDomainReviewAssignment_humanIdentityId_fkey"
  FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OicDomainReviewSubmission" (
  "id" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "humanIdentityId" UUID NOT NULL,
  "reviewerSessionId" UUID NOT NULL,
  "decision" VARCHAR(16) NOT NULL,
  "notes" VARCHAR(1000),
  "evidenceDigest" CHAR(64) NOT NULL,
  "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicDomainReviewSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicDomainReviewSubmission_assignmentId_key"
  ON "OicDomainReviewSubmission"("assignmentId");
CREATE INDEX "OicDomainReviewSubmission_humanIdentityId_submittedAt_idx"
  ON "OicDomainReviewSubmission"("humanIdentityId", "submittedAt");
ALTER TABLE "OicDomainReviewSubmission" ADD CONSTRAINT "OicDomainReviewSubmission_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "OicDomainReviewAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewSubmission" ADD CONSTRAINT "OicDomainReviewSubmission_humanIdentityId_fkey"
  FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicDomainReviewSubmission" ADD CONSTRAINT "OicDomainReviewSubmission_reviewerSessionId_fkey"
  FOREIGN KEY ("reviewerSessionId") REFERENCES "OicReviewerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
