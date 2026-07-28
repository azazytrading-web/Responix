/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { RuntimeOrchestrationRepository } from "./runtime-orchestration.repository";
import { RuntimeOrchestrationValidator } from "./runtime-orchestration.validator";

const now = new Date();
const queue = { id: "queue", workspaceId: "workspace", name: "Default", slug: "default", description: null, metadata: {}, createdAt: now, updatedAt: now };
const priority = { id: "priority", workspaceId: "workspace", name: "High", slug: "high", value: 900, description: null, metadata: {}, createdAt: now, updatedAt: now };
const tag = { id: "tag", workspaceId: "workspace", name: "Critical", slug: "critical", metadata: {}, createdAt: now, updatedAt: now };
const profile = (overrides: Record<string, unknown> = {}) => ({
  id: "profile", workspaceId: "workspace", queueDefinitionId: "queue", priorityLevelId: "priority",
  name: "Production", slug: "production", description: "Production metadata",
  status: "DRAFT", visibility: "WORKSPACE", revision: 0, metadata: { environment: "production" },
  createdById: "actor", updatedById: "actor", createdAt: now, updatedAt: now,
  publishedAt: null, archivedAt: null, deletedAt: null,
  policy: { id: "policy-id", profileId: "profile", config: { approval: true }, metadata: {}, createdAt: now, updatedAt: now },
  limits: { id: "limit-id", profileId: "profile", maxSteps: 100, maxTokens: 10000, maxCostMinor: 500, maxPayloadBytes: 100000, metadata: {}, createdAt: now, updatedAt: now },
  timeouts: { id: "timeout-id", profileId: "profile", totalMs: 30000, stepMs: 5000, idleMs: 10000, metadata: {}, createdAt: now, updatedAt: now },
  retryPolicy: { id: "retry-id", profileId: "profile", maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, multiplier: 2, jitter: true, retryOn: ["TEMPORARY"], metadata: {}, createdAt: now, updatedAt: now },
  failurePolicy: { id: "failure-id", profileId: "profile", strategy: "STOP", config: {}, metadata: {}, createdAt: now, updatedAt: now },
  fallbackPolicy: null,
  concurrency: { id: "concurrency-id", profileId: "profile", maxParallel: 5, maxQueued: 100, strategy: "QUEUE", keyTemplate: null, metadata: {}, createdAt: now, updatedAt: now },
  contexts: [{ id: "context-id", profileId: "profile", name: "tenant", schema: { type: "object" }, value: { region: "eu" }, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  variables: [{ id: "variable-id", profileId: "profile", name: "attempt", schema: { type: "number" }, defaultValue: 0, required: false, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  inputs: [{ id: "input-id", profileId: "profile", name: "payload", schema: { type: "object" }, required: true, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  outputs: [{ id: "output-id", profileId: "profile", name: "result", schema: { type: "object" }, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  bindings: [{ id: "binding-id", profileId: "profile", key: "workspace", targetType: "WORKSPACE", referenceId: "workspace", required: true, config: {}, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  dependencies: [],
  labels: [{ id: "label-id", profileId: "profile", name: "Production", color: "#3366FF", metadata: {}, createdAt: now, updatedAt: now }],
  tagLinks: [{ tag }],
  notes: [{ id: "note-id", profileId: "profile", content: "Metadata only", metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  ...overrides
});

describe("RuntimeOrchestrationRepository", () => {
  const prisma = {
    queueDefinition: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    executionPriorityLevel: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    executionTag: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    executionTagAssignment: { count: jest.fn() },
    executionProfile: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    executionProfileVersion: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    executionPolicy: { deleteMany: jest.fn() }, executionLimit: { deleteMany: jest.fn() },
    executionTimeout: { deleteMany: jest.fn() }, executionRetryPolicy: { deleteMany: jest.fn() },
    executionFailurePolicy: { deleteMany: jest.fn() }, executionFallbackPolicy: { deleteMany: jest.fn() },
    executionConcurrencyPolicy: { deleteMany: jest.fn() },
    workflow: { findMany: jest.fn() }, aiAgent: { findMany: jest.fn() },
    promptLibraryItem: { findMany: jest.fn() }, knowledgeDocument: { findMany: jest.fn() },
    toolDefinition: { findMany: jest.fn() }, aiProviderConfiguration: { findMany: jest.fn() },
    auditLog: { create: jest.fn() }, $transaction: jest.fn()
  };
  const repository = new RuntimeOrchestrationRepository(prisma as never, new RuntimeOrchestrationValidator());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.queueDefinition.findFirst.mockResolvedValue(queue);
    prisma.executionPriorityLevel.findFirst.mockResolvedValue(priority);
    prisma.executionTag.findFirst.mockResolvedValue(tag);
    prisma.executionTag.count.mockResolvedValue(1);
    prisma.executionProfile.findFirst.mockImplementation((args: { where?: { name?: unknown } }) =>
      Promise.resolve(args.where?.name ? null : profile())
    );
    prisma.executionProfile.create.mockResolvedValue(profile());
    prisma.executionProfile.update.mockResolvedValue(profile());
    prisma.auditLog.create.mockResolvedValue({});
    for (const repository of [
      prisma.workflow, prisma.aiAgent, prisma.promptLibraryItem,
      prisma.knowledgeDocument, prisma.toolDefinition, prisma.aiProviderConfiguration
    ]) repository.findMany.mockResolvedValue([]);
  });

  it("creates normalized policies and orchestration metadata atomically", async () => {
    await repository.create("workspace", "actor", draft());
    expect(prisma.executionProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace", status: "DRAFT", revision: 0,
        policy: { create: expect.objectContaining({ config: { approval: true } }) },
        timeouts: { create: expect.objectContaining({ totalMs: 30000 }) },
        retryPolicy: { create: expect.objectContaining({ maxAttempts: 3 }) },
        concurrency: { create: expect.objectContaining({ maxParallel: 5 }) },
        bindings: { create: [expect.objectContaining({ key: "workspace", targetType: "WORKSPACE" })] },
        tagLinks: { create: [{ tagId: "tag" }] }
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "runtime.orchestration.profile.created", workspaceId: "workspace" })
    }));
  });

  it("rejects duplicate names case-insensitively", async () => {
    prisma.executionProfile.findFirst.mockImplementation((args: { where?: { name?: unknown } }) =>
      Promise.resolve(args.where?.name ? { id: "duplicate" } : profile())
    );
    await expect(repository.create("workspace", "actor", draft())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.executionProfile.create).not.toHaveBeenCalled();
  });

  it("rejects circular dependencies and cross-workspace bindings", async () => {
    const circular = draft();
    circular.bindings.push({
      key: "second", targetType: "WORKSPACE" as const, referenceId: "workspace"
    });
    circular.dependencies = [
      { bindingKey: "workspace", dependsOnBindingKey: "second" },
      { bindingKey: "second", dependsOnBindingKey: "workspace" }
    ];
    await expect(repository.create("workspace", "actor", circular)).rejects.toBeInstanceOf(BadRequestException);

    const external = draft();
    external.bindings = [{
      key: "workflow", targetType: "WORKFLOW" as const,
      referenceId: "11111111-1111-4111-8111-111111111111"
    }] as never;
    await expect(repository.create("workspace", "actor", external)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflow.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", deletedAt: null })
    }));
  });

  it("enforces draft-only editing and tenant-isolated lookup", async () => {
    prisma.executionProfile.findFirst.mockResolvedValueOnce(profile({ status: "PUBLISHED", revision: 1 }));
    await expect(repository.updateDraft("workspace", "actor", "profile", { description: "Changed" }))
      .rejects.toBeInstanceOf(BadRequestException);
    prisma.executionProfile.findFirst.mockResolvedValueOnce(null);
    await expect(repository.get("other", "profile")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("publishes an immutable complete snapshot", async () => {
    prisma.executionProfileVersion.create.mockResolvedValue({ id: "version", profileId: "profile", revision: 1 });
    prisma.executionProfile.update.mockResolvedValue(profile({ status: "PUBLISHED", revision: 1 }));
    await repository.publish("workspace", "actor", "profile", "Ready");
    expect(prisma.executionProfileVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        profileId: "profile", revision: 1, changeSummary: "Ready",
        snapshot: expect.objectContaining({
          retryPolicy: expect.objectContaining({ maxAttempts: 3 }),
          concurrencyPolicy: expect.objectContaining({ maxParallel: 5 }),
          bindings: [expect.objectContaining({ key: "workspace" })],
          tagIds: ["tag"]
        })
      })
    }));
  });

  it("rollback creates a new published revision and replaces all metadata", async () => {
    prisma.executionProfile.findFirst
      .mockResolvedValueOnce(profile({ status: "PUBLISHED", revision: 2 }))
      .mockResolvedValueOnce(null);
    prisma.executionProfileVersion.findFirst.mockResolvedValue({
      id: "source", profileId: "profile", revision: 1, snapshot: snapshot()
    });
    prisma.executionProfileVersion.create.mockResolvedValue({ id: "new", revision: 3 });
    await repository.rollback("workspace", "actor", "profile", 1);
    expect(prisma.executionProfileVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 3, changeSummary: "Rollback to revision 1" })
    }));
    expect(prisma.executionPolicy.deleteMany).toHaveBeenCalledWith({ where: { profileId: "profile" } });
    expect(prisma.executionProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PUBLISHED", revision: 3,
        bindings: expect.objectContaining({ deleteMany: {} }),
        dependencies: expect.objectContaining({ deleteMany: {} }),
        tagLinks: expect.objectContaining({ deleteMany: {} })
      })
    }));
  });

  it("clone creates independent child records without version history", async () => {
    prisma.executionProfile.create.mockResolvedValue(profile({ id: "clone", name: "Copy", slug: "copy" }));
    await repository.clone("workspace", "actor", "profile", "Copy", "copy");
    expect(prisma.executionProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Copy", slug: "copy", status: "DRAFT", revision: 0,
        bindings: { create: [expect.not.objectContaining({ id: "binding-id" })] },
        contexts: { create: [expect.not.objectContaining({ id: "context-id" })] }
      })
    }));
    expect(prisma.executionProfileVersion.create).not.toHaveBeenCalled();
  });

  it("archives, restores, and soft-deletes without deleting history", async () => {
    prisma.executionProfile.findFirst
      .mockResolvedValueOnce(profile({ status: "PUBLISHED", revision: 2 }))
      .mockResolvedValueOnce(profile({ status: "ARCHIVED", revision: 2, archivedAt: now }))
      .mockResolvedValueOnce(profile({ status: "PUBLISHED", revision: 2 }));
    await repository.archive("workspace", "actor", "profile");
    await repository.restore("workspace", "actor", "profile");
    await repository.softDelete("workspace", "actor", "profile");
    expect(prisma.executionProfile.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ status: "ARCHIVED" })
    }));
    expect(prisma.executionProfile.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ status: "PUBLISHED", deletedAt: null })
    }));
    expect(prisma.executionProfile.update).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: expect.objectContaining({ deletedAt: expect.any(Date) })
    }));
  });

  it("protects metadata in use and propagates transactional audit failures", async () => {
    prisma.executionProfile.count.mockResolvedValueOnce(1);
    await expect(repository.deleteQueue("workspace", "actor", "queue")).rejects.toBeInstanceOf(ConflictException);
    prisma.executionTagAssignment.count.mockResolvedValueOnce(1);
    await expect(repository.deleteTag("workspace", "actor", "tag")).rejects.toBeInstanceOf(ConflictException);
    const failure = new Error("audit unavailable");
    prisma.auditLog.create.mockRejectedValueOnce(failure);
    await expect(repository.archive("workspace", "actor", "profile")).rejects.toBe(failure);
  });

  it("enforces priority ranges at the repository boundary", () => {
    expect(() => repository.createPriority("workspace", "actor", {
      name: "Invalid", slug: "invalid", value: 1001
    })).toThrow(BadRequestException);
    expect(prisma.executionPriorityLevel.create).not.toHaveBeenCalled();
  });
});

