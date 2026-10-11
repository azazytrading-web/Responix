-- CreateEnum
CREATE TYPE "OicPolicyRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "OicPlanAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OicQuotaSubject" AS ENUM ('APPLICATION', 'TENANT', 'PRINCIPAL', 'MODEL', 'TIER', 'CAPABILITY');

-- CreateEnum
CREATE TYPE "OicQuotaWindow" AS ENUM ('LIFETIME', 'UTC_DAY', 'UTC_MONTH', 'ROLLING', 'CONTRACT_PERIOD');

-- CreateEnum
CREATE TYPE "OicQuotaEnforcement" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "OicUnknownLiabilityRule" AS ENUM ('DENY', 'HOLD_MAXIMUM');

-- CreateEnum
CREATE TYPE "OicBudgetUnit" AS ENUM ('OIU', 'CURRENCY');

-- CreateEnum
CREATE TYPE "OicAdmissionStatus" AS ENUM ('SHADOW', 'ADMITTED', 'DENIED', 'DISPATCHED', 'SETTLED', 'UNCERTAIN', 'RELEASED');

-- CreateEnum
CREATE TYPE "OicReservationState" AS ENUM ('HELD', 'DISPATCHED', 'SETTLING', 'SETTLED', 'UNCERTAIN', 'RELEASED');

-- CreateEnum
CREATE TYPE "OicUsagePostingKind" AS ENUM ('RESERVE', 'CONSUME', 'RELEASE', 'ADJUST');

-- AlterTable
ALTER TABLE "OicProviderAttempt" ADD COLUMN     "admissionId" UUID;

-- CreateTable
CREATE TABLE "OicPlan" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "planKey" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicPlanRevision" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "OicPolicyRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "entitlements" JSONB NOT NULL,
    "maxOutputUnits" INTEGER,
    "maxConcurrency" INTEGER,
    "sourceDigest" CHAR(64) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicPlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicPlanAssignment" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "subjectKey" VARCHAR(128) NOT NULL,
    "planRevisionId" UUID NOT NULL,
    "status" "OicPlanAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicQuotaPolicyRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID,
    "tenantId" UUID,
    "planRevisionId" UUID,
    "scopeKey" VARCHAR(128) NOT NULL,
    "quotaKey" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "OicPolicyRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" "OicQuotaSubject" NOT NULL,
    "dimension" VARCHAR(64) NOT NULL,
    "unit" VARCHAR(64) NOT NULL,
    "window" "OicQuotaWindow" NOT NULL,
    "windowSeconds" INTEGER,
    "enforcement" "OicQuotaEnforcement" NOT NULL,
    "limitValue" DECIMAL(38,18) NOT NULL,
    "reservationUpperBound" DECIMAL(38,18),
    "safetyMargin" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "unknownLiabilityRule" "OicUnknownLiabilityRule" NOT NULL DEFAULT 'DENY',
    "sourceDigest" CHAR(64) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicQuotaPolicyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicBudgetRevision" (
    "id" UUID NOT NULL,
    "applicationId" UUID,
    "tenantId" UUID,
    "planRevisionId" UUID,
    "scopeKey" VARCHAR(128) NOT NULL,
    "budgetKey" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "OicPolicyRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "unit" "OicBudgetUnit" NOT NULL,
    "currency" CHAR(3),
    "enforcement" "OicQuotaEnforcement" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "reservationUpperBound" DECIMAL(38,18),
    "safetyMargin" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "purpose" VARCHAR(128) NOT NULL,
    "deadline" TIMESTAMPTZ(6),
    "unknownLiabilityRule" "OicUnknownLiabilityRule" NOT NULL DEFAULT 'DENY',
    "sourceDigest" CHAR(64) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicBudgetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicQuotaBucket" (
    "id" UUID NOT NULL,
    "bucketKey" VARCHAR(128) NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "quotaPolicyRevisionId" UUID,
    "budgetRevisionId" UUID,
    "unit" VARCHAR(64) NOT NULL,
    "currency" CHAR(3),
    "limitValue" DECIMAL(38,18) NOT NULL,
    "consumed" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "held" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "uncertain" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMPTZ(6) NOT NULL,
    "windowEnd" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicQuotaBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicAdmission" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID,
    "principalId" UUID NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL,
    "planRevisionId" UUID,
    "operation" VARCHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "status" "OicAdmissionStatus" NOT NULL,
    "denialCode" VARCHAR(64),
    "requestBounds" JSONB NOT NULL,
    "fenceGeneration" INTEGER NOT NULL DEFAULT 1,
    "dispatchDeadline" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicReservationLeg" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "bucketId" UUID NOT NULL,
    "quotaPolicyRevisionId" UUID,
    "budgetRevisionId" UUID,
    "amount" DECIMAL(38,18) NOT NULL,
    "state" "OicReservationState" NOT NULL DEFAULT 'HELD',
    "fenceGeneration" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicReservationLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicUsagePosting" (
    "id" UUID NOT NULL,
    "bucketId" UUID NOT NULL,
    "admissionId" UUID,
    "sourceKey" VARCHAR(160) NOT NULL,
    "kind" "OicUsagePostingKind" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicUsagePosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OicPlan_applicationId_createdAt_idx" ON "OicPlan"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicPlan_applicationId_planKey_key" ON "OicPlan"("applicationId", "planKey");

