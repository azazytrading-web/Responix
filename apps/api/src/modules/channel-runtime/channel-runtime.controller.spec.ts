import { ChannelRuntimeController } from "./channel-runtime.controller";

describe("ChannelRuntimeController", () => {
  const service = { createChannel: jest.fn(), createConnection: jest.fn(), send: jest.fn(), upload: jest.fn(),
    listChannels: jest.fn(), getChannel: jest.fn(), listConnections: jest.fn(), health: jest.fn(), configurations: jest.fn(),
    verifyWebhook: jest.fn(), webhook: jest.fn(), transition: jest.fn(), listMessages: jest.fn(), getMessage: jest.fn(),
    attachments: jest.fn(), attachment: jest.fn(), conversations: jest.fn(), diagnostics: jest.fn(), metrics: jest.fn() };
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
    expect(Reflect.getMetadata("permissions", ChannelRuntimeController.prototype.messages)).toEqual(["channel.runtime.read"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
  it("returns webhook verification challenge through the public service boundary", async () => {
    service.verifyWebhook.mockResolvedValue("challenge");
    await expect(controller.verify("path", { "hub.mode": "subscribe", "hub.verify_token": "token", "hub.challenge": "challenge" }))
      .resolves.toBe("challenge");
  });
});