function draft() {
  return {
    name: "Production", slug: "production", description: "Production metadata",
    queueDefinitionId: "queue", priorityLevelId: "priority", metadata: { environment: "production" },
    policy: { config: { approval: true } }, limits: { maxSteps: 100, maxTokens: 10000 },
    timeouts: { totalMs: 30000, stepMs: 5000, idleMs: 10000 },
    retryPolicy: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, multiplier: 2, retryOn: ["TEMPORARY"] },
    failurePolicy: { strategy: "STOP" },
    concurrencyPolicy: { maxParallel: 5, maxQueued: 100, strategy: "QUEUE" },
    contexts: [{ name: "tenant", schema: { type: "object" }, value: { region: "eu" } }],
    variables: [{ name: "attempt", schema: { type: "number" }, defaultValue: 0 }],
    inputs: [{ name: "payload", schema: { type: "object" }, required: true }],
    outputs: [{ name: "result", schema: { type: "object" } }],
    bindings: [{ key: "workspace", targetType: "WORKSPACE" as const, referenceId: "workspace" }],
    dependencies: [] as Array<{ bindingKey: string; dependsOnBindingKey: string }>,
    labels: [{ name: "Production", color: "#3366FF" }], tagIds: ["tag"],
    notes: [{ content: "Metadata only" }]
  };
}

