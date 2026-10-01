import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum([
    "local",
    "development",
    "testing",
    "staging",
    "production",
    "disaster-recovery"
  ]),
  API_HOST: z.string().ip({ version: "v4" }).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DASHBOARD_URL: z.string().url(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  COMPRESSION_ENABLED: z.enum(["true", "false"]).default("true"),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),
  AI_CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .base64()
    .refine((value) => Buffer.from(value, "base64").length === 32, {
      message: "AI_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes"
    }),
  AI_ENABLED: z.enum(["true", "false"]).default("true"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(32000),
  AI_DEFAULT_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(10000),
  AI_DEFAULT_MONTHLY_REQUEST_LIMIT: z.coerce.number().int().positive().default(300000),
  AI_DEFAULT_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(100000000),
  AI_DEFAULT_MONTHLY_TOKEN_LIMIT: z.coerce.number().int().positive().default(3000000000),
  AI_DEFAULT_DAILY_COST_LIMIT: z.string().regex(/^\d+(?:\.\d{1,6})?$/).default("1000.000000"),
  AI_DEFAULT_MONTHLY_COST_LIMIT: z
    .string()
    .regex(/^\d+(?:\.\d{1,6})?$/)
    .default("30000.000000"),
  AI_DEFAULT_MAX_CONCURRENT_INVOCATIONS: z.coerce.number().int().positive().default(50),
  AI_DEFAULT_MAX_QUEUE_DEPTH: z.coerce.number().int().nonnegative().default(100),
  AI_DEFAULT_MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(32000),
  AI_DEFAULT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
  AI_EXPECTED_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1024),
  AI_TOKEN_ESTIMATION_CHARACTERS_PER_TOKEN: z.coerce.number().int().positive().default(4),
  AI_ESTIMATED_COST_PER_MILLION_TOKENS: z
    .string()
    .regex(/^\d+(?:\.\d{1,6})?$/)
    .default("10.000000"),
  AI_QUEUE_WAIT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  AI_QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(50),
  AI_RESERVATION_TTL_MS: z.coerce.number().int().positive().default(60000),
  AI_RUNTIME_RECOVERY_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  AI_RUNTIME_RECOVERY_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  AI_PROVIDER_ALLOWED_HOSTS: z.string().min(1).default(
    "api.openai.com,api.anthropic.com,generativelanguage.googleapis.com,openrouter.ai,api.deepseek.com,graph.facebook.com,lookaside.fbsbx.com,*.fbcdn.net"
  ),
  AI_PROVIDER_ALLOWED_PORTS: z
    .string()
    .regex(/^\d+(?:,\d+)*$/)
    .default("443"),
  AI_PROVIDER_DNS_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  AI_PROVIDER_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  AI_PROVIDER_READ_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AI_PROVIDER_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(1048576),
  OIC_BASE_URL: z.string().url().optional(),
  OIC_SERVICE_CREDENTIAL: z.string().min(1).max(256).optional(),
  OIC_PROVISIONING_CREDENTIAL: z.string().min(1).max(256).optional(),
  OIC_RUNTIME_PRINCIPAL_ID: z.string().uuid().optional(),
  OIC_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  OTEL_SERVICE_NAME: z.string().min(1).default("responix-api"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
}).superRefine((value, context) => {
  if (Boolean(value.OIC_BASE_URL) !== Boolean(value.OIC_SERVICE_CREDENTIAL)) {
    context.addIssue({ code: "custom", path: ["OIC_SERVICE_CREDENTIAL"],
      message: "OIC_BASE_URL and OIC_SERVICE_CREDENTIAL must be configured together" });
  }
  if (value.OIC_PROVISIONING_CREDENTIAL && !value.OIC_BASE_URL) {
    context.addIssue({ code: "custom", path: ["OIC_PROVISIONING_CREDENTIAL"],
      message: "OIC_BASE_URL and OIC_PROVISIONING_CREDENTIAL must be configured together" });
  }
  if (value.OIC_RUNTIME_PRINCIPAL_ID && !value.OIC_PROVISIONING_CREDENTIAL) {
    context.addIssue({ code: "custom", path: ["OIC_RUNTIME_PRINCIPAL_ID"], message: "OIC_RUNTIME_PRINCIPAL_ID requires OIC_PROVISIONING_CREDENTIAL" });
  }
});

export function validateEnvironment(config: Record<string, unknown>) {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  return result.data;
}
