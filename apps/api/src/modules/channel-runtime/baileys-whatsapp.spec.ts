import { BadGatewayException } from "@nestjs/common";
import { ChannelMessageType } from "@prisma/client";
import { join, resolve } from "node:path";
import { loadBaileys } from "./baileys-loader";
import { BaileysWhatsappIncomingProcessor } from "./baileys-whatsapp.incoming-processor";
import { ChannelRuntimeService } from "./channel-runtime.service";
import { BaileysWhatsappSessionManager } from "./baileys-whatsapp.session-manager";
import type { ChannelProviderConnection } from "./contracts/channel-provider.contract";
import type { NormalizedChannelMessage } from "./channel-runtime.types";
import { BaileysDiagnosticsService } from "./baileys-diagnostics.service";

jest.mock("./baileys-loader", () => ({ loadBaileys: jest.fn() }));

describe("Baileys WhatsApp Baileys integration", () => {
  const fakeSessionRoot = join(process.cwd(), "tmp-baileys-sessions");
  const loadBaileysMock = loadBaileys as jest.MockedFunction<typeof loadBaileys>;
  const makeWASocket = jest.fn();
  const useMultiFileAuthState = jest.fn();
  const saveCreds = jest.fn();
  const diagnostics = { record: jest.fn(), recent: jest.fn().mockReturnValue([]), latest: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    makeWASocket.mockReset();
    process.env.BAILEYS_SESSION_DIR = fakeSessionRoot;
    saveCreds.mockResolvedValue(undefined);
    useMultiFileAuthState.mockResolvedValue({ state: {}, saveCreds } as any);
    loadBaileysMock.mockResolvedValue({ default: makeWASocket, makeWASocket, useMultiFileAuthState,
      fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 3000, 0] }),
      DisconnectReason: { loggedOut: 401 } } as never);
  });

  it("uses workspace and connection identifiers for session storage and routes incoming messages.upsert through the processor", async () => {
    const processor = { processIncoming: jest.fn().mockResolvedValue(undefined) };
    const socket = { ev: { on: jest.fn() }, sendMessage: jest.fn().mockResolvedValue({ key: { id: "provider-msg" } }) } as any;
    makeWASocket.mockReturnValue(socket);
    const manager = new BaileysWhatsappSessionManager(processor as any, diagnostics as any);
    const connection = { id: "conn-1", workspaceId: "workspace-1", channelId: "channel-1", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any, createdById: "actor" } as ChannelProviderConnection;

    await manager.sendMessage(connection, { type: "text", to: "1555", text: "hello" }, new AbortController().signal);

    expect(useMultiFileAuthState).toHaveBeenCalledWith(join(fakeSessionRoot, connection.workspaceId, connection.id));
    expect(makeWASocket).toHaveBeenCalledTimes(1);
    expect(socket.ev.on).toHaveBeenCalledWith("messages.upsert", expect.any(Function));
    const credentialsCallback = socket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "creds.update")?.[1];
    await credentialsCallback();
    expect(saveCreds).toHaveBeenCalledTimes(1);
    expect(socket.sendMessage).toHaveBeenCalledWith("1555@s.whatsapp.net", { text: "hello" });
    expect((BaileysWhatsappSessionManager as any).sessions.has(connection.id)).toBe(true);

    const messageCallback = socket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "messages.upsert")?.[1];
    expect(messageCallback).toBeDefined();

    const incomingEvent = { type: "notify", messages: [
      { key: { fromMe: true, remoteJid: "1555@s.whatsapp.net", id: "ignored" }, message: { conversation: "ignore" } },
      { key: { fromMe: false, remoteJid: "1555@s.whatsapp.net", id: "msg-123", participant: "1555@s.whatsapp.net" }, message: { conversation: "hello" }, pushName: "Alice" }
    ] };

    await messageCallback(incomingEvent);

    expect(processor.processIncoming).toHaveBeenCalledTimes(1);
    expect(processor.processIncoming).toHaveBeenCalledWith(connection, expect.arrayContaining([
      expect.objectContaining({ providerMessageId: "msg-123", externalUserId: "1555@s.whatsapp.net", direction: "INCOMING" })
    ]));

    const connectionCallback = socket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "connection.update")?.[1];
    await connectionCallback({ qr: "real-qr" });
    await expect(manager.getConnectionStatus(connection)).resolves.toMatchObject({ status: "QR_REQUIRED", qr: "real-qr" });

    const secondManager = new BaileysWhatsappSessionManager(processor as any, diagnostics as any);
    await expect(secondManager.getConnectionStatus(connection)).resolves.toMatchObject({ status: "QR_REQUIRED", qr: "real-qr" });
    expect(makeWASocket).toHaveBeenCalledTimes(1);
    expect((BaileysWhatsappSessionManager as any).sessions.get(connection.id).socket).toBe(socket);

    await connectionCallback({ connection: "open" });
    await expect(secondManager.getConnectionStatus(connection)).resolves.toEqual({ status: "CONNECTED", qr: undefined });
    expect(makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("replaces a closed non-logged-out socket once and reloads the persisted auth state", async () => {
    const processor = { processIncoming: jest.fn() };
    const firstSocket = { ev: { on: jest.fn() }, sendMessage: jest.fn() } as any;
    const secondSocket = { ev: { on: jest.fn() }, sendMessage: jest.fn() } as any;
    makeWASocket.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket);
    const manager = new BaileysWhatsappSessionManager(processor as any, diagnostics as any);
    const connection = { id: "conn-restart", workspaceId: "workspace-restart", channelId: "channel", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any, createdById: "actor" } as ChannelProviderConnection;

    await manager.getConnectionStatus(connection);
    const callback = firstSocket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "connection.update")?.[1];
    await callback({ connection: "close", lastDisconnect: { error: { output: { statusCode: 515 } } } });

    expect(saveCreds).not.toHaveBeenCalled();
    expect(useMultiFileAuthState).toHaveBeenCalledTimes(2);
    expect(useMultiFileAuthState.mock.calls[1]?.[0]).toBe(useMultiFileAuthState.mock.calls[0]?.[0]);
    expect(makeWASocket).toHaveBeenCalledTimes(2);
    expect((BaileysWhatsappSessionManager as any).sessions.get(connection.id).socket).toBe(secondSocket);
    await manager.getConnectionStatus(connection);
    expect(makeWASocket).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent health checks into one socket creation", async () => {
    const socket = { ev: { on: jest.fn() }, sendMessage: jest.fn() } as any;
    makeWASocket.mockReturnValue(socket);
    const manager = new BaileysWhatsappSessionManager({ processIncoming: jest.fn() } as any, diagnostics as any);
    const connection = { id: "conn-concurrent", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any, createdById: "actor" } as ChannelProviderConnection;

    await Promise.all([
      manager.getConnectionStatus(connection),
      manager.getConnectionStatus(connection),
      manager.getConnectionStatus(connection)
    ]);

    expect(useMultiFileAuthState).toHaveBeenCalledTimes(1);
    expect(makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("uses the established API auth store independently of the launch working directory", () => {
    delete process.env.BAILEYS_SESSION_DIR;
    const manager = new BaileysWhatsappSessionManager({ processIncoming: jest.fn() } as any, diagnostics as any);
    expect((manager as any).sessionRoot).toBe(resolve(__dirname, "../../..", "data", "baileys-sessions"));
    expect((manager as any).findApiRoot(resolve(__dirname, "../../../dist"))).toBe(resolve(__dirname, "../../.."));
  });

  it("does not reconnect a logged-out socket", async () => {
    const socket = { ev: { on: jest.fn() }, sendMessage: jest.fn() } as any;
    makeWASocket.mockReturnValue(socket);
    const manager = new BaileysWhatsappSessionManager({ processIncoming: jest.fn() } as any, diagnostics as any);
    const connection = { id: "conn-logged-out", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any, createdById: "actor" } as ChannelProviderConnection;

    await manager.getConnectionStatus(connection);
    const callback = socket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "connection.update")?.[1];
    await callback({ connection: "close", lastDisconnect: { error: { output: { statusCode: 401 } } } });

    expect(makeWASocket).toHaveBeenCalledTimes(1);
    expect((BaileysWhatsappSessionManager as any).sessions.get(connection.id)).toMatchObject({ socket: null, status: "LOGGED_OUT" });
  });

  it("disconnects intentionally without deleting pairing or auto-reconnecting", async () => {
    const socket = { ev: { on: jest.fn() }, sendMessage: jest.fn(), end: jest.fn() } as any;
    makeWASocket.mockReturnValue(socket);
    const manager = new BaileysWhatsappSessionManager({ processIncoming: jest.fn() } as any, diagnostics as any);
    const connection = { id: "conn-disconnect", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any, createdById: "actor" } as ChannelProviderConnection;

    await manager.getConnectionStatus(connection);
    const callback = socket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "connection.update")?.[1];
    await manager.disconnect(connection);
    await callback({ connection: "close", lastDisconnect: { error: { output: { statusCode: 428 } } } });

    expect(socket.end).toHaveBeenCalledTimes(1);
    expect(makeWASocket).toHaveBeenCalledTimes(1);
    await expect(manager.snapshot(connection)).resolves.toMatchObject({ state: "DISCONNECTED", socketPresent: false, sessionPresent: true });
  });

  it("ignores invalid messages.upsert payloads safely", async () => {
    const processor = { processIncoming: jest.fn().mockResolvedValue(undefined) };
    const socket = { ev: { on: jest.fn() }, sendMessage: jest.fn() } as any;
    makeWASocket.mockReturnValue(socket);
    const manager = new BaileysWhatsappSessionManager(processor as any, diagnostics as any);
    const connection = { id: "conn-2", workspaceId: "workspace-2", channelId: "channel-2", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any, createdById: "actor" } as ChannelProviderConnection;

    await manager.sendMessage(connection, { type: "text", to: "1555", text: "hi" }, new AbortController().signal);
    const messageCallback = socket.ev.on.mock.calls.find((call: unknown[]) => call[0] === "messages.upsert")?.[1];
    expect(messageCallback).toBeDefined();

    await messageCallback({ type: "append", messages: [{ key: { fromMe: false, remoteJid: "1555@s.whatsapp.net", id: "msg-1" } }] });
    await messageCallback({ type: "notify", messages: [] });

    expect(processor.processIncoming).not.toHaveBeenCalled();
  });
});

