import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import { ProviderRegistry } from "./provider.registry";
import { ProviderRepository } from "./provider.repository";
import { CustomProviderRepository } from "./custom-provider.repository";
import { builtInProtocolFor } from "./built-in-provider-protocols";
import type { ResolvedProvider } from "./provider.types";

@Injectable()
export class ProviderFactory {
  constructor(
    private readonly repository: ProviderRepository,
    private readonly registry: ProviderRegistry,
    private readonly customProviders: CustomProviderRepository
  ) {}

  async create(workspaceId: string, providerId: string): Promise<ResolvedProvider> {
    const provider = await this.repository.findAvailableById(workspaceId, providerId);
    if (!provider) {
      throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable");
    }
    const protocolId = builtInProtocolFor(provider.providerName);
    if (!protocolId) {
      throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable");
    }
    return {
      provider,
      adapter: this.registry.get(protocolId)
    };
  }

  async resolveCustomAdapter(workspaceId: string, customProviderId: string) {
    const provider = await this.customProviders.findActiveDefinition(workspaceId, customProviderId);
    if (!provider) throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable");
    return { provider, adapter: this.registry.get(provider.protocolId) };
  }
}
