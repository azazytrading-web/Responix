/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrepareRetrievalRuntimeDto } from "./dto/retrieval-runtime.dto";
import {
  RetrievalFilterOperator,
  RetrievalVariableType
} from "./dto/retrieval-runtime.dto";
import { RetrievalRuntimeRepository } from "./retrieval-runtime.repository";
import { RetrievalRuntimeValidator } from "./retrieval-runtime.validator";

const now = new Date("2026-07-28T00:00:00.000Z");
const publishedDocument = {
  id: "document",
  knowledgeBaseId: "space",
  collectionId: "collection",
  folderId: "folder",
  categoryId: "category",
  name: "Document",
  slug: "document",
  sourceType: "FILE",
  sourceMetadata: {},
  fileMetadata: { fileName: "document.txt" },
  urlMetadata: {},
  mimeType: "text/plain",
  fileSize: BigInt(100),
  language: "en",
  checksum: "document-checksum",
  parserMetadata: {},
  chunkStrategy: {},
  metadata: {},
  revision: 2,
  tags: [{ tagId: "tag" }]
};
const dto = (overrides: Partial<PrepareRetrievalRuntimeDto> = {}): PrepareRetrievalRuntimeDto => ({
  name: "Support Retrieval",
  knowledgeBaseId: "space",
  language: "en",
  allowedMimeTypes: ["text/plain"],
  sources: [{ documentId: "document", versionId: "version" }],
  collections: [{ collectionId: "collection" }],
  folderIds: ["folder"],
  categoryIds: ["category"],
  tagIds: ["tag"],
  filters: [{ key: "document.language", operator: RetrievalFilterOperator.EQUALS, value: "en" }],
  variables: [{ name: "tenant", type: RetrievalVariableType.STRING, value: "workspace" }],
  metadata: { purpose: "support" },
  ...overrides
});

