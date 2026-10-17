import "reflect-metadata";
import { readFile, lstat } from "node:fs/promises";
import { lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { OicDatabaseService } from "@oic/database";
import {
  FileCredentialDelivery, OperationalAdminBootstrapService, parseOperationalBootstrapAuthorization
} from "./modules/identity/operational-admin-bootstrap.service";

const workspace = resolve(__dirname, "../../..");
const protectedDirectory = resolve(workspace, ".dev-runtime", "foundation-bootstrap");
export const operationalCredentialDestination = resolve(protectedDirectory, "oic-foundation-operator.credential");
export const recoveryProofSource = resolve(protectedDirectory, "platform-admin.recovery.credential");

function assertProtectedAcl(path: string, requireProtected: boolean): void {
  if (process.platform === "win32") {
    const script = '$p=$env:OIC_BOOTSTRAP_PRIVATE_TARGET; $a=Get-Acl -LiteralPath $p; if ($env:OIC_BOOTSTRAP_REQUIRE_PROTECTED -eq "1" -and -not $a.AreAccessRulesProtected) { exit 3 }; $self=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $allowed=@($self,"S-1-5-18","S-1-5-32-544"); foreach($r in $a.Access) { if ($r.AccessControlType -eq "Allow") { $sid=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if ($allowed -notcontains $sid) { exit 4 } } }; exit 0';
    const check = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true, timeout: 10_000, stdio: "ignore", env: {
        ...process.env, OIC_BOOTSTRAP_PRIVATE_TARGET: path, OIC_BOOTSTRAP_REQUIRE_PROTECTED: requireProtected ? "1" : "0"
      }
    });
    if (check.status !== 0) throw new Error("Protected local bootstrap file has unsafe ACLs");
  } else {
    const file = lstatSync(path);
    if (file.isSymbolicLink() || (file.mode & 0o077) !== 0) throw new Error("Protected local bootstrap file has unsafe permissions");
  }
}

function assertProtectedDirectory(mode: number): void {
  if (process.platform === "win32") assertProtectedAcl(protectedDirectory, true);
  else if ((mode & 0o077) !== 0) throw new Error("Protected local bootstrap directory has unsafe permissions");
}

export function localDatabaseUrl(): string {
  const configured = process.env.OIC_DATABASE_URL;
  const localEnv = configured ? "" : readFileSync(resolve(workspace, ".env.oic.local"), "utf8");
  const url = configured ?? /^OIC_DATABASE_URL=(.*)$/m.exec(localEnv)?.[1];
  if (!url) throw new Error("A dedicated local OIC database is required");
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  const role = decodeURIComponent(parsed.username);
  if ((parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") || parsed.hostname !== "127.0.0.1" ||
    database !== "oic_development" || !/^oic[-_][a-z0-9_-]+$/i.test(role) ||
    (parsed.searchParams.has("schema") && parsed.searchParams.get("schema") !== "public")) {
    throw new Error("Operational bootstrap is restricted to the dedicated local OIC development database");
  }
  return url;
}

async function main(): Promise<void> {
  const authorization = parseOperationalBootstrapAuthorization(process.argv.slice(2), process.env);
  const proofFile = await lstat(recoveryProofSource);
  const destinationDir = await lstat(protectedDirectory);
  if (!proofFile.isFile() || proofFile.isSymbolicLink() || !destinationDir.isDirectory() || destinationDir.isSymbolicLink()) {
    throw new Error("Protected local bootstrap files are unavailable");
  }
  assertProtectedDirectory(destinationDir.mode);
  assertProtectedAcl(recoveryProofSource, false);
  const recoveryProof = (await readFile(recoveryProofSource, "utf8")).trim();
  process.env.OIC_DATABASE_URL = localDatabaseUrl();
  const db = new OicDatabaseService();
  try {
    const delivery = new FileCredentialDelivery(operationalCredentialDestination);
    const result = await new OperationalAdminBootstrapService(db).bootstrap(authorization, recoveryProof, {
      deliver: (credential) => delivery.deliver(credential),
      readBack: async () => { assertProtectedAcl(operationalCredentialDestination, false); return delivery.readBack(); },
      removeIfOwned: () => delivery.removeIfOwned()
    });
    process.stdout.write(`OIC_OPERATIONAL_BOOTSTRAP=${result.operationId}\nOIC_OPERATIONAL_PRINCIPAL=${result.principalId}\nOIC_OPERATIONAL_CREDENTIAL_ID=${result.credentialId}\nOIC_OPERATIONAL_REPLAYED=${result.replayed}\n`);
  } finally { await db.$disconnect(); }
}

if (require.main === module) void main().catch(() => {
  process.stderr.write("OIC protected operational bootstrap failed; details suppressed\n");
  process.exitCode = 1;
});
