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
    ai: {
      enabled: process.env.AI_ENABLED !== "false",
      credentialEncryptionKey: process.env.AI_CREDENTIAL_ENCRYPTION_KEY,
      requestTimeoutMs: Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "30000", 10),
      maxContextTokens: Number.parseInt(process.env.AI_MAX_CONTEXT_TOKENS ?? "32000", 10),
      runtime: {
        dailyRequestLimit: Number.parseInt(
          process.env.AI_DEFAULT_DAILY_REQUEST_LIMIT ?? "10000",
          10
        ),
        monthlyRequestLimit: Number.parseInt(
          process.env.AI_DEFAULT_MONTHLY_REQUEST_LIMIT ?? "300000",
          10
        ),
        dailyTokenLimit: Number.parseInt(
          process.env.AI_DEFAULT_DAILY_TOKEN_LIMIT ?? "100000000",
          10
        ),
        monthlyTokenLimit: Number.parseInt(
          process.env.AI_DEFAULT_MONTHLY_TOKEN_LIMIT ?? "3000000000",
          10
        ),
        dailyCostLimit: process.env.AI_DEFAULT_DAILY_COST_LIMIT ?? "1000.000000",
        monthlyCostLimit: process.env.AI_DEFAULT_MONTHLY_COST_LIMIT ?? "30000.000000",
        maxConcurrentInvocations: Number.parseInt(
          process.env.AI_DEFAULT_MAX_CONCURRENT_INVOCATIONS ?? "50",
          10
        ),
        maxQueueDepth: Number.parseInt(process.env.AI_DEFAULT_MAX_QUEUE_DEPTH ?? "100", 10),
        maxContextTokens: Number.parseInt(
          process.env.AI_DEFAULT_MAX_CONTEXT_TOKENS ?? "32000",
          10
        ),
        maxOutputTokens: Number.parseInt(
          process.env.AI_DEFAULT_MAX_OUTPUT_TOKENS ?? "4096",
          10
        ),
        expectedOutputTokens: Number.parseInt(
          process.env.AI_EXPECTED_OUTPUT_TOKENS ?? "1024",
          10
        ),
        tokenEstimationCharactersPerToken: Number.parseInt(
          process.env.AI_TOKEN_ESTIMATION_CHARACTERS_PER_TOKEN ?? "4",
          10
        ),
        estimatedCostPerMillionTokens:
          process.env.AI_ESTIMATED_COST_PER_MILLION_TOKENS ?? "10.000000",
        queueWaitTimeoutMs: Number.parseInt(
          process.env.AI_QUEUE_WAIT_TIMEOUT_MS ?? "5000",
          10
        ),
        queuePollIntervalMs: Number.parseInt(
          process.env.AI_QUEUE_POLL_INTERVAL_MS ?? "50",
          10
        ),
        reservationTtlMs: Number.parseInt(
          process.env.AI_RESERVATION_TTL_MS ?? "60000",
          10
        ),
        recoveryIntervalMs: Number.parseInt(
          process.env.AI_RUNTIME_RECOVERY_INTERVAL_MS ?? "30000",
          10
        ),
        recoveryBatchSize: Number.parseInt(
          process.env.AI_RUNTIME_RECOVERY_BATCH_SIZE ?? "100",
          10
        )
      },
      network: {
        allowedHosts: (process.env.AI_PROVIDER_ALLOWED_HOSTS ?? "api.openai.com")
          .split(",")
          .map((host) => host.trim().toLowerCase())
          .filter(Boolean),
        allowedPorts: (process.env.AI_PROVIDER_ALLOWED_PORTS ?? "443")
          .split(",")
          .map((port) => Number.parseInt(port.trim(), 10)),
        dnsTimeoutMs: Number.parseInt(process.env.AI_PROVIDER_DNS_TIMEOUT_MS ?? "2000", 10),
        connectionTimeoutMs: Number.parseInt(
          process.env.AI_PROVIDER_CONNECTION_TIMEOUT_MS ?? "5000",
          10
        ),
        readTimeoutMs: Number.parseInt(process.env.AI_PROVIDER_READ_TIMEOUT_MS ?? "15000", 10),
        maxResponseBytes: Number.parseInt(
          process.env.AI_PROVIDER_MAX_RESPONSE_BYTES ?? "1048576",
          10
        )
      }
    },
    observability: {
      serviceName: process.env.OTEL_SERVICE_NAME ?? "responix-api",
      logLevel: process.env.LOG_LEVEL ?? "info"
    }
  };
}
