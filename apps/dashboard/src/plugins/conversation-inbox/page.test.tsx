import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboxPage } from "./page";
import { MessageList } from "./components";
import { loadInboxReadState } from "./inbox-read-state";

const mocks = vi.hoisted(() => ({
  platform: {
    state: "READY",
    snapshot: { workspace: { id: "w1" } },
    retry: vi.fn(),
    hasPermission: vi.fn<(permission: string) => boolean>(() => true)
  },
  channels: {
    data: [] as Array<Record<string, unknown>>,
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 }
  },
  conversations: [] as Array<Record<string, unknown>>,
  connections: [] as Array<Record<string, unknown>>,
  agents: {
    data: [] as Array<Record<string, unknown>>,
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 }
  },
  workspaceMessages: [] as Array<Record<string, unknown>>,
  messagePages: new Map<number, { data: Array<Record<string, unknown>>; pagination: { page: number; limit: number; total: number; totalPages: number } }>(),
  listMessages: vi.fn<(conversationId: string, page: number, limit: number) => Promise<unknown>>(),
  listWorkspaceMessages: vi.fn<(page: number, limit: number) => Promise<unknown>>(),
  send: vi.fn<(channelId: string, input: unknown) => Promise<unknown>>(),
  setConversationExecution: vi.fn<(conversationId: string, enabled: boolean) => Promise<unknown>>(),
  refetch: vi.fn(),
  useQueryConfigs: [] as Array<{ queryKey: readonly unknown[]; refetchInterval?: unknown }>
}));

vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("./inbox-api", () => ({
  inboxQueryKey: (workspaceId?: string) => ["workspace", workspaceId, "channel-runtime", "inbox"],
  inboxMessagesKey: (workspaceId?: string, conversationId?: string | null) =>
    ["workspace", workspaceId, "channel-runtime", "inbox", "messages", conversationId ?? null],
  listInboxChannels: vi.fn().mockResolvedValue(mocks.channels),
  listInboxConversations: vi.fn().mockResolvedValue(mocks.conversations),
  listInboxConnections: vi.fn().mockResolvedValue(mocks.connections),
  listInboxAgents: vi.fn().mockResolvedValue(mocks.agents),
  listInboxMessages: (conversationId: string, page: number, limit: number) => mocks.listMessages(conversationId, page, limit),
  listWorkspaceMessages: (page: number, limit: number) => mocks.listWorkspaceMessages(page, limit),
  getInboxAttachment: vi.fn(),
  sendInboxMessage: (channelId: string, input: unknown) => mocks.send(channelId, input),
  setConversationExecution: (conversationId: string, enabled: boolean) => mocks.setConversationExecution(conversationId, enabled)
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: { queryKey: readonly unknown[]; refetchInterval?: unknown }) => {
    mocks.useQueryConfigs.push(config);
    const key = config.queryKey.join("|");
    if (key.includes("recent-messages")) return {
      data: { data: mocks.workspaceMessages, pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } },
      isPending: false, isError: false, refetch: mocks.refetch
    };
    if (key.includes("connections")) return { data: mocks.connections, isPending: false, isError: false, refetch: mocks.refetch };
    if (key.includes("conversations")) return { data: mocks.conversations, isPending: false, isError: false, refetch: mocks.refetch };
    if (key.includes("channels")) return { data: mocks.channels, isPending: false, isError: false, refetch: mocks.refetch };
    if (key.includes("agents")) return { data: mocks.agents, isPending: false, isError: false, refetch: mocks.refetch };
    return { data: undefined, isPending: false, isError: false, refetch: mocks.refetch };
  },
  useMutation: (config: { mutationFn: (input?: unknown) => Promise<unknown>; onSuccess?: (value: unknown) => void; onError?: (error: unknown) => void }) => ({
    isPending: false,
    mutateAsync: async (input?: unknown) => {
      try {
        const value = await config.mutationFn(input);
        config.onSuccess?.(value);
        return value;
      } catch (error) {
        config.onError?.(error);
        throw error;
      }
    }
  }),
  // @responix/state constructs a real QueryClient at module load time.
  QueryClient: class {
    invalidateQueries = vi.fn();
  }
}));

