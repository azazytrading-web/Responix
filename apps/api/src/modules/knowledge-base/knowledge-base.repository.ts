import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  KnowledgeSourceType,
  KnowledgeStatus,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateKnowledgeCollectionDto,
  CreateKnowledgeDocumentDto,
  CreateKnowledgeFolderDto,
  CreateKnowledgeSpaceDto,
  KnowledgeChunkMetadataDto,
  KnowledgeNamedDto,
  UpdateKnowledgeCollectionDto,
  UpdateKnowledgeDocumentDto,
  UpdateKnowledgeFolderDto,
  UpdateKnowledgeNamedDto,
  UpdateKnowledgeSpaceDto
} from "./dto/knowledge-base.dto";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

type DocumentSnapshot = {
  knowledgeBaseId: string;
  collectionId: string | null;
  folderId: string | null;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sourceType: KnowledgeSourceType;
  sourceMetadata: JsonRecord;
  fileMetadata: JsonRecord;
  urlMetadata: JsonRecord;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: string;
  language: string | null;
  checksum: string | null;
  parserMetadata: JsonRecord;
  chunkStrategy: JsonRecord;
  embeddingStatusMetadata: JsonRecord;
  syncMetadata: JsonRecord;
  importMetadata: JsonRecord;
  metadata: JsonRecord;
  tagIds: string[];
  chunks: KnowledgeChunkMetadataDto[];
};

