import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { WorkspaceProvider } from "./provider.types";

const providerSelection = {
  id: true,
  providerName: true,
  apiBaseUrl: true,
  authenticationType: true,
  status: true,
  priority: true,
  models: {
    orderBy: [{ priority: "desc" as const }, { modelName: "asc" as const }],
    select: {
      id: true,
      modelName: true,
      displayName: true,
      contextWindow: true,
      supportsVision: true,
      supportsAudio: true,
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true,
      maxOutputTokens: true,
      status: true,
      priority: true
    }
  },
  configurations: {
    select: {
      workspaceId: true,
      enabled: true,
      settings: true
    }
  }
};

type ProviderRecord = {
  id: string;
  providerName: string;
  apiBaseUrl: string | null;
  authenticationType: string | null;
  status: WorkspaceProvider["status"];
  priority: number;
  models: Array<{
    id: string;
    modelName: string;
    displayName: string;
    contextWindow: number;
    supportsVision: boolean;
    supportsAudio: boolean;
    supportsTools: boolean;
    supportsReasoning: boolean;
    supportsStreaming: boolean;
    maxOutputTokens: number | null;
    status: WorkspaceProvider["models"][number]["status"];
    priority: number;
  }>;
  configurations: Array<{
    workspaceId: string;
    enabled: boolean;
    settings: unknown;
  }>;
};

@Injectable()
export class ProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async discover(workspaceId: string): Promise<WorkspaceProvider[]> {
    const providers = await this.prisma.aiProvider.findMany({
      where: {
        status: "ACTIVE",
        configurations: {
          none: { workspaceId, OR: [{ enabled: false }, { deletedAt: { not: null } }] }
        }
      },
      orderBy: [{ priority: "desc" }, { providerName: "asc" }],
      select: {
        ...providerSelection,
        configurations: {
          where: { workspaceId, deletedAt: null },
          select: providerSelection.configurations.select
        },
        models: {
          ...providerSelection.models,
          where: { status: "ACTIVE" }
        }
      }
    });
    return providers.map((provider) => this.mapProvider(provider));
  }

  async findAvailableById(
    workspaceId: string,
    providerId: string
  ): Promise<WorkspaceProvider | null> {
    const provider = await this.prisma.aiProvider.findFirst({
      where: {
        id: providerId,
        status: "ACTIVE",
        configurations: {
          none: { workspaceId, OR: [{ enabled: false }, { deletedAt: { not: null } }] }
        }
      },
      select: {
        ...providerSelection,
        configurations: {
          where: { workspaceId, deletedAt: null },
          select: providerSelection.configurations.select
        },
        models: {
          ...providerSelection.models,
          where: { status: "ACTIVE" }
        }
      }
    });
    return provider ? this.mapProvider(provider) : null;
  }

  private mapProvider(provider: ProviderRecord): WorkspaceProvider {
    const configuration = provider.configurations[0];
    return {
      id: provider.id,
      providerName: provider.providerName,
      apiBaseUrl: provider.apiBaseUrl,
      authenticationType: provider.authenticationType,
      status: provider.status,
      priority: provider.priority,
      configuration: configuration
        ? {
            enabled: configuration.enabled,
            settings: this.asRecord(configuration.settings)
          }
        : null,
      models: provider.models.map((model) => ({
        modelId: model.id,
        providerId: provider.id,
        modelName: model.modelName,
        displayName: model.displayName,
        contextWindow: model.contextWindow,
        supportsVision: model.supportsVision,
        supportsAudio: model.supportsAudio,
        supportsTools: model.supportsTools,
        supportsReasoning: model.supportsReasoning,
        supportsStreaming: model.supportsStreaming,
        ...(model.maxOutputTokens === null ? {} : { maxOutputTokens: model.maxOutputTokens }),
        status: model.status,
        priority: model.priority
      }))
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...value } : {};
  }
}
