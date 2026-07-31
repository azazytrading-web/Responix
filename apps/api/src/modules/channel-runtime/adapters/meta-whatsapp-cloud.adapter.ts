import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";
import { ChannelMessageType } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ChannelProviderAdapter, ChannelProviderConnection, ChannelSendResult } from "../contracts/channel-provider.contract";
import type { ChannelWebhookVerification } from "../contracts/channel-webhook.contract";
import { ChannelCapability, type ChannelProviderCapabilities, type NormalizedChannelAttachment, type NormalizedChannelEvent, type NormalizedChannelMessage } from "../channel-runtime.types";

type Json = Record<string, unknown>;

@Injectable()
export class MetaWhatsappCloudAdapter implements ChannelProviderAdapter {
  readonly key = "whatsapp";

  capabilities(): ChannelProviderCapabilities {
    return Object.freeze({ supported: new Set([ChannelCapability.TEXT, ChannelCapability.IMAGE, ChannelCapability.VIDEO,
      ChannelCapability.AUDIO, ChannelCapability.VOICE, ChannelCapability.DOCUMENT, ChannelCapability.CONTACTS,
      ChannelCapability.LOCATION, ChannelCapability.STICKERS, ChannelCapability.BUTTONS, ChannelCapability.LISTS,
      ChannelCapability.QUICK_REPLIES, ChannelCapability.TEMPLATES, ChannelCapability.INTERACTIVE,
      ChannelCapability.REACTIONS, ChannelCapability.DELETES, ChannelCapability.QUOTING, ChannelCapability.FORWARDING,
      ChannelCapability.WEBHOOKS, ChannelCapability.HEALTH, ChannelCapability.MEDIA_UPLOAD, ChannelCapability.MEDIA_DOWNLOAD]),
      limits: Object.freeze({ maximumMediaBytes: 100 * 1024 * 1024, maximumTextCharacters: 4096 }),
      metadata: Object.freeze({ transport: "https", webhookSignatures: "hmac-sha256", streaming: false }) });
  }
  validateConfiguration(input: Readonly<Record<string, unknown>>): readonly string[] {
    const failures: string[] = [];
    if (!/^\d+$/.test(this.string(input.businessAccountId))) failures.push("businessAccountId");
    if (!/^\d+$/.test(this.string(input.phoneNumberId))) failures.push("phoneNumberId");
    if (!/^v\d{2,3}\.\d+$/.test(this.string(input.apiVersion))) failures.push("apiVersion");
    return Object.freeze(failures);
  }
  verifyWebhook(connection: ChannelProviderConnection, input: ChannelWebhookVerification) {
    const expected = Buffer.from(connection.credentials.get("verifyToken")); const supplied = Buffer.from(input.token);
    return Promise.resolve({ valid: input.mode === "subscribe" && expected.length === supplied.length && timingSafeEqual(expected, supplied),
      ...(input.challenge ? { challenge: input.challenge } : {}) });
  }
  verifySignature(connection: ChannelProviderConnection, rawBody: Buffer, signature: string): Promise<boolean> {
    const supplied = signature.toLowerCase();
    if (!/^sha256=[a-f0-9]{64}$/.test(supplied)) return Promise.resolve(false);
    const expected = `sha256=${createHmac("sha256", connection.credentials.get("appSecret")).update(rawBody).digest("hex")}`;
    return Promise.resolve(timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
  }
  normalizeIncoming(payload: unknown): readonly NormalizedChannelMessage[] {
    const root = this.object(payload); const entries = this.array(root.entry); const output: NormalizedChannelMessage[] = [];
    for (const entry of entries) for (const change of this.array(this.object(entry).changes)) {
      const value = this.object(this.object(change).value); const metadata = this.object(value.metadata);
      for (const raw of this.array(value.messages)) {
        const message = this.object(raw); const rawType = this.string(message.type, "unknown"); const body = this.object(message[rawType]);
        const context = this.object(message.context); const interactiveType = this.string(body.type);
        const type = body.voice === true ? ChannelMessageType.VOICE : context.forwarded === true || context.frequently_forwarded === true ?
          ChannelMessageType.FORWARD : context.id ? ChannelMessageType.REPLY : rawType === "interactive" && interactiveType === "list_reply" ?
            ChannelMessageType.LIST : this.type(rawType);
        output.push(Object.freeze({ providerMessageId: this.string(message.id), externalUserId: this.string(message.from),
          externalConversationId: this.string(message.from), direction: "INCOMING" as const, type,
          ...(type === ChannelMessageType.TEXT ? { text: this.string(this.object(message.text).body) } : {}),
          ...(this.object(message.context).id ? { replyToProviderMessageId: String(this.object(message.context).id) } : {}),
          timestamp: new Date(Number(message.timestamp ?? 0) * 1000), attachments: this.attachments(type, body),
          content: Object.freeze(body), metadata: Object.freeze({ phoneNumberId: metadata.phone_number_id,
            displayPhoneNumber: metadata.display_phone_number, referral: message.referral,
            forwarded: this.object(message.context).forwarded === true,
            frequentlyForwarded: this.object(message.context).frequently_forwarded === true }) }));
      }
    }
    return Object.freeze(output);
  }
  webhookMetadata(payload: unknown, timestampHeader?: string) {
    const root = this.object(payload); const entry = this.object(this.array(root.entry)[0]);
    const value = this.object(this.object(this.array(entry.changes)[0]).value); const message = this.object(this.array(value.messages)[0]);
    const status = this.object(this.array(value.statuses)[0]); const timestampValue = timestampHeader && /^\d{10,13}$/.test(timestampHeader) ? timestampHeader : this.string(message.timestamp ?? status.timestamp);
    if (!/^\d{10,13}$/.test(timestampValue)) throw new BadRequestException("WhatsApp webhook timestamp is missing");
    const occurredAt = new Date(Number(timestampValue) * (timestampValue.length === 10 ? 1000 : 1)); const messageId = this.string(message.id);
    const statusId = this.string(status.id); const eventId = messageId || (statusId ? `${statusId}:${this.string(status.status, "event")}:${this.string(status.timestamp, "0")}` : `${this.string(entry.id, "event")}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`);
    return { eventId, occurredAt };
  }
  normalizeEvents(payload: unknown): readonly NormalizedChannelEvent[] {
    const output: NormalizedChannelEvent[] = []; const root = this.object(payload);
    for (const entry of this.array(root.entry)) for (const change of this.array(this.object(entry).changes)) {
      const changeRecord = this.object(change); const value = this.object(changeRecord.value);
      for (const raw of this.array(value.statuses)) { const status = this.object(raw); const providerMessageId = this.string(status.id);
        const deliveryState = ({ sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED", deleted: "DELETED" } as const)[this.string(status.status)] ?? "UNKNOWN";
        output.push(Object.freeze({ kind: "DELIVERY", type: `delivery.${this.string(status.status, "unknown")}`, providerMessageId,
          deliveryState, occurredAt: new Date(Number(this.string(status.timestamp, "0")) * 1000), payload: Object.freeze(status) })); }
      const field = this.string(changeRecord.field); if (field && field !== "messages") output.push(Object.freeze({ kind: "PROVIDER",
        type: field, occurredAt: new Date(), payload: Object.freeze(value) }));
    }
    return Object.freeze(output);
  }
  normalizeOutgoing(message: NormalizedChannelMessage): Readonly<Record<string, unknown>> {
    const base: Json = { messaging_product: "whatsapp", recipient_type: "individual", to: message.externalUserId };
    if (message.replyToProviderMessageId) base.context = { message_id: message.replyToProviderMessageId };
    const content = { ...message.content };
    switch (message.type) {
      case "TEXT": return Object.freeze({ ...base, type: "text", text: { body: message.text ?? "", preview_url: false } });
      case "IMAGE": case "VIDEO": case "AUDIO": case "VOICE": case "DOCUMENT": case "STICKER": {
        const mediaType = message.type === "VOICE" ? "audio" : message.type.toLowerCase();
        return Object.freeze({ ...base, type: mediaType, [mediaType]: content });
      }
      case "LOCATION": return Object.freeze({ ...base, type: "location", location: content });
      case "CONTACT": return Object.freeze({ ...base, type: "contacts", contacts: content.contacts ?? [] });
      case "TEMPLATE": return Object.freeze({ ...base, type: "template", template: content });
      case "REACTION": return Object.freeze({ ...base, type: "reaction", reaction: content });
      case "BUTTON": case "LIST": case "INTERACTIVE": return Object.freeze({ ...base, type: "interactive", interactive: content });
      case "REPLY": case "QUOTE": return Object.freeze({ ...base, type: "text", text: { body: message.text ?? this.string(content.text), preview_url: false } });
      default: throw new BadRequestException(`Unsupported outgoing WhatsApp message type ${message.type}`);
    }
  }
  async health(connection: ChannelProviderConnection, signal: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
    this.assert(connection); const response = await connection.transport.request({ label: "Meta WhatsApp Cloud",
      url: `https://graph.facebook.com/${this.config(connection, "apiVersion")}/${this.config(connection, "phoneNumberId")}?fields=id,display_phone_number,verified_name,quality_rating`,
      method: "GET", headers: { authorization: `Bearer ${connection.credentials.get("accessToken")}` }, maximumResponseBytes: 1024 * 1024, signal });
    if (response.status < 200 || response.status >= 300) throw new BadGatewayException("WhatsApp connection health check failed");
    return Object.freeze(this.parse(response.body));
  }
  async send(connection: ChannelProviderConnection, payload: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<ChannelSendResult> {
    this.assert(connection); const response = await connection.transport.request({ label: "Meta WhatsApp Cloud",
      url: `https://graph.facebook.com/${this.config(connection, "apiVersion")}/${this.config(connection, "phoneNumberId")}/messages`, method: "POST",
      headers: { authorization: `Bearer ${connection.credentials.get("accessToken")}` }, body: JSON.stringify(payload), contentType: "application/json",
      maximumResponseBytes: 2 * 1024 * 1024, signal });
    if (response.status < 200 || response.status >= 300) throw new BadGatewayException("WhatsApp message was rejected");
    const raw = this.parse(response.body); const first = this.object(this.array(raw.messages)[0]);
    if (!first.id) throw new BadGatewayException("WhatsApp response did not contain a message identifier");
    return { providerMessageId: this.string(first.id), acceptedAt: new Date(), raw: Object.freeze(raw) };
  }
  async uploadMedia(connection: ChannelProviderConnection, input: { content: Buffer; mimeType: string; fileName?: string }, signal: AbortSignal) {
    this.assert(connection); const boundary = `responix-${createHmac("sha256", connection.credentials.get("appSecret")).update(input.content).digest("hex").slice(0, 32)}`;
    const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${this.safeFileName(input.fileName ?? "attachment.bin")}"\r\nContent-Type: ${input.mimeType}\r\n\r\n`);
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`); const body = Buffer.concat([prefix, input.content, suffix]);
    const response = await connection.transport.request({ label: "Meta WhatsApp Cloud", url: `https://graph.facebook.com/${this.config(connection, "apiVersion")}/${this.config(connection, "phoneNumberId")}/media`,
      method: "POST", headers: { authorization: `Bearer ${connection.credentials.get("accessToken")}` }, body, contentType: `multipart/form-data; boundary=${boundary}`,
      maximumResponseBytes: 1024 * 1024, signal });
    if (response.status < 200 || response.status >= 300) throw new BadGatewayException("WhatsApp media upload failed");
    const id = this.string(this.parse(response.body).id); if (!id) throw new BadGatewayException("WhatsApp media upload returned no identifier");
    return { providerMediaId: id };
  }
  async downloadMedia(connection: ChannelProviderConnection, providerMediaId: string, signal: AbortSignal) {
    this.assert(connection); if (!/^[A-Za-z0-9._:-]{1,256}$/.test(providerMediaId)) throw new BadRequestException("Invalid WhatsApp media identifier");
    const metadataResponse = await connection.transport.request({ label: "Meta WhatsApp Cloud", url: `https://graph.facebook.com/${this.config(connection, "apiVersion")}/${providerMediaId}`,
      method: "GET", headers: { authorization: `Bearer ${connection.credentials.get("accessToken")}` }, maximumResponseBytes: 1024 * 1024, signal });
    if (metadataResponse.status < 200 || metadataResponse.status >= 300) throw new BadGatewayException("WhatsApp media metadata failed");
    const metadata = this.parse(metadataResponse.body); const url = this.string(metadata.url); const mimeType = this.string(metadata.mime_type, "application/octet-stream");
    if (!url) throw new BadGatewayException("WhatsApp media URL was absent");
    const media = await connection.transport.request({ label: "Meta WhatsApp Cloud", url, method: "GET", headers: { authorization: `Bearer ${connection.credentials.get("accessToken")}` },
      responseType: "binary", maximumResponseBytes: 100 * 1024 * 1024, signal });
    if (media.status < 200 || media.status >= 300) throw new BadGatewayException("WhatsApp media download failed");
    const content = Buffer.from(media.body, "base64"); const checksum = createHash("sha256").update(content).digest("hex");
    return { content, mimeType, checksum };
  }
  private assert(connection: ChannelProviderConnection) { const failures = [...this.validateConfiguration(connection.configuration)];
    for (const name of ["accessToken", "appSecret"]) if (!connection.credentials.has(name)) failures.push(name);
    if (failures.length) throw new BadRequestException({ message: "Invalid WhatsApp configuration", fields: failures }); }
  private attachments(type: ChannelMessageType, body: Json): readonly NormalizedChannelAttachment[] {
    if (!["IMAGE", "VIDEO", "AUDIO", "VOICE", "DOCUMENT", "STICKER"].includes(type)) return Object.freeze([]);
    return Object.freeze([Object.freeze({ providerMediaId: body.id ? this.string(body.id) : undefined,
      fileName: body.filename ? this.string(body.filename) : undefined, mimeType: this.string(body.mime_type, "application/octet-stream"),
      checksum: body.sha256 ? this.string(body.sha256) : undefined, caption: body.caption ? this.string(body.caption) : undefined,
      metadata: Object.freeze({ voice: body.voice === true }) })]);
  }
  private type(value: string): ChannelMessageType { const map: Record<string, ChannelMessageType> = {
    text: "TEXT", image: "IMAGE", video: "VIDEO", audio: "AUDIO", document: "DOCUMENT", sticker: "STICKER",
    location: "LOCATION", contacts: "CONTACT", reaction: "REACTION", button: "BUTTON", interactive: "INTERACTIVE",
    order: "LIST", referral: "REFERRAL" }; return map[value] ?? "UNKNOWN"; }
  private parse(value: string): Json { try { return this.object(JSON.parse(value)); } catch { throw new BadGatewayException("WhatsApp returned invalid JSON"); } }
  private object(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
  private array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
  private string(value: unknown, fallback = ""): string { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
  private safeFileName(value: string): string { return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180) || "attachment.bin"; }
  private config(connection: ChannelProviderConnection, name: string): string { return this.string(connection.configuration[name]); }
}
