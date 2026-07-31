import {
  unsupportedProviderPromptCache
} from "./provider-prompt-cache.interface";
import { AnthropicProviderAdapter } from "./anthropic-provider.adapter";
import { DeepSeekProviderAdapter } from "./deepseek-provider.adapter";
import { OpenAiProviderAdapter } from "./openai-provider.adapter";
import { OpenRouterProviderAdapter } from "./openrouter-provider.adapter";
import { GeminiProviderAdapter } from "./gemini-provider.adapter";

describe("Provider prompt cache negotiation", () => {
  it.each([
    ["OpenAI", new OpenAiProviderAdapter({} as never)],
    ["Claude", new AnthropicProviderAdapter({} as never)],
    ["OpenRouter", new OpenRouterProviderAdapter({} as never)],
    ["DeepSeek", new DeepSeekProviderAdapter({} as never)],
    ["Gemini", new GeminiProviderAdapter({} as never)]
  ])("%s exposes truthful provider-neutral native cache capability", (_name, adapter) => {
    expect(adapter.promptCache.supportsCaching()).toBe(true);
    expect(adapter.promptCache.buildProviderCacheKey({
      workspaceId: "workspace", providerName: adapter.providerName,
      modelName: "model", promptHash: "hash"
    })).toContain("workspace");
    expect(adapter.promptCache.ttlSeconds).toBeGreaterThan(0);
  });
  it("is immutable and shared without provider business metrics", () => {
    expect(Object.isFrozen(unsupportedProviderPromptCache)).toBe(true);
    expect(unsupportedProviderPromptCache.supportsCaching()).toBe(false);
  });
});
