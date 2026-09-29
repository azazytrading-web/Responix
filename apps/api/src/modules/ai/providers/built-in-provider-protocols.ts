/** Platform-owned compatibility mapping for persisted built-in provider identities. */
export const BUILT_IN_PROVIDER_PROTOCOLS = {
  OpenAI: "responix-native-openai-v1",
  Claude: "responix-native-anthropic-messages-v1",
  Gemini: "responix-native-gemini-v1",
  "Azure OpenAI": "responix-native-azure-openai-v1",
  OpenRouter: "responix-native-openrouter-v1",
  DeepSeek: "responix-native-deepseek-v1"
} as const;

export type BuiltInProviderName = keyof typeof BUILT_IN_PROVIDER_PROTOCOLS;

export function builtInProtocolFor(providerName: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_PROVIDER_PROTOCOLS, providerName)
    ? BUILT_IN_PROVIDER_PROTOCOLS[providerName as BuiltInProviderName]
    : undefined;
}
