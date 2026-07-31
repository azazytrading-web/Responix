import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ChannelConnectionState, ChannelMessageDirection, ChannelMessageState, Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { ProviderCredentialCryptoService } from "../ai/security/provider-credential-crypto.service";
import type { ChannelListQueryDto, ChannelMessageListQueryDto, CreateChannelConnectionDto, CreateChannelDto, UploadChannelAttachmentDto } from "./dto/channel-runtime.dto";
import type { NormalizedChannelMessage } from "./channel-runtime.types";
import { ChannelMessageStateMachine } from "./channel-message.state-machine";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class ChannelRuntimeRepository {
  constructor(private readonly prisma: PrismaService, private readonly crypto: ProviderCredentialCryptoService,
    private readonly machine: ChannelMessageStateMachine) {}

  async createChannel(workspaceId: string, actorId: string, dto: CreateChannelDto) {
    const providerKey = dto.providerKey ?? "whatsapp";
    const provider = await this.prisma.channelProvider.findUnique({ where: { name: providerKey } });
    if (!provider?.enabled) throw new NotFoundException(`Channel provider ${providerKey} is unavailable`);
    const compatibilityVersion = dto.compatibilityVersion ?? "1.0";
    const configurationHash = this.hash({ provider: provider.name, compatibilityVersion });
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.channel.create({ data: { workspaceId, providerId: provider.id, name: dto.name,
        compatibilityVersion, configurationHash, checksum: this.hash({ workspaceId, name: dto.name, configurationHash }),
        createdById: actorId, updatedById: actorId }, select: this.channelSelect });
      const snapshot = { name: dto.name, provider: provider.name, compatibilityVersion };
      await tx.channelSnapshot.create({ data: { workspaceId, channelId: value.id, revision: 1, snapshot: json(snapshot),
        hash: this.hash(snapshot), checksum: this.hash({ workspaceId, channelId: value.id, snapshot }), createdById: actorId } });
      await this.audit(tx, workspaceId, actorId, value.id, "channel.created", { configurationHash });
      return value;
    });
  }

  async createConnection(workspaceId: string, actorId: string, channelId: string, dto: CreateChannelConnectionDto) {
    await this.requireChannel(this.prisma, workspaceId, channelId);
    const publicConfiguration = { businessAccountId: dto.businessAccountId, phoneNumberId: dto.phoneNumberId,
      displayPhoneNumber: dto.displayPhoneNumber, apiVersion: dto.apiVersion };
    return this.prisma.$transaction(async (tx) => {
      const connection = await tx.channelConnection.create({ data: { workspaceId, channelId,
        ...publicConfiguration, webhookPathKey: randomUUID(), encryptedAccessToken: this.crypto.encrypt(dto.accessToken),
        accessTokenFingerprint: this.crypto.fingerprint(dto.accessToken), encryptedVerifyToken: this.crypto.encrypt(dto.verifyToken),
        encryptedAppSecret: this.crypto.encrypt(dto.appSecret), capabilities: json({}), createdById: actorId }, select: this.connectionSelect });
      const hash = this.hash(publicConfiguration);
      await tx.channelConfiguration.create({ data: { connectionId: connection.id, revision: 1,
        configuration: json(publicConfiguration), hash, checksum: this.hash({ connectionId: connection.id, hash }), createdById: actorId } });
      await this.audit(tx, workspaceId, actorId, channelId, "whatsapp.connection.created",
        { connectionId: connection.id, phoneNumberId: dto.phoneNumberId, accessTokenFingerprint: this.crypto.fingerprint(dto.accessToken) });
      return connection;
    });
  }

  async createProviderConnection(workspaceId: string, actorId: string, channelId: string, input: {
    configuration: Record<string, unknown>; credentials: readonly { name: string; secret: string }[]; displayAddress?: string }) {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, workspaceId }, include: { provider: true } });
    if (!channel) throw new NotFoundException("Channel was not found"); const webhookPathKey = randomUUID();
    return this.prisma.$transaction(async (tx) => { const connection = await tx.channelConnection.create({ data: { workspaceId, channelId,
      state: "DISCONNECTED", webhookPathKey, displayPhoneNumber: input.displayAddress, providerConfiguration: json(input.configuration),
      capabilities: json({}), createdById: actorId }, select: this.connectionSelect });
      for (const credential of input.credentials) await tx.channelCredentialReference.create({ data: { workspaceId, connectionId: connection.id,
        name: credential.name, version: 1, encryptedSecret: this.crypto.encrypt(credential.secret), fingerprint: this.crypto.fingerprint(credential.secret), createdById: actorId } });
      const hash = this.hash(input.configuration); await tx.channelConfiguration.create({ data: { connectionId: connection.id, revision: 1,
        configuration: json(input.configuration), hash, checksum: this.hash({ connectionId: connection.id, hash }), createdById: actorId } });
      await tx.channelWebhook.create({ data: { workspaceId, connectionId: connection.id, pathKey: webhookPathKey,
        signatureType: this.string(input.configuration.signatureType, "provider") } });
      await tx.channelTransport.create({ data: { connectionId: connection.id, kind: "HTTPS", configuration: json({ provider: channel.provider.name }) } });
      await tx.channelRetryPolicy.create({ data: { connectionId: connection.id, retryableCodes: ["408", "429", "5xx", "NETWORK"] } });
      for (const [scope, maximum, burst] of [["WORKSPACE", 1000, 200], ["CONNECTION", 250, 50], ["CONVERSATION", 60, 10]] as const)
        await tx.channelRateLimit.create({ data: { connectionId: connection.id, scope, windowMs: 60000, maximum, burst } });
      await this.audit(tx, workspaceId, actorId, channelId, "channel.connection.created", { connectionId: connection.id,
        provider: channel.provider.name, configurationHash: hash, credentialFingerprints: input.credentials.map((item) => this.crypto.fingerprint(item.secret)) });
      return connection; });
  }

  async connectionSecret(workspaceId: string, id: string) {
    const value = await this.prisma.channelConnection.findFirst({ where: { id, workspaceId }, include: { channel: true } });
    if (!value) throw new NotFoundException("Channel connection was not found");
    if (!value.encryptedAccessToken || !value.encryptedVerifyToken || !value.encryptedAppSecret) throw new NotFoundException("Legacy channel credentials were not found");
    return { record: value, accessToken: this.crypto.decrypt(value.encryptedAccessToken),
      verifyToken: this.crypto.decrypt(value.encryptedVerifyToken), appSecret: this.crypto.decrypt(value.encryptedAppSecret) };
  }
  async connectionByWebhook(pathKey: string) {
    const value = await this.prisma.channelConnection.findUnique({ where: { webhookPathKey: pathKey }, include: { channel: true } });
    if (!value) throw new NotFoundException("Webhook connection was not found");
    if (!value.encryptedAccessToken || !value.encryptedVerifyToken || !value.encryptedAppSecret) throw new NotFoundException("Legacy channel credentials were not found");
    return { record: value, accessToken: this.crypto.decrypt(value.encryptedAccessToken),
      verifyToken: this.crypto.decrypt(value.encryptedVerifyToken), appSecret: this.crypto.decrypt(value.encryptedAppSecret) };
  }
  connectionContext(workspaceId: string, id: string) { return this.prisma.channelConnection.findFirst({ where: { id, workspaceId },
    include: { channel: { include: { provider: true } } } }).then((value) => { if (!value) throw new NotFoundException("Channel connection was not found"); return value; }); }
  connectionContextByWebhook(pathKey: string) { return this.prisma.channelConnection.findUnique({ where: { webhookPathKey: pathKey },
    include: { channel: { include: { provider: true } } } }).then((value) => { if (!value) throw new NotFoundException("Webhook connection was not found"); return value; }); }
  async updateHealth(workspaceId: string, actorId: string, id: string, health: unknown, state: ChannelConnectionState) {
    return this.prisma.$transaction(async (tx) => { const current = await tx.channelConnection.findFirst({ where: { id, workspaceId } });
      if (!current) throw new NotFoundException("Channel connection was not found");
      const updated = await tx.channelConnection.updateMany({ where: { id, workspaceId, stateVersion: current.stateVersion }, data: {
        state, stateVersion: { increment: 1 }, health: json(health), lastHealthCheckAt: new Date() } });
      if (updated.count !== 1) throw new ConflictException("Channel connection state changed");
      await this.audit(tx, workspaceId, actorId, current.channelId, "whatsapp.connection.health", { connectionId: id, state });
      return tx.channelConnection.findUniqueOrThrow({ where: { id }, select: this.connectionSelect }); });
  }
  async recordHealth(workspaceId: string, connectionId: string, status: ChannelConnectionState, latencyMs: number,
    capabilities: readonly string[], detail: unknown) { await this.getConnection(workspaceId, connectionId);
    return this.prisma.channelHealth.create({ data: { workspaceId, connectionId, status, latencyMs,
      capabilities: [...capabilities], detail: json(detail) } }); }
  channelProviderKey(providerId: string) { return this.prisma.channelProvider.findUnique({ where: { id: providerId }, select: { name: true, enabled: true } })
    .then((value) => { if (!value?.enabled) throw new NotFoundException("Channel provider is unavailable"); return value.name; }); }
  channelProvider(providerKey: string) { return this.prisma.channelProvider.findUnique({ where: { name: providerKey } })
    .then((value) => { if (!value?.enabled) throw new NotFoundException("Channel provider is unavailable"); return value; }); }
  async updateConfiguration(workspaceId: string, actorId: string, connectionId: string,
    configuration: Record<string, unknown>, expectedStateVersion: number) {
    return this.prisma.$transaction(async (tx) => { const connection = await tx.channelConnection.findFirst({ where: { id: connectionId, workspaceId } });
      if (!connection) throw new NotFoundException("Channel connection was not found");
      if (connection.stateVersion !== expectedStateVersion) throw new ConflictException("Channel connection state changed");
      const last = await tx.channelConfiguration.findFirst({ where: { connectionId }, orderBy: { revision: "desc" } });
      const revision = (last?.revision ?? 0) + 1; const hash = this.hash(configuration);
      const version = await tx.channelConfiguration.create({ data: { connectionId, revision, configuration: json(configuration), hash,
        checksum: this.hash({ connectionId, hash }), createdById: actorId } });
      const updated = await tx.channelConnection.updateMany({ where: { id: connectionId, workspaceId, stateVersion: expectedStateVersion },
        data: { stateVersion: { increment: 1 } } }); if (updated.count !== 1) throw new ConflictException("Channel connection state changed");
      await this.audit(tx, workspaceId, actorId, connection.channelId, "whatsapp.configuration.changed", { connectionId, revision, hash }); return version; });
  }
  async transitionConnection(workspaceId: string, actorId: string, id: string, state: ChannelConnectionState, expected: number) {
    return this.prisma.$transaction(async (tx) => { const current = await tx.channelConnection.findFirst({ where: { id, workspaceId } });
      if (!current) throw new NotFoundException("Channel connection was not found"); if (current.stateVersion !== expected) throw new ConflictException("Channel connection state changed");
      const updated = await tx.channelConnection.updateMany({ where: { id, workspaceId, stateVersion: expected }, data: { state, stateVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException("Channel connection state changed");
      await this.audit(tx, workspaceId, actorId, current.channelId, state === "DISCONNECTED" ? "whatsapp.connection.disconnected" : "whatsapp.connection.state.changed", { connectionId: id, from: current.state, to: state });
      return tx.channelConnection.findUniqueOrThrow({ where: { id }, select: this.connectionSelect }); });
  }

  async acceptWebhook(connectionId: string, eventId: string, payloadHash: string, signature: string, timestamp: Date) {
    if (Date.now() - timestamp.getTime() > 5 * 60_000 || timestamp.getTime() - Date.now() > 60_000) {
      throw new UnauthorizedException("Webhook timestamp is outside the accepted window");
    }
    try { return await this.prisma.channelWebhookReceipt.create({ data: { connectionId, eventId, payloadHash, signature } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null; throw error; }
  }
  completeWebhook(id: string) { return this.prisma.channelWebhookReceipt.update({ where: { id }, data: { processedAt: new Date() } }); }

  async persistIncoming(workspaceId: string, actorId: string, channelId: string, connectionId: string,
    message: NormalizedChannelMessage) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.channelSession.upsert({ where: { connectionId_externalUserId: { connectionId, externalUserId: message.externalUserId } },
        create: { workspaceId, channelId, connectionId, externalUserId: message.externalUserId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000), metadata: json(message.metadata) },
        update: { expiresAt: new Date(Date.now() + 24 * 60 * 60_000), metadata: json(message.metadata) } });
      let conversation = await tx.channelConversation.findUnique({ where: { channelId_externalConversationId: {
        channelId, externalConversationId: message.externalConversationId } } });
      if (!conversation) { conversation = await tx.channelConversation.create({ data: { workspaceId, channelId, sessionId: session.id,
        externalConversationId: message.externalConversationId, metadata: json(message.metadata) } });
        await this.metric(tx, channelId, { conversationCount: { increment: 1 } }); }
      const normalizedPayload = this.messagePayload(message); const payloadHash = this.hash(normalizedPayload);
      const idempotencyKey = `incoming:${message.providerMessageId ?? payloadHash}`;
      const existing = await tx.channelMessage.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } }, select: this.messageSelect });
      if (existing) return { message: existing, created: false, conversation };
      const created = await tx.channelMessage.create({ data: { workspaceId, channelId, connectionId, conversationId: conversation.id,
        direction: ChannelMessageDirection.INCOMING, type: message.type, state: ChannelMessageState.DELIVERED,
        providerMessageId: message.providerMessageId, idempotencyKey, normalizedPayload: json(normalizedPayload), payloadHash,
        checksum: this.hash({ workspaceId, channelId, payloadHash }), deliveredAt: message.timestamp }, select: this.messageSelect });
      for (const attachment of message.attachments) await tx.channelAttachment.create({ data: { workspaceId, channelId,
        messageId: created.id, providerMediaId: attachment.providerMediaId, fileName: attachment.fileName,
        mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes ?? 0, checksum: attachment.checksum ?? this.hash(attachment), metadata: json(attachment.metadata) } });
      await this.event(tx, workspaceId, channelId, created.id, "channel.message.incoming", message.providerMessageId, normalizedPayload, message.timestamp);
      await this.metric(tx, channelId, { incomingCount: { increment: 1 }, trafficBytes: { increment: Buffer.byteLength(JSON.stringify(normalizedPayload)) },
        ...(message.attachments.length ? { mediaCount: { increment: message.attachments.length } } : {}) });
      await this.audit(tx, workspaceId, actorId, channelId, "channel.message.incoming", { messageId: created.id, providerMessageId: message.providerMessageId });
      return { message: created, created: true, conversation };
    });
  }

  async queueOutgoing(workspaceId: string, actorId: string, input: { channelId: string; connectionId: string;
    recipient: string; type: NormalizedChannelMessage["type"]; text?: string; content?: Record<string, unknown>;
    idempotencyKey: string; replyToMessageId?: string }) {
    await this.requireChannel(this.prisma, workspaceId, input.channelId);
    const connection = await this.prisma.channelConnection.findFirst({ where: { id: input.connectionId, channelId: input.channelId, workspaceId } });
    if (!connection) throw new NotFoundException("Channel connection was not found");
    const session = await this.prisma.channelSession.upsert({ where: { connectionId_externalUserId: { connectionId: input.connectionId, externalUserId: input.recipient } },
      create: { workspaceId, channelId: input.channelId, connectionId: input.connectionId, externalUserId: input.recipient,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000) }, update: {} });
    const conversation = await this.prisma.channelConversation.upsert({ where: { channelId_externalConversationId: {
      channelId: input.channelId, externalConversationId: input.recipient } }, create: { workspaceId, channelId: input.channelId,
        sessionId: session.id, externalConversationId: input.recipient }, update: {} });
    const normalizedPayload = { externalUserId: input.recipient, externalConversationId: input.recipient, direction: "OUTGOING",
      type: input.type, text: input.text, content: input.content ?? {}, timestamp: new Date().toISOString() };
    const payloadHash = this.hash(normalizedPayload);
    try { return await this.prisma.$transaction(async (tx) => { const value = await tx.channelMessage.create({ data: { workspaceId,
        channelId: input.channelId, connectionId: input.connectionId, conversationId: conversation.id, direction: "OUTGOING", type: input.type,
        state: "QUEUED", idempotencyKey: input.idempotencyKey, replyToMessageId: input.replyToMessageId,
        normalizedPayload: json(normalizedPayload), payloadHash, checksum: this.hash({ workspaceId, channelId: input.channelId, payloadHash }), queuedAt: new Date() }, select: this.messageSelect });
      await this.metric(tx, input.channelId, { outgoingCount: { increment: 1 } });
      await this.audit(tx, workspaceId, actorId, input.channelId, "channel.message.queued", { messageId: value.id }); return value; }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return this.prisma.channelMessage.findUniqueOrThrow({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: input.idempotencyKey } }, select: this.messageSelect }); } throw error; }
  }

  transitionMessage(workspaceId: string, actorId: string, id: string, state: ChannelMessageState, expected: number,
    data: Prisma.ChannelMessageUpdateManyMutationInput = {}, reason?: string) {
    return this.prisma.$transaction(async (tx) => { const current = await tx.channelMessage.findFirst({ where: { id, workspaceId } });
      if (!current) throw new NotFoundException("Channel message was not found"); this.machine.assert(current.state, state);
      if (current.stateVersion !== expected) throw new ConflictException("Channel message state changed");
      const result = await tx.channelMessage.updateMany({ where: { id, workspaceId, stateVersion: expected }, data: { state,
        stateVersion: { increment: 1 }, ...data, ...(state === "SENT" ? { sentAt: new Date() } : {}),
        ...(state === "DELIVERED" ? { deliveredAt: new Date() } : {}), ...(state === "READ" ? { readAt: new Date() } : {}),
        ...(state === "FAILED" ? { failedAt: new Date() } : {}) } });
      if (result.count !== 1) throw new ConflictException("Channel message state changed");
      await tx.channelDelivery.create({ data: { messageId: id, state, occurredAt: new Date(), detail: json({ reason }) } });
      await this.metric(tx, current.channelId, {
        ...(state === "FAILED" ? { failureCount: { increment: 1 } } : {}),
        ...(state === "RETRIED" ? { retryCount: { increment: 1 } } : {}),
        ...(state === "DELIVERED" && current.sentAt ? { deliveryLatencyMs: { increment: Date.now() - current.sentAt.getTime() } } : {}),
        ...(state === "READ" && (current.deliveredAt ?? current.sentAt) ? { readLatencyMs: { increment: Date.now() - (current.deliveredAt ?? current.sentAt)!.getTime() } } : {})
      });
      await this.event(tx, workspaceId, current.channelId, id, `channel.message.${state.toLowerCase()}`, undefined, { reason }, new Date());
      await this.audit(tx, workspaceId, actorId, current.channelId, `channel.message.${state.toLowerCase()}`, { messageId: id, reason });
      return tx.channelMessage.findUniqueOrThrow({ where: { id }, select: this.messageSelect }); });
  }

  async createAttachment(workspaceId: string, actorId: string, dto: UploadChannelAttachmentDto) {
    await this.requireChannel(this.prisma, workspaceId, dto.channelId); const bytes = Buffer.from(dto.dataBase64, "base64");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    return this.prisma.$transaction(async (tx) => { const value = await tx.channelAttachment.create({ data: { workspaceId,
      channelId: dto.channelId, fileName: dto.fileName, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes, checksum,
      storageReference: `sha256:${checksum}`, content: bytes, metadata: json({ storage: "database" }) } });
      await this.metric(tx, dto.channelId, { attachmentBytes: { increment: dto.sizeBytes } });
      await this.audit(tx, workspaceId, actorId, dto.channelId, "channel.attachment.created", { attachmentId: value.id, checksum }); return value; });
  }

  async diagnostic(workspaceId: string, channelId: string, severity: string, code: string, message: string, metadata: unknown = {}) {
    await this.requireChannel(this.prisma, workspaceId, channelId); return this.prisma.channelDiagnostic.create({ data: { workspaceId, channelId,
      severity, code, message, metadata: json(metadata) } });
  }
  async providerEvent(workspaceId: string, channelId: string, type: string, payload: unknown) {
    await this.requireChannel(this.prisma, workspaceId, channelId); return this.prisma.channelEvent.create({ data: { workspaceId, channelId,
      type, payload: json(payload), payloadHash: this.hash(payload), occurredAt: new Date() } });
  }
  async upsertPresence(workspaceId: string, channelId: string, externalId: string, state: string, observedAt: Date, metadata: unknown) {
    await this.requireChannel(this.prisma, workspaceId, channelId); return this.prisma.channelPresence.upsert({ where: {
      channelId_externalId: { channelId, externalId } }, create: { workspaceId, channelId, externalId, state, observedAt, metadata: json(metadata) },
      update: { state, observedAt, metadata: json(metadata) } }); }
  async syncCapabilities(providerId: string, capabilities: readonly string[]) { return this.prisma.$transaction(async (tx) => {
    const existing = await tx.channelCapability.findMany({ where: { providerId } }); const set = new Set(capabilities);
    for (const capability of capabilities) await tx.channelCapability.upsert({ where: { providerId_capability: { providerId, capability } },
      create: { providerId, capability }, update: { enabled: true } });
    for (const item of existing) if (!set.has(item.capability)) await tx.channelCapability.update({ where: { id: item.id }, data: { enabled: false } });
    return tx.channelCapability.findMany({ where: { providerId }, orderBy: { capability: "asc" } }); }); }
  async createBatch(workspaceId: string, connectionId: string, batchKey: string, messageIds: readonly string[], scheduledAt: Date) {
    await this.getConnection(workspaceId, connectionId); const found = await this.prisma.channelMessage.count({ where: {
      workspaceId, connectionId, id: { in: [...messageIds] }, state: "QUEUED" } }); if (found !== messageIds.length) throw new NotFoundException("Batch messages are not queueable");
    return this.prisma.channelMessageBatch.create({ data: { connectionId, batchKey, messageIds: [...messageIds], status: "QUEUED",
      scheduledAt, checksum: this.hash({ workspaceId, connectionId, messageIds: [...messageIds].sort(), scheduledAt: scheduledAt.toISOString() }) } }); }
  listBatches(workspaceId: string, connectionId: string) { return this.getConnection(workspaceId, connectionId).then(() =>
    this.prisma.channelMessageBatch.findMany({ where: { connectionId }, orderBy: { scheduledAt: "desc" } })); }
  async recordRetry(workspaceId: string, channelId: string) { await this.requireChannel(this.prisma, workspaceId, channelId);
    return this.prisma.$transaction(async (tx) => this.metric(tx, channelId, { retryCount: { increment: 1 } })); }
  getChannel(workspaceId: string, id: string) { return this.requireChannel(this.prisma, workspaceId, id); }
  getMessage(workspaceId: string, id: string) { return this.prisma.channelMessage.findFirst({ where: { id, workspaceId }, select: this.messageSelect })
    .then((v) => { if (!v) throw new NotFoundException("Channel message was not found"); return v; }); }
  findProviderMessage(workspaceId: string, providerMessageId: string) { return this.prisma.channelMessage.findFirst({
    where: { workspaceId, providerMessageId }, select: this.messageSelect }); }
  getConnection(workspaceId: string, id: string) { return this.prisma.channelConnection.findFirst({ where: { id, workspaceId }, select: this.connectionSelect })
    .then((v) => { if (!v) throw new NotFoundException("Channel connection was not found"); return v; }); }
  listConnections(workspaceId: string, channelId: string) { return this.prisma.channelConnection.findMany({ where: { workspaceId, channelId }, select: this.connectionSelect }); }
  phoneNumbers(workspaceId: string) { return this.prisma.channelConnection.findMany({ where: { workspaceId }, select: { id: true, channelId: true,
    businessAccountId: true, phoneNumberId: true, displayPhoneNumber: true, state: true, health: true, lastHealthCheckAt: true } }); }
  listChannels(workspaceId: string, query: ChannelListQueryDto) { const page = query.page ?? 1, limit = query.limit ?? 25;
    const where: Prisma.ChannelWhereInput = { workspaceId, state: query.state, ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}) };
    return this.prisma.$transaction([this.prisma.channel.findMany({ where, select: this.channelSelect, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: "desc" } }),
      this.prisma.channel.count({ where })]).then(([data, total]) => ({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })); }
  listMessages(workspaceId: string, query: ChannelMessageListQueryDto) { const page = query.page ?? 1, limit = query.limit ?? 25;
    const where: Prisma.ChannelMessageWhereInput = { workspaceId, state: query.state, type: query.type, conversationId: query.conversationId };
    return this.prisma.$transaction([this.prisma.channelMessage.findMany({ where, select: this.messageSelect, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.channelMessage.count({ where })]).then(([data, total]) => ({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })); }
  conversations(workspaceId: string, channelId?: string) { return this.prisma.channelConversation.findMany({ where: { workspaceId, channelId }, orderBy: { updatedAt: "desc" } }); }
  attachments(workspaceId: string, channelId?: string) { return this.prisma.channelAttachment.findMany({ where: { workspaceId, channelId },
    select: this.attachmentSelect, orderBy: { createdAt: "desc" } }); }
  async attachmentReferences(workspaceId: string, channelId: string, ids: readonly string[]) { const values = await this.prisma.channelAttachment.findMany({
    where: { workspaceId, channelId, id: { in: [...ids] } } }); if (values.length !== ids.length) throw new NotFoundException("Channel attachment reference was not found");
    return ids.map((id) => values.find((value) => value.id === id)!); }
  hydrateAttachment(workspaceId: string, id: string, content: Buffer, mimeType: string, checksum: string) {
    if (createHash("sha256").update(content).digest("hex") !== checksum) throw new ConflictException("Downloaded attachment checksum failed");
    return this.prisma.channelAttachment.updateMany({ where: { id, workspaceId }, data: { content: Uint8Array.from(content), mimeType, sizeBytes: content.length, checksum,
      storageReference: `sha256:${checksum}` } }); }
  setProviderMediaId(workspaceId: string, id: string, providerMediaId: string) {
    return this.prisma.channelAttachment.updateMany({ where: { id, workspaceId }, data: { providerMediaId } });
  }
  attachment(workspaceId: string, id: string) { return this.prisma.channelAttachment.findFirst({ where: { id, workspaceId } })
    .then((value) => { if (!value) throw new NotFoundException("Channel attachment was not found");
      if (value.content && createHash("sha256").update(value.content).digest("hex") !== value.checksum) throw new ConflictException("Attachment integrity validation failed"); return value; }); }
  diagnostics(workspaceId: string, channelId?: string) { return this.prisma.channelDiagnostic.findMany({ where: { workspaceId, channelId }, orderBy: { createdAt: "desc" } }); }
  metrics(workspaceId: string, channelId: string) { return this.requireChannel(this.prisma, workspaceId, channelId).then(() =>
    this.prisma.channelMetric.findMany({ where: { channelId }, orderBy: { date: "desc" } })); }
  async recentCounts(workspaceId: string, connectionId: string, conversationId?: string) { const since = new Date(Date.now() - 60_000);
    const [workspace, phone, conversation] = await this.prisma.$transaction([
      this.prisma.channelMessage.count({ where: { workspaceId, createdAt: { gte: since } } }),
      this.prisma.channelMessage.count({ where: { workspaceId, connectionId, createdAt: { gte: since } } }),
      this.prisma.channelMessage.count({ where: { workspaceId, connectionId, conversationId, createdAt: { gte: since } } })
    ]); return { workspace, phone, conversation }; }
  configurations(workspaceId: string, connectionId: string) { return this.getConnection(workspaceId, connectionId).then(() =>
    this.prisma.channelConfiguration.findMany({ where: { connectionId }, orderBy: { revision: "desc" } })); }
  latestConfiguration(workspaceId: string, connectionId: string) { return this.getConnection(workspaceId, connectionId).then(() =>
    this.prisma.channelConfiguration.findFirst({ where: { connectionId }, orderBy: { revision: "desc" } })); }
  linkConversation(workspaceId: string, id: string, conversationRuntimeId: string) {
    return this.prisma.channelConversation.updateMany({ where: { id, workspaceId }, data: { conversationRuntimeId } });
  }

  private requireChannel(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) { return client.channel.findFirst({ where: { id, workspaceId }, select: this.channelSelect })
    .then((v) => { if (!v) throw new NotFoundException("Channel was not found"); this.verify(v); return v; }); }
  private verify(channel: { workspaceId: string; name: string; configurationHash: string; checksum: string }) {
    if (channel.checksum !== this.hash({ workspaceId: channel.workspaceId, name: channel.name, configurationHash: channel.configurationHash }))
      throw new ConflictException("Channel checksum validation failed"); }
  private messagePayload(message: NormalizedChannelMessage) { return { ...message, timestamp: message.timestamp.toISOString() }; }
  private event(tx: Prisma.TransactionClient, workspaceId: string, channelId: string, messageId: string | undefined,
    type: string, externalId: string | undefined, payload: unknown, occurredAt: Date) { return tx.channelEvent.create({ data: { workspaceId, channelId,
      messageId, type, externalId, payload: json(payload), payloadHash: this.hash(payload), occurredAt } }); }
  private metric(tx: Prisma.TransactionClient, channelId: string, update: Prisma.ChannelMetricUpdateInput) { const date = new Date(); date.setUTCHours(0, 0, 0, 0);
    return tx.channelMetric.upsert({ where: { channelId_date: { channelId, date } }, create: { channelId, date }, update }); }
  private audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string | undefined, channelId: string, action: string, metadata: unknown) {
    return Promise.all([tx.channelAudit.create({ data: { channelId, actorId, action, metadata: json(metadata) } }),
      tx.auditLog.create({ data: { workspaceId, userId: actorId, action, entityType: "Channel", entityId: channelId,
        oldValues: Prisma.JsonNull, newValues: json(metadata) } })]); }
  private hash(value: unknown) { return createHash("sha256").update(this.stable(value)).digest("hex"); }
  private stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map((v) => this.stable(v)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${this.stable(v)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null"; }
  private string(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
  private readonly channelSelect = { id: true, workspaceId: true, providerId: true, name: true, state: true,
    compatibilityVersion: true, version: true, stateVersion: true, configurationHash: true, checksum: true, createdById: true,
    updatedById: true, createdAt: true, updatedAt: true, archivedAt: true } satisfies Prisma.ChannelSelect;
  private readonly connectionSelect = { id: true, workspaceId: true, channelId: true, state: true, stateVersion: true,
    businessAccountId: true, phoneNumberId: true, displayPhoneNumber: true, apiVersion: true, webhookPathKey: true,
    accessTokenFingerprint: true, capabilities: true, health: true, lastHealthCheckAt: true, createdById: true,
    createdAt: true, updatedAt: true } satisfies Prisma.ChannelConnectionSelect;
  private readonly messageSelect = { id: true, workspaceId: true, channelId: true, connectionId: true, conversationId: true,
    direction: true, type: true, state: true, stateVersion: true, providerMessageId: true, idempotencyKey: true,
    replyToMessageId: true, normalizedPayload: true, payloadHash: true, checksum: true, queuedAt: true, sentAt: true,
    deliveredAt: true, readAt: true, failedAt: true, createdAt: true, updatedAt: true,
    attachments: { select: { id: true, workspaceId: true, channelId: true, messageId: true, providerMediaId: true,
      storageReference: true, fileName: true, mimeType: true, sizeBytes: true, checksum: true, metadata: true, createdAt: true } },
    deliveries: { orderBy: { occurredAt: "asc" as const } } } satisfies Prisma.ChannelMessageSelect;
  private readonly attachmentSelect = { id: true, workspaceId: true, channelId: true, messageId: true, providerMediaId: true,
    storageReference: true, fileName: true, mimeType: true, sizeBytes: true, checksum: true, metadata: true, createdAt: true } satisfies Prisma.ChannelAttachmentSelect;
}
