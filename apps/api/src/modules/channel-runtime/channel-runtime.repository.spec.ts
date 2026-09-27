import { ChannelMessageType } from "@prisma/client";
import { createHash } from "node:crypto";
import { ChannelMessageStateMachine } from "./channel-message.state-machine";
import { ChannelRuntimeRepository } from "./channel-runtime.repository";

describe("ChannelRuntimeRepository", () => {
  const prisma = { channel: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    aiAgent: { findFirst: jest.fn() },
    channelConnection: { findFirst: jest.fn() }, channelSession: { upsert: jest.fn() },
    channelMessage: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    channelConversation: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    channelMetric: { upsert: jest.fn() }, channelAudit: { create: jest.fn() }, auditLog: { create: jest.fn() },
    $transaction: jest.fn() };
  const crypto = { encrypt: jest.fn(), decrypt: jest.fn(), fingerprint: jest.fn() };
  const repository = new ChannelRuntimeRepository(prisma as never, crypto as never, new ChannelMessageStateMachine());
  beforeEach(() => { jest.clearAllMocks(); prisma.channel.findMany.mockResolvedValue([]); prisma.channel.count.mockResolvedValue(0);
    prisma.channelMessage.findMany.mockResolvedValue([]); prisma.channelMessage.count.mockResolvedValue(0);
    prisma.channelConversation.findMany.mockResolvedValue([]); prisma.channelConversation.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (values: Promise<unknown>[]) => Promise.all(values)); });
  it("enforces workspace filters with deterministic pagination", async () => {
    await repository.listChannels("workspace-a", { page: 2, limit: 10, state: "ACTIVE", search: "support" });
    expect(prisma.channel.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-a", state: "ACTIVE",
      name: { contains: "support", mode: "insensitive" } }, skip: 10, take: 10 }));
    await repository.listMessages("workspace-b", { page: 1, limit: 20, state: "DELIVERED", type: "TEXT" });
    expect(prisma.channelMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "workspace-b", state: "DELIVERED", type: "TEXT" } }));
  });
  it("rejects a channel whose immutable checksum was modified", async () => {
    prisma.channel.findFirst.mockResolvedValue({ workspaceId: "workspace-a", name: "Support", configurationHash: "hash", checksum: "tampered" });
    await expect(repository.getChannel("workspace-a", "channel")).rejects.toThrow("checksum");
    expect(prisma.channel.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "channel", workspaceId: "workspace-a" } }));
  });
  it("reads the selected Agent's workspace-scoped persisted automatic execution setting", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue({ runtimeConfiguration: { automaticExecution: { enabled: false } } });
    await expect(repository.agentAutomaticExecutionEnabled("workspace-a", "agent-a")).resolves.toBe(false);
    expect(prisma.aiAgent.findFirst).toHaveBeenCalledWith({
      where: { id: "agent-a", workspaceId: "workspace-a", deletedAt: null }, select: { runtimeConfiguration: true }
    });
    prisma.aiAgent.findFirst.mockResolvedValue({ runtimeConfiguration: {} });
    await expect(repository.agentAutomaticExecutionEnabled("workspace-a", "agent-b")).resolves.toBe(true);
  });
  it("loads only bounded prior messages from the same workspace conversation in chronological order", async () => {
    const now = new Date();
    prisma.channelMessage.findFirst.mockResolvedValue({ id: "current", createdAt: now });
    prisma.channelMessage.findMany.mockResolvedValue([
      { id: "assistant", direction: "OUTGOING", normalizedPayload: { text: "Nice to meet you, Alice." }, createdAt: new Date(now.getTime() - 1) },
      { id: "user", direction: "INCOMING", normalizedPayload: { text: "My name is Alice." }, createdAt: new Date(now.getTime() - 2) }
    ]);
    await expect(repository.conversationHistoryBefore("workspace", "conversation", "current"))
      .resolves.toEqual([
        expect.objectContaining({ id: "user", role: "user", content: "My name is Alice." }),
        expect.objectContaining({ id: "assistant", role: "assistant", content: "Nice to meet you, Alice." })
      ]);
    expect(prisma.channelMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", conversationId: "conversation" }), take: 20
    }));
  });
  it("keeps the newest history within both the message and character limits", async () => {
    const now = new Date();
    prisma.channelMessage.findFirst.mockResolvedValue({ id: "current", createdAt: now });
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `message-${index}`, direction: "INCOMING", normalizedPayload: { text: "x".repeat(2_000) },
      createdAt: new Date(now.getTime() - (21 - index))
    }));
    prisma.channelMessage.findMany.mockResolvedValue(rows.slice().reverse());
    const history = await repository.conversationHistoryBefore("workspace", "conversation", "current");
    expect(prisma.channelMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    expect(history).toHaveLength(16);
    expect(history.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(32_000);
    expect(history[0]?.id).toBe("message-5");
    expect(history.at(-1)?.id).toBe("message-20");
  });
  it("lists workspace conversations newest-first with the newest message timestamp", async () => {
    const latest = new Date("2026-01-02T00:00:00Z");
    prisma.channelConversation.findMany.mockResolvedValue([{ id: "c-1", metadata: null, messages: [{ createdAt: latest }] }]);
    await expect(repository.conversations("workspace-a", "channel")).resolves.toEqual([
      { id: "c-1", metadata: null, messages: [{ createdAt: latest }] }
    ]);
    expect(prisma.channelConversation.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-a", channelId: "channel" },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } }
    });
  });
  it("stores conversation-level Responix execution state in metadata without losing other values", async () => {
    prisma.channelConversation.findFirst.mockResolvedValue({ id: "c-1", channelId: "ch", metadata: { owner: "team" }, updatedAt: new Date() });
    prisma.channelConversation.update.mockResolvedValue({});
    await repository.setConversationExecution("workspace", "actor", "c-1", false);
    expect(prisma.channelConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c-1", workspaceId: "workspace" }
    }));
    const updateCall = prisma.channelConversation.update.mock.calls[0]![0] as {
      where: { id: string }; data: { metadata: Record<string, unknown> };
    };
    expect(updateCall.where).toEqual({ id: "c-1" });
    expect(updateCall.data.metadata.owner).toBe("team");
    expect(updateCall.data.metadata.agentExecution).toEqual(expect.objectContaining({
      enabled: false, updatedById: "actor", updatedAt: expect.any(String)
    }));
  });
  it("rejects execution updates for conversations outside the workspace", async () => {
    await expect(repository.setConversationExecution("workspace", "actor", "missing", true)).rejects.toThrow("not found");
    expect(prisma.channelConversation.update).not.toHaveBeenCalled();
  });
  it("exposes the producing agent from history normalized payloads", async () => {
    const now = new Date();
    prisma.channelMessage.findFirst.mockResolvedValue({ id: "current", createdAt: now });
    prisma.channelMessage.findMany.mockResolvedValue([
      { id: "assistant", direction: "OUTGOING", createdAt: new Date(now.getTime() - 1),
        normalizedPayload: { text: "Nice to meet you, Alice.", producer: { agentId: "agent-b", agentName: "Bolt" } } },
      { id: "user", direction: "INCOMING", createdAt: new Date(now.getTime() - 2),
        normalizedPayload: { text: "My name is Alice." } }
    ]);
    const history = await repository.conversationHistoryBefore("workspace", "conversation", "current");
    expect(history).toEqual([
      {
        id: "user", role: "user", content: "My name is Alice.",
        createdAt: new Date(now.getTime() - 2)
      },
      {
        id: "assistant", role: "assistant", content: "Nice to meet you, Alice.",
        createdAt: new Date(now.getTime() - 1), agentId: "agent-b", agentName: "Bolt"
      }
    ]);
  });
  it("stamps the producing agent into the outgoing normalized payload", async () => {
    const checksum = createHash("sha256")
      .update('{"configurationHash":"hash","name":"Support","workspaceId":"workspace"}')
      .digest("hex");
    prisma.channel.findFirst.mockResolvedValue({
      workspaceId: "workspace", name: "Support", configurationHash: "hash", checksum
    });
    prisma.channelConnection.findFirst.mockResolvedValue({ id: "connection" });
    prisma.channelSession.upsert.mockResolvedValue({ id: "session" });
    prisma.channelConversation.upsert.mockResolvedValue({ id: "conversation" });
    prisma.channelMessage.create.mockResolvedValue({ id: "message" });
    prisma.channelMetric.upsert.mockResolvedValue({});
    prisma.channelAudit.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback: (client: unknown) => Promise<unknown>) =>
      callback(prisma));
    await repository.queueOutgoing("workspace", "actor", {
      channelId: "channel", connectionId: "connection", recipient: "1555", type: ChannelMessageType.TEXT,
      text: "hello", idempotencyKey: "key", producer: { agentId: "agent-b", agentName: "Bolt" }
    });
    const createCall = (prisma.channelMessage.create as jest.Mock).mock.calls[0]![0] as {
      data: { normalizedPayload: Record<string, unknown> };
    };
    expect(createCall.data.normalizedPayload).toEqual(expect.objectContaining({
      direction: "OUTGOING", text: "hello", producer: { agentId: "agent-b", agentName: "Bolt" }
    }));
  });
  it("omits the producer field when no agent produced the outgoing message", async () => {
    const checksum = createHash("sha256")
      .update('{"configurationHash":"hash","name":"Support","workspaceId":"workspace"}')
      .digest("hex");
    prisma.channel.findFirst.mockResolvedValue({
      workspaceId: "workspace", name: "Support", configurationHash: "hash", checksum
    });
    prisma.channelConnection.findFirst.mockResolvedValue({ id: "connection" });
    prisma.channelSession.upsert.mockResolvedValue({ id: "session" });
    prisma.channelConversation.upsert.mockResolvedValue({ id: "conversation" });
    prisma.channelMessage.create.mockResolvedValue({ id: "message" });
    prisma.channelMetric.upsert.mockResolvedValue({});
    prisma.channelAudit.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback: (client: unknown) => Promise<unknown>) =>
      callback(prisma));
    await repository.queueOutgoing("workspace", "actor", {
      channelId: "channel", connectionId: "connection", recipient: "1555", type: ChannelMessageType.TEXT,
      text: "hello", idempotencyKey: "key"
    });
    const createCall = (prisma.channelMessage.create as jest.Mock).mock.calls[0]![0] as {
      data: { normalizedPayload: Record<string, unknown> };
    };
    expect(createCall.data.normalizedPayload).toEqual(expect.objectContaining({ text: "hello" }));
    expect(createCall.data.normalizedPayload).not.toHaveProperty("producer");
  });
});
