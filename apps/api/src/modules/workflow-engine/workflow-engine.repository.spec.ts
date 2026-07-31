/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { WorkflowEngineRepository } from "./workflow-engine.repository";
import { WorkflowGraphValidator } from "./workflow-graph.validator";

const now = new Date();
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` :
  value && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}` : JSON.stringify(value) ?? "null";
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const category = {
  id: "category", workspaceId: "workspace", name: "Operations", slug: "operations",
  description: null, metadata: {}, createdAt: now, updatedAt: now
};
const tag = {
  id: "tag", workspaceId: "workspace", name: "Critical", slug: "critical",
  metadata: {}, createdAt: now, updatedAt: now
};
const baseGraph = {
  nodes: [
    { id: "start", type: "START" as const },
    { id: "end", type: "END" as const }
  ],
  edges: [{ id: "route", sourceNodeId: "start", targetNodeId: "end" }],
  conditions: [],
  branches: []
};
const workflow = (overrides: Record<string, unknown> = {}) => ({
  id: "workflow", workspaceId: "workspace", categoryId: "category",
  name: "Routing", slug: "routing", description: "Routes work", version: 0,
  status: "DRAFT", visibility: "WORKSPACE", triggerType: "MANUAL",
  workflowJson: baseGraph, metadata: { owner: "ops" }, publishedAt: null,
  createdById: "actor", updatedById: "actor", createdAt: now, updatedAt: now,
  archivedAt: null, deletedAt: null,
  variables: [{
    id: "variable-id", workflowId: "workflow", name: "attempt", schema: { type: "number" },
    defaultValue: 0, required: false, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now
  }],
  parameters: [],
  inputs: [{
    id: "input-id", workflowId: "workflow", name: "payload", schema: { type: "object" },
    required: true, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now
  }],
  outputs: [{
    id: "output-id", workflowId: "workflow", name: "result", schema: { type: "object" },
    metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now
  }],
  nodes: [
    { id: "node-db-1", workflowId: "workflow", nodeKey: "start", type: "START", name: null, referenceId: null, configuration: {}, position: {}, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now },
    { id: "node-db-2", workflowId: "workflow", nodeKey: "end", type: "END", name: null, referenceId: null, configuration: {}, position: {}, metadata: {}, sortOrder: 1, createdAt: now, updatedAt: now }
  ],
  edges: [
    { id: "edge-db", workflowId: "workflow", edgeKey: "route", sourceNodeKey: "start", targetNodeKey: "end", label: null, metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }
  ],
  conditions: [],
  branches: [],
  labels: [{ id: "label-id", workflowId: "workflow", name: "Ops", color: "#3366FF", metadata: {}, createdAt: now, updatedAt: now }],
  tagLinks: [{ tag }],
  notes: [{ id: "note-id", workflowId: "workflow", content: "Review", metadata: {}, sortOrder: 0, createdAt: now, updatedAt: now }],
  permissions: [{ id: "workflow-permission-id", workflowId: "workflow", permissionCode: "crm.view", metadata: {}, createdAt: now, updatedAt: now }],
  ...overrides
});

