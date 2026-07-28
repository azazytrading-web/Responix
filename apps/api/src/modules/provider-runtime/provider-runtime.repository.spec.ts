/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrepareProviderRequestDto } from "./dto/provider-runtime.dto";
import { ProviderRuntimeRepository } from "./provider-runtime.repository";
import { ProviderRuntimeValidator } from "./provider-runtime.validator";

const now = new Date("2026-07-28T00:00:00.000Z");
const dto = (overrides: Partial<PrepareProviderRequestDto> = {}): PrepareProviderRequestDto => ({
  compiledPromptId: "compiled",
  agentRuntimeSnapshotId: "runtime",
  estimatedInputTokens: 1000,
  maxOutputTokens: 500,
  temperature: 0.7,
  topP: 0.9,
  ...overrides
});

describe("ProviderRuntimeRepository", () => {
  let storedRequest: Record<string, unknown> | null;
  let latestRevision: number;
  const prisma = {
    workspace: { findFirst: jest.fn() },
    agentRuntimeSnapshot: { findFirst: jest.fn() },
    compiledPrompt: { findFirst: jest.fn() },
    aiAgent: { findFirst: jest.fn() },
    aiAgentVersion: { findFirst: jest.fn() },
    promptLibraryItem: { findFirst: jest.fn() },
    promptLibraryVersion: { findFirst: jest.fn() },
    aiProviderConfiguration: { findFirst: jest.fn() },
    aiProvider: { findFirst: jest.fn() },
    aiModel: { findFirst: jest.fn() },
    executionProfile: { findFirst: jest.fn() },
    executionProfileVersion: { findFirst: jest.fn() },
    executionRequest: { findFirst: jest.fn() },
    executionRun: { findFirst: jest.fn() },
    conversation: { findFirst: jest.fn() },
    providerRuntimeRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    providerRequestSnapshot: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new ProviderRuntimeRepository(prisma as never, new ProviderRuntimeValidator());

  beforeEach(() => {
    jest.clearAllMocks();
    storedRequest = null;
    latestRevision = 0;
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace", name: "Workspace", slug: "workspace", language: "en", timezone: "UTC"
    });
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue({
      id: "runtime",
      workspaceId: "workspace",
      agentId: "agent",
      agentVersionId: "agent-version",
      providerId: "provider",
      modelId: "model",
      providerConfigurationId: "provider-configuration",
      executionProfileId: "profile",
      executionProfileVersionId: "profile-version",
      executionRequestId: "execution-request",
      executionRunId: "execution-run",
      conversationId: "conversation",
      correlationId: "correlation",
      executionId: "execution",
      traceId: "trace",
      runtimeContext: {},
      promptReferences: [],
      runtimeVariables: [],
      runtimeMetadata: {},
      executionConfiguration: { modelConfiguration: { version: "2026-01" } },
      contentHash: "runtime-hash",
      createdAt: now
    });
    prisma.compiledPrompt.findFirst.mockResolvedValue({
      id: "compiled",
      promptId: "prompt",
      promptVersionId: "prompt-version",
      agentVersionId: "agent-version",
      agentRuntimeSnapshotId: "runtime",
      executionRequestId: "execution-request",
      conversationId: "conversation",
      compilerVersion: "1.0.0",
      compiledPackage: { messages: [] },
      resolvedPrompt: { sections: {} },
      hash: "prompt-hash",
      checksum: "prompt-checksum",
      sizeBytes: 1000,
      compiledAt: now
    });
    prisma.aiAgent.findFirst.mockResolvedValue({ id: "agent", version: 2, status: "PUBLISHED" });
    prisma.aiAgentVersion.findFirst.mockResolvedValue({
      id: "agent-version", revision: 2, publishedAt: now
    });
    prisma.promptLibraryItem.findFirst.mockResolvedValue({
      id: "prompt", revision: 3, status: "PUBLISHED"
    });
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "prompt-version", revision: 3, publishedAt: now
    });
    prisma.aiProviderConfiguration.findFirst.mockResolvedValue({
      id: "provider-configuration",
      providerId: "provider",
      settings: {
        providerType: "GENERIC",
        providerVersion: "1",
        capabilities: {
          maxInputTokens: 8000,
          maxOutputTokens: 2000,
          maxStopSequences: 4
        }
      },
      updatedAt: now
    });
    prisma.aiProvider.findFirst.mockResolvedValue({
      id: "provider",
      providerName: "Generic",
      authenticationType: "API_KEY",
      status: "ACTIVE",
      updatedAt: now
    });
    prisma.aiModel.findFirst.mockResolvedValue({
      id: "model",
      providerId: "provider",
      modelName: "model-1",
      displayName: "Model 1",
      contextWindow: 10000,
      maxOutputTokens: 2000,
      supportsVision: true,
      supportsTools: true,
      supportsReasoning: false,
      supportsStreaming: false,
      supportsJson: true,
      status: "ACTIVE",
      updatedAt: now
    });
    prisma.executionProfile.findFirst.mockResolvedValue({
      id: "profile", revision: 2, metadata: {}, status: "PUBLISHED"
    });
    prisma.executionProfileVersion.findFirst.mockResolvedValue({
      id: "profile-version", revision: 2, snapshot: { policy: {} }, publishedAt: now
    });
    prisma.executionRequest.findFirst.mockResolvedValue({
      id: "execution-request",
      correlationId: "correlation",
      sourceType: "AGENT",
      sourceReferenceId: "agent",
      metadata: {},
      priority: 1
    });
    prisma.executionRun.findFirst.mockResolvedValue({ id: "execution-run" });
    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation" });
    prisma.providerRuntimeRequest.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      storedRequest = {
        id: "provider-request",
        ...data,
        latestSnapshotRevision: 0,
        validatedAt: null,
        createdAt: now,
        updatedAt: now
      };
      return storedRequest;
    });
    prisma.providerRuntimeRequest.findFirst.mockImplementation(() => Promise.resolve(storedRequest));
    prisma.providerRuntimeRequest.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        storedRequest = { ...storedRequest, ...data, updatedAt: now };
        return Promise.resolve(storedRequest);
      }
    );
    prisma.providerRuntimeRequest.findMany.mockResolvedValue([]);
    prisma.providerRuntimeRequest.count.mockResolvedValue(0);
    prisma.providerRequestSnapshot.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        id: `snapshot-${String(data.revision)}`,
        ...data,
        createdAt: now
      })
    );
    prisma.providerRequestSnapshot.findMany.mockResolvedValue([]);
    prisma.providerRequestSnapshot.count.mockResolvedValue(0);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("transactionally prepares a workspace-isolated immutable request and audit", async () => {
    const result = await repository.prepare("workspace", "actor", dto());
    expect(result).toMatchObject({
      id: "provider-request",
      workspaceId: "workspace",
      providerId: "provider",
      modelId: "model",
      status: "PREPARED"
    });
    expect(result.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.providerRuntimeRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace",
        compiledPromptId: "compiled",
        agentRuntimeSnapshotId: "runtime"
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "provider.runtime.request_prepared" })
    }));
  });

  it("validates a stable prepared request and records a transactional audit", async () => {
    await repository.prepare("workspace", "actor", dto());
    await expect(repository.validate("workspace", "actor", "provider-request"))
      .resolves.toMatchObject({ status: "VALIDATED" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "provider.runtime.validation_passed" })
    }));
  });

  it("creates versioned snapshots without updating snapshot records", async () => {
    await repository.prepare("workspace", "actor", dto());
    const first = await repository.createSnapshot("workspace", "actor", "provider-request");
    latestRevision = 1;
    storedRequest = { ...storedRequest, latestSnapshotRevision: latestRevision };
    const second = await repository.createSnapshot("workspace", "actor", "provider-request");
    expect(first).toMatchObject({ revision: 1, requestHash: storedRequest?.requestHash });
    expect(second).toMatchObject({ revision: 2 });
    expect("update" in prisma.providerRequestSnapshot).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "provider.runtime.snapshot_created" })
    }));
  });

  it("rejects archived, deleted, or cross-workspace source resolution and audits rejection", async () => {
    prisma.promptLibraryItem.findFirst.mockResolvedValueOnce(null);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "provider.runtime.configuration_rejected" })
    }));

    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValueOnce(null);
    prisma.auditLog.create.mockResolvedValue({});
    await expect(repository.prepare("other-workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects incompatible provider capabilities without persisting a request", async () => {
    await expect(repository.prepare("workspace", "actor", dto({ reasoning: true })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.providerRuntimeRequest.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("rejects source drift during revalidation", async () => {
    await repository.prepare("workspace", "actor", dto());
    prisma.aiModel.findFirst.mockResolvedValue({
      ...(await prisma.aiModel.findFirst.mock.results[0]?.value),
      displayName: "Changed Model"
    });
    await expect(repository.validate("workspace", "actor", "provider-request"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(storedRequest).toMatchObject({ status: "REJECTED" });
  });

  it("applies workspace scope to request and snapshot reads", async () => {
    storedRequest = null;
    prisma.providerRequestSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.getRequest("other-workspace", "provider-request"))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.getSnapshot("other-workspace", "snapshot"))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.providerRuntimeRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "provider-request", workspaceId: "other-workspace" }
    }));
  });

  it("filters and paginates requests and snapshots by workspace", async () => {
    await repository.listRequests("workspace", {
      page: 2, limit: 10, providerId: "provider", modelId: "model"
    });
    await repository.listSnapshots("workspace", {
      page: 3, limit: 5, requestId: "provider-request"
    });
    expect(prisma.providerRuntimeRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", providerId: "provider" }),
      skip: 10,
      take: 10
    }));
    expect(prisma.providerRequestSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", requestId: "provider-request" }),
      skip: 10,
      take: 5
    }));
  });

  it("compares immutable snapshots and rejects missing workspace records", async () => {
    const base = {
      id: "left", requestId: "request", revision: 1, providerId: "provider",
      providerVersion: "1", modelId: "model", modelVersion: "1",
      compiledPromptId: "compiled", agentRuntimeSnapshotId: "runtime",
      executionProfileVersionId: "profile-version", capabilityMetadata: {},
      requestPackage: {}, requestHash: "hash", checksum: "checksum", createdAt: now
    };
    prisma.providerRequestSnapshot.findFirst
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, id: "right", revision: 2 });
    await expect(repository.compareSnapshots("workspace", "left", "right"))
      .resolves.toMatchObject({ identical: true });

    prisma.providerRequestSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.compareSnapshots("workspace", "left", "missing"))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("propagates transaction failures without partial success", async () => {
    prisma.providerRuntimeRequest.create.mockRejectedValueOnce(new Error("transaction failed"));
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toThrow("transaction failed");
  });
});
