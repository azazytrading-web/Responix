import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ChannelProviderAdapter } from "./contracts/channel-provider.contract";
import { CHANNEL_PROVIDER_ADAPTERS } from "./channel-runtime.tokens";

@Injectable()
export class ChannelProviderRegistry {
  private readonly adapters: ReadonlyMap<string, ChannelProviderAdapter>;
  constructor(@Inject(CHANNEL_PROVIDER_ADAPTERS) values: readonly ChannelProviderAdapter[]) {
    const entries = values.map((adapter) => [this.normalize(adapter.key), adapter] as const);
    if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new ConflictException("Duplicate channel provider adapter key");
    this.adapters = new Map(entries);
  }
  resolve(key: string): ChannelProviderAdapter {
    const adapter = this.adapters.get(this.normalize(key));
    if (!adapter) throw new NotFoundException(`Channel provider adapter ${key} is not installed`);
    return adapter;
  }
  installed() {
    return Object.freeze([...this.adapters.entries()].map(([key, adapter]) => { const capabilities = adapter.capabilities(); return Object.freeze({
      key, capabilities: Object.freeze([...capabilities.supported]), limits: capabilities.limits, metadata: capabilities.metadata }); }));
  }
  supports(key: string, capability: string): boolean { return this.resolve(key).capabilities().supported.has(capability as never); }
  private normalize(key: string) { return key.trim().toLowerCase(); }
}

