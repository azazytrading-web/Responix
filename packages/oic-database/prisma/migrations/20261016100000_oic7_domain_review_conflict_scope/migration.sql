CREATE TABLE "OicDomainReviewConflictScope" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "scopeKey" VARCHAR(96) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reviewPurpose" VARCHAR(96) NOT NULL,
    "domain" VARCHAR(64) NOT NULL,
    "packManifestDigest" CHAR(64) NOT NULL,
    "batchManifestDigest" CHAR(64) NOT NULL,
    "sourceProvenanceDigest" CHAR(64) NOT NULL,
    "scopeDigest" CHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    "createdByPrincipalId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OicDomainReviewConflictScope_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OicDomainReviewConflictScope_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OicDomainReviewConflictScope_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OicDomainReviewBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OicDomainReviewConflictScope_batchId_key" ON "OicDomainReviewConflictScope"("batchId");
CREATE UNIQUE INDEX "OicDomainReviewConflictScope_applicationId_scopeKey_revision_scopeDigest_key" ON "OicDomainReviewConflictScope"("applicationId", "scopeKey", "revision", "scopeDigest");
CREATE INDEX "OicDomainReviewConflictScope_applicationId_scopeKey_status_publishedAt_idx" ON "OicDomainReviewConflictScope"("applicationId", "scopeKey", "status", "publishedAt");

CREATE FUNCTION oic_domain_review_conflict_scope_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OIC domain review conflict scopes are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OicDomainReviewConflictScope_immutable"
BEFORE UPDATE OR DELETE ON "OicDomainReviewConflictScope"
FOR EACH ROW EXECUTE FUNCTION oic_domain_review_conflict_scope_immutable();
