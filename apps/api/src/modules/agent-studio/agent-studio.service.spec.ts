import { AgentStudioService } from "./agent-studio.service";

describe("AgentStudioService", () => {
  const repository = {
    create: jest.fn(),
    updateDraft: jest.fn(),
    publish: jest.fn(),
    rollback: jest.fn(),
    clone: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    softDelete: jest.fn(),
    get: jest.fn(),
    history: jest.fn(),
    list: jest.fn()
  };
  const service = new AgentStudioService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("binds create and draft editing to the authenticated workspace and actor", async () => {
    const dto = {
      name: "Support",
      slug: "support",
      configuration: {
        providerId: "provider",
        modelId: "model",
        temperature: 0.7,
        maxTokens: 1000
      }
    };
    await service.create("workspace", "actor", dto);
    await service.updateDraft("workspace", "actor", "agent", { description: "Updated" });
    expect(repository.create).toHaveBeenCalledWith({ workspaceId: "workspace", actorId: "actor", ...dto });
    expect(repository.updateDraft).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      draft: { description: "Updated" }
    });
  });

  it("delegates the complete transactional lifecycle", async () => {
    await service.publish("workspace", "actor", "agent", { changeSummary: "Ready" });
    await service.rollback("workspace", "actor", "agent", { revision: 1 });
    await service.clone("workspace", "actor", "agent", { name: "Copy", slug: "copy" });
    await service.archive("workspace", "actor", "agent");
    await service.restore("workspace", "actor", "agent");
    await service.delete("workspace", "actor", "agent");

    expect(repository.publish).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      changeSummary: "Ready"
    });
    expect(repository.rollback).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      revision: 1
    });
    expect(repository.clone).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      agentId: "agent",
      name: "Copy",
      slug: "copy"
    });
    expect(repository.archive).toHaveBeenCalledWith("workspace", "actor", "agent");
    expect(repository.restore).toHaveBeenCalledWith("workspace", "actor", "agent");
    expect(repository.softDelete).toHaveBeenCalledWith("workspace", "actor", "agent");
  });

  it("normalizes list pagination without losing filters", async () => {
    await service.list("workspace", {
      search: "support",
      category: "Customer Service",
      visibility: "WORKSPACE"
    });
    expect(repository.list).toHaveBeenCalledWith({
      workspaceId: "workspace",
      page: 1,
      limit: 25,
      search: "support",
      status: undefined,
      visibility: "WORKSPACE",
      category: "Customer Service"
    });
  });
});
