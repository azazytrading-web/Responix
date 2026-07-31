import { ChannelMessageStateMachine } from "./channel-message.state-machine";
import { ChannelRuntimeRepository } from "./channel-runtime.repository";

describe("ChannelRuntimeRepository", () => {
  const prisma = { channel: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    channelMessage: { findMany: jest.fn(), count: jest.fn() }, $transaction: jest.fn() };
  const crypto = { encrypt: jest.fn(), decrypt: jest.fn(), fingerprint: jest.fn() };
  const repository = new ChannelRuntimeRepository(prisma as never, crypto as never, new ChannelMessageStateMachine());
  beforeEach(() => { jest.clearAllMocks(); prisma.channel.findMany.mockResolvedValue([]); prisma.channel.count.mockResolvedValue(0);
    prisma.channelMessage.findMany.mockResolvedValue([]); prisma.channelMessage.count.mockResolvedValue(0);
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
});
