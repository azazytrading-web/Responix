/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";

const tag = {
  id: "tag", workspaceId: "workspace", name: "Internal", slug: "internal",
  metadata: {}, createdAt: new Date(), updatedAt: new Date()
};
const chunk = {
  id: "chunk", ordinal: 0, checksum: "chunk-sum", tokenCount: 100,
  characterCount: 450, strategyMetadata: {}, metadata: {},
  createdAt: new Date(), updatedAt: new Date()
};
const document = (overrides: Record<string, unknown> = {}) => ({
  id: "document", workspaceId: "workspace", knowledgeBaseId: "space",
  collectionId: "collection", folderId: "folder", categoryId: "category",
  name: "Policy", slug: "policy", description: "Policy document", sourceType: "FILE",
  sourceMetadata: {}, fileMetadata: {}, urlMetadata: {}, fileName: "policy.pdf",
  originalName: "policy.pdf", mimeType: "application/pdf", fileSize: BigInt(1024),
  language: "en", checksum: "sha256:doc", parserMetadata: {}, chunkStrategy: {},
  embeddingStatusMetadata: { status: "not_started" }, syncMetadata: {},
  importMetadata: {}, metadata: {}, status: "DRAFT", revision: 0,
  createdById: "actor", updatedById: "actor", createdAt: new Date(), updatedAt: new Date(),
  archivedAt: null, deletedAt: null, chunks: [chunk], tags: [{ tag }], ...overrides
});
const space = {
  id: "space", workspaceId: "workspace", name: "Docs", slug: "docs", description: null,
  categoryId: null, metadata: {}, status: "DRAFT", createdById: "actor", updatedById: "actor",
  createdAt: new Date(), updatedAt: new Date(), archivedAt: null, deletedAt: null
};
const collection = {
  id: "collection", workspaceId: "workspace", knowledgeBaseId: "space",
  name: "Policies", slug: "policies", description: null, metadata: {},
  createdById: "actor", updatedById: "actor", createdAt: new Date(), updatedAt: new Date(),
  deletedAt: null
};
const folder = {
  id: "folder", workspaceId: "workspace", knowledgeBaseId: "space",
  collectionId: "collection", parentId: null, name: "HR", slug: "hr", metadata: {},
  createdById: "actor", updatedById: "actor", createdAt: new Date(), updatedAt: new Date(),
  deletedAt: null
};

