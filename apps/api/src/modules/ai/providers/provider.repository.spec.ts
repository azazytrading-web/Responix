import { ProviderRepository } from "./provider.repository";

const providerRecord = {
  id: "provider-id",
  providerName: "OpenAI",
  apiBaseUrl: null,
  authenticationType: "api_key",
  status: "ACTIVE" as const,
  priority: 10,
  configurations: [
    {
      workspaceId: "workspace-id",
      enabled: true,
      settings: { organization: "org-id" }
    }
  ],
  models: [
    {
      id: "model-id",
      modelName: "gpt-4.1-mini",
      displayName: "GPT-4.1 mini",
      contextWindow: 1_000_000,
      supportsVision: true,
      supportsAudio: false,
      supportsTools: true,
      supportsReasoning: false,
      supportsStreaming: true,
      maxOutputTokens: 32_768,
      status: "ACTIVE" as const,
      priority: 5
    }
  ]
};

describe("ProviderRepository", () => {
  it("discovers providers through a workspace-scoped query and maps domain values", async () => {
    let capturedQuery: unknown;
    const findMany = jest.fn((query: unknown) => {
      capturedQuery = query;
      return Promise.resolve([providerRecord]);
    });
    const repository = new ProviderRepository({
      aiProvider: { findMany }
    } as never);

    const providers = await repository.discover("workspace-id");

    const query = capturedQuery as {
      where: {
        status: string;
        configurations: {
          none: {
            workspaceId: string;
            OR: unknown[];
          };
        };
      };
    };
    expect(query.where).toEqual(
      expect.objectContaining({
        status: "ACTIVE",
        configurations: {
          none: {
            workspaceId: "workspace-id",
            OR: [{ enabled: false }, { deletedAt: { not: null } }]
          }
        }
      })
    );
    expect(providers).toEqual([
      expect.objectContaining({
        id: "provider-id",
        configuration: {
          enabled: true,
          settings: { organization: "org-id" }
        },
        models: [
          expect.objectContaining({
            modelId: "model-id",
            providerId: "provider-id",
            modelName: "gpt-4.1-mini"
          })
        ]
      })
    ]);
  });

  it("returns null when a provider is not available to the workspace", async () => {
    let capturedQuery: unknown;
    const findFirst = jest.fn((query: unknown) => {
      capturedQuery = query;
      return Promise.resolve(null);
    });
    const repository = new ProviderRepository({
      aiProvider: { findFirst }
    } as never);

    await expect(repository.findAvailableById("workspace-id", "provider-id")).resolves.toBeNull();
    const query = capturedQuery as {
      where: {
        id: string;
        configurations: {
          none: {
            workspaceId: string;
            OR: unknown[];
          };
        };
      };
    };
    expect(query.where).toEqual(
      expect.objectContaining({
        id: "provider-id",
        configurations: {
          none: {
            workspaceId: "workspace-id",
            OR: [{ enabled: false }, { deletedAt: { not: null } }]
          }
        }
      })
    );
  });
});
