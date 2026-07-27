import { StudioProjectService } from "./studio-project.service";
describe("StudioProjectService", () => {
  it("delegates lifecycle operations through the workspace-scoped repository", async () => {
    const repository = { createProject: jest.fn(), updateDraft: jest.fn(), publishProject: jest.fn(), rollbackProject: jest.fn(), archiveProject: jest.fn(), listProjects: jest.fn(), getProject: jest.fn(), getRevisionHistory: jest.fn() };
    const service = new StudioProjectService(repository as never);
    await service.publish("workspace", "actor", "project", "publish");
    await service.rollback("workspace", "actor", "project", 1);
    expect(repository.publishProject).toHaveBeenCalledWith({ workspaceId: "workspace", actorId: "actor", projectId: "project", changeSummary: "publish" });
    expect(repository.rollbackProject).toHaveBeenCalledWith({ workspaceId: "workspace", actorId: "actor", projectId: "project", revision: 1, changeSummary: undefined });
    await service.create("workspace", "actor", { name: "Support", slug: "support", draft: { tone: "clear" } });
    await service.updateDraft("workspace", "actor", "project", { draft: { tone: "formal" } });
    await service.archive("workspace", "actor", "project");
    expect(repository.createProject).toHaveBeenCalledWith({ workspaceId: "workspace", actorId: "actor", name: "Support", slug: "support", draft: { tone: "clear" } });
    expect(repository.updateDraft).toHaveBeenCalledWith({ workspaceId: "workspace", actorId: "actor", projectId: "project", draft: { tone: "formal" } });
    expect(repository.archiveProject).toHaveBeenCalledWith("workspace", "actor", "project");
  });
});
