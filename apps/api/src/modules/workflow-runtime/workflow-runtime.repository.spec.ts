/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConflictException, NotFoundException } from "@nestjs/common";
import { WorkflowRuntimeRepository } from "./workflow-runtime.repository";
import { WorkflowRuntimeStateMachine } from "./workflow-runtime.state-machine";

describe("WorkflowRuntimeRepository", () => {
  const prisma = {
    workflowVersion: { findFirst: jest.fn() },
    workflowRuntimeExecution: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new WorkflowRuntimeRepository(prisma as never, new WorkflowRuntimeStateMachine());
  const snapshot = { name: "Test", slug: "test", variables: [], inputs: [], outputs: [],
    nodes: [{ id: "start", type: "START" }], edges: [], branches: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (values: unknown[]) => Promise.all(values));
  });

  it("loads only workspace-published hash-verified immutable versions", async () => {
    const snapshotHash = repository.hash(snapshot);
    prisma.workflowVersion.findFirst.mockResolvedValue({ id: "version", workflowId: "workflow", revision: 1,
      snapshot, snapshotHash, compatibilityVersion: "1.0",
      checksum: repository.hash({ snapshotHash, workspaceId: "workspace", workflowId: "workflow", revision: 1 }),
      workflow: { id: "workflow", workspaceId: "workspace", status: "PUBLISHED" } });
    await expect(repository.loadVersion("workspace", "version")).resolves.toMatchObject({ snapshotHash });
    expect(prisma.workflowVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: "version", workflow: expect.objectContaining({ workspaceId: "workspace", status: "PUBLISHED" })
    }) }));
  });

  it("rejects missing and tampered workflow versions", async () => {
    prisma.workflowVersion.findFirst.mockResolvedValueOnce(null);
    await expect(repository.loadVersion("workspace", "missing")).rejects.toBeInstanceOf(NotFoundException);
    prisma.workflowVersion.findFirst.mockResolvedValueOnce({ id: "version", workflowId: "workflow", revision: 1,
      snapshot, snapshotHash: "tampered", checksum: "tampered", compatibilityVersion: "1.0",
      workflow: { id: "workflow", workspaceId: "workspace", status: "PUBLISHED" } });
    await expect(repository.loadVersion("workspace", "version")).rejects.toBeInstanceOf(ConflictException);
  });

  it("applies workspace isolation, filters, and deterministic pagination", async () => {
    prisma.workflowRuntimeExecution.findMany.mockResolvedValue([{ id: "execution" }]);
    prisma.workflowRuntimeExecution.count.mockResolvedValue(1);
    const result = await repository.list("workspace", { page: 2, limit: 10, status: "FAILED",
      workflowId: crypto.randomUUID() });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(prisma.workflowRuntimeExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", status: "FAILED" }), skip: 10, take: 10
    }));
  });
});
