import { AiContractError } from "../contracts";
import { ProviderFactory } from "./provider.factory";
import { BUILT_IN_PROVIDER_PROTOCOLS } from "./built-in-provider-protocols";

describe("ProviderFactory", () => {
  const provider = {
    id: "provider-id",
    providerName: "OpenAI"
  };
  const adapter = { providerName: "OpenAI", protocolId: BUILT_IN_PROVIDER_PROTOCOLS.OpenAI };

  it("resolves a workspace-available provider through the registry", async () => {
    const repository = { findAvailableById: jest.fn().mockResolvedValue(provider) };
    const registry = { get: jest.fn().mockReturnValue(adapter) };
    const factory = new ProviderFactory(repository as never, registry as never, {} as never);

    await expect(factory.create("workspace-id", "provider-id")).resolves.toEqual({
      provider,
      adapter
    });
    expect(repository.findAvailableById).toHaveBeenCalledWith("workspace-id", "provider-id");
    expect(registry.get).toHaveBeenCalledWith(BUILT_IN_PROVIDER_PROTOCOLS.OpenAI);
  });

  it("rejects a provider that is unavailable to the workspace", async () => {
    const factory = new ProviderFactory(
      { findAvailableById: jest.fn().mockResolvedValue(null) } as never,
      { get: jest.fn() } as never,
      {} as never
    );

    await expect(factory.create("workspace-id", "provider-id")).rejects.toBeInstanceOf(
      AiContractError
    );
  });

  it("fails closed for a built-in catalog identity with no platform protocol mapping", async () => {
    const registry = { get: jest.fn() };
    const factory = new ProviderFactory(
      { findAvailableById: jest.fn().mockResolvedValue({ id: "x", providerName: "Unknown" }) } as never,
      registry as never,
      {} as never
    );
    await expect(factory.create("w1", "x")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(registry.get).not.toHaveBeenCalled();
  });

  it("resolves Custom Provider by persisted protocol and fails closed when no adapter exists", async () => {
    const registry = { get: jest.fn().mockImplementation(() => { throw new AiContractError("PROVIDER_UNAVAILABLE", "missing"); }) };
    const customProviders = { findActiveDefinition: jest.fn().mockResolvedValue({
      id: "custom-id", workspaceId: "w1", displayName: "User label", protocolId: "openai-chat-completions-v1"
    }) };
    const factory = new ProviderFactory({} as never, registry as never, customProviders as never);
    await expect(factory.resolveCustomAdapter("w1", "custom-id")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(customProviders.findActiveDefinition).toHaveBeenCalledWith("w1", "custom-id");
    expect(registry.get).toHaveBeenCalledWith("openai-chat-completions-v1");
  });
});
