CREATE TYPE "OicIntelligenceProfileLifecycle" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "OicIntelligenceProfileSource" AS ENUM ('BUILTIN', 'CUSTOM');
CREATE TYPE "OicMemoryKind" AS ENUM ('EPISODIC', 'SEMANTIC', 'PROCEDURAL', 'SESSION', 'APPLICATION');
CREATE TYPE "OicMemoryLifecycle" AS ENUM ('ACTIVE', 'STALE', 'SUPERSEDED', 'CONFLICTED', 'UNVERIFIED', 'ARCHIVED');
CREATE TYPE "OicMemorySensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED');
CREATE TYPE "OicKnowledgeLifecycle" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "OicExecutionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');

CREATE TABLE "OicIntelligenceProfile" (
  "id" UUID NOT NULL,
  "profileKey" VARCHAR(64) NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000) NOT NULL DEFAULT '',
  "source" "OicIntelligenceProfileSource" NOT NULL DEFAULT 'CUSTOM',
  "lifecycle" "OicIntelligenceProfileLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "OicIntelligenceProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicIntelligenceProfile_profileKey_key" ON "OicIntelligenceProfile"("profileKey");
CREATE INDEX "OicIntelligenceProfile_lifecycle_source_profileKey_idx" ON "OicIntelligenceProfile"("lifecycle", "source", "profileKey");

CREATE TABLE "OicIntelligenceProfileRevision" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "contextIntensity" INTEGER NOT NULL DEFAULT 50,
  "memoryIntensity" INTEGER NOT NULL DEFAULT 0,
  "retrievalIntensity" INTEGER NOT NULL DEFAULT 0,
  "reasoningIntensity" INTEGER NOT NULL DEFAULT 50,
  "toolsIntensity" INTEGER NOT NULL DEFAULT 0,
  "verificationIntensity" INTEGER NOT NULL DEFAULT 50,
  "synthesisIntensity" INTEGER NOT NULL DEFAULT 50,
  "efficiencyIntensity" INTEGER NOT NULL DEFAULT 50,
  "maxStages" INTEGER NOT NULL DEFAULT 8,
  "maxProviderCalls" INTEGER NOT NULL DEFAULT 3,
  "maxToolCalls" INTEGER NOT NULL DEFAULT 0,
  "maxRetrievalQueries" INTEGER NOT NULL DEFAULT 2,
  "maxMemoryItems" INTEGER NOT NULL DEFAULT 4,
  "maxCandidates" INTEGER NOT NULL DEFAULT 1,
  "maxVerificationRounds" INTEGER NOT NULL DEFAULT 1,
  "maxContextTokens" INTEGER NOT NULL DEFAULT 8192,
  "maxExecutionMs" INTEGER NOT NULL DEFAULT 60000,
  "allowMemoryWrites" BOOLEAN NOT NULL DEFAULT FALSE,
  "allowRevision" BOOLEAN NOT NULL DEFAULT TRUE,
  "requireEvidence" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicIntelligenceProfileRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicIntelligenceProfileRevision_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OicIntelligenceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicIntelligenceProfileRevision_intensity_check" CHECK (
    "contextIntensity" BETWEEN 0 AND 100 AND "memoryIntensity" BETWEEN 0 AND 100 AND
    "retrievalIntensity" BETWEEN 0 AND 100 AND "reasoningIntensity" BETWEEN 0 AND 100 AND
    "toolsIntensity" BETWEEN 0 AND 100 AND "verificationIntensity" BETWEEN 0 AND 100 AND
    "synthesisIntensity" BETWEEN 0 AND 100 AND "efficiencyIntensity" BETWEEN 0 AND 100
  ),
  CONSTRAINT "OicIntelligenceProfileRevision_budget_check" CHECK (
    "maxStages" BETWEEN 1 AND 32 AND "maxProviderCalls" BETWEEN 1 AND 16 AND
    "maxToolCalls" BETWEEN 0 AND 16 AND "maxRetrievalQueries" BETWEEN 0 AND 16 AND
    "maxMemoryItems" BETWEEN 0 AND 64 AND "maxCandidates" BETWEEN 1 AND 4 AND
    "maxVerificationRounds" BETWEEN 0 AND 3 AND "maxContextTokens" BETWEEN 256 AND 200000 AND
    "maxExecutionMs" BETWEEN 1000 AND 120000
  )
);
CREATE UNIQUE INDEX "OicIntelligenceProfileRevision_profileId_revision_key" ON "OicIntelligenceProfileRevision"("profileId", "revision");
CREATE INDEX "OicIntelligenceProfileRevision_profileId_revision_idx" ON "OicIntelligenceProfileRevision"("profileId", "revision");

