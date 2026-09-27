import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { MetaWhatsappCloudAdapter } from "./adapters/meta-whatsapp-cloud.adapter";
import { ChannelCredentialService } from "./channel-credential.service";
import { ChannelRuntimeService } from "./channel-runtime.service";
import { ProviderCredentialCryptoService } from "../ai/security/provider-credential-crypto.service";

type MockTx = Record<string, unknown>;
type MockPrisma = {
  channelConnection: { findFirst: jest.Mock };
  channelCredentialReference: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
  auditLog: { create: jest.Mock };
};

/**
 * Focused integration test for WhatsApp webhook verification token flow.
 * This test verifies that a verify token survives the full lifecycle:
 * generate -> encrypt -> store -> retrieve -> decrypt -> compare
 */
describe("WhatsApp Webhook Verification Token Flow", () => {
  const encryptionKey = Buffer.from("a".repeat(32)).toString("base64");
  const configService = { getOrThrow: (key: string) => {
    if (key === "ai.credentialEncryptionKey") return encryptionKey;
    throw new Error(`Unknown config key: ${key}`);
  } } as unknown as ConfigService;
  const crypto = new ProviderCredentialCryptoService(configService);
  const adapter = new MetaWhatsappCloudAdapter();

  it("round-trips a verify token through encryption and decryption", () => {
    const original = "my-verify-token-123456";
    const encrypted = crypto.encrypt(original);
    const decrypted = crypto.decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("verifies webhook with correct token through adapter boundary", async () => {
    const verifyToken = "correct-token-12345678";
    const mockAccessor = {
      get: (name: string) => {
        if (name === "verifyToken") return verifyToken;
        if (name === "accessToken") return "access-token";
        if (name === "appSecret") return "app-secret";
        return "";
      },
      has: () => true,
      fingerprint: () => "fp",
      names: () => ["verifyToken", "accessToken", "appSecret"]
    };

    const connection = {
      id: "conn-id", workspaceId: "ws-id", channelId: "ch-id", providerKey: "whatsapp",
      configuration: { businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0" },
      credentials: mockAccessor,
      transport: { request: jest.fn() }
    };

    const result = await adapter.verifyWebhook(connection, { mode: "subscribe", token: verifyToken, challenge: "123456" });
    expect(result.valid).toBe(true);
    expect(result.challenge).toBe("123456");
  });

  it("rejects webhook with incorrect token through adapter boundary", async () => {
    const verifyToken = "correct-token-12345678";
    const mockAccessor = {
      get: (name: string) => {
        if (name === "verifyToken") return verifyToken;
        return "";
      },
      has: (name: string) => name === "verifyToken",
      fingerprint: () => "fp",
      names: () => ["verifyToken"]
    };

    const connection = {
      id: "conn-id", workspaceId: "ws-id", channelId: "ch-id", providerKey: "whatsapp",
      configuration: { businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0" },
      credentials: mockAccessor,
      transport: { request: jest.fn() }
    };

    const result = await adapter.verifyWebhook(connection, { mode: "subscribe", token: "wrong-token", challenge: "123456" });
    expect(result.valid).toBe(false);
  });

  it("verifies webhook through service layer with real credential resolution", async () => {
    const verifyToken = "service-test-token-1234";
    const encrypted = crypto.encrypt(verifyToken);

    const mockPrisma: MockPrisma = {
      channelConnection: {
        findFirst: jest.fn().mockResolvedValue({
          id: "conn-1",
          workspaceId: "ws-1",
          credentialReferences: [
            { id: "ref-1", connectionId: "conn-1", name: "verifyToken", version: 1, encryptedSecret: encrypted, fingerprint: crypto.fingerprint(verifyToken), revokedAt: null, expiresAt: null }
          ]
        })
      },
      channelCredentialReference: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((fn: (tx: MockTx) => Promise<unknown>) => fn(mockPrisma as unknown as MockTx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };

    const credentialService = new ChannelCredentialService(mockPrisma as never, crypto);
    const repository = {
      connectionContextByWebhook: jest.fn().mockResolvedValue({
        id: "conn-1", workspaceId: "ws-1", channelId: "ch-1", businessAccountId: "1", phoneNumberId: "2", displayPhoneNumber: "+15551234567", apiVersion: "v23.0",
        channel: { provider: { name: "whatsapp" } }
      })
    };
    const registry = {
      resolve: jest.fn().mockReturnValue(adapter),
      installed: jest.fn()
    };
    const transport = { request: jest.fn() };

    const service = new ChannelRuntimeService(
      repository as never,
      { connection: jest.fn(), message: jest.fn(), attachment: jest.fn(), configuration: jest.fn() },
      registry as never,
      credentialService,
      transport as never,
      { retryable: jest.fn(), delay: jest.fn() } as never,
      { assert: jest.fn() } as never,
      { prepare: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { latestSnapshots: jest.fn() } as never,
      { execute: jest.fn() } as never
    );

    // Valid token should return challenge
    await expect(service.verifyWebhook("path-key-1", "subscribe", verifyToken, "123456"))
      .resolves.toBe("123456");

    // Invalid token should throw
    await expect(service.verifyWebhook("path-key-1", "subscribe", "wrong-token", "123456"))
      .rejects.toThrow(UnauthorizedException);
  });

  it("confirms regenerate returns same secret that verifyWebhook accepts", async () => {
    const mockPrisma: MockPrisma = {
      channelConnection: {
        findFirst: jest.fn().mockResolvedValue({ id: "conn-1", workspaceId: "ws-1" })
      },
      channelCredentialReference: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation((args: { data: { encryptedSecret: string; fingerprint: string; name: string; version: number } }) =>
          Promise.resolve({ id: "ref-new", ...args.data })
        )
      },
      $transaction: jest.fn((fn: (tx: MockTx) => Promise<unknown>) => fn(mockPrisma as unknown as MockTx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };

    const credentialService = new ChannelCredentialService(mockPrisma as never, crypto);
    const result = await credentialService.regenerate("ws-1", "user-1", "conn-1", "verifyToken");

    // The returned secret must be verifiable
    const encrypted = crypto.encrypt(result.secret);
    mockPrisma.channelConnection.findFirst = jest.fn().mockResolvedValue({
      id: "conn-1", workspaceId: "ws-1",
      credentialReferences: [
        { id: "ref-new", connectionId: "conn-1", name: "verifyToken", version: 1, encryptedSecret: encrypted, fingerprint: crypto.fingerprint(result.secret), revokedAt: null, expiresAt: null }
      ]
    });

    const resolved = await credentialService.resolve("ws-1", "conn-1");
    expect(resolved.get("verifyToken")).toBe(result.secret);

    // Verify through adapter
    const mockAccessor = {
      get: (name: string) => resolved.get(name),
      has: (name: string) => resolved.has(name),
      fingerprint: (name: string) => resolved.fingerprint(name),
      names: () => resolved.names()
    };
    const connection = {
      id: "conn-1", workspaceId: "ws-1", channelId: "ch-1", providerKey: "whatsapp",
      configuration: { businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0" },
      credentials: mockAccessor, transport: { request: jest.fn() }
    };
    const verifyResult = await adapter.verifyWebhook(connection, { mode: "subscribe", token: result.secret, challenge: "challenge-123" });
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.challenge).toBe("challenge-123");
  });

  it("invalidates previous token after regeneration", async () => {
    const oldToken = "old-token-12345678";

    const mockPrisma: MockPrisma = {
      channelConnection: {
        findFirst: jest.fn().mockResolvedValue({ id: "conn-1", workspaceId: "ws-1" })
      },
      channelCredentialReference: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ref-old", connectionId: "conn-1", name: "verifyToken", version: 1,
          encryptedSecret: crypto.encrypt(oldToken), fingerprint: crypto.fingerprint(oldToken),
          revokedAt: null, expiresAt: null
        }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation((args: { data: { encryptedSecret: string; fingerprint: string; name: string; version: number } }) =>
          Promise.resolve({ id: "ref-new", ...args.data })
        )
      },
      $transaction: jest.fn((fn: (tx: MockTx) => Promise<unknown>) => fn(mockPrisma as unknown as MockTx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };

    const credentialService = new ChannelCredentialService(mockPrisma as never, crypto);
    const regenerateResult = await credentialService.regenerate("ws-1", "user-1", "conn-1", "verifyToken");

    // Simulate resolve finding old (revoked) and new (active) credentials
    mockPrisma.channelConnection.findFirst = jest.fn().mockResolvedValue({
      id: "conn-1", workspaceId: "ws-1",
      credentialReferences: [
        { id: "ref-old", connectionId: "conn-1", name: "verifyToken", version: 1, encryptedSecret: crypto.encrypt(oldToken), fingerprint: crypto.fingerprint(oldToken), revokedAt: new Date(), expiresAt: null },
        { id: "ref-new", connectionId: "conn-1", name: "verifyToken", version: 2, encryptedSecret: crypto.encrypt(regenerateResult.secret), fingerprint: crypto.fingerprint(regenerateResult.secret), revokedAt: null, expiresAt: null }
      ]
    });

    const resolved = await credentialService.resolve("ws-1", "conn-1");
    expect(resolved.get("verifyToken")).toBe(regenerateResult.secret);

    // Old token must fail verification
    const mockAccessor = {
      get: (name: string) => resolved.get(name),
      has: (name: string) => resolved.has(name),
      fingerprint: (name: string) => resolved.fingerprint(name),
      names: () => resolved.names()
    };
    const connection = {
      id: "conn-1", workspaceId: "ws-1", channelId: "ch-1", providerKey: "whatsapp",
      configuration: { businessAccountId: "1", phoneNumberId: "2", apiVersion: "v23.0" },
      credentials: mockAccessor, transport: { request: jest.fn() }
    };
    const oldResult = await adapter.verifyWebhook(connection, { mode: "subscribe", token: oldToken, challenge: "challenge" });
    expect(oldResult.valid).toBe(false);

    // New token must succeed
    const newResult = await adapter.verifyWebhook(connection, { mode: "subscribe", token: regenerateResult.secret, challenge: "challenge" });
    expect(newResult.valid).toBe(true);
  });
});
