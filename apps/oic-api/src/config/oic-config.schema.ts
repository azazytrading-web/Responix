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

export const oicEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OIC_ENABLE_LOCAL_PROVIDER_FIXTURE: z.enum(["true", "false"]).default("false"),
  OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY: z.string().optional().refine(
    (value) => value === undefined || /^[a-f0-9]{64}$/i.test(value) || /^[A-Za-z0-9+/]{43}=$/.test(value),
    { message: "OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY must encode 32 bytes as hex or base64" }
  ),
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
