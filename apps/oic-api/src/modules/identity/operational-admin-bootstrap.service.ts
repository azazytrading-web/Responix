import { createHash } from "node:crypto";
import { open, readFile, rename, rm, chmod, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ConflictException } from "@nestjs/common";
import type { OicDatabaseService, Prisma } from "@oic/database";
import { issueCredential, verifyCredential } from "./credential.crypto";
import type { IssuedCredential } from "./credential.crypto";
import { PrismaFoundationAuditWriter } from "./foundation-audit-writer";
import type { FoundationAuditWriter } from "./foundation-audit-writer";
import {
  OIC_FOUNDATION_OPERATOR_PRINCIPAL_KEY, OIC_FOUNDATION_OPERATOR_SCOPES,
  OIC_PLATFORM_ADMIN_PRINCIPAL_KEY, OIC_PLATFORM_APPLICATION_KEY
} from "./foundation-policy";

export const OIC_OPERATIONAL_BOOTSTRAP_DECISION = "OIC_FOUNDATION_NORMAL_ADMIN_BOOTSTRAP_V1";
export const OIC_OPERATIONAL_BOOTSTRAP_CONFIRMATION = "BOOTSTRAP OIC FOUNDATION OPERATOR";
export type OperationalBootstrapAuthorization = { operationId: string; reason: string; decisionRef: string };

export function parseOperationalBootstrapAuthorization(args: string[], env: NodeJS.ProcessEnv): OperationalBootstrapAuthorization {
  if (args.length !== 1 || args[0] !== "--bootstrap-operational-admin") throw new Error("Explicit operational bootstrap command is required");
  if (env.OIC_OPERATOR_BOOTSTRAP_AUTHORIZED !== "1" || env.OIC_OPERATOR_BOOTSTRAP_CONFIRMATION !== OIC_OPERATIONAL_BOOTSTRAP_CONFIRMATION) {
    throw new Error("Explicit owner-authorized operational bootstrap is required");
  }
  const operationId = env.OIC_OPERATOR_BOOTSTRAP_OPERATION_ID ?? "";
  const reason = (env.OIC_OPERATOR_BOOTSTRAP_REASON ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(operationId) || reason.length < 8 || reason.length > 256 || /oic_v1\.|postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/i.test(reason)) {
    throw new Error("A safe operation ID and bounded reason are required");
  }
  if (env.OIC_OPERATOR_BOOTSTRAP_DECISION !== OIC_OPERATIONAL_BOOTSTRAP_DECISION) throw new Error("Approved decision reference is required");
  return { operationId, reason, decisionRef: OIC_OPERATIONAL_BOOTSTRAP_DECISION };
}

export interface CredentialDelivery {
  deliver(credential: IssuedCredential): Promise<void>;
  readBack(): Promise<string>;
  removeIfOwned(): Promise<void>;
}

// The caller must supply a private, already-protected directory. No secret goes
// through stdout or command arguments. The file is published before DB commit.
export class FileCredentialDelivery implements CredentialDelivery {
  private owned = false;
  constructor(readonly path: string) {}

  async deliver(credential: IssuedCredential): Promise<void> {
    const destination = resolve(this.path);
    const parent = await stat(dirname(destination));
    if (!parent.isDirectory()) throw new Error("Protected credential directory is missing");
    const temporary = `${destination}.${process.pid}.pending`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(credential.token, "utf8");
        await handle.sync();
      } finally { await handle.close(); }
      await chmod(temporary, 0o600);
      // Exclusive destination creation makes a replay or concurrent run fail closed.
      const reservation = await open(destination, "wx", 0o600);
      await reservation.close();
      this.owned = true;
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      if (this.owned) await this.removeIfOwned();
      throw error;
    }
  }
  readBack(): Promise<string> { return readFile(this.path, "utf8"); }
  async removeIfOwned(): Promise<void> {
    if (this.owned) { await rm(this.path, { force: true }); this.owned = false; }
  }
}

