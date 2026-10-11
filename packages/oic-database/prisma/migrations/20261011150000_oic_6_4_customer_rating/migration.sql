-- CreateEnum
CREATE TYPE "OicCustomerRatingStrategy" AS ENUM ('OIU_RATE', 'RESOURCE_RATE', 'REQUEST', 'TASK', 'FEATURE', 'TIERED', 'INCLUDED_PLUS_OVERAGE', 'FIXED_PLUS_VARIABLE');

-- CreateEnum
CREATE TYPE "OicRatedUsageStatus" AS ENUM ('RATED', 'NOT_RATED', 'PARTIAL', 'UNKNOWN_CONVERSION');

-- CreateEnum
CREATE TYPE "OicCommercialAdjustmentKind" AS ENUM ('CREDIT', 'REVERSAL');

-- CreateTable
CREATE TABLE "OicCustomerPriceBookRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID,
    "tenantId" UUID,
    "planRevisionId" UUID NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL,
    "priceBookKey" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "OicEconomicRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "strategy" "OicCustomerRatingStrategy" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "sourceReference" VARCHAR(256) NOT NULL,
    "sourceDigest" CHAR(64) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicCustomerPriceBookRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicCustomerPriceRule" (
    "id" UUID NOT NULL,
    "priceBookRevisionId" UUID NOT NULL,
    "dimension" VARCHAR(64),
    "unit" VARCHAR(64),
    "pricePerUnit" DECIMAL(38,18),
    "quantityDivisor" DECIMAL(38,18) NOT NULL DEFAULT 1,
    "fixedAmount" DECIMAL(38,18),
    "includedQuantity" DECIMAL(38,18),
    "tiers" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicCustomerPriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicRatedUsageEvent" (
    "id" UUID NOT NULL,
    "eventKey" VARCHAR(128) NOT NULL,
    "usageEventId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "planRevisionId" UUID,
    "priceBookRevisionId" UUID,
    "kind" "OicEconomicAssessmentKind" NOT NULL,
    "status" "OicRatedUsageStatus" NOT NULL,
    "nativeAmount" DECIMAL(38,18),
    "currency" CHAR(3),
    "reasonCode" VARCHAR(64),
    "ratingTrace" JSONB NOT NULL,
    "sourceDigest" CHAR(64) NOT NULL,
    "producerVersion" VARCHAR(64) NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicRatedUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicRatedUsageAdjustment" (
    "id" UUID NOT NULL,
    "sourceKey" VARCHAR(128) NOT NULL,
    "requestDigest" CHAR(64) NOT NULL,
    "ratedUsageEventId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "kind" "OicCommercialAdjustmentKind" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" VARCHAR(256) NOT NULL,
    "actorPrincipalId" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicRatedUsageAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicFxRateEvidence" (
    "id" UUID NOT NULL,
    "evidenceKey" VARCHAR(128) NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "quoteCurrency" CHAR(3) NOT NULL,
    "rate" DECIMAL(38,18) NOT NULL,
    "source" VARCHAR(128) NOT NULL,
    "sourceReference" VARCHAR(256) NOT NULL,
    "policyRevision" VARCHAR(64) NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "sourceDigest" CHAR(64) NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicFxRateEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicCustomerAllowanceBucket" (
    "id" UUID NOT NULL,
    "bucketKey" VARCHAR(128) NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "planRevisionId" UUID NOT NULL,
    "priceBookRevisionId" UUID NOT NULL,
    "allowance" DECIMAL(38,18) NOT NULL,
    "consumed" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicCustomerAllowanceBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicCustomerAllowancePosting" (
    "id" UUID NOT NULL,
    "bucketId" UUID NOT NULL,
    "sourceKey" VARCHAR(128) NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicCustomerAllowancePosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OicCustomerPriceBookRevision_applicationId_tenantId_planRev_idx" ON "OicCustomerPriceBookRevision"("applicationId", "tenantId", "planRevisionId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "OicCustomerPriceBookRevision_scopeKey_priceBookKey_revision_key" ON "OicCustomerPriceBookRevision"("scopeKey", "priceBookKey", "revision");

