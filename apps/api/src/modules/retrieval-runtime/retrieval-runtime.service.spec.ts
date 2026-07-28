import { RetrievalRuntimeService } from "./retrieval-runtime.service";

describe("RetrievalRuntimeService", () => {
  const repository = {
    prepare: jest.fn(), validate: jest.fn(), publish: jest.fn(), archive: jest.fn(),
    restore: jest.fn(), get: jest.fn(), getSnapshot: jest.fn(), list: jest.fn(),
    listSnapshots: jest.fn(), compare: jest.fn()
  };
  const service = new RetrievalRuntimeService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("delegates preparation and validation with tenant context", async () => {
    const dto = { name: "Runtime", knowledgeBaseId: "space" };
    await service.prepare("workspace", "actor", dto);
    await service.validate("workspace", "actor", "runtime");
    expect(repository.prepare).toHaveBeenCalledWith("workspace", "actor", dto);
    expect(repository.validate).toHaveBeenCalledWith("workspace", "actor", "runtime");
  });

  it("delegates transactional lifecycle operations", async () => {
    await service.publish("workspace", "actor", "runtime");
    await service.archive("workspace", "actor", "runtime");
    await service.restore("workspace", "actor", "runtime");
    expect(repository.publish).toHaveBeenCalledWith("workspace", "actor", "runtime");
    expect(repository.archive).toHaveBeenCalledWith("workspace", "actor", "runtime");
    expect(repository.restore).toHaveBeenCalledWith("workspace", "actor", "runtime");
  });

  it("delegates workspace-isolated reads, pagination, and comparison", async () => {
    await service.get("workspace", "runtime");
    await service.getSnapshot("workspace", "snapshot");
    await service.list("workspace", { page: 2 });
    await service.listSnapshots("workspace", { runtimeId: "runtime" });
    await service.compare("workspace", "left", "right");
    expect(repository.get).toHaveBeenCalledWith("workspace", "runtime");
    expect(repository.getSnapshot).toHaveBeenCalledWith("workspace", "snapshot");
    expect(repository.list).toHaveBeenCalledWith("workspace", { page: 2 });
    expect(repository.compare).toHaveBeenCalledWith("workspace", "left", "right");
  });
});
