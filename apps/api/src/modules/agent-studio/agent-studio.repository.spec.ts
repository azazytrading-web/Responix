/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgentPromptRole, Prisma } from "@prisma/client";
import { AgentStudioRepository } from "./agent-studio.repository";

const binding = {
  id: "binding",
  role: AgentPromptRole.SYSTEM,
  promptId: "prompt",
  promptVersionId: "prompt-version",
  variableMetadata: [{ name: "locale", type: "string" }],
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

const agent = (overrides: Record<string, unknown> = {}) => ({
  id: "agent",
  workspaceId: "workspace",
  name: "Support",
  slug: "support",
  description: "Support agent",
  category: "Customer Service",
  avatarMetadata: {},
  colorMetadata: {},
  iconMetadata: {},
  status: "DRAFT",
  visibility: "WORKSPACE",
  providerId: "provider",
  modelId: "model",
  providerConfigurationId: "provider-configuration",
  providerConfiguration: {},
  modelConfiguration: {},
  runtimeConfiguration: {},
  temperature: new Prisma.Decimal(0.7),
  topP: new Prisma.Decimal(0.9),
  maxTokens: 2000,
  stopSequences: [],
  streamingEnabled: true,
  timeoutMs: 30000,
  retryPolicy: { maxAttempts: 3, backoffMs: 250 },
  fallbackStrategy: {},
  memoryEnabled: false,
  knowledgeEnabled: false,
  toolsEnabled: true,
  visionEnabled: false,
  reasoningEnabled: true,
  voiceEnabled: false,
  imageEnabled: false,
  moderationEnabled: true,
  capabilitiesMetadata: {},
  version: 0,
  createdById: "actor",
  updatedById: "actor",
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  deletedAt: null,
  promptBindings: [binding],
  ...overrides
});

const configuration = {
  providerId: "provider",
  modelId: "model",
  providerConfigurationId: "provider-configuration",
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2000,
  streaming: true,
  timeoutMs: 30000,
  retryPolicy: { maxAttempts: 3, backoffMs: 250 }
};

describe("AgentStudioRepository", () => {
  const prisma = {
    aiAgent: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    aiAgentVersion: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    aiModel: { findFirst: jest.fn() },
    aiProviderConfiguration: { findFirst: jest.fn() },
    promptLibraryItem: { count: jest.fn() },
    promptLibraryVersion: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new AgentStudioRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.aiAgent.findFirst.mockResolvedValue(agent());
    prisma.aiAgent.create.mockResolvedValue(agent());
    prisma.aiAgent.update.mockResolvedValue(agent());
    prisma.aiModel.findFirst.mockResolvedValue({
      id: "model",
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsAudio: true,
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true
    });
    prisma.aiProviderConfiguration.findFirst.mockResolvedValue({
      id: "provider-configuration"
    });
    prisma.promptLibraryItem.count.mockResolvedValue(1);
    prisma.promptLibraryVersion.findMany.mockResolvedValue([{ id: "prompt-version" }]);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("creates the complete configuration, prompt references, and audit atomically", async () => {
    await repository.create({
      workspaceId: "workspace",
      actorId: "actor",
      name: "Support",
      slug: "support",
      configuration,
      capabilities: {
        toolsEnabled: true,
        reasoningEnabled: true,
        streamingEnabled: true,
        moderationEnabled: true
      },
      promptBindings: [
        {
          role: "SYSTEM",
          promptId: "prompt",
          promptVersionId: "prompt-version",
          variableMetadata: [{ name: "locale", type: "string" }]
        }
      ]
    });

    expect(prisma.aiProviderConfiguration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "provider-configuration",
          workspaceId: "workspace",
          providerId: "provider"
        })
      })
    );
    expect(prisma.aiAgent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace",
          providerId: "provider",
          modelId: "model",
          status: "DRAFT",
          version: 0,
          toolsEnabled: true,
          reasoningEnabled: true,
          promptBindings: {
            create: [
              expect.objectContaining({
                role: "SYSTEM",
                promptId: "prompt",
                promptVersionId: "prompt-version"
              })
            ]
          }
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "agent.studio.created" })
      })
    );
  });

  it("rejects cross-workspace provider configurations", async () => {
    prisma.aiProviderConfiguration.findFirst.mockResolvedValue(null);
    await expect(
      repository.create({
        workspaceId: "workspace",
        actorId: "actor",
        name: "Support",
        slug: "support",
        configuration
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiAgent.create).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace prompt and prompt-version references", async () => {
    prisma.promptLibraryItem.count.mockResolvedValue(0);
    await expect(
      repository.create({
        workspaceId: "workspace",
        actorId: "actor",
        name: "Support",
        slug: "support",
        configuration,
        promptBindings: [{ role: "SYSTEM", promptId: "foreign-prompt" }]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.promptLibraryItem.count.mockResolvedValue(1);
    prisma.promptLibraryVersion.findMany.mockResolvedValue([]);
    await expect(
      repository.create({
        workspaceId: "workspace",
        actorId: "actor",
        name: "Support",
        slug: "support",
        configuration,
        promptBindings: [
          {
            role: "SYSTEM",
            promptId: "prompt",
            promptVersionId: "foreign-version"
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects model capability and token mismatches", async () => {
    prisma.aiModel.findFirst.mockResolvedValue({
      id: "model",
      maxOutputTokens: 1000,
      supportsVision: false,
      supportsAudio: false,
      supportsTools: false,
      supportsReasoning: false,
      supportsStreaming: false
    });
    await expect(
      repository.create({
        workspaceId: "workspace",
        actorId: "actor",
        name: "Support",
        slug: "support",
        configuration,
        capabilities: { toolsEnabled: true }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces draft-only editing", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 1 }));
    await expect(
      repository.updateDraft({
        workspaceId: "workspace",
        actorId: "actor",
        agentId: "agent",
        draft: { description: "Changed" }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiAgent.update).not.toHaveBeenCalled();
  });

  it("publishes an immutable complete snapshot", async () => {
    prisma.aiAgentVersion.create.mockResolvedValue({
      id: "version",
      agentId: "agent",
      revision: 1
    });
    prisma.aiAgent.update.mockResolvedValue(agent({ status: "PUBLISHED", version: 1 }));
    await repository.publish({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      changeSummary: "Ready"
    });

    expect(prisma.aiAgentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: "agent",
          revision: 1,
          changeSummary: "Ready",
          snapshot: expect.objectContaining({
            providerId: "provider",
            modelId: "model",
            promptBindings: [
              expect.objectContaining({
                promptId: "prompt",
                promptVersionId: "prompt-version"
              })
            ]
          })
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "agent.studio.published" })
      })
    );
  });

  it("rollback creates a new published revision from the snapshot", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 2 }));
    prisma.aiAgentVersion.findFirst.mockResolvedValue({
      id: "source",
      agentId: "agent",
      revision: 1,
      snapshot: {
        ...snapshotFromAgent(),
        name: "Original"
      }
    });
    prisma.aiAgentVersion.create.mockResolvedValue({ id: "new-version", revision: 3 });

    await repository.rollback({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      revision: 1
    });

    expect(prisma.aiAgentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revision: 3,
          changeSummary: "Rollback to revision 1"
        })
      })
    );
    expect(prisma.aiAgent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Original",
          status: "PUBLISHED",
          version: 3,
          promptBindings: expect.objectContaining({ deleteMany: {} })
        })
      })
    );
  });

  it("clone creates independent agent and prompt-binding ids without versions", async () => {
    prisma.aiAgent.create.mockResolvedValue(agent({ id: "clone", name: "Copy", slug: "copy" }));
    await repository.clone({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      name: "Copy",
      slug: "copy"
    });

    expect(prisma.aiAgent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Copy",
          slug: "copy",
          status: "DRAFT",
          version: 0,
          promptBindings: {
            create: [
              expect.not.objectContaining({ id: "binding" })
            ]
          }
        })
      })
    );
    expect(prisma.aiAgentVersion.create).not.toHaveBeenCalled();
  });

  it("archives, restores, and soft-deletes without removing versions", async () => {
    prisma.aiAgent.findFirst
      .mockResolvedValueOnce(agent({ status: "PUBLISHED", version: 2 }))
      .mockResolvedValueOnce(
        agent({ status: "ARCHIVED", version: 2, archivedAt: new Date() })
      )
      .mockResolvedValueOnce(agent({ status: "PUBLISHED", version: 2 }));
    await repository.archive("workspace", "actor", "agent");
    await repository.restore("workspace", "actor", "agent");
    await repository.softDelete("workspace", "actor", "agent");

    expect(prisma.aiAgent.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) })
      })
    );
    expect(prisma.aiAgent.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", archivedAt: null, deletedAt: null })
      })
    );
    expect(prisma.aiAgent.update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ARCHIVED",
          archivedAt: expect.any(Date),
          deletedAt: expect.any(Date)
        })
      })
    );
    expect(prisma.aiAgentVersion.create).not.toHaveBeenCalled();
  });

  it("workspace-scopes direct retrieval and history", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(null);
    await expect(repository.get("workspace", "foreign-agent")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.aiAgent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "foreign-agent",
          workspaceId: "workspace",
          deletedAt: null
        })
      })
    );
  });

  it("rolls back lifecycle mutations when audit persistence fails", async () => {
    const failure = new Error("audit unavailable");
    prisma.auditLog.create.mockRejectedValue(failure);
    await expect(repository.archive("workspace", "actor", "agent")).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

function snapshotFromAgent() {
  return {
    name: "Support",
    slug: "support",
    description: "Support agent",
    category: "Customer Service",
    avatarMetadata: {},
    colorMetadata: {},
    iconMetadata: {},
    visibility: "WORKSPACE",
    providerId: "provider",
    modelId: "model",
    providerConfigurationId: "provider-configuration",
    providerConfiguration: {},
    modelConfiguration: {},
    runtimeConfiguration: {},
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2000,
    stopSequences: [],
    streamingEnabled: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 3, backoffMs: 250 },
    fallbackStrategy: {},
    capabilities: {
      knowledgeEnabled: false,
      toolsEnabled: true,
      memoryEnabled: false,
      visionEnabled: false,
      reasoningEnabled: true,
      voiceEnabled: false,
      imageEnabled: false,
      moderationEnabled: true,
      metadata: {}
    },
    promptBindings: [
      {
        role: "SYSTEM",
        promptId: "prompt",
        promptVersionId: "prompt-version",
        variableMetadata: [],
        metadata: {}
      }
    ]
  };
}