ALTER TABLE "OicModelRevision" ADD COLUMN "intelligenceProfileRevisionId" UUID;
ALTER TABLE "OicModelRevision" ADD CONSTRAINT "OicModelRevision_intelligenceProfileRevisionId_fkey" FOREIGN KEY ("intelligenceProfileRevisionId") REFERENCES "OicIntelligenceProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "OicModelRevision_intelligenceProfileRevisionId_idx" ON "OicModelRevision"("intelligenceProfileRevisionId");

CREATE TABLE "OicIntelligenceMemory" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "actorPrincipalId" UUID,
  "sessionId" VARCHAR(128),
  "kind" "OicMemoryKind" NOT NULL,
  "lifecycle" "OicMemoryLifecycle" NOT NULL DEFAULT 'UNVERIFIED',
  "sensitivity" "OicMemorySensitivity" NOT NULL DEFAULT 'INTERNAL',
  "title" VARCHAR(240) NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "embeddingModel" VARCHAR(64) NOT NULL DEFAULT 'hashed-token-ngram-v1',
  "embeddingDimensions" INTEGER NOT NULL DEFAULT 384,
  "entityKey" VARCHAR(160),
  "sourceType" VARCHAR(64) NOT NULL,
  "sourceRef" VARCHAR(256),
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "salience" INTEGER NOT NULL DEFAULT 50,
  "validUntil" TIMESTAMPTZ(6),
  "lastConfirmedAt" TIMESTAMPTZ(6),
  "originatingExecutionId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicIntelligenceMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicIntelligenceMemory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicIntelligenceMemory_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicIntelligenceMemory_quality_check" CHECK ("confidence" BETWEEN 0 AND 100 AND "salience" BETWEEN 0 AND 100)
);
CREATE INDEX "OicIntelligenceMemory_applicationId_tenantId_lifecycle_kind_idx" ON "OicIntelligenceMemory"("applicationId", "tenantId", "lifecycle", "kind");
CREATE INDEX "OicIntelligenceMemory_applicationId_sessionId_lifecycle_idx" ON "OicIntelligenceMemory"("applicationId", "sessionId", "lifecycle");
CREATE INDEX "OicIntelligenceMemory_applicationId_entityKey_lifecycle_idx" ON "OicIntelligenceMemory"("applicationId", "entityKey", "lifecycle");

CREATE TABLE "OicIntelligenceKnowledge" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "sourceKey" VARCHAR(128) NOT NULL,
  "sourceRef" VARCHAR(512) NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "embeddingModel" VARCHAR(64) NOT NULL DEFAULT 'hashed-token-ngram-v1',
  "embeddingDimensions" INTEGER NOT NULL DEFAULT 384,
  "authority" INTEGER NOT NULL DEFAULT 50,
  "sourcePriority" INTEGER NOT NULL DEFAULT 50,
  "lifecycle" "OicKnowledgeLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "publishedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicIntelligenceKnowledge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicIntelligenceKnowledge_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicIntelligenceKnowledge_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicIntelligenceKnowledge_quality_check" CHECK ("authority" BETWEEN 0 AND 100 AND "sourcePriority" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "OicIntelligenceKnowledge_applicationId_tenantId_sourceKey_sourceRef_key" ON "OicIntelligenceKnowledge"("applicationId", "tenantId", "sourceKey", "sourceRef");
CREATE INDEX "OicIntelligenceKnowledge_applicationId_tenantId_lifecycle_updatedAt_idx" ON "OicIntelligenceKnowledge"("applicationId", "tenantId", "lifecycle", "updatedAt");

