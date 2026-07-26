import { CredentialRepository } from "./credential.repository";

const credential = {
  id: "credential-id",
  workspaceId: "workspace-id",
  providerId: "provider-id",
  name: "primary",
  encryptedSecret: "encrypted",
  keyFingerprint: "fingerprint",
  status: "ACTIVE" as const,
  priority: 10,
  dailyRequestLimit: null,
  dailyTokenLimit: null,
  lastUsedAt: null
};

describe("CredentialRepository", () => {
  it("returns metadata without encrypted credential material", async () => {
    const findMany = jest.fn().mockResolvedValue([credential]);
    const repository = new CredentialRepository({
      aiProviderCredential: { findMany }
    } as never);

    const result = await repository.listMetadata("workspace-id", "provider-id");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-id",
          providerId: "provider-id",
          deletedAt: null
        }
      })
    );
    expect(result[0]).not.toHaveProperty("encryptedSecret");
  });

  it("retrieves an active encrypted envelope only inside the workspace boundary", async () => {
    const findFirst = jest.fn().mockResolvedValue(credential);
    const repository = new CredentialRepository({
      aiProviderCredential: { findFirst }
    } as never);

    await expect(repository.findActiveEnvelope("workspace-id", "provider-id")).resolves.toEqual(
      credential
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "workspace-id",
          providerId: "provider-id",
          status: "ACTIVE",
          deletedAt: null,
          provider: { status: "ACTIVE" }
        }
      })
    );
  });
});