describe("BaileysDiagnosticsService", () => {
  it("keeps only the latest 50 safe activity events", () => {
    const diagnostics = new BaileysDiagnosticsService();
    for (let index = 0; index < 55; index += 1) diagnostics.record("connection", "SOCKET", `event-${index}`);
    const events = diagnostics.recent("connection");
    expect(events).toHaveLength(50);
    expect(events[0]).toMatchObject({ detail: "event-54" });
    expect(events.at(-1)).toMatchObject({ detail: "event-5" });
  });
});

describe("BaileysWhatsappIncomingProcessor", () => {
  const diagnostics = { record: jest.fn(), recent: jest.fn().mockReturnValue([]), latest: jest.fn() };
  const repository = { persistIncoming: jest.fn(), linkConversation: jest.fn(), latestConfiguration: jest.fn(),
    conversationHistoryBefore: jest.fn(), conversationExecution: jest.fn(), diagnostic: jest.fn(), agentAutomaticExecutionEnabled: jest.fn() };
  const conversationsRuntime = { prepareChannelConversation: jest.fn(), appendChannelMessage: jest.fn() };
  const workflows = { execute: jest.fn() };
  const agents = { execute: jest.fn() };
  const memory = { latestSnapshots: jest.fn().mockResolvedValue([]),
    ensureConversationRuntime: jest.fn().mockResolvedValue({ runtimeId: "memory-runtime", snapshotId: "memory-snapshot" }) };
  // The processor's conversation-level Responix gate is the real service
  // method; only the repository (database boundary) is mocked, so the
  // disabled/enabled metadata mapping is exercised as production code.
  const realGateService = new ChannelRuntimeService(repository as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, conversationsRuntime as never, agents as never, memory as never, workflows as never);
  const runtimeService = { send: jest.fn(),
    conversationExecutionEnabled: (workspaceId: string, conversationId: string) =>
      realGateService.conversationExecutionEnabled(workspaceId, conversationId) };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.persistIncoming.mockResolvedValue({ created: true, message: { id: "mid", attachments: [] }, conversation: { id: "cid" } });
    conversationsRuntime.prepareChannelConversation.mockResolvedValue({ id: "runtime" });
    conversationsRuntime.appendChannelMessage.mockResolvedValue({ id: "runtime" });
    repository.conversationHistoryBefore.mockResolvedValue([]);
    repository.agentAutomaticExecutionEnabled.mockResolvedValue(true);
    repository.linkConversation.mockResolvedValue(undefined);
    repository.latestConfiguration.mockResolvedValue({ configuration: {} });
    // Responix defaults to enabled unless the persisted conversation state disables it.
    repository.conversationExecution.mockResolvedValue({ id: "cid", metadata: null });
    repository.diagnostic.mockResolvedValue(undefined);
  });

  it("fails explicitly when createdById is missing", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const message: NormalizedChannelMessage = {
      providerMessageId: "msg-1", externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    };

    await expect(processor.processIncoming(connection, [message])).rejects.toThrow(BadGatewayException);
    expect(repository.persistIncoming).not.toHaveBeenCalled();
  });

  it("persists incoming messages and integrates into conversation runtime without duplicate pipeline execution", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const message: NormalizedChannelMessage = {
      providerMessageId: "msg-1", externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    };

    await processor.processIncoming(connection, [message]);

    expect(repository.persistIncoming).toHaveBeenCalledWith("workspace", "actor", "channel", "conn", message);
    expect(conversationsRuntime.prepareChannelConversation).toHaveBeenCalledWith("workspace", "actor", "cid", expect.objectContaining({
      name: "baileys 1555", participants: expect.any(Array), settings: { maxHistoryMessages: 20 }
    }));
    expect(conversationsRuntime.appendChannelMessage).toHaveBeenCalledWith("workspace", "actor", "runtime",
      expect.objectContaining({ messageIdentifier: "mid", role: "USER" }));
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(agents.execute).not.toHaveBeenCalled();
    expect(runtimeService.send).not.toHaveBeenCalled();
  });

  it("stores the customer message but never executes the agent when Responix is disabled for the conversation", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    repository.conversationExecution.mockResolvedValue({ id: "cid",
      metadata: { agentExecution: { enabled: false, updatedById: "actor" } } });
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: "agent-snapshot", promptExecutionSnapshotId: "prompt-snapshot",
      providerRuntimeSnapshotId: "provider-snapshot", executionPipelineSnapshotId: "pipeline-snapshot" } } });
    agents.execute.mockResolvedValue({ answer: "should never happen" });
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const message: NormalizedChannelMessage = {
      providerMessageId: "msg-1", externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    };

    await processor.processIncoming(connection, [message]);

    // The message is persisted and visible in the conversation...
    expect(repository.persistIncoming).toHaveBeenCalledWith("workspace", "actor", "channel", "conn", message);
    expect(conversationsRuntime.appendChannelMessage).toHaveBeenCalledWith("workspace", "actor", "runtime",
      expect.objectContaining({ messageIdentifier: "mid", role: "USER" }));
    // ...but no runtime configuration, workflow or agent execution, and no outbound reply happens.
    expect(repository.latestConfiguration).not.toHaveBeenCalled();
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(agents.execute).not.toHaveBeenCalled();
    expect(runtimeService.send).not.toHaveBeenCalled();
    expect(repository.diagnostic).toHaveBeenCalledWith("workspace", "channel", "INFO", "CONVERSATION_EXECUTION_DISABLED",
      expect.any(String), expect.objectContaining({ channelConversationId: "cid" }));
  });

  it("keeps inbound messages while the bound Agent is paused", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentId: "agent-a"
    } } });
    repository.agentAutomaticExecutionEnabled.mockResolvedValue(false);
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const message: NormalizedChannelMessage = { providerMessageId: "paused", externalUserId: "1555",
      externalConversationId: "1555", direction: "INCOMING", type: ChannelMessageType.TEXT, text: "hello",
      timestamp: new Date(), attachments: [], content: {}, metadata: {} };
    await processor.processIncoming(connection, [message]);
    expect(repository.persistIncoming).toHaveBeenCalled();
    expect(repository.agentAutomaticExecutionEnabled).toHaveBeenCalledWith("workspace", "agent-a");
    expect(conversationsRuntime.appendChannelMessage).toHaveBeenCalledWith("workspace", "actor", "runtime",
      expect.objectContaining({ messageIdentifier: "mid", role: "USER" }));
    expect(agents.execute).not.toHaveBeenCalled();
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(runtimeService.send).not.toHaveBeenCalled();
    expect(repository.diagnostic).toHaveBeenCalledWith("workspace", "channel", "INFO", "AGENT_AUTOMATIC_EXECUTION_PAUSED",
      expect.any(String), { agentId: "agent-a" });
  });

  it("executes the agent and sends the reply when Responix is enabled for the conversation", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    // Default conversation state (metadata: null) means Responix is enabled.
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: "agent-snapshot", promptExecutionSnapshotId: "prompt-snapshot",
      providerRuntimeSnapshotId: "provider-snapshot", executionPipelineSnapshotId: "pipeline-snapshot" } } });
    agents.execute.mockResolvedValue({ answer: "hello there" });
    (runtimeService.send as jest.Mock).mockResolvedValue({ id: "out-1" });
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const message: NormalizedChannelMessage = {
      providerMessageId: "msg-1", externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    };

    await processor.processIncoming(connection, [message]);

    expect(agents.execute).toHaveBeenCalledTimes(1);
    expect(agents.execute).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      userMessage: "hello", idempotencyKey: "baileys:mid" }));
    expect(runtimeService.send).toHaveBeenCalledWith("workspace", "actor", "channel", expect.objectContaining({
      text: "hello there", recipient: "1555" }));
    expect(repository.diagnostic).not.toHaveBeenCalled();
  });


  it("blocks a disabled conversation without affecting an enabled conversation on the same channel", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    repository.persistIncoming
      .mockResolvedValueOnce({ created: true, message: { id: "mid-off", attachments: [] }, conversation: { id: "cid-off" } })
      .mockResolvedValueOnce({ created: true, message: { id: "mid-on", attachments: [] }, conversation: { id: "cid-on" } });
    repository.conversationExecution
      .mockResolvedValueOnce({ id: "cid-off", metadata: { agentExecution: { enabled: false } } })
      .mockResolvedValueOnce({ id: "cid-on", metadata: null });
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: "agent-snapshot", promptExecutionSnapshotId: "prompt-snapshot",
      providerRuntimeSnapshotId: "provider-snapshot", executionPipelineSnapshotId: "pipeline-snapshot" } } });
    agents.execute.mockResolvedValue({ answer: "hi" });
    (runtimeService.send as jest.Mock).mockResolvedValue({ id: "out-1" });
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const makeMessage = (providerMessageId: string): NormalizedChannelMessage => ({
      providerMessageId, externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    });

    await processor.processIncoming(connection, [makeMessage("msg-off"), makeMessage("msg-on")]);

    // Only the enabled conversation reaches the agent; the disabled one is stored but not executed.
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(agents.execute).toHaveBeenCalledTimes(1);
    expect(agents.execute).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      idempotencyKey: "baileys:mid-on" }));
    expect(runtimeService.send).toHaveBeenCalledTimes(1);
    expect(repository.diagnostic).toHaveBeenCalledTimes(1);
    expect(repository.diagnostic).toHaveBeenCalledWith("workspace", "channel", "INFO", "CONVERSATION_EXECUTION_DISABLED",
      expect.any(String), expect.objectContaining({ channelConversationId: "cid-off" }));
  });

  it("keeps blocking after runtime reinitialization until Responix is re-enabled", async () => {
    const makeProcessor = () => new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    repository.persistIncoming
      .mockResolvedValueOnce({ created: true, message: { id: "mid-1", attachments: [] }, conversation: { id: "cid" } })
      .mockResolvedValueOnce({ created: true, message: { id: "mid-2", attachments: [] }, conversation: { id: "cid" } })
      .mockResolvedValueOnce({ created: true, message: { id: "mid-3", attachments: [] }, conversation: { id: "cid" } });
    // The persisted conversation state is read on every inbound message, so a
    // reinitialized runtime (fresh processor) still blocks, and re-enabling resumes.
    repository.conversationExecution
      .mockResolvedValueOnce({ id: "cid", metadata: { agentExecution: { enabled: false } } })
      .mockResolvedValueOnce({ id: "cid", metadata: { agentExecution: { enabled: false } } })
      .mockResolvedValueOnce({ id: "cid", metadata: { agentExecution: { enabled: true } } });
    repository.latestConfiguration.mockResolvedValue({ configuration: { agentExecution: {
      agentRuntimeSnapshotId: "agent-snapshot", promptExecutionSnapshotId: "prompt-snapshot",
      providerRuntimeSnapshotId: "provider-snapshot", executionPipelineSnapshotId: "pipeline-snapshot" } } });
    agents.execute.mockResolvedValue({ answer: "hi" });
    (runtimeService.send as jest.Mock).mockResolvedValue({ id: "out-1" });
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const makeMessage = (providerMessageId: string): NormalizedChannelMessage => ({
      providerMessageId, externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    });

    await makeProcessor().processIncoming(connection, [makeMessage("msg-1")]);
    expect(agents.execute).not.toHaveBeenCalled();
    await makeProcessor().processIncoming(connection, [makeMessage("msg-2")]);
    expect(agents.execute).not.toHaveBeenCalled();
    expect(repository.diagnostic).toHaveBeenCalledTimes(2);
    await makeProcessor().processIncoming(connection, [makeMessage("msg-3")]);
    expect(agents.execute).toHaveBeenCalledTimes(1);
    expect(agents.execute).toHaveBeenCalledWith("workspace", "actor", expect.objectContaining({
      idempotencyKey: "baileys:mid-3" }));
  });


  it("keeps a duplicate delivery of a blocked message from executing or appending again", async () => {
    const processor = new BaileysWhatsappIncomingProcessor(repository as any, conversationsRuntime as any,
      workflows as any, agents as any, memory as any, runtimeService as any, diagnostics as any);
    repository.conversationExecution.mockResolvedValue({ id: "cid", metadata: { agentExecution: { enabled: false } } });
    repository.persistIncoming
      .mockResolvedValueOnce({ created: true, message: { id: "mid", attachments: [] }, conversation: { id: "cid" } })
      .mockResolvedValueOnce({ created: false, message: { id: "mid", attachments: [] }, conversation: { id: "cid" } });
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;
    const message: NormalizedChannelMessage = {
      providerMessageId: "msg-1", externalUserId: "1555", externalConversationId: "1555", direction: "INCOMING",
      type: ChannelMessageType.TEXT, text: "hello", timestamp: new Date(), attachments: [], content: {}, metadata: {}
    };

    await processor.processIncoming(connection, [message, message]);

    expect(agents.execute).not.toHaveBeenCalled();
    expect(workflows.execute).not.toHaveBeenCalled();
    expect(conversationsRuntime.appendChannelMessage).toHaveBeenCalledTimes(1);
    expect(repository.diagnostic).toHaveBeenCalledTimes(1);
  });

});

