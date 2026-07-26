import { Injectable } from "@nestjs/common";
import { ProviderRepository } from "./provider.repository";
import type { WorkspaceProvider } from "./provider.types";

@Injectable()
export class ProviderDiscoveryService {
  constructor(private readonly repository: ProviderRepository) {}

  discover(workspaceId: string): Promise<WorkspaceProvider[]> {
    return this.repository.discover(workspaceId);
  }
}
