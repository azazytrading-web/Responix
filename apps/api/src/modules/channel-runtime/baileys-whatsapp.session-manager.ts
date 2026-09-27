import { Injectable, Logger } from "@nestjs/common";
import pino from "pino";
import { join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { ChannelProviderConnection } from "./contracts/channel-provider.contract";
import { BaileysWhatsappIncomingProcessor } from "./baileys-whatsapp.incoming-processor";
import { loadBaileys } from "./baileys-loader";
import type { BaileysSocket } from "./baileys-loader";
import type { NormalizedChannelMessage } from "./channel-runtime.types";
import { ChannelMessageType } from "@prisma/client";
import { BaileysDiagnosticsService } from "./baileys-diagnostics.service";

type BaileysSession = {
  socket: BaileysSocket | null;
  status: "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "RECONNECTING" | "QR_REQUIRED" | "LOGGED_OUT" | "ERROR";
  qr?: string;
  saveCreds?: () => Promise<void>;
  loggedOutCode?: number;
  reconnectAttempts: number;
  intentionalDisconnected: boolean;
  lastStateChangeAt: string;
  lastError?: string;
};

type BaileysOutgoingPayload = { type: "text"; to: string; text: string };

type MessagesUpsertEvent = { messages: Record<string, any>[]; type: "notify" | "append" };

@Injectable()
export class BaileysWhatsappSessionManager {
  private readonly logger = new Logger(BaileysWhatsappSessionManager.name);
  private static readonly sessions = new Map<string, BaileysSession>();
  private static readonly socketCreations = new Map<string, Promise<BaileysSocket>>();
  private readonly apiRoot = this.findApiRoot(__dirname);
  private readonly sessionRoot = process.env.BAILEYS_SESSION_DIR
    ? resolve(this.apiRoot, process.env.BAILEYS_SESSION_DIR)
    : join(this.apiRoot, "data", "baileys-sessions");

  constructor(private readonly processor: BaileysWhatsappIncomingProcessor, private readonly diagnostics: BaileysDiagnosticsService) {}

  async getConnectionStatus(connection: ChannelProviderConnection) {
    const entry = BaileysWhatsappSessionManager.sessions.get(connection.id);
    if ((!entry || !entry.socket) && !entry?.intentionalDisconnected && entry?.status !== "LOGGED_OUT") {
      await this.ensureSocket(connection);
    }
    const result = BaileysWhatsappSessionManager.sessions.get(connection.id);
    return { status: result?.status ?? "DISCONNECTED", qr: result?.qr };
  }

  async sendMessage(connection: ChannelProviderConnection, payload: Readonly<Record<string, unknown>>, signal: AbortSignal) {
    const data = this.validatePayload(payload);
    const socket = await this.ensureSocket(connection);
    if (!socket) throw new Error("Baileys socket is unavailable");
    const jid = this.normalizeJid(data.to);
    return socket.sendMessage(jid, { text: data.text });
  }

  private validatePayload(payload: Readonly<Record<string, unknown>>): BaileysOutgoingPayload {
    if (payload.type !== "text") throw new Error("Baileys must receive a text payload");
    const to = typeof payload.to === "string" ? payload.to : "";
    const text = typeof payload.text === "string" ? payload.text : "";
    if (!to) throw new Error("Baileys outgoing payload is missing destination");
    return { type: "text", to, text };
  }

  private normalizeJid(value: string) {
    return value.includes("@") ? value : `${value}@s.whatsapp.net`;
  }

  private async ensureSocket(connection: ChannelProviderConnection) {
    const existing = BaileysWhatsappSessionManager.sessions.get(connection.id);
    if (existing?.socket && existing.status !== "LOGGED_OUT") return existing.socket;
    const pending = BaileysWhatsappSessionManager.socketCreations.get(connection.id);
    if (pending) return pending;
    const creation = this.createSocket(connection).catch((error) => {
      const failed = BaileysWhatsappSessionManager.sessions.get(connection.id) ?? this.emptySession("ERROR");
      failed.socket = null; failed.status = "ERROR"; failed.lastStateChangeAt = new Date().toISOString();
      failed.lastError = this.safeError(error);
      BaileysWhatsappSessionManager.sessions.set(connection.id, failed);
      this.diagnostics.record(connection.id, "ERROR", failed.lastError);
      throw error;
    }).finally(() => {
      if (BaileysWhatsappSessionManager.socketCreations.get(connection.id) === creation) {
        BaileysWhatsappSessionManager.socketCreations.delete(connection.id);
      }
    });
    BaileysWhatsappSessionManager.socketCreations.set(connection.id, creation);
    return creation;
  }

  async snapshot(connection: ChannelProviderConnection) {
    const session = BaileysWhatsappSessionManager.sessions.get(connection.id);
    const events = this.diagnostics.recent(connection.id);
    const lastInbound = this.diagnostics.latest(connection.id, ["INBOUND"]);
    const lastOutbound = this.diagnostics.latest(connection.id, ["OUTBOUND", "DELIVERED"]);
    const lastError = this.diagnostics.latest(connection.id, ["ERROR"]);
    return Object.freeze({
      state: session?.status ?? "DISCONNECTED",
      qrRequired: session?.status === "QR_REQUIRED" && Boolean(session.qr),
      socketPresent: Boolean(session?.socket),
      sessionPresent: Boolean(session) || existsSync(this.authPath(connection)),
      lastStateChangeAt: session?.lastStateChangeAt,
      lastInboundAt: lastInbound?.at,
      lastOutboundAt: lastOutbound?.at,
      lastError: session?.lastError ?? lastError?.detail,
      reconnectAttempts: session?.reconnectAttempts ?? 0,
      recentEvents: events
    });
  }

  async reconnectNow(connection: ChannelProviderConnection) {
    const current = BaileysWhatsappSessionManager.sessions.get(connection.id);
    if (current?.socket) {
      current.intentionalDisconnected = true;
      current.socket.end(new Error("User requested reconnect"));
      current.socket = null;
    }
    const next = current ?? this.emptySession("RECONNECTING");
    next.status = "RECONNECTING"; next.intentionalDisconnected = false; next.qr = undefined;
    next.lastStateChangeAt = new Date().toISOString(); next.lastError = undefined;
    BaileysWhatsappSessionManager.sessions.set(connection.id, next);
    this.diagnostics.record(connection.id, "SESSION", "Reconnect requested");
    await this.ensureSocket(connection);
    return this.snapshot(connection);
  }

  async disconnect(connection: ChannelProviderConnection) {
    const current = BaileysWhatsappSessionManager.sessions.get(connection.id) ?? this.emptySession("DISCONNECTED");
    current.intentionalDisconnected = true;
    current.socket?.end(new Error("User requested disconnect"));
    current.socket = null; current.status = "DISCONNECTED"; current.qr = undefined;
    current.lastStateChangeAt = new Date().toISOString();
    BaileysWhatsappSessionManager.sessions.set(connection.id, current);
    this.diagnostics.record(connection.id, "SESSION", "Intentionally disconnected; pairing retained");
    return this.snapshot(connection);
  }

  async startNewPairing(connection: ChannelProviderConnection) {
    const current = BaileysWhatsappSessionManager.sessions.get(connection.id);
    if (current) current.intentionalDisconnected = true;
    try { await current?.socket?.logout(); } catch { current?.socket?.end(new Error("Pair new device")); }
    BaileysWhatsappSessionManager.sessions.delete(connection.id);
    await rm(this.authPath(connection), { recursive: true, force: true });
    this.diagnostics.record(connection.id, "SESSION", "Existing pairing removed; new pairing requested");
    await this.ensureSocket(connection);
    return this.snapshot(connection);
  }

  private async createSocket(connection: ChannelProviderConnection) {
    const previous = BaileysWhatsappSessionManager.sessions.get(connection.id);
    const path = this.authPath(connection);
    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = await loadBaileys();
    const { state, saveCreds } = await useMultiFileAuthState(path);
    const { version } = await fetchLatestBaileysVersion();
    const pinoLogger = pino({ level: "silent" }) as unknown as { child: (...args: unknown[]) => unknown };
    const socket = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: pinoLogger as any,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });
    BaileysWhatsappSessionManager.sessions.set(connection.id, { socket, status: "RECONNECTING", qr: previous?.qr, saveCreds,
      loggedOutCode: DisconnectReason.loggedOut, reconnectAttempts: previous?.reconnectAttempts ?? 0,
      intentionalDisconnected: false, lastStateChangeAt: new Date().toISOString() });
    this.diagnostics.record(connection.id, "SOCKET", "Socket created");
    socket.ev.on("connection.update", (update) => this.handleConnectionUpdate(connection, socket, update));
    socket.ev.on("creds.update", async () => {
      try { await saveCreds(); } catch (error) { this.logger.warn({ event: "BAILEYS_SAVE_CREDS_FAILED", connectionId: connection.id, error }); }
    });
    socket.ev.on("messages.upsert", async (event: MessagesUpsertEvent) => {
      await this.handleMessagesUpsert(connection, event);
    });
    return socket;
  }

  private async handleConnectionUpdate(connection: ChannelProviderConnection, socket: BaileysSocket, update: { qr?: string; connection?: string; lastDisconnect?: { error?: unknown } }) {
    const record = BaileysWhatsappSessionManager.sessions.get(connection.id);
    if (!record || record.socket !== socket) return;
    const next = { ...record };
    if (update.qr) {
      next.qr = update.qr;
      next.status = "QR_REQUIRED";
      next.lastStateChangeAt = new Date().toISOString();
      this.diagnostics.record(connection.id, "QR", "QR available");
    }
    if (update.connection === "connecting") {
      next.status = "CONNECTING";
      next.lastStateChangeAt = new Date().toISOString();
      this.diagnostics.record(connection.id, "SOCKET", "Connecting");
    }
    if (update.connection === "open") {
      next.status = "CONNECTED";
      next.qr = undefined;
      next.reconnectAttempts = 0;
      next.lastStateChangeAt = new Date().toISOString();
      next.lastError = undefined;
      this.diagnostics.record(connection.id, "SOCKET", "Connected");
    }
    if (update.connection === "close") {
      const lastDisconnect = update.lastDisconnect as { error?: unknown } | undefined;
      const loggedOut = lastDisconnect && typeof lastDisconnect === "object" && (lastDisconnect as any).error?.output?.statusCode === record.loggedOutCode;
      next.status = record.intentionalDisconnected ? "DISCONNECTED" : loggedOut ? "LOGGED_OUT" : "RECONNECTING";
      next.qr = record.intentionalDisconnected || loggedOut ? undefined : next.qr;
      next.socket = null;
      next.reconnectAttempts = record.intentionalDisconnected || loggedOut ? next.reconnectAttempts : next.reconnectAttempts + 1;
      next.lastStateChangeAt = new Date().toISOString();
      next.lastError = record.intentionalDisconnected ? undefined : loggedOut ? "WhatsApp session logged out" : "Socket closed";
      if (!record.intentionalDisconnected) {
        this.diagnostics.record(connection.id, loggedOut ? "SESSION" : "SOCKET", loggedOut ? "Logged out" : "Socket closed");
      }
    }
    BaileysWhatsappSessionManager.sessions.set(connection.id, next);
    if (update.connection === "close" && next.status !== "LOGGED_OUT" && !next.intentionalDisconnected) {
      try {
        await this.reconnect(connection, socket, next.reconnectAttempts);
      } catch (error) {
        this.logger.warn({ event: "BAILEYS_RECONNECT_FAILED", connectionId: connection.id,
          error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private async reconnect(connection: ChannelProviderConnection, closedSocket: BaileysSocket, attempt: number) {
    if (attempt > 8) {
      this.logger.warn({ event: "BAILEYS_RECONNECT_EXHAUSTED", connectionId: connection.id });
      const current = BaileysWhatsappSessionManager.sessions.get(connection.id);
      if (current) {
        current.status = "ERROR"; current.lastError = "Reconnect attempts exhausted";
        current.lastStateChangeAt = new Date().toISOString();
        this.diagnostics.record(connection.id, "ERROR", current.lastError);
      }
      return;
    }
    const delayMs = Math.min(250 * 2 ** Math.max(0, attempt - 1), 5000);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    const current = BaileysWhatsappSessionManager.sessions.get(connection.id);
    if (!current || current.socket || current.status === "LOGGED_OUT") return;
    const pending = BaileysWhatsappSessionManager.socketCreations.get(connection.id);
    if (pending) { await pending; return; }
    if (closedSocket === current.socket) return;
    await this.ensureSocket(connection);
  }

  private async handleMessagesUpsert(connection: ChannelProviderConnection, event: MessagesUpsertEvent) {
    if (!event.messages?.length || event.type !== "notify") return;
    this.diagnostics.record(connection.id, "INBOUND", `messages.upsert received (${event.messages.length})`);
    const messages = this.normalizeIncoming(event);
    if (!messages.length) return;
    for (const message of messages) this.diagnostics.record(connection.id, "NORMALIZED", `${message.type.toLowerCase()} message`, message.providerMessageId);
    try { await this.processor.processIncoming(connection, messages); } catch (error) {
      this.logger.error({ event: "BAILEYS_INCOMING_PROCESSING_FAILED", connectionId: connection.id,
        error: error instanceof Error ? error.message : error });
      this.diagnostics.record(connection.id, "ERROR", this.safeError(error));
    }
  }

  private normalizeIncoming(event: MessagesUpsertEvent): readonly NormalizedChannelMessage[] {
    return event.messages.filter((message) => !message.key?.fromMe && !!message.key?.remoteJid).map((message) => {
      const content = message.message ? (message.message as unknown as Record<string, unknown>) : {};
      const rawType = Object.keys(content)[0] ?? "unknown";
      const text = this.extractText(content, rawType);
      const replyToProviderMessageId = this.extractQuotedMessageId(content, rawType);
      const externalUserId = this.string(message.key?.participant) || this.string(message.key?.remoteJid);
      const externalConversationId = this.string(message.key?.remoteJid);
      const providerMessageId = this.string(message.key?.id);
      const timestamp = new Date(Number(message.messageTimestamp ?? Date.now()) * 1000);
      const attachments = this.extractAttachments(content, rawType, providerMessageId);
      return Object.freeze({ providerMessageId, externalUserId, externalConversationId, direction: "INCOMING" as const,
        type: this.type(rawType, content), ...(text ? { text } : {}), ...(replyToProviderMessageId ? { replyToProviderMessageId } : {}), timestamp,
        attachments: Object.freeze(attachments), content: Object.freeze(content), metadata: Object.freeze({ rawType, pushName: this.string(message.pushName) }) });
    });
  }

  private extractText(content: Record<string, unknown>, rawType: string) {
    if (rawType === "conversation") return this.string((content as { conversation?: string }).conversation);
    if (rawType === "extendedTextMessage") return this.string((content as { extendedTextMessage?: { text?: string } }).extendedTextMessage?.text);
    if (rawType === "imageMessage") return this.string((content as { imageMessage?: { caption?: string } }).imageMessage?.caption);
    if (rawType === "videoMessage") return this.string((content as { videoMessage?: { caption?: string } }).videoMessage?.caption);
    if (rawType === "documentMessage") return this.string((content as { documentMessage?: { fileName?: string } }).documentMessage?.fileName);
    return "";
  }

  private extractQuotedMessageId(content: Record<string, unknown>, rawType: string) {
    const context = (content as { extendedTextMessage?: { contextInfo?: { stanzaId?: string } } }).extendedTextMessage?.contextInfo;
    return this.string(context?.stanzaId);
  }

  private extractAttachments(content: Record<string, unknown>, rawType: string, providerMessageId: string) {
    const mediaTypes = new Set(["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"]);
    if (!mediaTypes.has(rawType)) return [] as const;
    const media = (content as { [key: string]: any })[rawType] ?? {};
    return Object.freeze([Object.freeze({ providerMediaId: undefined, reference: undefined,
      fileName: this.string(media.fileName), mimeType: this.string(media.mimetype),
      sizeBytes: typeof media.fileLength === "number" ? media.fileLength : undefined,
      checksum: undefined, caption: this.string(media.caption), metadata: Object.freeze({ rawType, providerMessageId }) })]);
  }

  private type(rawType: string, content: Record<string, unknown>) {
    switch (rawType) {
      case "conversation":
      case "extendedTextMessage":
        return ChannelMessageType.TEXT;
      case "imageMessage":
        return ChannelMessageType.IMAGE;
      case "videoMessage":
        return ChannelMessageType.VIDEO;
      case "audioMessage":
        return (content as { audioMessage?: { ptt?: boolean } }).audioMessage?.ptt ? ChannelMessageType.VOICE : ChannelMessageType.AUDIO;
      case "documentMessage":
        return ChannelMessageType.DOCUMENT;
      case "stickerMessage":
        return ChannelMessageType.STICKER;
      default:
        return ChannelMessageType.TEXT;
    }
  }

  private string(value: unknown, fallback = "") { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
  private findApiRoot(start: string) {
    let current = resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      const manifest = join(current, "package.json");
      if (existsSync(manifest)) {
        try {
          const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
          if (parsed.name === "@responix/api") return current;
        } catch { /* Continue toward the repository root. */ }
      }
      const parent = resolve(current, "..");
      if (parent === current) break;
      current = parent;
    }
    throw new Error("Unable to resolve the Responix API root for Baileys session storage");
  }
  private safeError(value: unknown) {
    const message = value instanceof Error ? value.message : "Baileys session operation failed";
    return message.replace(/\b\d{7,15}\b/g, "[redacted]").replace(/[\w.+-]+@(?:s\.whatsapp\.net|g\.us)/gi, "[redacted-jid]");
  }
  private authPath(connection: ChannelProviderConnection) { return join(this.sessionRoot, connection.workspaceId, connection.id); }
  private emptySession(status: BaileysSession["status"]): BaileysSession {
    return { socket: null, status, reconnectAttempts: 0, intentionalDisconnected: true, lastStateChangeAt: new Date().toISOString() };
  }
}