-- CreateIndex
CREATE INDEX "OicPlanRevision_status_effectiveFrom_effectiveTo_idx" ON "OicPlanRevision"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "OicPlanRevision_planId_revision_key" ON "OicPlanRevision"("planId", "revision");

-- CreateIndex
CREATE INDEX "OicPlanAssignment_applicationId_tenantId_subjectKey_status__idx" ON "OicPlanAssignment"("applicationId", "tenantId", "subjectKey", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "OicPlanAssignment_planRevisionId_status_idx" ON "OicPlanAssignment"("planRevisionId", "status");

-- CreateIndex
CREATE INDEX "OicQuotaPolicyRevision_applicationId_tenantId_dimension_sta_idx" ON "OicQuotaPolicyRevision"("applicationId", "tenantId", "dimension", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "OicQuotaPolicyRevision_planRevisionId_dimension_status_idx" ON "OicQuotaPolicyRevision"("planRevisionId", "dimension", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OicQuotaPolicyRevision_scopeKey_quotaKey_revision_key" ON "OicQuotaPolicyRevision"("scopeKey", "quotaKey", "revision");

-- CreateIndex
CREATE INDEX "OicBudgetRevision_applicationId_tenantId_unit_status_effect_idx" ON "OicBudgetRevision"("applicationId", "tenantId", "unit", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "OicBudgetRevision_planRevisionId_unit_status_idx" ON "OicBudgetRevision"("planRevisionId", "unit", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OicBudgetRevision_scopeKey_budgetKey_revision_key" ON "OicBudgetRevision"("scopeKey", "budgetKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OicQuotaBucket_bucketKey_key" ON "OicQuotaBucket"("bucketKey");

-- CreateIndex
CREATE INDEX "OicQuotaBucket_applicationId_tenantId_windowStart_id_idx" ON "OicQuotaBucket"("applicationId", "tenantId", "windowStart", "id");

-- CreateIndex
CREATE INDEX "OicQuotaBucket_quotaPolicyRevisionId_windowStart_idx" ON "OicQuotaBucket"("quotaPolicyRevisionId", "windowStart");

-- CreateIndex
CREATE INDEX "OicQuotaBucket_budgetRevisionId_windowStart_idx" ON "OicQuotaBucket"("budgetRevisionId", "windowStart");

-- CreateIndex
CREATE INDEX "OicAdmission_applicationId_tenantId_status_createdAt_idx" ON "OicAdmission"("applicationId", "tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OicAdmission_principalId_status_createdAt_idx" ON "OicAdmission"("principalId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicAdmission_scopeKey_operation_idempotencyKey_key" ON "OicAdmission"("scopeKey", "operation", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OicReservationLeg_bucketId_state_expiresAt_idx" ON "OicReservationLeg"("bucketId", "state", "expiresAt");

-- CreateIndex
CREATE INDEX "OicReservationLeg_admissionId_state_idx" ON "OicReservationLeg"("admissionId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "OicReservationLeg_admissionId_bucketId_key" ON "OicReservationLeg"("admissionId", "bucketId");

-- CreateIndex
CREATE INDEX "OicUsagePosting_bucketId_recordedAt_id_idx" ON "OicUsagePosting"("bucketId", "recordedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OicUsagePosting_bucketId_sourceKey_kind_key" ON "OicUsagePosting"("bucketId", "sourceKey", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "OicUsagePosting_bucketId_sequence_key" ON "OicUsagePosting"("bucketId", "sequence");

-- AddForeignKey
ALTER TABLE "OicProviderAttempt" ADD CONSTRAINT "OicProviderAttempt_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "OicAdmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPlan" ADD CONSTRAINT "OicPlan_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPlanRevision" ADD CONSTRAINT "OicPlanRevision_planId_fkey" FOREIGN KEY ("planId") REFERENCES "OicPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPlanAssignment" ADD CONSTRAINT "OicPlanAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPlanAssignment" ADD CONSTRAINT "OicPlanAssignment_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPlanAssignment" ADD CONSTRAINT "OicPlanAssignment_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaPolicyRevision" ADD CONSTRAINT "OicQuotaPolicyRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaPolicyRevision" ADD CONSTRAINT "OicQuotaPolicyRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaPolicyRevision" ADD CONSTRAINT "OicQuotaPolicyRevision_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicBudgetRevision" ADD CONSTRAINT "OicBudgetRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicBudgetRevision" ADD CONSTRAINT "OicBudgetRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicBudgetRevision" ADD CONSTRAINT "OicBudgetRevision_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_quotaPolicyRevisionId_fkey" FOREIGN KEY ("quotaPolicyRevisionId") REFERENCES "OicQuotaPolicyRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_budgetRevisionId_fkey" FOREIGN KEY ("budgetRevisionId") REFERENCES "OicBudgetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicAdmission" ADD CONSTRAINT "OicAdmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicAdmission" ADD CONSTRAINT "OicAdmission_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicAdmission" ADD CONSTRAINT "OicAdmission_principalId_applicationId_fkey" FOREIGN KEY ("principalId", "applicationId") REFERENCES "OicServicePrincipal"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicAdmission" ADD CONSTRAINT "OicAdmission_planRevisionId_fkey" FOREIGN KEY ("planRevisionId") REFERENCES "OicPlanRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicReservationLeg" ADD CONSTRAINT "OicReservationLeg_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "OicAdmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicReservationLeg" ADD CONSTRAINT "OicReservationLeg_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "OicQuotaBucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicReservationLeg" ADD CONSTRAINT "OicReservationLeg_quotaPolicyRevisionId_fkey" FOREIGN KEY ("quotaPolicyRevisionId") REFERENCES "OicQuotaPolicyRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicReservationLeg" ADD CONSTRAINT "OicReservationLeg_budgetRevisionId_fkey" FOREIGN KEY ("budgetRevisionId") REFERENCES "OicBudgetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicUsagePosting" ADD CONSTRAINT "OicUsagePosting_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "OicQuotaBucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicUsagePosting" ADD CONSTRAINT "OicUsagePosting_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "OicAdmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- OIC-6.3 ledger invariants are enforced by PostgreSQL as well as command validation.
ALTER TABLE "OicPlanRevision" ADD CONSTRAINT "OicPlanRevision_maxOutputUnits_positive" CHECK ("maxOutputUnits" IS NULL OR "maxOutputUnits" > 0);
ALTER TABLE "OicPlanRevision" ADD CONSTRAINT "OicPlanRevision_maxConcurrency_positive" CHECK ("maxConcurrency" IS NULL OR "maxConcurrency" > 0);
ALTER TABLE "OicQuotaPolicyRevision" ADD CONSTRAINT "OicQuotaPolicyRevision_values_nonnegative" CHECK ("limitValue" >= 0 AND "safetyMargin" >= 0 AND ("reservationUpperBound" IS NULL OR "reservationUpperBound" >= 0));
ALTER TABLE "OicBudgetRevision" ADD CONSTRAINT "OicBudgetRevision_values_nonnegative" CHECK ("amount" >= 0 AND "safetyMargin" >= 0 AND ("reservationUpperBound" IS NULL OR "reservationUpperBound" >= 0));
ALTER TABLE "OicBudgetRevision" ADD CONSTRAINT "OicBudgetRevision_currency_matches_unit" CHECK (("unit" = 'CURRENCY' AND "currency" IS NOT NULL) OR ("unit" = 'OIU' AND "currency" IS NULL));
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_one_policy_kind" CHECK (("quotaPolicyRevisionId" IS NOT NULL) <> ("budgetRevisionId" IS NOT NULL));
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_values_nonnegative" CHECK ("limitValue" >= 0 AND "consumed" >= 0 AND "held" >= 0 AND "uncertain" >= 0);
ALTER TABLE "OicQuotaBucket" ADD CONSTRAINT "OicQuotaBucket_currency_matches_budget" CHECK (("budgetRevisionId" IS NULL AND "currency" IS NULL) OR ("budgetRevisionId" IS NOT NULL));
ALTER TABLE "OicReservationLeg" ADD CONSTRAINT "OicReservationLeg_one_policy_kind" CHECK (("quotaPolicyRevisionId" IS NOT NULL) <> ("budgetRevisionId" IS NOT NULL));
ALTER TABLE "OicReservationLeg" ADD CONSTRAINT "OicReservationLeg_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "OicUsagePosting" ADD CONSTRAINT "OicUsagePosting_amount_nonzero" CHECK ("amount" <> 0);
ALTER TABLE "OicUsagePosting" ADD CONSTRAINT "OicUsagePosting_amount_sign" CHECK ("kind" = 'ADJUST' OR "amount" > 0);