function snapshot() {
  return {
    queueDefinitionId: "queue", priorityLevelId: "priority", name: "Production",
    slug: "production", description: "Production metadata", visibility: "WORKSPACE",
    metadata: { environment: "production" }, policy: { config: { approval: true }, metadata: {} },
    limits: { maxSteps: 100, maxTokens: 10000, metadata: {} },
    timeouts: { totalMs: 30000, stepMs: 5000, idleMs: 10000, metadata: {} },
    retryPolicy: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, multiplier: 2, jitter: false, retryOn: ["TEMPORARY"], metadata: {} },
    failurePolicy: { strategy: "STOP", config: {}, metadata: {} },
    concurrencyPolicy: { maxParallel: 5, maxQueued: 100, strategy: "QUEUE", metadata: {} },
    contexts: [{ name: "tenant", schema: { type: "object" }, value: { region: "eu" }, metadata: {}, sortOrder: 0 }],
    variables: [{ name: "attempt", schema: { type: "number" }, defaultValue: 0, required: false, metadata: {}, sortOrder: 0 }],
    inputs: [{ name: "payload", schema: { type: "object" }, required: true, metadata: {}, sortOrder: 0 }],
    outputs: [{ name: "result", schema: { type: "object" }, metadata: {}, sortOrder: 0 }],
    bindings: [{ key: "workspace", targetType: "WORKSPACE", referenceId: "workspace", required: true, config: {}, metadata: {}, sortOrder: 0 }],
    dependencies: [], labels: [{ name: "Production", color: "#3366FF", metadata: {} }],
    tagIds: ["tag"], notes: [{ content: "Metadata only", metadata: {}, sortOrder: 0 }]
  };
}
