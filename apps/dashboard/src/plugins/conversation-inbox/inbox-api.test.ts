import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInboxAttachment, inboxMessagesKey, inboxQueryKey, listInboxAgents,
  listInboxChannels, listInboxConnections, listInboxConversations,
  listInboxMessages, sendInboxMessage
} from "./inbox-api";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@responix/api-client", () => ({ apiClient: api }));

describe("Conversation Inbox API", () => {
  beforeEach(() => Object.values(api).forEach((mock) => mock.mockReset().mockResolvedValue([])));

  it("reads workspace channels through the channel-runtime contract", async () => {
    await listInboxChannels();
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/channels", expect.objectContaining({ query: { page: 1, limit: 100 }, credentials: "include" }));
  });

  it("lists all workspace conversations when no channelId is given", async () => {
    await listInboxConversations();
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/conversations", { credentials: "include" });
  });

  it("filters conversations by channel through the existing query param", async () => {
    await listInboxConversations("channel-1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/conversations", expect.objectContaining({ query: { channelId: "channel-1" }, credentials: "include" }));
  });

  it("pages conversation messages newest-first through the existing messages endpoint", async () => {
    await listInboxMessages("conversation-1", 2, 50);
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/messages", expect.objectContaining({ query: { conversationId: "conversation-1", page: 2, limit: 50 }, credentials: "include" }));
  });

  it("reads channel connections for the selected conversation's channel", async () => {
    await listInboxConnections("channel-1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/channels/channel-1/connections", { credentials: "include" });
  });

  it("loads stored attachment content for previews", async () => {
    await getInboxAttachment("attachment-1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/attachments/attachment-1", { credentials: "include" });
  });

  it("sends outbound text through the queue-ready send endpoint", async () => {
    await sendInboxMessage("channel-1", { connectionId: "connection-1", recipient: "15551234567@s.whatsapp.net", text: "Hi", idempotencyKey: "key-1" });
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/channel-runtime/channels/channel-1/messages",
      { connectionId: "connection-1", recipient: "15551234567@s.whatsapp.net", type: "TEXT", text: "Hi", idempotencyKey: "key-1" },
      { credentials: "include" }
    );
  });

  it("resolves bound Responix names from the agent-studio listing", async () => {
    await listInboxAgents();
    expect(api.get).toHaveBeenCalledWith("/api/v1/agent-studio/agents", expect.objectContaining({ query: { page: 1, limit: 100 }, credentials: "include" }));
  });

  it("scopes query keys by workspace and conversation", () => {
    expect(inboxQueryKey("workspace-1")).toEqual(["workspace", "workspace-1", "channel-runtime", "inbox"]);
    expect(inboxMessagesKey("workspace-1", "conversation-1")).toEqual(["workspace", "workspace-1", "channel-runtime", "inbox", "messages", "conversation-1"]);
  });
});