describe("WorkflowEngineRepository", () => {
  const prisma = {
    workflowCategory: {
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      findFirst: jest.fn(), findMany: jest.fn()
    },
    workflowTag: {
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn()
    },
    workflowTagAssignment: { count: jest.fn() },
    workflow: {
      create: jest.fn(), update: jest.fn(), findFirst: jest.fn(),
      findMany: jest.fn(), count: jest.fn()
    },
    workflowVersion: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    permission: { count: jest.fn() },
    aiAgent: { findMany: jest.fn() },
    promptLibraryItem: { findMany: jest.fn() },
    knowledgeDocument: { findMany: jest.fn() },
    toolDefinition: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new WorkflowEngineRepository(prisma as never, new WorkflowGraphValidator());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.workflowCategory.findFirst.mockResolvedValue(category);
    prisma.workflowTag.findFirst.mockResolvedValue(tag);
    prisma.workflowTag.count.mockResolvedValue(1);
    prisma.workflow.findFirst.mockResolvedValue(workflow());
    prisma.workflow.create.mockResolvedValue(workflow());
    prisma.workflow.update.mockResolvedValue(workflow());
    prisma.permission.count.mockResolvedValue(1);
    prisma.aiAgent.findMany.mockResolvedValue([]);
    prisma.promptLibraryItem.findMany.mockResolvedValue([]);
    prisma.knowledgeDocument.findMany.mockResolvedValue([]);
    prisma.toolDefinition.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("creates normalized topology, metadata, tags, and an audit event atomically", async () => {
    await repository.create("workspace", "actor", draft());
    expect(prisma.workflow.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace", categoryId: "category", status: "DRAFT", version: 0,
        nodes: { create: [
          expect.objectContaining({ nodeKey: "start", type: "START" }),
          expect.objectContaining({ nodeKey: "end", type: "END" })
        ] },
        edges: { create: [expect.objectContaining({ edgeKey: "route", sourceNodeKey: "start", targetNodeKey: "end" })] },
        tagLinks: { create: [{ tagId: "tag" }] },
        permissions: { create: [expect.objectContaining({ permissionCode: "crm.view" })] }
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: "workspace", action: "workflow.definition.created" })
    }));
  });

  it("enforces draft-only editing and workspace isolation", async () => {
    prisma.workflow.findFirst.mockResolvedValueOnce(workflow({ status: "PUBLISHED", version: 1 }));
    await expect(repository.updateDraft("workspace", "actor", "workflow", { description: "Changed" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflow.update).not.toHaveBeenCalled();

    prisma.workflow.findFirst.mockResolvedValueOnce(null);
    await expect(repository.get("other-workspace", "workflow")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workflow.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "workflow", workspaceId: "other-workspace" })
    }));
  });

  it("rejects graph errors, cross-workspace tags, and cross-workspace node references", async () => {
    const broken = draft();
    broken.edges[0]!.targetNodeId = "missing";
    await expect(repository.create("workspace", "actor", broken)).rejects.toBeInstanceOf(BadRequestException);

    prisma.workflowTag.count.mockResolvedValueOnce(0);
    await expect(repository.create("workspace", "actor", draft())).rejects.toBeInstanceOf(BadRequestException);

    const referenced = draft();
    referenced.nodes.splice(1, 0, {
      id: "agent", type: "AGENT" as const, referenceId: "00000000-0000-4000-8000-000000000001"
    } as never);
    referenced.edges.splice(
      0, 1,
      { id: "to-agent", sourceNodeId: "start", targetNodeId: "agent" },
      { id: "to-end", sourceNodeId: "agent", targetNodeId: "end" }
    );
    await expect(repository.create("workspace", "actor", referenced)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiAgent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", deletedAt: null })
    }));
  });

  it("publishes an immutable full graph snapshot", async () => {
    prisma.workflowVersion.create.mockResolvedValue({ id: "version", workflowId: "workflow", revision: 1 });
    prisma.workflow.update.mockResolvedValue(workflow({ status: "PUBLISHED", version: 1 }));
    await repository.publish("workspace", "actor", "workflow", "Ready");
    expect(prisma.workflowVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workflowId: "workflow", revision: 1, changeSummary: "Ready",
        snapshot: expect.objectContaining({
          nodes: [expect.objectContaining({ id: "start" }), expect.objectContaining({ id: "end" })],
          edges: [expect.objectContaining({ id: "route" })],
          variables: [expect.objectContaining({ name: "attempt" })],
          tagIds: ["tag"]
        })
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "workflow.definition.published" })
    }));
  });

  it("rollback creates a new revision and replaces every mutable draft relation", async () => {
    prisma.workflow.findFirst.mockResolvedValue(workflow({ status: "PUBLISHED", version: 2 }));
    const sourceSnapshot = snapshot();
    const snapshotHash = hash(sourceSnapshot);
    prisma.workflowVersion.findFirst.mockResolvedValue({
      id: "source", workflowId: "workflow", revision: 1, snapshot: sourceSnapshot,
      snapshotHash, checksum: hash({ snapshotHash, workspaceId: "workspace", workflowId: "workflow", revision: 1 }),
      compatibilityVersion: "1.0"
    });
    prisma.workflowVersion.create.mockResolvedValue({ id: "new", revision: 3 });
    await repository.rollback("workspace", "actor", "workflow", 1);
    expect(prisma.workflowVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 3, changeSummary: "Rollback to revision 1" })
    }));
    expect(prisma.workflow.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PUBLISHED", version: 3,
        nodes: expect.objectContaining({ deleteMany: {} }),
        edges: expect.objectContaining({ deleteMany: {} }),
        variables: expect.objectContaining({ deleteMany: {} }),
        tagLinks: expect.objectContaining({ deleteMany: {} })
      })
    }));
  });

  it("clone creates independent database children and no version records", async () => {
    prisma.workflow.create.mockResolvedValue(workflow({ id: "clone", name: "Copy", slug: "copy" }));
    await repository.clone("workspace", "actor", "workflow", "Copy", "copy");
    expect(prisma.workflow.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Copy", slug: "copy", status: "DRAFT", version: 0,
        nodes: { create: [expect.not.objectContaining({ id: "node-db-1" }), expect.not.objectContaining({ id: "node-db-2" })] },
        edges: { create: [expect.not.objectContaining({ id: "edge-db" })] }
      })
    }));
    expect(prisma.workflowVersion.create).not.toHaveBeenCalled();
  });

  it("archives, restores, and soft-deletes transactionally without deleting history", async () => {
    prisma.workflow.findFirst
      .mockResolvedValueOnce(workflow({ status: "PUBLISHED", version: 2 }))
      .mockResolvedValueOnce(workflow({ status: "ARCHIVED", version: 2, archivedAt: now }))
      .mockResolvedValueOnce(workflow({ status: "PUBLISHED", version: 2 }));
    await repository.archive("workspace", "actor", "workflow");
    await repository.restore("workspace", "actor", "workflow");
    await repository.softDelete("workspace", "actor", "workflow");
    expect(prisma.workflow.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) })
    }));
    expect(prisma.workflow.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ status: "PUBLISHED", archivedAt: null, deletedAt: null })
    }));
    expect(prisma.workflow.update).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: expect.objectContaining({ status: "ARCHIVED", deletedAt: expect.any(Date) })
    }));
    expect(prisma.workflowVersion.create).not.toHaveBeenCalled();
  });

  it("protects taxonomy in use and propagates transactional audit failures", async () => {
    prisma.workflow.count.mockResolvedValueOnce(1);
    await expect(repository.deleteCategory("workspace", "actor", "category"))
      .rejects.toBeInstanceOf(ConflictException);
    prisma.workflowTagAssignment.count.mockResolvedValueOnce(1);
    await expect(repository.deleteTag("workspace", "actor", "tag"))
      .rejects.toBeInstanceOf(ConflictException);
    const failure = new Error("audit unavailable");
    prisma.auditLog.create.mockRejectedValueOnce(failure);
    await expect(repository.archive("workspace", "actor", "workflow")).rejects.toBe(failure);
  });
});

