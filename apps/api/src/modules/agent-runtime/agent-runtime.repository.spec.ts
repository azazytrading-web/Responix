/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import { AgentRuntimeRepository } from "./agent-runtime.repository";
import { AgentRuntimeValidator } from "./agent-runtime.validator";
import type { PrepareAgentRuntimeDto } from "./dto/agent-runtime.dto";

const now = new Date("2026-01-01T00:00:00.000Z");
const dto = (overrides: Partial<PrepareAgentRuntimeDto> = {}): PrepareAgentRuntimeDto => ({
  agentId: "agent",
  executionProfileId: "profile",
  executionRequestId: "request",
  context: { traceId: "trace-1" },
  ...overrides
});
const agentSnapshot = (overrides: Record<string, unknown> = {}) => ({
  name: "Published agent",
  providerId: "provider",
  modelId: "model",
  providerConfigurationId: "provider-configuration",
  providerConfiguration: {},
  modelConfiguration: {},
  runtimeConfiguration: {},
  temperature: 0.7,
  topP: 1,
  maxTokens: 1000,
  stopSequences: [],
  streamingEnabled: false,
  timeoutMs: 30000,
  retryPolicy: {},
  fallbackStrategy: {},
  capabilities: {},
  promptBindings: [],
  ...overrides
});
const runtime = (overrides: Record<string, unknown> = {}) => ({
  id: "runtime",
  workspaceId: "workspace",
  actorId: "actor",
  agentId: "agent",
  agentVersionId: "agent-version",
  providerId: "provider",
  modelId: "model",
  providerConfigurationId: "provider-configuration",
  executionProfileId: "profile",
  executionProfileVersionId: "profile-version",
  executionRequestId: "request",
  executionRunId: null,
  conversationId: null,
  status: "PREPARED",
  locale: "en",
  timezone: "UTC",
  correlationId: "correlation",
  executionId: "request",
  traceId: "trace-1",
  preparationInput: dto(),
  runtimeContext: {},
  promptStructure: {},
  runtimeVariables: [],
  validationResult: { valid: true, issues: [] },
  executionConfiguration: {},
  runtimeMetadata: {},
  createdAt: now,
  updatedAt: now,
  validatedAt: null,
  ...overrides
});