export type OperationalBootstrapResult = {
  operationId: string; applicationId: string; principalId: string; credentialId: string;
  revokedRecoveryCredentials: number; replayed: boolean;
};

export class OperationalAdminBootstrapService {
  constructor(private readonly db: OicDatabaseService, private readonly audit: FoundationAuditWriter = new PrismaFoundationAuditWriter()) {}

  async bootstrap(input: OperationalBootstrapAuthorization, recoveryProof: string, delivery: CredentialDelivery): Promise<OperationalBootstrapResult> {
    if (input.decisionRef !== OIC_OPERATIONAL_BOOTSTRAP_DECISION || !/^[A-Za-z0-9._:-]{16,128}$/.test(input.operationId) ||
      input.reason.length < 8 || input.reason.length > 256) throw new Error("Approved bootstrap authorization is required");
    const requestHash = createHash("sha256").update(`${input.decisionRef}\n${input.reason}`).digest("hex");
    const issued = await issueCredential();
    let delivered = false;
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(69321, 91014)) AS held`;
        const app = await tx.oicApplication.findUnique({ where: { key: OIC_PLATFORM_APPLICATION_KEY } });
        if (!app || app.status !== "ACTIVE") throw new Error("Canonical OIC platform application must be active");
        const recovery = await tx.oicServicePrincipal.findUnique({
          where: { applicationId_key: { applicationId: app.id, key: OIC_PLATFORM_ADMIN_PRINCIPAL_KEY } }
        });
        if (!recovery || recovery.status !== "ACTIVE") throw new Error("Canonical OIC recovery principal must be active");
        const prior = await tx.oicOperationalAdminBootstrapRecord.findUnique({ where: { operationId: input.operationId } });
        if (prior) {
          if (prior.applicationId !== app.id || prior.requestHash !== requestHash) throw new ConflictException("Bootstrap operation ID conflicts with another request");
          return { operationId: prior.operationId, applicationId: app.id, principalId: prior.principalId,
            credentialId: prior.credentialId, revokedRecoveryCredentials: prior.revokedCredentialCount, replayed: true };
        }
        if (await tx.oicOperationalAdminBootstrapRecord.findUnique({ where: { applicationId: app.id } })) throw new ConflictException("Operational bootstrap is already complete");
        if (await tx.oicServicePrincipal.findUnique({ where: { applicationId_key: { applicationId: app.id, key: OIC_FOUNDATION_OPERATOR_PRINCIPAL_KEY } } })) {
          throw new ConflictException("Fixed operational administrator already exists; explicit repair is required");
        }
        const existing = await tx.oicServicePrincipal.findMany({
          where: { applicationId: app.id, status: "ACTIVE", key: { not: OIC_PLATFORM_ADMIN_PRINCIPAL_KEY } },
          include: { scopes: { where: { revokedAt: null }, select: { scope: true } } }
        });
        if (existing.some((principal) => principal.scopes.some((grant) => grant.scope === "oic:foundation:admin") ||
          OIC_FOUNDATION_OPERATOR_SCOPES.every((scope) => principal.scopes.some((grant) => grant.scope === scope)))) {
          throw new ConflictException("A normal Foundation administrator already exists");
        }
        const otherFoundationAdmin = await tx.oicPrincipalScopeGrant.findFirst({
          where: { scope: "oic:foundation:admin", revokedAt: null, principalId: { not: recovery.id }, principal: { status: "ACTIVE", application: { status: "ACTIVE" } } }
        });
        if (otherFoundationAdmin) throw new ConflictException("A normal Foundation administrator already exists");
        const match = /^oic_v1\.([A-Za-z0-9_-]{20,24})\.([A-Za-z0-9_-]{40,50})$/.exec(recoveryProof);
        if (!match) throw new Error("Recovery proof is invalid");
        const proof = await tx.oicMachineCredential.findUnique({ where: { selector: match[1]! } });
        if (!proof || proof.principalId !== recovery.id || proof.status !== "ACTIVE" || proof.revokedAt ||
          (proof.expiresAt && proof.expiresAt <= new Date()) || !(await verifyCredential(match[2]!, proof.verifier))) {
          throw new Error("Recovery proof is invalid");
        }
        const adminGrant = await tx.oicPrincipalScopeGrant.findUnique({ where: { principalId_scope: { principalId: recovery.id, scope: "oic:foundation:admin" } } });
        if (!adminGrant || adminGrant.revokedAt) throw new Error("Recovery authority is unavailable");

        await delivery.deliver(issued);
        delivered = true;
        const readBack = await delivery.readBack();
        const readMatch = /^oic_v1\.([A-Za-z0-9_-]{20,24})\.([A-Za-z0-9_-]{40,50})$/.exec(readBack);
        if (!readMatch || readMatch[1] !== issued.selector || !(await verifyCredential(readMatch[2]!, issued.verifier))) {
          throw new Error("Durable credential verification failed");
        }
        const writeAudit = (action: string, targetType: string, targetId: string, metadata: Prisma.InputJsonObject = {}) =>
          this.audit.write(tx, { actorPrincipalId: recovery.id, applicationId: app.id, tenantId: null,
            action, targetType, targetId, requestId: input.operationId, traceId: input.operationId,
            metadata: { operationId: input.operationId, decisionRef: input.decisionRef, operatorClass: "deployment-break-glass", ...metadata } });
        await writeAudit("foundation.operational-bootstrap.owner-approved", "application", app.id);
        await writeAudit("foundation.operational-bootstrap.requested", "application", app.id, { reason: input.reason });
        await writeAudit("foundation.operational-bootstrap.authorized", "application", app.id);
        await writeAudit("foundation.operational-bootstrap.recovery-used", "service-principal", recovery.id, { recoveryCredentialId: proof.id });
        const principal = await tx.oicServicePrincipal.create({ data: {
          applicationId: app.id, key: OIC_FOUNDATION_OPERATOR_PRINCIPAL_KEY, displayName: "OIC Foundation Operator"
        } });
        await writeAudit("principal.created", "service-principal", principal.id);
        for (const scope of OIC_FOUNDATION_OPERATOR_SCOPES) {
          await tx.oicPrincipalScopeGrant.create({ data: { applicationId: app.id, principalId: principal.id, scope, grantedBy: recovery.id } });
          await writeAudit("principal.scope.granted", "service-principal", principal.id, { scope });
        }
        const credential = await tx.oicMachineCredential.create({ data: { principalId: principal.id, selector: issued.selector, verifier: issued.verifier } });
        await writeAudit("credential.issued", "credential", credential.id, { principalId: principal.id });
        const revoked = await tx.oicMachineCredential.updateMany({
          where: { principalId: recovery.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() }
        });
        await writeAudit("foundation.operational-bootstrap.recovery-credentials-revoked", "service-principal", recovery.id, { count: revoked.count });
        await tx.oicOperationalAdminBootstrapRecord.create({ data: {
          operationId: input.operationId, requestHash, applicationId: app.id, principalId: principal.id,
          credentialId: credential.id, recoveryPrincipalId: recovery.id, revokedCredentialCount: revoked.count
        } });
        await writeAudit("foundation.operational-bootstrap.completed", "service-principal", principal.id, { credentialId: credential.id, revokedRecoveryCredentials: revoked.count });
        return { operationId: input.operationId, applicationId: app.id, principalId: principal.id,
          credentialId: credential.id, revokedRecoveryCredentials: revoked.count, replayed: false };
      }, { maxWait: 15_000, timeout: 30_000 });
    } catch (error) {
      if (delivered) {
        // A transaction failure can be ambiguous after a lost DB connection.
        // Keep the file unless DB truth proves that no credential committed.
        const committed = await this.db.oicOperationalAdminBootstrapRecord.findUnique({ where: { operationId: input.operationId } }).catch(() => undefined);
        if (committed === null) await delivery.removeIfOwned();
      }
      throw error;
    } finally { issued.token = ""; issued.verifier = ""; }
  }
}
