/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
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
    promptLibraryVersion: { findFirst: jest.fn(), findMany: jest.fn() },
    agentRuntimeSnapshot: { findMany: jest.fn() },
    channelConfiguration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    },
    channelConnection: {
      findFirst: jest.fn(),
      updateMany: jest.fn()
    },
    agentExecutionOrchestration: { findFirst: jest.fn() },
    retrievalRuntimeSnapshot: { findFirst: jest.fn() },
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
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "prompt-version", snapshot: { draft: { sections: { userPrompt: "User" } } }
    });
    prisma.promptLibraryVersion.findMany.mockResolvedValue([{ id: "prompt-version" }]);
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([]);
    prisma.channelConfiguration.findMany.mockResolvedValue([]);
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

  it("defaults a new Agent's conversation-history working-context flag to OFF", async () => {
    await repository.create({
      workspaceId: "workspace",
      actorId: "actor",
      name: "Support",
      slug: "support",
      configuration
    });

    const written = (prisma.aiAgent.create as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.runtimeConfiguration).toEqual({ conversationHistory: { enabled: false } });
  });

  it("persists an enabled conversation-history working-context flag on create", async () => {
    await repository.create({
      workspaceId: "workspace",
      actorId: "actor",
      name: "Support",
      slug: "support",
      configuration,
      conversationHistory: { enabled: true }
    });

    const written = (prisma.aiAgent.create as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.runtimeConfiguration).toEqual({ conversationHistory: { enabled: true } });
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

  it("rejects an invalid published Prompt binding with compiler diagnostics", async () => {
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "invalid-version", snapshot: { draft: { system_prompt: "System only" } }
    });
    await expect(repository.create({
      workspaceId: "workspace", actorId: "actor", name: "Support", slug: "support",
      configuration, promptBindings: [{ role: "SYSTEM", promptId: "invalid-prompt" }]
    })).rejects.toMatchObject({ response: expect.objectContaining({
      code: "USER_PROMPT_MISSING", path: "sections.userPrompt",
      promptId: "invalid-prompt", promptVersionId: "invalid-version"
    }) });
    expect(prisma.aiAgent.create).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce(agent({ status: "DRAFT", version: 0 }));
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

  it("rejects archive and destructive delete while the agent is active on a channel", async () => {
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([{ id: "snapshot-1" }]);
    prisma.channelConfiguration.findMany.mockResolvedValue([
      {
        connectionId: "connection-1",
        revision: 2,
        configuration: {
          agentExecution: { agentRuntimeSnapshotId: "snapshot-1" }
        },
        connection: { channelId: "channel-1" }
      }
    ]);
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 1 }));

    await expect(repository.archive("workspace", "actor", "agent")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.aiAgent.update).not.toHaveBeenCalled();

    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "DRAFT", version: 0 }));
    await expect(repository.softDelete("workspace", "actor", "agent")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.aiAgent.update).not.toHaveBeenCalled();
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

  it("reports active channel references for a single agent", async () => {
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([{ id: "snapshot-1" }]);
    prisma.channelConfiguration.findMany.mockResolvedValue([
      {
        connectionId: "connection-1",
        configuration: { agentExecution: { agentRuntimeSnapshotId: "snapshot-1" } },
        connection: { channelId: "channel-1" }
      },
      {
        connectionId: "connection-2",
        configuration: { agentExecution: { agentRuntimeSnapshotId: "other-snapshot" } },
        connection: { channelId: "channel-2" }
      }
    ]);
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 1 }));

    const result = await repository.get("workspace", "agent");
    expect(result.activeChannels).toEqual([
      { connectionId: "connection-1", channelId: "channel-1" }
    ]);
  });

  it("maps active channel references per agent in the list without changing pagination", async () => {
    prisma.aiAgent.findMany.mockResolvedValue([
      agent({ id: "agent-a", name: "Alpha" }),
      agent({ id: "agent-b", name: "Beta" })
    ]);
    prisma.aiAgent.count.mockResolvedValue(2);
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([
      { agentId: "agent-a", id: "snapshot-a1" },
      { agentId: "agent-a", id: "snapshot-a2" },
      { agentId: "agent-b", id: "snapshot-b1" }
    ]);
    prisma.channelConfiguration.findMany.mockResolvedValue([
      {
        connectionId: "connection-1",
        configuration: { agentExecution: { agentRuntimeSnapshotId: "snapshot-a2" } },
        connection: { channelId: "channel-1" }
      },
      {
        connectionId: "connection-2",
        configuration: { agentExecution: { agentRuntimeSnapshotId: "snapshot-b1" } },
        connection: { channelId: "channel-2" }
      }
    ]);

    const result = await repository.list({
      workspaceId: "workspace",
      page: 1,
      limit: 25
    });

    expect(result.data).toHaveLength(2);
    expect(result.data.find((item) => item.id === "agent-a")?.activeChannels).toEqual([
      { connectionId: "connection-1", channelId: "channel-1" }
    ]);
    expect(result.data.find((item) => item.id === "agent-b")?.activeChannels).toEqual([
      { connectionId: "connection-2", channelId: "channel-2" }
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 2,
      totalPages: 1
    });
  });

  it("returns an empty active channel list when an agent has no references", async () => {
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([]);
    prisma.channelConfiguration.findMany.mockResolvedValue([]);
    prisma.aiAgent.findFirst.mockResolvedValue(agent());

    const result = await repository.get("workspace", "agent");
    expect(result.activeChannels).toEqual([]);
  });

  it("switches a channel connection to a published, runtime-ready target agent", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 3 }));
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: "connection", channelId: "channel", stateVersion: 4
    });
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([{ id: "b-agent-snapshot" }]);
    prisma.agentExecutionOrchestration.findFirst.mockResolvedValue({
      agentRuntimeSnapshotId: "b-agent-snapshot",
      promptExecutionPayloadId: "b-prompt-payload",
      providerRuntimeSnapshotId: "b-provider-snapshot",
      conversationRuntimeSnapshotId: "b-conversation-snapshot",
      executionPipelineSnapshotId: "b-pipeline-snapshot"
    });
    prisma.channelConfiguration.findFirst.mockResolvedValue({
      revision: 2,
      configuration: {
        businessAccountId: "ba",
        phoneNumberId: "pn",
        webhook: { pathKey: "k" },
        agentExecution: {
          agentRuntimeSnapshotId: "a-agent-snapshot",
          promptExecutionPayloadId: "a-prompt-payload",
          providerRuntimeSnapshotId: "a-provider-snapshot",
          executionPipelineSnapshotId: "a-pipeline-snapshot",
          taskType: "channel.message"
        }
      }
    });
    prisma.channelConfiguration.create.mockResolvedValue({});
    prisma.channelConnection.updateMany.mockResolvedValue({ count: 1 });

    const result = await repository.switchChannelAgent(
      "workspace", "actor", "agent", "connection", 4
    );

    expect(result.agentId).toBe("agent");
    expect(result.connectionId).toBe("connection");
    expect(result.newStateVersion).toBe(5);
    expect(result.newRevision).toBe(3);
    expect(result.agentExecution).toEqual({
      agentId: "agent",
      agentName: "Support",
      agentRuntimeSnapshotId: "b-agent-snapshot",
      promptExecutionPayloadId: "b-prompt-payload",
      providerRuntimeSnapshotId: "b-provider-snapshot",
      conversationRuntimeSnapshotId: "b-conversation-snapshot",
      executionPipelineSnapshotId: "b-pipeline-snapshot",
      // Default OFF for a new Agent (no conversationHistory in runtimeConfiguration).
      conversationHistory: { enabled: false },
      taskType: "channel.message"
    });
    const written = (prisma.channelConfiguration.create as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.revision).toBe(3);
    expect(written.configuration.businessAccountId).toBe("ba");
    expect(written.configuration.webhook).toEqual({ pathKey: "k" });
    expect(written.configuration.agentExecution.agentRuntimeSnapshotId).toBe("b-agent-snapshot");
    expect(written.configuration.agentExecution.taskType).toBe("channel.message");
  });

  it("propagates the Agent's enabled conversation-history flag into the execution payload on switch", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(
      agent({ status: "PUBLISHED", version: 3, runtimeConfiguration: {
        conversationHistory: { enabled: true }, automaticExecution: { enabled: false }
      } })
    );
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: "connection", channelId: "channel", stateVersion: 4
    });
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([{ id: "b-agent-snapshot" }]);
    prisma.agentExecutionOrchestration.findFirst.mockResolvedValue({
      agentRuntimeSnapshotId: "b-agent-snapshot",
      promptExecutionPayloadId: "b-prompt-payload",
      providerRuntimeSnapshotId: "b-provider-snapshot",
      conversationRuntimeSnapshotId: "b-conversation-snapshot",
      executionPipelineSnapshotId: "b-pipeline-snapshot"
    });
    prisma.channelConfiguration.findFirst.mockResolvedValue({
      revision: 2,
      configuration: { businessAccountId: "ba", agentExecution: { taskType: "channel.message" } }
    });
    prisma.channelConfiguration.create.mockResolvedValue({});
    prisma.channelConnection.updateMany.mockResolvedValue({ count: 1 });

    const result = await repository.switchChannelAgent(
      "workspace", "actor", "agent", "connection", 4
    );

    expect(result.agentExecution.conversationHistory).toEqual({ enabled: true });
    const written = (prisma.channelConfiguration.create as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.configuration.agentExecution.conversationHistory).toEqual({ enabled: true });
  });

  it("rejects switching when the target agent is not published", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent());

    await expect(
      repository.switchChannelAgent("workspace", "actor", "agent", "connection", 0)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "AGENT_NOT_PUBLISHED" })
    });
  });

  it("rejects switching when the target agent has no ready orchestration", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 3 }));
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: "connection", channelId: "channel", stateVersion: 0
    });
    prisma.agentExecutionOrchestration.findFirst.mockResolvedValue(null);

    await expect(
      repository.switchChannelAgent("workspace", "actor", "agent", "connection", 0)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "AGENT_NOT_CHANNEL_READY" })
    });
  });

  it("rejects switching when the connection belongs to another workspace", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 3 }));
    prisma.channelConnection.findFirst.mockResolvedValue(null);

    await expect(
      repository.switchChannelAgent("workspace", "actor", "agent", "connection", 0)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects switching when the expected state version is stale", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ status: "PUBLISHED", version: 3 }));
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: "connection", channelId: "channel", stateVersion: 4
    });

    await expect(
      repository.switchChannelAgent("workspace", "actor", "agent", "connection", 3)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "CHANNEL_CONNECTION_STATE_CHANGED" })
    });
  });

  it("resolves the retrieval snapshot into the execution payload on switch", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(
      agent({ status: "PUBLISHED", version: 3, knowledgeEnabled: true, retrievalRuntimeId: "runtime" })
    );
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: "connection", channelId: "channel", stateVersion: 4
    });
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([{ id: "b-agent-snapshot" }]);
    prisma.agentExecutionOrchestration.findFirst.mockResolvedValue({
      agentRuntimeSnapshotId: "b-agent-snapshot",
      promptExecutionPayloadId: "b-prompt-payload",
      providerRuntimeSnapshotId: "b-provider-snapshot",
      conversationRuntimeSnapshotId: "b-conversation-snapshot",
      executionPipelineSnapshotId: "b-pipeline-snapshot"
    });
    prisma.retrievalRuntimeSnapshot.findFirst.mockResolvedValue({ id: "b-retrieval-snapshot" });
    prisma.channelConfiguration.findFirst.mockResolvedValue({
      revision: 2,
      configuration: { businessAccountId: "ba", agentExecution: { taskType: "channel.message" } }
    });
    prisma.channelConfiguration.create.mockResolvedValue({});
    prisma.channelConnection.updateMany.mockResolvedValue({ count: 1 });

    const result = await repository.switchChannelAgent(
      "workspace", "actor", "agent", "connection", 4
    );

    expect(result.agentExecution.retrievalRuntimeSnapshotId).toBe("b-retrieval-snapshot");
    const written = (prisma.channelConfiguration.create as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.configuration.agentExecution.retrievalRuntimeSnapshotId).toBe(
      "b-retrieval-snapshot"
    );
  });

  it("enables the operational conversation-history flag while preserving other runtime settings", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(
      agent({
        runtimeConfiguration: {
          conversationHistory: { enabled: false },
          executionPipelineId: "pipeline-1"
        }
      })
    );
    prisma.aiAgent.update.mockResolvedValue(
      agent({
        runtimeConfiguration: {
          conversationHistory: { enabled: true },
          executionPipelineId: "pipeline-1"
        }
      })
    );

    const result = await repository.updateOperationalConversationHistory(
      "workspace", "actor", "agent", { enabled: true }
    );

    expect(result.runtimeConfiguration).toEqual({
      conversationHistory: { enabled: true },
      executionPipelineId: "pipeline-1"
    });
    const written = (prisma.aiAgent.update as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.runtimeConfiguration).toEqual({
      conversationHistory: { enabled: true },
      executionPipelineId: "pipeline-1"
    });
  });

  it("disables the operational conversation-history flag", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(
      agent({ runtimeConfiguration: { conversationHistory: { enabled: true } } })
    );
    prisma.aiAgent.update.mockResolvedValue(
      agent({ runtimeConfiguration: { conversationHistory: { enabled: false } } })
    );

    const result = await repository.updateOperationalConversationHistory(
      "workspace", "actor", "agent", { enabled: false }
    );

    expect(result.runtimeConfiguration).toEqual({ conversationHistory: { enabled: false } });
    const written = (prisma.aiAgent.update as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.runtimeConfiguration).toEqual({ conversationHistory: { enabled: false } });
  });

  it("persists Agent-scoped automatic execution pause without changing other controls", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(agent({ runtimeConfiguration: {
      conversationHistory: { enabled: true }, automaticExecution: { enabled: true }, personality: { warmth: { base: 50, intensity: 80 } }
    } }));
    prisma.aiAgent.update.mockResolvedValue(agent({ runtimeConfiguration: {
      conversationHistory: { enabled: true }, automaticExecution: { enabled: false }, personality: { warmth: { base: 50, intensity: 80 } }
    } }));
    await repository.updateOperationalAutomaticExecution("workspace", "actor", "agent", false);
    const written = (prisma.aiAgent.update as jest.Mock).mock.calls[0]![0]!.data;
    expect(written.runtimeConfiguration).toEqual({
      conversationHistory: { enabled: true }, automaticExecution: { enabled: false }, personality: { warmth: { base: 50, intensity: 80 } }
    });
  });

  it("returns the persisted conversation-history flag when reloading an Agent", async () => {
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([]);
    prisma.channelConfiguration.findMany.mockResolvedValue([]);
    prisma.aiAgent.findFirst.mockResolvedValue(
      agent({ runtimeConfiguration: { conversationHistory: { enabled: true } } })
    );

    const result = await repository.get("workspace", "agent");

    expect(result.runtimeConfiguration).toEqual({ conversationHistory: { enabled: true } });
  });

  it("rejects switching when the bound retrieval runtime has no published snapshot", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(
      agent({ status: "PUBLISHED", version: 3, knowledgeEnabled: true, retrievalRuntimeId: "runtime" })
    );
    prisma.channelConnection.findFirst.mockResolvedValue({
      id: "connection", channelId: "channel", stateVersion: 4
    });
    prisma.agentRuntimeSnapshot.findMany.mockResolvedValue([{ id: "b-agent-snapshot" }]);
    prisma.agentExecutionOrchestration.findFirst.mockResolvedValue({
      agentRuntimeSnapshotId: "b-agent-snapshot",
      promptExecutionPayloadId: "b-prompt-payload",
      providerRuntimeSnapshotId: "b-provider-snapshot",
      executionPipelineSnapshotId: "b-pipeline-snapshot"
    });
    prisma.retrievalRuntimeSnapshot.findFirst.mockResolvedValue(null);

    await expect(
      repository.switchChannelAgent("workspace", "actor", "agent", "connection", 4)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "RETRIEVAL_RUNTIME_NOT_PUBLISHED" })
    });
  });

  it("binds a retrieval runtime to a draft agent", async () => {
    prisma.aiAgent.update.mockResolvedValue(
      agent({ retrievalRuntimeId: "runtime" })
    );

    const result = await repository.bindRetrievalRuntime(
      "workspace", "actor", "agent", "runtime"
    );

    expect(prisma.aiAgent.update).toHaveBeenCalledWith({
      where: { id: "agent" },
      data: { retrievalRuntimeId: "runtime", updatedById: "actor" },
      select: expect.anything()
    });
    expect(result.retrievalRuntimeId).toBe("runtime");
  });

  it("rejects binding when the agent does not exist", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(null);

    await expect(
      repository.bindRetrievalRuntime("workspace", "actor", "agent", "runtime")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("unbinds the retrieval runtime from an agent", async () => {
    prisma.aiAgent.update.mockResolvedValue(agent({ retrievalRuntimeId: null }));

    const result = await repository.unbindRetrievalRuntime("workspace", "actor", "agent");

    expect(prisma.aiAgent.update).toHaveBeenCalledWith({
      where: { id: "agent" },
      data: { retrievalRuntimeId: null, updatedById: "actor" },
      select: expect.anything()
    });
    expect(result.retrievalRuntimeId).toBeNull();
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
