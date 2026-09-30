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
  OIC_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  OIC_AUTH_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(10000).default(120),
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