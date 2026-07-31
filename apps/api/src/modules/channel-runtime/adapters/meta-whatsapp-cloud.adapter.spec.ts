import { createHmac } from "node:crypto";
import { MetaWhatsappCloudAdapter } from "./meta-whatsapp-cloud.adapter";

describe("MetaWhatsappCloudAdapter", () => {
  const http = { request: jest.fn() };
  const adapter = new MetaWhatsappCloudAdapter();
  const connection = { id: "connection", workspaceId: "workspace", channelId: "channel", providerKey: "whatsapp",
    configuration: { businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0" }, transport: http,
    credentials: { get: (name: string) => ({ accessToken: "access-token-that-is-long-enough", appSecret: "app-secret-123456",
      verifyToken: "verify-token-123456" })[name] ?? "", has: () => true, fingerprint: () => "fingerprint", names: () => ["accessToken", "appSecret", "verifyToken"] } };
  it("verifies genuine signatures and rejects malformed signatures", async () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac("sha256", "app-secret-123456").update(body).digest("hex")}`;
    await expect(adapter.verifySignature(connection, body, signature)).resolves.toBe(true);
    await expect(adapter.verifySignature(connection, body, "sha256=bad")).resolves.toBe(false);
  });
  it.each([
    ["text", "TEXT"], ["image", "IMAGE"], ["video", "VIDEO"], ["audio", "AUDIO"],
    ["document", "DOCUMENT"], ["sticker", "STICKER"], ["location", "LOCATION"],
    ["contacts", "CONTACT"], ["reaction", "REACTION"], ["button", "BUTTON"], ["interactive", "INTERACTIVE"]
  ])("normalizes incoming %s messages", (type, expected) => {
    const payload = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "10" }, messages: [{
      id: `id-${type}`, from: "15551234567", timestamp: "1785528000", type,
      [type]: type === "text" ? { body: "hello" } : { id: "media", mime_type: "image/jpeg" }
    }] } }] }] };
    expect(adapter.normalizeIncoming(payload)[0]).toMatchObject({ type: expected, externalUserId: "15551234567" });
  });
  it("keeps dynamic recipient data outside provider configuration and creates provider payloads", () => {
    expect(adapter.normalizeOutgoing({ externalUserId: "15551234567", externalConversationId: "15551234567",
      direction: "OUTGOING", type: "TEXT", text: "answer", timestamp: new Date(), attachments: [], content: {}, metadata: {} }))
      .toEqual(expect.objectContaining({ messaging_product: "whatsapp", to: "15551234567", type: "text", text: { body: "answer", preview_url: false } }));
  });
  it("normalizes voice, forwarded, quoted reply, and list semantics", () => {
    const payload = (message: Record<string, unknown>) => ({ entry: [{ changes: [{ value: { messages: [{
      id: "id", from: "1555", timestamp: "1785528000", ...message }] } }] }] });
    expect(adapter.normalizeIncoming(payload({ type: "audio", audio: { id: "media", voice: true } }))[0]?.type).toBe("VOICE");
    expect(adapter.normalizeIncoming(payload({ type: "text", text: { body: "f" }, context: { forwarded: true } }))[0]?.type).toBe("FORWARD");
    expect(adapter.normalizeIncoming(payload({ type: "text", text: { body: "r" }, context: { id: "quoted" } }))[0]?.type).toBe("REPLY");
    expect(adapter.normalizeIncoming(payload({ type: "interactive", interactive: { type: "list_reply" } }))[0]?.type).toBe("LIST");
  });
  it("uses the secure shared HTTP client for health and send", async () => {
    http.request.mockResolvedValueOnce({ status: 200, body: '{"id":"phone"}' })
      .mockResolvedValueOnce({ status: 200, body: '{"messages":[{"id":"wamid.1"}]}' });
    await expect(adapter.health(connection, new AbortController().signal)).resolves.toMatchObject({ id: "phone" });
    await expect(adapter.send(connection, { type: "text" }, new AbortController().signal)).resolves.toMatchObject({ providerMessageId: "wamid.1" });
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ label: "Meta WhatsApp Cloud" }));
  });
  it("uploads multipart media and verifies downloaded bytes", async () => {
    http.request.mockResolvedValueOnce({ status: 200, body: '{"id":"media-id"}' })
      .mockResolvedValueOnce({ status: 200, body: '{"url":"https://lookaside.fbsbx.com/media","mime_type":"image/png"}' })
      .mockResolvedValueOnce({ status: 200, body: Buffer.from("image-bytes").toString("base64"), encoding: "base64" });
    await expect(adapter.uploadMedia(connection, { content: Buffer.from("image-bytes"), mimeType: "image/png", fileName: "photo.png" },
      new AbortController().signal)).resolves.toEqual({ providerMediaId: "media-id" });
    const downloaded = await adapter.downloadMedia(connection, "media-id", new AbortController().signal);
    expect(downloaded.content).toEqual(Buffer.from("image-bytes"));
    expect(downloaded.mimeType).toBe("image/png");
    expect(downloaded.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
