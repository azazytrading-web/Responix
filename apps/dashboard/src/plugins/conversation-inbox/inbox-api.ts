import { apiClient } from "@responix/api-client";

// ---------------------------------------------------------------------------
// Typed contracts for the existing Channel Runtime inbox endpoints.
// Shapes mirror apps/api/src/modules/channel-runtime (Prisma selects) exactly.
// No new endpoints are introduced; everything here maps to existing routes.
// ---------------------------------------------------------------------------

const request = { credentials: "include" as const };

export interface InboxPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InboxChannelRecord {
  id: string;
  workspaceId: string;
  providerId: string;
  provider: { name: string };
  name: string;
  state: string;
  version: number;
  stateVersion: number;
  compatibilityVersion: string;
  configurationHash: string;
  checksum: string;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface InboxChannelPage {
  data: InboxChannelRecord[];
  pagination: InboxPagination;
}

export interface InboxConversationRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  sessionId: string;
  conversationRuntimeId: string | null;
  externalConversationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Newest message createdAt for this conversation (null when it has no messages). */
  lastMessageAt?: string | null;
  /** Conversation-level Responix execution override; true when not disabled. */
  agentExecutionEnabled?: boolean;
}

export interface InboxNormalizedAttachment {
  providerMediaId?: string;
  reference?: string;
  fileName?: string;
  mimeType: string;
  sizeBytes?: number | string;
  checksum?: string;
  caption?: string;
  metadata: Record<string, unknown>;
}

export interface InboxNormalizedPayload {
  providerMessageId?: string;
  externalUserId?: string;
  externalConversationId?: string;
  direction?: "INCOMING" | "OUTGOING";
  type?: string;
  text?: string;
  replyToProviderMessageId?: string;
  producer?: { agentId?: string; agentName?: string };
  timestamp?: string;
  attachments?: InboxNormalizedAttachment[];
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface InboxMessageAttachment {
  id: string;
  workspaceId: string;
  channelId: string;
  messageId: string | null;
  providerMediaId: string | null;
  storageReference: string | null;
  fileName: string | null;
  mimeType: string;
  // Prisma BigInt serializes to string over JSON.
  sizeBytes: number | string;
  checksum: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InboxMessageDelivery {
  id: string;
  state: string;
  attempt: number;
  providerCode: string | null;
  detail: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface InboxMessageRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  connectionId: string;
  conversationId: string;
  direction: "INCOMING" | "OUTGOING";
  type: string;
  state: string;
  stateVersion: number;
  providerMessageId: string | null;
  idempotencyKey: string;
  replyToMessageId: string | null;
  normalizedPayload: InboxNormalizedPayload | null;
  payloadHash: string;
  checksum: string;
  queuedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: InboxMessageAttachment[];
  deliveries: InboxMessageDelivery[];
}

export interface InboxMessagePage {
  data: InboxMessageRecord[];
  pagination: InboxPagination;
}

export interface InboxConnectionRecord {
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
  capabilities: Record<string, unknown>;
  health: Record<string, unknown> | null;
  lastHealthCheckAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxAgentActiveChannel {
  connectionId: string;
  channelId: string;
  stateVersion: number;
}

export interface InboxAgentRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
  activeChannels: InboxAgentActiveChannel[];
}

export interface SendInboxMessageInput {
  connectionId: string;
  recipient: string;
  text: string;
  idempotencyKey: string;
}

export function inboxQueryKey(workspaceId?: string) {
  return ["workspace", workspaceId, "channel-runtime", "inbox"] as const;
}

export function inboxMessagesKey(workspaceId?: string, conversationId?: string | null) {
  return [...inboxQueryKey(workspaceId), "messages", conversationId ?? null] as const;
}

export function listInboxChannels(): Promise<InboxChannelPage> {
  return apiClient.get<InboxChannelPage>("/api/v1/channel-runtime/channels", {
    ...request,
    query: { page: 1, limit: 100 }
  });
}

/** GET /channel-runtime/conversations — optional channelId, no pagination. */
export function listInboxConversations(channelId?: string): Promise<InboxConversationRecord[]> {
  return apiClient.get<InboxConversationRecord[]>("/api/v1/channel-runtime/conversations", {
    ...request,
    ...(channelId ? { query: { channelId } } : {})
  });
}

/**
 * GET /channel-runtime/messages without a conversationId — the most recent
 * workspace-wide messages, newest first. Used for the session-scoped unread
 * model (bounded window; only recent activity is considered).
 */
export function listWorkspaceMessages(page = 1, limit = 100): Promise<InboxMessagePage> {
  return apiClient.get<InboxMessagePage>("/api/v1/channel-runtime/messages", {
    ...request,
    query: { page, limit }
  });
}

/**
 * GET /channel-runtime/messages — paginated, newest first (createdAt desc).
 * Callers page forward to load older history.
 */
export function listInboxMessages(
  conversationId: string,
  page = 1,
  limit = 50
): Promise<InboxMessagePage> {
  return apiClient.get<InboxMessagePage>("/api/v1/channel-runtime/messages", {
    ...request,
    query: { conversationId, page, limit }
  });
}

export function listInboxConnections(channelId: string): Promise<InboxConnectionRecord[]> {
  return apiClient.get<InboxConnectionRecord[]>(
    `/api/v1/channel-runtime/channels/${channelId}/connections`,
    request
  );
}

/** GET /channel-runtime/attachments/:id — returns content as base64 when stored. */
export function getInboxAttachment(
  id: string
): Promise<InboxMessageAttachment & { content?: string }> {
  return apiClient.get<InboxMessageAttachment & { content?: string }>(
    `/api/v1/channel-runtime/attachments/${id}`,
    request
  );
}

/** POST /channel-runtime/channels/:id/messages — provider-neutral outbound text. */
export function sendInboxMessage(
  channelId: string,
  input: SendInboxMessageInput
): Promise<InboxMessageRecord> {
  return apiClient.post<InboxMessageRecord>(
    `/api/v1/channel-runtime/channels/${channelId}/messages`,
    {
      connectionId: input.connectionId,
      recipient: input.recipient,
      type: "TEXT",
      text: input.text,
      idempotencyKey: input.idempotencyKey
    },
    request
  );
}

/**
 * PATCH /channel-runtime/conversations/:id/agent-execution — conversation-level
 * Responix execution override. Returns the canonical { id, channelId,
 * agentExecutionEnabled } state; the UI never assumes the desired value.
 */
export function setConversationExecution(
  conversationId: string,
  enabled: boolean
): Promise<{ id: string; channelId: string; agentExecutionEnabled: boolean }> {
  return apiClient.patch<{ id: string; channelId: string; agentExecutionEnabled: boolean }>(
    `/api/v1/channel-runtime/conversations/${conversationId}/agent-execution`,
    { enabled },
    request
  );
}

export function listInboxAgents(): Promise<{ data: InboxAgentRecord[]; pagination: InboxPagination }> {
  return apiClient.get<{ data: InboxAgentRecord[]; pagination: InboxPagination }>(
    "/api/v1/agent-studio/agents",
    { ...request, query: { page: 1, limit: 100 } }
  );
}