// jsdom has no layout; stub the scroll APIs the message viewport relies on.
const scrollToMock = vi.fn();

const channel = {
  id: "ch1", workspaceId: "w1", providerId: "p1", provider: { name: "whatsapp" },
  name: "WhatsApp Business", state: "ACTIVE", version: 1, stateVersion: 1,
  compatibilityVersion: "1.0", configurationHash: "h", checksum: "c",
  createdById: "u1", updatedById: "u1",
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", archivedAt: null
};

const conversation = {
  id: "conv1", workspaceId: "w1", channelId: "ch1", sessionId: "s1",
  conversationRuntimeId: null, externalConversationId: "15551234567@s.whatsapp.net",
  metadata: { pushName: "Jane Doe" },
  createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-12T10:00:00.000Z"
};

const connection = {
  id: "conn1", workspaceId: "w1", channelId: "ch1", state: "CONNECTED", stateVersion: 2,
  businessAccountId: "100", phoneNumberId: "200", displayPhoneNumber: "+15550000",
  apiVersion: "v23.0", webhookPathKey: "safe-path", accessTokenFingerprint: "fp",
  capabilities: {}, health: null, lastHealthCheckAt: null, createdById: "u1",
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
};

function makeMessage(id: string, direction: "INCOMING" | "OUTGOING", text: string, state: string, conversationId = "conv1", createdAt = "2026-09-12T10:00:00.000Z") {
  return {
    id, workspaceId: "w1", channelId: "ch1", connectionId: "conn1", conversationId,
    direction, type: "TEXT", state, stateVersion: 2, providerMessageId: `wamid.${id}`,
    idempotencyKey: `key-${id}`, replyToMessageId: null,
    normalizedPayload: { text, timestamp: createdAt, attachments: [], content: {}, metadata: {} },
    payloadHash: "h", checksum: "c", queuedAt: null, sentAt: createdAt,
    deliveredAt: createdAt, readAt: null, failedAt: null,
    createdAt, updatedAt: createdAt,
    attachments: [], deliveries: []
  };
}

