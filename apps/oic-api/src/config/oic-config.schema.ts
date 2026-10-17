import { z } from "zod";

function isOicDatabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    const role = decodeURIComponent(parsed.username);
    return (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") &&
      /^oic[-_][a-z0-9_-]+$/i.test(database) &&
      /^oic[-_][a-z0-9_-]+$/i.test(role);
  } catch {
    return false;
  }
}

const machineCredential = z.string().regex(/^oic_v1\.[A-Za-z0-9_-]{20,24}\.[A-Za-z0-9_-]{40,50}$/);

export const oicEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: z.enum(["true", "false"]).default("false"),
  OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY: z.string().optional().refine(
    (value) => value === undefined || /^[a-f0-9]{64}$/i.test(value) || /^[A-Za-z0-9+/]{43}=$/.test(value),
    { message: "OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY must encode 32 bytes as hex or base64" }
  ),
  OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY: z.string().optional().refine(
    (value) => value === undefined || /^[a-f0-9]{64}$/i.test(value) || /^[A-Za-z0-9+/]{43}=$/.test(value),
    { message: "Legacy evaluation artifact key must encode 32 bytes as hex or base64" }
  ),
  OIC_EVALUATION_ARTIFACT_KEY_V2: z.string().optional().refine(
    (value) => value === undefined || /^[a-f0-9]{64}$/i.test(value) || /^[A-Za-z0-9+/]{43}=$/.test(value),
    { message: "Active evaluation artifact key must encode 32 bytes as hex or base64" }
  ),
  OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION: z.enum(["2"]).optional(),
  OIC7_EVALUATION_RUNNER_CREDENTIAL: machineCredential.optional(),
  OIC7_EVALUATION_PUBLISHER_CREDENTIAL: machineCredential.optional(),
  OIC_EVALUATOR_ENABLED: z.enum(["true", "false"]).default("false"),
  OIC_EVALUATION_WORKER_ENABLED: z.enum(["true", "false"]).default("false"),
  OIC_ADMISSION_MODE: z.enum(["SHADOW", "ENFORCE"]).default("SHADOW"),
  OIC_EVALUATOR_IMAGE_ALLOWLIST: z.string().default("").refine(
    (value) => value.split(",").map((item) => item.trim()).filter(Boolean).every((image) => /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/i.test(image)),
    { message: "OIC_EVALUATOR_IMAGE_ALLOWLIST must contain immutable image digest references" }
  ),
  OIC_EVALUATOR_DISPOSABLE_ROOT: z.string().default(""),
  OIC_EVALUATOR_MIN_FREE_BYTES: z.coerce.number().int().min(64 * 1024 * 1024).max(100 * 1024 * 1024 * 1024).default(1024 * 1024 * 1024),
  OIC_EVALUATOR_WORKSPACE_BYTES: z.coerce.number().int().min(8 * 1024 * 1024).max(1024 * 1024 * 1024).default(64 * 1024 * 1024),
  OIC_EVALUATOR_TMP_BYTES: z.coerce.number().int().min(4 * 1024 * 1024).max(128 * 1024 * 1024).default(16 * 1024 * 1024),
  OIC_EVALUATOR_SHM_BYTES: z.coerce.number().int().min(4 * 1024 * 1024).max(128 * 1024 * 1024).default(16 * 1024 * 1024),
  OIC_EVALUATOR_MEMORY_BYTES: z.coerce.number().int().min(32 * 1024 * 1024).max(1024 * 1024 * 1024).default(256 * 1024 * 1024),
  OIC_EVALUATOR_CPU_CORES: z.coerce.number().min(0.1).max(2).default(0.5),
  OIC_EVALUATOR_PID_LIMIT: z.coerce.number().int().min(8).max(256).default(32),
  OIC_EVALUATOR_TIMEOUT_MS: z.coerce.number().int().min(100).max(300_000).default(30_000),
  OIC_EVALUATOR_OUTPUT_BYTES: z.coerce.number().int().min(1024).max(1_000_000).default(65_536),
  OIC_EVALUATOR_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
  OIC_EVALUATOR_PROVIDER_MIN_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
  OIC_HOST: z.string().min(1).default("0.0.0.0"),
  OIC_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  OIC_AUTH_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(10000).default(120),
  OIC_HTTP_MAX_BODY_BYTES: z.coerce.number().int().min(32768).max(5_000_000).default(1_000_000),
  OIC_RUNTIME_MAX_MESSAGES: z.coerce.number().int().min(1).max(1000).default(100),
  OIC_RUNTIME_MAX_INPUT_CHARACTERS: z.coerce.number().int().min(1024).max(1_000_000).default(200_000),
  OIC_RUNTIME_MAX_OUTPUT_UNITS: z.coerce.number().int().min(1).max(65_536).default(16_384),
  OIC_RUNTIME_MAX_EXECUTION_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
  OIC_RUNTIME_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).max(604_800).default(86_400),
  OIC_DATABASE_URL: z.string().url().refine(isOicDatabaseUrl, {
    message: "OIC_DATABASE_URL must identify a dedicated OIC database and role"
  }),
  OIC_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
}).superRefine((environment, context) => {
  const artifactWriteConfigured = environment.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION !== undefined || environment.OIC_EVALUATION_ARTIFACT_KEY_V2 !== undefined;
  if ((artifactWriteConfigured || environment.OIC_EVALUATION_WORKER_ENABLED === "true" || environment.OIC_EVALUATOR_ENABLED === "true") &&
      (environment.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION !== "2" || !environment.OIC_EVALUATION_ARTIFACT_KEY_V2)) {
    context.addIssue({ code: "custom", path: ["OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION"], message: "Evaluation artifact writes require active key version 2" });
  }
  if (environment.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY && environment.OIC_EVALUATION_ARTIFACT_KEY_V2) {
    const decode = (value: string) => Buffer.from(value, /^[a-f0-9]{64}$/i.test(value) ? "hex" : "base64");
    if (decode(environment.OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY).equals(decode(environment.OIC_EVALUATION_ARTIFACT_KEY_V2))) {
      context.addIssue({ code: "custom", path: ["OIC_EVALUATION_ARTIFACT_KEY_V2"], message: "Active evaluation artifact key must differ from the compromised legacy key" });
    }
  }
  const runnerSet = environment.OIC7_EVALUATION_RUNNER_CREDENTIAL !== undefined;
  const publisherSet = environment.OIC7_EVALUATION_PUBLISHER_CREDENTIAL !== undefined;
  if (runnerSet !== publisherSet) {
    context.addIssue({ code: "custom", path: [runnerSet ? "OIC7_EVALUATION_PUBLISHER_CREDENTIAL" : "OIC7_EVALUATION_RUNNER_CREDENTIAL"], message: "Both OIC-7 evaluation credentials must be configured together" });
  }
  if ((runnerSet || publisherSet) && environment.NODE_ENV !== "development") {
    context.addIssue({ code: "custom", path: ["OIC7_EVALUATION_RUNNER_CREDENTIAL"], message: "OIC-7 local evaluation credentials are allowed only in development" });
  }
});

export type OicEnvironment = z.infer<typeof oicEnvironmentSchema>;

export function validateOicEnvironment(environment: Record<string, unknown>): OicEnvironment {
  const parsed = oicEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "environment");
    throw new Error(`Invalid OIC configuration: ${fields.join(", ")}`);
  }
  return parsed.data;
}
