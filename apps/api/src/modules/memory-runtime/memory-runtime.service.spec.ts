import { MemoryRuntimeService } from "./memory-runtime.service";

describe("MemoryRuntimeService", () => {
  const repository = {
    create: jest.fn(), update: jest.fn(), publish: jest.fn(), rollback: jest.fn(),
    archive: jest.fn(), commitWrite: jest.fn(), commitWrites: jest.fn(),
    get: jest.fn(), getSnapshot: jest.fn(),
    list: jest.fn(), listSnapshots: jest.fn(), compare: jest.fn(), diagnostics: jest.fn(),
    metrics: jest.fn(), history: jest.fn()
  };
  const store = { loadResolved: jest.fn() };
  const service = new MemoryRuntimeService(repository as never, store);
  beforeEach(() => jest.clearAllMocks());

  it("delegates workspace-isolated resolution to the provider-neutral store", async () => {
    store.loadResolved.mockResolvedValue({ snapshots: [], packageHash: "hash" });
    await service.resolve("workspace", "actor", {
      snapshotIds: ["11111111-1111-4111-8111-111111111111"],
      compatibilityVersion: "1.0", executionRequestId: "request", executionRunId: "run"
    });
    expect(store.loadResolved).toHaveBeenCalledWith(
      "workspace", "actor", ["11111111-1111-4111-8111-111111111111"],
      "1.0", "request", "run"
    );
  });
  it("delegates transactional writes, comparison, metrics and diagnostics", async () => {
    const write = {
      runtimeId: "runtime", content: {}, expectedStateVersion: 2, executionRunId: "run"
    };
    await service.commitWrite("workspace", "actor", write);
    await service.compare("workspace", "left", "right");
    await service.metrics("workspace", "runtime");
    await service.diagnostics("workspace", "runtime");
    expect(repository.commitWrite).toHaveBeenCalledWith("workspace", "actor", write);
    expect(repository.compare).toHaveBeenCalledWith("workspace", "left", "right");
    expect(repository.metrics).toHaveBeenCalledWith("workspace", "runtime");
    expect(repository.diagnostics).toHaveBeenCalledWith("workspace", "runtime");
  });
});
