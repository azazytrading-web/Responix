import { createHash, randomUUID } from "node:crypto";
import { ChannelMessageStateMachine } from "./channel-message.state-machine";
import { ChannelRuntimeRepository } from "./channel-runtime.repository";
import { PrismaService } from "../../database/prisma.service";
import { ConversationRuntimeRepository } from "../conversation-runtime/conversation-runtime.repository";
import { ConversationRuntimeService } from "../conversation-runtime/conversation-runtime.service";
import { ConversationRuntimeValidator } from "../conversation-runtime/conversation-runtime.validator";

const enabled = process.env.RUN_CHANNEL_HISTORY_DB_TEST === "1";
const describeDb = enabled ? describe : describe.skip;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describeDb("Channel conversation history PostgreSQL integration", () => {
  const prisma = new PrismaService();
  const conversations = new ConversationRuntimeService(
    new ConversationRuntimeRepository(prisma, new ConversationRuntimeValidator())
  );
  const channels = new ChannelRuntimeRepository(prisma, {} as never, new ChannelMessageStateMachine());
  const created = { conversationId: "", conversationIds: [] as string[], sessionId: "", runtimeId: "", messageIds: [] as string[] };

  afterAll(async () => {
    if (created.messageIds.length) await prisma.channelMessage.deleteMany({ where: { id: { in: created.messageIds } } });
    if (created.conversationIds.length) await prisma.channelConversation.deleteMany({ where: { id: { in: created.conversationIds } } });
    if (created.sessionId) await prisma.channelSession.deleteMany({ where: { id: created.sessionId } });
    if (created.runtimeId) {
      await prisma.conversationRuntimeAuditMetadata.deleteMany({ where: { runtimeId: created.runtimeId } });
      await prisma.conversationRuntimeMessage.deleteMany({ where: { runtimeId: created.runtimeId } });
      await prisma.conversationRuntimeContext.deleteMany({ where: { runtimeId: created.runtimeId } });
      await prisma.conversationRuntimeParticipant.deleteMany({ where: { runtimeId: created.runtimeId } });
      await prisma.conversationRuntimeSettings.deleteMany({ where: { runtimeId: created.runtimeId } });
      await prisma.conversationRuntimeState.deleteMany({ where: { runtimeId: created.runtimeId } });
      await prisma.auditLog.deleteMany({ where: { entityType: "ConversationRuntime", entityId: created.runtimeId } });
      await prisma.conversationRuntime.deleteMany({ where: { id: created.runtimeId } });
    }
    await prisma.$disconnect();
  });

  it("reuses one runtime and returns ordered prior turns for the second invocation", async () => {
    const connection = await prisma.channelConnection.findFirst({
      select: { id: true, workspaceId: true, channelId: true, createdById: true }
    });
    if (!connection?.createdById) throw new Error("A development ChannelConnection with an actor is required");
    const externalUserId = `history-e2e-${randomUUID()}`;
    const session = await prisma.channelSession.create({ data: {
      workspaceId: connection.workspaceId, channelId: connection.channelId, connectionId: connection.id,
      externalUserId, expiresAt: new Date(Date.now() + 60_000)
    } });
    created.sessionId = session.id;
    const channelConversation = await prisma.channelConversation.create({ data: {
      workspaceId: connection.workspaceId, channelId: connection.channelId, sessionId: session.id,
      externalConversationId: externalUserId, metadata: { disposable: true, test: "channel-history" }
    } });
    created.conversationId = channelConversation.id;
    created.conversationIds.push(channelConversation.id);
    const runtimeInput = {
      name: `History E2E ${externalUserId}`, compatibilityVersion: "1.0.0",
      contexts: [{ contextKey: "channel", metadata: { channelConversationId: channelConversation.id } }],
      participants: [{ participantKey: "customer", type: "CUSTOMER" as const,
        displayMetadata: { externalUserId } }], settings: { maxHistoryMessages: 20 },
      metadata: { channelConversationId: channelConversation.id, disposable: true }
    };
    const runtimeBefore = await conversations.prepareChannelConversation(
      connection.workspaceId, connection.createdById, channelConversation.id, runtimeInput);
    created.runtimeId = runtimeBefore.id;

    const createMessage = async (direction: "INCOMING" | "OUTGOING", text: string, ordinal: number) => {
      const id = randomUUID(); const payload = { text, ordinal, disposable: true };
      await prisma.channelMessage.create({ data: {
        id, workspaceId: connection.workspaceId, channelId: connection.channelId, connectionId: connection.id,
        conversationId: channelConversation.id, direction, type: "TEXT", state: "DELIVERED",
        idempotencyKey: `history-e2e:${externalUserId}:${ordinal}`, normalizedPayload: payload,
        payloadHash: hash(payload), checksum: hash({ id, payload }), deliveredAt: new Date(Date.now() + ordinal)
      } });
      created.messageIds.push(id); return id;
    };
    const user1 = await createMessage("INCOMING", "My name is Alice.", 1);
    await conversations.appendChannelMessage(connection.workspaceId, connection.createdById, runtimeBefore.id,
      { messageIdentifier: user1, role: "USER", participantKey: "customer", contentHash: hash("My name is Alice.") });
    const assistant1 = await createMessage("OUTGOING", "Nice to meet you, Alice.", 2);
    await conversations.appendChannelMessage(connection.workspaceId, connection.createdById, runtimeBefore.id,
      { messageIdentifier: assistant1, role: "ASSISTANT", contentHash: hash("Nice to meet you, Alice.") });
    const user2 = await createMessage("INCOMING", "What is my name?", 3);
    await conversations.appendChannelMessage(connection.workspaceId, connection.createdById, runtimeBefore.id,
      { messageIdentifier: user2, role: "USER", participantKey: "customer", contentHash: hash("What is my name?") });
    const runtimeAfter = await conversations.prepareChannelConversation(
      connection.workspaceId, connection.createdById, channelConversation.id, runtimeInput);
    const unrelated = await prisma.channelConversation.create({ data: {
      workspaceId: connection.workspaceId, channelId: connection.channelId, sessionId: session.id,
      externalConversationId: `${externalUserId}:unrelated`, metadata: { disposable: true }
    } });
    created.conversationIds.push(unrelated.id);
    const unrelatedId = randomUUID();
    await prisma.channelMessage.create({ data: {
      id: unrelatedId, workspaceId: connection.workspaceId, channelId: connection.channelId, connectionId: connection.id,
      conversationId: unrelated.id, direction: "INCOMING", type: "TEXT", state: "DELIVERED",
      idempotencyKey: `history-e2e:${externalUserId}:unrelated`, normalizedPayload: { text: "LEAK-ME-NOT" },
      payloadHash: hash("LEAK-ME-NOT"), checksum: hash({ unrelatedId }), deliveredAt: new Date()
    } });
    created.messageIds.push(unrelatedId);
    const history = await channels.conversationHistoryBefore(
      connection.workspaceId, channelConversation.id, user2);

    expect(runtimeAfter.id).toBe(runtimeBefore.id);
    expect(history.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: "user", content: "My name is Alice." },
      { role: "assistant", content: "Nice to meet you, Alice." }
    ]);
    expect(history.some(({ content }) => content === "LEAK-ME-NOT")).toBe(false);
    expect(await prisma.conversationRuntime.count({ where: {
      metadata: { path: ["channelConversationId"], equals: channelConversation.id }
    } })).toBe(1);
    expect(await prisma.conversationRuntimeMessage.count({ where: { runtimeId: runtimeBefore.id } })).toBe(3);
    console.log(JSON.stringify({ channelConversationId: channelConversation.id,
      runtimeIdBefore: runtimeBefore.id, runtimeIdAfter: runtimeAfter.id,
      channelMessages: [
        { id: user1, role: "USER", content: "My name is Alice." },
        { id: assistant1, role: "ASSISTANT", content: "Nice to meet you, Alice." },
        { id: user2, role: "USER", content: "What is my name?" }
      ], channelMessageCount: 3, runtimeMessageCount: 3, runtimeSnapshotIds: [],
      turn2InvocationHistory: history.map(({ role, content }) => ({ role, content })) }));
  });
});
