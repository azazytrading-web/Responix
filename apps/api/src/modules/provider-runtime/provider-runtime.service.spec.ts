import { ProviderRuntimeService } from "./provider-runtime.service";

describe("ProviderRuntimeService", () => {
  const repository = {
    prepare: jest.fn(),
    validate: jest.fn(),
    createSnapshot: jest.fn(),
    getRequest: jest.fn(),
    listRequests: jest.fn(),
    getSnapshot: jest.fn(),
    listSnapshots: jest.fn(),
    compareSnapshots: jest.fn()
  };
  const service = new ProviderRuntimeService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("delegates transactional preparation, validation, and snapshot creation", async () => {
    const dto = {
      compiledPromptId: "compiled",
      agentRuntimeSnapshotId: "runtime",
      estimatedInputTokens: 100
    };
    await service.prepare("workspace", "actor", dto);
    await service.validate("workspace", "actor", "request");
    await service.createSnapshot("workspace", "actor", "request");
    expect(repository.prepare).toHaveBeenCalledWith("workspace", "actor", dto);
    expect(repository.validate).toHaveBeenCalledWith("workspace", "actor", "request");
    expect(repository.createSnapshot).toHaveBeenCalledWith("workspace", "actor", "request");
  });

  it("delegates workspace-isolated request reads", async () => {
    await service.getRequest("workspace", "request");
    await service.listRequests("workspace", { page: 2 });
    expect(repository.getRequest).toHaveBeenCalledWith("workspace", "request");
    expect(repository.listRequests).toHaveBeenCalledWith("workspace", { page: 2 });
  });

  it("delegates immutable snapshot reads and comparison", async () => {
    await service.getSnapshot("workspace", "snapshot");
    await service.listSnapshots("workspace", { providerId: "provider" });
    await service.compareSnapshots("workspace", "left", "right");
    expect(repository.getSnapshot).toHaveBeenCalledWith("workspace", "snapshot");
    expect(repository.listSnapshots).toHaveBeenCalledWith("workspace", { providerId: "provider" });
    expect(repository.compareSnapshots).toHaveBeenCalledWith("workspace", "left", "right");
  });
});
