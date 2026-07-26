import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER_ADAPTERS } from "../ai.tokens";
import { AiContractError } from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";

@Injectable()
export class ProviderRegistry {
  private readonly adapters: ReadonlyMap<string, AiProviderAdapter>;

  constructor(@Inject(AI_PROVIDER_ADAPTERS) adapters: readonly AiProviderAdapter[]) {
    const registered = new Map<string, AiProviderAdapter>();
    for (const adapter of adapters) {
      if (registered.has(adapter.providerName)) {
        throw new Error(`Duplicate AI provider adapter: ${adapter.providerName}`);
      }
      registered.set(adapter.providerName, adapter);
    }
    this.adapters = registered;
  }

  get(providerName: string): AiProviderAdapter {
    const adapter = this.adapters.get(providerName);
    if (!adapter) {
      throw new AiContractError(
        "PROVIDER_UNAVAILABLE",
        `No adapter is registered for AI provider ${providerName}`
      );
    }
    return adapter;
  }

  has(providerName: string): boolean {
    return this.adapters.has(providerName);
  }

  names(): string[] {
    return [...this.adapters.keys()];
  }
}
