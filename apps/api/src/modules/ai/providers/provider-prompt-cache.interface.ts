export interface ProviderPromptCacheContext {
  workspaceId: string;
  providerName: string;
  modelName: string;
  promptHash: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ProviderPromptCache {
  supportsCaching(): boolean;
  buildProviderCacheKey(context: ProviderPromptCacheContext): string | null;
  restoreProviderCache(key: string): Promise<unknown>;
  storeProviderCache(key: string, value: unknown): Promise<boolean>;
  invalidateProviderCache(key: string): Promise<boolean>;
}

export const unsupportedProviderPromptCache: ProviderPromptCache = Object.freeze({
  supportsCaching: () => false,
  buildProviderCacheKey: () => null,
  restoreProviderCache: () => Promise.resolve(null),
  storeProviderCache: () => Promise.resolve(false),
  invalidateProviderCache: () => Promise.resolve(false)
});
