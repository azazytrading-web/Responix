/* global process, URL */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createChildEnvironment,
  loadPlatformEnvironments,
  resolvePlatformEnvPaths,
  resolveWorkspaceRoot,
  selectServicesForTarget
} from "./platform-env.mjs";

function withEnvFiles(files, run) {
  const root = mkdtempSync(join(tmpdir(), "oic-platform-env-"));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const path = join(root, name);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, contents, { encoding: "utf8", mode: 0o600 });
    }
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("loads canonical API and Console private files with intended service boundaries", () => {
  withEnvFiles({
    ".env": "SHARED_SETTING=shared-value\nOVERLAY_SETTING=shared-value\n",
    ".env.oic.local": "OIC_DATABASE_URL=postgresql://oic_test:synthetic@127.0.0.1:5432/oic_test\nOVERLAY_SETTING=oic-value\nOIC_ONLY=private-value\nOIC7_EVALUATION_RUNNER_CREDENTIAL=runner-private\nOIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY=provider-private\n",
    "apps/oic-console/.env.local": "OIC_CONSOLE_OPERATOR_PASSWORD=operator-private\nOIC_CONSOLE_SESSION_SECRET=session-private\nOIC_CONSOLE_API_CREDENTIAL=admin-private\nOIC_CONSOLE_RUNTIME_CREDENTIAL=runtime-private\nOIC_CONSOLE_RUNTIME_PRINCIPAL_ID=runtime-id\nOVERLAY_SETTING=console-value\n"
  }, (root) => {
    const { sharedEnvironment, oicEnvironment, consoleEnvironment } = loadPlatformEnvironments({ root, inheritedEnv: {} });
    assert.equal(sharedEnvironment.SHARED_SETTING, "shared-value");
    assert.equal(sharedEnvironment.OVERLAY_SETTING, "shared-value");
    assert.equal(oicEnvironment.OVERLAY_SETTING, "oic-value");
    assert.equal(oicEnvironment.OIC_ONLY, "private-value");
    assert.equal(oicEnvironment.OIC_DATABASE_URL, "postgresql://oic_test:synthetic@127.0.0.1:5432/oic_test");
    assert.equal(consoleEnvironment.OIC_CONSOLE_OPERATOR_PASSWORD, "operator-private");
    assert.equal(consoleEnvironment.OIC_CONSOLE_SESSION_SECRET, "session-private");
    assert.equal(consoleEnvironment.OIC_CONSOLE_API_CREDENTIAL, "admin-private");
    assert.equal(consoleEnvironment.OIC_CONSOLE_RUNTIME_CREDENTIAL, "runtime-private");
    assert.equal(consoleEnvironment.OIC_CONSOLE_RUNTIME_PRINCIPAL_ID, "runtime-id");
    assert.equal(consoleEnvironment.OIC7_EVALUATION_RUNNER_CREDENTIAL, "runner-private");
    assert.equal(consoleEnvironment.OVERLAY_SETTING, "console-value");
    assert.equal(consoleEnvironment.OIC_DATABASE_URL, undefined);
    assert.equal(consoleEnvironment.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY, undefined);
    assert.equal(consoleEnvironment.OIC_ONLY, undefined);
  });
});

test("preserves inherited process environment and gives it precedence over local files", () => {
  withEnvFiles({
    ".env": "INHERITED_VALUE=file-value\nSHARED_ONLY=shared\n",
    ".env.oic.local": "OIC_ONLY=oic\nOIC7_EVALUATION_RUNNER_CREDENTIAL=runner-file\n",
    "apps/oic-console/.env.local": "OIC_CONSOLE_OPERATOR_PASSWORD=console-file\nINHERITED_VALUE=console-file\n"
  }, (root) => {
    const inheritedEnv = { INHERITED_VALUE: "process-value", KEEP_EXISTING: "preserved" };
    const { sharedEnvironment, oicEnvironment, consoleEnvironment } = loadPlatformEnvironments({ root, inheritedEnv });
    assert.equal(sharedEnvironment.INHERITED_VALUE, "process-value");
    assert.equal(oicEnvironment.INHERITED_VALUE, "process-value");
    assert.equal(oicEnvironment.KEEP_EXISTING, "preserved");
    assert.equal(oicEnvironment.SHARED_ONLY, "shared");
    assert.equal(consoleEnvironment.OIC_CONSOLE_OPERATOR_PASSWORD, "console-file");
    assert.equal(consoleEnvironment.INHERITED_VALUE, "process-value");
    assert.equal(consoleEnvironment.OIC7_EVALUATION_RUNNER_CREDENTIAL, "runner-file");
    assert.equal(consoleEnvironment.KEEP_EXISTING, "preserved");
  });
});

