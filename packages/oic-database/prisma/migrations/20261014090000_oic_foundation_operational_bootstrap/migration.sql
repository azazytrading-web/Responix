CREATE TABLE "OicOperationalAdminBootstrapRecord" (
  "id" UUID NOT NULL,
  "operationId" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "applicationId" UUID NOT NULL,
  "principalId" UUID NOT NULL,
  "credentialId" UUID NOT NULL,
  "recoveryPrincipalId" UUID NOT NULL,
  "revokedCredentialCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OicOperationalAdminBootstrapRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OicOperationalAdminBootstrapRecord_operationId_key" ON "OicOperationalAdminBootstrapRecord"("operationId");
CREATE UNIQUE INDEX "OicOperationalAdminBootstrapRecord_applicationId_key" ON "OicOperationalAdminBootstrapRecord"("applicationId");
CREATE UNIQUE INDEX "OicOperationalAdminBootstrapRecord_principalId_key" ON "OicOperationalAdminBootstrapRecord"("principalId");
CREATE UNIQUE INDEX "OicOperationalAdminBootstrapRecord_credentialId_key" ON "OicOperationalAdminBootstrapRecord"("credentialId");

ALTER TABLE "OicOperationalAdminBootstrapRecord" ADD CONSTRAINT "OicOperationalAdminBootstrapRecord_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicOperationalAdminBootstrapRecord" ADD CONSTRAINT "OicOperationalAdminBootstrapRecord_principalId_applicationId_fkey"
  FOREIGN KEY ("principalId", "applicationId") REFERENCES "OicServicePrincipal"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicOperationalAdminBootstrapRecord" ADD CONSTRAINT "OicOperationalAdminBootstrapRecord_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "OicMachineCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
