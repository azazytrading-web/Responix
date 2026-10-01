import { apiClient } from "@responix/api-client";
import { listProviders } from "../provider-management/provider-api";
export type { ProviderModel, ProviderOption } from "../provider-management/provider-api";

export type AgentStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "PUBLISHED" | "ARCHIVED";
export type AgentVisibility = "PRIVATE" | "WORKSPACE";
export type AgentPromptRole = "SYSTEM" | "DEVELOPER" | "USER_TEMPLATE" | "LIBRARY";

export interface AgentPromptBinding {
  id?: string;
  role: AgentPromptRole;
  promptId: string;
  promptVersionId?: string | null;
}

export interface AgentCapabilities {
  knowledgeEnabled?: boolean;
  toolsEnabled?: boolean;
  memoryEnabled?: boolean;
  visionEnabled?: boolean;
  reasoningEnabled?: boolean;
  voiceEnabled?: boolean;
  imageEnabled?: boolean;
  streamingEnabled?: boolean;
  moderationEnabled?: boolean;
}

export interface AgentConfiguration {
  executionMode?: "LEGACY" | "OIC";
  oiModelKey?: string;
  providerId?: string;
  modelId?: string;
  providerConfigurationId?: string;
  runtimeConfiguration?: {
    executionPipelineId?: string;
    executionProfileId?: string;
  };
  temperature: number;
  topP?: number;
  maxTokens: number;
  streaming?: boolean;
  timeoutMs?: number;
}

export type PersonalityDimension = { base: number; intensity: number };
export type OperationalPersonality = {
  warmth: PersonalityDimension;
  enthusiasm: PersonalityDimension;
  formality: PersonalityDimension;
};

/** Working-context flag for conversation history (operational, not a definition field). */
export type ConversationHistorySetting = { enabled?: boolean };

export interface AgentWriteInput {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  visibility: AgentVisibility;
  configuration: AgentConfiguration;
  capabilities?: AgentCapabilities;
  promptBindings?: Array<Omit<AgentPromptBinding, "id">>;
  conversationHistory?: ConversationHistorySetting;
}

export interface AgentActiveChannel {
  connectionId: string;
  channelId: string;
  stateVersion: number;
}

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  status: AgentStatus;
  visibility: AgentVisibility;
  providerId: string | null;
  modelId: string | null;
  runtimeConfiguration: {
    oicIntegration?: { executionMode?: "LEGACY" | "OIC"; oiModelKey?: string };
    executionPipelineId?: string;
    executionProfileId?: string;
    personality?: OperationalPersonality;
    conversationHistory?: ConversationHistorySetting;
    automaticExecution?: { enabled?: boolean };
  };
  temperature: number;
  topP: number | null;
  maxTokens: number;
  streamingEnabled: boolean;
  timeoutMs: number;
  memoryEnabled: boolean;
  knowledgeEnabled: boolean;
  retrievalRuntimeId: string | null;
  toolsEnabled: boolean;
  visionEnabled: boolean;
  reasoningEnabled: boolean;
  voiceEnabled: boolean;
  imageEnabled: boolean;
  moderationEnabled: boolean;
  version: number;
  promptBindings: AgentPromptBinding[];
  activeChannels: AgentActiveChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentPage {
  data: AgentRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PromptOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  revision: number;
  draft: Record<string, unknown>;
}

