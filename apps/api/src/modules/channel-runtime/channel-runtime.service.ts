import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { ChannelConnectionState, ChannelMessageState, ChannelMessageType } from "@prisma/client";
import { createHash } from "node:crypto";
import { AgentExecutionService } from "../agent-execution/agent-execution.service";
import type { ExecuteAgentExecutionDto } from "../agent-execution/dto/agent-execution.dto";
import { ConversationRuntimeService } from "../conversation-runtime/conversation-runtime.service";
import { WorkflowRuntimeService } from "../workflow-runtime/workflow-runtime.service";
import { ChannelCredentialService } from "./channel-credential.service";
import { ChannelConnectionStateMachine } from "./channel-connection.state-machine";
import { ChannelProviderRegistry } from "./channel-provider.registry";
import { ChannelRetryService } from "./channel-retry.service";
import { ChannelRuntimeRepository } from "./channel-runtime.repository";
import type { NormalizedChannelMessage } from "./channel-runtime.types";
import { ChannelRuntimeValidator } from "./channel-runtime.validator";
import { ChannelTransportService } from "./channel-transport.service";
import type { ChannelProviderAdapter, ChannelProviderConnection } from "./contracts/channel-provider.contract";
import type { ChannelListQueryDto, ChannelMessageListQueryDto, CreateChannelConnectionDto, CreateChannelDto,
  CreateChannelBatchDto, CreateProviderConnectionDto, RotateChannelCredentialDto, SendChannelMessageDto, TransitionChannelConnectionDto,
  TransitionChannelMessageDto, UploadChannelAttachmentDto } from "./dto/channel-runtime.dto";

@Injectable()
export class ChannelRuntimeService {
  constructor(private readonly repository: ChannelRuntimeRepository, private readonly validator: ChannelRuntimeValidator,
    private readonly registry: ChannelProviderRegistry, private readonly credentials: ChannelCredentialService,
    private readonly transport: ChannelTransportService, private readonly retry: ChannelRetryService,
    private readonly connectionStates: ChannelConnectionStateMachine,
    private readonly conversationsRuntime: ConversationRuntimeService, private readonly agents: AgentExecutionService,
    private readonly workflows: WorkflowRuntimeService) {}

