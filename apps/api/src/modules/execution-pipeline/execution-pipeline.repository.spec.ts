/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ExecutionPipelineStatus } from "@prisma/client";
import type { CreateExecutionPipelineDto } from "./dto/execution-pipeline.dto";
import { PipelineAssetType, PipelineVariableType } from "./dto/execution-pipeline.dto";
import { ExecutionPipelineRepository } from "./execution-pipeline.repository";
import { ExecutionPipelineValidator } from "./execution-pipeline.validator";

const now = new Date("2026-07-30T00:00:00.000Z");
const dto = (overrides: Partial<CreateExecutionPipelineDto> = {}): CreateExecutionPipelineDto => ({
  name: "Pipeline", compatibilityVersion: "1.0.0",
  nodes: [
    { nodeKey: "start", stage: "START", ordinal: 0 },
    { nodeKey: "agent", stage: "AGENT", ordinal: 1,
      assetType: PipelineAssetType.AGENT_RUNTIME, assetId: "agent-snapshot" }
  ],
  dependencies: [{ dependencyKey: "edge", fromNodeKey: "start", toNodeKey: "agent" }],
  variables: [{ name: "customer", type: PipelineVariableType.STRING, value: "Ada" }],
  ...overrides
});

describe("ExecutionPipelineRepository", () => {
  let stored: Record<string, unknown> | null;
  let sequence: number;
  const prisma = {
    executionRequest: { findFirst: jest.fn() },
    agentRuntimeSnapshot: { findFirst: jest.fn() },
    compiledPrompt: { findFirst: jest.fn() },
    providerRequestSnapshot: { findFirst: jest.fn() },
    retrievalRuntimeSnapshot: { findFirst: jest.fn() },
    conversationRuntimeSnapshot: { findFirst: jest.fn() },
    workflowVersion: { findFirst: jest.fn() },
    executionProfileVersion: { findFirst: jest.fn() },
    executionPipeline: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn()
    },
    executionPipelineSnapshot: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn()
    },
    executionPipelineRevision: { create: jest.fn(), findFirst: jest.fn() },
    pipelineNode: { deleteMany: jest.fn(), createMany: jest.fn() },
    pipelineDependency: { deleteMany: jest.fn(), createMany: jest.fn() },
    pipelineVariable: { deleteMany: jest.fn(), createMany: jest.fn() },
    pipelineMetadata: { deleteMany: jest.fn(), createMany: jest.fn() },
    pipelineLabel: { deleteMany: jest.fn(), createMany: jest.fn() },
    pipelineTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    pipelineDiagnostic: { deleteMany: jest.fn() },
    pipelineValidation: { deleteMany: jest.fn(), create: jest.fn() },
    pipelineAudit: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new ExecutionPipelineRepository(prisma as never, new ExecutionPipelineValidator());
  beforeEach(() => {
    jest.clearAllMocks(); stored = null; sequence = 0;
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      const before = stored;
      try { return await (input as (tx: typeof prisma) => Promise<unknown>)(prisma); }
      catch (error) { stored = before; throw error; }
    });
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue({ id: "agent-snapshot", contentHash: "hash" });
    prisma.executionPipeline.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      sequence += 1;
      stored = {
        id: `pipeline-${sequence}`, ...data, status: "DRAFT", revision: 0,
        publishedAt: null, archivedAt: null, deletedAt: null, createdAt: now, updatedAt: now,
        nodes: [], dependencies: [], validations: [], audits: [], metadataItems: [],
        labels: [], tags: [], variables: [], diagnostics: [], revisions: []
      };
      return Promise.resolve(stored);
    });
    prisma.executionPipeline.findFirst.mockImplementation(() => Promise.resolve(stored));
    prisma.executionPipeline.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      stored = { ...stored, ...data, updatedAt: now }; return Promise.resolve(stored);
    });
    prisma.executionPipeline.findMany.mockResolvedValue([]);
    prisma.executionPipeline.count.mockResolvedValue(0);
    prisma.executionPipelineSnapshot.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        id: `snapshot-${String(data.revision)}`, ...data, createdAt: now
      })
    );
    prisma.executionPipelineSnapshot.findMany.mockResolvedValue([]);
    prisma.executionPipelineSnapshot.count.mockResolvedValue(0);
    prisma.executionPipelineRevision.create.mockResolvedValue({});
    prisma.executionPipelineRevision.findFirst.mockResolvedValue({
      id: "revision-1", revision: 1, plan: {
        input: dto({ nodes: [{ nodeKey: "start", stage: "START", ordinal: 0 }] })
      }, planHash: "old-hash", checksum: "old-checksum"
    });
    prisma.pipelineAudit.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.pipelineValidation.create.mockResolvedValue({});
  });
  it("creates normalized workspace pipeline metadata transactionally", async () => {
    const result = await repository.create("workspace", "actor", dto());
    expect(result).toMatchObject({ id: "pipeline-1", workspaceId: "workspace", status: "DRAFT" });
    expect(result.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.pipelineAudit.create).toHaveBeenCalled();
  });
  it("rejects wrong-workspace or unpublished assets and audits rejection", async () => {
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValueOnce(null);
    await expect(repository.create("other", "actor", dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.executionPipeline.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "execution.pipeline.rejected" })
    }));
  });
  it("publishes immutable snapshot and revision records", async () => {
    await repository.create("workspace", "actor", dto());
    const snapshot = await repository.publish("workspace", "actor", "pipeline-1");
    expect(snapshot).toMatchObject({ revision: 1 });
    expect(prisma.executionPipelineRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 1 })
    }));
    expect("update" in prisma.executionPipelineSnapshot).toBe(false);
  });
  it("prevents editing published revisions", async () => {
    await repository.create("workspace", "actor", dto());
    stored = { ...stored, status: ExecutionPipelineStatus.PUBLISHED, revision: 1 };
    await expect(repository.update("workspace", "actor", "pipeline-1", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  it("rolls back by creating a new published revision", async () => {
    await repository.create("workspace", "actor", dto());
    stored = { ...stored, status: "PUBLISHED", revision: 2 };
    const result = await repository.rollback("workspace", "actor", "pipeline-1", "revision-1");
    expect(result).toMatchObject({ revision: 3, planHash: "old-hash" });
    expect(prisma.executionPipelineRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 3, sourceRevision: 1 })
    }));
  });
  it("clones with fresh parent and nested identities", async () => {
    const original = await repository.create("workspace", "actor", dto());
    const clone = await repository.clone("workspace", "actor", original.id, { name: "Clone" });
    expect(clone).toMatchObject({ id: "pipeline-2", name: "Clone", clonedFromId: "pipeline-1" });
    expect(clone.id).not.toBe(original.id);
  });
  it("archives, restores, and soft deletes without deleting snapshots", async () => {
    await repository.create("workspace", "actor", dto());
    await expect(repository.archive("workspace", "actor", "pipeline-1"))
      .resolves.toMatchObject({ status: "ARCHIVED" });
    await expect(repository.restore("workspace", "actor", "pipeline-1"))
      .resolves.toMatchObject({ status: "DRAFT" });
    await expect(repository.softDelete("workspace", "actor", "pipeline-1"))
      .resolves.toMatchObject({ status: "DELETED" });
    expect(prisma.executionPipelineSnapshot.create).not.toHaveBeenCalled();
  });
  it("rolls back the transaction when audit persistence fails", async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(repository.create("workspace", "actor", dto())).rejects.toThrow("audit failed");
    expect(stored).toBeNull();
  });
  it("isolates get and list queries by workspace", async () => {
    await expect(repository.get("workspace", "missing")).rejects.toBeInstanceOf(NotFoundException);
    await repository.list("workspace", { page: 2, limit: 10, search: "Pipe" });
    expect(prisma.executionPipeline.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace" }), skip: 10, take: 10
    }));
  });
  it("compares immutable snapshot hashes and normalized sections", async () => {
    prisma.executionPipelineSnapshot.findFirst
      .mockResolvedValueOnce({
        id: "left", pipelineId: "pipeline", revision: 1, snapshot: { nodes: [] },
        planHash: "same", checksum: "same", createdAt: now
      })
      .mockResolvedValueOnce({
        id: "right", pipelineId: "pipeline", revision: 2, snapshot: { nodes: [] },
        planHash: "same", checksum: "same", createdAt: now
      });
    await expect(repository.compare("workspace", "left", "right"))
      .resolves.toMatchObject({ identical: true, changed: { nodes: false } });
  });
});