test("passes required private values to OIC API and Console children without logging them", () => {
  const protectedSentinel = "synthetic-oic-secret-must-not-be-logged";
  withEnvFiles({
    ".env.oic.local": `OIC_DATABASE_URL=postgresql://oic_test:${protectedSentinel}@127.0.0.1:5432/oic_test\nOIC7_EVALUATION_RUNNER_CREDENTIAL=${protectedSentinel}\nOIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY=${protectedSentinel}\n`,
    "apps/oic-console/.env.local": `OIC_CONSOLE_SESSION_SECRET=${protectedSentinel}\nOIC_CONSOLE_OPERATOR_PASSWORD=${protectedSentinel}\n`
  }, (root) => {
    const output = [];
    const originalWrite = process.stdout.write;
    let apiEnv;
    let consoleEnv;
    let unrelatedEnv;
    try {
      process.stdout.write = (chunk) => { output.push(String(chunk)); return true; };
      const { sharedEnvironment, oicEnvironment, consoleEnvironment } = loadPlatformEnvironments({ root, inheritedEnv: {} });
      apiEnv = createChildEnvironment({ useOicEnvironment: true, sharedEnvironment, oicEnvironment });
      consoleEnv = createChildEnvironment({ useConsoleEnvironment: true, sharedEnvironment, oicEnvironment, consoleEnvironment });
      unrelatedEnv = createChildEnvironment({ sharedEnvironment, oicEnvironment, consoleEnvironment });
    } finally {
      process.stdout.write = originalWrite;
    }
    assert.equal(apiEnv.OIC_DATABASE_URL.includes(protectedSentinel), true);
    assert.equal(consoleEnv.OIC_CONSOLE_SESSION_SECRET, protectedSentinel);
    assert.equal(consoleEnv.OIC7_EVALUATION_RUNNER_CREDENTIAL, protectedSentinel);
    assert.equal(consoleEnv.OIC_DATABASE_URL, undefined);
    assert.equal(consoleEnv.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY, undefined);
    assert.equal(unrelatedEnv.OIC_CONSOLE_SESSION_SECRET, undefined);
    assert.equal(unrelatedEnv.OIC_DATABASE_URL, undefined);
    assert.equal(output.join("").includes(protectedSentinel), false);
  });
});

test("fails safely when the required private OIC env source cannot be read", () => {
  const secret = "do-not-include-this-synthetic-secret";
  withEnvFiles({ ".env": `SAFE_TEST_VALUE=${secret}\n` }, (root) => {
    assert.throws(
      () => loadPlatformEnvironments({ root, inheritedEnv: {} }),
      (error) => {
        assert.equal(error.message, "OIC local configuration unavailable: expected authorized local env source could not be loaded.");
        assert.equal(error.message.includes(secret), false);
        return true;
      }
    );
  });
});

test("fails safely when Console private env is missing or unreadable", () => {
  withEnvFiles({ ".env.oic.local": "API_PRIVATE=value\n" }, (root) => {
    assert.throws(
      () => loadPlatformEnvironments({ root, inheritedEnv: {} }),
      (error) => error.message === "OIC Console local configuration unavailable: expected authorized Console env source could not be loaded."
    );
  });
  withEnvFiles({
    ".env.oic.local": "API_PRIVATE=value\n",
    "apps/oic-console/.env.local": "OIC_CONSOLE_OPERATOR_PASSWORD=synthetic-secret\n"
  }, (root) => {
    const deniedRead = (path) => {
      if (path.endsWith(join("apps", "oic-console", ".env.local"))) {
        const error = new Error("denied");
        error.code = "EACCES";
        throw error;
      }
      return readFileSync(path);
    };
    assert.throws(
      () => loadPlatformEnvironments({ root, inheritedEnv: {}, readFile: deniedRead }),
      (error) => error.message === "OIC Console local configuration unavailable: expected authorized Console env source could not be loaded." && !error.message.includes("synthetic-secret")
    );
  });
});

test("resolves the workspace root from the launcher location, independent of shell cwd", () => {
  const expected = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const originalCwd = process.cwd();
  const elsewhere = mkdtempSync(join(tmpdir(), "oic-launch-cwd-"));
  try {
    process.chdir(elsewhere);
    assert.equal(resolveWorkspaceRoot(new URL("./platform-dev.mjs", import.meta.url).href), expected);
  } finally {
    process.chdir(originalCwd);
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

test("uses Windows root-relative env paths", { skip: process.platform !== "win32" }, () => {
  const root = win32.resolve("G:\\Trading\\OIC");
  const paths = resolvePlatformEnvPaths(root);
  assert.equal(paths.shared, win32.join(root, ".env"));
  assert.equal(paths.oic, win32.join(root, ".env.oic.local"));
  assert.equal(paths.console, win32.join(root, "apps/oic-console/.env.local"));
  assert.equal(win32.isAbsolute(paths.oic), true);
  assert.equal(win32.isAbsolute(paths.console), true);
});

test("target=all includes both OIC services and target-specific launches stay scoped", () => {
  const services = [
    { label: "OIC API", group: "backend" },
    { label: "Responix API", group: "backend" },
    { label: "Platform Portal", group: "dashboard" },
    { label: "Responix", group: "dashboard" },
    { label: "OIC Console", group: "dashboard" }
  ];
  assert.deepEqual(selectServicesForTarget("all", services).map(({ label }) => label), services.map(({ label }) => label));
  assert.deepEqual(selectServicesForTarget("backend", services).map(({ label }) => label), ["OIC API", "Responix API"]);
  assert.deepEqual(selectServicesForTarget("dashboard", services).map(({ label }) => label), ["Platform Portal", "Responix", "OIC Console"]);
  assert.deepEqual(selectServicesForTarget("oic", services).map(({ label }) => label), []);
  const targetedOic = services.map((service) => service.label.startsWith("OIC") ? { ...service, targets: ["oic"] } : service);
  assert.deepEqual(selectServicesForTarget("oic", targetedOic).map(({ label }) => label), ["OIC API", "OIC Console"]);
});

test("canonical launcher assigns API and Console environment contracts to runtime and build", () => {
  const launcher = readFileSync(new URL("./platform-dev.mjs", import.meta.url), "utf8");
  assert.match(launcher, /label: "OIC API",\s*useOicEnvironment: true/);
  assert.match(launcher, /label: "OIC Console",\s*useConsoleEnvironment: true/);
  assert.equal((launcher.match(/targets: \["oic"\]/g) ?? []).length, 4);
  assert.match(launcher, /useConsoleEnvironment: service\.useConsoleEnvironment/);
  assert.match(launcher, /useConsoleEnvironment \? consoleEnvironment : process\.env/);
});
