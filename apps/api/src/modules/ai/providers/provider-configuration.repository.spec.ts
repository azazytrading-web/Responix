import { ProviderConfigurationRepository } from "./provider-configuration.repository";

describe("ProviderConfigurationRepository", () => {
  it("retrieves configuration through workspace and provider identifiers", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "configuration-id",
      workspaceId: "workspace-id",
      providerId: "provider-id",
      enabled: true,
      settings: { region: "default" }
    });
    const repository = new ProviderConfigurationRepository({
      aiProviderConfiguration: { findFirst }
    } as never);

    await expect(repository.find("workspace-id", "provider-id")).resolves.toEqual({
      id: "configuration-id",
      workspaceId: "workspace-id",
      providerId: "provider-id",
      enabled: true,
      settings: { region: "default" }
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-id",
        providerId: "provider-id",
        deletedAt: null
      },
      select: {
        id: true,
        workspaceId: true,
        providerId: true,
        enabled: true,
        settings: true
      }
    });
  });
});
