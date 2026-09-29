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
    const findMany = jest.fn((args: {
      where?: unknown;
      select?: Record<string, unknown>;
    }) => {
      void args;
      return Promise.resolve([credential]);
    });
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
    const query = findMany.mock.calls[0]?.[0];
    expect(query?.select).not.toHaveProperty("encryptedSecret");
    expect(result[0]).not.toHaveProperty("encryptedSecret");
  });

  it("retrieves an active encrypted envelope only inside the workspace boundary", async () => {
    const findFirst = jest.fn((args: { where: unknown; orderBy: unknown }) => {
      void args;
      return Promise.resolve(credential);
    });
    const updateMany = jest.fn((args: { where: unknown; data: { lastUsedAt: Date } }) => {
      void args;
      return Promise.resolve({ count: 1 });
    });
    const repository = new CredentialRepository({
      aiProviderCredential: { findFirst, updateMany }
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
          provider: { status: "ACTIVE" },
          AND: [
            { OR: [{ dailyRequestLimit: null }, { dailyRequestLimit: { gt: 0 } }] },
            { OR: [{ dailyTokenLimit: null }, { dailyTokenLimit: { gt: 0 } }] }
          ]
        },
        orderBy: [
          { priority: "desc" },
          { lastUsedAt: { sort: "asc", nulls: "first" } },
          { id: "asc" }
        ]
      })
    );
    const update = updateMany.mock.calls[0]?.[0];
    expect(update?.where).toEqual({
      id: "credential-id", workspaceId: "workspace-id", providerId: "provider-id",
      status: "ACTIVE", deletedAt: null
    });
    expect(update?.data.lastUsedAt).toBeInstanceOf(Date);
  });
});
