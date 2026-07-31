export interface ProviderPromptCacheContext {
  workspaceId: string;
  providerName: string;
  modelName: string;
  promptHash: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ProviderPromptCache {
  readonly mode: "NONE" | "AUTOMATIC" | "EXPLICIT";
  readonly ttlSeconds: number | null;
  supportsCaching(): boolean;
  buildProviderCacheKey(context: ProviderPromptCacheContext): string | null;
}

export const unsupportedProviderPromptCache: ProviderPromptCache = Object.freeze({
  mode: "NONE", ttlSeconds: null,
  supportsCaching: () => false,
  buildProviderCacheKey: () => null
});

export function nativeProviderPromptCache(mode: "AUTOMATIC" | "EXPLICIT", ttlSeconds: number): ProviderPromptCache {
  return Object.freeze({ mode, ttlSeconds, supportsCaching: () => true,
    buildProviderCacheKey: (context: ProviderPromptCacheContext) =>
      `${context.workspaceId}:${context.providerName}:${context.modelName}:${context.promptHash}` });
}
