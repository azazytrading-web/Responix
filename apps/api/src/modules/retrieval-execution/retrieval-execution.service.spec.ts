import type { RetrievalExecutionRepository } from "./retrieval-execution.repository";
import { RetrievalExecutionService } from "./retrieval-execution.service";
import type { RetrievalExecutionStore, RetrievalKnowledgePackage } from "./retrieval-execution.types";

describe("RetrievalExecutionService", () => {
  const packageValue = { schemaVersion: "1.0", compatibilityVersion: "1.0", mode: "HYBRID",
    query: "query", queryTerms: [], snapshotId: "s", runtimeId: "r", knowledgeBaseId: "k",
    documents: [], citations: [], preparation: { keyword: true, semantic: true, hybrid: true,
      connectorContractVersion: "1.0" }, budget: { maxTokens: 4000, usedTokens: 0, truncated: false },
    sourceHash: "h", packageHash: "p", createdAt: "now" } as RetrievalKnowledgePackage;
  const store = { execute: jest.fn().mockResolvedValue(packageValue) } as jest.Mocked<RetrievalExecutionStore>;
  const repository = { recordFailure: jest.fn(), get: jest.fn(), list: jest.fn(),
    diagnostics: jest.fn(), metrics: jest.fn() } as unknown as jest.Mocked<RetrievalExecutionRepository>;
  const service = new RetrievalExecutionService(repository, store);
  beforeEach(() => jest.clearAllMocks());
  it("applies stable execution defaults", async () => {
    await service.execute("w", "a", { retrievalRuntimeSnapshotId: crypto.randomUUID(), query: "query" });
    expect(store.execute.mock.calls[0]).toEqual(["w", "a", expect.objectContaining({
      mode: "HYBRID", topK: 10, minScore: 0, maxTokens: 4000, compatibilityVersion: "1.0"
    }), undefined]);
  });
  it("persists failure metadata and preserves the original error", async () => {
    const error = new Error("failed"); store.execute.mockRejectedValueOnce(error);
    const dto = { retrievalRuntimeSnapshotId: crypto.randomUUID(), query: "query" };
    await expect(service.execute("w", "a", dto)).rejects.toBe(error);
    expect(repository.recordFailure.mock.calls[0]).toEqual(["w", "a", dto, error, false]);
  });
  it("classifies aborts as cancellations", async () => {
    const controller = new AbortController(); controller.abort();
    store.execute.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    const dto = { retrievalRuntimeSnapshotId: crypto.randomUUID(), query: "query" };
    await expect(service.execute("w", "a", dto, controller.signal)).rejects.toBeDefined();
    expect(repository.recordFailure.mock.calls[0]).toEqual(["w", "a", dto, expect.anything(), true]);
  });
});
