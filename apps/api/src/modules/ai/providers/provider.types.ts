import type { AiModelCapabilityContract } from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";

export interface ProviderModel extends AiModelCapabilityContract {
  modelName: string;
  displayName: string;
  status: "ACTIVE" | "DISABLED" | "DEPRECATED";
  priority: number;
}

export interface WorkspaceProvider {
  id: string;
  providerName: string;
  apiBaseUrl: string | null;
  authenticationType: string | null;
  status: "ACTIVE" | "DISABLED" | "UNHEALTHY";
  priority: number;
  configuration: {
    enabled: boolean;
    settings: Record<string, unknown>;
  } | null;
  models: ProviderModel[];
}

export interface WorkspaceProviderConfiguration {
  id: string;
  workspaceId: string;
  providerId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface ProviderCredentialMetadata {
  id: string;
  workspaceId: string;
  providerId: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "REVOKED";
  priority: number;
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  lastUsedAt: Date | null;
  keyFingerprint: string;
}

export interface ResolvedProvider {
  provider: WorkspaceProvider;
  adapter: AiProviderAdapter;
}
