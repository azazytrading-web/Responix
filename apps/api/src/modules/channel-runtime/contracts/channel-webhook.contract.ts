export interface ChannelWebhookVerification {
  mode: string;
  token: string;
  challenge: string;
}

export interface ChannelWebhookVerificationResult {
  valid: boolean;
  challenge?: string;
}

export interface ChannelWebhookEnvelope {
  pathKey: string;
  rawBody: Buffer;
  payload: unknown;
  signature: string;
  timestamp?: string;
  headers: Readonly<Record<string, string | undefined>>;
}

export interface ChannelSignatureVerifier {
  verify(connection: ChannelProviderConnection,
    envelope: ChannelWebhookEnvelope): Promise<boolean>;
}
import type { ChannelProviderConnection } from "./channel-provider.contract";

