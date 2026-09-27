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
    documentHistory: jest.fn(), listDocuments: jest.fn(), publishSpace: jest.fn()
  };
  const pipeline = { ingestFile: jest.fn(), ingestText: jest.fn() };
  const service = new KnowledgeBaseService(repository as never, pipeline as never);

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
    repository.publishDocument.mockResolvedValue({ document: { id: "document", fileSize: BigInt(1024) }, version: { id: "version", revision: 1 } });
    repository.rollbackDocument.mockResolvedValue({ document: { id: "document", fileSize: BigInt(1024) }, version: { id: "version", revision: 2 } });
    repository.cloneDocument.mockResolvedValue({ id: "clone", fileSize: BigInt(1024) });
    repository.archiveDocument.mockResolvedValue({ id: "document", fileSize: BigInt(1024) });
    repository.restoreDocument.mockResolvedValue({ id: "document", fileSize: BigInt(1024) });
    repository.softDeleteDocument.mockResolvedValue({ id: "document", fileSize: BigInt(1024) });
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

  it("serializes BigInt fileSize to a number so responses are JSON-safe", async () => {
    repository.getDocument.mockResolvedValue({ id: "document", fileSize: BigInt(1234567890123) });
    const single = await service.getDocument("workspace", "document");
    expect(single).toMatchObject({ id: "document", fileSize: 1234567890123 });
    expect(typeof single.fileSize).toBe("number");
    expect(() => JSON.stringify(single)).not.toThrow();

    repository.listDocuments.mockResolvedValue({
      data: [{ id: "document", fileSize: BigInt(1024) }],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
    });
    const list = (await service.listDocuments("workspace", {})) as unknown as { data: Array<{ fileSize: number }> };
    expect(list.data[0]?.fileSize).toBe(1024);
    expect(() => JSON.stringify(list)).not.toThrow();
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

  it("delegates ingestion and space publishing", async () => {
    const file = { buffer: Buffer.from("hello"), originalName: "policy.txt", mimeType: "text/plain" };
    const fields = { spaceId: "space" } as never;
    const textDto = { spaceId: "space", name: "Notes", slug: "notes", content: "hello" } as never;
    await service.uploadDocument("workspace", "actor", file, fields);
    await service.createTextDocument("workspace", "actor", textDto);
    await service.publishSpace("workspace", "actor", "space");
    expect(pipeline.ingestFile).toHaveBeenCalledWith("workspace", "actor", file, fields);
    expect(pipeline.ingestText).toHaveBeenCalledWith("workspace", "actor", textDto);
    expect(repository.publishSpace).toHaveBeenCalledWith("workspace", "actor", "space");
  });
});
