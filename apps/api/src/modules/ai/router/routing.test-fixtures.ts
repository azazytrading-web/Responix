import type { RoutingCandidate } from "./routing.types";

export function routingCandidate(overrides: Partial<RoutingCandidate> = {}): RoutingCandidate {
  return {
    workspaceId: "workspace-id",
    providerId: "provider-a",
    providerName: "Provider A",
    providerStatus: "ACTIVE",
    providerPriority: 10,
    modelId: "model-a",
    modelName: "model-a",
    modelStatus: "ACTIVE",
    modelPriority: 10,
    credentialId: "credential-id",
    credentialPriority: 10,
    configured: true,
    enabled: true,
    credentialExists: true,
    capabilities: {
      modelId: "model-a",
      providerId: "provider-a",
      contextWindow: 32_000,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: true,
      supportsReasoning: false,
      supportsStreaming: true,
      maxOutputTokens: 4_096
    },
    latestHealth: {
      available: true,
      checkedAt: new Date("2026-07-25T00:00:00.000Z")
    },
    ...overrides
  };
}
