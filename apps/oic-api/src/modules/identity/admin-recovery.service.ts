import { ConflictException, Injectable } from "@nestjs/common";
import { OicDatabaseService, Prisma } from "@oic/database";
import { createHash } from "node:crypto";
import { FoundationAuditWriter, PrismaFoundationAuditWriter } from "./foundation-audit-writer";
import { issueCredential } from "./credential.crypto";
import { OIC_FOUNDATION_ADMIN_SCOPES, OIC_PLATFORM_ADMIN_PRINCIPAL_KEY, OIC_PLATFORM_APPLICATION_KEY } from "./foundation-policy";

export const OIC_RECOVERY_CONFIRMATION = "RECOVER OIC PLATFORM ADMIN";
export type RecoveryAuthorization = { operationId: string; reason: string };

export function parseRecoveryAuthorization(args: string[], env: NodeJS.ProcessEnv): RecoveryAuthorization {
  if (args.length !== 1 || args[0] !== "--recover-admin") throw new Error("Explicit recovery command is required");
  if (env.OIC_OPERATOR_RECOVERY_AUTHORIZED !== "1") throw new Error("Explicit operator recovery authorization is required");
  if (env.OIC_OPERATOR_RECOVERY_CONFIRMATION !== OIC_RECOVERY_CONFIRMATION) throw new Error("Recovery confirmation phrase does not match");
  const operationId = env.OIC_OPERATOR_RECOVERY_OPERATION_ID ?? "";
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(operationId)) throw new Error("A valid recovery operation ID is required");
  const reason = (env.OIC_OPERATOR_RECOVERY_REASON ?? "").trim();
  if (reason.length < 8 || reason.length > 256 || /oic_v1\.|postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/i.test(reason)) {
    throw new Error("A safe recovery reason of 8 to 256 characters is required");
  }
  return { operationId, reason };
}

export type RecoveryResult = {
  operationId: string; principalId: string; credentialId: string; credential: string | null;
  revokedCredentialCount: number; replayed: boolean;
};

@Injectable()
export class AdminRecoveryService {
  constructor(
    private readonly db: OicDatabaseService,
    private readonly auditWriter: FoundationAuditWriter = new PrismaFoundationAuditWriter()
  ) {}

  async recover(input: RecoveryAuthorization): Promise<RecoveryResult> {
    const requestHash = createHash("sha256").update(input.reason).digest("hex");
    const issued = await issueCredential();
    try {
      const perform = () => this.db.$transaction(async (tx) => {
        const application = await tx.oicApplication.findUnique({ where: { key: OIC_PLATFORM_APPLICATION_KEY } });
        if (!application) throw new Error("Canonical OIC platform recovery target is missing");
        if (application.status === "ARCHIVED") throw new Error("Terminal OIC platform identity cannot be recovered");
        const principal = await tx.oicServicePrincipal.findUnique({
          where: { applicationId_key: { applicationId: application.id, key: OIC_PLATFORM_ADMIN_PRINCIPAL_KEY } }
        });
        if (!principal) throw new Error("Canonical OIC platform recovery target is missing");
        if (principal.status === "ARCHIVED") throw new Error("Terminal OIC administrator identity cannot be recovered");

        const prior = await tx.oicAdminRecoveryRecord.findUnique({ where: { operationId: input.operationId } });
        if (prior) {
          if (prior.requestHash !== requestHash || prior.principalId !== principal.id) {
            throw new ConflictException("Recovery operation ID conflicts with another request");
          }
          return {
            operationId: prior.operationId, principalId: principal.id, credentialId: prior.credentialId,
            credential: null, revokedCredentialCount: prior.revokedCredentialCount, replayed: true
          };
        }

        const now = new Date();
        if (application.status !== "ACTIVE") await tx.oicApplication.update({ where: { id: application.id }, data: { status: "ACTIVE" } });
        if (principal.status !== "ACTIVE") await tx.oicServicePrincipal.update({ where: { id: principal.id }, data: { status: "ACTIVE" } });
        const revoked = await tx.oicMachineCredential.updateMany({
          where: { principalId: principal.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now }
        });
        for (const scope of OIC_FOUNDATION_ADMIN_SCOPES) {
          await tx.oicPrincipalScopeGrant.upsert({
            where: { principalId_scope: { principalId: principal.id, scope } },
            create: { applicationId: application.id, principalId: principal.id, scope, grantedBy: null },
            update: { revokedAt: null, grantedBy: null, grantedAt: now }
          });
        }
        await tx.oicPrincipalScopeGrant.updateMany({
          where: { principalId: principal.id, revokedAt: null, scope: { notIn: [...OIC_FOUNDATION_ADMIN_SCOPES] } },
          data: { revokedAt: now }
        });
        const credential = await tx.oicMachineCredential.create({ data: { principalId: principal.id, selector: issued.selector, verifier: issued.verifier } });
        await tx.oicAdminRecoveryRecord.create({
          data: {
            operationId: input.operationId, requestHash, applicationId: application.id, principalId: principal.id,
            credentialId: credential.id, revokedCredentialCount: revoked.count
          }
        });
        await this.auditWriter.write(tx, {
          actorPrincipalId: null, applicationId: application.id, tenantId: null,
          action: "foundation.admin.recovered", targetType: "service-principal", targetId: principal.id,
          requestId: input.operationId, traceId: input.operationId,
          metadata: {
            operationId: input.operationId, applicationId: application.id, principalId: principal.id,
            operatorClass: "deployment-break-glass", reason: input.reason, revokedCredentialCount: revoked.count
          } satisfies Prisma.InputJsonObject
        });
        return {
          operationId: input.operationId, principalId: principal.id, credentialId: credential.id,
          credential: issued.token, revokedCredentialCount: revoked.count, replayed: false
        };
      });
      try { return await perform(); }
      catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const prior = await this.db.oicAdminRecoveryRecord.findUnique({ where: { operationId: input.operationId } });
        if (!prior) throw error;
        if (prior.requestHash !== requestHash) throw new ConflictException("Recovery operation ID conflicts with another request");
        return {
          operationId: prior.operationId, principalId: prior.principalId, credentialId: prior.credentialId,
          credential: null, revokedCredentialCount: prior.revokedCredentialCount, replayed: true
        };
      }
    } finally { issued.token = ""; issued.verifier = ""; }
  }
}
