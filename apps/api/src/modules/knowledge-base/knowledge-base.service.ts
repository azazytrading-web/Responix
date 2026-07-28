import { Injectable } from "@nestjs/common";
import { KnowledgeBaseRepository } from "./knowledge-base.repository";
import type {
  CloneKnowledgeDocumentDto,
  CreateKnowledgeCollectionDto,
  CreateKnowledgeDocumentDto,
  CreateKnowledgeFolderDto,
  CreateKnowledgeSpaceDto,
  KnowledgeDocumentListQueryDto,
  KnowledgeNamedDto,
  RollbackKnowledgeDocumentDto,
  UpdateKnowledgeCollectionDto,
  UpdateKnowledgeDocumentDto,
  UpdateKnowledgeFolderDto,
  UpdateKnowledgeNamedDto,
  UpdateKnowledgeSpaceDto
} from "./dto/knowledge-base.dto";

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly repository: KnowledgeBaseRepository) {}

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

  createDocument(workspaceId: string, actorId: string, dto: CreateKnowledgeDocumentDto) { return this.repository.createDocument(workspaceId, actorId, dto); }
  updateDocument(workspaceId: string, actorId: string, id: string, dto: UpdateKnowledgeDocumentDto) { return this.repository.updateDocument(workspaceId, actorId, id, dto); }
  publishDocument(workspaceId: string, actorId: string, id: string, changeSummary?: string) { return this.repository.publishDocument(workspaceId, actorId, id, changeSummary); }
  rollbackDocument(workspaceId: string, actorId: string, id: string, dto: RollbackKnowledgeDocumentDto) { return this.repository.rollbackDocument(workspaceId, actorId, id, dto.revision, dto.changeSummary); }
  cloneDocument(workspaceId: string, actorId: string, id: string, dto: CloneKnowledgeDocumentDto) { return this.repository.cloneDocument(workspaceId, actorId, id, dto.name, dto.slug); }
  archiveDocument(workspaceId: string, actorId: string, id: string) { return this.repository.archiveDocument(workspaceId, actorId, id); }
  restoreDocument(workspaceId: string, actorId: string, id: string) { return this.repository.restoreDocument(workspaceId, actorId, id); }
  deleteDocument(workspaceId: string, actorId: string, id: string) { return this.repository.softDeleteDocument(workspaceId, actorId, id); }
  getDocument(workspaceId: string, id: string) { return this.repository.getDocument(workspaceId, id); }
  history(workspaceId: string, id: string) { return this.repository.documentHistory(workspaceId, id); }
  listDocuments(workspaceId: string, query: KnowledgeDocumentListQueryDto) {
    return this.repository.listDocuments({
      workspaceId, page: query.page ?? 1, limit: query.limit ?? 25, search: query.search,
      spaceId: query.spaceId, collectionId: query.collectionId, folderId: query.folderId,
      status: query.status, sourceType: query.sourceType
    });
  }
}
