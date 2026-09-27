import { Injectable } from "@nestjs/common";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";
import { KnowledgePipelineService } from "./knowledge-pipeline.service";
import type { IngestedFile } from "./knowledge-pipeline.service";
import type {
  CloneKnowledgeDocumentDto,
  CreateKnowledgeCollectionDto,
  CreateKnowledgeDocumentDto,
  CreateKnowledgeFolderDto,
  CreateKnowledgeSpaceDto,
  CreateKnowledgeTextDocumentDto,
  KnowledgeDocumentListQueryDto,
  KnowledgeNamedDto,
  RollbackKnowledgeDocumentDto,
  UpdateKnowledgeCollectionDto,
  UpdateKnowledgeDocumentDto,
  UpdateKnowledgeFolderDto,
  UpdateKnowledgeNamedDto,
  UpdateKnowledgeSpaceDto,
  UploadKnowledgeDocumentDto
} from "./dto/knowledge-base.dto";
import { KnowledgeDocumentResponseDto } from "./knowledge-response.dto";

type UnknownRecord = Record<string, unknown>;

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly repository: KnowledgeBaseRepository,
    private readonly pipeline: KnowledgePipelineService
  ) {}

  /**
   * Converts Prisma `BigInt` fields (e.g. `fileSize`) to `number` at the
   * response boundary so JSON serialization succeeds. See
   * `KnowledgeDocumentResponseDto`.
   */
  private serializeDocument(value: UnknownRecord | null | undefined): UnknownRecord {
    return KnowledgeDocumentResponseDto.toSerializable(value);
  }

  createSpace(workspaceId: string, actorId: string, dto: CreateKnowledgeSpaceDto) { return this.repository.createSpace(workspaceId, actorId, dto); }
  updateSpace(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeSpaceDto) { return this.repository.updateSpace(workspaceId, actorId, id, dto); }
  listSpaces(workspaceId: string) { return this.repository.listSpaces(workspaceId); }
  deleteSpace(workspaceId: string, actorId: string, id: string) { return this.repository.deleteSpace(workspaceId, actorId, id); }

  createCollection(workspaceId: string, actorId: string, dto: CreateKnowledgeCollectionDto) { return this.repository.createCollection(workspaceId, actorId, dto); }
  updateCollection(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeCollectionDto) { return this.repository.updateCollection(workspaceId, actorId, id, dto); }
  listCollections(workspaceId: string, spaceId?: string) { return this.repository.listCollections(workspaceId, spaceId); }
  deleteCollection(workspaceId: string, actorId: string, id: string) { return this.repository.deleteCollection(workspaceId, actorId, id); }

  createFolder(workspaceId: string, actorId: string, dto: CreateKnowledgeFolderDto) { return this.repository.createFolder(workspaceId, actorId, dto); }
  updateFolder(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeFolderDto) { return this.repository.updateFolder(workspaceId, actorId, id, dto); }
  listFolders(workspaceId: string, spaceId?: string, collectionId?: string) { return this.repository.listFolders(workspaceId, spaceId, collectionId); }
  deleteFolder(workspaceId: string, actorId: string, id: string) { return this.repository.deleteFolder(workspaceId, actorId, id); }

  createCategory(workspaceId: string, actorId: string, dto: KnowledgeNamedDto) { return this.repository.createCategory(workspaceId, actorId, dto); }
  updateCategory(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeNamedDto) { return this.repository.updateCategory(workspaceId, actorId, id, dto); }
  listCategories(workspaceId: string) { return this.repository.listCategories(workspaceId); }
  deleteCategory(workspaceId: string, actorId: string, id: string) { return this.repository.deleteCategory(workspaceId, actorId, id); }

  createTag(workspaceId: string, actorId: string, dto: KnowledgeNamedDto) { return this.repository.createTag(workspaceId, actorId, dto); }
  updateTag(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeNamedDto) { return this.repository.updateTag(workspaceId, actorId, id, dto); }
  listTags(workspaceId: string) { return this.repository.listTags(workspaceId); }
  deleteTag(workspaceId: string, actorId: string, id: string) { return this.repository.deleteTag(workspaceId, actorId, id); }

  async createDocument(workspaceId: string, actorId: string, dto: CreateKnowledgeDocumentDto) {
    const document = await this.repository.createDocument(workspaceId, actorId, dto);
    return this.serializeDocument(document);
  }
  async updateDocument(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeDocumentDto) {
    const document = await this.repository.updateDocument(workspaceId, actorId, id, dto);
    return this.serializeDocument(document);
  }
  async publishDocument(workspaceId: string, actorId: string, id: string, changeSummary?: string) {
    const result = (await this.repository.publishDocument(workspaceId, actorId, id, changeSummary)) as {
      document: UnknownRecord;
      version: UnknownRecord;
    };
    return { document: this.serializeDocument(result.document), version: result.version };
  }
  async rollbackDocument(workspaceId: string, actorId: string, id: string, dto: RollbackKnowledgeDocumentDto) {
    const result = (await this.repository.rollbackDocument(workspaceId, actorId, id, dto.revision, dto.changeSummary)) as {
      document: UnknownRecord;
      version: UnknownRecord;
    };
    return { document: this.serializeDocument(result.document), version: result.version };
  }
  async cloneDocument(workspaceId: string, actorId: string, id: string, dto: CloneKnowledgeDocumentDto) {
    const document = await this.repository.cloneDocument(workspaceId, actorId, id, dto.name, dto.slug);
    return this.serializeDocument(document);
  }
  async archiveDocument(workspaceId: string, actorId: string, id: string) {
    const document = await this.repository.archiveDocument(workspaceId, actorId, id);
    return this.serializeDocument(document);
  }
  async restoreDocument(workspaceId: string, actorId: string, id: string) {
    const document = await this.repository.restoreDocument(workspaceId, actorId, id);
    return this.serializeDocument(document);
  }
  async deleteDocument(workspaceId: string, actorId: string, id: string) {
    const document = await this.repository.softDeleteDocument(workspaceId, actorId, id);
    return this.serializeDocument(document);
  }
  async getDocument(workspaceId: string, id: string) {
    const document = await this.repository.getDocument(workspaceId, id);
    return this.serializeDocument(document);
  }
  history(workspaceId: string, id: string) { return this.repository.documentHistory(workspaceId, id); }
  async listDocuments(workspaceId: string, query: KnowledgeDocumentListQueryDto) {
    const result = (await this.repository.listDocuments({
      workspaceId, page: query.page ?? 1, limit: query.limit ?? 25, search: query.search,
      spaceId: query.spaceId, collectionId: query.collectionId, folderId: query.folderId,
      status: query.status, sourceType: query.sourceType
    })) as { data: UnknownRecord[]; pagination: UnknownRecord };
    return { data: result.data.map((item) => this.serializeDocument(item)), pagination: result.pagination };
  }

  publishSpace(workspaceId: string, actorId: string, id: string) {
    return this.repository.publishSpace(workspaceId, actorId, id);
  }
  async uploadDocument(workspaceId: string, actorId: string, file: IngestedFile, fields: UploadKnowledgeDocumentDto) {
    const document = await this.pipeline.ingestFile(workspaceId, actorId, file, fields);
    return this.serializeDocument(document);
  }
  async createTextDocument(workspaceId: string, actorId: string, dto: CreateKnowledgeTextDocumentDto) {
    const document = await this.pipeline.ingestText(workspaceId, actorId, dto);
    return this.serializeDocument(document);
  }
}
