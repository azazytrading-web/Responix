import { RuntimeOptimizationService } from "./runtime-optimization.service";

describe("RuntimeOptimizationService", () => {
  const repository = {
    cacheCompiled: jest.fn(), cacheRendered: jest.fn(), createContext: jest.fn(),
    cacheRetrieval: jest.fn(), get: jest.fn(), list: jest.fn(), getMetrics: jest.fn()
  };
  const service = new RuntimeOptimizationService(repository as never);
  beforeEach(() => jest.clearAllMocks());
  it("delegates compiled caching", async () => {
    await service.cacheCompiled("w", "a", { compiledPromptId: "id" });
    expect(repository.cacheCompiled).toHaveBeenCalledWith("w", "a", "id");
  });
  it("delegates rendered caching", async () => {
    const dto = { compiledPromptId: "id", staticVariables: {} };
    await service.cacheRendered("w", "a", dto);
    expect(repository.cacheRendered).toHaveBeenCalledWith("w", "a", dto);
  });
  it("delegates context snapshots", async () => {
    const dto = { compiledPromptId: "id" };
    await service.createContext("w", "a", dto);
    expect(repository.createContext).toHaveBeenCalledWith("w", "a", dto);
  });
  it("delegates retrieval packages", async () => {
    const dto = { retrievalRuntimeSnapshotId: "id" };
    await service.cacheRetrieval("w", "a", dto);
    expect(repository.cacheRetrieval).toHaveBeenCalledWith("w", "a", dto);
  });
  it("delegates isolated reads, metrics, and pagination", async () => {
    await service.get("w", "id"); await service.getMetrics("w", "id");
    await service.list("w", { page: 2 });
    expect(repository.get).toHaveBeenCalledWith("w", "id");
    expect(repository.getMetrics).toHaveBeenCalledWith("w", "id");
    expect(repository.list).toHaveBeenCalledWith("w", { page: 2 });
  });
});