-- CreateIndex
CREATE INDEX "OicCustomerPriceRule_priceBookRevisionId_dimension_idx" ON "OicCustomerPriceRule"("priceBookRevisionId", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX "OicRatedUsageEvent_eventKey_key" ON "OicRatedUsageEvent"("eventKey");

-- CreateIndex
CREATE INDEX "OicRatedUsageEvent_applicationId_tenantId_recordedAt_id_idx" ON "OicRatedUsageEvent"("applicationId", "tenantId", "recordedAt", "id");

-- CreateIndex
CREATE INDEX "OicRatedUsageEvent_status_recordedAt_idx" ON "OicRatedUsageEvent"("status", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicRatedUsageEvent_usageEventId_priceBookRevisionId_kind_key" ON "OicRatedUsageEvent"("usageEventId", "priceBookRevisionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "OicRatedUsageAdjustment_sourceKey_key" ON "OicRatedUsageAdjustment"("sourceKey");

-- CreateIndex
CREATE INDEX "OicRatedUsageAdjustment_ratedUsageEventId_recordedAt_idx" ON "OicRatedUsageAdjustment"("ratedUsageEventId", "recordedAt");

-- CreateIndex
CREATE INDEX "OicRatedUsageAdjustment_applicationId_tenantId_recordedAt_idx" ON "OicRatedUsageAdjustment"("applicationId", "tenantId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicFxRateEvidence_evidenceKey_key" ON "OicFxRateEvidence"("evidenceKey");

-- CreateIndex
CREATE INDEX "OicFxRateEvidence_baseCurrency_quoteCurrency_effectiveAt_idx" ON "OicFxRateEvidence"("baseCurrency", "quoteCurrency", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicCustomerAllowanceBucket_bucketKey_key" ON "OicCustomerAllowanceBucket"("bucketKey");

-- CreateIndex
CREATE INDEX "OicCustomerAllowanceBucket_applicationId_tenantId_planRevis_idx" ON "OicCustomerAllowanceBucket"("applicationId", "tenantId", "planRevisionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "OicCustomerAllowancePosting_sourceKey_key" ON "OicCustomerAllowancePosting"("sourceKey");

-- CreateIndex
CREATE INDEX "OicCustomerAllowancePosting_bucketId_recordedAt_idx" ON "OicCustomerAllowancePosting"("bucketId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicCustomerAllowancePosting_bucketId_sequence_key" ON "OicCustomerAllowancePosting"("bucketId", "sequence");

-- AddForeignKey
ALTER TABLE "OicCustomerPriceBookRevision" ADD CONSTRAINT "OicCustomerPriceBookRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerPriceBookRevision" ADD CONSTRAINT "OicCustomerPriceBookRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerPriceBookRevision" ADD CONSTRAINT "OicCustomerPriceBookRevision_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerPriceRule" ADD CONSTRAINT "OicCustomerPriceRule_priceBookRevisionId_fkey" FOREIGN KEY ("priceBookRevisionId") REFERENCES "OicCustomerPriceBookRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageEvent" ADD CONSTRAINT "OicRatedUsageEvent_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "OicUsageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageEvent" ADD CONSTRAINT "OicRatedUsageEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageEvent" ADD CONSTRAINT "OicRatedUsageEvent_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageEvent" ADD CONSTRAINT "OicRatedUsageEvent_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageEvent" ADD CONSTRAINT "OicRatedUsageEvent_priceBookRevisionId_fkey" FOREIGN KEY ("priceBookRevisionId") REFERENCES "OicCustomerPriceBookRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageAdjustment" ADD CONSTRAINT "OicRatedUsageAdjustment_ratedUsageEventId_fkey" FOREIGN KEY ("ratedUsageEventId") REFERENCES "OicRatedUsageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageAdjustment" ADD CONSTRAINT "OicRatedUsageAdjustment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageAdjustment" ADD CONSTRAINT "OicRatedUsageAdjustment_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRatedUsageAdjustment" ADD CONSTRAINT "OicRatedUsageAdjustment_actorPrincipalId_fkey" FOREIGN KEY ("actorPrincipalId") REFERENCES "OicServicePrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerAllowanceBucket" ADD CONSTRAINT "OicCustomerAllowanceBucket_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerAllowanceBucket" ADD CONSTRAINT "OicCustomerAllowanceBucket_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerAllowanceBucket" ADD CONSTRAINT "OicCustomerAllowanceBucket_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerAllowanceBucket" ADD CONSTRAINT "OicCustomerAllowanceBucket_priceBookRevisionId_fkey" FOREIGN KEY ("priceBookRevisionId") REFERENCES "OicCustomerPriceBookRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicCustomerAllowancePosting" ADD CONSTRAINT "OicCustomerAllowancePosting_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "OicCustomerAllowanceBucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "OicCustomerPriceBookRevision" ADD CONSTRAINT "OicCustomerPriceBookRevision_scope_ck" CHECK ("applicationId" IS NOT NULL AND ("tenantId" IS NULL OR "applicationId" IS NOT NULL));
ALTER TABLE "OicCustomerPriceRule" ADD CONSTRAINT "OicCustomerPriceRule_nonnegative_ck" CHECK (("pricePerUnit" IS NULL OR "pricePerUnit" >= 0) AND ("fixedAmount" IS NULL OR "fixedAmount" >= 0) AND ("includedQuantity" IS NULL OR "includedQuantity" >= 0) AND "quantityDivisor" > 0);
ALTER TABLE "OicRatedUsageEvent" ADD CONSTRAINT "OicRatedUsageEvent_amount_ck" CHECK ("nativeAmount" IS NULL OR "nativeAmount" >= 0);
ALTER TABLE "OicRatedUsageAdjustment" ADD CONSTRAINT "OicRatedUsageAdjustment_negative_ck" CHECK ("amount" < 0);
ALTER TABLE "OicFxRateEvidence" ADD CONSTRAINT "OicFxRateEvidence_rate_ck" CHECK ("rate" > 0 AND "baseCurrency" <> "quoteCurrency");
ALTER TABLE "OicCustomerAllowanceBucket" ADD CONSTRAINT "OicCustomerAllowanceBucket_balance_ck" CHECK ("allowance" >= 0 AND "consumed" >= 0 AND "consumed" <= "allowance" AND ("periodEnd" IS NULL OR "periodEnd" > "periodStart"));
ALTER TABLE "OicCustomerAllowancePosting" ADD CONSTRAINT "OicCustomerAllowancePosting_amount_ck" CHECK ("amount" >= 0 AND "sequence" > 0);
