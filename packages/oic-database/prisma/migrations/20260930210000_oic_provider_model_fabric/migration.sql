-- CreateEnum
CREATE TYPE "OicProviderConnectionScope" AS ENUM ('PLATFORM', 'APPLICATION', 'TENANT');

-- CreateEnum
CREATE TYPE "OicProviderAuthStrategy" AS ENUM ('NONE', 'BEARER', 'API_KEY_HEADER');

-- CreateEnum
CREATE TYPE "OicProviderHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'UNHEALTHY');

-- CreateEnum
CREATE TYPE "OicUpstreamModelSource" AS ENUM ('MANUAL', 'DISCOVERY');

-- CreateEnum
CREATE TYPE "OicCatalogLifecycle" AS ENUM ('ACTIVE', 'DISABLED', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OicCapabilityEvidenceStatus" AS ENUM ('SUPPORTED', 'UNSUPPORTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OicCapabilityEvidenceSource" AS ENUM ('PROVIDER_DECLARED', 'PLATFORM_CURATED', 'OBSERVED');

-- CreateEnum
CREATE TYPE "OicPricingEvidenceStatus" AS ENUM ('KNOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OicModelLifecycle" AS ENUM ('DRAFT', 'EXPERIMENTAL', 'CANDIDATE', 'CANARY', 'PRODUCTION', 'MAINTENANCE', 'DEPRECATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "OicModelVariantKind" AS ENUM ('EXTERNAL_PROVIDER');

-- CreateEnum
CREATE TYPE "OicRuntimeBindingScope" AS ENUM ('PLATFORM', 'APPLICATION', 'TENANT');

-- CreateEnum
CREATE TYPE "OicRuntimeBindingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OicProviderSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "OicProviderDefinition" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "authStrategy" "OicProviderAuthStrategy" NOT NULL,
    "transportProfiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultEndpoint" VARCHAR(2048),
    "status" "OicLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicProviderDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicProviderConnection" (
    "id" UUID NOT NULL,
    "providerDefinitionId" UUID NOT NULL,
    "scope" "OicProviderConnectionScope" NOT NULL,
    "applicationId" UUID,
    "tenantId" UUID,
    "displayName" VARCHAR(160) NOT NULL,
    "endpointUrl" VARCHAR(2048) NOT NULL,
    "transportProfile" VARCHAR(128) NOT NULL,
    "status" "OicLifecycleStatus" NOT NULL DEFAULT 'SUSPENDED',
    "healthStatus" "OicProviderHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastValidatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicProviderCredential" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "OicCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "ciphertext" TEXT NOT NULL,
    "nonce" VARCHAR(32) NOT NULL,
    "authTag" VARCHAR(32) NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicProviderHealthCheck" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "status" "OicProviderHealthStatus" NOT NULL,
    "diagnosticCode" VARCHAR(64) NOT NULL,
    "latencyMs" INTEGER,
    "endpointHost" VARCHAR(253),
    "testedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicProviderHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicProviderSyncRun" (
    "id" UUID NOT NULL,
    "providerDefinitionId" UUID NOT NULL,
    "connectionId" UUID,
    "status" "OicProviderSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "diagnosticCode" VARCHAR(64),
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "OicProviderSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicUpstreamModel" (
    "id" UUID NOT NULL,
    "providerDefinitionId" UUID NOT NULL,
    "upstreamModelId" VARCHAR(256) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "family" VARCHAR(128),
    "source" "OicUpstreamModelSource" NOT NULL DEFAULT 'MANUAL',
    "lifecycle" "OicCatalogLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "contextLimit" INTEGER,
    "outputLimit" INTEGER,
    "lastDiscoveredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicUpstreamModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicUpstreamCapabilityEvidence" (
    "id" UUID NOT NULL,
    "upstreamModelId" UUID NOT NULL,
    "capability" VARCHAR(64) NOT NULL,
    "status" "OicCapabilityEvidenceStatus" NOT NULL,
    "source" "OicCapabilityEvidenceSource" NOT NULL,
    "sourceRef" VARCHAR(256),
    "observedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicUpstreamCapabilityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicUpstreamPricingEvidence" (
    "id" UUID NOT NULL,
    "upstreamModelId" UUID NOT NULL,
    "status" "OicPricingEvidenceStatus" NOT NULL,
    "inputRate" DECIMAL(20,10),
    "outputRate" DECIMAL(20,10),
    "cachedInputRate" DECIMAL(20,10),
    "currency" VARCHAR(3),
    "unit" VARCHAR(64) NOT NULL DEFAULT 'USD_PER_MILLION_TOKENS',
    "sourceRef" VARCHAR(256),
    "effectiveAt" TIMESTAMPTZ(6),
    "observedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicUpstreamPricingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicModelFamily" (
    "id" UUID NOT NULL,
    "familyKey" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "lifecycle" "OicModelLifecycle" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicModelFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicModelEdition" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "publicId" VARCHAR(64) NOT NULL,
    "editionKey" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "domain" VARCHAR(128),
    "lifecycle" "OicModelLifecycle" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicModelEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicModelRevision" (
    "id" UUID NOT NULL,
    "editionId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "instructions" TEXT,
    "specification" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicModelRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicModelVariant" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "variantKey" VARCHAR(64) NOT NULL,
    "kind" "OicModelVariantKind" NOT NULL,
    "providerDefinitionId" UUID,
    "upstreamModelId" UUID,
    "transportProfile" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicModelVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicRuntimeBinding" (
    "id" UUID NOT NULL,
    "editionId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "scope" "OicRuntimeBindingScope" NOT NULL,
    "applicationId" UUID,
    "tenantId" UUID,
    "environment" VARCHAR(64) NOT NULL DEFAULT 'production',
    "status" "OicRuntimeBindingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OicRuntimeBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicApplicationModelVisibility" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "editionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OicApplicationModelVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OicProviderDefinition_key_key" ON "OicProviderDefinition"("key");

-- CreateIndex
CREATE INDEX "OicProviderDefinition_status_key_idx" ON "OicProviderDefinition"("status", "key");

-- CreateIndex
CREATE INDEX "OicProviderConnection_providerDefinitionId_status_scope_idx" ON "OicProviderConnection"("providerDefinitionId", "status", "scope");

-- CreateIndex
CREATE INDEX "OicProviderConnection_applicationId_tenantId_status_idx" ON "OicProviderConnection"("applicationId", "tenantId", "status");

-- CreateIndex
CREATE INDEX "OicProviderCredential_connectionId_status_createdAt_idx" ON "OicProviderCredential"("connectionId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicProviderCredential_connectionId_version_key" ON "OicProviderCredential"("connectionId", "version");

-- CreateIndex
CREATE INDEX "OicProviderHealthCheck_connectionId_testedAt_idx" ON "OicProviderHealthCheck"("connectionId", "testedAt");

-- CreateIndex
CREATE INDEX "OicProviderSyncRun_providerDefinitionId_startedAt_idx" ON "OicProviderSyncRun"("providerDefinitionId", "startedAt");

-- CreateIndex
CREATE INDEX "OicUpstreamModel_providerDefinitionId_lifecycle_displayName_idx" ON "OicUpstreamModel"("providerDefinitionId", "lifecycle", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "OicUpstreamModel_providerDefinitionId_upstreamModelId_key" ON "OicUpstreamModel"("providerDefinitionId", "upstreamModelId");

-- CreateIndex
CREATE INDEX "OicUpstreamCapabilityEvidence_upstreamModelId_capability_ob_idx" ON "OicUpstreamCapabilityEvidence"("upstreamModelId", "capability", "observedAt");

-- CreateIndex
CREATE INDEX "OicUpstreamPricingEvidence_upstreamModelId_observedAt_idx" ON "OicUpstreamPricingEvidence"("upstreamModelId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicModelFamily_familyKey_key" ON "OicModelFamily"("familyKey");

-- CreateIndex
CREATE INDEX "OicModelFamily_lifecycle_familyKey_idx" ON "OicModelFamily"("lifecycle", "familyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OicModelEdition_publicId_key" ON "OicModelEdition"("publicId");

-- CreateIndex
CREATE INDEX "OicModelEdition_familyId_lifecycle_idx" ON "OicModelEdition"("familyId", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "OicModelEdition_familyId_editionKey_key" ON "OicModelEdition"("familyId", "editionKey");

-- CreateIndex
CREATE INDEX "OicModelRevision_editionId_revision_idx" ON "OicModelRevision"("editionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OicModelRevision_editionId_revision_key" ON "OicModelRevision"("editionId", "revision");

-- CreateIndex
CREATE INDEX "OicModelVariant_providerDefinitionId_upstreamModelId_idx" ON "OicModelVariant"("providerDefinitionId", "upstreamModelId");

-- CreateIndex
CREATE UNIQUE INDEX "OicModelVariant_revisionId_variantKey_key" ON "OicModelVariant"("revisionId", "variantKey");

-- CreateIndex
CREATE INDEX "OicRuntimeBinding_editionId_environment_scope_status_idx" ON "OicRuntimeBinding"("editionId", "environment", "scope", "status");

-- CreateIndex
CREATE INDEX "OicRuntimeBinding_applicationId_tenantId_environment_status_idx" ON "OicRuntimeBinding"("applicationId", "tenantId", "environment", "status");

-- CreateIndex
CREATE INDEX "OicApplicationModelVisibility_applicationId_createdAt_idx" ON "OicApplicationModelVisibility"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OicApplicationModelVisibility_applicationId_editionId_key" ON "OicApplicationModelVisibility"("applicationId", "editionId");

-- AddForeignKey
ALTER TABLE "OicProviderConnection" ADD CONSTRAINT "OicProviderConnection_providerDefinitionId_fkey" FOREIGN KEY ("providerDefinitionId") REFERENCES "OicProviderDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicProviderConnection" ADD CONSTRAINT "OicProviderConnection_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicProviderConnection" ADD CONSTRAINT "OicProviderConnection_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicProviderCredential" ADD CONSTRAINT "OicProviderCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicProviderHealthCheck" ADD CONSTRAINT "OicProviderHealthCheck_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicProviderSyncRun" ADD CONSTRAINT "OicProviderSyncRun_providerDefinitionId_fkey" FOREIGN KEY ("providerDefinitionId") REFERENCES "OicProviderDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicProviderSyncRun" ADD CONSTRAINT "OicProviderSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicUpstreamModel" ADD CONSTRAINT "OicUpstreamModel_providerDefinitionId_fkey" FOREIGN KEY ("providerDefinitionId") REFERENCES "OicProviderDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicUpstreamCapabilityEvidence" ADD CONSTRAINT "OicUpstreamCapabilityEvidence_upstreamModelId_fkey" FOREIGN KEY ("upstreamModelId") REFERENCES "OicUpstreamModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicUpstreamPricingEvidence" ADD CONSTRAINT "OicUpstreamPricingEvidence_upstreamModelId_fkey" FOREIGN KEY ("upstreamModelId") REFERENCES "OicUpstreamModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicModelEdition" ADD CONSTRAINT "OicModelEdition_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "OicModelFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicModelRevision" ADD CONSTRAINT "OicModelRevision_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OicModelEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicModelVariant" ADD CONSTRAINT "OicModelVariant_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "OicModelRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicModelVariant" ADD CONSTRAINT "OicModelVariant_providerDefinitionId_fkey" FOREIGN KEY ("providerDefinitionId") REFERENCES "OicProviderDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicModelVariant" ADD CONSTRAINT "OicModelVariant_upstreamModelId_fkey" FOREIGN KEY ("upstreamModelId") REFERENCES "OicUpstreamModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRuntimeBinding" ADD CONSTRAINT "OicRuntimeBinding_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OicModelEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRuntimeBinding" ADD CONSTRAINT "OicRuntimeBinding_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "OicModelVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRuntimeBinding" ADD CONSTRAINT "OicRuntimeBinding_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OicProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRuntimeBinding" ADD CONSTRAINT "OicRuntimeBinding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicRuntimeBinding" ADD CONSTRAINT "OicRuntimeBinding_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicApplicationModelVisibility" ADD CONSTRAINT "OicApplicationModelVisibility_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OicApplicationModelVisibility" ADD CONSTRAINT "OicApplicationModelVisibility_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "OicModelEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OIC-3 ownership, identity, evidence, credential, and lifecycle constraints.
ALTER TABLE "OicProviderConnection" ADD CONSTRAINT "OicProviderConnection_scope_owner_check" CHECK (
  ("scope" = 'PLATFORM' AND "applicationId" IS NULL AND "tenantId" IS NULL) OR
  ("scope" = 'APPLICATION' AND "applicationId" IS NOT NULL AND "tenantId" IS NULL) OR
  ("scope" = 'TENANT' AND "applicationId" IS NOT NULL AND "tenantId" IS NOT NULL)
);
ALTER TABLE "OicRuntimeBinding" ADD CONSTRAINT "OicRuntimeBinding_scope_owner_check" CHECK (
  ("scope" = 'PLATFORM' AND "applicationId" IS NULL AND "tenantId" IS NULL) OR
  ("scope" = 'APPLICATION' AND "applicationId" IS NOT NULL AND "tenantId" IS NULL) OR
  ("scope" = 'TENANT' AND "applicationId" IS NOT NULL AND "tenantId" IS NOT NULL)
);
CREATE UNIQUE INDEX "OicProviderCredential_one_active_per_connection_key" ON "OicProviderCredential"("connectionId") WHERE "status" = 'ACTIVE';
ALTER TABLE "OicProviderCredential" ADD CONSTRAINT "OicProviderCredential_envelope_check" CHECK (
  "version" > 0 AND "keyVersion" > 0 AND "ciphertext" <> '' AND "nonce" ~ '^[a-f0-9]{24}$' AND "authTag" ~ '^[a-f0-9]{32}$'
);
ALTER TABLE "OicUpstreamModel" ADD CONSTRAINT "OicUpstreamModel_opaque_id_check" CHECK (
  length("upstreamModelId") BETWEEN 1 AND 256 AND btrim("upstreamModelId") <> '' AND "upstreamModelId" !~ '[[:cntrl:]]' AND
  ("contextLimit" IS NULL OR "contextLimit" > 0) AND ("outputLimit" IS NULL OR "outputLimit" > 0)
);
ALTER TABLE "OicUpstreamCapabilityEvidence" ADD CONSTRAINT "OicUpstreamCapabilityEvidence_name_check" CHECK (
  "capability" IN ('text.generate','text.stream','json.mode','tool.use','vision.image','audio.input','audio.output','embedding.create','reasoning')
);
ALTER TABLE "OicUpstreamPricingEvidence" ADD CONSTRAINT "OicUpstreamPricingEvidence_rates_check" CHECK (
  ("inputRate" IS NULL OR "inputRate" >= 0) AND ("outputRate" IS NULL OR "outputRate" >= 0) AND ("cachedInputRate" IS NULL OR "cachedInputRate" >= 0) AND
  (("status" = 'UNKNOWN' AND "inputRate" IS NULL AND "outputRate" IS NULL AND "cachedInputRate" IS NULL AND "currency" IS NULL AND "effectiveAt" IS NULL) OR
   ("status" = 'KNOWN' AND "currency" = 'USD' AND "effectiveAt" IS NOT NULL AND ("inputRate" IS NOT NULL OR "outputRate" IS NOT NULL OR "cachedInputRate" IS NOT NULL)))
);
ALTER TABLE "OicModelFamily" ADD CONSTRAINT "OicModelFamily_key_check" CHECK ("familyKey" ~ '^[a-z0-9][a-z0-9._-]{0,63}$');
ALTER TABLE "OicModelEdition" ADD CONSTRAINT "OicModelEdition_public_id_check" CHECK ("publicId" ~ '^oi-[a-z0-9]+([._-][a-z0-9]+)*$');
ALTER TABLE "OicModelRevision" ADD CONSTRAINT "OicModelRevision_positive_check" CHECK ("revision" > 0);
ALTER TABLE "OicModelVariant" ADD CONSTRAINT "OicModelVariant_external_provider_check" CHECK (
  "kind" = 'EXTERNAL_PROVIDER' AND "providerDefinitionId" IS NOT NULL AND "upstreamModelId" IS NOT NULL AND "transportProfile" IN ('openai-chat-completions-v1','openai-responses-v1')
);
ALTER TABLE "OicProviderSyncRun" ADD CONSTRAINT "OicProviderSyncRun_counts_check" CHECK (
  "discoveredCount" >= 0 AND "createdCount" >= 0 AND "updatedCount" >= 0 AND "rejectedCount" >= 0 AND ("status" = 'RUNNING' OR "completedAt" IS NOT NULL)
);
ALTER TABLE "OicProviderHealthCheck" ADD CONSTRAINT "OicProviderHealthCheck_latency_check" CHECK ("latencyMs" IS NULL OR "latencyMs" >= 0);

CREATE FUNCTION oic_reject_model_revision_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OIC model revisions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OicModelRevision_immutable" BEFORE UPDATE OR DELETE ON "OicModelRevision" FOR EACH ROW EXECUTE FUNCTION oic_reject_model_revision_mutation();

CREATE FUNCTION oic_validate_model_variant_provider() RETURNS trigger AS $$
DECLARE upstream_provider UUID;
BEGIN
  SELECT "providerDefinitionId" INTO upstream_provider FROM "OicUpstreamModel" WHERE "id" = NEW."upstreamModelId";
  IF upstream_provider IS NULL OR upstream_provider <> NEW."providerDefinitionId" THEN
    RAISE EXCEPTION 'OIC model variant provider must match its upstream model';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OicModelVariant_provider_integrity" BEFORE INSERT OR UPDATE ON "OicModelVariant" FOR EACH ROW EXECUTE FUNCTION oic_validate_model_variant_provider();

CREATE FUNCTION oic_validate_runtime_binding() RETURNS trigger AS $$
DECLARE variant_revision UUID; variant_provider UUID; connection_provider UUID; connection_scope "OicProviderConnectionScope"; connection_app UUID; connection_tenant UUID; connection_status "OicLifecycleStatus"; auth_strategy "OicProviderAuthStrategy"; has_credential BOOLEAN;
BEGIN
  SELECT "revisionId", "providerDefinitionId" INTO variant_revision, variant_provider FROM "OicModelVariant" WHERE "id" = NEW."variantId" AND "kind" = 'EXTERNAL_PROVIDER';
  IF variant_revision IS NULL OR NOT EXISTS (SELECT 1 FROM "OicModelRevision" WHERE "id" = variant_revision AND "editionId" = NEW."editionId") THEN
    RAISE EXCEPTION 'OIC runtime binding edition must own the selected variant revision';
  END IF;
  SELECT c."providerDefinitionId", c."scope", c."applicationId", c."tenantId", c."status", d."authStrategy"
    INTO connection_provider, connection_scope, connection_app, connection_tenant, connection_status, auth_strategy
    FROM "OicProviderConnection" c JOIN "OicProviderDefinition" d ON d."id" = c."providerDefinitionId" WHERE c."id" = NEW."connectionId";
  IF connection_provider IS NULL OR connection_provider <> variant_provider THEN
    RAISE EXCEPTION 'OIC runtime binding provider must match the selected provider variant';
  END IF;
  IF (connection_scope = 'APPLICATION' AND (NEW."applicationId" IS DISTINCT FROM connection_app OR NEW."scope" = 'PLATFORM')) OR
     (connection_scope = 'TENANT' AND (NEW."tenantId" IS DISTINCT FROM connection_tenant OR NEW."scope" <> 'TENANT')) THEN
    RAISE EXCEPTION 'OIC runtime binding scope exceeds provider connection scope';
  END IF;
  IF NEW."status" = 'ACTIVE' THEN
    IF connection_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active OIC runtime bindings require an active provider connection'; END IF;
    SELECT EXISTS (SELECT 1 FROM "OicProviderCredential" WHERE "connectionId" = NEW."connectionId" AND "status" = 'ACTIVE') INTO has_credential;
    IF auth_strategy <> 'NONE' AND NOT has_credential THEN RAISE EXCEPTION 'Active provider connection requires an active credential'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OicRuntimeBinding_integrity" BEFORE INSERT OR UPDATE ON "OicRuntimeBinding" FOR EACH ROW EXECUTE FUNCTION oic_validate_runtime_binding();

CREATE UNIQUE INDEX "OicRuntimeBinding_active_platform_key" ON "OicRuntimeBinding"("editionId", "environment") WHERE "status" = 'ACTIVE' AND "scope" = 'PLATFORM';
CREATE UNIQUE INDEX "OicRuntimeBinding_active_application_key" ON "OicRuntimeBinding"("editionId", "applicationId", "environment") WHERE "status" = 'ACTIVE' AND "scope" = 'APPLICATION';
CREATE UNIQUE INDEX "OicRuntimeBinding_active_tenant_key" ON "OicRuntimeBinding"("editionId", "tenantId", "environment") WHERE "status" = 'ACTIVE' AND "scope" = 'TENANT';

INSERT INTO "OicProviderDefinition" ("id", "key", "displayName", "authStrategy", "transportProfiles", "defaultEndpoint", "status", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'openai', 'OpenAI', 'BEARER', ARRAY['openai-chat-completions-v1','openai-responses-v1'], 'https://api.openai.com/v1', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'openai-compatible', 'OpenAI-compatible API', 'BEARER', ARRAY['openai-chat-completions-v1'], NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;