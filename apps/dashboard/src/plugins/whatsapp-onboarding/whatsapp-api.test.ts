import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWhatsAppChannel, createWhatsAppConnection, getChannelConfiguration, getWhatsAppConnection, listChannels, listConnections,
  listChannelConversations, disconnectBaileys, getBaileysDiagnostics, newBaileysPairing, reconnectBaileys,
  regenerateVerifyToken, transitionWhatsAppConnection, updateChannelConfiguration, updateWhatsAppConnection, validateWhatsAppConnection, whatsappQueryKey,
  listAgents, switchAgentChannel
} from "./whatsapp-api";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@responix/api-client", () => ({ apiClient: api }));

describe("WhatsApp API", () => {
  beforeEach(() => Object.values(api).forEach((mock) => mock.mockReset().mockResolvedValue({})));

  it("uses the existing Channel Runtime contracts", async () => {
    await listChannels();
    await createWhatsAppChannel("WhatsApp Business");
    await listConnections("channel-1");
    await createWhatsAppConnection("channel-1", { businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0", accessToken: "write-only", verifyToken: "write-only", appSecret: "write-only" });
    await validateWhatsAppConnection("connection-1");
    await transitionWhatsAppConnection("connection-1", "DISCONNECTED", 2);
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/channels", expect.objectContaining({ credentials: "include" }));
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/channels", expect.objectContaining({ providerKey: "whatsapp" }), { credentials: "include" });
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/channels/channel-1/connections", { credentials: "include" });
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/channels/channel-1/connections", expect.objectContaining({ accessToken: "write-only" }), { credentials: "include" });
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/health", {}, { credentials: "include" });
    expect(api.patch).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/state", { state: "DISCONNECTED", expectedStateVersion: 2 }, { credentials: "include" });
  });

  it("reads, updates, and regenerates a connection", async () => {
    await getWhatsAppConnection("connection-1");
    await updateWhatsAppConnection("connection-1", { businessAccountId: "1", expectedStateVersion: 2 });
    await regenerateVerifyToken("connection-1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1", { credentials: "include" });
    expect(api.patch).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1", { businessAccountId: "1", expectedStateVersion: 2 }, { credentials: "include" });
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/verify-token/regenerate", {}, { credentials: "include" });
  });

  it("isolates cached state by workspace", () => {
    expect(whatsappQueryKey("workspace-1")).toEqual(["workspace", "workspace-1", "channel-runtime", "whatsapp"]);
  });

  it("uses the explicit Baileys diagnostics and session-control endpoints", async () => {
    await getBaileysDiagnostics("connection-1");
    await reconnectBaileys("connection-1");
    await disconnectBaileys("connection-1");
    await newBaileysPairing("connection-1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/diagnostics", { credentials: "include" });
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/reconnect", {}, { credentials: "include" });
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/disconnect", {}, { credentials: "include" });
    expect(api.post).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/new-pairing", {}, { credentials: "include" });
  });

  it("lists channel conversations through the channel-runtime contract", async () => {
    await listChannelConversations("channel-1");
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/conversations", expect.objectContaining({ query: { channelId: "channel-1" }, credentials: "include" }));
  });

  it("reads configuration revisions and replaces the configuration with full-replace semantics", async () => {
    await getChannelConfiguration("connection-1");
    await updateChannelConfiguration("connection-1", { agentExecution: { agentRuntimeSnapshotId: "snap-1" } }, 2);
    expect(api.get).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/configurations", { credentials: "include" });
    expect(api.patch).toHaveBeenCalledWith("/api/v1/channel-runtime/connections/connection-1/configuration", { configuration: { agentExecution: { agentRuntimeSnapshotId: "snap-1" } }, expectedStateVersion: 2 }, { credentials: "include" });
  });

  it("re-exports the agent-studio binding contracts", async () => {
    await listAgents(1, undefined, "PUBLISHED");
    await switchAgentChannel("agent-1", "connection-1", 2);
    expect(api.get).toHaveBeenCalledWith("/api/v1/agent-studio/agents", expect.objectContaining({ query: { page: 1, limit: 25, status: "PUBLISHED" } }));
    expect(api.post).toHaveBeenCalledWith("/api/v1/agent-studio/agents/agent-1/channels/connection-1/switch", { expectedStateVersion: 2 }, { credentials: "include" });
  });
});
