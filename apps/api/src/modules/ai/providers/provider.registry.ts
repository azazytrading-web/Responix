import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER_ADAPTERS } from "../ai.tokens";
import { AiContractError } from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";

@Injectable()
export class ProviderRegistry {
  private readonly adapters: ReadonlyMap<string, AiProviderAdapter>;
  private readonly protocols: ReadonlyMap<string, AiProviderAdapter>;

  constructor(@Inject(AI_PROVIDER_ADAPTERS) adapters: readonly AiProviderAdapter[]) {
    const registered = new Map<string, AiProviderAdapter>();
    const protocols = new Map<string, AiProviderAdapter>();
    for (const adapter of adapters) {
      if (adapter.contractVersion && adapter.contractVersion !== "1.0") {
        throw new Error(
          `Unsupported AI provider adapter contract ${adapter.contractVersion}: ${adapter.providerName}`
        );
      }
      if (registered.has(adapter.providerName)) {
        throw new Error(`Duplicate AI provider adapter: ${adapter.providerName}`);
      }
      if (protocols.has(adapter.providerName)) {
        throw new Error(`AI provider adapter alias collides with protocol: ${adapter.providerName}`);
      }
      registered.set(adapter.providerName, adapter);
      if (adapter.protocolId) {
        if (registered.has(adapter.protocolId)) {
          throw new Error(`AI provider protocol collides with adapter alias: ${adapter.protocolId}`);
        }
        if (protocols.has(adapter.protocolId)) {
          throw new Error(`Duplicate AI provider adapter protocol: ${adapter.protocolId}`);
        }
        protocols.set(adapter.protocolId, adapter);
      }
    }
    this.adapters = registered;
    this.protocols = protocols;
  }

  get(providerKey: string): AiProviderAdapter {
    const adapter = this.protocols.get(providerKey) ?? this.adapters.get(providerKey);
    if (!adapter) {
      throw new AiContractError(
        "PROVIDER_UNAVAILABLE",
        `No adapter is registered for AI provider ${providerKey}`
      );
    }
    return adapter;
  }

  has(providerName: string): boolean {
    return this.adapters.has(providerName) || this.protocols.has(providerName);
  }

  hasProtocol(protocolId: string): boolean {
    return this.protocols.has(protocolId);
  }

  names(): string[] {
    return [...this.adapters.keys()];
  }
}
