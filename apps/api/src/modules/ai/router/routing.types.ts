import type { AiModelCapabilityContract, AiRoutingDecisionContract } from "../contracts";

export interface RoutingRequirements {
  workspaceId: string;
  minimumContextWindow?: number;
  minimumOutputTokens?: number;
  vision?: boolean;
  audio?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  streaming?: boolean;
}

export interface RoutingCandidate {
  workspaceId: string;
  providerId: string;
  providerName: string;
  providerStatus: "ACTIVE" | "DISABLED" | "UNHEALTHY";
  providerPriority: number;
  modelId: string;
  modelName: string;
  modelStatus: "ACTIVE" | "DISABLED" | "DEPRECATED";
  modelPriority: number;
  credentialId: string | null;
  credentialPriority: number;
  configured: boolean;
  enabled: boolean;
  credentialExists: boolean;
  capabilities: AiModelCapabilityContract;
  latestHealth: {
    available: boolean;
    checkedAt: Date;
  } | null;
}

export interface RoutingMetadataRecord {
  id: string;
  workspaceId: string;
  invocationId: string;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  decisionFactors: Record<string, unknown>;
  candidateMetadata: Record<string, unknown>[] | null;
  createdAt: Date;
}

export interface RoutingDecision extends AiRoutingDecisionContract {
  fallbacks: Array<{
    providerId: string;
    modelId: string;
  }>;
}
