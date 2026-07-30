import {
  unsupportedProviderPromptCache
} from "./provider-prompt-cache.interface";
import { AnthropicProviderAdapter } from "./anthropic-provider.adapter";
import { DeepSeekProviderAdapter } from "./deepseek-provider.adapter";
import { OpenAiProviderAdapter } from "./openai-provider.adapter";
import { OpenRouterProviderAdapter } from "./openrouter-provider.adapter";

describe("Provider prompt cache negotiation", () => {
  it.each([
    ["OpenAI", new OpenAiProviderAdapter({} as never)],
    ["Claude", new AnthropicProviderAdapter({} as never)],
    ["OpenRouter", new OpenRouterProviderAdapter({} as never)],
    ["DeepSeek", new DeepSeekProviderAdapter({} as never)]
  ])("%s exposes provider-neutral unsupported hooks", async (_name, adapter) => {
    expect(adapter.promptCache.supportsCaching()).toBe(false);
    expect(adapter.promptCache.buildProviderCacheKey({
      workspaceId: "workspace", providerName: adapter.providerName,
      modelName: "model", promptHash: "hash"
    })).toBeNull();
    await expect(adapter.promptCache.restoreProviderCache("key")).resolves.toBeNull();
    await expect(adapter.promptCache.storeProviderCache("key", {})).resolves.toBe(false);
    await expect(adapter.promptCache.invalidateProviderCache("key")).resolves.toBe(false);
  });
  it("is immutable and shared without provider business metrics", () => {
    expect(Object.isFrozen(unsupportedProviderPromptCache)).toBe(true);
  });
});
