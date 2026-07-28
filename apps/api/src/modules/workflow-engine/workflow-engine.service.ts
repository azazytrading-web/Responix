import { Injectable } from "@nestjs/common";
import { WorkflowEngineRepository } from "./workflow-engine.repository";
import type {
  CloneWorkflowDto,
  CreateWorkflowDto,
  PublishWorkflowDto,
  RollbackWorkflowDto,
  UpdateWorkflowDto,
  UpdateWorkflowTaxonomyDto,
  WorkflowListQueryDto,
  WorkflowTaxonomyDto
} from "./dto/workflow-engine.dto";

@Injectable()
export class WorkflowEngineService {
  constructor(private readonly repository: WorkflowEngineRepository) {}

  createCategory(w: string, a: string, d: WorkflowTaxonomyDto) { return this.repository.createCategory(w, a, d); }
  updateCategory(w: string, a: string, id: string, d: UpdateWorkflowTaxonomyDto) { return this.repository.updateCategory(w, a, id, d); }
  listCategories(w: string) { return this.repository.listCategories(w); }
  deleteCategory(w: string, a: string, id: string) { return this.repository.deleteCategory(w, a, id); }
  createTag(w: string, a: string, d: WorkflowTaxonomyDto) { return this.repository.createTag(w, a, d); }
  updateTag(w: string, a: string, id: string, d: UpdateWorkflowTaxonomyDto) { return this.repository.updateTag(w, a, id, d); }
  listTags(w: string) { return this.repository.listTags(w); }
  deleteTag(w: string, a: string, id: string) { return this.repository.deleteTag(w, a, id); }
  create(w: string, a: string, d: CreateWorkflowDto) { return this.repository.create(w, a, d); }
  updateDraft(w: string, a: string, id: string, d: UpdateWorkflowDto) { return this.repository.updateDraft(w, a, id, d); }
  publish(w: string, a: string, id: string, d: PublishWorkflowDto) { return this.repository.publish(w, a, id, d.changeSummary); }
  rollback(w: string, a: string, id: string, d: RollbackWorkflowDto) { return this.repository.rollback(w, a, id, d.revision, d.changeSummary); }
  clone(w: string, a: string, id: string, d: CloneWorkflowDto) { return this.repository.clone(w, a, id, d.name, d.slug); }
  archive(w: string, a: string, id: string) { return this.repository.archive(w, a, id); }
  restore(w: string, a: string, id: string) { return this.repository.restore(w, a, id); }
  delete(w: string, a: string, id: string) { return this.repository.softDelete(w, a, id); }
  get(w: string, id: string) { return this.repository.get(w, id); }
  history(w: string, id: string) { return this.repository.history(w, id); }
  list(w: string, q: WorkflowListQueryDto) {
    return this.repository.list({
      workspaceId: w, page: q.page ?? 1, limit: q.limit ?? 25,
      search: q.search, status: q.status, visibility: q.visibility,
      categoryId: q.categoryId, tagId: q.tagId,
      sortBy: q.sortBy ?? "updatedAt", sortOrder: q.sortOrder ?? "desc"
    });
  }
}
