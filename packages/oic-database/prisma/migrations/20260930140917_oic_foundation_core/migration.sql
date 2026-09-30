-- CreateEnum
CREATE TYPE "OicLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OicCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OicIdempotencyStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "OicApplication" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "status" "OicLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicTenant" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "key" VARCHAR(64),
    "displayName" VARCHAR(160) NOT NULL,
    "status" "OicLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicTenantExternalReference" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "externalId" VARCHAR(256) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicTenantExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicServicePrincipal" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "status" "OicLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicServicePrincipal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicPrincipalScopeGrant" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "scope" VARCHAR(128) NOT NULL,
    "grantedBy" UUID,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicPrincipalScopeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicPrincipalTenantGrant" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "grantedBy" UUID,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicPrincipalTenantGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicMachineCredential" (
    "id" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "selector" VARCHAR(32) NOT NULL,
    "verifier" VARCHAR(256) NOT NULL,
    "verifierVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "OicCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "replacedById" UUID,

    CONSTRAINT "OicMachineCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicAuditEvent" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorPrincipalId" UUID,
    "applicationId" UUID,
    "tenantId" UUID,
    "action" VARCHAR(96) NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(128),
    "requestId" VARCHAR(128),
    "traceId" VARCHAR(128),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "OicAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicIdempotencyRecord" (
    "id" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "scope" VARCHAR(128) NOT NULL,
    "operation" VARCHAR(128) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "resultRef" VARCHAR(128),
    "status" "OicIdempotencyStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OicApplication_key_key" ON "OicApplication"("key");

-- CreateIndex
CREATE INDEX "OicApplication_status_key_idx" ON "OicApplication"("status", "key");

-- CreateIndex
CREATE INDEX "OicTenant_applicationId_status_createdAt_idx" ON "OicTenant"("applicationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicTenant_id_applicationId_key" ON "OicTenant"("id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OicTenant_applicationId_key_key" ON "OicTenant"("applicationId", "key");

-- CreateIndex
CREATE INDEX "OicTenantExternalReference_tenantId_createdAt_idx" ON "OicTenantExternalReference"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicTenantExternalReference_applicationId_sourceType_externa_key" ON "OicTenantExternalReference"("applicationId", "sourceType", "externalId");

-- CreateIndex
CREATE INDEX "OicServicePrincipal_applicationId_status_idx" ON "OicServicePrincipal"("applicationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OicServicePrincipal_id_applicationId_key" ON "OicServicePrincipal"("id", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OicServicePrincipal_applicationId_key_key" ON "OicServicePrincipal"("applicationId", "key");

-- CreateIndex
CREATE INDEX "OicPrincipalScopeGrant_applicationId_scope_revokedAt_idx" ON "OicPrincipalScopeGrant"("applicationId", "scope", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicPrincipalScopeGrant_principalId_scope_key" ON "OicPrincipalScopeGrant"("principalId", "scope");

-- CreateIndex
CREATE INDEX "OicPrincipalTenantGrant_applicationId_tenantId_revokedAt_idx" ON "OicPrincipalTenantGrant"("applicationId", "tenantId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicPrincipalTenantGrant_principalId_tenantId_key" ON "OicPrincipalTenantGrant"("principalId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OicMachineCredential_selector_key" ON "OicMachineCredential"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "OicMachineCredential_replacedById_key" ON "OicMachineCredential"("replacedById");

-- CreateIndex
CREATE INDEX "OicMachineCredential_principalId_status_expiresAt_idx" ON "OicMachineCredential"("principalId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "OicAuditEvent_applicationId_occurredAt_idx" ON "OicAuditEvent"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "OicAuditEvent_tenantId_occurredAt_idx" ON "OicAuditEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "OicAuditEvent_actorPrincipalId_occurredAt_idx" ON "OicAuditEvent"("actorPrincipalId", "occurredAt");

-- CreateIndex
CREATE INDEX "OicAuditEvent_targetType_targetId_occurredAt_idx" ON "OicAuditEvent"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE INDEX "OicIdempotencyRecord_expiresAt_idx" ON "OicIdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicIdempotencyRecord_principalId_scope_operation_key_key" ON "OicIdempotencyRecord"("principalId", "scope", "operation", "key");

-- AddForeignKey
ALTER TABLE "OicTenant" ADD CONSTRAINT "OicTenant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicTenantExternalReference" ADD CONSTRAINT "OicTenantExternalReference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicTenantExternalReference" ADD CONSTRAINT "OicTenantExternalReference_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicServicePrincipal" ADD CONSTRAINT "OicServicePrincipal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPrincipalScopeGrant" ADD CONSTRAINT "OicPrincipalScopeGrant_principalId_applicationId_fkey" FOREIGN KEY ("principalId", "applicationId") REFERENCES "OicServicePrincipal"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPrincipalTenantGrant" ADD CONSTRAINT "OicPrincipalTenantGrant_principalId_applicationId_fkey" FOREIGN KEY ("principalId", "applicationId") REFERENCES "OicServicePrincipal"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicPrincipalTenantGrant" ADD CONSTRAINT "OicPrincipalTenantGrant_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicMachineCredential" ADD CONSTRAINT "OicMachineCredential_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "OicServicePrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicMachineCredential" ADD CONSTRAINT "OicMachineCredential_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "OicMachineCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
