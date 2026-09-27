import { ChannelRuntimeController } from "./channel-runtime.controller";

describe("ChannelRuntimeController", () => {
  const service = { createChannel: jest.fn(), createConnection: jest.fn(), send: jest.fn(), upload: jest.fn(),
    listChannels: jest.fn(), getChannel: jest.fn(), listConnections: jest.fn(), health: jest.fn(), configurations: jest.fn(), updateConnection: jest.fn(),
    verifyWebhook: jest.fn(), webhook: jest.fn(), transition: jest.fn(), listMessages: jest.fn(), getMessage: jest.fn(),
    attachments: jest.fn(), attachment: jest.fn(), conversations: jest.fn(), diagnostics: jest.fn(), metrics: jest.fn(),
    connectionDiagnostics: jest.fn(), reconnectProvider: jest.fn(), disconnectProvider: jest.fn(), newProviderPairing: jest.fn() };
  const controller = new ChannelRuntimeController(service as never);
  const request = { tenantContext: { workspace: { id: "workspace" }, user: { id: "actor" } } } as never;
  it("delegates workspace-scoped channel and message operations", async () => {
    await Promise.resolve(controller.create(request, { name: "Support" }));
    await Promise.resolve(controller.send(request, "channel", { connectionId: crypto.randomUUID(), recipient: "1555", type: "TEXT", text: "hi", idempotencyKey: "key" }));
    expect(service.createChannel).toHaveBeenCalledWith("workspace", "actor", { name: "Support" });
    expect(service.send).toHaveBeenCalledWith("workspace", "actor", "channel", expect.objectContaining({ text: "hi" }));
  });
  it("publishes exact permission metadata", () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.create)).toEqual(["channel.runtime.write"]);
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.connection)).toEqual(["whatsapp.connection.write"]);
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.health)).toEqual(["whatsapp.connection.admin"]);
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.connectionDiagnostics)).toEqual(["whatsapp.connection.read"]);
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.disconnect)).toEqual(["whatsapp.connection.admin"]);
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.messages)).toEqual(["channel.runtime.read"]);
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.updateConnection)).toEqual(["whatsapp.connection.write"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
  it("delegates Baileys diagnostics and explicit session controls", async () => {
    await Promise.resolve(controller.connectionDiagnostics(request, "connection-1"));
    await Promise.resolve(controller.reconnect(request, "connection-1"));
    await Promise.resolve(controller.disconnect(request, "connection-1"));
    expect(service.connectionDiagnostics).toHaveBeenCalledWith("workspace", "connection-1");
    expect(service.reconnectProvider).toHaveBeenCalledWith("workspace", "connection-1");
    expect(service.disconnectProvider).toHaveBeenCalledWith("workspace", "connection-1");
  });
  it("returns webhook verification challenge through the public service boundary", async () => {
    service.verifyWebhook.mockResolvedValue("challenge");
    await expect(controller.verify("path", "subscribe", "token", "challenge"))
      .resolves.toBe("challenge");
  });
  it("delegates connection update requests to the service", async () => {
    await Promise.resolve(controller.updateConnection(request, "connection-1", { businessAccountId: "1", expectedStateVersion: 2 }));
    expect(service.updateConnection).toHaveBeenCalledWith("workspace", "actor", "connection-1", expect.objectContaining({ businessAccountId: "1", expectedStateVersion: 2 }));
  });
});