@Injectable()
export class KnowledgeBaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSpace(workspaceId: string, actorId: string, dto: CreateKnowledgeSpaceDto) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        if (dto.categoryId) await this.requireCategory(tx, workspaceId, dto.categoryId);
        const space = await tx.knowledgeBase.create({
          data: {
            workspaceId,
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            categoryId: dto.categoryId,
            metadata: json(dto.metadata ?? {}),
            createdById: actorId,
            updatedById: actorId
          },
          select: this.spaceSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.space.created", "KnowledgeBase", space.id, null, space);
        return space;
      })
    );
  }

  updateSpace(
    workspaceId: string,
    actorId: string,
    spaceId: string,
    dto: UpdateKnowledgeSpaceDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireSpace(tx, workspaceId, spaceId);
        if (dto.categoryId) await this.requireCategory(tx, workspaceId, dto.categoryId);
        const space = await tx.knowledgeBase.update({
          where: { id: current.id },
          data: {
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            categoryId: dto.categoryId,
            metadata: dto.metadata === undefined ? undefined : json(dto.metadata),
            updatedById: actorId
          },
          select: this.spaceSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.space.updated", "KnowledgeBase", space.id, current, space);
        return space;
      })
    );
  }

  listSpaces(workspaceId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { name: "asc" },
      select: this.spaceSelect
    });
  }

  deleteSpace(workspaceId: string, actorId: string, spaceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireSpace(tx, workspaceId, spaceId);
      const [documents, collections] = await Promise.all([
        tx.knowledgeDocument.count({ where: { workspaceId, knowledgeBaseId: spaceId, deletedAt: null } }),
        tx.knowledgeCollection.count({ where: { workspaceId, knowledgeBaseId: spaceId, deletedAt: null } })
      ]);
      if (documents || collections) throw new ConflictException("Knowledge space is not empty");
      const space = await tx.knowledgeBase.update({
        where: { id: spaceId },
        data: { status: "ARCHIVED", archivedAt: new Date(), deletedAt: new Date(), updatedById: actorId },
        select: this.spaceSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.space.deleted", "KnowledgeBase", space.id, current, space);
      return space;
    });
  }

  createCollection(
    workspaceId: string,
    actorId: string,
    dto: CreateKnowledgeCollectionDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        await this.requireSpace(tx, workspaceId, dto.spaceId);
        const collection = await tx.knowledgeCollection.create({
          data: {
            workspaceId,
            knowledgeBaseId: dto.spaceId,
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            metadata: json(dto.metadata ?? {}),
            createdById: actorId,
            updatedById: actorId
          },
          select: this.collectionSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.collection.created", "KnowledgeCollection", collection.id, null, collection);
        return collection;
      })
    );
  }

  updateCollection(
    workspaceId: string,
    actorId: string,
    collectionId: string,
    dto: UpdateKnowledgeCollectionDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireCollection(tx, workspaceId, collectionId);
        if (dto.spaceId && dto.spaceId !== current.knowledgeBaseId) {
          throw new BadRequestException("Collections cannot be moved between knowledge spaces");
        }
        const collection = await tx.knowledgeCollection.update({
          where: { id: collectionId },
          data: {
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            metadata: dto.metadata === undefined ? undefined : json(dto.metadata),
            updatedById: actorId
          },
          select: this.collectionSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.collection.updated", "KnowledgeCollection", collection.id, current, collection);
        return collection;
      })
    );
  }

  listCollections(workspaceId: string, spaceId?: string) {
    return this.prisma.knowledgeCollection.findMany({
      where: { workspaceId, knowledgeBaseId: spaceId, deletedAt: null },
      orderBy: { name: "asc" },
      select: this.collectionSelect
    });
  }

  deleteCollection(workspaceId: string, actorId: string, collectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireCollection(tx, workspaceId, collectionId);
      const [documents, folders] = await Promise.all([
        tx.knowledgeDocument.count({ where: { workspaceId, collectionId, deletedAt: null } }),
        tx.knowledgeFolder.count({ where: { workspaceId, collectionId, deletedAt: null } })
      ]);
      if (documents || folders) throw new ConflictException("Knowledge collection is not empty");
      const collection = await tx.knowledgeCollection.update({
        where: { id: collectionId },
        data: { deletedAt: new Date(), updatedById: actorId },
        select: this.collectionSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.collection.deleted", "KnowledgeCollection", collection.id, current, collection);
      return collection;
    });
  }

  createFolder(workspaceId: string, actorId: string, dto: CreateKnowledgeFolderDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.validateFolderReferences(tx, workspaceId, dto.spaceId, dto.collectionId, dto.parentId);
      const folder = await tx.knowledgeFolder.create({
        data: {
          workspaceId,
          knowledgeBaseId: dto.spaceId,
          collectionId: dto.collectionId,
          parentId: dto.parentId,
          name: dto.name,
          slug: dto.slug,
          metadata: json(dto.metadata ?? {}),
          createdById: actorId,
          updatedById: actorId
        },
        select: this.folderSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.folder.created", "KnowledgeFolder", folder.id, null, folder);
      return folder;
    });
  }

  updateFolder(
    workspaceId: string,
    actorId: string,
    folderId: string,
    dto: UpdateKnowledgeFolderDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireFolder(tx, workspaceId, folderId);
      const spaceId = dto.spaceId ?? current.knowledgeBaseId;
      const collectionId = dto.collectionId ?? current.collectionId ?? undefined;
      if (spaceId !== current.knowledgeBaseId) {
        throw new BadRequestException("Folders cannot be moved between knowledge spaces");
      }
      await this.validateFolderReferences(tx, workspaceId, spaceId, collectionId, dto.parentId);
      if (dto.parentId !== undefined) {
        await this.assertNoFolderCycle(tx, workspaceId, folderId, dto.parentId);
      }
      const folder = await tx.knowledgeFolder.update({
        where: { id: folderId },
        data: {
          collectionId: dto.collectionId,
          parentId: dto.parentId,
          name: dto.name,
          slug: dto.slug,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata),
          updatedById: actorId
        },
        select: this.folderSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.folder.updated", "KnowledgeFolder", folder.id, current, folder);
      return folder;
    });
  }

  listFolders(workspaceId: string, spaceId?: string, collectionId?: string) {
    return this.prisma.knowledgeFolder.findMany({
      where: { workspaceId, knowledgeBaseId: spaceId, collectionId, deletedAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: this.folderSelect
    });
  }

  deleteFolder(workspaceId: string, actorId: string, folderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireFolder(tx, workspaceId, folderId);
      const [children, documents] = await Promise.all([
        tx.knowledgeFolder.count({ where: { workspaceId, parentId: folderId, deletedAt: null } }),
        tx.knowledgeDocument.count({ where: { workspaceId, folderId, deletedAt: null } })
      ]);
      if (children || documents) throw new ConflictException("Knowledge folder is not empty");
      const folder = await tx.knowledgeFolder.update({
        where: { id: folderId },
        data: { deletedAt: new Date(), updatedById: actorId },
        select: this.folderSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.folder.deleted", "KnowledgeFolder", folder.id, current, folder);
      return folder;
    });
  }

  createCategory(workspaceId: string, actorId: string, dto: KnowledgeNamedDto) {
    return this.createTaxonomy("category", workspaceId, actorId, dto);
  }

  createTag(workspaceId: string, actorId: string, dto: KnowledgeNamedDto) {
    return this.createTaxonomy("tag", workspaceId, actorId, dto);
  }

  updateCategory(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeNamedDto) {
    return this.updateTaxonomy("category", workspaceId, actorId, id, dto);
  }

  updateTag(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeNamedDto) {
    return this.updateTaxonomy("tag", workspaceId, actorId, id, dto);
  }

  listCategories(workspaceId: string) {
    return this.prisma.knowledgeCategory.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: this.taxonomySelect
    });
  }

  listTags(workspaceId: string) {
    return this.prisma.knowledgeTag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: this.taxonomySelect
    });
  }

  deleteCategory(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireCategory(tx, workspaceId, id);
      const [spaces, documents] = await Promise.all([
        tx.knowledgeBase.count({ where: { workspaceId, categoryId: id } }),
        tx.knowledgeDocument.count({ where: { workspaceId, categoryId: id } })
      ]);
      if (spaces || documents) throw new ConflictException("Knowledge category is in use");
      await tx.knowledgeCategory.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "knowledge.category.deleted", "KnowledgeCategory", id, current, null);
    });
  }

  deleteTag(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireTag(tx, workspaceId, id);
      const assignments = await tx.knowledgeTagAssignment.count({ where: { tagId: id } });
      if (assignments) throw new ConflictException("Knowledge tag is in use");
      await tx.knowledgeTag.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "knowledge.tag.deleted", "KnowledgeTag", id, current, null);
    });
  }

  createDocument(workspaceId: string, actorId: string, dto: CreateKnowledgeDocumentDto) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        await this.validateDocumentReferences(tx, workspaceId, dto);
        this.validateChunks(dto.chunks ?? []);
        this.validateSource(dto.sourceType, dto.sourceUrl, dto.urlMetadata);
        const document = await tx.knowledgeDocument.create({
          data: {
            ...this.documentData(dto, true),
            knowledgeBaseId: dto.spaceId,
            workspaceId,
            fileName: dto.fileName ?? dto.name,
            originalName: dto.originalName ?? dto.fileName ?? dto.name,
            mimeType: dto.mimeType ?? "application/octet-stream",
            fileSize: BigInt(dto.sizeBytes ?? 0),
            status: "DRAFT",
            revision: 0,
            uploadedById: actorId,
            createdById: actorId,
            updatedById: actorId,
            tags: { create: (dto.tagIds ?? []).map((tagId) => ({ tagId })) },
            chunks: { create: this.chunkData(workspaceId, dto.chunks ?? []) }
          },
          select: this.documentSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.document.created", "KnowledgeDocument", document.id, null, document);
        return document;
      })
    );
  }

  updateDocument(
    workspaceId: string,
    actorId: string,
    documentId: string,
    dto: UpdateKnowledgeDocumentDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireDocument(tx, workspaceId, documentId);
        this.assertDraft(current.status);
        const mergedReferences = {
          spaceId: dto.spaceId ?? current.knowledgeBaseId,
          collectionId: dto.collectionId ?? current.collectionId ?? undefined,
          folderId: dto.folderId ?? current.folderId ?? undefined,
          categoryId: dto.categoryId ?? current.categoryId ?? undefined,
          tagIds: dto.tagIds ?? current.tags.map(({ tag }) => tag.id)
        };
        if (mergedReferences.spaceId !== current.knowledgeBaseId) {
          throw new BadRequestException("Documents cannot be moved between knowledge spaces");
        }
        await this.validateDocumentReferences(tx, workspaceId, mergedReferences);
        if (dto.chunks) this.validateChunks(dto.chunks);
        this.validateSource(
          dto.sourceType ?? current.sourceType,
          dto.sourceUrl,
          dto.urlMetadata ?? record(current.urlMetadata)
        );
        const document = await tx.knowledgeDocument.update({
          where: { id: documentId },
          data: {
            ...this.documentData(dto),
            updatedById: actorId,
            tags:
              dto.tagIds === undefined
                ? undefined
                : { deleteMany: {}, create: dto.tagIds.map((tagId) => ({ tagId })) },
            chunks:
              dto.chunks === undefined
                ? undefined
                : { deleteMany: {}, create: this.chunkData(workspaceId, dto.chunks) }
          },
          select: this.documentSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.document.draft_updated", "KnowledgeDocument", document.id, current, document);
        return document;
      })
    );
  }

  publishDocument(
    workspaceId: string,
    actorId: string,
    documentId: string,
    changeSummary?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireDocument(tx, workspaceId, documentId);
      this.assertDraft(current.status);
      const revision = current.revision + 1;
      const snapshot = this.snapshot(current);
      const version = await tx.knowledgeVersion.create({
        data: {
          documentId,
          revision,
          snapshot: json(snapshot),
          changeSummary,
          createdById: actorId,
          publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const document = await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "PUBLISHED", revision, updatedById: actorId },
        select: this.documentSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.document.published", "KnowledgeDocument", document.id, current, { document, version });
      return { document, version };
    });
  }

  rollbackDocument(
    workspaceId: string,
    actorId: string,
    documentId: string,
    sourceRevision: number,
    changeSummary?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireDocument(tx, workspaceId, documentId, true);
      const source = await tx.knowledgeVersion.findFirst({
        where: { documentId, revision: sourceRevision, document: { workspaceId } },
        select: this.versionSelect
      });
      if (!source) throw new NotFoundException("Published knowledge version was not found");
      const snapshot = this.readSnapshot(source.snapshot);
      await this.validateSnapshotReferences(tx, workspaceId, snapshot);
      this.validateChunks(snapshot.chunks);
      const revision = current.revision + 1;
      const version = await tx.knowledgeVersion.create({
        data: {
          documentId,
          revision,
          snapshot: json(snapshot),
          changeSummary: changeSummary ?? `Rollback to revision ${sourceRevision}`,
          createdById: actorId,
          publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const document = await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          ...this.snapshotData(snapshot),
          status: "PUBLISHED",
          revision,
          archivedAt: null,
          deletedAt: null,
          updatedById: actorId,
          tags: { deleteMany: {}, create: snapshot.tagIds.map((tagId) => ({ tagId })) },
          chunks: { deleteMany: {}, create: this.chunkData(workspaceId, snapshot.chunks) }
        },
        select: this.documentSelect
      });
      await this.audit(tx, workspaceId, actorId, "knowledge.document.rolled_back", "KnowledgeDocument", document.id, current, { sourceRevision, document, version });
      return { document, version };
    });
  }

  cloneDocument(
    workspaceId: string,
    actorId: string,
    documentId: string,
    name: string,
    slug: string
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const source = await this.requireDocument(tx, workspaceId, documentId, true);
        const snapshot = this.snapshot(source);
        await this.validateSnapshotReferences(tx, workspaceId, snapshot);
        const document = await tx.knowledgeDocument.create({
          data: {
            ...this.snapshotData({ ...snapshot, name, slug }),
            workspaceId,
            name,
            slug,
            status: "DRAFT",
            revision: 0,
            uploadedById: actorId,
            createdById: actorId,
            updatedById: actorId,
            archivedAt: null,
            deletedAt: null,
            tags: { create: snapshot.tagIds.map((tagId) => ({ tagId })) },
            chunks: { create: this.chunkData(workspaceId, snapshot.chunks) }
          },
          select: this.documentSelect
        });
        await this.audit(tx, workspaceId, actorId, "knowledge.document.cloned", "KnowledgeDocument", document.id, null, { sourceDocumentId: source.id, document });
        return document;
      })
    );
  }

  archiveDocument(workspaceId: string, actorId: string, documentId: string) {
    return this.documentStateMutation(workspaceId, actorId, documentId, "archive");
  }

  restoreDocument(workspaceId: string, actorId: string, documentId: string) {
    return this.documentStateMutation(workspaceId, actorId, documentId, "restore");
  }

  softDeleteDocument(workspaceId: string, actorId: string, documentId: string) {
    return this.documentStateMutation(workspaceId, actorId, documentId, "delete");
  }

  getDocument(workspaceId: string, documentId: string) {
    return this.requireDocument(this.prisma, workspaceId, documentId);
  }

  async documentHistory(workspaceId: string, documentId: string) {
    await this.requireDocument(this.prisma, workspaceId, documentId, true);
    return this.prisma.knowledgeVersion.findMany({
      where: { documentId, document: { workspaceId } },
      orderBy: { revision: "desc" },
      select: this.versionSelect
    });
  }

  async listDocuments(input: {
    workspaceId: string;
    page: number;
    limit: number;
    search?: string;
    spaceId?: string;
    collectionId?: string;
    folderId?: string;
    status?: KnowledgeStatus;
    sourceType?: KnowledgeSourceType;
  }) {
    const where: Prisma.KnowledgeDocumentWhereInput = {
      workspaceId: input.workspaceId,
      deletedAt: null,
      knowledgeBaseId: input.spaceId,
      collectionId: input.collectionId,
      folderId: input.folderId,
      status: input.status,
      sourceType: input.sourceType,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
              { fileName: { contains: input.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.knowledgeDocument.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: this.documentSelect
      }),
      this.prisma.knowledgeDocument.count({ where })
    ]);
    return {
      data,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit)
      }
    };
  }

  private readonly spaceSelect = {
    id: true, workspaceId: true, name: true, slug: true, description: true, categoryId: true,
    metadata: true, status: true, createdById: true, updatedById: true, createdAt: true,
    updatedAt: true, archivedAt: true, deletedAt: true
  } as const;
  private readonly collectionSelect = {
    id: true, workspaceId: true, knowledgeBaseId: true, name: true, slug: true,
    description: true, metadata: true, createdById: true, updatedById: true,
    createdAt: true, updatedAt: true, deletedAt: true
  } as const;
  private readonly folderSelect = {
    id: true, workspaceId: true, knowledgeBaseId: true, collectionId: true, parentId: true,
    name: true, slug: true, metadata: true, createdById: true, updatedById: true,
    createdAt: true, updatedAt: true, deletedAt: true
  } as const;
  private readonly taxonomySelect = {
    id: true, workspaceId: true, name: true, slug: true, metadata: true,
    createdAt: true, updatedAt: true
  } as const;
  private readonly chunkSelect = {
    id: true, ordinal: true, checksum: true, tokenCount: true, characterCount: true,
    strategyMetadata: true, metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly documentSelect = {
    id: true, workspaceId: true, knowledgeBaseId: true, collectionId: true, folderId: true,
    categoryId: true, name: true, slug: true, description: true, sourceType: true,
    sourceMetadata: true, fileMetadata: true, urlMetadata: true, fileName: true,
    originalName: true, mimeType: true, fileSize: true, language: true, checksum: true,
    parserMetadata: true, chunkStrategy: true, embeddingStatusMetadata: true,
    syncMetadata: true, importMetadata: true, metadata: true, status: true, revision: true,
    createdById: true, updatedById: true, createdAt: true, updatedAt: true,
    archivedAt: true, deletedAt: true,
    chunks: { select: this.chunkSelect, orderBy: { ordinal: "asc" as const } },
    tags: { select: { tag: { select: this.taxonomySelect } }, orderBy: { tag: { name: "asc" as const } } }
  } as const;
  private readonly versionSelect = {
    id: true, documentId: true, revision: true, snapshot: true, changeSummary: true,
    createdById: true, createdAt: true, publishedAt: true
  } as const;

  private requireSpace(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.knowledgeBase.findFirst({ where: { id, workspaceId, deletedAt: null }, select: this.spaceSelect }).then((item) => {
      if (!item) throw new NotFoundException("Knowledge space was not found");
      return item;
    });
  }
  private requireCollection(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.knowledgeCollection.findFirst({ where: { id, workspaceId, deletedAt: null }, select: this.collectionSelect }).then((item) => {
      if (!item) throw new NotFoundException("Knowledge collection was not found");
      return item;
    });
  }
  private requireFolder(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.knowledgeFolder.findFirst({ where: { id, workspaceId, deletedAt: null }, select: this.folderSelect }).then((item) => {
      if (!item) throw new NotFoundException("Knowledge folder was not found");
      return item;
    });
  }
  private requireCategory(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.knowledgeCategory.findFirst({ where: { id, workspaceId }, select: this.taxonomySelect }).then((item) => {
      if (!item) throw new NotFoundException("Knowledge category was not found");
      return item;
    });
  }
  private requireTag(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.knowledgeTag.findFirst({ where: { id, workspaceId }, select: this.taxonomySelect }).then((item) => {
      if (!item) throw new NotFoundException("Knowledge tag was not found");
      return item;
    });
  }
  private requireDocument(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    includeDeleted = false
  ) {
    return client.knowledgeDocument.findFirst({
      where: { id, workspaceId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: this.documentSelect
    }).then((item) => {
      if (!item) throw new NotFoundException("Knowledge document was not found");
      return item;
    });
  }

  private async validateFolderReferences(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    spaceId: string,
    collectionId?: string,
    parentId?: string
  ) {
    await this.requireSpace(tx, workspaceId, spaceId);
    if (collectionId) {
      const collection = await this.requireCollection(tx, workspaceId, collectionId);
      if (collection.knowledgeBaseId !== spaceId) throw new BadRequestException("Collection is not in the knowledge space");
    }
    if (parentId) {
      const parent = await this.requireFolder(tx, workspaceId, parentId);
      if (parent.knowledgeBaseId !== spaceId || parent.collectionId !== (collectionId ?? null)) {
        throw new BadRequestException("Parent folder is not in the same hierarchy");
      }
    }
  }

  private async assertNoFolderCycle(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    folderId: string,
    parentId?: string
  ) {
    const visited = new Set([folderId]);
    let cursor = parentId;
    while (cursor) {
      if (visited.has(cursor)) throw new BadRequestException("Folder hierarchy cannot contain a cycle");
      visited.add(cursor);
      const parent = await this.requireFolder(tx, workspaceId, cursor);
      cursor = parent.parentId ?? undefined;
    }
  }

  private async validateDocumentReferences(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    dto: {
      spaceId: string;
      collectionId?: string;
      folderId?: string;
      categoryId?: string;
      tagIds?: string[];
    }
  ) {
    await this.requireSpace(tx, workspaceId, dto.spaceId);
    if (dto.collectionId) {
      const collection = await this.requireCollection(tx, workspaceId, dto.collectionId);
      if (collection.knowledgeBaseId !== dto.spaceId) throw new BadRequestException("Collection is not in the knowledge space");
    }
    if (dto.folderId) {
      const folder = await this.requireFolder(tx, workspaceId, dto.folderId);
      if (
        folder.knowledgeBaseId !== dto.spaceId ||
        folder.collectionId !== (dto.collectionId ?? null)
      ) throw new BadRequestException("Folder is not in the document hierarchy");
    }
    if (dto.categoryId) await this.requireCategory(tx, workspaceId, dto.categoryId);
    const tagIds = dto.tagIds ?? [];
    if (new Set(tagIds).size !== tagIds.length) throw new BadRequestException("Knowledge tags must be unique");
    if (tagIds.length) {
      const count = await tx.knowledgeTag.count({ where: { workspaceId, id: { in: tagIds } } });
      if (count !== tagIds.length) throw new BadRequestException("One or more knowledge tags are not in this workspace");
    }
  }

  private validateSnapshotReferences(tx: Prisma.TransactionClient, workspaceId: string, snapshot: DocumentSnapshot) {
    return this.validateDocumentReferences(tx, workspaceId, {
      spaceId: snapshot.knowledgeBaseId,
      collectionId: snapshot.collectionId ?? undefined,
      folderId: snapshot.folderId ?? undefined,
      categoryId: snapshot.categoryId ?? undefined,
      tagIds: snapshot.tagIds
    });
  }

  private validateChunks(chunks: KnowledgeChunkMetadataDto[]) {
    const ordinals = chunks.map((chunk) => chunk.ordinal);
    if (new Set(ordinals).size !== ordinals.length) {
      throw new BadRequestException("Knowledge chunk ordinals must be unique");
    }
  }

  private documentData(
    dto: UpdateKnowledgeDocumentDto | CreateKnowledgeDocumentDto,
    create = false
  ) {
    const urlMetadata = { ...(dto.urlMetadata ?? {}), ...(dto.sourceUrl ? { url: dto.sourceUrl } : {}) };
    return {
      collectionId: dto.collectionId,
      folderId: dto.folderId,
      categoryId: dto.categoryId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      sourceType: dto.sourceType,
      sourceMetadata: dto.sourceMetadata === undefined ? undefined : json(dto.sourceMetadata),
      fileMetadata: dto.fileMetadata === undefined ? undefined : json(dto.fileMetadata),
      urlMetadata: dto.urlMetadata === undefined && !dto.sourceUrl ? undefined : json(urlMetadata),
      fileName: dto.fileName ?? (create ? dto.name : undefined),
      originalName: dto.originalName ?? (create ? dto.fileName ?? dto.name : undefined),
      mimeType: dto.mimeType ?? (create ? "application/octet-stream" : undefined),
      fileSize: dto.sizeBytes === undefined ? undefined : BigInt(dto.sizeBytes),
      language: dto.language,
      checksum: dto.checksum,
      parserMetadata: dto.parserMetadata === undefined ? undefined : json(dto.parserMetadata),
      chunkStrategy: dto.chunkStrategy === undefined ? undefined : json(dto.chunkStrategy),
      embeddingStatusMetadata: dto.embeddingStatusMetadata === undefined ? undefined : json(dto.embeddingStatusMetadata),
      syncMetadata: dto.syncMetadata === undefined ? undefined : json(dto.syncMetadata),
      importMetadata: dto.importMetadata === undefined ? undefined : json(dto.importMetadata),
      metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
    };
  }

  private chunkData(workspaceId: string, chunks: KnowledgeChunkMetadataDto[]) {
    return chunks.map((chunk) => ({
      workspaceId,
      ordinal: chunk.ordinal,
      checksum: chunk.checksum,
      tokenCount: chunk.tokenCount,
      characterCount: chunk.characterCount,
      strategyMetadata: json(chunk.strategyMetadata ?? {}),
      metadata: json(chunk.metadata ?? {})
    }));
  }

  private validateSource(
    sourceType: KnowledgeSourceType,
    sourceUrl?: string,
    urlMetadata?: JsonRecord
  ) {
    if (sourceType !== "URL") return;
    const candidate = sourceUrl ?? urlMetadata?.url;
    if (typeof candidate !== "string") {
      throw new BadRequestException("URL knowledge sources require a source URL");
    }
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid protocol");
    } catch {
      throw new BadRequestException("Knowledge source URL must be a valid HTTP or HTTPS URL");
    }
  }

  private snapshot(document: Awaited<ReturnType<KnowledgeBaseRepository["requireDocument"]>>): DocumentSnapshot {
    return {
      knowledgeBaseId: document.knowledgeBaseId,
      collectionId: document.collectionId,
      folderId: document.folderId,
      categoryId: document.categoryId,
      name: document.name ?? document.originalName,
      slug: document.slug ?? document.id,
      description: document.description,
      sourceType: document.sourceType,
      sourceMetadata: record(document.sourceMetadata),
      fileMetadata: record(document.fileMetadata),
      urlMetadata: record(document.urlMetadata),
      fileName: document.fileName,
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSize: document.fileSize.toString(),
      language: document.language,
      checksum: document.checksum,
      parserMetadata: record(document.parserMetadata),
      chunkStrategy: record(document.chunkStrategy),
      embeddingStatusMetadata: record(document.embeddingStatusMetadata),
      syncMetadata: record(document.syncMetadata),
      importMetadata: record(document.importMetadata),
      metadata: record(document.metadata),
      tagIds: document.tags.map(({ tag }) => tag.id),
      chunks: document.chunks.map((chunk) => ({
        ordinal: chunk.ordinal,
        checksum: chunk.checksum ?? undefined,
        tokenCount: chunk.tokenCount ?? undefined,
        characterCount: chunk.characterCount ?? undefined,
        strategyMetadata: record(chunk.strategyMetadata),
        metadata: record(chunk.metadata)
      }))
    };
  }

  private snapshotData(snapshot: DocumentSnapshot) {
    return {
      knowledgeBaseId: snapshot.knowledgeBaseId,
      collectionId: snapshot.collectionId,
      folderId: snapshot.folderId,
      categoryId: snapshot.categoryId,
      name: snapshot.name,
      slug: snapshot.slug,
      description: snapshot.description,
      sourceType: snapshot.sourceType,
      sourceMetadata: json(snapshot.sourceMetadata),
      fileMetadata: json(snapshot.fileMetadata),
      urlMetadata: json(snapshot.urlMetadata),
      fileName: snapshot.fileName,
      originalName: snapshot.originalName,
      mimeType: snapshot.mimeType,
      fileSize: BigInt(snapshot.fileSize),
      language: snapshot.language,
      checksum: snapshot.checksum,
      parserMetadata: json(snapshot.parserMetadata),
      chunkStrategy: json(snapshot.chunkStrategy),
      embeddingStatusMetadata: json(snapshot.embeddingStatusMetadata),
      syncMetadata: json(snapshot.syncMetadata),
      importMetadata: json(snapshot.importMetadata),
      metadata: json(snapshot.metadata)
    };
  }

  private readSnapshot(value: Prisma.JsonValue): DocumentSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("Published knowledge version has an invalid snapshot");
    }
    const snapshot = value as Record<string, unknown>;
    if (
      typeof snapshot.knowledgeBaseId !== "string" ||
      typeof snapshot.name !== "string" ||
      typeof snapshot.slug !== "string" ||
      typeof snapshot.fileSize !== "string" ||
      !Array.isArray(snapshot.tagIds) ||
      !Array.isArray(snapshot.chunks)
    ) throw new ConflictException("Published knowledge version has an invalid snapshot");
    try {
      BigInt(snapshot.fileSize);
    } catch {
      throw new ConflictException("Published knowledge version has an invalid file size");
    }
    return snapshot as DocumentSnapshot;
  }

  private documentStateMutation(
    workspaceId: string,
    actorId: string,
    documentId: string,
    operation: "archive" | "restore" | "delete"
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireDocument(tx, workspaceId, documentId, operation === "restore");
      if (operation === "restore" && current.status !== "ARCHIVED" && !current.deletedAt) {
        throw new ConflictException("Only archived or deleted knowledge documents can be restored");
      }
      const now = new Date();
      const data =
        operation === "restore"
          ? {
              status: current.revision > 0 ? ("PUBLISHED" as const) : ("DRAFT" as const),
              archivedAt: null,
              deletedAt: null,
              updatedById: actorId
            }
          : {
              status: "ARCHIVED" as const,
              archivedAt: now,
              deletedAt: operation === "delete" ? now : undefined,
              updatedById: actorId
            };
      const document = await tx.knowledgeDocument.update({
        where: { id: documentId },
        data,
        select: this.documentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        `knowledge.document.${operation === "delete" ? "deleted" : `${operation}d`}`,
        "KnowledgeDocument",
        document.id,
        current,
        document
      );
      return document;
    });
  }

  private async createTaxonomy(
    kind: "category" | "tag",
    workspaceId: string,
    actorId: string,
    dto: KnowledgeNamedDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const item =
          kind === "category"
            ? await tx.knowledgeCategory.create({
                data: { workspaceId, name: dto.name, slug: dto.slug, metadata: json(dto.metadata ?? {}) },
                select: this.taxonomySelect
              })
            : await tx.knowledgeTag.create({
                data: { workspaceId, name: dto.name, slug: dto.slug, metadata: json(dto.metadata ?? {}) },
                select: this.taxonomySelect
              });
        await this.audit(tx, workspaceId, actorId, `knowledge.${kind}.created`, kind === "category" ? "KnowledgeCategory" : "KnowledgeTag", item.id, null, item);
        return item;
      })
    );
  }

  private async updateTaxonomy(
    kind: "category" | "tag",
    workspaceId: string,
    actorId: string,
    id: string,
    dto: UpdateKnowledgeNamedDto
  ) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current =
          kind === "category"
            ? await this.requireCategory(tx, workspaceId, id)
            : await this.requireTag(tx, workspaceId, id);
        const data = {
          name: dto.name,
          slug: dto.slug,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
        };
        const item =
          kind === "category"
            ? await tx.knowledgeCategory.update({ where: { id }, data, select: this.taxonomySelect })
            : await tx.knowledgeTag.update({ where: { id }, data, select: this.taxonomySelect });
        await this.audit(tx, workspaceId, actorId, `knowledge.${kind}.updated`, kind === "category" ? "KnowledgeCategory" : "KnowledgeTag", item.id, current, item);
        return item;
      })
    );
  }

  private assertDraft(status: KnowledgeStatus) {
    if (status !== "DRAFT") throw new BadRequestException("Only draft knowledge documents can be modified");
  }

  private async audit(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await tx.auditLog.create({
      data: {
        workspaceId,
        userId: actorId,
        action,
        entityType,
        entityId,
        oldValues: before === null ? Prisma.JsonNull : json(before),
        newValues: after === null ? Prisma.JsonNull : json(after)
      }
    });
  }

  private async withUniqueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A knowledge resource with this name or slug already exists");
      }
      throw error;
    }
  }
}
