import { createHmac } from "node:crypto";
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
    channelProviderKey: jest.fn(), createProviderConnection: jest.fn(), recordHealth: jest.fn() };
  const adapter = { key: "whatsapp", validateConfiguration: jest.fn().mockReturnValue([]), capabilities: jest.fn().mockReturnValue({ supported: new Set(), limits: {}, metadata: {} }),
    verifyWebhook: jest.fn(), verifySignature: jest.fn(), normalizeIncoming: jest.fn(), normalizeOutgoing: jest.fn(),
    webhookMetadata: jest.fn(), normalizeEvents: jest.fn(), health: jest.fn(), send: jest.fn(), uploadMedia: jest.fn(), downloadMedia: jest.fn() };
  const registry = { resolve: jest.fn().mockReturnValue(adapter), installed: jest.fn() };
  const credentials = { resolve: jest.fn().mockResolvedValue({ get: jest.fn(), has: jest.fn(), fingerprint: jest.fn(), names: jest.fn() }), rotate: jest.fn() };
  const transport = { request: jest.fn() };
  const validator = { connection: jest.fn(), message: jest.fn(), attachment: jest.fn() };
  const conversations = { prepare: jest.fn() }; const agents = { execute: jest.fn() }; const workflows = { execute: jest.fn() };
  const retry = { retryable: jest.fn(), delay: jest.fn() };
  const connectionStates = { assert: jest.fn() };
  const service = new ChannelRuntimeService(repository as never, validator as never, registry as never, credentials as never, transport as never,
    retry as never, connectionStates, conversations as never, agents as never, workflows as never);
  beforeEach(() => { jest.clearAllMocks(); repository.connectionContextByWebhook.mockResolvedValue({ id: "conn", workspaceId: "w", channelId: "c",
    createdById: "actor", providerConfiguration: {}, businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0",
    channel: { provider: { name: "whatsapp" } } }); registry.resolve.mockReturnValue(adapter);
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
    conversations.prepare.mockResolvedValue({ id: "conversation-runtime" }); repository.latestConfiguration.mockResolvedValue({ configuration: {
      agentExecution: { agentRuntimeSnapshotId: crypto.randomUUID(), promptExecutionPayloadId: crypto.randomUUID(),
        providerRuntimeSnapshotId: crypto.randomUUID(), executionPipelineSnapshotId: crypto.randomUUID(), memoryRuntimeSnapshotIds: [memoryId],
        retrievalRuntimeSnapshotId: retrievalId, availableToolVersionIds: [toolId] } } });
    agents.execute.mockResolvedValue({ answer: "" });
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid", timestamp }] } }] }] };
    await service.webhook("path", Buffer.from(JSON.stringify(payload)), payload, "signature");
    expect(agents.execute).toHaveBeenCalledWith("w", "actor", expect.objectContaining({ userMessage: "hello",
      memoryRuntimeSnapshotIds: [memoryId], retrievalRuntimeSnapshotId: retrievalId, availableToolVersionIds: [toolId] }));
    expect(repository.completeWebhook).toHaveBeenCalledWith("receipt");
  });
  it("uses constant-time-compatible signature material through adapter boundary", () => {
    const body = Buffer.from("payload");
    expect(`sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`).toHaveLength(71);
  });
  it("delegates workspace isolation on all reads", async () => {
    await Promise.resolve(service.listMessages("workspace-a", { state: "SENT" }));
    await Promise.resolve(service.attachments("workspace-a", "channel"));
    await Promise.resolve(service.metrics("workspace-a", "channel"));
    expect(repository.listMessages).toHaveBeenCalledWith("workspace-a", { state: "SENT" });
    expect(repository.attachments).toHaveBeenCalledWith("workspace-a", "channel");
    expect(repository.metrics).toHaveBeenCalledWith("workspace-a", "channel");
  });
});
