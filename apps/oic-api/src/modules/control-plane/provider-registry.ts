import { LOCAL_PROVIDER_FIXTURE_ENDPOINT, LOCAL_PROVIDER_FIXTURE_KEY, localProviderFixtureEnabled } from "./local-provider-fixture";

export type OicProviderRegistration = {
  key: string;
  displayName: string;
  authStrategy: "BEARER" | "API_KEY_HEADER" | "NONE";
  transportProfiles: readonly string[];
  defaultEndpoint: string | null;
};

/** Production capabilities are static; the separate local fixture is gated by explicit development config. */
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
  if (key === LOCAL_PROVIDER_FIXTURE_KEY && localProviderFixtureEnabled()) return {
    key: LOCAL_PROVIDER_FIXTURE_KEY,
    displayName: "OIC Local Acceptance Fixture (development only)",
    authStrategy: "BEARER",
    transportProfiles: ["openai-chat-completions-v1"],
    defaultEndpoint: LOCAL_PROVIDER_FIXTURE_ENDPOINT
  };
  return OIC_PROVIDER_REGISTRY.find((provider) => provider.key === key);
}
