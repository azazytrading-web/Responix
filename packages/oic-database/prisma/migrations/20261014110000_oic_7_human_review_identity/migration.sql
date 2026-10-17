CREATE TABLE "OicHumanIdentity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "displayLabel" VARCHAR(120) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicHumanIdentity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OicHumanIdentity_status_createdAt_idx" ON "OicHumanIdentity"("status", "createdAt");

CREATE TABLE "OicHumanAuthSubject" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "kind" VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
  "loginHandle" VARCHAR(96),
  "issuer" VARCHAR(512),
  "subject" VARCHAR(256),
  "verifier" VARCHAR(256),
  "verifierVersion" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "passwordChangedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicHumanAuthSubject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicHumanAuthSubject_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicHumanAuthSubject_loginHandle_key" ON "OicHumanAuthSubject"("loginHandle");
CREATE UNIQUE INDEX "OicHumanAuthSubject_issuer_subject_key" ON "OicHumanAuthSubject"("issuer", "subject");
CREATE INDEX "OicHumanAuthSubject_humanIdentityId_status_idx" ON "OicHumanAuthSubject"("humanIdentityId", "status");

CREATE TABLE "OicHumanApplicationMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicHumanApplicationMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicHumanApplicationMembership_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicHumanApplicationMembership_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicHumanApplicationMembership_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicHumanApplicationMembership_humanIdentityId_applicationId_tenantId_key" ON "OicHumanApplicationMembership"("humanIdentityId", "applicationId", "tenantId");
CREATE INDEX "OicHumanApplicationMembership_applicationId_tenantId_status_idx" ON "OicHumanApplicationMembership"("applicationId", "tenantId", "status");

CREATE TABLE "OicReviewerAuthorization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "capability" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "grantedByPrincipalId" UUID NOT NULL,
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicReviewerAuthorization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewerAuthorization_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerAuthorization_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerAuthorization_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerAuthorization_grantedByPrincipalId_fkey" FOREIGN KEY ("grantedByPrincipalId") REFERENCES "OicServicePrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerAuthorization_capability_check" CHECK ("capability" IN ('oic:evaluation:review:read', 'oic:evaluation:review:submit', 'oic:evaluation:review:calibrate', 'oic:evaluation:review:adjudicate'))
);
CREATE UNIQUE INDEX "OicReviewerAuthorization_humanIdentityId_applicationId_tenantId_capability_key" ON "OicReviewerAuthorization"("humanIdentityId", "applicationId", "tenantId", "capability");
CREATE INDEX "OicReviewerAuthorization_applicationId_tenantId_capability_status_idx" ON "OicReviewerAuthorization"("applicationId", "tenantId", "capability", "status");

CREATE TABLE "OicReviewerSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "authSubjectId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idleExpiresAt" TIMESTAMPTZ(6) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicReviewerSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewerSession_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerSession_authSubjectId_fkey" FOREIGN KEY ("authSubjectId") REFERENCES "OicHumanAuthSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OicHumanApplicationMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicReviewerSession_tokenHash_key" ON "OicReviewerSession"("tokenHash");
CREATE INDEX "OicReviewerSession_humanIdentityId_revokedAt_expiresAt_idx" ON "OicReviewerSession"("humanIdentityId", "revokedAt", "expiresAt");

CREATE TABLE "OicReviewCalibrationPolicy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "judgeRevisionId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "calibrationSetDigest" CHAR(64) NOT NULL,
  "referenceArtifactId" UUID NOT NULL,
  "minimumAnchors" INTEGER NOT NULL,
  "minimumAgreement" DECIMAL(6,5) NOT NULL,
  "expiresAfterDays" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  "createdByPrincipalId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicReviewCalibrationPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewCalibrationPolicy_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewCalibrationPolicy_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewCalibrationPolicy_referenceArtifactId_fkey" FOREIGN KEY ("referenceArtifactId") REFERENCES "OicEvaluationArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewCalibrationPolicy_createdByPrincipalId_fkey" FOREIGN KEY ("createdByPrincipalId") REFERENCES "OicServicePrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewCalibrationPolicy_bounds_check" CHECK ("minimumAnchors" > 0 AND "minimumAgreement" >= 0 AND "minimumAgreement" <= 1 AND "expiresAfterDays" BETWEEN 1 AND 365)
);
CREATE UNIQUE INDEX "OicReviewCalibrationPolicy_app_tenant_judge_rev_key" ON "OicReviewCalibrationPolicy"("applicationId", "tenantId", "judgeRevisionId", "revision");
CREATE INDEX "OicReviewCalibrationPolicy_app_tenant_judge_status_idx" ON "OicReviewCalibrationPolicy"("applicationId", "tenantId", "judgeRevisionId", "status");

