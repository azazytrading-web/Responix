import { AiContractError } from "../contracts";
import { ProviderFactory } from "./provider.factory";

describe("ProviderFactory", () => {
  const provider = {
    id: "provider-id",
    providerName: "OpenAI"
  };
  const adapter = { providerName: "OpenAI" };

  it("resolves a workspace-available provider through the registry", async () => {
    const repository = { findAvailableById: jest.fn().mockResolvedValue(provider) };
    const registry = { get: jest.fn().mockReturnValue(adapter) };
    const factory = new ProviderFactory(repository as never, registry as never);

    await expect(factory.create("workspace-id", "provider-id")).resolves.toEqual({
      provider,
      adapter
    });
    expect(repository.findAvailableById).toHaveBeenCalledWith("workspace-id", "provider-id");
    expect(registry.get).toHaveBeenCalledWith("OpenAI");
  });

  it("rejects a provider that is unavailable to the workspace", async () => {
    const factory = new ProviderFactory(
      { findAvailableById: jest.fn().mockResolvedValue(null) } as never,
      { get: jest.fn() } as never
    );

    await expect(factory.create("workspace-id", "provider-id")).rejects.toBeInstanceOf(
      AiContractError
    );
  });
});
