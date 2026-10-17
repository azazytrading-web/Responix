CREATE TABLE "OicReviewFixtureProtocol" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "protocolKey" VARCHAR(96) NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "metricRevisionId" UUID NOT NULL,
  "judgeRevisionId" UUID NOT NULL,
  "rubricArtifactId" UUID NOT NULL,
  "rubricDigest" CHAR(64) NOT NULL,
  "definition" JSONB NOT NULL,
  "definitionDigest" CHAR(64) NOT NULL,
  "createdByPrincipalId" UUID NOT NULL,
  "publishedByPrincipalId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicReviewFixtureProtocol_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewFixtureProtocol_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'SUSPENDED'))
);
CREATE UNIQUE INDEX "OicReviewFixtureProtocol_scope_key" ON "OicReviewFixtureProtocol"("applicationId", "tenantId", "protocolKey", "revision");
CREATE INDEX "OicReviewFixtureProtocol_scope_status_idx" ON "OicReviewFixtureProtocol"("applicationId", "tenantId", "status", "publishedAt");

CREATE TABLE "OicReviewFixtureExecution" (
  "id" UUID NOT NULL,
  "protocolRevisionId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "itemKey" VARCHAR(96) NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "blindProjection" JSONB NOT NULL,
  "targetClass" VARCHAR(32) NOT NULL DEFAULT 'STATIC_LOCAL_FIXTURE',
  "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  "providerDispatchCount" INTEGER NOT NULL DEFAULT 0,
  "executionEvidence" JSONB,
  "evidenceDigest" CHAR(64),
  "createdByPrincipalId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicReviewFixtureExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewFixtureExecution_protocol_fkey" FOREIGN KEY ("protocolRevisionId") REFERENCES "OicReviewFixtureProtocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicReviewFixtureExecution_state_check" CHECK ("status" IN ('QUEUED', 'RUNNING', 'EXECUTED', 'FAILED')),
  CONSTRAINT "OicReviewFixtureExecution_provider_count_check" CHECK ("providerDispatchCount" = 0),
  CONSTRAINT "OicReviewFixtureExecution_static_target_check" CHECK ("targetClass" = 'STATIC_LOCAL_FIXTURE')
);
CREATE UNIQUE INDEX "OicReviewFixtureExecution_protocol_item_key" ON "OicReviewFixtureExecution"("protocolRevisionId", "itemKey");
CREATE UNIQUE INDEX "OicReviewFixtureExecution_id_scope_key" ON "OicReviewFixtureExecution"("id", "applicationId", "tenantId");
CREATE INDEX "OicReviewFixtureExecution_scope_status_ordinal_idx" ON "OicReviewFixtureExecution"("applicationId", "tenantId", "status", "ordinal");

CREATE TABLE "OicReviewInterRaterEvidence" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "protocolRevisionId" UUID NOT NULL,
  "caseExecutionId" UUID NOT NULL,
  "submissionIds" JSONB NOT NULL,
  "outcome" VARCHAR(24) NOT NULL,
  "agreement" BOOLEAN,
  "abstentionCount" INTEGER NOT NULL,
  "evidenceDigest" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicReviewInterRaterEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicReviewInterRaterEvidence_outcome_check" CHECK ("outcome" IN ('AGREEMENT', 'DISAGREEMENT', 'ABSTAINED', 'INCOMPLETE'))
);
CREATE UNIQUE INDEX "OicReviewInterRaterEvidence_protocol_execution_key" ON "OicReviewInterRaterEvidence"("protocolRevisionId", "caseExecutionId");
CREATE INDEX "OicReviewInterRaterEvidence_scope_protocol_idx" ON "OicReviewInterRaterEvidence"("applicationId", "tenantId", "protocolRevisionId");