CREATE TABLE "OicReviewerCalibration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "policyId" UUID NOT NULL,
  "answers" JSONB NOT NULL,
  "abstentions" JSONB NOT NULL DEFAULT '[]',
  "agreement" DECIMAL(6,5),
  "anchorCount" INTEGER NOT NULL,
  "eligibility" VARCHAR(16) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6),
  "supersedesId" UUID,
  "evidenceDigest" CHAR(64) NOT NULL,
  "completedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicReviewerCalibration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewerCalibration_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerCalibration_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerCalibration_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerCalibration_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "OicReviewCalibrationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerCalibration_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "OicReviewerCalibration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewerCalibration_eligibility_check" CHECK ("eligibility" IN ('ELIGIBLE', 'INELIGIBLE', 'EXPIRED', 'SUSPENDED'))
);
CREATE INDEX "OicReviewerCalibration_humanIdentityId_applicationId_tenantId_completedAt_idx" ON "OicReviewerCalibration"("humanIdentityId", "applicationId", "tenantId", "completedAt");

CREATE TABLE "OicReviewAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "caseExecutionId" UUID NOT NULL,
  "protocolRevisionId" UUID NOT NULL,
  "judgeRevisionId" UUID NOT NULL,
  "metricRevisionId" UUID NOT NULL,
  "blindedItemId" VARCHAR(128) NOT NULL,
  "blindProjection" JSONB NOT NULL,
  "blindMapping" JSONB NOT NULL,
  "randomizedOrder" JSONB,
  "conflictState" VARCHAR(16) NOT NULL,
  "conflictEvidence" JSONB NOT NULL DEFAULT '{}',
  "eligibilitySnapshot" JSONB NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMPTZ(6),
  "deadlineAt" TIMESTAMPTZ(6),
  "reassignedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicReviewAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewAssignment_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewAssignment_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewAssignment_conflictState_check" CHECK ("conflictState" IN ('CLEAR', 'CONFLICT', 'UNKNOWN')),
  CONSTRAINT "OicReviewAssignment_status_check" CHECK ("status" IN ('ASSIGNED', 'OPENED', 'SUBMITTED', 'ABSTAINED', 'REASSIGNED', 'EXPIRED'))
);
CREATE INDEX "OicReviewAssignment_humanIdentityId_applicationId_tenantId_status_idx" ON "OicReviewAssignment"("humanIdentityId", "applicationId", "tenantId", "status");
CREATE INDEX "OicReviewAssignment_applicationId_tenantId_caseExecutionId_idx" ON "OicReviewAssignment"("applicationId", "tenantId", "caseExecutionId");

CREATE TABLE "OicReviewSubmission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignmentId" UUID NOT NULL,
  "humanIdentityId" UUID NOT NULL,
  "reviewerSessionId" UUID NOT NULL,
  "blindedItemId" VARCHAR(128) NOT NULL,
  "metricRevisionId" UUID NOT NULL,
  "judgeRevisionId" UUID NOT NULL,
  "protocolRevisionId" UUID NOT NULL,
  "value" JSONB,
  "abstained" BOOLEAN NOT NULL DEFAULT FALSE,
  "rationale" VARCHAR(1000),
  "calibrationSnapshot" JSONB NOT NULL,
  "evidenceDigest" CHAR(64) NOT NULL,
  "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicReviewSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OicReviewAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewSubmission_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewSubmission_reviewerSessionId_fkey" FOREIGN KEY ("reviewerSessionId") REFERENCES "OicReviewerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewSubmission_measurement_xor_abstention" CHECK (("abstained" AND "value" IS NULL) OR (NOT "abstained" AND "value" IS NOT NULL))
);
CREATE UNIQUE INDEX "OicReviewSubmission_assignmentId_key" ON "OicReviewSubmission"("assignmentId");
CREATE INDEX "OicReviewSubmission_humanIdentityId_judgeRevisionId_submittedAt_idx" ON "OicReviewSubmission"("humanIdentityId", "judgeRevisionId", "submittedAt");

