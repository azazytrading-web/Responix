import { AiContractError } from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import { ProviderRegistry } from "./provider.registry";

describe("ProviderRegistry", () => {
  const openAi: AiProviderAdapter = {
    providerName: "OpenAI",
    invoke: jest.fn()
  };

  it("registers and resolves provider adapters", () => {
    const registry = new ProviderRegistry([openAi]);

    expect(registry.has("OpenAI")).toBe(true);
    expect(registry.names()).toEqual(["OpenAI"]);
    expect(registry.get("OpenAI")).toBe(openAi);
  });

  it("rejects duplicate provider names", () => {
    expect(
      () => new ProviderRegistry([openAi, { providerName: "OpenAI", invoke: jest.fn() }])
    ).toThrow("Duplicate AI provider adapter: OpenAI");
  });

  it("returns a normalized error for an unregistered provider", () => {
    const registry = new ProviderRegistry([]);

    expect(() => registry.get("Unknown")).toThrow(AiContractError);
    expect(() => registry.get("Unknown")).toThrow(
      "No adapter is registered for AI provider Unknown"
    );
  });

  it("rejects incompatible adapter contract versions", () => {
    expect(() => new ProviderRegistry([{
      providerName: "Future", contractVersion: "2.0", invoke: jest.fn()
    }])).toThrow("Unsupported AI provider adapter contract 2.0");
  });
});
