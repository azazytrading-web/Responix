import { ConversationRuntimeService } from "./conversation-runtime.service";

describe("ConversationRuntimeService", () => {
  const repository = {
    prepare: jest.fn(), validate: jest.fn(), transition: jest.fn(), publish: jest.fn(),
    rollback: jest.fn(), clone: jest.fn(), archive: jest.fn(), restore: jest.fn(),
    softDelete: jest.fn(), get: jest.fn(), getSnapshot: jest.fn(), list: jest.fn(),
    listSnapshots: jest.fn(), compare: jest.fn()
  };
  const service = new ConversationRuntimeService(repository as never);
  beforeEach(() => jest.clearAllMocks());

  it("delegates preparation, validation, and state transitions", async () => {
    const prepare = { name: "Runtime", compatibilityVersion: "1.0.0" };
    const transition = { state: "ACTIVE" as const };
    await service.prepare("workspace", "actor", prepare);
    await service.validate("workspace", "actor", "runtime");
    await service.transition("workspace", "actor", "runtime", transition);
    expect(repository.prepare).toHaveBeenCalledWith("workspace", "actor", prepare);
    expect(repository.transition).toHaveBeenCalledWith("workspace", "actor", "runtime", transition);
  });

  it("delegates all transactional lifecycle operations", async () => {
    await service.publish("workspace", "actor", "runtime");
    await service.rollback("workspace", "actor", "runtime", "version");
    await service.clone("workspace", "actor", "runtime", { name: "Clone" });
    await service.archive("workspace", "actor", "runtime");
    await service.restore("workspace", "actor", "runtime");
    await service.softDelete("workspace", "actor", "runtime");
    expect(repository.rollback).toHaveBeenCalledWith("workspace", "actor", "runtime", "version");
    expect(repository.clone).toHaveBeenCalledWith("workspace", "actor", "runtime", { name: "Clone" });
  });

  it("delegates isolated reads, pagination, and comparison", async () => {
    await service.get("workspace", "runtime");
    await service.getSnapshot("workspace", "snapshot");
    await service.list("workspace", { page: 2 });
    await service.listSnapshots("workspace", { runtimeId: "runtime" });
    await service.compare("workspace", "left", "right");
    expect(repository.list).toHaveBeenCalledWith("workspace", { page: 2 });
    expect(repository.compare).toHaveBeenCalledWith("workspace", "left", "right");
  });
});
