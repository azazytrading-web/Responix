/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CustomProviderCredentialRepository } from "./custom-provider-credential.repository";

describe("CustomProviderCredentialRepository", () => {
  it("lists safe metadata in deterministic priority/use-time/id order", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new CustomProviderCredentialRepository({ customAiProviderCredential: { findMany } } as never);
    await repository.listMetadata("workspace-a", "custom-a");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a", customProviderId: "custom-a", deletedAt: null },
      orderBy: [{ priority: "desc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      select: { id: true, workspaceId: true, customProviderId: true, name: true, keyFingerprint: true,
        status: true, priority: true, lastUsedAt: true }
    }));
  });

  it("replaces the named encrypted credential without returning its encrypted envelope", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: "credential-a", name: "default", keyFingerprint: "fp", status: "ACTIVE" });
    const repository = new CustomProviderCredentialRepository({ customAiProviderCredential: { upsert } } as never);
    await repository.create({ workspaceId: "workspace-a", customProviderId: "provider-a", name: "default", encryptedSecret: "cipher", keyFingerprint: "fingerprint" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_customProviderId_name: { workspaceId: "workspace-a", customProviderId: "provider-a", name: "default" } },
      update: { encryptedSecret: "cipher", keyFingerprint: "fingerprint", encryptionVersion: 1, status: "ACTIVE", deletedAt: null },
      select: { id: true, workspaceId: true, customProviderId: true, name: true, keyFingerprint: true, status: true }
    }));
  });

  it("resolves one active credential with workspace-bound provider scope and updates last use", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "credential-a", workspaceId: "workspace-a", customProviderId: "custom-a", encryptedSecret: "cipher" });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new CustomProviderCredentialRepository({
      customAiProviderCredential: { findFirst, updateMany }
    } as never);
    await repository.findActiveEnvelope("workspace-a", "custom-a");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: "workspace-a", customProviderId: "custom-a", status: "ACTIVE", deletedAt: null,
        customProvider: { workspaceId: "workspace-a", status: "ACTIVE" }
      },
      orderBy: [{ priority: "desc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      select: { id: true, workspaceId: true, customProviderId: true, name: true,
        encryptedSecret: true, keyFingerprint: true, status: true, priority: true, lastUsedAt: true }
    }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "credential-a", workspaceId: "workspace-a", customProviderId: "custom-a", status: "ACTIVE", deletedAt: null },
      data: { lastUsedAt: expect.any(Date) }
    }));
  });

  it("selects exactly one active credential for ACTIVE or DISABLED providers in deterministic order", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "credential-a", encryptedSecret: "cipher" });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new CustomProviderCredentialRepository({
      customAiProviderCredential: { findFirst, updateMany }
    } as never);
    await repository.findValidationEnvelope("workspace-a", "custom-a");
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: "workspace-a", customProviderId: "custom-a", status: "ACTIVE", deletedAt: null,
        customProvider: { workspaceId: "workspace-a", status: { in: ["ACTIVE", "DISABLED"] } }
      },
      orderBy: [{ priority: "desc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }]
    }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "credential-a", workspaceId: "workspace-a", customProviderId: "custom-a", status: "ACTIVE", deletedAt: null },
      data: { lastUsedAt: expect.any(Date) }
    }));
  });

  it("does not select credentials outside the workspace/provider scope", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const updateMany = jest.fn();
    const repository = new CustomProviderCredentialRepository({
      customAiProviderCredential: { findFirst, updateMany }
    } as never);
    await expect(repository.findValidationEnvelope("workspace-a", "other-provider")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "workspace-a", customProviderId: "other-provider", status: "ACTIVE", deletedAt: null
      })
    }));
    expect(updateMany).not.toHaveBeenCalled();
  });
});
