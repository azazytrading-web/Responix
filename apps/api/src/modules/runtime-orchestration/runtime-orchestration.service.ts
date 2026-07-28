import { Injectable } from "@nestjs/common";
import type {
  CloneExecutionProfileDto,
  CreateExecutionProfileDto,
  ExecutionPriorityLevelDto,
  ExecutionProfileListQueryDto,
  OrchestrationTaxonomyDto,
  PublishExecutionProfileDto,
  RollbackExecutionProfileDto,
  UpdateExecutionPriorityLevelDto,
  UpdateExecutionProfileDto,
  UpdateOrchestrationTaxonomyDto
} from "./dto/runtime-orchestration.dto";
import { RuntimeOrchestrationRepository } from "./runtime-orchestration.repository";

@Injectable()
export class RuntimeOrchestrationService {
  constructor(private readonly repository: RuntimeOrchestrationRepository) {}

  createQueue(w: string, a: string, d: OrchestrationTaxonomyDto) { return this.repository.createQueue(w, a, d); }
  updateQueue(w: string, a: string, id: string, d: UpdateOrchestrationTaxonomyDto) { return this.repository.updateQueue(w, a, id, d); }
  listQueues(w: string) { return this.repository.listQueues(w); }
  deleteQueue(w: string, a: string, id: string) { return this.repository.deleteQueue(w, a, id); }
  createPriority(w: string, a: string, d: ExecutionPriorityLevelDto) { return this.repository.createPriority(w, a, d); }
  updatePriority(w: string, a: string, id: string, d: UpdateExecutionPriorityLevelDto) { return this.repository.updatePriority(w, a, id, d); }
  listPriorities(w: string) { return this.repository.listPriorities(w); }
  deletePriority(w: string, a: string, id: string) { return this.repository.deletePriority(w, a, id); }
  createTag(w: string, a: string, d: OrchestrationTaxonomyDto) { return this.repository.createTag(w, a, d); }
  updateTag(w: string, a: string, id: string, d: UpdateOrchestrationTaxonomyDto) { return this.repository.updateTag(w, a, id, d); }
  listTags(w: string) { return this.repository.listTags(w); }
  deleteTag(w: string, a: string, id: string) { return this.repository.deleteTag(w, a, id); }
  create(w: string, a: string, d: CreateExecutionProfileDto) { return this.repository.create(w, a, d); }
  updateDraft(w: string, a: string, id: string, d: UpdateExecutionProfileDto) { return this.repository.updateDraft(w, a, id, d); }
  publish(w: string, a: string, id: string, d: PublishExecutionProfileDto) { return this.repository.publish(w, a, id, d.changeSummary); }
  rollback(w: string, a: string, id: string, d: RollbackExecutionProfileDto) { return this.repository.rollback(w, a, id, d.revision, d.changeSummary); }
  clone(w: string, a: string, id: string, d: CloneExecutionProfileDto) { return this.repository.clone(w, a, id, d.name, d.slug); }
  archive(w: string, a: string, id: string) { return this.repository.archive(w, a, id); }
  restore(w: string, a: string, id: string) { return this.repository.restore(w, a, id); }
  delete(w: string, a: string, id: string) { return this.repository.softDelete(w, a, id); }
  get(w: string, id: string) { return this.repository.get(w, id); }
  history(w: string, id: string) { return this.repository.history(w, id); }
  list(w: string, q: ExecutionProfileListQueryDto) {
    return this.repository.list({
      workspaceId: w, page: q.page ?? 1, limit: q.limit ?? 25,
      search: q.search, status: q.status, visibility: q.visibility,
      queueDefinitionId: q.queueDefinitionId, priorityLevelId: q.priorityLevelId,
      tagId: q.tagId, sortBy: q.sortBy ?? "updatedAt", sortOrder: q.sortOrder ?? "desc"
    });
  }
}