describe("AgentRuntimeRepository", () => {
  const prisma = {
    workspace: { findFirst: jest.fn() },
    executionRequest: { findFirst: jest.fn() },
    executionRun: { findFirst: jest.fn() },
    aiAgent: { findFirst: jest.fn() },
    aiAgentVersion: { findFirst: jest.fn() },
    aiProviderConfiguration: { findFirst: jest.fn() },
    aiModel: { findFirst: jest.fn() },
    executionProfile: { findFirst: jest.fn() },
    executionProfileVersion: { findFirst: jest.fn() },
    conversation: { findFirst: jest.fn() },
    promptLibraryItem: { findFirst: jest.fn() },
    promptLibraryVersion: { findFirst: jest.fn() },
    agentRuntimePreparation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    agentRuntimeSnapshot: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new AgentRuntimeRepository(
    prisma as never,
    new AgentRuntimeValidator()
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace",
      language: "en",
      timezone: "UTC",
      status: "ACTIVE"
    });
    prisma.executionRequest.findFirst.mockResolvedValue({
      id: "request",
      workspaceId: "workspace",
      requestedById: "actor",
      correlationId: "correlation",
      metadata: {}
    });
    prisma.executionRun.findFirst.mockResolvedValue({ id: "run" });
    prisma.aiAgent.findFirst.mockResolvedValue({ id: "agent" });
    prisma.aiAgentVersion.findFirst.mockResolvedValue({
      id: "agent-version",
      revision: 3,
      snapshot: agentSnapshot(),
      publishedAt: now
    });
    prisma.aiProviderConfiguration.findFirst.mockResolvedValue({
      id: "provider-configuration",
      settings: {}
    });
    prisma.aiModel.findFirst.mockResolvedValue({
      id: "model",
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsAudio: true,
      supportsTools: true,
      supportsReasoning: true,
      supportsStreaming: true
    });
    prisma.executionProfile.findFirst.mockResolvedValue({ id: "profile" });
    prisma.executionProfileVersion.findFirst.mockResolvedValue({
      id: "profile-version",
      revision: 2,
      snapshot: {}
    });
    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation" });
    prisma.promptLibraryItem.findFirst.mockResolvedValue({
      id: "prompt",
      name: "Prompt",
      metadata: {}
    });
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "prompt-version",
      revision: 1,
      snapshot: { draft: { content: "Prepared only" }, variables: [], metadata: {} },
      publishedAt: now
    });
    prisma.agentRuntimePreparation.create.mockResolvedValue(runtime());
    prisma.agentRuntimePreparation.findFirst.mockResolvedValue(runtime());
    prisma.agentRuntimePreparation.update.mockResolvedValue(runtime({ status: "VALIDATED" }));
    prisma.agentRuntimePreparation.findMany.mockResolvedValue([runtime()]);
    prisma.agentRuntimePreparation.count.mockResolvedValue(1);
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue(null);
    prisma.agentRuntimeSnapshot.create.mockResolvedValue({
      id: "snapshot",
      workspaceId: "workspace",
      runtimeId: "runtime",
      contentHash: "hash",
      createdAt: now
    });
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("transactionally prepares a resolved runtime and conversation metadata", async () => {
    await expect(repository.prepare("workspace", "actor", dto()))
      .resolves.toMatchObject({ id: "runtime", workspaceId: "workspace" });
    expect(prisma.agentRuntimePreparation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace",
          actorId: "actor",
          agentVersionId: "agent-version",
          executionProfileVersionId: "profile-version",
          conversationContext: { create: expect.any(Object) }
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "agent.runtime.prepared" })
    }));
  });

  it("rejects archived, deleted, or wrong-workspace agents and audits rejection", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(null);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiAgent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "workspace",
        status: "PUBLISHED",
        archivedAt: null,
        deletedAt: null
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "agent.runtime.configuration_rejected"
      })
    }));
  });

  it("rejects deleted or unpublished prompts selected by a published agent version", async () => {
    prisma.aiAgentVersion.findFirst.mockResolvedValue({
      id: "agent-version",
      revision: 3,
      publishedAt: now,
      snapshot: agentSnapshot({
        promptBindings: [{
          role: "SYSTEM",
          promptId: "prompt",
          promptVersionId: "prompt-version",
          variableMetadata: [],
          metadata: {}
        }]
      })
    });
    prisma.promptLibraryItem.findFirst.mockResolvedValue(null);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects missing required prompt variables", async () => {
    prisma.aiAgentVersion.findFirst.mockResolvedValue({
      id: "agent-version",
      revision: 3,
      publishedAt: now,
      snapshot: agentSnapshot({
        promptBindings: [{
          role: "USER_TEMPLATE",
          promptId: "prompt",
          promptVersionId: "prompt-version",
          variableMetadata: [],
          metadata: {}
        }]
      })
    });
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "prompt-version",
      revision: 1,
      publishedAt: now,
      snapshot: {
        draft: {},
        variables: [{ name: "customerName", type: "STRING", required: true }],
        metadata: {}
      }
    });
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toMatchObject({
        response: expect.objectContaining({
          validation: expect.objectContaining({ valid: false })
        })
      });
  });

  it("validates execution request, run, conversation, and parent execution ownership", async () => {
    prisma.executionRequest.findFirst.mockResolvedValue(null);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);

    prisma.executionRequest.findFirst.mockResolvedValue({
      id: "request",
      workspaceId: "workspace",
      requestedById: "actor",
      correlationId: "correlation",
      metadata: {}
    });
    prisma.executionRun.findFirst.mockResolvedValue(null);
    await expect(repository.prepare("workspace", "actor", dto({
      executionRunId: "run"
    }))).rejects.toBeInstanceOf(BadRequestException);

    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(repository.prepare("workspace", "actor", dto({
      conversation: { conversationId: "conversation" }
    }))).rejects.toBeInstanceOf(BadRequestException);

    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation" });
    await expect(repository.prepare("workspace", "actor", dto({
      conversation: { parentExecutionRunId: "parent-run" }
    }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists structured failed validation when readiness changes", async () => {
    prisma.aiAgent.findFirst.mockResolvedValue(null);
    const result = await repository.validate("workspace", "actor", "runtime");
    expect(result.validation).toMatchObject({ valid: false });
    expect(prisma.agentRuntimePreparation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "agent.runtime.validation_failed" })
    }));
  });

  it("creates one immutable, content-addressed runtime snapshot", async () => {
    await expect(repository.createSnapshot("workspace", "actor", "runtime"))
      .resolves.toMatchObject({ id: "snapshot" });
    expect(prisma.agentRuntimeSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          runtimeId: "runtime",
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "agent.runtime.snapshot_created" })
    }));

    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue({
      id: "snapshot",
      workspaceId: "workspace"
    });
    await expect(repository.createSnapshot("workspace", "actor", "runtime"))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it("isolates runtime and snapshot reads by workspace", async () => {
    prisma.agentRuntimePreparation.findFirst.mockResolvedValue(null);
    await expect(repository.get("other-workspace", "runtime"))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.agentRuntimePreparation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "runtime", workspaceId: "other-workspace" }
      })
    );

    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.getSnapshot("other-workspace", "snapshot"))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("paginates and filters runtime history within the workspace", async () => {
    const result = await repository.list("workspace", {
      page: 2,
      limit: 10,
      status: "VALIDATED",
      agentId: "agent"
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1
    });
    expect(prisma.agentRuntimePreparation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace",
          status: "VALIDATED",
          agentId: "agent"
        }),
        skip: 10,
        take: 10
      })
    );
  });

  it("rolls back runtime persistence when transactional audit fails", async () => {
    prisma.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toThrow("audit unavailable");
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
