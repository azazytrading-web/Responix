export function configuration() {
  return {
    api: {
      port: Number.parseInt(process.env.API_PORT ?? "4000", 10),
      trustProxy: process.env.TRUST_PROXY === "true",
      compressionEnabled: process.env.COMPRESSION_ENABLED !== "false",
      rateLimit: {
        ttlMs: Number.parseInt(process.env.RATE_LIMIT_TTL_MS ?? "60000", 10),
        maxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10)
      }
    },
    dashboard: {
      url: process.env.DASHBOARD_URL ?? "http://localhost:3000"
    },
    database: {
      url: process.env.DATABASE_URL
    },
    redis: {
      url: process.env.REDIS_URL
    },
    storage: {
      r2AccountId: process.env.R2_ACCOUNT_ID,
      r2BucketName: process.env.R2_BUCKET_NAME,
      r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL
    },
    observability: {
      serviceName: process.env.OTEL_SERVICE_NAME ?? "responix-api",
      logLevel: process.env.LOG_LEVEL ?? "info"
    }
  };
}