function draft() {
  return {
    name: "Routing", slug: "routing", description: "Routes work", categoryId: "category",
    metadata: { owner: "ops" }, variables: [{ name: "attempt", schema: { type: "number" }, defaultValue: 0 }],
    inputs: [{ name: "payload", schema: { type: "object" }, required: true }],
    outputs: [{ name: "result", schema: { type: "object" } }],
    nodes: baseGraph.nodes.map((item) => ({ ...item })),
    edges: baseGraph.edges.map((item) => ({ ...item })),
    conditions: [],
    branches: [],
    labels: [{ name: "Ops", color: "#3366FF" }],
    tagIds: ["tag"], notes: [{ content: "Review" }],
    permissions: [{ permissionCode: "crm.view" }]
  };
}

function snapshot() {
  return {
    categoryId: "category", name: "Routing", slug: "routing", description: "Routes work",
    visibility: "WORKSPACE", triggerType: "MANUAL", metadata: { owner: "ops" },
    variables: [{ name: "attempt", schema: { type: "number" }, defaultValue: 0, required: false, metadata: {}, sortOrder: 0 }],
    parameters: [], inputs: [{ name: "payload", schema: { type: "object" }, required: true, metadata: {}, sortOrder: 0 }],
    outputs: [{ name: "result", schema: { type: "object" }, metadata: {}, sortOrder: 0 }],
    ...baseGraph, labels: [{ name: "Ops", color: "#3366FF", metadata: {} }],
    tagIds: ["tag"], notes: [{ content: "Review", metadata: {}, sortOrder: 0 }],
    permissions: [{ permissionCode: "crm.view", metadata: {} }]
  };
}