describe("BaileysWhatsappAdapter", () => {
  const diagnostics = { record: jest.fn(), recent: jest.fn().mockReturnValue([]), latest: jest.fn() };
  it("routes outgoing payloads through the session manager and returns the provider message id", async () => {
    const sessionManager = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "provider-msg" } }) };
    const adapter = new (require("./adapters/baileys-whatsapp.adapter").BaileysWhatsappAdapter)(sessionManager as any, diagnostics as any);
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;

    const result = await adapter.send(connection, { type: "text", to: "1555", text: "reply" }, new AbortController().signal);

    expect(sessionManager.sendMessage).toHaveBeenCalledWith(connection, { type: "text", to: "1555", text: "reply" }, expect.any(AbortSignal));
    expect(result.providerMessageId).toBe("provider-msg");
    expect(result.raw).toMatchObject({ key: { id: "provider-msg" } });
  });

  it("rejects unsupported outgoing message types safely", async () => {
    const sessionManager = { sendMessage: jest.fn() };
    const adapter = new (require("./adapters/baileys-whatsapp.adapter").BaileysWhatsappAdapter)(sessionManager as any, diagnostics as any);
    const connection = { id: "conn", workspaceId: "workspace", channelId: "channel", providerKey: "baileys",
      createdById: "actor", configuration: {}, credentials: {} as any, transport: {} as any } as ChannelProviderConnection;

    await expect(adapter.send(connection, { type: "image", to: "1555", text: "not allowed" } as any, new AbortController().signal)).rejects.toThrow("Baileys provider supports only text messages");
    expect(sessionManager.sendMessage).not.toHaveBeenCalled();
  });
});
