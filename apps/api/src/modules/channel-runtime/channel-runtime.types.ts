import type { ChannelMessageType } from "@prisma/client";

export type ChannelDirection = "INCOMING" | "OUTGOING";

export interface NormalizedChannelAttachment {
  providerMediaId?: string;
  reference?: string;
  fileName?: string;
  mimeType: string;
  sizeBytes?: number;
  checksum?: string;
  caption?: string;
  metadata: Readonly<Record<string, unknown>>;
}

export interface NormalizedChannelMessage {
  providerMessageId?: string;
  externalUserId: string;
  externalConversationId: string;
  direction: ChannelDirection;
  type: ChannelMessageType;
  text?: string;
  replyToProviderMessageId?: string;
  timestamp: Date;
  attachments: readonly NormalizedChannelAttachment[];
  content: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}

export interface ChannelProviderCapabilities {
  readonly supported: ReadonlySet<ChannelCapability>;
  readonly limits: Readonly<Record<string, number>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export enum ChannelCapability {
  TEXT = "text", IMAGE = "image", VIDEO = "video", AUDIO = "audio", VOICE = "voice",
  DOCUMENT = "document", CONTACTS = "contacts", LOCATION = "location", STICKERS = "stickers",
  BUTTONS = "buttons", LISTS = "lists", QUICK_REPLIES = "quick_replies", TEMPLATES = "templates",
  INTERACTIVE = "interactive", TYPING = "typing_indicators", REACTIONS = "reactions", EDITS = "edits",
  DELETES = "deletes", PRESENCE = "presence", THREADING = "threading", QUOTING = "quoting",
  FORWARDING = "forwarding", BROADCAST = "broadcast", GROUPS = "group_messaging", WEBHOOKS = "webhooks",
  HEALTH = "health", MEDIA_UPLOAD = "media_upload", MEDIA_DOWNLOAD = "media_download", STREAMING = "streaming"
}

export interface ChannelIdentity {
  providerKey: string;
  externalId: string;
  displayName?: string;
  metadata: Readonly<Record<string, unknown>>;
}

export interface ChannelPresence {
  identity: ChannelIdentity;
  state: "ONLINE" | "OFFLINE" | "AWAY" | "BUSY" | "UNKNOWN";
  observedAt: Date;
  metadata: Readonly<Record<string, unknown>>;
}

export interface ChannelConversationBinding {
  channelConversationId: string;
  conversationRuntimeId?: string;
  workflowVersionId?: string;
  agentExecutionConfiguration?: Readonly<Record<string, unknown>>;
}

export interface NormalizedChannelEvent {
  kind: "DELIVERY" | "PROVIDER" | "PRESENCE";
  type: string;
  providerMessageId?: string;
  deliveryState?: "SENT" | "DELIVERED" | "READ" | "FAILED" | "DELETED" | "UNKNOWN";
  externalIdentityId?: string;
  occurredAt: Date;
  payload: Readonly<Record<string, unknown>>;
}
