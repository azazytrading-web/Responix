export type OicProviderRegistration = {
  key: string;
  displayName: string;
  authStrategy: "BEARER" | "API_KEY_HEADER" | "NONE";
  transportProfiles: readonly string[];
  defaultEndpoint: string | null;
};

/** Only capabilities backed by a statically registered adapter may be published. */
export const OIC_PROVIDER_REGISTRY: readonly OicProviderRegistration[] = [
  {
    key: "openai",
    displayName: "OpenAI",
    authStrategy: "BEARER",
    transportProfiles: ["openai-chat-completions-v1", "openai-responses-v1"],
    defaultEndpoint: "https://api.openai.com/v1"
  },
  {
    key: "openai-compatible",
    displayName: "OpenAI-compatible API",
    authStrategy: "BEARER",
    transportProfiles: ["openai-chat-completions-v1"],
    defaultEndpoint: null
  }
];

export function registeredProvider(key: string): OicProviderRegistration | undefined {
  return OIC_PROVIDER_REGISTRY.find((provider) => provider.key === key);
}
