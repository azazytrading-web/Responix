import "reflect-metadata";
import { OicDatabaseService } from "@oic/database";
import { AdminRecoveryService, parseRecoveryAuthorization } from "./modules/identity/admin-recovery.service";

async function main(): Promise<void> {
  const authorization = parseRecoveryAuthorization(process.argv.slice(2), process.env);
  const url = process.env.OIC_DATABASE_URL;
  if (!url) throw new Error("OIC_DATABASE_URL is required");
  const parsed = new URL(url);
  if (!/^oic[-_][a-z0-9_-]+$/i.test(decodeURIComponent(parsed.pathname.slice(1))) ||
      !/^oic[-_][a-z0-9_-]+$/i.test(decodeURIComponent(parsed.username))) {
    throw new Error("Recovery is restricted to OIC database resources");
  }
  const db = new OicDatabaseService();
  try {
    const recovered = await new AdminRecoveryService(db).recover(authorization);
    process.stdout.write(`OIC_RECOVERY_OPERATION=${recovered.operationId}\nOIC_RECOVERY_PRINCIPAL=${recovered.principalId}\nOIC_RECOVERY_CREDENTIAL_ID=${recovered.credentialId}\nOIC_RECOVERY_REPLAYED=${recovered.replayed}\n`);
    if (recovered.credential) process.stdout.write(`OIC_RECOVERY_CREDENTIAL=${recovered.credential}\n`);
  } finally { await db.$disconnect(); }
}
if (require.main === module) void main().catch(() => { process.stderr.write("OIC protected recovery failed; details suppressed\n"); process.exitCode = 1; });