describe("Conversation Inbox page", () => {
  const scrollContainer = () => screen.getByTestId("message-list").firstElementChild as HTMLElement;

  /** Puts the jsdom viewport into a deterministic scroll geometry. */
  const setScrollGeometry = (element: HTMLElement, geometry: { scrollHeight: number; clientHeight: number; scrollTop: number }) => {
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: geometry.scrollHeight });
    Object.defineProperty(element, "clientHeight", { configurable: true, value: geometry.clientHeight });
    Object.defineProperty(element, "scrollTop", { configurable: true, writable: true, value: geometry.scrollTop });
  };

  beforeEach(() => {
    window.localStorage.clear();
    mocks.platform.state = "READY";
    mocks.platform.snapshot = { workspace: { id: "w1" } };
    mocks.platform.hasPermission.mockReturnValue(true);
    mocks.channels = { data: [channel], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } };
    mocks.conversations = [conversation];
    mocks.connections = [connection];
    mocks.agents = { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } };
    mocks.workspaceMessages = [];
    mocks.useQueryConfigs.length = 0;
    mocks.messagePages.clear();
    mocks.listMessages.mockReset().mockImplementation(
      (conversationId: string, page: number) =>
        Promise.resolve(mocks.messagePages.get(page) ?? { data: [], pagination: { page, limit: 50, total: 0, totalPages: 1 } })
    );
    mocks.listWorkspaceMessages.mockReset().mockImplementation(() =>
      Promise.resolve({ data: mocks.workspaceMessages, pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })
    );
    mocks.send.mockReset().mockResolvedValue({});
    mocks.setConversationExecution.mockReset().mockResolvedValue({ id: "conv1", channelId: "ch1", agentExecutionEnabled: false });
    mocks.refetch.mockReset();
    scrollToMock.mockClear();
    Element.prototype.scrollTo = scrollToMock;
  });

  it("blocks access without the channel runtime read permission", () => {
    mocks.platform.hasPermission.mockImplementation((permission) => permission !== "channel.runtime.read");
    render(<InboxPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText("channel.runtime.read")).toBeInTheDocument();
  });

  it("shows the setup prompt when no channel exists", () => {
    mocks.channels = { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } };
    render(<InboxPage />);
    expect(screen.getByText("No channels connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up WhatsApp Business" })).toHaveAttribute("href", "/channels/whatsapp");
  });

  it("lists conversations and renders the selected message history oldest-first", async () => {
    // Backend pages newest-first: page 1 holds the newer message.
    mocks.messagePages.set(1, {
      data: [makeMessage("m2", "OUTGOING", "Hi Jane", "DELIVERED"), makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")],
      pagination: { page: 1, limit: 50, total: 2, totalPages: 1 }
    });
    render(<InboxPage />);
    expect(await screen.findByTestId("conversation-item-conv1")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("conversation-item-conv1"));
    await waitFor(() => expect(mocks.listMessages).toHaveBeenCalledWith("conv1", 1, 50));
    const bubbles = await screen.findAllByTestId(/^message-bubble-/);
    expect(bubbles.map((bubble) => bubble.getAttribute("data-testid"))).toEqual(["message-bubble-m1", "message-bubble-m2"]);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi Jane")).toBeInTheDocument();
  });

  it("loads older pages and prepends them above the newest batch", async () => {
    mocks.messagePages.set(1, {
      data: [makeMessage("m2", "OUTGOING", "Second", "DELIVERED")],
      pagination: { page: 1, limit: 50, total: 2, totalPages: 2 }
    });
    mocks.messagePages.set(2, {
      data: [makeMessage("m1", "INCOMING", "First", "DELIVERED")],
      pagination: { page: 2, limit: 50, total: 2, totalPages: 2 }
    });
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    await screen.findByText("Second");
    fireEvent.click(screen.getByTestId("load-older"));
    await waitFor(() => expect(mocks.listMessages).toHaveBeenCalledWith("conv1", 2, 50));
    const bubbles = await screen.findAllByTestId(/^message-bubble-/);
    expect(bubbles.map((bubble) => bubble.getAttribute("data-testid"))).toEqual(["message-bubble-m1", "message-bubble-m2"]);
    expect(screen.queryByTestId("load-older")).not.toBeInTheDocument();
  });

  it("offers a retry when the message history fails", async () => {
    mocks.listMessages.mockRejectedValueOnce(new Error("boom"));
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    expect(await screen.findByText("Messages unavailable")).toBeInTheDocument();
  });

  it("shows the channel-bound Responix only when agent-studio reports a binding", async () => {
    mocks.agents = {
      data: [{ id: "agent-1", name: "Support Responix", slug: "support", status: "PUBLISHED", activeChannels: [{ connectionId: "conn1", channelId: "ch1", stateVersion: 1 }] }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 }
    };
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    fireEvent.click(screen.getByTestId("conversation-identity"));
    expect(await screen.findByText("Support Responix")).toBeInTheDocument();
  });

  it("reports no Responix binding when none exists", async () => {
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    fireEvent.click(screen.getByTestId("conversation-identity"));
    expect(await screen.findByText("No Responix is bound to this channel")).toBeInTheDocument();
  });

  it("sends outbound text through the existing send contract", async () => {
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    await screen.findByTestId("conversation-panel");
    fireEvent.change(screen.getByLabelText("Reply to this conversation"), { target: { value: "Thanks!" } });
    fireEvent.click(screen.getByTestId("send-message"));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("ch1", expect.objectContaining({
        connectionId: "conn1",
        recipient: "15551234567@s.whatsapp.net",
        text: "Thanks!"
      }))
    );
  });

  it("disables sending without the channel runtime write permission", async () => {
    mocks.platform.hasPermission.mockImplementation((permission) => permission !== "channel.runtime.write");
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    await screen.findByTestId("conversation-panel");
    expect(screen.getByTestId("send-message")).toBeDisabled();
  });

  it("orders conversations by their latest message activity", async () => {
    // "stale" has the newer connection updatedAt but older message activity.
    const fresh = { ...conversation, id: "conv-fresh", externalConversationId: "15551111111@s.whatsapp.net", lastMessageAt: "2026-09-12T09:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z" };
    const stale = { ...conversation, id: "conv-stale", externalConversationId: "15552222222@s.whatsapp.net", lastMessageAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-12T10:00:00.000Z" };
    mocks.conversations = [stale, fresh];
    render(<InboxPage />);
    const items = await screen.findAllByTestId(/^conversation-item-/);
    expect(items.map((item) => item.getAttribute("data-testid"))).toEqual(["conversation-item-conv-fresh", "conversation-item-conv-stale"]);
  });

  it("shows a session-scoped unread count for customer messages arriving after first appearance", async () => {
    const other = { ...conversation, id: "conv2", externalConversationId: "15552222222@s.whatsapp.net" };
    mocks.conversations = [conversation, other];
    // Baseline is conv2.updatedAt (2026-09-12T10:00Z): only the 11:00 INCOMING
    // counts — the OUTGOING and the pre-baseline INCOMING never do.
    mocks.workspaceMessages = [
      { conversationId: "conv2", direction: "INCOMING", createdAt: "2026-09-12T11:00:00.000Z" },
      { conversationId: "conv2", direction: "OUTGOING", createdAt: "2026-09-12T11:05:00.000Z" },
      { conversationId: "conv2", direction: "INCOMING", createdAt: "2026-09-12T09:00:00.000Z" }
    ];
    render(<InboxPage />);
    expect(await screen.findByTestId("unread-badge-conv2")).toHaveTextContent("1");
    expect(screen.queryByTestId("unread-badge-conv1")).not.toBeInTheDocument();
  });

  it("clears the unread badge when the conversation is opened", async () => {
    const other = { ...conversation, id: "conv2", externalConversationId: "15552222222@s.whatsapp.net" };
    mocks.conversations = [conversation, other];
    mocks.workspaceMessages = [{ conversationId: "conv2", direction: "INCOMING", createdAt: "2026-09-12T11:00:00.000Z" }];
    render(<InboxPage />);
    expect(await screen.findByTestId("unread-badge-conv2")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("conversation-item-conv2"));
    expect(await screen.findByTestId("conversation-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge-conv2")).not.toBeInTheDocument();
  });

  it("discards a stale message page that arrives after the user switched conversations", async () => {
    let releaseStale: (value: unknown) => void = () => undefined;
    const stalePage = new Promise((resolve) => {
      releaseStale = resolve;
    });
    const other = { ...conversation, id: "conv2", externalConversationId: "15552222222@s.whatsapp.net" };
    mocks.conversations = [conversation, other];
    mocks.listMessages.mockImplementation(
      (conversationId: string, page: number) =>
        conversationId === "conv1"
          ? stalePage
          : Promise.resolve({
              data: [makeMessage("m2", "INCOMING", "From conv2", "DELIVERED", "conv2")],
              pagination: { page, limit: 50, total: 1, totalPages: 1 }
            })
    );
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    fireEvent.click(screen.getByTestId("conversation-item-conv2"));
    expect(await screen.findByText("From conv2")).toBeInTheDocument();
    await act(async () => {
      releaseStale({
        data: [makeMessage("m1", "INCOMING", "Stale message", "DELIVERED")],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
      });
      await stalePage;
    });
    expect(screen.queryByText("Stale message")).not.toBeInTheDocument();
    expect(screen.getByText("From conv2")).toBeInTheDocument();
  });

  it("keeps a single copy of each message when the newest batch is refetched after sending", async () => {
    mocks.messagePages.set(1, {
      data: [makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
    });
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    await screen.findByText("Hello there");
    // The next sync returns the outbound reply plus a duplicate of the inbound.
    mocks.messagePages.set(1, {
      data: [makeMessage("m2", "OUTGOING", "Thanks!", "DELIVERED"), makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")],
      pagination: { page: 1, limit: 50, total: 2, totalPages: 1 }
    });
    fireEvent.change(screen.getByLabelText("Reply to this conversation"), { target: { value: "Thanks!" } });
    fireEvent.click(screen.getByTestId("send-message"));
    await waitFor(() => expect(mocks.listMessages).toHaveBeenCalledTimes(2));
    await screen.findByText("Thanks!");
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("polls conversations and the workspace message window every 5 seconds", () => {
    render(<InboxPage />);
    const find = (part: string) =>
      mocks.useQueryConfigs.find((config) => config.queryKey.join("|").includes(part));
    expect(find("conversations")?.refetchInterval).toBe(5000);
    expect(find("recent-messages")?.refetchInterval).toBe(5000);
  });

  it("keeps syncing the open conversation's messages every 3 seconds", async () => {
    vi.useFakeTimers();
    try {
      mocks.messagePages.set(1, {
        data: [makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
      });
      render(<InboxPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("conversation-item-conv1"));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mocks.listMessages).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(mocks.listMessages).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(mocks.listMessages).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("disables Responix for the selected conversation from the execution control", async () => {
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    fireEvent.click(screen.getByTestId("conversation-identity"));
    const state = await screen.findByTestId("responix-state");
    expect(state).toHaveTextContent("ON");
    fireEvent.click(screen.getByTestId("responix-toggle"));
    await waitFor(() => expect(mocks.setConversationExecution).toHaveBeenCalledWith("conv1", false));
  });

  it("reflects a server-reported disabled Responix in the execution control", async () => {
    mocks.conversations = [{ ...conversation, agentExecutionEnabled: false }];
    render(<InboxPage />);
    fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
    fireEvent.click(screen.getByTestId("conversation-identity"));
    expect(await screen.findByTestId("responix-state")).toHaveTextContent("OFF");
    expect(screen.getByTestId("responix-toggle")).toHaveTextContent("Enable");
  });

  it("keeps unread counts after remount instead of re-baselining them to zero", async () => {
    // A customer message arrives after the conversation was last baselined.
    mocks.workspaceMessages = [makeMessage("m1", "INCOMING", "New message", "DELIVERED", "conv1", "2026-09-12T10:01:00.000Z")];
    const first = render(<InboxPage />);
    await screen.findByTestId("conversation-item-conv1");
    expect(await screen.findByTestId("unread-badge-conv1")).toHaveTextContent("1");

    // Refresh / navigation: unmount and remount. The read boundary was
    // persisted to localStorage, so the unread count is restored instead of
    // the conversation being re-baselined to its latest message.
    first.unmount();
    render(<InboxPage />);
    expect(await screen.findByTestId("unread-badge-conv1")).toHaveTextContent("1");
  });

  it("clears the unread count when the conversation is opened", async () => {
    mocks.workspaceMessages = [makeMessage("m1", "INCOMING", "New message", "DELIVERED", "conv1", "2026-09-12T10:01:00.000Z")];
    render(<InboxPage />);
    await screen.findByTestId("unread-badge-conv1");
    fireEvent.click(screen.getByTestId("conversation-item-conv1"));
    expect(screen.queryByTestId("unread-badge-conv1")).not.toBeInTheDocument();
    // Flush the async message load triggered by the selection.
    await waitFor(() => expect(mocks.listMessages).toHaveBeenCalledWith("conv1", 1, 50));

    // The persisted boundary moved past the unread message.
    const stored = loadInboxReadState("w1");
    expect(stored.conv1).toBeGreaterThan(new Date("2026-09-12T10:01:00Z").getTime());
  });

  it("persists the read boundary and never moves it while the inbox refetches", async () => {
    mocks.workspaceMessages = [makeMessage("m1", "INCOMING", "New message", "DELIVERED", "conv1", "2026-09-12T10:01:00.000Z")];
    render(<InboxPage />);
    await screen.findByTestId("unread-badge-conv1");
    const stored = loadInboxReadState("w1");
    expect(stored.conv1).toBe(new Date("2026-09-12T10:00:00Z").getTime());
  });

  it("marks conversations with Responix disabled with a red indicator in the list", async () => {
    mocks.conversations = [
      { ...conversation, id: "conv1", agentExecutionEnabled: false },
      { ...conversation, id: "conv2" }
    ];
    render(<InboxPage />);
    await screen.findByTestId("conversation-item-conv1");
    expect(screen.getByTestId("responix-off-conv1")).toBeInTheDocument();
    expect(screen.queryByTestId("responix-off-conv2")).not.toBeInTheDocument();
  });

  describe("Inbox 3-panel layout", () => {
    it("places the conversation list on the right of the active chat", async () => {
      render(<InboxPage />);
      fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
      await screen.findByTestId("conversation-panel");
      const panel = screen.getByTestId("conversation-panel");
      const list = screen.getByTestId("conversation-list");
      // The list follows the chat in the DOM, i.e. it sits on the right side.
      expect(list.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it("bounds the inbox to the application viewport so the page itself never scrolls", () => {
      render(<InboxPage />);
      expect(screen.getByTestId("inbox-page")).toHaveClass("h-[calc(100dvh-56px)]");
    });

    it("gives the message history its own internal scrolling surface", async () => {
      mocks.messagePages.set(1, {
        data: [makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
      });
      render(<InboxPage />);
      fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
      await screen.findByTestId("message-list");
      const viewport = screen.getByTestId("message-list").firstElementChild as HTMLElement;
      expect(viewport).toHaveClass("h-full", "overflow-auto");
    });
  });

  describe("Chat viewport scroll behavior", () => {
    it("lands on the newest message when a conversation is opened", async () => {
      mocks.messagePages.set(1, {
        data: [
          makeMessage("m2", "OUTGOING", "Second", "DELIVERED"),
          makeMessage("m1", "INCOMING", "First", "DELIVERED")
        ],
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 }
      });
      render(<InboxPage />);
      fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
      await screen.findAllByTestId(/^message-bubble-/);
      expect(scrollToMock).toHaveBeenLastCalledWith({ top: expect.any(Number) as number, behavior: "auto" });
    });

    it("does not re-scroll to the bottom when the periodic sync returns the same messages", async () => {
      vi.useFakeTimers();
      try {
        mocks.messagePages.set(1, {
          data: [makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
        });
        render(<InboxPage />);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        await act(async () => {
          fireEvent.click(screen.getByTestId("conversation-item-conv1"));
          await vi.advanceTimersByTimeAsync(0);
        });
        // Only the initial land-at-newest scroll happened.
        expect(scrollToMock).toHaveBeenCalledTimes(1);
        // Two periodic syncs with an unchanged batch must not move the view.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });
        expect(scrollToMock).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Conversation profile panel", () => {
    const openProfile = async () => {
      render(<InboxPage />);
      fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
      fireEvent.click(await screen.findByTestId("conversation-identity"));
      return screen.findByTestId("conversation-profile");
    };

    it("opens from the chat header identity", async () => {
      await openProfile();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows the real conversation, channel and connection details", async () => {
      await openProfile();
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Jane Doe")).toBeInTheDocument();
      expect(within(dialog).getByText("15551234567@s.whatsapp.net")).toBeInTheDocument();
      expect(within(dialog).getByText("conv1")).toBeInTheDocument();
      expect(within(dialog).getByText("s1")).toBeInTheDocument();
      expect(within(dialog).getByText("WhatsApp Business (whatsapp)")).toBeInTheDocument();
      expect(within(dialog).getByText("+15550000")).toBeInTheDocument();
      expect(within(dialog).getByText("CONNECTED")).toBeInTheDocument();
    });

    it("closes from the close button, the backdrop and Escape", async () => {
      render(<InboxPage />);
      fireEvent.click(await screen.findByTestId("conversation-item-conv1"));

      fireEvent.click(screen.getByTestId("conversation-identity"));
      expect(await screen.findByTestId("conversation-profile")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("conversation-profile-close"));
      expect(screen.queryByTestId("conversation-profile")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("conversation-identity"));
      expect(await screen.findByTestId("conversation-profile")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Close conversation information"));
      expect(screen.queryByTestId("conversation-profile")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("conversation-identity"));
      expect(await screen.findByTestId("conversation-profile")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByTestId("conversation-profile")).not.toBeInTheDocument();
    });

    it("reflects the persisted Responix state inside the panel", async () => {
      mocks.conversations = [{ ...conversation, agentExecutionEnabled: false }];
      await openProfile();
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByTestId("responix-state")).toHaveTextContent("OFF");
      expect(within(dialog).getByTestId("responix-toggle")).toHaveTextContent("Enable");
    });

    it("closes when the user selects a different conversation", async () => {
      const other = { ...conversation, id: "conv2", externalConversationId: "15552222222@s.whatsapp.net" };
      mocks.conversations = [conversation, other];
      render(<InboxPage />);
      fireEvent.click(await screen.findByTestId("conversation-item-conv1"));
      fireEvent.click(screen.getByTestId("conversation-identity"));
      expect(await screen.findByTestId("conversation-profile")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("conversation-item-conv2"));
      expect(screen.queryByTestId("conversation-profile")).not.toBeInTheDocument();
      expect(screen.getByTestId("conversation-panel")).toBeInTheDocument();
    });
  });

  describe("MessageList live-sync behavior", () => {
    const listProps = { hasOlder: false, loadingOlder: false, onLoadOlder: vi.fn() };

    it("offers a jump-down chip when new messages arrive while the user is reading history", () => {
      const { rerender } = render(
        <MessageList conversationKey="conv1" messages={[makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")]} {...listProps} />
      );
      const element = scrollContainer();
      setScrollGeometry(element, { scrollHeight: 1000, clientHeight: 300, scrollTop: 400 }); // 300px from the bottom
      fireEvent.scroll(element);
      rerender(
        <MessageList
          conversationKey="conv1"
          messages={[makeMessage("m1", "INCOMING", "Hello there", "DELIVERED"), makeMessage("m2", "INCOMING", "New message", "DELIVERED")]}
          {...listProps}
        />
      );
      expect(screen.getByTestId("new-messages-chip")).toHaveTextContent("1 new message");
      fireEvent.click(screen.getByTestId("new-messages-chip"));
      expect(scrollToMock).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
      expect(screen.queryByTestId("new-messages-chip")).not.toBeInTheDocument();
    });

    it("auto-scrolls to the newest message while the user stays at the bottom", () => {
      const { rerender } = render(
        <MessageList conversationKey="conv1" messages={[makeMessage("m1", "INCOMING", "Hello there", "DELIVERED")]} {...listProps} />
      );
      const element = scrollContainer();
      setScrollGeometry(element, { scrollHeight: 1000, clientHeight: 300, scrollTop: 700 }); // at the bottom
      fireEvent.scroll(element);
      rerender(
        <MessageList
          conversationKey="conv1"
          messages={[makeMessage("m1", "INCOMING", "Hello there", "DELIVERED"), makeMessage("m2", "INCOMING", "New message", "DELIVERED")]}
          {...listProps}
        />
      );
      expect(scrollToMock).toHaveBeenCalledWith({ top: 1000, behavior: "auto" });
      expect(screen.queryByTestId("new-messages-chip")).not.toBeInTheDocument();
    });
  });
});