describe("KnowledgeBaseRepository", () => {
  const prisma = {
    knowledgeBase: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    knowledgeCollection: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    knowledgeFolder: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    knowledgeCategory: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    knowledgeTag: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    knowledgeTagAssignment: { count: jest.fn() },
    knowledgeDocument: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    knowledgeVersion: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new KnowledgeBaseRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.knowledgeBase.findFirst.mockResolvedValue(space);
    prisma.knowledgeCollection.findFirst.mockResolvedValue(collection);
    prisma.knowledgeFolder.findFirst.mockResolvedValue(folder);
    prisma.knowledgeCategory.findFirst.mockResolvedValue({ ...tag, id: "category", name: "Policy", slug: "policy" });
    prisma.knowledgeTag.findFirst.mockResolvedValue(tag);
    prisma.knowledgeTag.count.mockResolvedValue(1);
    prisma.knowledgeDocument.findFirst.mockResolvedValue(document());
    prisma.knowledgeDocument.create.mockResolvedValue(document());
    prisma.knowledgeDocument.update.mockResolvedValue(document());
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("creates and audits a workspace-isolated hierarchy", async () => {
    prisma.knowledgeCollection.create.mockResolvedValue(collection);
    prisma.knowledgeFolder.create.mockResolvedValue(folder);
    await repository.createCollection("workspace", "actor", {
      spaceId: "space", name: "Policies", slug: "policies"
    });
    await repository.createFolder("workspace", "actor", {
      spaceId: "space", collectionId: "collection", name: "HR", slug: "hr"
    });
    expect(prisma.knowledgeBase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "space", workspaceId: "workspace", deletedAt: null } })
    );
    expect(prisma.knowledgeFolder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        workspaceId: "workspace", knowledgeBaseId: "space", collectionId: "collection"
      }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("rejects cross-workspace hierarchy references", async () => {
    prisma.knowledgeCollection.findFirst.mockResolvedValue(null);
    await expect(repository.createDocument("workspace", "actor", {
      spaceId: "space", collectionId: "foreign", name: "Policy", slug: "policy",
      sourceType: "FILE"
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.knowledgeDocument.create).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace tags and duplicate chunk ordinals", async () => {
    prisma.knowledgeTag.count.mockResolvedValue(0);
    await expect(repository.createDocument("workspace", "actor", {
      spaceId: "space", name: "Policy", slug: "policy", sourceType: "FILE", tagIds: ["foreign"]
    })).rejects.toBeInstanceOf(BadRequestException);
    prisma.knowledgeTag.count.mockResolvedValue(1);
    await expect(repository.createDocument("workspace", "actor", {
      spaceId: "space", name: "Policy", slug: "policy", sourceType: "FILE",
      chunks: [{ ordinal: 0 }, { ordinal: 0 }]
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists metadata-only document and chunk configuration transactionally", async () => {
    await repository.createDocument("workspace", "actor", {
      spaceId: "space", collectionId: "collection", folderId: "folder",
      categoryId: "category", name: "Policy", slug: "policy", sourceType: "URL",
      sourceUrl: "https://example.com/policy", mimeType: "text/html", sizeBytes: 1024,
      language: "en", checksum: "sha256:doc", tagIds: ["tag"],
      parserMetadata: { parser: "html" }, chunkStrategy: { size: 500 },
      embeddingStatusMetadata: { status: "not_started" },
      chunks: [{ ordinal: 0, tokenCount: 100 }]
    });
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        workspaceId: "workspace", knowledgeBaseId: "space", sourceType: "URL",
        urlMetadata: { url: "https://example.com/policy" }, fileSize: BigInt(1024),
        embeddingStatusMetadata: { status: "not_started" },
        tags: { create: [{ tagId: "tag" }] },
        chunks: { create: [expect.objectContaining({ workspaceId: "workspace", ordinal: 0 })] }
      }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "knowledge.document.created" }) })
    );
  });

  it("enforces draft-only updates", async () => {
    prisma.knowledgeDocument.findFirst.mockResolvedValue(document({ status: "PUBLISHED", revision: 1 }));
    await expect(repository.updateDocument("workspace", "actor", "document", {
      description: "Changed"
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.knowledgeDocument.update).not.toHaveBeenCalled();
  });

  it("publishes an immutable complete metadata snapshot", async () => {
    prisma.knowledgeVersion.create.mockResolvedValue({ id: "version", documentId: "document", revision: 1 });
    prisma.knowledgeDocument.update.mockResolvedValue(document({ status: "PUBLISHED", revision: 1 }));
    await repository.publishDocument("workspace", "actor", "document", "Ready");
    expect(prisma.knowledgeVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        documentId: "document", revision: 1, changeSummary: "Ready",
        snapshot: expect.objectContaining({
          knowledgeBaseId: "space", fileSize: "1024", tagIds: ["tag"],
          chunks: [expect.objectContaining({ ordinal: 0 })]
        })
      }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "knowledge.document.published" }) })
    );
  });

  it("rollback creates a new published revision and replaces metadata associations", async () => {
    prisma.knowledgeDocument.findFirst.mockResolvedValue(document({ status: "PUBLISHED", revision: 2 }));
    prisma.knowledgeVersion.findFirst.mockResolvedValue({
      id: "source", documentId: "document", revision: 1, snapshot: snapshot()
    });
    prisma.knowledgeVersion.create.mockResolvedValue({ id: "new-version", revision: 3 });
    await repository.rollbackDocument("workspace", "actor", "document", 1);
    expect(prisma.knowledgeVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        revision: 3, changeSummary: "Rollback to revision 1"
      }) })
    );
    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        status: "PUBLISHED", revision: 3,
        tags: { deleteMany: {}, create: [{ tagId: "tag" }] },
        chunks: expect.objectContaining({ deleteMany: {} })
      }) })
    );
  });

  it("clone creates independent document, chunk, and tag-assignment records", async () => {
    prisma.knowledgeDocument.create.mockResolvedValue(document({ id: "clone", name: "Copy", slug: "copy" }));
    await repository.cloneDocument("workspace", "actor", "document", "Copy", "copy");
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        name: "Copy", slug: "copy", status: "DRAFT", revision: 0,
        chunks: { create: [expect.not.objectContaining({ id: "chunk" })] },
        tags: { create: [{ tagId: "tag" }] }
      }) })
    );
    expect(prisma.knowledgeVersion.create).not.toHaveBeenCalled();
  });

  it("archives, restores, and soft-deletes without deleting versions", async () => {
    prisma.knowledgeDocument.findFirst
      .mockResolvedValueOnce(document({ status: "PUBLISHED", revision: 2 }))
      .mockResolvedValueOnce(document({ status: "ARCHIVED", revision: 2, archivedAt: new Date() }))
      .mockResolvedValueOnce(document({ status: "PUBLISHED", revision: 2 }));
    await repository.archiveDocument("workspace", "actor", "document");
    await repository.restoreDocument("workspace", "actor", "document");
    await repository.softDeleteDocument("workspace", "actor", "document");
    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) }) })
    );
    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ data: expect.objectContaining({ status: "PUBLISHED", archivedAt: null, deletedAt: null }) })
    );
    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(3,
      expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVED", deletedAt: expect.any(Date) }) })
    );
    expect(prisma.knowledgeVersion.create).not.toHaveBeenCalled();
  });

  it("prevents deleting taxonomy and hierarchy resources while in use", async () => {
    prisma.knowledgeTagAssignment.count.mockResolvedValue(1);
    await expect(repository.deleteTag("workspace", "actor", "tag")).rejects.toBeInstanceOf(ConflictException);
    prisma.knowledgeFolder.count.mockResolvedValue(1);
    prisma.knowledgeDocument.count.mockResolvedValue(0);
    await expect(repository.deleteFolder("workspace", "actor", "folder")).rejects.toBeInstanceOf(ConflictException);
  });

  it("rolls back mutations if audit persistence fails", async () => {
    const failure = new Error("audit unavailable");
    prisma.auditLog.create.mockRejectedValue(failure);
    await expect(repository.archiveDocument("workspace", "actor", "document")).rejects.toBe(failure);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

function snapshot() {
  return {
    knowledgeBaseId: "space", collectionId: "collection", folderId: "folder",
    categoryId: "category", name: "Policy", slug: "policy", description: "Policy",
    sourceType: "FILE", sourceMetadata: {}, fileMetadata: {}, urlMetadata: {},
    fileName: "policy.pdf", originalName: "policy.pdf", mimeType: "application/pdf",
    fileSize: "1024", language: "en", checksum: "sha256:doc", parserMetadata: {},
    chunkStrategy: {}, embeddingStatusMetadata: {}, syncMetadata: {}, importMetadata: {},
    metadata: {}, tagIds: ["tag"], chunks: [{ ordinal: 0, tokenCount: 100 }]
  };
}