export interface PromptPage {
  data: PromptOption[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface RuntimeOption { id: string; name: string; status: string }
interface RuntimeOptionPage { data: RuntimeOption[] }
const config = { credentials: "include" as const };

export function listExecutionPipelines(): Promise<RuntimeOptionPage> {
  return apiClient.get<RuntimeOptionPage>("/api/v1/execution-pipelines", {
    ...config, query: { page: 1, limit: 100, status: "PUBLISHED" }
  });
}

export function listExecutionProfiles(): Promise<RuntimeOptionPage> {
  return apiClient.get<RuntimeOptionPage>("/api/v1/runtime-orchestration/profiles", {
    ...config, query: { page: 1, limit: 100, status: "PUBLISHED" }
  });
}

export function listOiModels(): Promise<Array<{ id: string; object: "model"; owned_by: "oi" }>> {
  return apiClient.get<Array<{ id: string; object: "model"; owned_by: "oi" }>>("/api/v1/internal/oic/models", config);
}

export function listAgents(page: number, search?: string, status?: AgentStatus): Promise<AgentPage> {
  return apiClient.get<AgentPage>("/api/v1/agent-studio/agents", {
    ...config,
    query: { page, limit: 25, ...(search ? { search } : {}), ...(status ? { status } : {}) }
  });
}

export function getAgent(agentId: string): Promise<AgentRecord> {
  return apiClient.get<AgentRecord>(`/api/v1/agent-studio/agents/${agentId}`, config);
}

export function bindRetrievalRuntime(agentId: string, retrievalRuntimeId: string): Promise<AgentRecord> {
  return apiClient.post<AgentRecord>(
    `/api/v1/agent-studio/agents/${agentId}/retrieval-runtime`,
    { retrievalRuntimeId },
    config
  );
}

export function unbindRetrievalRuntime(agentId: string): Promise<AgentRecord> {
  return apiClient.delete<AgentRecord>(`/api/v1/agent-studio/agents/${agentId}/retrieval-runtime`, config);
}

export function updateOperationalPersonality(
  agentId: string, personality: OperationalPersonality
): Promise<AgentRecord> {
  return apiClient.put<AgentRecord>(
    `/api/v1/agent-studio/agents/${agentId}/operational-personality`, personality, config
  );
}

export function updateConversationHistory(
  agentId: string, enabled: boolean
): Promise<AgentRecord> {
  return apiClient.put<AgentRecord>(
    `/api/v1/agent-studio/agents/${agentId}/conversation-history`, { enabled }, config
  );
}

export function updateAutomaticExecution(agentId: string, enabled: boolean): Promise<AgentRecord> {
  return apiClient.put<AgentRecord>(`/api/v1/agent-studio/agents/${agentId}/automatic-execution`, { enabled }, config);
}

export function createAgent(input: AgentWriteInput): Promise<AgentRecord> {
  return apiClient.post<AgentRecord>("/api/v1/agent-studio/agents", input, config);
}

export function updateAgent(agentId: string, input: AgentWriteInput): Promise<AgentRecord> {
  return apiClient.put<AgentRecord>(`/api/v1/agent-studio/agents/${agentId}`, input, config);
}

export function cloneAgent(agentId:string,input:{name:string;slug:string}):Promise<AgentRecord>{
  return apiClient.post<AgentRecord>(`/api/v1/agent-studio/agents/${agentId}/clone`,input,config);
}

export function publishAgent(agentId: string): Promise<{ agent: AgentRecord }> {
  return apiClient.post<{ agent: AgentRecord }>(
    `/api/v1/agent-studio/agents/${agentId}/publish`,
    { changeSummary: "Published from Agent configuration" },
    config
  );
}

export function archiveAgent(agentId: string): Promise<AgentRecord> {
  return apiClient.post<AgentRecord>(
    `/api/v1/agent-studio/agents/${agentId}/archive`,
    {},
    config
  );
}

export function restoreAgent(agentId: string): Promise<AgentRecord> {
  return apiClient.post<AgentRecord>(
    `/api/v1/agent-studio/agents/${agentId}/restore`,
    {},
    config
  );
}

export function deleteAgent(agentId: string): Promise<unknown> {
  return apiClient.delete(`/api/v1/agent-studio/agents/${agentId}`, config);
}

export function switchAgentChannel(
  agentId: string,
  connectionId: string,
  expectedStateVersion: number
): Promise<{
  connectionId: string;
  channelId: string;
  agentId: string;
  newStateVersion: number;
  newRevision: number;
}> {
  return apiClient.post(
    `/api/v1/agent-studio/agents/${agentId}/channels/${connectionId}/switch`,
    { expectedStateVersion },
    config
  );
}

export { listProviders };

export function listPrompts(): Promise<PromptPage> {
  return apiClient.get<PromptPage>("/api/v1/prompt-library", {
    ...config,
    query: { page: 1, limit: 100, archived: false, sortBy: "name", sortOrder: "asc" }
  });
}
