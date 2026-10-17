import "reflect-metadata";
import { readFile, stat } from "node:fs/promises";
import { OicDatabaseService } from "@oic/database";
import { EvaluationArtifactVault } from "./modules/evaluation/artifact-vault";

type Arguments = { file: string; applicationId: string; tenantId: string | null; purpose: string; tier: string; actorId: string };

function parseArguments(args: string[]): Arguments {
  if (args.length !== 12) throw new Error("Expected --file, --application, --tenant, --purpose, --tier and --actor");
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!flag?.startsWith("--") || !value || values.has(flag)) throw new Error("Invalid import arguments");
    values.set(flag, value);
  }
  const file = values.get("--file");
  const applicationId = values.get("--application");
  const tenant = values.get("--tenant");
  const purpose = values.get("--purpose");
  const tier = values.get("--tier");
  const actorId = values.get("--actor");
  if (!file || !applicationId || !tenant || !purpose || !tier || !actorId || values.size !== 6) throw new Error("Invalid import arguments");
  return { file, applicationId, tenantId: tenant === "NONE" ? null : tenant, purpose, tier, actorId };
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  if (!process.env.OIC_DATABASE_URL) throw new Error("OIC database must be configured");
  const databaseUrl = new URL(process.env.OIC_DATABASE_URL);
  const database = decodeURIComponent(databaseUrl.pathname.slice(1));
  const role = decodeURIComponent(databaseUrl.username);
  if (!/^(postgresql|postgres):$/.test(databaseUrl.protocol) || !/^oic[-_][a-z0-9_-]+$/i.test(database) || !/^oic[-_][a-z0-9_-]+$/i.test(role)) throw new Error("Artifact import requires a dedicated OIC database and role");
  const file = await stat(input.file);
  if (!file.isFile() || file.size < 1 || file.size > 1024 * 1024) throw new Error("Artifact file must contain 1 to 1048576 bytes");
  const db = new OicDatabaseService();
  try {
    const actor = await db.oicServicePrincipal.findFirst({ where: { id: input.actorId, status: "ACTIVE" }, include: { scopes: { where: { revokedAt: null }, select: { scope: true } } } });
    const granted = new Set(actor?.scopes.map((item) => item.scope) ?? []);
    const admin = granted.has("oic:foundation:admin");
    if (!actor || (!admin && (actor.applicationId !== input.applicationId || !granted.has("oic:evaluation:manage")))) throw new Error("Artifact importer lacks evaluation authority");
    if ((input.tier === "PRIVATE_HOLDOUT" || input.tier === "PROTECTED_CERTIFICATION") && !admin && !granted.has("oic:evaluation:holdout:import")) throw new Error("Protected artifact import requires holdout authority");
    if (input.tenantId) {
      const tenant = await db.oicTenant.findFirst({ where: { id: input.tenantId, applicationId: input.applicationId }, select: { id: true } });
      if (!tenant) throw new Error("Artifact tenant scope is invalid");
    }
    const content = await readFile(input.file);
    try {
      const vault = new EvaluationArtifactVault(db);
      vault.assertConfigured();
      const result = await vault.store(content, { applicationId: input.applicationId, tenantId: input.tenantId, purpose: input.purpose, exposureTier: input.tier }, input.actorId);
      process.stdout.write(JSON.stringify(result) + "\n");
    } finally {
      content.fill(0);
    }
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) void main().catch(() => { process.stderr.write("Evaluation artifact import failed; details suppressed\n"); process.exitCode = 1; });
