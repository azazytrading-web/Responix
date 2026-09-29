/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CustomProviderValidationRepository } from "./custom-provider-validation.repository";

describe("CustomProviderValidationRepository", () => {
  it("persists one safe explicit validation record and a matching audit event atomically", async () => {
    const checkedAt = new Date("2026-09-29T00:00:00.000Z");
    const createRecord = jest.fn().mockResolvedValue({ checkedAt });
    const createAudit = jest.fn().mockResolvedValue({});
    const tx = {
      customAiProviderValidationRecord: { create: createRecord },
      auditLog: { create: createAudit }
    };
    const prisma = { $transaction: jest.fn((callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    const repository = new CustomProviderValidationRepository(prisma as never);

    await expect(repository.record({
      workspaceId: "workspace-a", actorId: "actor-a", customProviderId: "provider-a",
      protocolId: "openai-chat-completions-v1", available: false, latencyMs: 29,
      errorCode: "AUTHENTICATION_FAILED", providerStatus: 401
    })).resolves.toEqual({ checkedAt });

    expect(createRecord).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-a", customProviderId: "provider-a", protocolId: "openai-chat-completions-v1",
        available: false, latencyMs: 29, errorCode: "AUTHENTICATION_FAILED", providerStatus: 401
      }, select: { checkedAt: true }
    });
    expect(createAudit).toHaveBeenCalledWith({ data: expect.objectContaining({
      workspaceId: "workspace-a", userId: "actor-a", action: "ai.custom-provider.validated",
      entityType: "CustomAiProvider", entityId: "provider-a",
      newValues: {
        protocolId: "openai-chat-completions-v1", available: false, latencyMs: 29,
        errorCode: "AUTHENTICATION_FAILED", providerStatus: 401
      }
    }) });
    const serialized = JSON.stringify([createRecord.mock.calls, createAudit.mock.calls]);
    expect(serialized).not.toMatch(/secret|ciphertext|authorization|fingerprint/i);
  });
});
