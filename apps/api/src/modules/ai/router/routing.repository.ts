import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { RoutingCandidate, RoutingMetadataRecord } from "./routing.types";

type ProviderRecord = {
  id: string;
  providerName: string;
  status: RoutingCandidate["providerStatus"];
  priority: number;
  configurations: Array<{
    workspaceId: string;
    enabled: boolean;
  }>;
  credentials: Array<{
    id: string;
    workspaceId: string;
    priority: number;
  }>;
  healthRecords: Array<{
    available: boolean;
    checkedAt: Date;
  }>;
  models: Array<{
    id: string;
    modelName: string;
    status: RoutingCandidate["modelStatus"];
    priority: number;
    contextWindow: number | null;
    supportsVision: boolean;
    supportsAudio: boolean;
    supportsTools: boolean;
    supportsReasoning: boolean;
    supportsStreaming: boolean;
    supportsJson: boolean;
    supportsFunctionCalling: boolean;
    supportsVideo: boolean;
    supportsMcp: boolean;
    categories: string[];
    maxOutputTokens: number | null;
  }>;
};

@Injectable()
export class RoutingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidates(workspaceId: string): Promise<RoutingCandidate[]> {
    const providers = await this.prisma.aiProvider.findMany({
      orderBy: [{ priority: "desc" }, { id: "asc" }],
      select: {
        id: true,
        providerName: true,
        status: true,
        priority: true,
        configurations: {
          where: { workspaceId, deletedAt: null },
          select: { workspaceId: true, enabled: true },
          take: 1
        },
        credentials: {
          where: {
            workspaceId, status: "ACTIVE", deletedAt: null,
            AND: [
              { OR: [{ dailyRequestLimit: null }, { dailyRequestLimit: { gt: 0 } }] },
              { OR: [{ dailyTokenLimit: null }, { dailyTokenLimit: { gt: 0 } }] }
            ]
          },
          orderBy: [
            { priority: "desc" },
            { lastUsedAt: { sort: "asc", nulls: "first" } },
            { id: "asc" }
          ],
          select: { id: true, workspaceId: true, priority: true },
          take: 1
        },
        healthRecords: {
          where: { workspaceId },
          orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
          select: { available: true, checkedAt: true },
          take: 1
        },
        models: {
          where: { source: "BUILT_IN", ownerWorkspaceId: null, status: { not: "ARCHIVED" } },
          orderBy: [{ priority: "desc" }, { id: "asc" }],
          select: {
            id: true,
            modelName: true,
            status: true,
            priority: true,
            contextWindow: true,
            supportsVision: true,
            supportsAudio: true,
            supportsTools: true,
            supportsReasoning: true,
            supportsStreaming: true,
            supportsJson: true,
            supportsFunctionCalling: true,
            supportsVideo: true,
            supportsMcp: true,
            categories: true,
            maxOutputTokens: true
          }
        }
      }
    });

    return providers.flatMap((provider) => this.mapProvider(workspaceId, provider));
  }

  async findRecentRoutingMetadata(
    workspaceId: string,
    limit = 20
  ): Promise<RoutingMetadataRecord[]> {
    const records = await this.prisma.aiRoutingMetadata.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        workspaceId: true,
        invocationId: true,
        selectedProviderId: true,
        selectedModelId: true,
        decisionFactors: true,
        candidateMetadata: true,
        createdAt: true
      }
    });
    return records.map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      invocationId: record.invocationId,
      selectedProviderId: record.selectedProviderId,
      selectedModelId: record.selectedModelId,
      decisionFactors: this.asRecord(record.decisionFactors),
      candidateMetadata: this.asRecordArray(record.candidateMetadata),
      createdAt: record.createdAt
    }));
  }

  private mapProvider(workspaceId: string, provider: ProviderRecord): RoutingCandidate[] {
    const configuration = provider.configurations[0];
    const credential = provider.credentials[0];
    const latestHealth = provider.healthRecords[0] ?? null;
    return provider.models.map((model) => ({
      workspaceId,
      providerId: provider.id,
      providerName: provider.providerName,
      providerStatus: provider.status,
      providerPriority: provider.priority,
      modelId: model.id,
      modelName: model.modelName,
      modelStatus: model.status,
      modelPriority: model.priority,
      credentialId: credential?.id ?? null,
      credentialPriority: credential?.priority ?? 0,
      configured: configuration?.workspaceId === workspaceId,
      enabled: configuration?.enabled ?? false,
      credentialExists: credential?.workspaceId === workspaceId,
      capabilities: {
        modelId: model.id,
        providerId: provider.id,
        contextWindow: model.contextWindow ?? 0,
        supportsVision: model.supportsVision,
        supportsAudio: model.supportsAudio,
        supportsTools: model.supportsTools,
        supportsReasoning: model.supportsReasoning,
        supportsStreaming: model.supportsStreaming,
        supportsJson: model.supportsJson,
        supportsFunctionCalling: model.supportsFunctionCalling,
        supportsVideo: model.supportsVideo,
        supportsMcp: model.supportsMcp,
        categories: model.categories,
        ...(model.maxOutputTokens === null ? {} : { maxOutputTokens: model.maxOutputTokens })
      },
      latestHealth
    }));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...value } : {};
  }

  private asRecordArray(value: unknown): Record<string, unknown>[] | null {
    if (!Array.isArray(value)) return null;
    return value
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && !Array.isArray(item)
      )
      .map((item) => ({ ...item }));
  }
}
