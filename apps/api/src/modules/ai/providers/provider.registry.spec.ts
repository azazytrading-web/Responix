import { AiContractError } from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import { ProviderRegistry } from "./provider.registry";

describe("ProviderRegistry", () => {
  const openAi: AiProviderAdapter = {
    providerName: "OpenAI",
    invoke: jest.fn()
  };

  it("registers and resolves provider adapters", () => {
    const adapter = { ...openAi, protocolId: "responix-native-openai-v1" };
    const registry = new ProviderRegistry([adapter]);

    expect(registry.has("OpenAI")).toBe(true);
    expect(registry.names()).toEqual(["OpenAI"]);
    expect(registry.get("OpenAI")).toBe(adapter);
    expect(registry.get("responix-native-openai-v1")).toBe(adapter);
    expect(registry.names()).toEqual(["OpenAI"]);
  });

  it("rejects duplicate protocol bindings", () => {
    expect(() => new ProviderRegistry([
      { providerName: "One", protocolId: "protocol-v1", invoke: jest.fn() },
      { providerName: "Two", protocolId: "protocol-v1", invoke: jest.fn() }
    ])).toThrow("Duplicate AI provider adapter protocol: protocol-v1");
  });

  it("rejects collisions between protocol identifiers and provider-name aliases", () => {
    expect(() => new ProviderRegistry([
      { providerName: "One", protocolId: "Shared", invoke: jest.fn() },
      { providerName: "Shared", invoke: jest.fn() }
    ])).toThrow("AI provider adapter alias collides with protocol: Shared");
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
