import { apiClient } from "@responix/api-client";

export interface ChannelRecord {
  id: string;
  workspaceId: string;
  name: string;
  state: string;
  stateVersion: number;
  compatibilityVersion: string;
  provider?: { name: string };
}

export interface ChannelPage {
  data: ChannelRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface WhatsAppConnection {
  id: string;
  workspaceId: string;
  channelId: string;
  state: string;
  stateVersion: number;
  businessAccountId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  apiVersion: string | null;
  webhookPathKey: string;
  accessTokenFingerprint: string | null;
  health: { state?: string; qrRequired?: boolean; qr?: string } | null;
  lastHealthCheckAt: string | null;
}

export interface BaileysDiagnostics {
  state: "CONNECTED" | "CONNECTING" | "RECONNECTING" | "QR_REQUIRED" | "LOGGED_OUT" | "DISCONNECTED" | "ERROR";
  qrRequired: boolean;
  socketPresent: boolean;
  sessionPresent: boolean;
  lastStateChangeAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastError?: string;
  reconnectAttempts: number;
  recentEvents: Array<{ at: string; stage: string; detail: string; correlationId?: string }>;
}

export interface CreateWhatsAppConnectionInput {
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  apiVersion: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
}

export interface UpdateWhatsAppConnectionInput {
  businessAccountId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  apiVersion?: string;
  accessToken?: string;
  verifyToken?: string;
  appSecret?: string;
  expectedStateVersion: number;
}

const request = { credentials: "include" as const };
export const whatsappQueryKey = (workspaceId?: string) =>
  ["workspace", workspaceId, "channel-runtime", "whatsapp"] as const;

export function listChannels(): Promise<ChannelPage> {
  return apiClient.get<ChannelPage>("/api/v1/channel-runtime/channels", {
    ...request,
    query: { page: 1, limit: 100 }
  });
}

export function createWhatsAppChannel(name: string): Promise<ChannelRecord> {
  return apiClient.post<ChannelRecord>(
    "/api/v1/channel-runtime/channels",
    { name, providerKey: "whatsapp", compatibilityVersion: "1.0" },
    request
  );
}

export function listConnections(channelId: string): Promise<WhatsAppConnection[]> {
  return apiClient.get<WhatsAppConnection[]>(
    `/api/v1/channel-runtime/channels/${channelId}/connections`,
    request
  );
}

export function createWhatsAppConnection(
  channelId: string,
  input: CreateWhatsAppConnectionInput
): Promise<WhatsAppConnection> {
  return apiClient.post<WhatsAppConnection>(
    `/api/v1/channel-runtime/channels/${channelId}/connections`,
    input,
    request
  );
}

export function validateWhatsAppConnection(connectionId: string): Promise<WhatsAppConnection> {
  return apiClient.post<WhatsAppConnection>(
    `/api/v1/channel-runtime/connections/${connectionId}/health`,
    {},
    request
  );
}

export function getBaileysDiagnostics(connectionId: string): Promise<BaileysDiagnostics> {
  return apiClient.get<BaileysDiagnostics>(`/api/v1/channel-runtime/connections/${connectionId}/diagnostics`, request);
}

export function reconnectBaileys(connectionId: string): Promise<BaileysDiagnostics> {
  return apiClient.post<BaileysDiagnostics>(`/api/v1/channel-runtime/connections/${connectionId}/reconnect`, {}, request);
}

export function disconnectBaileys(connectionId: string): Promise<BaileysDiagnostics> {
  return apiClient.post<BaileysDiagnostics>(`/api/v1/channel-runtime/connections/${connectionId}/disconnect`, {}, request);
}

export function newBaileysPairing(connectionId: string): Promise<BaileysDiagnostics> {
  return apiClient.post<BaileysDiagnostics>(`/api/v1/channel-runtime/connections/${connectionId}/new-pairing`, {}, request);
}

export function transitionWhatsAppConnection(
  connectionId: string,
  state: "DISCONNECTED" | "CONNECTING",
  expectedStateVersion: number
): Promise<WhatsAppConnection> {
  return apiClient.patch<WhatsAppConnection>(
    `/api/v1/channel-runtime/connections/${connectionId}/state`,
    { state, expectedStateVersion },
    request
  );
}

export function getWhatsAppConnection(connectionId: string): Promise<WhatsAppConnection> {
  return apiClient.get<WhatsAppConnection>(
    `/api/v1/channel-runtime/connections/${connectionId}`,
    request
  );
}

export function updateWhatsAppConnection(
  connectionId: string,
  input: UpdateWhatsAppConnectionInput
): Promise<WhatsAppConnection> {
  return apiClient.patch<WhatsAppConnection>(
    `/api/v1/channel-runtime/connections/${connectionId}`,
    input,
    request
  );
}

export function regenerateVerifyToken(
  connectionId: string
): Promise<{ verifyToken: string }> {
  return apiClient.post<{ verifyToken: string }>(
    `/api/v1/channel-runtime/connections/${connectionId}/verify-token/regenerate`,
    {},
    request
  );
}

export interface ChannelConversationRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  externalConversationId: string;
  conversationRuntimeId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelConfigurationRevision {
  id: string;
  connectionId: string;
  revision: number;
  configuration: Record<string, unknown> | null;
  hash: string;
  checksum: string;
  createdById: string;
  createdAt: string;
}

export interface SwitchChannelAgentResult {
  connectionId: string;
  channelId: string;
  agentId: string;
  newStateVersion: number;
  newRevision: number;
}

export function listChannelConversations(channelId: string): Promise<ChannelConversationRecord[]> {
  return apiClient.get<ChannelConversationRecord[]>(
    `/api/v1/channel-runtime/conversations`,
    { ...request, query: { channelId } }
  );
}

export function getChannelConfiguration(connectionId: string): Promise<ChannelConfigurationRevision[]> {
  return apiClient.get<ChannelConfigurationRevision[]>(
    `/api/v1/channel-runtime/connections/${connectionId}/configurations`,
    request
  );
}

export function updateChannelConfiguration(
  connectionId: string,
  configuration: Record<string, unknown>,
  expectedStateVersion: number
): Promise<ChannelConfigurationRevision> {
  return apiClient.patch<ChannelConfigurationRevision>(
    `/api/v1/channel-runtime/connections/${connectionId}/configuration`,
    { configuration, expectedStateVersion },
    request
  );
}

export { listAgents, switchAgentChannel } from "../agent-management/agent-api";
export type { AgentRecord } from "../agent-management/agent-api";
