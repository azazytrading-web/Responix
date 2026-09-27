import { BadGatewayException, BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ChannelMessageType } from "@prisma/client";
import type { ChannelProviderAdapter, ChannelProviderConnection, ChannelSendResult } from "../contracts/channel-provider.contract";
import type { ChannelProviderCapabilities, NormalizedChannelMessage } from "../channel-runtime.types";
import { ChannelCapability } from "../channel-runtime.types";
import { BaileysWhatsappSessionManager } from "../baileys-whatsapp.session-manager";
import { BaileysDiagnosticsService } from "../baileys-diagnostics.service";

const BAILEYS_PROVIDER_KEY = "baileys";

@Injectable()
export class BaileysWhatsappAdapter implements ChannelProviderAdapter {
  readonly key = BAILEYS_PROVIDER_KEY;
  private readonly logger = new Logger(BaileysWhatsappAdapter.name);

  constructor(private readonly sessionManager: BaileysWhatsappSessionManager, private readonly diagnosticsService: BaileysDiagnosticsService) {}

  capabilities(): ChannelProviderCapabilities {
    return Object.freeze({ supported: new Set([ChannelCapability.TEXT, ChannelCapability.HEALTH]),
      limits: Object.freeze({ maximumTextCharacters: 4096 }), metadata: Object.freeze({ transport: "socket", webhookSignatures: "none", streaming: false }) });
  }

  validateConfiguration(input: Readonly<Record<string, unknown>>): readonly string[] {
    const failures: string[] = [];
    const providerKey = this.string(input.providerKey);
    if (providerKey && providerKey !== BAILEYS_PROVIDER_KEY) failures.push("providerKey");
    return Object.freeze(failures);
  }

  verifyWebhook(connection: ChannelProviderConnection, input: unknown): Promise<{ valid: boolean; challenge?: string }> {
    return Promise.resolve({ valid: false });
  }

  verifySignature(connection: ChannelProviderConnection, rawBody: Buffer, signature: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  normalizeIncoming(payload: unknown): readonly NormalizedChannelMessage[] {
    throw new BadRequestException("Baileys adapter does not support webhook-based incoming delivery");
  }

  webhookMetadata(): { eventId: string; occurredAt: Date } {
    throw new BadRequestException("Baileys adapter does not support webhook-based incoming delivery");
  }

  normalizeEvents(): readonly [] {
    return Object.freeze([]);
  }

  normalizeOutgoing(message: NormalizedChannelMessage): Readonly<Record<string, unknown>> {
    if (message.type !== ChannelMessageType.TEXT) {
      throw new BadRequestException(`Unsupported outgoing WhatsApp message type ${message.type}`);
    }
    return Object.freeze({ type: "text", to: message.externalUserId, text: message.text ?? "" });
  }

  async health(connection: ChannelProviderConnection, signal: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
    const status = await this.sessionManager.getConnectionStatus(connection);
    return Object.freeze({ state: status.status, qrRequired: status.qr !== undefined, qr: status.qr ?? undefined });
  }

  async send(connection: ChannelProviderConnection, payload: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<ChannelSendResult> {
    if (payload.type !== "text") throw new BadRequestException("Baileys provider supports only text messages");
    try {
      const result = await this.sessionManager.sendMessage(connection, payload, signal);
      this.diagnosticsService.record(connection.id, "DELIVERED", "Provider accepted outbound message");
      return { providerMessageId: this.string(result?.key?.id), acceptedAt: new Date(), raw: Object.freeze(result ?? {}) };
    } catch (error) {
      this.logger.error({ event: "BAILEYS_ERROR", connectionId: connection.id, message: (error instanceof Error ? error.message : "unknown") });
      this.diagnosticsService.record(connection.id, "ERROR", this.safeError(error));
      if (error instanceof BadRequestException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(error instanceof Error ? error.message : "WhatsApp message was rejected");
    }
  }

  async uploadMedia(): Promise<{ providerMediaId: string }> {
    throw new BadRequestException("Baileys media upload is not supported yet");
  }

  async downloadMedia(): Promise<{ content: Buffer; mimeType: string; checksum: string }> {
    throw new BadRequestException("Baileys media download is not supported yet");
  }

  diagnostics(connection: ChannelProviderConnection) { return this.sessionManager.snapshot(connection); }
  reconnect(connection: ChannelProviderConnection) { return this.sessionManager.reconnectNow(connection); }
  disconnect(connection: ChannelProviderConnection) { return this.sessionManager.disconnect(connection); }
  newPairing(connection: ChannelProviderConnection) { return this.sessionManager.startNewPairing(connection); }

  private string(value: unknown, fallback = ""): string {
    return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
  }
  private safeError(value: unknown) {
    const message = value instanceof Error ? value.message : "Outbound send failed";
    return message.replace(/\b\d{7,15}\b/g, "[redacted]").replace(/[\w.+-]+@(?:s\.whatsapp\.net|g\.us)/gi, "[redacted-jid]");
  }
}
