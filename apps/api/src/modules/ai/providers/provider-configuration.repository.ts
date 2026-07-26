import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { WorkspaceProviderConfiguration } from "./provider.types";

@Injectable()
export class ProviderConfigurationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    workspaceId: string,
    providerId: string
  ): Promise<WorkspaceProviderConfiguration | null> {
    const configuration = await this.prisma.aiProviderConfiguration.findFirst({
      where: { workspaceId, providerId, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        providerId: true,
        enabled: true,
        settings: true
      }
    });
    if (!configuration) return null;
    return {
      ...configuration,
      settings:
        typeof configuration.settings === "object" &&
        configuration.settings !== null &&
        !Array.isArray(configuration.settings)
          ? configuration.settings
          : {}
    };
  }
}
