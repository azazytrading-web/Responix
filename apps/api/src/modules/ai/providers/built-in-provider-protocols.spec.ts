import { BUILT_IN_PROVIDER_PROTOCOLS, builtInProtocolFor } from "./built-in-provider-protocols";

describe("built-in provider protocol mapping", () => {
  it.each([
    ["OpenAI", "responix-native-openai-v1"],
    ["Claude", "responix-native-anthropic-messages-v1"],
    ["Gemini", "responix-native-gemini-v1"],
    ["Azure OpenAI", "responix-native-azure-openai-v1"],
    ["OpenRouter", "responix-native-openrouter-v1"],
    ["DeepSeek", "responix-native-deepseek-v1"]
  ])("maps persisted identity %s to its native protocol", (name, protocolId) => {
    expect(builtInProtocolFor(name)).toBe(protocolId);
  });

  it("has unique explicit protocol IDs and rejects unknown names", () => {
    const values = Object.values(BUILT_IN_PROVIDER_PROTOCOLS);
    expect(new Set(values).size).toBe(values.length);
    expect(builtInProtocolFor("Unknown")).toBeUndefined();
  });
});
