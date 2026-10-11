CREATE TYPE "OicProviderAttemptStatus" AS ENUM ('DISPATCHED', 'SUCCEEDED', 'FAILED', 'UNCERTAIN');
CREATE TYPE "OicUsageEvidenceStatus" AS ENUM ('REPORTED', 'PARTIAL', 'UNKNOWN');

CREATE TABLE "OicProviderAttempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "principalId" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "traceId" VARCHAR(128) NOT NULL,
  "requestId" VARCHAR(128) NOT NULL,
  "attemptKey" VARCHAR(128) NOT NULL,
  "providerKey" VARCHAR(64) NOT NULL,
  "upstreamModelId" VARCHAR(256) NOT NULL,
  "transportProfile" VARCHAR(128) NOT NULL,
  "status" "OicProviderAttemptStatus" NOT NULL DEFAULT 'DISPATCHED',
  "usageStatus" "OicUsageEvidenceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "sourceDigest" CHAR(64),
  "safeErrorCode" VARCHAR(64),
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicProviderAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicProviderAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderAttempt_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderAttempt_principalId_applicationId_fkey" FOREIGN KEY ("principalId", "applicationId") REFERENCES "OicServicePrincipal"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderAttempt_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderAttempt_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "OicRuntimeBinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicProviderAttempt_attemptKey_key" ON "OicProviderAttempt"("attemptKey");
CREATE INDEX "OicProviderAttempt_applicationId_tenantId_startedAt_id_idx" ON "OicProviderAttempt"("applicationId", "tenantId", "startedAt", "id");
CREATE INDEX "OicProviderAttempt_connectionId_startedAt_idx" ON "OicProviderAttempt"("connectionId", "startedAt");
CREATE INDEX "OicProviderAttempt_status_startedAt_idx" ON "OicProviderAttempt"("status", "startedAt");

CREATE TABLE "OicUsageEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "providerAttemptId" UUID NOT NULL,
  "receiptSequence" INTEGER NOT NULL DEFAULT 0,
  "sourceDigest" CHAR(64) NOT NULL,
  "providerKey" VARCHAR(64) NOT NULL,
  "transportProfile" VARCHAR(128) NOT NULL,
  "rawDimensions" JSONB NOT NULL,
  "normalizedDimensions" JSONB NOT NULL,
  "occurredAt" TIMESTAMPTZ(6),
  "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicUsageEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicUsageEvent_providerAttemptId_fkey" FOREIGN KEY ("providerAttemptId") REFERENCES "OicProviderAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicUsageEvent_providerAttemptId_receiptSequence_key" ON "OicUsageEvent"("providerAttemptId", "receiptSequence");
CREATE INDEX "OicUsageEvent_applicationId_tenantId_occurredAt_id_idx" ON "OicUsageEvent"("applicationId", "tenantId", "occurredAt", "id");
CREATE INDEX "OicUsageEvent_providerKey_sourceDigest_idx" ON "OicUsageEvent"("providerKey", "sourceDigest");
CREATE INDEX "OicUsageEvent_sourceDigest_idx" ON "OicUsageEvent"("sourceDigest");
