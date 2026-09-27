/**
 * Environment Validation
 *
 * Validates required environment variables at runtime.
 */

export interface EnvironmentConfig {
  apiUrl: string;
  webhookBaseUrl: string;
  wsUrl?: string;
  appVersion: string;
  nodeEnv: string;
}

const REQUIRED: Array<keyof EnvironmentConfig> = ["apiUrl", "appVersion"];

export function validateEnvironment(): EnvironmentConfig {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const config: EnvironmentConfig = {
    apiUrl,
    webhookBaseUrl: process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ?? apiUrl,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    nodeEnv: process.env.NODE_ENV ?? "development",
  };

  const missing = REQUIRED.filter((key) => !config[key]);

  if (missing.length > 0 && config.nodeEnv !== "development") {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return config;
}

export function isLocalUrl(url: string): boolean {
  return /\b(localhost|127\.0\.0\.1|::1)\b/.test(url);
}

export const env = validateEnvironment();
