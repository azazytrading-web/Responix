import type { ChannelProviderCapabilities, NormalizedChannelEvent, NormalizedChannelMessage } from "../channel-runtime.types";
import type { ChannelCredentialAccessor } from "./channel-credential.contract";
import type { ChannelTransport } from "./channel-transport.contract";
import type { ChannelWebhookVerification, ChannelWebhookVerificationResult } from "./channel-webhook.contract";

export interface ChannelProviderConnection {
  readonly id: string;
  readonly workspaceId: string;
  readonly channelId: string;
  readonly providerKey: string;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly credentials: ChannelCredentialAccessor;
  readonly transport: ChannelTransport;
}

export interface ChannelSendResult {
  providerMessageId: string;
  acceptedAt: Date;
  raw: Readonly<Record<string, unknown>>;
}

export interface ChannelProviderAdapter {
  readonly key: string;
  capabilities(): ChannelProviderCapabilities;
  validateConfiguration(input: Readonly<Record<string, unknown>>): readonly string[];
  verifyWebhook(connection: ChannelProviderConnection, input: ChannelWebhookVerification): Promise<ChannelWebhookVerificationResult>;
  verifySignature(connection: ChannelProviderConnection, rawBody: Buffer, signature: string): Promise<boolean>;
  normalizeIncoming(payload: unknown): readonly NormalizedChannelMessage[];
  webhookMetadata(payload: unknown, timestampHeader?: string): { eventId: string; occurredAt: Date };
  normalizeEvents(payload: unknown): readonly NormalizedChannelEvent[];
  normalizeOutgoing(message: NormalizedChannelMessage): Readonly<Record<string, unknown>>;
  health(connection: ChannelProviderConnection, signal: AbortSignal): Promise<Readonly<Record<string, unknown>>>;
  send(connection: ChannelProviderConnection, payload: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<ChannelSendResult>;
  uploadMedia(connection: ChannelProviderConnection, input: { content: Buffer; mimeType: string; fileName?: string }, signal: AbortSignal): Promise<{ providerMediaId: string }>;
  downloadMedia(connection: ChannelProviderConnection, providerMediaId: string, signal: AbortSignal): Promise<{ content: Buffer; mimeType: string; checksum: string }>;
}
