import { RoutingRepository } from "./routing.repository";

describe("RoutingRepository", () => {
  it("scopes configuration, credentials, health, and metadata to the workspace", async () => {
    let capturedProviderQuery: unknown;
    let capturedMetadataQuery: unknown;
    const providerQuery = jest.fn((query: unknown) => {
      capturedProviderQuery = query;
      return Promise.resolve([]);
    });
    const metadataQuery = jest.fn((query: unknown) => {
      capturedMetadataQuery = query;
      return Promise.resolve([]);
    });
    const repository = new RoutingRepository({
      aiProvider: { findMany: providerQuery },
      aiRoutingMetadata: { findMany: metadataQuery }
    } as never);

    await repository.findCandidates("workspace-id");
    await repository.findRecentRoutingMetadata("workspace-id", 5);

    const providerSelection = capturedProviderQuery as {
      select: {
        configurations: { where: unknown };
        credentials: { where: unknown };
        healthRecords: { where: unknown };
      };
    };
    const metadataSelection = capturedMetadataQuery as {
      where: unknown;
      take: number;
    };
    expect(providerSelection.select.configurations.where).toEqual({
      workspaceId: "workspace-id",
      deletedAt: null
    });
    expect(providerSelection.select.credentials.where).toEqual({
      workspaceId: "workspace-id",
      status: "ACTIVE",
      deletedAt: null
    });
    expect(providerSelection.select.healthRecords.where).toEqual({
      workspaceId: "workspace-id"
    });
    expect(metadataSelection).toEqual(
      expect.objectContaining({
        where: { workspaceId: "workspace-id" },
        take: 5
      })
    );
  });

  it("maps candidate snapshots without returning Prisma entities", async () => {
    const repository = new RoutingRepository({
      aiProvider: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "provider-id",
            providerName: "OpenAI",
            status: "ACTIVE",
            priority: 10,
            configurations: [{ workspaceId: "workspace-id", enabled: true }],
            credentials: [
              {
                id: "credential-id",
                workspaceId: "workspace-id",
                priority: 5
              }
            ],
            healthRecords: [
              {
                available: true,
                checkedAt: new Date("2026-07-25T00:00:00.000Z")
              }
            ],
            models: [
              {
                id: "model-id",
                modelName: "gpt-4.1-mini",
                status: "ACTIVE",
                priority: 8,
                contextWindow: 1_000_000,
                supportsVision: true,
                supportsAudio: false,
                supportsTools: true,
                supportsReasoning: false,
                supportsStreaming: true,
                maxOutputTokens: null
              }
            ]
          }
        ])
      }
    } as never);

    await expect(repository.findCandidates("workspace-id")).resolves.toEqual([
      expect.objectContaining({
        workspaceId: "workspace-id",
        providerId: "provider-id",
        modelId: "model-id",
        configured: true,
        enabled: true,
        credentialExists: true
      })
    ]);
  });
});
