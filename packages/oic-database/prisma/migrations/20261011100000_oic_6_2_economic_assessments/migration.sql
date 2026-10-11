CREATE TYPE "OicEconomicRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "OicEconomicAssessmentStatus" AS ENUM ('ASSESSED', 'PARTIAL', 'UNKNOWN');
CREATE TYPE "OicEconomicAssessmentKind" AS ENUM ('ORIGINAL', 'REPLAY');
CREATE TYPE "OicProviderCostEvidenceClass" AS ENUM ('INVOICE_AUTHORITATIVE', 'PROVIDER_REPORTED', 'DERIVED_FROM_AUTHORITATIVE_USAGE', 'ESTIMATED', 'UNKNOWN');

CREATE TABLE "OicProviderRateBookRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID,
  "tenantId" UUID,
  "connectionId" UUID,
  "revision" INTEGER NOT NULL,
  "status" "OicEconomicRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "providerKey" VARCHAR(64) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "sourceQuality" VARCHAR(48) NOT NULL,
  "sourceReference" VARCHAR(256),
  "sourceDigest" CHAR(64) NOT NULL,
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6),
  "publishedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicProviderRateBookRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicProviderRateBookRevision_scope_check" CHECK (("tenantId" IS NULL OR "applicationId" IS NOT NULL) AND ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")),
  CONSTRAINT "OicProviderRateBookRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderRateBookRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderRateBookRevision_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicProviderRateBookRevision_scope_provider_revision_key" ON "OicProviderRateBookRevision"("applicationId", "tenantId", "connectionId", "providerKey", "revision");
CREATE INDEX "OicProviderRateBookRevision_scope_provider_status_effective_idx" ON "OicProviderRateBookRevision"("applicationId", "tenantId", "providerKey", "status", "effectiveFrom");
CREATE INDEX "OicProviderRateBookRevision_connection_provider_status_effective_idx" ON "OicProviderRateBookRevision"("connectionId", "providerKey", "status", "effectiveFrom");

CREATE TABLE "OicProviderRate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rateBookRevisionId" UUID NOT NULL,
  "upstreamModelId" VARCHAR(256),
  "dimension" VARCHAR(64) NOT NULL,
  "unit" VARCHAR(64) NOT NULL,
  "quantityDivisor" DECIMAL(38,18) NOT NULL DEFAULT 1,
  "pricePerUnit" DECIMAL(38,18) NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicProviderRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicProviderRate_amount_check" CHECK ("quantityDivisor" > 0 AND "pricePerUnit" >= 0),
  CONSTRAINT "OicProviderRate_rateBookRevisionId_fkey" FOREIGN KEY ("rateBookRevisionId") REFERENCES "OicProviderRateBookRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicProviderRate_selector_key" ON "OicProviderRate"("rateBookRevisionId", "upstreamModelId", "dimension", "unit");
CREATE INDEX "OicProviderRate_dimension_unit_model_idx" ON "OicProviderRate"("dimension", "unit", "upstreamModelId");

CREATE TABLE "OicOiuPolicyRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID,
  "tenantId" UUID,
  "policyKey" VARCHAR(64) NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "OicEconomicRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "missingRule" VARCHAR(16) NOT NULL DEFAULT 'PARTIAL',
  "minimumIncrement" DECIMAL(38,18) NOT NULL DEFAULT 0,
  "roundingMode" VARCHAR(16) NOT NULL DEFAULT 'HALF_EVEN',
  "sourceDigest" CHAR(64) NOT NULL,
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6),
  "publishedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicOiuPolicyRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicOiuPolicyRevision_policy_check" CHECK ("tenantId" IS NULL OR "applicationId" IS NOT NULL),
  CONSTRAINT "OicOiuPolicyRevision_range_check" CHECK ("minimumIncrement" >= 0 AND ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")),
  CONSTRAINT "OicOiuPolicyRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicOiuPolicyRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicOiuPolicyRevision_scope_policy_revision_key" ON "OicOiuPolicyRevision"("applicationId", "tenantId", "policyKey", "revision");
CREATE INDEX "OicOiuPolicyRevision_scope_policy_status_effective_idx" ON "OicOiuPolicyRevision"("applicationId", "tenantId", "policyKey", "status", "effectiveFrom");

CREATE TABLE "OicOiuDimensionRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "policyRevisionId" UUID,
  "dimension" VARCHAR(64) NOT NULL,
  "unit" VARCHAR(64) NOT NULL,
  "weightNumerator" DECIMAL(38,18) NOT NULL,
  "weightDenominator" DECIMAL(38,18) NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  "included" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "OicOiuDimensionRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicOiuDimensionRule_weight_check" CHECK ("weightNumerator" >= 0 AND "weightDenominator" > 0),
  CONSTRAINT "OicOiuDimensionRule_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "OicOiuPolicyRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicOiuDimensionRule_policy_dimension_key" ON "OicOiuDimensionRule"("policyRevisionId", "dimension");

CREATE TABLE "OicProviderCostAssessment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessmentKey" VARCHAR(128) NOT NULL,
  "usageEventId" UUID NOT NULL,
  "rateBookRevisionId" UUID,
  "kind" "OicEconomicAssessmentKind" NOT NULL,
  "status" "OicEconomicAssessmentStatus" NOT NULL,
  "evidenceClass" "OicProviderCostEvidenceClass" NOT NULL,
  "nativeAmount" DECIMAL(38,18),
  "currency" CHAR(3),
  "dimensionLines" JSONB NOT NULL,
  "sourceDigest" CHAR(64) NOT NULL,
  "producerVersion" VARCHAR(64) NOT NULL,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicProviderCostAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicProviderCostAssessment_amount_check" CHECK (("nativeAmount" IS NULL OR "nativeAmount" >= 0) AND ("nativeAmount" IS NULL OR "currency" IS NOT NULL)),
  CONSTRAINT "OicProviderCostAssessment_assessmentKey_key" UNIQUE ("assessmentKey"),
  CONSTRAINT "OicProviderCostAssessment_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "OicUsageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicProviderCostAssessment_rateBookRevisionId_fkey" FOREIGN KEY ("rateBookRevisionId") REFERENCES "OicProviderRateBookRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicProviderCostAssessment_source_revision_kind_key" ON "OicProviderCostAssessment"("usageEventId", "rateBookRevisionId", "kind");
CREATE INDEX "OicProviderCostAssessment_usageEvent_recorded_idx" ON "OicProviderCostAssessment"("usageEventId", "recordedAt");
CREATE INDEX "OicProviderCostAssessment_currency_status_recorded_idx" ON "OicProviderCostAssessment"("currency", "status", "recordedAt");

CREATE TABLE "OicOiuAssessment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessmentKey" VARCHAR(128) NOT NULL,
  "usageEventId" UUID NOT NULL,
  "policyRevisionId" UUID,
  "kind" "OicEconomicAssessmentKind" NOT NULL,
  "status" "OicEconomicAssessmentStatus" NOT NULL,
  "inputs" JSONB NOT NULL,
  "oiu" DECIMAL(38,6),
  "sourceDigest" CHAR(64) NOT NULL,
  "producerVersion" VARCHAR(64) NOT NULL,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicOiuAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicOiuAssessment_amount_check" CHECK ("oiu" IS NULL OR "oiu" >= 0),
  CONSTRAINT "OicOiuAssessment_assessmentKey_key" UNIQUE ("assessmentKey"),
  CONSTRAINT "OicOiuAssessment_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "OicUsageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OicOiuAssessment_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "OicOiuPolicyRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OicOiuAssessment_source_policy_kind_key" ON "OicOiuAssessment"("usageEventId", "policyRevisionId", "kind");
CREATE INDEX "OicOiuAssessment_policy_status_recorded_idx" ON "OicOiuAssessment"("policyRevisionId", "status", "recordedAt");

CREATE TABLE "OicOiuPosting" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessmentId" UUID NOT NULL,
  "sourceKey" VARCHAR(128) NOT NULL,
  "amount" DECIMAL(38,6) NOT NULL,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicOiuPosting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OicOiuPosting_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "OicOiuPosting_assessmentId_key" UNIQUE ("assessmentId"),
  CONSTRAINT "OicOiuPosting_sourceKey_key" UNIQUE ("sourceKey"),
  CONSTRAINT "OicOiuPosting_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "OicOiuAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OicOiuPosting_recordedAt_id_idx" ON "OicOiuPosting"("recordedAt", "id");
