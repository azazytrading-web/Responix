/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from "@nestjs/common";
import { ToolRuntimeRepository } from "./tool-runtime.repository";
import { ToolRuntimeStateMachine } from "./tool-runtime.state-machine";

describe("ToolRuntimeRepository", () => {
  const prisma = { toolRuntimeExecution: { findFirst: jest.fn(), findMany: jest.fn(),
    findUnique: jest.fn(), count: jest.fn() }, $transaction: jest.fn() };
  const repository = new ToolRuntimeRepository(prisma as never, new ToolRuntimeStateMachine());
  beforeEach(() => jest.clearAllMocks());

  it("enforces workspace isolation on reads", async () => {
    prisma.toolRuntimeExecution.findFirst.mockResolvedValue(null);
    await expect(repository.get("workspace-a", "execution")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.toolRuntimeExecution.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "execution", workspaceId: "workspace-a" }
    }));
  });

  it("filters and paginates immutable history inside the active workspace", async () => {
    prisma.$transaction.mockResolvedValue([[{ id: "execution" }], 26]);
    const result = await repository.list("workspace", { page: 2, limit: 10,
      correlationId: "correlation" });
    const calls = prisma.$transaction.mock.calls[0]?.[0] as unknown[];
    expect(calls).toHaveLength(2);
    expect(prisma.toolRuntimeExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", correlationId: "correlation" }),
      skip: 10, take: 10
    }));
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 26, totalPages: 3 });
  });

  it("produces deterministic order-independent execution hashes", () => {
    expect(repository.hash({ b: 2, a: 1 })).toBe(repository.hash({ a: 1, b: 2 }));
  });
});
