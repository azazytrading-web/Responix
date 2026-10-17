CREATE TABLE "OicEvaluationDatasetRevision" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "packId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "caseManifest" JSONB NOT NULL,
  "manifestDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationDatasetRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicEvaluationDatasetRevision_packId_revision_key" ON "OicEvaluationDatasetRevision"("packId", "revision");
CREATE UNIQUE INDEX "OicEvaluationDatasetRevision_app_tenant_digest_key" ON "OicEvaluationDatasetRevision"("applicationId", "tenantId", "manifestDigest");
CREATE UNIQUE INDEX "OicEvaluationDatasetRevision_global_digest_uidx" ON "OicEvaluationDatasetRevision"("applicationId", "manifestDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationDatasetRevision_id_applicationId_key" ON "OicEvaluationDatasetRevision"("id", "applicationId");
CREATE INDEX "OicEvaluationDatasetRevision_scope_state_idx" ON "OicEvaluationDatasetRevision"("applicationId", "tenantId", "status", "createdAt");
ALTER TABLE "OicEvaluationDatasetRevision" ADD CONSTRAINT "OicEvaluationDatasetRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationDatasetRevision" ADD CONSTRAINT "OicEvaluationDatasetRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationDatasetRevision" ADD CONSTRAINT "OicEvaluationDatasetRevision_packId_applicationId_fkey" FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OicEvaluationEnvironmentRevision" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "packId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "definition" JSONB NOT NULL,
  "definitionDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationEnvironmentRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicEvaluationEnvironmentRevision_packId_revision_key" ON "OicEvaluationEnvironmentRevision"("packId", "revision");
CREATE UNIQUE INDEX "OicEvaluationEnvironmentRevision_app_tenant_digest_key" ON "OicEvaluationEnvironmentRevision"("applicationId", "tenantId", "definitionDigest");
CREATE UNIQUE INDEX "OicEvaluationEnvironmentRevision_global_digest_uidx" ON "OicEvaluationEnvironmentRevision"("applicationId", "definitionDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationEnvironmentRevision_id_applicationId_key" ON "OicEvaluationEnvironmentRevision"("id", "applicationId");
CREATE INDEX "OicEvaluationEnvironmentRevision_scope_state_idx" ON "OicEvaluationEnvironmentRevision"("applicationId", "tenantId", "status", "createdAt");
ALTER TABLE "OicEvaluationEnvironmentRevision" ADD CONSTRAINT "OicEvaluationEnvironmentRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationEnvironmentRevision" ADD CONSTRAINT "OicEvaluationEnvironmentRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationEnvironmentRevision" ADD CONSTRAINT "OicEvaluationEnvironmentRevision_packId_applicationId_fkey" FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OicEvaluationSuiteRevision" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "tenantId" UUID,
  "packId" UUID NOT NULL,
  "datasetId" UUID NOT NULL,
  "environmentId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "plan" JSONB NOT NULL,
  "planDigest" CHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "OicEvaluationSuiteRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OicEvaluationSuiteRevision_packId_revision_key" ON "OicEvaluationSuiteRevision"("packId", "revision");
CREATE UNIQUE INDEX "OicEvaluationSuiteRevision_app_tenant_digest_key" ON "OicEvaluationSuiteRevision"("applicationId", "tenantId", "planDigest");
CREATE UNIQUE INDEX "OicEvaluationSuiteRevision_global_digest_uidx" ON "OicEvaluationSuiteRevision"("applicationId", "planDigest") WHERE "tenantId" IS NULL;
CREATE UNIQUE INDEX "OicEvaluationSuiteRevision_id_applicationId_key" ON "OicEvaluationSuiteRevision"("id", "applicationId");
CREATE INDEX "OicEvaluationSuiteRevision_scope_state_idx" ON "OicEvaluationSuiteRevision"("applicationId", "tenantId", "status", "createdAt");
ALTER TABLE "OicEvaluationSuiteRevision" ADD CONSTRAINT "OicEvaluationSuiteRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationSuiteRevision" ADD CONSTRAINT "OicEvaluationSuiteRevision_tenantId_applicationId_fkey" FOREIGN KEY ("tenantId", "applicationId") REFERENCES "OicTenant"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationSuiteRevision" ADD CONSTRAINT "OicEvaluationSuiteRevision_packId_applicationId_fkey" FOREIGN KEY ("packId", "applicationId") REFERENCES "OicEvaluationPackRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationSuiteRevision" ADD CONSTRAINT "OicEvaluationSuiteRevision_datasetId_applicationId_fkey" FOREIGN KEY ("datasetId", "applicationId") REFERENCES "OicEvaluationDatasetRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationSuiteRevision" ADD CONSTRAINT "OicEvaluationSuiteRevision_environmentId_applicationId_fkey" FOREIGN KEY ("environmentId", "applicationId") REFERENCES "OicEvaluationEnvironmentRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OicEvaluationRelease" ADD COLUMN "datasetId" UUID, ADD COLUMN "environmentId" UUID, ADD COLUMN "suiteId" UUID;
ALTER TABLE "OicEvaluationRelease" ADD CONSTRAINT "OicEvaluationRelease_datasetId_applicationId_fkey" FOREIGN KEY ("datasetId", "applicationId") REFERENCES "OicEvaluationDatasetRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationRelease" ADD CONSTRAINT "OicEvaluationRelease_environmentId_applicationId_fkey" FOREIGN KEY ("environmentId", "applicationId") REFERENCES "OicEvaluationEnvironmentRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicEvaluationRelease" ADD CONSTRAINT "OicEvaluationRelease_suiteId_applicationId_fkey" FOREIGN KEY ("suiteId", "applicationId") REFERENCES "OicEvaluationSuiteRevision"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