CREATE TABLE "OicReviewAdjudication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "humanIdentityId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "caseExecutionId" UUID NOT NULL,
  "blindedItemId" VARCHAR(128) NOT NULL,
  "metricRevisionId" UUID NOT NULL,
  "judgeRevisionId" UUID NOT NULL,
  "protocolRevisionId" UUID NOT NULL,
  "sourceSubmissionIds" JSONB NOT NULL,
  "decision" JSONB NOT NULL,
  "rationale" VARCHAR(1000),
  "evidenceDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicReviewAdjudication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewAdjudication_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewAdjudication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewAdjudication_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OicReviewAdjudication_applicationId_tenantId_caseExecutionId_createdAt_idx" ON "OicReviewAdjudication"("applicationId", "tenantId", "caseExecutionId", "createdAt");
CREATE INDEX "OicReviewAdjudication_humanIdentityId_createdAt_idx" ON "OicReviewAdjudication"("humanIdentityId", "createdAt");

ALTER TABLE "OicAuditEvent" ADD COLUMN "actorHumanIdentityId" UUID;
ALTER TABLE "OicAuditEvent" ADD COLUMN "actorType" VARCHAR(24);
ALTER TABLE "OicAuditEvent" ADD CONSTRAINT "OicAuditEvent_actorHumanIdentityId_fkey" FOREIGN KEY ("actorHumanIdentityId") REFERENCES "OicHumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicAuditEvent" ADD CONSTRAINT "OicAuditEvent_actorType_consistency_check" CHECK (
  "actorType" IS NULL OR
  ("actorType" = 'HUMAN_IDENTITY' AND "actorHumanIdentityId" IS NOT NULL AND "actorPrincipalId" IS NULL) OR
  ("actorType" = 'SERVICE_PRINCIPAL' AND "actorPrincipalId" IS NOT NULL AND "actorHumanIdentityId" IS NULL) OR
  ("actorType" = 'SYSTEM_INTERNAL' AND "actorPrincipalId" IS NULL AND "actorHumanIdentityId" IS NULL)
);
CREATE INDEX "OicAuditEvent_actorHumanIdentityId_occurredAt_idx" ON "OicAuditEvent"("actorHumanIdentityId", "occurredAt");

CREATE FUNCTION oic_set_audit_actor_type() RETURNS trigger AS $$
BEGIN
  IF NEW."actorPrincipalId" IS NOT NULL AND NEW."actorHumanIdentityId" IS NOT NULL THEN
    RAISE EXCEPTION 'audit event cannot have both service and human actors';
  ELSIF NEW."actorHumanIdentityId" IS NOT NULL THEN
    IF NEW."actorType" IS NOT NULL AND NEW."actorType" <> 'HUMAN_IDENTITY' THEN RAISE EXCEPTION 'audit actor type mismatch'; END IF;
    NEW."actorType" := 'HUMAN_IDENTITY';
  ELSIF NEW."actorPrincipalId" IS NOT NULL THEN
    IF NEW."actorType" IS NOT NULL AND NEW."actorType" <> 'SERVICE_PRINCIPAL' THEN RAISE EXCEPTION 'audit actor type mismatch'; END IF;
    NEW."actorType" := 'SERVICE_PRINCIPAL';
  ELSE
    IF NEW."actorType" IS NOT NULL AND NEW."actorType" <> 'SYSTEM_INTERNAL' THEN RAISE EXCEPTION 'audit actor type mismatch'; END IF;
    NEW."actorType" := 'SYSTEM_INTERNAL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER oic_audit_actor_type_before_insert BEFORE INSERT ON "OicAuditEvent" FOR EACH ROW EXECUTE FUNCTION oic_set_audit_actor_type();