describe("RetrievalRuntimeRepository", () => {
  let storedRuntime: Record<string, unknown> | null;
  const prisma = {
    knowledgeBase: { findFirst: jest.fn() },
    knowledgeCollection: { findMany: jest.fn() },
    knowledgeFolder: { findMany: jest.fn() },
    knowledgeCategory: { findMany: jest.fn() },
    knowledgeTag: { findMany: jest.fn() },
    knowledgeDocument: { findMany: jest.fn() },
    knowledgeVersion: { findMany: jest.fn() },
    retrievalRuntime: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(),
      count: jest.fn(), update: jest.fn()
    },
    retrievalRuntimeSnapshot: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new RetrievalRuntimeRepository(prisma as never, new RetrievalRuntimeValidator());

  beforeEach(() => {
    jest.clearAllMocks();
    storedRuntime = null;
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      const before = storedRuntime;
      try {
        return await (input as (tx: typeof prisma) => Promise<unknown>)(prisma);
      } catch (error) {
        storedRuntime = before;
        throw error;
      }
    });
    prisma.knowledgeBase.findFirst.mockResolvedValue({
      id: "space", name: "Space", slug: "space", categoryId: "category",
      metadata: {}, status: "PUBLISHED"
    });
    prisma.knowledgeCollection.findMany.mockResolvedValue([{
      id: "collection", knowledgeBaseId: "space", name: "Collection",
      slug: "collection", metadata: {}
    }]);
    prisma.knowledgeFolder.findMany.mockResolvedValue([{
      id: "folder", knowledgeBaseId: "space", collectionId: "collection",
      parentId: null, name: "Folder", slug: "folder", metadata: {}
    }]);
    prisma.knowledgeCategory.findMany.mockResolvedValue([{
      id: "category", name: "Category", slug: "category", metadata: {}
    }]);
    prisma.knowledgeTag.findMany.mockResolvedValue([{
      id: "tag", name: "Tag", slug: "tag", metadata: {}
    }]);
    prisma.knowledgeDocument.findMany.mockResolvedValue([publishedDocument]);
    prisma.knowledgeVersion.findMany.mockResolvedValue([{
      id: "version", documentId: "document", revision: 2, snapshot: { name: "Document" }
    }]);
    prisma.retrievalRuntime.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        storedRuntime = {
          id: "runtime",
          ...data,
          latestSnapshotRevision: 0,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
          sources: [],
          collections: [],
          filters: [],
          variables: [],
          diagnostics: []
        };
        return Promise.resolve(storedRuntime);
      }
    );
    prisma.retrievalRuntime.findFirst.mockImplementation(() => Promise.resolve(storedRuntime));
    prisma.retrievalRuntime.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        storedRuntime = { ...storedRuntime, ...data, updatedAt: now };
        return Promise.resolve(storedRuntime);
      }
    );
    prisma.retrievalRuntime.findMany.mockResolvedValue([]);
    prisma.retrievalRuntime.count.mockResolvedValue(0);
    prisma.retrievalRuntimeSnapshot.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        id: `snapshot-${String(data.revision)}`, ...data, publishedAt: now, createdAt: now
      })
    );
    prisma.retrievalRuntimeSnapshot.findMany.mockResolvedValue([]);
    prisma.retrievalRuntimeSnapshot.count.mockResolvedValue(0);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("transactionally prepares immutable normalized metadata and audit", async () => {
    const result = await repository.prepare("workspace", "actor", dto());
    expect(result).toMatchObject({
      id: "runtime", workspaceId: "workspace", status: "PREPARED", knowledgeBaseId: "space"
    });
    expect(result.packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.retrievalRuntime.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sources: expect.objectContaining({ create: expect.arrayContaining([
          expect.objectContaining({ documentId: "document", versionId: "version" })
        ]) }),
        diagnostics: { create: [] }
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "retrieval.runtime.prepared" })
    }));
  });

  it("rejects unpublished or cross-workspace Knowledge sources and persists diagnostics", async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValueOnce([]);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(storedRuntime).toMatchObject({ status: "REJECTED" });
    expect(prisma.retrievalRuntime.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        diagnostics: expect.objectContaining({
          create: expect.arrayContaining([expect.objectContaining({ code: "SOURCE_NOT_PUBLISHED" })])
        })
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "retrieval.runtime.rejected" })
    }));
  });

  it("rejects missing published Knowledge versions", async () => {
    prisma.knowledgeVersion.findMany.mockResolvedValueOnce([]);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(storedRuntime).toMatchObject({ status: "REJECTED" });
  });

  it("rejects MIME, language, and hierarchy inconsistencies", async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValueOnce([{
      ...publishedDocument,
      mimeType: "application/pdf",
      language: "fr",
      folderId: "outside"
    }]);
    await expect(repository.prepare("workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    const diagnostics = (storedRuntime?.retrievalPackage as {
      validation: { diagnostics: Array<{ code: string }> };
    }).validation.diagnostics.map(({ code }) => code);
    expect(diagnostics).toEqual(expect.arrayContaining([
      "MIME_INCOMPATIBLE", "LANGUAGE_MISMATCH", "INVALID_HIERARCHY"
    ]));
  });

  it("publishes revisioned immutable snapshots and preserves the package", async () => {
    await repository.prepare("workspace", "actor", dto());
    const originalPackage = storedRuntime?.retrievalPackage;
    const first = await repository.publish("workspace", "actor", "runtime");
    expect(first).toMatchObject({ revision: 1, retrievalPackage: originalPackage });
    storedRuntime = { ...storedRuntime, latestSnapshotRevision: 1 };
    const second = await repository.publish("workspace", "actor", "runtime");
    expect(second).toMatchObject({ revision: 2 });
    expect("update" in prisma.retrievalRuntimeSnapshot).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "retrieval.runtime.snapshot_published" })
    }));
  });

  it("rejects publishing when source metadata drifts", async () => {
    await repository.prepare("workspace", "actor", dto());
    prisma.knowledgeVersion.findMany.mockResolvedValueOnce([{
      id: "version", documentId: "document", revision: 3, snapshot: { name: "Changed" }
    }]);
    await expect(repository.publish("workspace", "actor", "runtime"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.retrievalRuntimeSnapshot.create).not.toHaveBeenCalled();
  });

  it("archives and restores while preserving published snapshot history", async () => {
    await repository.prepare("workspace", "actor", dto());
    await repository.publish("workspace", "actor", "runtime");
    await expect(repository.archive("workspace", "actor", "runtime"))
      .resolves.toMatchObject({ status: "ARCHIVED" });
    await expect(repository.restore("workspace", "actor", "runtime"))
      .resolves.toMatchObject({ status: "PUBLISHED" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "retrieval.runtime.archived" })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "retrieval.runtime.restored" })
    }));
  });

  it("rolls back preparation when transactional audit persistence fails", async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(repository.prepare("workspace", "actor", dto())).rejects.toThrow("audit failed");
    expect(storedRuntime).toBeNull();
  });

  it("enforces workspace isolation for runtime and snapshot loads", async () => {
    storedRuntime = null;
    prisma.retrievalRuntimeSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.get("other-workspace", "runtime")).rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.getSnapshot("other-workspace", "snapshot"))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.retrievalRuntime.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "runtime", workspaceId: "other-workspace" }
    }));
  });

  it("filters and paginates runtime and snapshot history", async () => {
    await repository.list("workspace", {
      page: 2, limit: 10, status: "PUBLISHED", knowledgeBaseId: "space", search: "support"
    });
    await repository.listSnapshots("workspace", { page: 3, limit: 5, runtimeId: "runtime" });
    expect(prisma.retrievalRuntime.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", knowledgeBaseId: "space" }),
      skip: 10,
      take: 10
    }));
    expect(prisma.retrievalRuntimeSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace", runtimeId: "runtime" },
      skip: 10,
      take: 5
    }));
  });

  it("compares immutable snapshots and rejects missing records", async () => {
    const base = {
      id: "left", workspaceId: "workspace", runtimeId: "runtime", revision: 1,
      createdById: "actor", knowledgeBaseId: "space",
      retrievalPackage: { sources: [], collections: [], filters: [], variables: [], metadata: {} },
      packageHash: "hash", checksum: "checksum", publishedAt: now, createdAt: now
    };
    prisma.retrievalRuntimeSnapshot.findFirst
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, id: "right", revision: 2 });
    await expect(repository.compare("workspace", "left", "right"))
      .resolves.toMatchObject({ identical: true });
    prisma.retrievalRuntimeSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.compare("workspace", "left", "missing"))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