  createChannel(workspaceId: string, actorId: string, dto: CreateChannelDto) { return this.repository.createChannel(workspaceId, actorId, dto); }
  async createConnection(workspaceId: string, actorId: string, channelId: string, dto: CreateChannelConnectionDto) {
    this.validator.connection(dto); const adapter = this.registry.resolve("whatsapp"); const configuration = {
      businessAccountId: dto.businessAccountId, phoneNumberId: dto.phoneNumberId, displayPhoneNumber: dto.displayPhoneNumber,
      apiVersion: dto.apiVersion, signatureType: "hmac-sha256" };
    const failures = adapter.validateConfiguration(configuration);
    if (failures.length) throw new BadRequestException({ message: "Invalid WhatsApp connection", fields: failures });
    const value = await this.repository.createProviderConnection(workspaceId, actorId, channelId, { configuration,
      credentials: [{ name: "accessToken", secret: dto.accessToken }, { name: "verifyToken", secret: dto.verifyToken },
        { name: "appSecret", secret: dto.appSecret }], displayAddress: dto.displayPhoneNumber });
    return this.connectionResponse(value, adapter);
  }
  async createProviderConnection(workspaceId: string, actorId: string, channelId: string, dto: CreateProviderConnectionDto) {
    this.validator.configuration(dto.configuration); const channel = await this.repository.getChannel(workspaceId, channelId);
    const context = await this.repository.channelProviderKey(channel.providerId); const adapter = this.registry.resolve(context);
    const failures = adapter.validateConfiguration(dto.configuration); if (failures.length) throw new BadRequestException({ message: "Invalid channel connection", fields: failures });
    if (new Set(dto.credentials.map(({ name }) => name)).size !== dto.credentials.length) throw new BadRequestException("Duplicate channel credential name");
    const value = await this.repository.createProviderConnection(workspaceId, actorId, channelId, dto); return this.connectionResponse(value, adapter);
  }
  async health(workspaceId: string, actorId: string, connectionId: string) {
    const context = await this.context(workspaceId, connectionId); const controller = new AbortController(); const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(new Error("Channel health timeout")), 10_000);
    try { const health = await context.adapter.health(context.connection, controller.signal);
      await this.repository.recordHealth(workspaceId, connectionId, ChannelConnectionState.CONNECTED, Date.now() - startedAt,
        [...context.adapter.capabilities().supported], health);
      return this.repository.updateHealth(workspaceId, actorId, connectionId, health, ChannelConnectionState.CONNECTED); }
    catch (error) { await this.repository.diagnostic(workspaceId, context.record.channelId, "ERROR", "CHANNEL_HEALTH_FAILED",
        error instanceof Error ? error.message : "Channel health failed");
      await this.repository.recordHealth(workspaceId, connectionId, ChannelConnectionState.FAILED, Date.now() - startedAt, [], { error: error instanceof Error ? error.message : "failed" });
      await this.repository.updateHealth(workspaceId, actorId, connectionId, { available: false }, ChannelConnectionState.FAILED); throw error;
    } finally { clearTimeout(timeout); }
  }
  async verifyWebhook(pathKey: string, mode: string, verifyToken: string, challenge: string) {
    const context = await this.contextByWebhook(pathKey); const result = await context.adapter.verifyWebhook(context.connection,
      { mode, token: verifyToken, challenge }); if (!result.valid) throw new UnauthorizedException("Webhook verification failed");
    return result.challenge ?? challenge;
  }
  async webhook(pathKey: string, rawBody: Buffer, payload: unknown, signature: string, timestampHeader?: string) {
    const context = await this.contextByWebhook(pathKey); const workspaceId = context.record.workspaceId;
    if (!await context.adapter.verifySignature(context.connection, rawBody, signature)) {
      await this.repository.diagnostic(workspaceId, context.record.channelId, "ERROR", "WEBHOOK_SIGNATURE_INVALID", "Webhook signature validation failed");
      throw new UnauthorizedException("Webhook signature validation failed");
    }
    const metadata = context.adapter.webhookMetadata(payload, timestampHeader); const payloadHash = this.hash(rawBody);
    const eventId = metadata.eventId; const receipt = await this.repository.acceptWebhook(context.record.id, eventId, payloadHash, signature, metadata.occurredAt);
    if (!receipt) return { accepted: true, duplicate: true };
    try {
      const messages = context.adapter.normalizeIncoming(payload); const results = [];
      for (const message of messages) {
        const persisted = await this.repository.persistIncoming(workspaceId, context.record.createdById, context.record.channelId, context.record.id, message);
        if (persisted.created) await this.downloadIncomingAttachments(context, persisted.message.attachments);
        if (persisted.created) await this.integrateIncoming(workspaceId, context.record.createdById, persisted.conversation.id, persisted.message.id, message, context.record.id, context.record.channelId, context.record.channel.provider.name);
        results.push(persisted.message.id);
      }
      await this.processEvents(workspaceId, context.record.createdById, context.record.channelId,
        context.record.channel.provider.name, context.adapter.normalizeEvents(payload));
      await this.repository.completeWebhook(receipt.id); return { accepted: true, duplicate: false, messages: results };
    } catch (error) { await this.repository.diagnostic(workspaceId, context.record.channelId, "ERROR", "WEBHOOK_PROCESSING_FAILED",
      error instanceof Error ? error.message : "Webhook processing failed", { eventId }); throw error; }
  }
  async send(workspaceId: string, actorId: string, channelId: string, dto: SendChannelMessageDto) {
    this.validator.message(dto); const queued = await this.repository.queueOutgoing(workspaceId, actorId, { channelId,
      connectionId: dto.connectionId, recipient: dto.recipient, type: dto.type, text: dto.text, content: dto.content,
      idempotencyKey: dto.idempotencyKey, replyToMessageId: dto.replyToMessageId });
    if (queued.state !== ChannelMessageState.QUEUED) return queued;
    const counts = await this.repository.recentCounts(workspaceId, dto.connectionId, queued.conversationId);
    if (counts.workspace > 1000 || counts.phone > 250 || counts.conversation > 60) {
      await this.repository.diagnostic(workspaceId, channelId, "WARN", "CHANNEL_RATE_LIMITED", "Channel flood protection rejected outbound message", counts);
      await this.repository.transitionMessage(workspaceId, actorId, queued.id, "CANCELLED", queued.stateVersion, {}, "Channel rate limit exceeded");
      throw new HttpException("Channel rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    const preparing = await this.repository.transitionMessage(workspaceId, actorId, queued.id, "PREPARING", queued.stateVersion);
    const sending = await this.repository.transitionMessage(workspaceId, actorId, queued.id, "SENDING", preparing.stateVersion);
    const context = await this.context(workspaceId, dto.connectionId);
    if (context.record.channelId !== channelId) throw new BadRequestException("Channel connection does not belong to channel");
    let content = { ...(dto.content ?? {}) }; const attachmentRecords = dto.attachmentIds?.length ?
      await this.repository.attachmentReferences(workspaceId, channelId, dto.attachmentIds) : [];
    try { if (attachmentRecords.length) { const attachment = attachmentRecords[0]!; let providerMediaId = attachment.providerMediaId;
        if (!providerMediaId) { if (!attachment.content) throw new BadRequestException("Attachment content is unavailable");
          const uploaded = await context.adapter.uploadMedia(context.connection, { content: Buffer.from(attachment.content),
            mimeType: attachment.mimeType, fileName: attachment.fileName ?? undefined }, new AbortController().signal);
          providerMediaId = uploaded.providerMediaId; await this.repository.setProviderMediaId(workspaceId, attachment.id, providerMediaId); }
        content = { ...content, id: providerMediaId }; }
    } catch (error) { await this.repository.transitionMessage(workspaceId, actorId, queued.id, "FAILED", sending.stateVersion, {},
        error instanceof Error ? error.message : "Attachment preparation failed"); throw error; }
    let replied: Awaited<ReturnType<ChannelRuntimeRepository["getMessage"]>> | undefined;
    try { replied = dto.replyToMessageId ? await this.repository.getMessage(workspaceId, dto.replyToMessageId) : undefined; }
    catch (error) { await this.repository.transitionMessage(workspaceId, actorId, queued.id, "FAILED", sending.stateVersion, {}, "Quoted message was not found"); throw error; }
    if (replied && !replied.providerMessageId) { await this.repository.transitionMessage(workspaceId, actorId, queued.id, "FAILED", sending.stateVersion, {},
      "Quoted message has no provider identifier"); throw new BadRequestException("Quoted message has no provider identifier"); }
    const normalized: NormalizedChannelMessage = { externalUserId: dto.recipient, externalConversationId: dto.recipient,
      direction: "OUTGOING", type: dto.type, text: dto.text, timestamp: new Date(), attachments: [], content: Object.freeze(content), metadata: Object.freeze({}),
      ...(replied?.providerMessageId ? { replyToProviderMessageId: replied.providerMessageId } : {}) };
    const payload = context.adapter.normalizeOutgoing(normalized);
    for (let attempt = 1; attempt <= 3; attempt++) { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(new Error("Channel send timeout")), 15_000);
      try { const result = await context.adapter.send(context.connection, payload, controller.signal); clearTimeout(timeout);
        return this.repository.transitionMessage(workspaceId, actorId, queued.id, "SENT", sending.stateVersion,
          { providerMessageId: result.providerMessageId });
      } catch (error) { clearTimeout(timeout); if (attempt < 3 && this.retry.retryable(error)) {
          await this.repository.diagnostic(workspaceId, channelId, "WARN", "CHANNEL_SEND_RETRY", "Retrying transient channel failure", { attempt });
          await this.repository.recordRetry(workspaceId, channelId);
          await new Promise((resolve) => setTimeout(resolve, this.retry.delay(attempt)));
          continue;
        }
        await this.repository.transitionMessage(workspaceId, actorId, queued.id, "FAILED", sending.stateVersion, {}, error instanceof Error ? error.message : "Send failed"); throw error;
      }
    }
    throw new Error("Unreachable channel retry state");
  }
  transition(workspaceId: string, actorId: string, id: string, dto: TransitionChannelMessageDto) {
    return this.repository.transitionMessage(workspaceId, actorId, id, dto.state, dto.expectedStateVersion, {}, dto.reason); }
  upload(workspaceId: string, actorId: string, dto: UploadChannelAttachmentDto) { this.validator.attachment(dto); return this.repository.createAttachment(workspaceId, actorId, dto); }
  getChannel(workspaceId: string, id: string) { return this.repository.getChannel(workspaceId, id); }
  getConnection(workspaceId: string, id: string) { return this.repository.getConnection(workspaceId, id); }
  getMessage(workspaceId: string, id: string) { return this.repository.getMessage(workspaceId, id); }
  listChannels(workspaceId: string, query: ChannelListQueryDto) { return this.repository.listChannels(workspaceId, query); }
  listMessages(workspaceId: string, query: ChannelMessageListQueryDto) { return this.repository.listMessages(workspaceId, query); }
  listConnections(workspaceId: string, channelId: string) { return this.repository.listConnections(workspaceId, channelId); }
  phoneNumbers(workspaceId: string) { return this.repository.phoneNumbers(workspaceId); }
  conversations(workspaceId: string, channelId?: string) { return this.repository.conversations(workspaceId, channelId); }
  attachments(workspaceId: string, channelId?: string) { return this.repository.attachments(workspaceId, channelId); }
  async attachment(workspaceId: string, id: string) { const value = await this.repository.attachment(workspaceId, id);
    return { ...value, sizeBytes: Number(value.sizeBytes), content: value.content ? Buffer.from(value.content).toString("base64") : undefined }; }
  diagnostics(workspaceId: string, channelId?: string) { return this.repository.diagnostics(workspaceId, channelId); }
  metrics(workspaceId: string, channelId: string) { return this.repository.metrics(workspaceId, channelId); }
  configurations(workspaceId: string, connectionId: string) { return this.repository.configurations(workspaceId, connectionId); }
  updateConfiguration(workspaceId: string, actorId: string, connectionId: string, configuration: Record<string, unknown>, expected: number) {
    this.validator.configuration(configuration); return this.repository.updateConfiguration(workspaceId, actorId, connectionId, configuration, expected); }
  transitionConnection(workspaceId: string, actorId: string, connectionId: string, dto: TransitionChannelConnectionDto) {
    return this.repository.getConnection(workspaceId, connectionId).then((current) => { this.connectionStates.assert(current.state, dto.state);
      return this.repository.transitionConnection(workspaceId, actorId, connectionId, dto.state, dto.expectedStateVersion); }); }
  providers() { return this.registry.installed(); }
  capabilities(providerKey: string) { const value = this.registry.resolve(providerKey).capabilities();
    return { providerKey, supported: [...value.supported], limits: value.limits, metadata: value.metadata }; }
  rotateCredential(workspaceId: string, actorId: string, connectionId: string, dto: RotateChannelCredentialDto) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new BadRequestException("Invalid credential expiration timestamp");
    return this.credentials.rotate(workspaceId, actorId, connectionId, dto.name, dto.secret, dto.expectedVersion, expiresAt); }
  async refreshCapabilities(providerKey: string) { const provider = await this.repository.channelProvider(providerKey);
    const capabilities = [...this.registry.resolve(providerKey).capabilities().supported]; return this.repository.syncCapabilities(provider.id, capabilities); }
  createBatch(workspaceId: string, connectionId: string, dto: CreateChannelBatchDto) { const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("Invalid batch schedule timestamp");
    return this.repository.createBatch(workspaceId, connectionId, dto.batchKey, dto.messageIds, scheduledAt); }
  batches(workspaceId: string, connectionId: string) { return this.repository.listBatches(workspaceId, connectionId); }

  private async integrateIncoming(workspaceId: string, actorId: string, channelConversationId: string, messageId: string,
    message: NormalizedChannelMessage, connectionId: string, channelId: string, providerKey: string) {
    const runtime = await this.conversationsRuntime.prepare(workspaceId, actorId, { name: `${providerKey} ${message.externalConversationId}`,
      compatibilityVersion: "1.0.0", contexts: [{ contextKey: "channel", correlationId: `${providerKey}:${messageId}`,
        metadata: { channelConversationId, provider: providerKey } }], participants: [{ participantKey: "customer", type: "CUSTOMER",
        displayMetadata: { externalUserId: message.externalUserId } }], messages: [{ messageIdentifier: messageId, ordinal: 0,
        role: "USER", participantKey: "customer", contentHash: this.hash(Buffer.from(message.text ?? JSON.stringify(message.content))) }],
      metadata: { channelConversationId } });
    await this.repository.linkConversation(workspaceId, channelConversationId, runtime.id);
    const configuration = await this.repository.latestConfiguration(workspaceId, connectionId);
    const record = this.object(configuration?.configuration); const workflow = this.object(record.workflowExecution);
    if (Object.keys(workflow).length) { await this.workflows.execute(workspaceId, actorId, { ...workflow,
      workflowVersionId: this.string(workflow.workflowVersionId), correlationId: `${providerKey}:${messageId}`,
      idempotencyKey: `${providerKey}:${messageId}`, input: { channelMessageId: messageId, text: message.text, content: message.content }
    }); return; }
    const agent = this.object(record.agentExecution); if (!Object.keys(agent).length) return;
    const dto = { ...agent, taskType: this.string(agent.taskType, "channel.message"), userMessage: message.text ?? JSON.stringify(message.content),
      correlationId: `${providerKey}:${messageId}`, idempotencyKey: `${providerKey}:${messageId}` } as unknown as ExecuteAgentExecutionDto;
    const response = await this.agents.execute(workspaceId, actorId, dto);
    if (typeof response.answer === "string" && response.answer) await this.send(workspaceId, actorId, channelId, {
      connectionId, recipient: message.externalUserId, type: ChannelMessageType.TEXT, text: response.answer,
      idempotencyKey: `${providerKey}:reply:${messageId}` });
  }
  private async downloadIncomingAttachments(context: Awaited<ReturnType<ChannelRuntimeService["contextByWebhook"]>>,
    attachments: readonly { id: string; providerMediaId: string | null }[]) {
    for (const attachment of attachments) { if (!attachment.providerMediaId) continue; const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error("Channel media download timeout")), 30_000);
      try { const media = await context.adapter.downloadMedia(context.connection, attachment.providerMediaId, controller.signal);
        await this.repository.hydrateAttachment(context.record.workspaceId, attachment.id, media.content, media.mimeType, media.checksum);
      } catch (error) { await this.repository.diagnostic(context.record.workspaceId, context.record.channelId, "ERROR", "ATTACHMENT_DOWNLOAD_FAILED",
        error instanceof Error ? error.message : "Attachment download failed", { attachmentId: attachment.id });
      } finally { clearTimeout(timeout); }
    }
  }
  private async processEvents(workspaceId: string, actorId: string, channelId: string, providerKey: string,
    events: ReturnType<ChannelProviderAdapter["normalizeEvents"]>) {
    for (const event of events) { if (event.kind === "DELIVERY" && event.providerMessageId && event.deliveryState && event.deliveryState !== "UNKNOWN") {
        const message = await this.repository.findProviderMessage(workspaceId, event.providerMessageId); if (!message || message.state === event.deliveryState) continue;
        try { await this.repository.transitionMessage(workspaceId, actorId, message.id, event.deliveryState, message.stateVersion, {},
          event.deliveryState === "FAILED" ? JSON.stringify(event.payload) : undefined); }
        catch { await this.repository.diagnostic(workspaceId, channelId, "WARN", "DELIVERY_TRANSITION_IGNORED",
          "Out-of-order delivery transition ignored", { providerMessageId: event.providerMessageId, target: event.deliveryState }); }
      } else { await this.repository.providerEvent(workspaceId, channelId, `${providerKey}.${event.type}`, event.payload);
        if (event.kind === "PRESENCE" && event.externalIdentityId) await this.repository.upsertPresence(workspaceId, channelId,
          event.externalIdentityId, event.type, event.occurredAt, event.payload); }
    }
  }
  private async context(workspaceId: string, connectionId: string) { const record = await this.repository.connectionContext(workspaceId, connectionId);
    return this.buildContext(record); }
  private async contextByWebhook(pathKey: string) { const record = await this.repository.connectionContextByWebhook(pathKey);
    return this.buildContext(record); }
  private async buildContext(record: Awaited<ReturnType<ChannelRuntimeRepository["connectionContext"]>>) {
    const credentials = await this.credentials.resolve(record.workspaceId, record.id); const providerKey = record.channel.provider.name;
    const legacy = { businessAccountId: record.businessAccountId, phoneNumberId: record.phoneNumberId,
      displayPhoneNumber: record.displayPhoneNumber, apiVersion: record.apiVersion };
    const configured = this.object(record.providerConfiguration); const configuration = Object.keys(configured).length ? configured : legacy;
    const connection: ChannelProviderConnection = Object.freeze({ id: record.id, workspaceId: record.workspaceId,
      channelId: record.channelId, providerKey, configuration: Object.freeze(configuration), credentials, transport: this.transport });
    return { record, connection, adapter: this.registry.resolve(providerKey) };
  }
  private connectionResponse(value: { webhookPathKey: string }, adapter: ChannelProviderAdapter) { const capabilities = adapter.capabilities();
    return { ...value, capabilities: [...capabilities.supported], webhookUrl: `/channel-runtime/webhooks/${adapter.key}/${value.webhookPathKey}` }; }
  private hash(value: Buffer) { return createHash("sha256").update(value).digest("hex"); }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
  private string(value: unknown, fallback = ""): string { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
}
