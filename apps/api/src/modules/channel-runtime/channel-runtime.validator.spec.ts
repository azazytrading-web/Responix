import { ChannelRuntimeValidator } from "./channel-runtime.validator";

describe("ChannelRuntimeValidator", () => {
  const validator = new ChannelRuntimeValidator();
  it("validates secure Meta configuration", () => expect(() => validator.connection({ businessAccountId: "1", phoneNumberId: "2",
    displayPhoneNumber: "+15551234567", apiVersion: "v23.0", accessToken: "a".repeat(20), verifyToken: "v".repeat(16), appSecret: "s".repeat(16) })).not.toThrow());
  it("rejects malformed versions, phone numbers, and weak credentials", () => expect(() => validator.connection({ businessAccountId: "1", phoneNumberId: "2",
    displayPhoneNumber: "555", apiVersion: "latest", accessToken: "short", verifyToken: "short", appSecret: "short" })).toThrow());
  it("excludes empty text and validates binary attachment integrity", () => {
    expect(() => validator.message({ connectionId: crypto.randomUUID(), recipient: "1", type: "TEXT", idempotencyKey: "key" })).toThrow();
    expect(() => validator.attachment({ channelId: crypto.randomUUID(), mimeType: "image/png", sizeBytes: 3, dataBase64: Buffer.from("abc").toString("base64") })).not.toThrow();
    expect(() => validator.attachment({ channelId: crypto.randomUUID(), mimeType: "image/png", sizeBytes: 4, dataBase64: Buffer.from("abc").toString("base64") })).toThrow();
  });
  it("prevents credential material from entering immutable public configuration", () => {
    expect(() => validator.configuration({ agentExecution: { taskType: "channel" } })).not.toThrow();
    expect(() => validator.configuration({ provider: { accessToken: "secret" } })).toThrow("Secrets are prohibited");
  });
});
