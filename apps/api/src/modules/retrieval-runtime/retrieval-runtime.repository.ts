import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RetrievalRuntimeStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  PrepareRetrievalRuntimeDto,
  RetrievalRuntimeListQueryDto,
  RetrievalSnapshotListQueryDto
} from "./dto/retrieval-runtime.dto";
import {
  RetrievalRuntimeValidator,
  type RetrievalDiagnostic,
  type RetrievalValidationResult
} from "./retrieval-runtime.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const jsonValue = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === null ? Prisma.JsonNull : json(value);

@Injectable()
export class RetrievalRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: RetrievalRuntimeValidator
  ) {}

  async prepare(workspaceId: string, actorId: string, dto: PrepareRetrievalRuntimeDto) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const assembled = await this.assemble(tx, workspaceId, dto);
      const status = assembled.validation.valid
        ? RetrievalRuntimeStatus.PREPARED
        : RetrievalRuntimeStatus.REJECTED;
      const runtime = await tx.retrievalRuntime.create({
        data: {
          workspaceId,
          createdById: actorId,
          knowledgeBaseId: dto.knowledgeBaseId,
          name: dto.name,
          language: dto.language,
          allowedMimeTypes: dto.allowedMimeTypes ?? [],
          status,
          metadata: json(dto.metadata ?? {}),
          retrievalPackage: json(assembled.package),
          packageHash: assembled.packageHash,
          checksum: assembled.checksum,
          sources: {
            create: assembled.sources.map((source) => ({
              documentId: source.documentId,
              versionId: source.versionId,
              sourceType: source.sourceType,
              mimeType: source.mimeType,
              language: source.language,
              metadata: json(source.metadata)
            }))
          },
          collections: {
            create: assembled.collections.map((collection) => ({
              collectionId: collection.collectionId,
              metadata: json(collection.metadata)
            }))
          },
          filters: {
            create: (dto.filters ?? []).map((filter) => ({
              key: filter.key,
              operator: filter.operator,
              value: jsonValue(filter.value),
              metadata: json(filter.metadata ?? {})
            }))
          },
          variables: {
            create: (dto.variables ?? []).map((variable) => ({
              name: variable.name,
              type: variable.type,
              value: jsonValue(variable.value),
              metadata: json(variable.metadata ?? {})
            }))
          },
          diagnostics: {
            create: assembled.validation.diagnostics.map((diagnostic) => ({
              severity: diagnostic.severity,
              code: diagnostic.code,
              path: diagnostic.path,
              message: diagnostic.message,
              metadata: json(diagnostic.metadata ?? {})
            }))
          }
        },
        select: this.runtimeSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        assembled.validation.valid ? "retrieval.runtime.prepared" : "retrieval.runtime.rejected",
        "RetrievalRuntime",
        runtime.id,
        null,
        runtime
      );
      return { runtime, validation: assembled.validation };
    });
    if (!outcome.validation.valid) this.throwValidation(outcome.validation);
    return outcome.runtime;
  }

  async validate(workspaceId: string, actorId: string, id: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, id);
      const input = this.record(runtime.retrievalPackage).input as PrepareRetrievalRuntimeDto;
      const assembled = await this.assemble(tx, workspaceId, input);
      if (assembled.packageHash !== runtime.packageHash) {
        assembled.validation.diagnostics.push(this.error(
          "SOURCE_METADATA_CHANGED",
          "runtime",
          "Published Knowledge metadata no longer matches the immutable prepared package"
        ));
        assembled.validation.valid = false;
      }
      await this.audit(
        tx,
        workspaceId,
        actorId,
        assembled.validation.valid ? "retrieval.runtime.validated" : "retrieval.runtime.validation_failed",
        "RetrievalRuntime",
        id,
        null,
        assembled.validation
      );
      return assembled.validation;
    });
    if (!outcome.valid) this.throwValidation(outcome);
    return outcome;
  }

  async publish(workspaceId: string, actorId: string, id: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, id);
      if (runtime.status === RetrievalRuntimeStatus.ARCHIVED) {
        throw new BadRequestException("Archived Retrieval Runtime must be restored before publishing");
      }
      if (runtime.status === RetrievalRuntimeStatus.REJECTED) {
        throw new BadRequestException("Rejected Retrieval Runtime cannot be published");
      }
      const input = this.record(runtime.retrievalPackage).input as PrepareRetrievalRuntimeDto;
      const assembled = await this.assemble(tx, workspaceId, input);
      if (assembled.packageHash !== runtime.packageHash) {
        assembled.validation.diagnostics.push(this.error(
          "SOURCE_METADATA_CHANGED", "runtime", "Knowledge metadata changed before publishing"
        ));
        assembled.validation.valid = false;
      }
      if (!assembled.validation.valid) {
        await this.audit(tx, workspaceId, actorId, "retrieval.runtime.publish_rejected",
          "RetrievalRuntime", id, null, assembled.validation);
        return { ok: false as const, validation: assembled.validation };
      }
      const revision = runtime.latestSnapshotRevision + 1;
      const snapshot = await tx.retrievalRuntimeSnapshot.create({
        data: {
          workspaceId,
          runtimeId: runtime.id,
          revision,
          createdById: actorId,
          knowledgeBaseId: runtime.knowledgeBaseId,
          retrievalPackage: json(runtime.retrievalPackage),
          packageHash: runtime.packageHash,
          checksum: runtime.checksum
        },
        select: this.snapshotSelect
      });
      await tx.retrievalRuntime.update({
        where: { id: runtime.id },
        data: {
          status: RetrievalRuntimeStatus.PUBLISHED,
          latestSnapshotRevision: revision
        }
      });
      await this.audit(tx, workspaceId, actorId, "retrieval.runtime.snapshot_published",
        "RetrievalRuntimeSnapshot", snapshot.id, null, snapshot);
      return { ok: true as const, snapshot };
    });
    if (!outcome.ok) this.throwValidation(outcome.validation);
    return outcome.snapshot;
  }

  async archive(workspaceId: string, actorId: string, id: string) {
    return this.lifecycle(workspaceId, actorId, id, RetrievalRuntimeStatus.ARCHIVED,
      "retrieval.runtime.archived", { archivedAt: new Date() });
  }

  async restore(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id);
      if (current.status !== RetrievalRuntimeStatus.ARCHIVED) {
        throw new BadRequestException("Only archived Retrieval Runtime records can be restored");
      }
      const status = current.latestSnapshotRevision > 0
        ? RetrievalRuntimeStatus.PUBLISHED
        : RetrievalRuntimeStatus.PREPARED;
      const updated = await tx.retrievalRuntime.update({
        where: { id: current.id },
        data: { status, archivedAt: null },
        select: this.runtimeSelect
      });
      await this.audit(tx, workspaceId, actorId, "retrieval.runtime.restored",
        "RetrievalRuntime", id, current, updated);
      return updated;
    });
  }

  get(workspaceId: string, id: string) {
    return this.requireRuntime(this.prisma, workspaceId, id);
  }

  getSnapshot(workspaceId: string, id: string) {
    return this.requireSnapshot(this.prisma, workspaceId, id);
  }

  async list(workspaceId: string, query: RetrievalRuntimeListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.RetrievalRuntimeWhereInput = {
      workspaceId,
      status: query.status,
      knowledgeBaseId: query.knowledgeBaseId,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.retrievalRuntime.findMany({
        where,
        select: this.runtimeSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.retrievalRuntime.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listSnapshots(workspaceId: string, query: RetrievalSnapshotListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.RetrievalRuntimeSnapshotWhereInput = {
      workspaceId,
      runtimeId: query.runtimeId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.retrievalRuntimeSnapshot.findMany({
        where,
        select: this.snapshotSelect,
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.retrievalRuntimeSnapshot.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async compare(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await this.prisma.$transaction([
      this.prisma.retrievalRuntimeSnapshot.findFirst({
        where: { id: leftId, workspaceId },
        select: this.snapshotSelect
      }),
      this.prisma.retrievalRuntimeSnapshot.findFirst({
        where: { id: rightId, workspaceId },
        select: this.snapshotSelect
      })
    ]);
    if (!left || !right) {
      throw new NotFoundException("One or more Retrieval Runtime snapshots were not found");
    }
    const leftPackage = this.record(left.retrievalPackage);
    const rightPackage = this.record(right.retrievalPackage);
    return {
      identical: left.packageHash === right.packageHash && left.checksum === right.checksum,
      left: this.snapshotIdentity(left),
      right: this.snapshotIdentity(right),
      changed: {
        space: left.knowledgeBaseId !== right.knowledgeBaseId,
        sources: this.stableStringify(leftPackage.sources) !== this.stableStringify(rightPackage.sources),
        collections: this.stableStringify(leftPackage.collections) !==
          this.stableStringify(rightPackage.collections),
        filters: this.stableStringify(leftPackage.filters) !== this.stableStringify(rightPackage.filters),
        variables: this.stableStringify(leftPackage.variables) !== this.stableStringify(rightPackage.variables),
        metadata: this.stableStringify(leftPackage.metadata) !== this.stableStringify(rightPackage.metadata)
      }
    };
  }

  private async lifecycle(
    workspaceId: string,
    actorId: string,
    id: string,
    status: RetrievalRuntimeStatus,
    action: string,
    extra: { archivedAt: Date | null }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id);
      if (current.status === status) throw new BadRequestException(`Retrieval Runtime is already ${status}`);
      if (current.status === RetrievalRuntimeStatus.REJECTED) {
        throw new BadRequestException("Rejected Retrieval Runtime cannot change lifecycle state");
      }
      const updated = await tx.retrievalRuntime.update({
        where: { id: current.id },
        data: { status, ...extra },
        select: this.runtimeSelect
      });
      await this.audit(tx, workspaceId, actorId, action, "RetrievalRuntime", id, current, updated);
      return updated;
    });
  }

  private async assemble(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    dto: PrepareRetrievalRuntimeDto
  ) {
    const diagnostics: RetrievalDiagnostic[] = [];
    const space = await tx.knowledgeBase.findFirst({
      where: {
        id: dto.knowledgeBaseId,
        workspaceId,
        status: "PUBLISHED",
        archivedAt: null,
        deletedAt: null
      },
      select: { id: true, name: true, slug: true, categoryId: true, metadata: true, status: true }
    });
    if (!space) diagnostics.push(this.error("KNOWLEDGE_SPACE_NOT_PUBLISHED", "knowledgeBaseId",
      "Knowledge Space must be published, active, and belong to the workspace"));

    const requestedCollectionIds = dto.collections?.map(({ collectionId }) => collectionId) ?? [];
    const collections = requestedCollectionIds.length ? await tx.knowledgeCollection.findMany({
      where: {
        id: { in: requestedCollectionIds },
        workspaceId,
        knowledgeBaseId: dto.knowledgeBaseId,
        deletedAt: null
      },
      select: { id: true, knowledgeBaseId: true, name: true, slug: true, metadata: true }
    }) : [];
    this.missing(diagnostics, requestedCollectionIds, collections.map(({ id }) => id),
      "COLLECTION_NOT_FOUND", "collections");

    const folders = (dto.folderIds?.length ?? 0) > 0 ? await tx.knowledgeFolder.findMany({
      where: {
        id: { in: dto.folderIds },
        workspaceId,
        knowledgeBaseId: dto.knowledgeBaseId,
        deletedAt: null
      },
      select: {
        id: true, knowledgeBaseId: true, collectionId: true, parentId: true,
        name: true, slug: true, metadata: true
      }
    }) : [];
    this.missing(diagnostics, dto.folderIds ?? [], folders.map(({ id }) => id),
      "FOLDER_NOT_FOUND", "folderIds");
    for (const folder of folders) {
      if (folder.collectionId && requestedCollectionIds.length &&
        !requestedCollectionIds.includes(folder.collectionId)) {
        diagnostics.push(this.error("INVALID_HIERARCHY", "folderIds",
          `Folder ${folder.id} belongs to a collection outside the retrieval package`));
      }
      if (folder.parentId && dto.folderIds?.includes(folder.parentId) === false) {
        diagnostics.push(this.error("INVALID_HIERARCHY", "folderIds",
          `Folder ${folder.id} has a parent outside the retrieval package`));
      }
    }

    const categories = (dto.categoryIds?.length ?? 0) > 0 ? await tx.knowledgeCategory.findMany({
      where: { id: { in: dto.categoryIds }, workspaceId },
      select: { id: true, name: true, slug: true, metadata: true }
    }) : [];
    this.missing(diagnostics, dto.categoryIds ?? [], categories.map(({ id }) => id),
      "CATEGORY_NOT_FOUND", "categoryIds");
    const tags = (dto.tagIds?.length ?? 0) > 0 ? await tx.knowledgeTag.findMany({
      where: { id: { in: dto.tagIds }, workspaceId },
      select: { id: true, name: true, slug: true, metadata: true }
    }) : [];
    this.missing(diagnostics, dto.tagIds ?? [], tags.map(({ id }) => id),
      "TAG_NOT_FOUND", "tagIds");

    const requestedDocumentIds = dto.sources?.map(({ documentId }) => documentId) ?? [];
    const documents = requestedDocumentIds.length ? await tx.knowledgeDocument.findMany({
      where: {
        id: { in: requestedDocumentIds },
        workspaceId,
        knowledgeBaseId: dto.knowledgeBaseId,
        status: "PUBLISHED",
        archivedAt: null,
        deletedAt: null
      },
      select: {
        id: true, knowledgeBaseId: true, collectionId: true, folderId: true, categoryId: true,
        name: true, slug: true, sourceType: true, sourceMetadata: true, fileMetadata: true,
        urlMetadata: true, mimeType: true, fileSize: true, language: true, checksum: true,
        parserMetadata: true, chunkStrategy: true, metadata: true, revision: true,
        tags: { select: { tagId: true } }
      }
    }) : [];
    this.missing(diagnostics, requestedDocumentIds, documents.map(({ id }) => id),
      "SOURCE_NOT_PUBLISHED", "sources");
    const requestedVersionIds = dto.sources?.map(({ versionId }) => versionId) ?? [];
    const versions = requestedVersionIds.length ? await tx.knowledgeVersion.findMany({
      where: {
        id: { in: requestedVersionIds },
        documentId: { in: requestedDocumentIds },
        document: { workspaceId, knowledgeBaseId: dto.knowledgeBaseId }
      },
      select: { id: true, documentId: true, revision: true, snapshot: true }
    }) : [];
    this.missing(diagnostics, requestedVersionIds, versions.map(({ id }) => id),
      "PUBLISHED_VERSION_NOT_FOUND", "sources.versionId");

    const sourceInput = new Map((dto.sources ?? []).map((source) => [source.documentId, source]));
    const versionMap = new Map(versions.map((version) => [version.id, version]));
    const allowedMimeTypes = dto.allowedMimeTypes?.map((mime) => mime.toLowerCase()) ?? [];
    const resolvedSources = documents.flatMap((document) => {
      const input = sourceInput.get(document.id);
      if (!input) return [];
      const version = versionMap.get(input.versionId);
      if (!version || version.documentId !== document.id) {
        diagnostics.push(this.error("VERSION_SOURCE_MISMATCH", "sources",
          `Version ${input.versionId} does not belong to document ${document.id}`));
        return [];
      }
      if (dto.language && document.language &&
        dto.language.toLowerCase() !== document.language.toLowerCase()) {
        diagnostics.push(this.error("LANGUAGE_MISMATCH", "sources",
          `Document ${document.id} language is incompatible with the runtime language`));
      }
      if (allowedMimeTypes.length && !this.mimeAllowed(document.mimeType, allowedMimeTypes)) {
        diagnostics.push(this.error("MIME_INCOMPATIBLE", "sources",
          `Document ${document.id} MIME type is not allowed`));
      }
      if (document.collectionId && requestedCollectionIds.length &&
        !requestedCollectionIds.includes(document.collectionId)) {
        diagnostics.push(this.error("INVALID_HIERARCHY", "sources",
          `Document ${document.id} belongs to a collection outside the retrieval package`));
      }
      if (document.folderId && dto.folderIds?.length && !dto.folderIds.includes(document.folderId)) {
        diagnostics.push(this.error("INVALID_HIERARCHY", "sources",
          `Document ${document.id} belongs to a folder outside the retrieval package`));
      }
      return [{
        documentId: document.id,
        versionId: version.id,
        sourceType: document.sourceType,
        mimeType: document.mimeType,
        language: document.language,
        metadata: input.metadata ?? {},
        document: {
          id: document.id,
          name: document.name,
          slug: document.slug,
          collectionId: document.collectionId,
          folderId: document.folderId,
          categoryId: document.categoryId,
          tagIds: document.tags.map(({ tagId }) => tagId),
          sourceType: document.sourceType,
          sourceMetadata: document.sourceMetadata,
          fileMetadata: document.fileMetadata,
          urlMetadata: document.urlMetadata,
          mimeType: document.mimeType,
          sizeBytes: document.fileSize.toString(),
          language: document.language,
          checksum: document.checksum,
          parserMetadata: document.parserMetadata,
          chunkStrategy: document.chunkStrategy,
          metadata: document.metadata,
          revision: document.revision
        },
        version: {
          id: version.id,
          revision: version.revision,
          snapshot: version.snapshot
        }
      }];
    });

    const validation = this.validator.validate(dto, diagnostics);
    const corePackage = {
      input: dto,
      workspaceId,
      space: space ?? { id: dto.knowledgeBaseId, unavailable: true },
      sources: resolvedSources.map(({ documentId, versionId, sourceType, mimeType, language,
        metadata, document, version }) => ({
        documentId, versionId, sourceType, mimeType, language, metadata, document, version
      })),
      collections: collections.map((collection) => ({
        ...collection,
        metadata: dto.collections?.find(({ collectionId }) => collectionId === collection.id)?.metadata ??
          collection.metadata
      })),
      folders,
      categories,
      tags,
      filters: dto.filters ?? [],
      variables: dto.variables ?? [],
      metadata: dto.metadata ?? {}
    };
    const packageHash = this.hash(corePackage);
    const checksum = this.hash({ packageHash, sourceVersions: resolvedSources.map(({ versionId }) => versionId) });
    return {
      package: {
        ...corePackage,
        validation,
        hashes: { packageHash, checksum },
        preparedAt: new Date().toISOString()
      },
      packageHash,
      checksum,
      validation,
      sources: resolvedSources,
      collections: collections.map((collection) => ({
        collectionId: collection.id,
        metadata: dto.collections?.find(({ collectionId }) => collectionId === collection.id)?.metadata ?? {}
      }))
    };
  }

  private readonly runtimeSelect = {
    id: true, workspaceId: true, createdById: true, knowledgeBaseId: true,
    name: true, language: true, allowedMimeTypes: true, status: true, metadata: true,
    retrievalPackage: true, packageHash: true, checksum: true, latestSnapshotRevision: true,
    archivedAt: true, createdAt: true, updatedAt: true,
    sources: true, collections: true, filters: true, variables: true, diagnostics: true
  } as const;

  private readonly snapshotSelect = {
    id: true, workspaceId: true, runtimeId: true, revision: true, createdById: true,
    knowledgeBaseId: true, retrievalPackage: true, packageHash: true, checksum: true,
    publishedAt: true, createdAt: true
  } as const;

  private requireRuntime(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.retrievalRuntime.findFirst({
      where: { id, workspaceId },
      select: this.runtimeSelect
    }).then((runtime) => {
      if (!runtime) throw new NotFoundException("Retrieval Runtime was not found");
      return runtime;
    });
  }

  private requireSnapshot(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.retrievalRuntimeSnapshot.findFirst({
      where: { id, workspaceId },
      select: this.snapshotSelect
    }).then((snapshot) => {
      if (!snapshot) throw new NotFoundException("Retrieval Runtime snapshot was not found");
      return snapshot;
    });
  }

  private missing(
    diagnostics: RetrievalDiagnostic[],
    requested: string[],
    found: string[],
    code: string,
    path: string
  ) {
    const missing = [...new Set(requested)].filter((id) => !found.includes(id));
    if (missing.length) diagnostics.push({
      ...this.error(code, path, "One or more references are unavailable in the active workspace"),
      metadata: { ids: missing }
    });
  }

  private mimeAllowed(mimeType: string, allowed: string[]) {
    const normalized = mimeType.toLowerCase();
    return allowed.some((candidate) =>
      candidate === normalized || (candidate.endsWith("/*") && normalized.startsWith(candidate.slice(0, -1))));
  }

  private snapshotIdentity(snapshot: {
    id: string;
    runtimeId: string;
    revision: number;
    packageHash: string;
    checksum: string;
    publishedAt: Date;
  }) {
    return {
      id: snapshot.id,
      runtimeId: snapshot.runtimeId,
      revision: snapshot.revision,
      packageHash: snapshot.packageHash,
      checksum: snapshot.checksum,
      publishedAt: snapshot.publishedAt
    };
  }

  private throwValidation(validation: RetrievalValidationResult): never {
    throw new BadRequestException({
      message: "Retrieval Runtime validation failed",
      diagnostics: validation.diagnostics
    });
  }

  private error(code: string, path: string, message: string): RetrievalDiagnostic {
    return { severity: "ERROR", code, path, message };
  }

  private record(value: unknown): JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as JsonRecord
      : {};
  }

  private hash(value: unknown) {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
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
}
