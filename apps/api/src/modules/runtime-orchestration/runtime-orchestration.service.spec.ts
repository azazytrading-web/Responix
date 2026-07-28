import { RuntimeOrchestrationService } from "./runtime-orchestration.service";

describe("RuntimeOrchestrationService", () => {
  const repository = {
    createQueue: jest.fn(), updateQueue: jest.fn(), listQueues: jest.fn(), deleteQueue: jest.fn(),
    createPriority: jest.fn(), updatePriority: jest.fn(), listPriorities: jest.fn(), deletePriority: jest.fn(),
    createTag: jest.fn(), updateTag: jest.fn(), listTags: jest.fn(), deleteTag: jest.fn(),
    create: jest.fn(), updateDraft: jest.fn(), publish: jest.fn(), rollback: jest.fn(),
    clone: jest.fn(), archive: jest.fn(), restore: jest.fn(), softDelete: jest.fn(),
    get: jest.fn(), history: jest.fn(), list: jest.fn()
  };
  const service = new RuntimeOrchestrationService(repository as never);
  beforeEach(() => jest.clearAllMocks());

  it("delegates lifecycle operations with tenant and actor identity", async () => {
    await service.create("workspace", "actor", { name: "Default", slug: "default" });
    await service.updateDraft("workspace", "actor", "profile", { description: "Changed" });
    await service.publish("workspace", "actor", "profile", { changeSummary: "Ready" });
    await service.rollback("workspace", "actor", "profile", { revision: 1 });
    await service.clone("workspace", "actor", "profile", { name: "Copy", slug: "copy" });
    await service.archive("workspace", "actor", "profile");
    await service.restore("workspace", "actor", "profile");
    await service.delete("workspace", "actor", "profile");
    expect(repository.publish).toHaveBeenCalledWith("workspace", "actor", "profile", "Ready");
    expect(repository.rollback).toHaveBeenCalledWith("workspace", "actor", "profile", 1, undefined);
    expect(repository.softDelete).toHaveBeenCalledWith("workspace", "actor", "profile");
  });

  it("applies stable list defaults", async () => {
    await service.list("workspace", {});
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace", page: 1, limit: 25,
      sortBy: "updatedAt", sortOrder: "desc"
    }));
  });

  it("delegates queue, priority, and tag metadata operations", async () => {
    await service.createQueue("workspace", "actor", { name: "Default", slug: "default" });
    await service.createPriority("workspace", "actor", { name: "High", slug: "high", value: 900 });
    await service.createTag("workspace", "actor", { name: "Critical", slug: "critical" });
    expect(repository.createQueue).toHaveBeenCalled();
    expect(repository.createPriority).toHaveBeenCalled();
    expect(repository.createTag).toHaveBeenCalled();
  });
});
