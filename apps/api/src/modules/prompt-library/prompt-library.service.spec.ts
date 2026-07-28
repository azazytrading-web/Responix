import { PromptLibraryService } from "./prompt-library.service";

describe("PromptLibraryService", () => {
  const repository = {
    create: jest.fn(),
    updateDraft: jest.fn(),
    updateMetadata: jest.fn(),
    publish: jest.fn(),
    rollback: jest.fn(),
    clone: jest.fn(),
    get: jest.fn(),
    history: jest.fn(),
    list: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    setFavorite: jest.fn(),
    createCategory: jest.fn(),
    listCategories: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    createTag: jest.fn(),
    listTags: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
    assignTag: jest.fn(),
    removeTag: jest.fn()
  };
  const service = new PromptLibraryService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("binds CRUD and metadata editing to the authenticated workspace and actor", async () => {
    await service.create("workspace", "actor", { name: "Welcome", slug: "welcome" });
    await service.updateDraft("workspace", "actor", "prompt", { draft: { body: "Hello" } });
    await service.updateMetadata("workspace", "actor", "prompt", { metadata: { locale: "en" } });
    await service.clone("workspace", "actor", "prompt", { name: "Copy", slug: "copy" });

    expect(repository.create).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      name: "Welcome",
      slug: "welcome"
    });
    expect(repository.updateDraft).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      draft: { body: "Hello" }
    });
    expect(repository.updateMetadata).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      metadata: { locale: "en" }
    });
    expect(repository.clone).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      name: "Copy",
      slug: "copy"
    });
  });

  it("delegates publish, rollback, archive, restore, and favorites", async () => {
    await service.publish("workspace", "actor", "prompt", { changeSummary: "Ready" });
    await service.rollback("workspace", "actor", "prompt", { revision: 2 });
    await service.archive("workspace", "actor", "prompt");
    await service.restore("workspace", "actor", "prompt");
    await service.favorite("workspace", "actor", "prompt", true);

    expect(repository.publish).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      changeSummary: "Ready"
    });
    expect(repository.rollback).toHaveBeenCalledWith({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      revision: 2
    });
    expect(repository.archive).toHaveBeenCalledWith("workspace", "actor", "prompt");
    expect(repository.restore).toHaveBeenCalledWith("workspace", "actor", "prompt");
    expect(repository.setFavorite).toHaveBeenCalledWith("workspace", "actor", "prompt", true);
  });

  it("normalizes list defaults and preserves filters", async () => {
    await service.list("workspace", {
      search: "welcome",
      favorite: true,
      tagIds: ["tag"],
      sortBy: "name",
      sortOrder: "asc"
    });
    expect(repository.list).toHaveBeenCalledWith({
      workspaceId: "workspace",
      page: 1,
      limit: 25,
      search: "welcome",
      status: undefined,
      categoryId: undefined,
      tagIds: ["tag"],
      favorite: true,
      archived: undefined,
      sortBy: "name",
      sortOrder: "asc"
    });
  });

  it("workspace-scopes taxonomy and tag assignment operations", async () => {
    await service.createCategory("workspace", "actor", { name: "Sales", slug: "sales" });
    await service.updateTag("workspace", "actor", "tag", { name: "Urgent" });
    await service.assignTag("workspace", "actor", "prompt", "tag");
    await service.removeTag("workspace", "actor", "prompt", "tag");

    expect(repository.createCategory).toHaveBeenCalledWith(
      "workspace",
      "actor",
      "Sales",
      "sales"
    );
    expect(repository.updateTag).toHaveBeenCalledWith(
      "workspace",
      "actor",
      "tag",
      "Urgent",
      undefined
    );
    expect(repository.assignTag).toHaveBeenCalledWith(
      "workspace",
      "actor",
      "prompt",
      "tag"
    );
    expect(repository.removeTag).toHaveBeenCalledWith(
      "workspace",
      "actor",
      "prompt",
      "tag"
    );
  });
});
