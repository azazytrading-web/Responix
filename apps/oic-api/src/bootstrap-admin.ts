import "reflect-metadata";
import { OicDatabaseService } from "@oic/database";
import { PrismaFoundationAuditWriter } from "./modules/identity/foundation-audit-writer";
import type { FoundationAuditWriter } from "./modules/identity/foundation-audit-writer";
import {
  OIC_FOUNDATION_ADMIN_SCOPES, OIC_PLATFORM_ADMIN_NAME, OIC_PLATFORM_ADMIN_PRINCIPAL_KEY,
  OIC_PLATFORM_APPLICATION_KEY, OIC_PLATFORM_APPLICATION_NAME
} from "./modules/identity/foundation-policy";
import { issueCredential } from "./modules/identity/credential.crypto";

export function assertBootstrapAuthorized(args: string[], env: NodeJS.ProcessEnv): void {
  if (args.length !== 1 || args[0] !== "--authorize-bootstrap" || env.OIC_BOOTSTRAP_AUTHORIZED !== "true") {
    throw new Error("Protected initial bootstrap requires explicit operator authorization");
  }
}
export async function initializePlatformAdmin(
  db: OicDatabaseService,
  auditWriter: FoundationAuditWriter = new PrismaFoundationAuditWriter()
): Promise<{ principalId: string; credential: string }> {
  const issued = await issueCredential();
  try {
    const result = await db.$transaction(async (tx) => {
      const existingApplication = await tx.oicApplication.findUnique({ where: { key: OIC_PLATFORM_APPLICATION_KEY } });
      const existingAdmins = await tx.oicPrincipalScopeGrant.findMany({
        where: { scope: "oic:foundation:admin", revokedAt: null }, select: { id: true }, take: 1
      });
      if (existingApplication || existingAdmins.length) {
        throw new Error("Platform bootstrap state already exists; use the protected recovery command");
      }
      const application = await tx.oicApplication.create({ data: { key: OIC_PLATFORM_APPLICATION_KEY, displayName: OIC_PLATFORM_APPLICATION_NAME } });
      const principal = await tx.oicServicePrincipal.create({
        data: { applicationId: application.id, key: OIC_PLATFORM_ADMIN_PRINCIPAL_KEY, displayName: OIC_PLATFORM_ADMIN_NAME }
      });
      await tx.oicPrincipalScopeGrant.createMany({
        data: OIC_FOUNDATION_ADMIN_SCOPES.map((scope) => ({ applicationId: application.id, principalId: principal.id, scope, grantedBy: null }))
      });
      const credential = await tx.oicMachineCredential.create({ data: { principalId: principal.id, selector: issued.selector, verifier: issued.verifier } });
      await auditWriter.write(tx, {
        actorPrincipalId: null, applicationId: application.id, tenantId: null,
        action: "foundation.bootstrap.completed", targetType: "service-principal", targetId: principal.id,
        metadata: { credentialId: credential.id, operatorClass: "deployment-bootstrap" }
      });
      return { principalId: principal.id };
    });
    return { principalId: result.principalId, credential: issued.token };
  } catch (error) {
    issued.token = ""; issued.verifier = "";
    throw error;
  }
}

async function main(): Promise<void> {
  assertBootstrapAuthorized(process.argv.slice(2), process.env);
  const url = process.env.OIC_DATABASE_URL;
  if (!url) throw new Error("OIC_DATABASE_URL is required");
  const parsed = new URL(url);
  if (!/^oic[-_][a-z0-9_-]+$/i.test(decodeURIComponent(parsed.pathname.slice(1))) ||
      !/^oic[-_][a-z0-9_-]+$/i.test(decodeURIComponent(parsed.username))) {
    throw new Error("Bootstrap is restricted to OIC database resources");
  }
  const db = new OicDatabaseService();
  try {
    const result = await initializePlatformAdmin(db);
    process.stdout.write(`OIC_FOUNDATION_ADMIN=${result.principalId}\nOIC_BOOTSTRAP_CREDENTIAL=${result.credential}\n`);
  } finally { await db.$disconnect(); }
}
if (require.main === module) void main().catch(() => { process.stderr.write("OIC protected bootstrap failed; details suppressed\n"); process.exitCode = 1; });
