export const FEATURE_FLAGS = {
  AI_ENABLED: "ai.enabled",
  AI_STREAMING: "ai.streaming",
  WHATSAPP_ENABLED: "whatsapp.enabled",
  EMAIL_ENABLED: "email.enabled",
  API_ENABLED: "api.enabled",
  KNOWLEDGE_ENABLED: "knowledge.enabled",
  WORKFLOWS_ENABLED: "workflows.enabled",
  ANALYTICS_ENABLED: "analytics.enabled",
  BILLING_ENABLED: "billing.enabled",
} as const;

export type FeatureFlagCode = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];
