import { BadGatewayException, forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { ChannelMessageType } from "@prisma/client";
import type { ExecuteAgentExecutionDto } from "../agent-execution/dto/agent-execution.dto";
import { AgentExecutionService } from "../agent-execution/agent-execution.service";
import { MemoryRuntimeService } from "../memory-runtime/memory-runtime.service";
import { ConversationRuntimeService } from "../conversation-runtime/conversation-runtime.service";
import { WorkflowRuntimeService } from "../workflow-runtime/workflow-runtime.service";
import type { ChannelProviderConnection } from "./contracts/channel-provider.contract";
import { ChannelRuntimeRepository } from "./channel-runtime.repository";
import type { NormalizedChannelMessage } from "./channel-runtime.types";
import { ChannelRuntimeService } from "./channel-runtime.service";
import { BaileysDiagnosticsService } from "./baileys-diagnostics.service";

@Injectable()
export class BaileysWhatsappIncomingProcessor {
  private readonly logger = new Logger(BaileysWhatsappIncomingProcessor.name);

  constructor(
    private readonly repository: ChannelRuntimeRepository,
    private readonly conversationsRuntime: ConversationRuntimeService,
    private readonly workflows: WorkflowRuntimeService,
    private readonly agents: AgentExecutionService,
    private readonly memory: MemoryRuntimeService,
    @Inject(forwardRef(() => ChannelRuntimeService)) private readonly runtimeService: ChannelRuntimeService,
    private readonly diagnostics: BaileysDiagnosticsService
  ) {}

  async processIncoming(connection: ChannelProviderConnection, messages: readonly NormalizedChannelMessage[]) {
    if (!connection.createdById) {
        this.logger.warn({ event: "BAILEYS_INCOMING_MISSING_CREATED_BY", connectionId: connection.id });
        throw new BadGatewayException("Channel connection is missing owner context (createdById)");
      }
      for (const message of messages) {
        const persisted = await this.repository.persistIncoming(connection.workspaceId, connection.createdById,
          connection.channelId, connection.id, message);
      this.diagnostics.record(connection.id, persisted.created ? "PERSISTED" : "DUPLICATE",
        persisted.created ? "Message persisted" : "Duplicate ignored", message.providerMessageId);
      if (!persisted.created) continue;

      try {
        await this.downloadIncomingAttachments(connection, persisted.message.attachments);
      } catch (error) {
        this.logger.warn({ event: "BAILEYS_ATTACHMENT_DOWNLOAD_FAILED", connectionId: connection.id,
          messageId: persisted.message.id, error: error instanceof Error ? error.message : error });
      }

      await this.integrateIncoming(connection, persisted.conversation.id, persisted.message.id, message);
    }
  }

  private async integrateIncoming(connection: ChannelProviderConnection, channelConversationId: string, messageId: string,
    message: NormalizedChannelMessage) {
    const actorId = connection.createdById!;
    const runtime = await this.conversationsRuntime.prepareChannelConversation(connection.workspaceId, actorId,
      channelConversationId, {
      name: `${connection.providerKey} ${message.externalConversationId}`,
      compatibilityVersion: "1.0.0",
      contexts: [{ contextKey: "channel", correlationId: `${connection.providerKey}:${messageId}`,
        metadata: { channelConversationId, provider: connection.providerKey } }],
      participants: [{ participantKey: "customer", type: "CUSTOMER",
        displayMetadata: { externalUserId: message.externalUserId } }],
      settings: { maxHistoryMessages: 20 },
      metadata: { channelConversationId }
    });
    this.diagnostics.record(connection.id, "RUNTIME", "Conversation prepared", message.providerMessageId);
    await this.conversationsRuntime.appendChannelMessage(connection.workspaceId, actorId, runtime.id, {
      messageIdentifier: messageId, role: "USER", participantKey: "customer",
      contentHash: this.hash(Buffer.from(message.text ?? JSON.stringify(message.content))),
      metadata: { channelConversationId, channelMessageId: messageId }
    });
    // Conversation-level Responix gate: the customer message is already
    // persisted and visible above, but agent/workflow execution (and any
    // outbound reply) must not run while this conversation is disabled.
    // The state is read from the persisted conversation record on every
    // inbound message, so the gate survives runtime reinitialization and
    // duplicate deliveries stay blocked.
    const executionEnabled = await this.runtimeService.conversationExecutionEnabled(connection.workspaceId, channelConversationId);
    if (!executionEnabled) {
      await this.repository.diagnostic(connection.workspaceId, connection.channelId, "INFO", "CONVERSATION_EXECUTION_DISABLED",
        "Agent/workflow execution skipped for conversation with Responix disabled", { channelConversationId });
      this.diagnostics.record(connection.id, "RUNTIME", "Responix execution disabled for this conversation; agent/workflow execution skipped", message.providerMessageId);
      return; }
    const configuration = await this.repository.latestConfiguration(connection.workspaceId, connection.id);
    const record = this.object(configuration?.configuration); const workflow = this.object(record.workflowExecution);
    if (Object.keys(workflow).length) {
      await this.workflows.execute(connection.workspaceId, actorId, {
        ...workflow,
        workflowVersionId: this.string(workflow.workflowVersionId),
        correlationId: `${connection.providerKey}:${messageId}`,
        idempotencyKey: `${connection.providerKey}:${messageId}`,
        input: { channelMessageId: messageId, text: message.text, content: message.content }
      });
      this.diagnostics.record(connection.id, "RUNTIME", "Workflow completed", message.providerMessageId);
      return;
    }
    const agent = this.object(record.agentExecution); if (!Object.keys(agent).length) return;
    const agentId = this.string(agent.agentId);
    if (agentId && !(await this.repository.agentAutomaticExecutionEnabled(connection.workspaceId, agentId))) {
      await this.repository.diagnostic(connection.workspaceId, connection.channelId, "INFO", "AGENT_AUTOMATIC_EXECUTION_PAUSED",
        "Inbound message was stored; this Agent is paused and automatic execution was skipped", { agentId });
      return;
    }
    // Conversation history has no persisted agent-side contract in the
    // current schema, so it reaches the agent only when the connection's
    // agent execution configuration explicitly enables it (default: off).
    // Stored conversation history is unaffected either way.
    const historyConfiguration = this.object(agent.conversationHistory);
    const historyEnabled = agent.conversationHistory === true || historyConfiguration.enabled === true;
    const conversationHistory = historyEnabled
      ? await this.repository.conversationHistoryBefore(connection.workspaceId, channelConversationId, messageId,
          this.positiveInteger(historyConfiguration.limit))
      : [];
    const memoryRuntimeIds = Array.isArray(agent.memoryRuntimeIds)
      ? agent.memoryRuntimeIds.filter((id): id is string => typeof id === "string") : [];
    const conversationMemory = memoryRuntimeIds.length
      ? await this.memory.ensureConversationRuntime(
          connection.workspaceId, actorId, channelConversationId, memoryRuntimeIds[0]!
        )
      : undefined;
    const memoryRuntimeSnapshotIds = memoryRuntimeIds.length
      ? await this.memory.latestSnapshots(connection.workspaceId, [...memoryRuntimeIds, conversationMemory!.runtimeId])
      : Array.isArray(agent.memoryRuntimeSnapshotIds)
        ? agent.memoryRuntimeSnapshotIds.filter((id): id is string => typeof id === "string") : [];
    // Agent Context Boundary: the bound agent's identity comes from the
    // connection's agentExecution configuration so the execution service can
    // declare the current Responix authoritative over shared history.
    const agentIdentity = this.string(agent.agentId)
      ? { agentId: this.string(agent.agentId),
          ...(this.string(agent.agentName) ? { agentName: this.string(agent.agentName) } : {}) }
      : undefined;

    // The persisted history switch is consumed here; only loaded turns belong in
    // the execution request. Do not forward the channel control as an execution field.
    const { conversationHistory: _historyControl, ...executionAgent } = agent;
    const dto = { ...executionAgent, taskType: this.string(agent.taskType, "channel.message"),
      userMessage: message.text ?? JSON.stringify(message.content), correlationId: `${connection.providerKey}:${messageId}`,
      idempotencyKey: `${connection.providerKey}:${messageId}`,
      ...(conversationHistory.length ? { conversationHistory } : {}),
      ...(memoryRuntimeSnapshotIds.length ? { memoryRuntimeSnapshotIds } : {}),
      ...(agentIdentity ? { agentIdentity } : {}) } as unknown as ExecuteAgentExecutionDto;
    const response = await this.agents.execute(connection.workspaceId, actorId, dto);
    this.diagnostics.record(connection.id, "AGENT", "Agent execution completed", message.providerMessageId);
    if (typeof response.answer === "string" && response.answer) {
      const outgoing = await this.runtimeService.send(connection.workspaceId, actorId, connection.channelId, {
        connectionId: connection.id,
        recipient: message.externalUserId,
        type: ChannelMessageType.TEXT,
        text: response.answer,
        idempotencyKey: `${connection.providerKey}:reply:${messageId}`,
        // Stamp the producer so persisted history is attributable to this Responix.
        ...(agentIdentity ? { producer: agentIdentity } : {})
      });
      await this.conversationsRuntime.appendChannelMessage(connection.workspaceId, actorId, runtime.id, {
        messageIdentifier: outgoing.id, role: "ASSISTANT", contentHash: this.hash(Buffer.from(response.answer)),
        metadata: { channelConversationId, channelMessageId: outgoing.id, replyToChannelMessageId: messageId }
      });
      this.diagnostics.record(connection.id, "OUTBOUND", "Response accepted by provider", message.providerMessageId);
    }
  }

  private async downloadIncomingAttachments(connection: ChannelProviderConnection,
    attachments: readonly { id: string; providerMediaId: string | null }[]) {
    for (const attachment of attachments) {
      if (!attachment.providerMediaId) continue;
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(new Error("Channel media download timeout")), 30_000);
      try {
        const media = await connection.transport.request({ label: "Baileys WhatsApp",
          url: String(attachment.providerMediaId), method: "GET", maximumResponseBytes: 100 * 1024 * 1024, signal: controller.signal });
        const content = Buffer.from(media.body, media.encoding === "base64" ? "base64" : "utf8");
        const checksum = this.hash(content);
        await this.repository.hydrateAttachment(connection.workspaceId, attachment.id, content, media.headers?.["content-type"]?.toString() ?? "application/octet-stream", checksum);
      } catch (error) {
        this.logger.warn({ event: "BAILEYS_ATTACHMENT_DOWNLOAD_FAILED", connectionId: connection.id,
          attachmentId: attachment.id, error: error instanceof Error ? error.message : error });
      } finally { clearTimeout(timeout); }
    }
  }

  private hash(value: unknown) { return require("node:crypto").createHash("sha256").update(typeof value === "string" ? value : Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex"); }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private string(value: unknown, fallback = ""): string { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
  private positiveInteger(value: unknown): number | undefined { return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined; }
}
