import { WorkflowEngineService } from "./workflow-engine.service";

describe("WorkflowEngineService", () => {
  const repository = {
    createCategory: jest.fn(), updateCategory: jest.fn(), listCategories: jest.fn(), deleteCategory: jest.fn(),
    createTag: jest.fn(), updateTag: jest.fn(), listTags: jest.fn(), deleteTag: jest.fn(),
    create: jest.fn(), updateDraft: jest.fn(), publish: jest.fn(), rollback: jest.fn(),
    clone: jest.fn(), archive: jest.fn(), restore: jest.fn(), softDelete: jest.fn(),
    get: jest.fn(), history: jest.fn(), list: jest.fn()
  };
  const service = new WorkflowEngineService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("delegates lifecycle operations with workspace and actor context", async () => {
    await service.create("workspace", "actor", { name: "Flow", slug: "flow" });
    await service.updateDraft("workspace", "actor", "workflow", { description: "Updated" });
    await service.publish("workspace", "actor", "workflow", { changeSummary: "Ready" });
    await service.rollback("workspace", "actor", "workflow", { revision: 1 });
    await service.clone("workspace", "actor", "workflow", { name: "Copy", slug: "copy" });
    await service.archive("workspace", "actor", "workflow");
    await service.restore("workspace", "actor", "workflow");
    await service.delete("workspace", "actor", "workflow");
    expect(repository.create).toHaveBeenCalledWith("workspace", "actor", { name: "Flow", slug: "flow" });
    expect(repository.publish).toHaveBeenCalledWith("workspace", "actor", "workflow", "Ready");
    expect(repository.rollback).toHaveBeenCalledWith("workspace", "actor", "workflow", 1, undefined);
    expect(repository.softDelete).toHaveBeenCalledWith("workspace", "actor", "workflow");
  });

  it("applies stable pagination and sorting defaults", async () => {
    await service.list("workspace", {});
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace", page: 1, limit: 25, sortBy: "updatedAt", sortOrder: "desc"
    }));
  });

  it("delegates workspace-isolated taxonomy operations", async () => {
    await service.createCategory("workspace", "actor", { name: "Ops", slug: "ops" });
    await service.createTag("workspace", "actor", { name: "Critical", slug: "critical" });
    await service.listCategories("workspace");
    await service.listTags("workspace");
    expect(repository.createCategory).toHaveBeenCalledWith("workspace", "actor", expect.anything());
    expect(repository.createTag).toHaveBeenCalledWith("workspace", "actor", expect.anything());
    expect(repository.listCategories).toHaveBeenCalledWith("workspace");
    expect(repository.listTags).toHaveBeenCalledWith("workspace");
  });
});
