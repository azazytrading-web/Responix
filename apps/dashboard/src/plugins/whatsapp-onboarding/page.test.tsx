import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppOnboardingPage } from "./page";

const mocks = vi.hoisted(() => ({
  platform: { state: "READY", snapshot: { workspace: { id: "w1" } }, retry: vi.fn(), hasPermission: vi.fn<(permission: string) => boolean>(() => true) },
  channels: { data: [] as unknown[], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } },
  connections: [] as unknown[], queryError: false, invalidate: vi.fn<() => Promise<void>>(),
  diagnostics: undefined as undefined | Record<string, unknown>,
  createChannel: vi.fn<(name: string) => Promise<unknown>>(),
  createConnection: vi.fn<(id: string, input: unknown) => Promise<unknown>>(),
  health: vi.fn<(id: string) => Promise<unknown>>(),
  transition: vi.fn<(id: string, state: string, version: number) => Promise<unknown>>(),
  updateConnection: vi.fn<(id: string, input: unknown) => Promise<unknown>>(),
  regenerateToken: vi.fn<(id: string) => Promise<{ verifyToken: string }>>(),
  reconnect: vi.fn<(id: string) => Promise<unknown>>(),
  disconnect: vi.fn<(id: string) => Promise<unknown>>(),
  newPairing: vi.fn<(id: string) => Promise<unknown>>(),
  listAgents: vi.fn<() => Promise<unknown>>(),
  switchAgent: vi.fn<(agentId: string, connectionId: string, version: number) => Promise<unknown>>(),
  getConfiguration: vi.fn<(id: string) => Promise<unknown>>(),
  updateConfiguration: vi.fn<(id: string, configuration: unknown, version: number) => Promise<unknown>>(),
  listConversations: vi.fn<(channelId: string) => Promise<unknown>>(),
  agents: { data: [] as Array<Record<string, unknown>>, pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } },
  conversations: [] as Array<Record<string, unknown>>, conversationsError: false,
  writeText: vi.fn<() => Promise<void>>()
}));

vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockImplementation(() =>
  new Promise<string>((resolve) => { window.setTimeout(() => resolve("data:image/png;base64,qr"), 0); })) } }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: { queryKey: unknown[] }) => config.queryKey.includes("diagnostics")
    ? { data: mocks.diagnostics, isPending: false, isError: false, isFetching: false, refetch: vi.fn() }
    : config.queryKey.includes("connections")
    ? { data: mocks.connections, isPending: false, isError: mocks.queryError, refetch: vi.fn() }
    : config.queryKey.includes("agents")
    ? { data: mocks.agents, isPending: false, isError: false, refetch: vi.fn() }
    : config.queryKey.includes("conversations")
    ? { data: mocks.conversations, isPending: false, isError: mocks.conversationsError, isFetching: false, refetch: vi.fn() }
    : { data: mocks.channels, isPending: false, isError: mocks.queryError, refetch: vi.fn() },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useMutation: (config: { mutationFn: (input?: unknown) => Promise<unknown>; onSuccess?: (value: unknown) => void }) => ({
    isPending: false,
    mutateAsync: async (input?: unknown) => {
      const value = await config.mutationFn(input);
      config.onSuccess?.(value);
      return value;
    }
  })
}));
vi.mock("./whatsapp-api", () => ({
  whatsappQueryKey: (workspaceId?: string) => ["workspace", workspaceId, "channel-runtime", "whatsapp"],
  listChannels: vi.fn(),
  listConnections: vi.fn(),
  createWhatsAppChannel: (name: string) => mocks.createChannel(name),
  createWhatsAppConnection: (id: string, input: unknown) => mocks.createConnection(id, input),
  validateWhatsAppConnection: (id: string) => mocks.health(id),
  transitionWhatsAppConnection: (id: string, state: string, version: number) => mocks.transition(id, state, version),
  updateWhatsAppConnection: (id: string, input: unknown) => mocks.updateConnection(id, input),
  regenerateVerifyToken: (id: string) => mocks.regenerateToken(id)
  ,getBaileysDiagnostics: vi.fn(),
  reconnectBaileys: (id: string) => mocks.reconnect(id),
  disconnectBaileys: (id: string) => mocks.disconnect(id),
  newBaileysPairing: (id: string) => mocks.newPairing(id),
  listAgents: () => mocks.listAgents(),
  switchAgentChannel: (agentId: string, connectionId: string, version: number) => mocks.switchAgent(agentId, connectionId, version),
  getChannelConfiguration: (id: string) => mocks.getConfiguration(id),
  updateChannelConfiguration: (id: string, configuration: unknown, version: number) => mocks.updateConfiguration(id, configuration, version),
  listChannelConversations: (channelId: string) => mocks.listConversations(channelId)
}));

