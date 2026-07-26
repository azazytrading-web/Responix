import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import { ProviderRegistry } from "./provider.registry";
import { ProviderRepository } from "./provider.repository";
import type { ResolvedProvider } from "./provider.types";

@Injectable()
export class ProviderFactory {
  constructor(
    private readonly repository: ProviderRepository,
    private readonly registry: ProviderRegistry
  ) {}

  async create(workspaceId: string, providerId: string): Promise<ResolvedProvider> {
    const provider = await this.repository.findAvailableById(workspaceId, providerId);
    if (!provider) {
      throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable");
    }
    return {
      provider,
      adapter: this.registry.get(provider.providerName)
    };
  }
}
