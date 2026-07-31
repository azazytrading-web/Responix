import { RetrievalExecutionController } from "./retrieval-execution.controller";
import type { RetrievalExecutionService } from "./retrieval-execution.service";

describe("RetrievalExecutionController", () => {
  const service = { execute: jest.fn(), list: jest.fn(), get: jest.fn(), diagnostics: jest.fn(), metrics: jest.fn() };
  const controller = new RetrievalExecutionController(service as unknown as RetrievalExecutionService);
  const request = { tenantContext: { workspace: { id: "workspace" }, user: { id: "actor" } } } as never;
  beforeEach(() => jest.clearAllMocks());
  it("derives workspace and actor only from tenant context", async () => {
    const dto = { retrievalRuntimeSnapshotId: crypto.randomUUID(), query: "query" };
    await controller.execute(request, dto);
    expect(service.execute.mock.calls[0]).toEqual(["workspace", "actor", dto]);
  });
  it("scopes reads to the active workspace", async () => {
    await controller.get(request, "execution"); await controller.list(request, {});
    await controller.diagnostics(request, "execution"); await controller.metrics(request, "execution");
    expect(service.get.mock.calls[0]).toEqual(["workspace", "execution"]);
    expect(service.list.mock.calls[0]).toEqual(["workspace", {}]);
    expect(service.diagnostics.mock.calls[0]).toEqual(["workspace", "execution"]);
    expect(service.metrics.mock.calls[0]).toEqual(["workspace", "execution"]);
  });
});
