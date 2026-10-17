/* global process, URL */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OIC_ENV_FILE = ".env.oic.local";
const SHARED_ENV_FILE = ".env";
const CONSOLE_ENV_FILE = "apps/oic-console/.env.local";
const CONSOLE_INHERITED_OIC_KEYS = ["OIC_API_URL", "OIC7_EVALUATION_RUNNER_CREDENTIAL"];
const apiRequire = createRequire(new URL("../apps/oic-api/package.json", import.meta.url));
const configRequire = createRequire(apiRequire.resolve("@nestjs/config"));
const { parse } = configRequire("dotenv");

export function resolveWorkspaceRoot(moduleUrl) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

export function resolvePlatformEnvPaths(root) {
  return {
    shared: resolve(root, SHARED_ENV_FILE),
    oic: resolve(root, OIC_ENV_FILE),
    console: resolve(root, CONSOLE_ENV_FILE)
  };
}

function readEnvFile(path, readFile, { required, safeFailure }) {
  try {
    return parse(readFile(path));
  } catch (error) {
    if (!required && error?.code === "ENOENT") return {};
    throw new Error(safeFailure);
  }
}

export function loadPlatformEnvironments({ root, inheritedEnv = process.env, readFile = readFileSync }) {
  const paths = resolvePlatformEnvPaths(root);
  const sharedFile = readEnvFile(paths.shared, readFile, {
    required: false,
    safeFailure: "Platform local configuration unavailable: expected shared local env source could not be loaded."
  });
  const oicFile = readEnvFile(paths.oic, readFile, {
    required: true,
    safeFailure: "OIC local configuration unavailable: expected authorized local env source could not be loaded."
  });
  const consoleFile = readEnvFile(paths.console, readFile, {
    required: true,
    safeFailure: "OIC Console local configuration unavailable: expected authorized Console env source could not be loaded."
  });

  // Existing process variables take precedence. The API receives its OIC
  // settings; Console receives only the shared API URL and OIC-7 runner
  // credential it uses, plus its own package-local server settings.
  const sharedEnvironment = { ...sharedFile, ...inheritedEnv };
  const oicEnvironment = { ...sharedFile, ...oicFile, ...inheritedEnv };
  const consoleOicSettings = Object.fromEntries(
    CONSOLE_INHERITED_OIC_KEYS
      .filter((key) => Object.hasOwn(oicFile, key))
      .map((key) => [key, oicFile[key]])
  );
  const consoleEnvironment = { ...sharedFile, ...consoleOicSettings, ...consoleFile, ...inheritedEnv };
  return { sharedEnvironment, oicEnvironment, consoleEnvironment };
}

export function createChildEnvironment({
  useOicEnvironment = false,
  useConsoleEnvironment = false,
  sharedEnvironment,
  oicEnvironment,
  consoleEnvironment,
  serviceEnvironment = {}
}) {
  const baseEnvironment = useConsoleEnvironment
    ? consoleEnvironment
    : useOicEnvironment
      ? oicEnvironment
      : sharedEnvironment;
  return {
    ...baseEnvironment,
    ...serviceEnvironment
  };
}

export function selectServicesForTarget(target, services) {
  return services.filter((service) => target === "all" || service.group === target || service.targets?.includes(target));
}