CREATE TABLE "OicIntelligenceExecution" (
  "id" UUID NOT NULL,
  "traceId" VARCHAR(128) NOT NULL,
  "requestId" VARCHAR(128) NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "principalId" UUID NOT NULL,
  "modelId" VARCHAR(64) NOT NULL,
  "modelRevisionId" UUID,
  "profileRevisionId" UUID,
  "status" "OicExecutionStatus" NOT NULL DEFAULT 'RUNNING',
  "strategy" VARCHAR(64) NOT NULL,
  "taskType" VARCHAR(64) NOT NULL,
  "uncertainty" VARCHAR(32) NOT NULL,
  "stageCount" INTEGER NOT NULL DEFAULT 0,
  "providerCallCount" INTEGER NOT NULL DEFAULT 0,
  "retrievalQueryCount" INTEGER NOT NULL DEFAULT 0,
  "memoryLookupCount" INTEGER NOT NULL DEFAULT 0,
  "contextTokens" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "verificationStatus" VARCHAR(32) NOT NULL,
  "summary" JSONB NOT NULL,
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicIntelligenceExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicIntelligenceExecution_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicIntelligenceExecution_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicIntelligenceExecution_traceId_key" ON "OicIntelligenceExecution"("traceId");
CREATE INDEX "OicIntelligenceExecution_applicationId_tenantId_startedAt_idx" ON "OicIntelligenceExecution"("applicationId", "tenantId", "startedAt");
CREATE INDEX "OicIntelligenceExecution_traceId_applicationId_idx" ON "OicIntelligenceExecution"("traceId", "applicationId");

CREATE TABLE "OicIntelligenceExecutionStage" (
  "id" UUID NOT NULL,
  "executionId" UUID NOT NULL,
  "stageIndex" INTEGER NOT NULL,
  "stageType" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "strategy" VARCHAR(64),
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "resourceUse" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "startedAt" TIMESTAMPTZ(6) NOT NULL,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicIntelligenceExecutionStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicIntelligenceExecutionStage_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "OicIntelligenceExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicIntelligenceExecutionStage_executionId_stageIndex_key" ON "OicIntelligenceExecutionStage"("executionId", "stageIndex");
CREATE INDEX "OicIntelligenceExecutionStage_executionId_stageIndex_idx" ON "OicIntelligenceExecutionStage"("executionId", "stageIndex");

CREATE FUNCTION "oic_reject_intelligence_profile_revision_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OIC intelligence profile revisions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OicIntelligenceProfileRevision_immutable"
BEFORE UPDATE OR DELETE ON "OicIntelligenceProfileRevision"
FOR EACH ROW EXECUTE FUNCTION "oic_reject_intelligence_profile_revision_mutation"();

INSERT INTO "OicIntelligenceProfile" ("id", "profileKey", "displayName", "description", "source", "lifecycle", "updatedAt") VALUES
('50000000-0000-4000-8000-000000000001', 'fast', 'FAST', 'Direct execution with a small context budget.', 'BUILTIN', 'ACTIVE', CURRENT_TIMESTAMP),
('50000000-0000-4000-8000-000000000002', 'balanced', 'BALANCED', 'Selective context, retrieval, and verification.', 'BUILTIN', 'ACTIVE', CURRENT_TIMESTAMP),
('50000000-0000-4000-8000-000000000003', 'advanced', 'ADVANCED', 'Task decomposition with bounded retrieval and revision.', 'BUILTIN', 'ACTIVE', CURRENT_TIMESTAMP),
('50000000-0000-4000-8000-000000000004', 'deep', 'DEEP', 'Maximum configured bounded reasoning and evidence work.', 'BUILTIN', 'ACTIVE', CURRENT_TIMESTAMP);

INSERT INTO "OicIntelligenceProfileRevision" (
  "id", "profileId", "revision", "contextIntensity", "memoryIntensity", "retrievalIntensity", "reasoningIntensity", "toolsIntensity", "verificationIntensity", "synthesisIntensity", "efficiencyIntensity",
  "maxStages", "maxProviderCalls", "maxToolCalls", "maxRetrievalQueries", "maxMemoryItems", "maxCandidates", "maxVerificationRounds", "maxContextTokens", "maxExecutionMs", "allowMemoryWrites", "allowRevision", "requireEvidence"
) VALUES
('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 20, 10, 10, 15, 0, 10, 20, 90, 4, 1, 0, 1, 2, 1, 0, 4096, 30000, FALSE, FALSE, FALSE),
('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 1, 50, 50, 50, 50, 0, 50, 50, 60, 8, 3, 0, 2, 4, 1, 1, 8192, 60000, FALSE, TRUE, FALSE),
('51000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 1, 65, 60, 65, 70, 0, 70, 65, 45, 12, 6, 0, 4, 8, 2, 2, 16000, 90000, FALSE, TRUE, TRUE),
('51000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000004', 1, 80, 75, 85, 90, 0, 90, 80, 30, 20, 10, 0, 8, 16, 3, 3, 32000, 120000, FALSE, TRUE, TRUE);
