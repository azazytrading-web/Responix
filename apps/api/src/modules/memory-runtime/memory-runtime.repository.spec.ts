import { MemoryRuntimeRepository } from "./memory-runtime.repository";
import { MemoryRuntimeValidator } from "./memory-runtime.validator";

describe("MemoryRuntimeRepository", () => {
  it("applies workspace isolation, filtering and pagination to repository reads", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      memoryRuntime: { findMany, count },
      $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
        Promise.all(operations))
    };
    const repository = new MemoryRuntimeRepository(
      prisma as never, new MemoryRuntimeValidator()
    );
    await repository.list("workspace-a", {
      page: 2, limit: 10, scopeKey: "agent:one", search: "support"
    });
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace-a", scopeKey: "agent:one" }),
      skip: 10, take: 10
    }));
    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace-a" })
    }));
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });

  it("compares immutable snapshots without crossing workspaces", async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({
        id: "left", workspaceId: "workspace-a", runtimeId: "runtime",
        version: 1, revision: 1, compatibilityVersion: "1.0",
        snapshot: { content: { value: 1 }, metadata: {} },
        packageHash: "same", checksum: "same"
      })
      .mockResolvedValueOnce({
        id: "right", workspaceId: "workspace-a", runtimeId: "runtime",
        version: 2, revision: 2, compatibilityVersion: "1.0",
        snapshot: { content: { value: 1 }, metadata: {} },
        packageHash: "same", checksum: "same"
      });
    const repository = new MemoryRuntimeRepository({
      memoryRuntimeSnapshot: { findFirst }
    } as never, new MemoryRuntimeValidator());
    await expect(repository.compare("workspace-a", "left", "right"))
      .resolves.toEqual(expect.objectContaining({ identical: true }));
    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: "left", workspaceId: "workspace-a" }
    }));
    expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: "right", workspaceId: "workspace-a" }
    }));
  });
});
