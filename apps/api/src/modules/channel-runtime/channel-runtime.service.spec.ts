import { createHmac } from "node:crypto";
import { ChannelMessageType } from "@prisma/client";
import { BaileysWhatsappAdapter } from "./adapters/baileys-whatsapp.adapter";
import { ChannelRuntimeService } from "./channel-runtime.service";

describe("ChannelRuntimeService", () => {
  const repository = { connectionByWebhook: jest.fn(), acceptWebhook: jest.fn(), persistIncoming: jest.fn(), completeWebhook: jest.fn(),
    diagnostic: jest.fn(), linkConversation: jest.fn(), latestConfiguration: jest.fn(), createChannel: jest.fn(), createConnection: jest.fn(),
    connectionSecret: jest.fn(), updateHealth: jest.fn(), queueOutgoing: jest.fn(), recentCounts: jest.fn(), transitionMessage: jest.fn(),
    createAttachment: jest.fn(), getChannel: jest.fn(), getConnection: jest.fn(), getMessage: jest.fn(), listChannels: jest.fn(),
    listMessages: jest.fn(), listConnections: jest.fn(), conversations: jest.fn(), attachments: jest.fn(), attachment: jest.fn(),
    diagnostics: jest.fn(), metrics: jest.fn(), configurations: jest.fn(), findProviderMessage: jest.fn(), providerEvent: jest.fn(),
    hydrateAttachment: jest.fn(), attachmentReferences: jest.fn(), setProviderMediaId: jest.fn(), recordRetry: jest.fn(), phoneNumbers: jest.fn(),
    transitionConnection: jest.fn(), updateConfiguration: jest.fn(), connectionContextByWebhook: jest.fn(), connectionContext: jest.fn(),
    channelProviderKey: jest.fn(), createProviderConnection: jest.fn(), recordHealth: jest.fn(),
    conversationHistoryBefore: jest.fn(), conversationExecution: jest.fn(), setConversationExecution: jest.fn(), agentAutomaticExecutionEnabled: jest.fn() };
  const adapter = { key: "whatsapp", validateConfiguration: jest.fn().mockReturnValue([]), capabilities: jest.fn().mockReturnValue({ supported: new Set(), limits: {}, metadata: {} }),
    verifyWebhook: jest.fn(), verifySignature: jest.fn(), normalizeIncoming: jest.fn(), normalizeOutgoing: jest.fn(),
    webhookMetadata: jest.fn(), normalizeEvents: jest.fn(), health: jest.fn(), send: jest.fn(), uploadMedia: jest.fn(), downloadMedia: jest.fn() };
  const registry = { resolve: jest.fn().mockReturnValue(adapter), installed: jest.fn() };
  const credentials = { resolve: jest.fn().mockResolvedValue({ get: jest.fn(), has: jest.fn(), fingerprint: jest.fn(), names: jest.fn() }), rotate: jest.fn() };
  const transport = { request: jest.fn() };
  const validator = { connection: jest.fn(), message: jest.fn(), attachment: jest.fn() };
  const conversations = { prepareChannelConversation: jest.fn(), appendChannelMessage: jest.fn() };
  const agents = { execute: jest.fn() }; const workflows = { execute: jest.fn() };
  const memory = { latestSnapshots: jest.fn(), ensureConversationRuntime: jest.fn() };
  const retry = { retryable: jest.fn(), delay: jest.fn() };
  const connectionStates = { assert: jest.fn() };
  const service = new ChannelRuntimeService(repository as never, validator as never, registry as never, credentials as never, transport as never,
    retry as never, connectionStates, conversations as never, agents as never, memory as never, workflows as never);
  beforeEach(() => { jest.clearAllMocks(); const connectionRecord = { id: "conn", workspaceId: "w", channelId: "c",
    createdById: "actor", providerConfiguration: {}, businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0",
    channel: { provider: { name: "whatsapp" } } };
    repository.connectionContextByWebhook.mockResolvedValue(connectionRecord);
    repository.connectionContext.mockResolvedValue(connectionRecord);
    registry.resolve.mockReturnValue(adapter);
    repository.conversationHistoryBefore.mockResolvedValue([]);
    repository.agentAutomaticExecutionEnabled.mockResolvedValue(true);
    // Execution is enabled by default; individual tests can override the gate.
    repository.conversationExecution.mockResolvedValue({ id: "conversation", metadata: {} });
    memory.latestSnapshots.mockResolvedValue([]);
    memory.ensureConversationRuntime.mockResolvedValue({ runtimeId: crypto.randomUUID(), snapshotId: crypto.randomUUID() });
    adapter.webhookMetadata.mockReturnValue({ eventId: "event", occurredAt: new Date() }); adapter.normalizeEvents.mockReturnValue([]); });
  it("rejects unauthenticated webhooks before persistence", async () => {
    adapter.verifySignature.mockReturnValue(false);
    await expect(service.webhook("path", Buffer.from("{}"), {}, "bad", String(Date.now()))).rejects.toThrow("signature");
    expect(repository.acceptWebhook).not.toHaveBeenCalled();
    expect(repository.diagnostic).toHaveBeenCalledWith("w", "c", "ERROR", "WEBHOOK_SIGNATURE_INVALID", expect.any(String));
  });
  it("provides replay-safe webhook idempotency", async () => {
    adapter.verifySignature.mockReturnValue(true); repository.acceptWebhook.mockResolvedValue(null);
    const payload = { entry: [{ id: "entry", changes: [{ value: { messages: [{ id: "wamid", timestamp: String(Math.floor(Date.now() / 1000)) }] } }] }] };
    await expect(service.webhook("path", Buffer.from(JSON.stringify(payload)), payload, "sig")).resolves.toEqual({ accepted: true, duplicate: true });
    expect(repository.persistIncoming).not.toHaveBeenCalled();
  });
  it("delegates incoming execution to Agent Execution with all configured runtime dependencies", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000)); const incoming = { providerMessageId: "wamid", externalUserId: "1555",
      externalConversationId: "1555", direction: "INCOMING", type: "TEXT", text: "hello", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "receipt" }); repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "message", attachments: [] }, conversation: { id: "conversation" } });
    const memoryId = crypto.randomUUID(), retrievalId = crypto.randomUUID(), toolId = crypto.randomUUID();
    conversations.prepareChannelConversation.mockResolvedValue({ id: "conversation-runtime" }); repository.latestConfiguration.mockResolvedValue({ configuration: {
      agentExecution: { agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
        providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID(), memoryRuntimeSnapshotIds: [memoryId],
        retrievalRuntimeSnapshotId: retrievalId, availableToolVersionIds: [toolId] } } });
    agents.execute.mockResolvedValue({ answer: "" });
    memory.latestSnapshots.mockResolvedValue([memoryId]);
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid", timestamp }] } }] }] };
    await service.webhook("path", Buffer.from(JSON.stringify(payload)), payload, "signature");
    expect(agents.execute).toHaveBeenCalledWith("w", "actor", expect.objectContaining({ userMessage: "hello",
      memoryRuntimeSnapshotIds: [memoryId], retrievalRuntimeSnapshotId: retrievalId, availableToolVersionIds: [toolId] }));
    expect(conversations.appendChannelMessage).toHaveBeenCalledWith("w", "actor", "conversation-runtime",
      expect.objectContaining({ messageIdentifier: "message", role: "USER" }));
    expect(repository.completeWebhook).toHaveBeenCalledWith("receipt");
  });
  it("passes the bound agent identity to execution and stamps the reply producer", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "wamid-bound", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "hello", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    adapter.normalizeOutgoing.mockReturnValue({ type: "text" });
    adapter.send.mockResolvedValue({ providerMessageId: "wamid-out" });
    repository.acceptWebhook.mockResolvedValue({ id: "receipt" }); repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "message", attachments: [] }, conversation: { id: "conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "conversation-runtime" });
    repository.latestConfiguration.mockResolvedValue({ configuration: {
      agentExecution: {
        agentId: "agent-b", agentName: "Bolt", conversationHistory: true,
        agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
        providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID()
      }
    } });
    repository.conversationHistoryBefore.mockResolvedValue([
      { id: "user-1", role: "user", content: "Hi Bolt." },
      { id: "assistant-1", role: "assistant", content: "Hello!", agentId: "agent-b", agentName: "Bolt" }
    ]);
    agents.execute.mockResolvedValue({ answer: "Hello from Bolt." });
    repository.queueOutgoing.mockResolvedValue({ id: "outgoing", state: "QUEUED", stateVersion: 0, conversationId: "conversation" });
    repository.recentCounts.mockResolvedValue({ workspace: 1, phone: 1, conversation: 1 });
    repository.transitionMessage.mockResolvedValue({ id: "outgoing", stateVersion: 1 });
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid-bound", timestamp }] } }] }] };
    await service.webhook("path", Buffer.from(JSON.stringify(payload)), payload, "signature");
    expect(agents.execute).toHaveBeenCalledWith("w", "actor", expect.objectContaining({
      userMessage: "hello",
      agentIdentity: { agentId: "agent-b", agentName: "Bolt" },
      conversationHistory: expect.arrayContaining([
        expect.objectContaining({ id: "assistant-1", role: "assistant", agentId: "agent-b", agentName: "Bolt" })
      ])
    }));
    expect(repository.queueOutgoing).toHaveBeenCalledWith("w", "actor", expect.objectContaining({
      text: "Hello from Bolt.", producer: { agentId: "agent-b", agentName: "Bolt" }
    }));
  });

  it("uses the scoped history path when history is enabled via the { enabled: true } object shape", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "obj-on", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "What is my name?", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "receipt-obj" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "obj-message", attachments: [] }, conversation: { id: "obj-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "obj-runtime" });
    repository.conversationHistoryBefore.mockResolvedValue([
      { id: "user-1", role: "user", content: "My name is Alice." }
    ]);
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
      providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID(),
      conversationHistory: { enabled: true }
    } } });
    agents.execute.mockResolvedValue({ answer: "Your name is Alice." });
    repository.queueOutgoing.mockResolvedValue({ id: "assistant-obj", state: "SENT", conversationId: "obj-conversation" });
    await service.webhook("path", Buffer.from("{}"), {}, "signature");
    expect(repository.conversationHistoryBefore).toHaveBeenCalled();
    expect(agents.execute).toHaveBeenCalledWith("w", "actor", expect.objectContaining({
      userMessage: "What is my name?",
      conversationHistory: [expect.objectContaining({ role: "user", content: "My name is Alice." })]
    }));
  });

  it("gives a switched-in Responix with history OFF no conversation-history context even when the conversation holds another Responix's turns", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "switch-off", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "What is my name?", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "receipt-switch" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "switch-message", attachments: [] }, conversation: { id: "switch-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "switch-runtime" });
    // The conversation contains a prior turn produced by Agent A, but Agent B has history OFF.
    repository.conversationHistoryBefore.mockResolvedValue([
      { id: "user-1", role: "user", content: "Hi." },
      { id: "assistant-1", role: "assistant", content: "I am Agent A.", agentId: "agent-a", agentName: "Agent A" }
    ]);
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentId: "agent-b", agentName: "Bolt", conversationHistory: { enabled: false },
      agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
      providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID()
    } } });
    agents.execute.mockResolvedValue({ answer: "" });
    await service.webhook("path", Buffer.from("{}"), {}, "signature");
    expect(repository.conversationHistoryBefore).not.toHaveBeenCalled();
    expect(repository.agentAutomaticExecutionEnabled).toHaveBeenCalledWith("w", "agent-b");
    expect(agents.execute).toHaveBeenCalledTimes(1);
    const invocation = agents.execute.mock.calls.at(-1)![2] as Record<string, unknown>;
    expect(invocation.userMessage).toBe("What is my name?");
    expect(invocation.conversationHistory).toBeUndefined();
    // Agent B still executes as its own identity (it does not become Agent A).
    expect(invocation.agentIdentity).toEqual({ agentId: "agent-b", agentName: "Bolt" });
  });

  it("persists inbound activity but skips only the bound paused Agent execution", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "paused-agent", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "hello", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "paused-receipt" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "paused-message", attachments: [] }, conversation: { id: "paused-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "paused-runtime" });
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentId: "agent-a", agentRuntimeSnapshotId: crypto.randomUUID()
    } } });
    repository.agentAutomaticExecutionEnabled.mockResolvedValue(false);
    await service.webhook("path", Buffer.from("{}"), {}, "signature");
    expect(repository.persistIncoming).toHaveBeenCalled();
    expect(conversations.appendChannelMessage).toHaveBeenCalledWith("w", "actor", "paused-runtime",
      expect.objectContaining({ messageIdentifier: "paused-message", role: "USER" }));
    expect(agents.execute).not.toHaveBeenCalled();
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(repository.diagnostic).toHaveBeenCalledWith("w", "c", "INFO", "AGENT_AUTOMATIC_EXECUTION_PAUSED",
      expect.any(String), { agentId: "agent-a" });
  });

  it("passes prior user and assistant turns to the second invocation without duplicating the current message", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "turn-2", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "What is my name?", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "receipt-2" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "current-message", attachments: [] }, conversation: { id: "same-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "stable-runtime" });
    repository.conversationHistoryBefore.mockResolvedValue([
      { id: "user-1", role: "user", content: "My name is Alice." },
      { id: "assistant-1", role: "assistant", content: "Nice to meet you, Alice." }
    ]);
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
      providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID(),
      conversationHistory: true
    } } });
    agents.execute.mockResolvedValue({ answer: "Your name is Alice." });
    repository.queueOutgoing.mockResolvedValue({ id: "assistant-2", state: "SENT", conversationId: "same-conversation" });
    await service.webhook("path", Buffer.from("{}"), {}, "signature");
    expect(agents.execute).toHaveBeenCalledWith("w", "actor", expect.objectContaining({
      userMessage: "What is my name?",
      conversationHistory: [
        expect.objectContaining({ role: "user", content: "My name is Alice." }),
        expect.objectContaining({ role: "assistant", content: "Nice to meet you, Alice." })
      ]
    }));
    expect(conversations.appendChannelMessage).toHaveBeenLastCalledWith("w", "actor", "stable-runtime",
      expect.objectContaining({ messageIdentifier: "assistant-2", role: "ASSISTANT" }));
    expect(memory.ensureConversationRuntime).not.toHaveBeenCalled();
    expect(memory.latestSnapshots).not.toHaveBeenCalled();
  });
  it("sends no conversation history when the agent execution configuration does not enable it", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "no-history", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "What is my name?", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "receipt-3" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "no-history-message", attachments: [] }, conversation: { id: "no-history-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "no-history-runtime" });
    repository.conversationHistoryBefore.mockResolvedValue([
      { id: "user-1", role: "user", content: "My name is Alice." }
    ]);
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
      providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID()
    } } });
    agents.execute.mockResolvedValue({ answer: "" });
    await service.webhook("path", Buffer.from("{}"), {}, "signature");
    expect(repository.conversationHistoryBefore).not.toHaveBeenCalled();
    const invocation = agents.execute.mock.calls.at(-1)![2] as Record<string, unknown>;
    expect(invocation.userMessage).toBe("What is my name?");
    expect(invocation.conversationHistory).toBeUndefined();
  });
  it("resolves the latest snapshot for the configured Agent memory runtime before invocation", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "memory-turn", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "What is my name?", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    const runtimeId = crypto.randomUUID(), latestSnapshotId = crypto.randomUUID();
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "memory-receipt" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "memory-message", attachments: [] }, conversation: { id: "memory-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "memory-conversation-runtime" });
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
      providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID(),
      memoryRuntimeIds: [runtimeId], memoryRuntimeSnapshotIds: [crypto.randomUUID()]
    } } });
    const conversationMemoryRuntimeId = crypto.randomUUID();
    memory.ensureConversationRuntime.mockResolvedValue({ runtimeId: conversationMemoryRuntimeId, snapshotId: crypto.randomUUID() });
    memory.latestSnapshots.mockResolvedValue([latestSnapshotId, crypto.randomUUID()]);
    agents.execute.mockResolvedValue({ answer: "Alice" });
    repository.queueOutgoing.mockResolvedValue({ id: "memory-answer", state: "SENT", conversationId: "memory-conversation" });
    await service.webhook("path", Buffer.from("{}"), {}, "signature");
    expect(memory.ensureConversationRuntime).toHaveBeenCalledWith(
      "w", "actor", "memory-conversation", runtimeId
    );
    expect(memory.latestSnapshots).toHaveBeenCalledWith("w", [runtimeId, conversationMemoryRuntimeId]);
    expect(agents.execute).toHaveBeenCalledWith("w", "actor", expect.objectContaining({
      memoryRuntimeSnapshotIds: [latestSnapshotId, expect.any(String)]
    }));
  });
  it("uses constant-time-compatible signature material through adapter boundary", () => {
    const body = Buffer.from("payload");
    expect(`sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`).toHaveLength(71);
  });
  it("validates healthy connections and updates connection state", async () => {
    adapter.health.mockResolvedValue({ id: "phone" });
    repository.recordHealth.mockResolvedValue(undefined);
    repository.updateHealth.mockResolvedValue({ id: "conn", workspaceId: "w", channelId: "c", state: "CONNECTED", stateVersion: 1 });

    const result = await service.health("workspace", "actor", "conn");

    expect(adapter.health).toHaveBeenCalledTimes(1);
    expect(repository.recordHealth).toHaveBeenCalledWith("workspace", "conn", "CONNECTED", expect.any(Number), [], { id: "phone" });
    expect(repository.updateHealth).toHaveBeenCalledWith("workspace", "actor", "conn", { id: "phone" }, "CONNECTED");
    expect(result).toEqual({ id: "conn", workspaceId: "w", channelId: "c", state: "CONNECTED", stateVersion: 1 });
  });
  it("preserves original errors when connection context lookup fails", async () => {
    repository.connectionContext.mockRejectedValue(new Error("Channel connection was not found"));

    await expect(service.health("workspace", "actor", "missing-conn")).rejects.toThrow("Channel connection was not found");
    expect(repository.diagnostic).not.toHaveBeenCalled();
    expect(repository.recordHealth).not.toHaveBeenCalled();
    expect(repository.updateHealth).not.toHaveBeenCalled();
  });
  it("records failed health and rethrows provider errors", async () => {
    adapter.health.mockRejectedValue(new Error("Bad gateway"));
    repository.recordHealth.mockResolvedValue(undefined);
    repository.updateHealth.mockResolvedValue({ id: "conn", workspaceId: "w", channelId: "c", state: "FAILED", stateVersion: 1 });

    await expect(service.health("workspace", "actor", "conn")).rejects.toThrow("Bad gateway");
    expect(repository.diagnostic).toHaveBeenCalledWith("workspace", "c", "ERROR", "CHANNEL_HEALTH_FAILED", "Bad gateway");
    expect(repository.recordHealth).toHaveBeenCalledWith("workspace", "conn", "FAILED", expect.any(Number), [], { error: "Bad gateway" });
    expect(repository.updateHealth).toHaveBeenCalledWith("workspace", "actor", "conn", { available: false }, "FAILED");
  });
  it("delegates workspace isolation on all reads", async () => {
    await Promise.resolve(service.listMessages("workspace-a", { state: "SENT" }));
    await Promise.resolve(service.attachments("workspace-a", "channel"));
    await Promise.resolve(service.metrics("workspace-a", "channel"));
    expect(repository.listMessages).toHaveBeenCalledWith("workspace-a", { state: "SENT" });
    expect(repository.attachments).toHaveBeenCalledWith("workspace-a", "channel");
    expect(repository.metrics).toHaveBeenCalledWith("workspace-a", "channel");
  });
  it("maps conversation records with last message time and Responix execution state", async () => {
    const first = new Date("2026-01-01T00:00:00Z"), second = new Date("2026-01-02T00:00:00Z");
    repository.conversations.mockResolvedValue([
      { id: "c-1", channelId: "ch", metadata: null, messages: [{ createdAt: first }] },
      { id: "c-2", channelId: "ch", metadata: { agentExecution: { enabled: false, updatedById: "actor" } }, messages: [{ createdAt: second }] },
      { id: "c-3", channelId: "ch", metadata: {}, messages: [] }
    ]);
    const records = await service.conversations("w");
    expect(repository.conversations).toHaveBeenCalledWith("w", undefined);
    expect(records).toEqual([
      { id: "c-1", channelId: "ch", metadata: null, lastMessageAt: first, agentExecutionEnabled: true },
      { id: "c-2", channelId: "ch", metadata: { agentExecution: { enabled: false, updatedById: "actor" } },
        lastMessageAt: second, agentExecutionEnabled: false },
      { id: "c-3", channelId: "ch", metadata: {}, lastMessageAt: null, agentExecutionEnabled: true }
    ]);
  });
  it("returns the resulting execution state when a conversation disables Responix", async () => {
    repository.setConversationExecution.mockResolvedValue({
      id: "c-1", channelId: "ch",
      metadata: { agentExecution: { enabled: false, updatedById: "actor", updatedAt: "2026-01-03T00:00:00.000Z" } }
    });
    await expect(service.setConversationExecution("w", "actor", "c-1", { enabled: false }))
      .resolves.toEqual({ id: "c-1", channelId: "ch", agentExecutionEnabled: false });
    expect(repository.setConversationExecution).toHaveBeenCalledWith("w", "actor", "c-1", false);
  });
  it("skips agent and workflow execution when the conversation has Responix disabled", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incoming = { providerMessageId: "gated", externalUserId: "1555", externalConversationId: "1555",
      direction: "INCOMING", type: "TEXT", text: "hi", timestamp: new Date(Number(timestamp) * 1000),
      attachments: [], content: {}, metadata: {} };
    adapter.verifySignature.mockReturnValue(true); adapter.normalizeIncoming.mockReturnValue([incoming]);
    repository.acceptWebhook.mockResolvedValue({ id: "gate-receipt" });
    repository.persistIncoming.mockResolvedValue({ created: true,
      message: { id: "gated-message", attachments: [] }, conversation: { id: "gated-conversation" } });
    conversations.prepareChannelConversation.mockResolvedValue({ id: "gated-runtime" });
    repository.conversationExecution.mockResolvedValue({ id: "gated-conversation",
      metadata: { agentExecution: { enabled: false, updatedById: "actor" } } });
    await service.webhook("path", Buffer.from(JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "gated", timestamp }] } }] }] })),
      { entry: [{ changes: [{ value: { messages: [{ id: "gated", timestamp }] } }] }] }, "signature");
    // The customer turn is still recorded, but no execution pipeline runs.
    expect(conversations.appendChannelMessage).toHaveBeenCalledWith("w", "actor", "gated-runtime",
      expect.objectContaining({ messageIdentifier: "gated-message", role: "USER" }));
    expect(repository.latestConfiguration).not.toHaveBeenCalled();
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(agents.execute).not.toHaveBeenCalled();
    expect(repository.diagnostic).toHaveBeenCalledWith("w", "c", "INFO", "CONVERSATION_EXECUTION_DISABLED",
      expect.any(String), expect.objectContaining({ channelConversationId: "gated-conversation" }));
    expect(repository.completeWebhook).toHaveBeenCalledWith("gate-receipt");
  });
});
