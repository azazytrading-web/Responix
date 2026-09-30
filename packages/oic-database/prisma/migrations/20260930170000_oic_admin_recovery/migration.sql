CREATE TABLE "OicAdminRecoveryRecord" (
    "id" UUID NOT NULL,
    "operationId" VARCHAR(128) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "applicationId" UUID NOT NULL,
    "principalId" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "revokedCredentialCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OicAdminRecoveryRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OicAdminRecoveryRecord_operationId_key" ON "OicAdminRecoveryRecord"("operationId");
CREATE UNIQUE INDEX "OicAdminRecoveryRecord_credentialId_key" ON "OicAdminRecoveryRecord"("credentialId");
CREATE INDEX "OicAdminRecoveryRecord_principalId_createdAt_idx" ON "OicAdminRecoveryRecord"("principalId", "createdAt");

ALTER TABLE "OicAdminRecoveryRecord" ADD CONSTRAINT "OicAdminRecoveryRecord_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "OicApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicAdminRecoveryRecord" ADD CONSTRAINT "OicAdminRecoveryRecord_principalId_applicationId_fkey"
  FOREIGN KEY ("principalId", "applicationId") REFERENCES "OicServicePrincipal"("id", "applicationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OicAdminRecoveryRecord" ADD CONSTRAINT "OicAdminRecoveryRecord_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "OicMachineCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