const channel = { id: "c1", workspaceId: "w1", name: "WhatsApp Business", state: "ACTIVE", stateVersion: 1, compatibilityVersion: "1.0" };
const connection = { id: "x1", workspaceId: "w1", channelId: "c1", state: "CONNECTED", stateVersion: 2, businessAccountId: "100", phoneNumberId: "200", displayPhoneNumber: "+15550000", apiVersion: "v23.0", webhookPathKey: "safe-path", accessTokenFingerprint: "fingerprint", health: { available: true }, lastHealthCheckAt: "2026-08-09T00:00:00.000Z" };

describe("WhatsApp onboarding page", () => {
  beforeEach(() => {
    mocks.platform.state = "READY";
    mocks.platform.snapshot = { workspace: { id: "w1" } };
    mocks.platform.hasPermission.mockReturnValue(true);
    mocks.channels = { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } };
    mocks.connections = [];
    mocks.diagnostics = undefined;
    mocks.queryError = false;
    mocks.invalidate.mockReset().mockResolvedValue(undefined);
    mocks.createChannel.mockReset().mockResolvedValue(channel);
    mocks.createConnection.mockReset().mockResolvedValue(connection);
    mocks.health.mockReset().mockResolvedValue(connection);
    mocks.transition.mockReset().mockResolvedValue(connection);
    mocks.updateConnection.mockReset().mockResolvedValue(connection);
    mocks.regenerateToken.mockReset().mockResolvedValue({ verifyToken: "new-token-123" });
    mocks.reconnect.mockReset().mockResolvedValue({});
    mocks.disconnect.mockReset().mockResolvedValue({});
    mocks.newPairing.mockReset().mockResolvedValue({});
    mocks.agents = { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } };
    mocks.conversations = [];
    mocks.conversationsError = false;
    mocks.listAgents.mockReset().mockResolvedValue(mocks.agents);
    mocks.switchAgent.mockReset().mockResolvedValue({ connectionId: "x1", channelId: "c1", agentId: "a1", newStateVersion: 3, newRevision: 1 });
    mocks.getConfiguration.mockReset().mockResolvedValue([
      { id: "cfg1", connectionId: "x1", revision: 1, configuration: { agentExecution: { agentRuntimeSnapshotId: "snap-1" } }, hash: "h", checksum: "c", createdById: "u1", createdAt: "2026-08-09T00:00:00.000Z" }
    ]);
    mocks.updateConfiguration.mockReset().mockResolvedValue({ id: "cfg2", connectionId: "x1", revision: 2, configuration: {}, hash: "h", checksum: "c", createdById: "u1", createdAt: "2026-08-09T00:00:00.000Z" });
    mocks.listConversations.mockReset().mockResolvedValue(mocks.conversations);
    mocks.writeText.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: mocks.writeText } });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("shows a disconnected empty state and creates the real channel", async () => {
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("No WhatsApp channel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create channel" }));
    await waitFor(() => expect(mocks.createChannel).toHaveBeenCalledWith("WhatsApp Business"));
  });

  it("submits write-only Meta configuration without rendering it", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    render(<WhatsAppOnboardingPage />);
    fireEvent.change(screen.getByLabelText("Business account ID"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Phone number ID"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Access token"), { target: { value: "private-access" } });
    fireEvent.change(screen.getByLabelText("Webhook verify token"), { target: { value: "private-verify" } });
    fireEvent.change(screen.getByLabelText("Meta app secret"), { target: { value: "private-app" } });
    fireEvent.click(screen.getByRole("button", { name: "Save WhatsApp connection" }));
    await waitFor(() => expect(mocks.createConnection).toHaveBeenCalledWith("c1", expect.objectContaining({ accessToken: "private-access", verifyToken: "private-verify", appSecret: "private-app" })));
    expect(screen.queryByText("private-access")).not.toBeInTheDocument();
  });

  it("renders safe connected state and validates it", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    expect(screen.getByText(/webhooks\/whatsapp\/safe-path/)).toBeInTheDocument();
    expect(screen.getByText("Encrypted and configured")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Validate connection" }));
    await waitFor(() => expect(mocks.health).toHaveBeenCalledWith("x1"));
  });

  it("renders a real Baileys QR onboarding state instead of a database connected badge", async () => {
    const baileysChannel = { ...channel, name: "Baileys E2E", provider: { name: "baileys" } };
    const baileysConnection = { ...connection, state: "CONNECTED", displayPhoneNumber: "Baileys QR pairing",
      health: { state: "RECONNECTING", qrRequired: true, qr: "real-baileys-qr" } };
    mocks.channels = { ...mocks.channels, data: [baileysChannel] };
    mocks.connections = [baileysConnection];
    render(<WhatsAppOnboardingPage />);
    expect((await screen.findAllByText("Waiting for scan")).length).toBeGreaterThan(0);
    expect(screen.getByAltText("WhatsApp pairing QR code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh QR" })).toBeInTheDocument();
  });

  it("renders live diagnostics and uses the explicit Baileys disconnect control", async () => {
    const baileysChannel = { ...channel, name: "Baileys E2E", provider: { name: "baileys" } };
    const baileysConnection = { ...connection, health: { state: "CONNECTED", qrRequired: false } };
    mocks.channels = { ...mocks.channels, data: [baileysChannel] };
    mocks.connections = [baileysConnection];
    mocks.diagnostics = { state: "CONNECTED", qrRequired: false, socketPresent: true, sessionPresent: true,
      reconnectAttempts: 0, recentEvents: [{ at: "2026-08-11T19:00:00.000Z", stage: "SOCKET", detail: "Connected" }] };
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledWith("x1"));
  });

  it("opens edit form and updates connection", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit connection" }));
    expect(screen.getByText("Edit Connection")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Business account ID"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updateConnection).toHaveBeenCalledWith("x1", expect.objectContaining({ businessAccountId: "999", expectedStateVersion: 2 })));
  });

  it("regenerates verify token and displays it once", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate verify token" }));
    await waitFor(() => expect(mocks.regenerateToken).toHaveBeenCalledWith("x1"));
    expect(screen.getByText("new-token-123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("new-token-123")).not.toBeInTheDocument();
  });

  it("copies callback URL to clipboard", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    const copyBtn = screen.getByRole("button", { name: "Copy" });
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith(expect.stringContaining("/api/v1/channel-runtime/webhooks/whatsapp/safe-path")));
  });

  it("disconnects via state transition", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith("x1", "DISCONNECTED", 2));
  });

  it("enforces backend permission metadata in the UI", () => {
    mocks.platform.hasPermission.mockImplementation((permission) => permission !== "whatsapp.connection.read");
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("shows backend loading failure recovery", () => {
    mocks.queryError = true;
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("WhatsApp unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders channel and connection state badges", () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
  });

  it("maps each connection state to its badge variant", () => {
    const renderState = (state: string) => {
      mocks.channels = { ...mocks.channels, data: [channel] };
      mocks.connections = [{ ...connection, state }];
      const view = render(<WhatsAppOnboardingPage />);
      return view;
    };
    const connected = renderState("CONNECTED");
    expect(connected.getByText("CONNECTED").className).toContain("bg-[var(--color-primary)]");
    connected.unmount();
    const failed = renderState("FAILED");
    expect(failed.getByText("FAILED").className).toContain("bg-[var(--color-destructive)]");
    failed.unmount();
    const connecting = renderState("CONNECTING");
    expect(connecting.getByText("CONNECTING").className).toContain("text-[var(--color-foreground)]");
    connecting.unmount();
    const degraded = renderState("DEGRADED");
    expect(degraded.getByText("DEGRADED").className).toContain("text-[var(--color-foreground)]");
    degraded.unmount();
    const disconnected = renderState("DISCONNECTED");
    expect(disconnected.getByText("DISCONNECTED").className).toContain("bg-[var(--color-secondary)]");
    disconnected.unmount();
  });

  it("offers the state-machine action matrix per connection state", () => {
    const renderState = (state: string) => {
      mocks.channels = { ...mocks.channels, data: [channel] };
      mocks.connections = [{ ...connection, state }];
      return render(<WhatsAppOnboardingPage />);
    };
    const disconnected = renderState("DISCONNECTED");
    expect(disconnected.getByRole("button", { name: "Start connection" })).toBeInTheDocument();
    expect(disconnected.queryByRole("button", { name: "Reconnect" })).not.toBeInTheDocument();
    expect(disconnected.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
    disconnected.unmount();
    const failed = renderState("FAILED");
    expect(failed.getByRole("button", { name: "Start connection" })).toBeInTheDocument();
    expect(failed.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    failed.unmount();
    const connecting = renderState("CONNECTING");
    expect(connecting.queryByRole("button", { name: "Start connection" })).not.toBeInTheDocument();
    expect(connecting.queryByRole("button", { name: "Reconnect" })).not.toBeInTheDocument();
    expect(connecting.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    connecting.unmount();
    const degraded = renderState("DEGRADED");
    expect(degraded.queryByRole("button", { name: "Start connection" })).not.toBeInTheDocument();
    expect(degraded.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(degraded.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    degraded.unmount();
  });

  it("starts a connection from DISCONNECTED with an explicit CONNECTING transition", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [{ ...connection, state: "DISCONNECTED" }];
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start connection" }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith("x1", "CONNECTING", 2));
  });

  it("loads channel conversations on demand through the channel-runtime contract", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.conversations = [{ id: "conv-1", workspaceId: "w1", channelId: "c1", externalConversationId: "wa:123",
      conversationRuntimeId: "rt-1", metadata: {}, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z" }];
    render(<WhatsAppOnboardingPage />);
    expect(screen.queryByText("wa:123")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load conversations" }));
    expect(await screen.findByText("wa:123")).toBeInTheDocument();
  });

  it("shows the empty conversation state when nothing arrived yet", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load conversations" }));
    expect(await screen.findByText("No conversations received yet.")).toBeInTheDocument();
  });

  it("shows a conversation loading failure", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.conversationsError = true;
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load conversations" }));
    expect(await screen.findByText("The channel conversations could not be loaded.")).toBeInTheDocument();
  });

  it("shows the current agent binding from activeChannels", () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.agents = { data: [{ id: "a1", name: "Support Agent", status: "PUBLISHED",
      activeChannels: [{ connectionId: "x1", channelId: "c1", stateVersion: 2 }] }], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("Responix binding")).toBeInTheDocument();
    expect(screen.getByText("Support Agent")).toBeInTheDocument();
  });

  it("binds a published agent through the agent-studio switch endpoint", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.agents = { data: [{ id: "a1", name: "Support Agent", status: "PUBLISHED", activeChannels: [] },
      { id: "a2", name: "Sales Agent", status: "PUBLISHED", activeChannels: [] }], pagination: { page: 1, limit: 25, total: 2, totalPages: 1 } };
    render(<WhatsAppOnboardingPage />);
    fireEvent.change(screen.getByLabelText("Responix agent to bind"), { target: { value: "a2" } });
    fireEvent.click(screen.getByRole("button", { name: "Bind agent" }));
    await waitFor(() => expect(mocks.switchAgent).toHaveBeenCalledWith("a2", "x1", 2));
    expect(await screen.findByText(/Agent bound to this connection/)).toBeInTheDocument();
  });

  it("shows a binding failure when the agent cannot be switched", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.agents = { data: [{ id: "a2", name: "Sales Agent", status: "PUBLISHED", activeChannels: [] }], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    mocks.switchAgent.mockRejectedValue(new Error("Agent is not runtime ready"));
    render(<WhatsAppOnboardingPage />);
    fireEvent.change(screen.getByLabelText("Responix agent to bind"), { target: { value: "a2" } });
    fireEvent.click(screen.getByRole("button", { name: "Bind agent" }));
    expect(await screen.findByText("The agent could not be bound.")).toBeInTheDocument();
  });

  it("unbinds by replacing the configuration without agentExecution", async () => {
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.agents = { data: [{ id: "a1", name: "Support Agent", status: "PUBLISHED",
      activeChannels: [{ connectionId: "x1", channelId: "c1", stateVersion: 2 }] }], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    render(<WhatsAppOnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Unbind agent" }));
    await waitFor(() => expect(mocks.getConfiguration).toHaveBeenCalledWith("x1"));
    await waitFor(() => expect(mocks.updateConfiguration).toHaveBeenCalledWith("x1", {}, 2));
    expect(await screen.findByText("Agent unbound from this connection.")).toBeInTheDocument();
  });

  it("hides the binding section without the agent studio read permission", () => {
    mocks.platform.hasPermission.mockImplementation((permission) => permission === "whatsapp.connection.read" || permission === "channel.runtime.read");
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    render(<WhatsAppOnboardingPage />);
    expect(screen.queryByText("Responix binding")).not.toBeInTheDocument();
  });

  it("shows binding read-only when the agent studio write permission is missing", () => {
    mocks.platform.hasPermission.mockImplementation((permission) => permission !== "agent.studio.write");
    mocks.channels = { ...mocks.channels, data: [channel] };
    mocks.connections = [connection];
    mocks.agents = { data: [{ id: "a1", name: "Support Agent", status: "PUBLISHED",
      activeChannels: [{ connectionId: "x1", channelId: "c1", stateVersion: 2 }] }], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    render(<WhatsAppOnboardingPage />);
    expect(screen.getByText("Support Agent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bind agent" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unbind agent" })).toBeInTheDocument();
  });
});
