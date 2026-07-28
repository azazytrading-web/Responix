import { KnowledgeBaseService } from "./knowledge-base.service";

describe("KnowledgeBaseService", () => {
  const repository = {
    createSpace: jest.fn(), updateSpace: jest.fn(), listSpaces: jest.fn(), deleteSpace: jest.fn(),
    createCollection: jest.fn(), updateCollection: jest.fn(), listCollections: jest.fn(), deleteCollection: jest.fn(),
    createFolder: jest.fn(), updateFolder: jest.fn(), listFolders: jest.fn(), deleteFolder: jest.fn(),
    createCategory: jest.fn(), updateCategory: jest.fn(), listCategories: jest.fn(), deleteCategory: jest.fn(),
    createTag: jest.fn(), updateTag: jest.fn(), listTags: jest.fn(), deleteTag: jest.fn(),
    createDocument: jest.fn(), updateDocument: jest.fn(), publishDocument: jest.fn(),
    rollbackDocument: jest.fn(), cloneDocument: jest.fn(), archiveDocument: jest.fn(),
    restoreDocument: jest.fn(), softDeleteDocument: jest.fn(), getDocument: jest.fn(),
    documentHistory: jest.fn(), listDocuments: jest.fn()
  };
  const service = new KnowledgeBaseService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("workspace-scopes hierarchy and taxonomy operations", async () => {
    await service.createSpace("workspace", "actor", { name: "Docs", slug: "docs" });
    await service.createCollection("workspace", "actor", {
      spaceId: "space", name: "Policies", slug: "policies"
    });
    await service.createFolder("workspace", "actor", {
      spaceId: "space", collectionId: "collection", name: "HR", slug: "hr"
    });
    await service.createTag("workspace", "actor", { name: "Internal", slug: "internal" });
    expect(repository.createSpace).toHaveBeenCalledWith("workspace", "actor", { name: "Docs", slug: "docs" });
    expect(repository.createCollection).toHaveBeenCalledWith("workspace", "actor", {
      spaceId: "space", name: "Policies", slug: "policies"
    });
    expect(repository.createFolder).toHaveBeenCalledWith("workspace", "actor", {
      spaceId: "space", collectionId: "collection", name: "HR", slug: "hr"
    });
    expect(repository.createTag).toHaveBeenCalledWith("workspace", "actor", {
      name: "Internal", slug: "internal"
    });
  });

  it("delegates the complete document lifecycle", async () => {
    await service.publishDocument("workspace", "actor", "document", "Ready");
    await service.rollbackDocument("workspace", "actor", "document", { revision: 1 });
    await service.cloneDocument("workspace", "actor", "document", { name: "Copy", slug: "copy" });
    await service.archiveDocument("workspace", "actor", "document");
    await service.restoreDocument("workspace", "actor", "document");
    await service.deleteDocument("workspace", "actor", "document");
    expect(repository.publishDocument).toHaveBeenCalledWith("workspace", "actor", "document", "Ready");
    expect(repository.rollbackDocument).toHaveBeenCalledWith("workspace", "actor", "document", 1, undefined);
    expect(repository.cloneDocument).toHaveBeenCalledWith("workspace", "actor", "document", "Copy", "copy");
    expect(repository.archiveDocument).toHaveBeenCalledWith("workspace", "actor", "document");
    expect(repository.restoreDocument).toHaveBeenCalledWith("workspace", "actor", "document");
    expect(repository.softDeleteDocument).toHaveBeenCalledWith("workspace", "actor", "document");
  });

  it("normalizes document pagination and preserves filters", async () => {
    await service.listDocuments("workspace", {
      search: "policy", spaceId: "space", status: "PUBLISHED", sourceType: "FILE"
    });
    expect(repository.listDocuments).toHaveBeenCalledWith({
      workspaceId: "workspace", page: 1, limit: 25, search: "policy", spaceId: "space",
      collectionId: undefined, folderId: undefined, status: "PUBLISHED", sourceType: "FILE"
    });
  });
});
