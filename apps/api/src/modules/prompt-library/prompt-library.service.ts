import { Injectable } from "@nestjs/common";
import {
  PromptLibraryRepository,
  type PromptListInput
} from "./prompt-library.repository";
import type {
  ClonePromptDto,
  CreatePromptDto,
  PromptListQueryDto,
  PromptNamedDto,
  PublishPromptDto,
  RollbackPromptDto,
  UpdatePromptDraftDto,
  UpdatePromptMetadataDto,
  UpdatePromptNamedDto
} from "./dto/prompt-library.dto";

@Injectable()
export class PromptLibraryService {
  constructor(private readonly repository: PromptLibraryRepository) {}

  create(workspaceId: string, actorId: string, dto: CreatePromptDto) {
    return this.repository.create({ ...dto, workspaceId, actorId });
  }

  updateDraft(workspaceId: string, actorId: string, id: string, dto: UpdatePromptDraftDto) {
    return this.repository.updateDraft({ ...dto, workspaceId, actorId, id });
  }

  updateMetadata(workspaceId: string, actorId: string, id: string, dto: UpdatePromptMetadataDto) {
    return this.repository.updateMetadata({ ...dto, workspaceId, actorId, id });
  }

  publish(workspaceId: string, actorId: string, id: string, dto: PublishPromptDto) {
    return this.repository.publish({ workspaceId, actorId, id, ...dto });
  }

  rollback(workspaceId: string, actorId: string, id: string, dto: RollbackPromptDto) {
    return this.repository.rollback({ workspaceId, actorId, id, ...dto });
  }

  clone(workspaceId: string, actorId: string, id: string, dto: ClonePromptDto) {
    return this.repository.clone({ workspaceId, actorId, id, ...dto });
  }

  get(workspaceId: string, id: string, includeArchived = false) {
    return this.repository.get(workspaceId, id, includeArchived);
  }

  history(workspaceId: string, id: string) {
    return this.repository.history(workspaceId, id);
  }

  list(workspaceId: string, query: PromptListQueryDto) {
    const input: PromptListInput = {
      workspaceId,
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      search: query.search,
      status: query.status,
      categoryId: query.categoryId,
      tagIds: query.tagIds,
      favorite: query.favorite,
      archived: query.archived,
      sortBy: query.sortBy ?? "updatedAt",
      sortOrder: query.sortOrder ?? "desc"
    };
    return this.repository.list(input);
  }

  archive(workspaceId: string, actorId: string, id: string) {
    return this.repository.archive(workspaceId, actorId, id);
  }

  restore(workspaceId: string, actorId: string, id: string) {
    return this.repository.restore(workspaceId, actorId, id);
  }

  favorite(workspaceId: string, actorId: string, id: string, favorite: boolean) {
    return this.repository.setFavorite(workspaceId, actorId, id, favorite);
  }

  createCategory(workspaceId: string, actorId: string, dto: PromptNamedDto) {
    return this.repository.createCategory(workspaceId, actorId, dto.name, dto.slug);
  }

  listCategories(workspaceId: string) {
    return this.repository.listCategories(workspaceId);
  }

  updateCategory(workspaceId: string, actorId: string, id: string, dto: UpdatePromptNamedDto) {
    return this.repository.updateCategory(workspaceId, actorId, id, dto.name, dto.slug);
  }

  deleteCategory(workspaceId: string, actorId: string, id: string) {
    return this.repository.deleteCategory(workspaceId, actorId, id);
  }

  createTag(workspaceId: string, actorId: string, dto: PromptNamedDto) {
    return this.repository.createTag(workspaceId, actorId, dto.name, dto.slug);
  }

  listTags(workspaceId: string) {
    return this.repository.listTags(workspaceId);
  }

  updateTag(workspaceId: string, actorId: string, id: string, dto: UpdatePromptNamedDto) {
    return this.repository.updateTag(workspaceId, actorId, id, dto.name, dto.slug);
  }

  deleteTag(workspaceId: string, actorId: string, id: string) {
    return this.repository.deleteTag(workspaceId, actorId, id);
  }

  assignTag(workspaceId: string, actorId: string, promptId: string, tagId: string) {
    return this.repository.assignTag(workspaceId, actorId, promptId, tagId);
  }

  removeTag(workspaceId: string, actorId: string, promptId: string, tagId: string) {
    return this.repository.removeTag(workspaceId, actorId, promptId, tagId);
  }
}
