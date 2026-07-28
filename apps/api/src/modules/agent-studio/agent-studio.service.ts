import { Injectable } from "@nestjs/common";
import { AgentStudioRepository } from "./agent-studio.repository";
import type {
  AgentListQueryDto,
  CloneAgentDto,
  CreateAgentDto,
  PublishAgentDto,
  RollbackAgentDto,
  UpdateAgentDraftDto
} from "./dto/agent-studio.dto";

@Injectable()
export class AgentStudioService {
  constructor(private readonly repository: AgentStudioRepository) {}

  create(workspaceId: string, actorId: string, dto: CreateAgentDto) {
    return this.repository.create({ workspaceId, actorId, ...dto });
  }

  updateDraft(
    workspaceId: string,
    actorId: string,
    agentId: string,
    dto: UpdateAgentDraftDto
  ) {
    return this.repository.updateDraft({
      workspaceId,
      actorId,
      agentId,
      draft: dto
    });
  }

  publish(workspaceId: string, actorId: string, agentId: string, dto: PublishAgentDto) {
    return this.repository.publish({ workspaceId, actorId, agentId, ...dto });
  }

  rollback(workspaceId: string, actorId: string, agentId: string, dto: RollbackAgentDto) {
    return this.repository.rollback({ workspaceId, actorId, agentId, ...dto });
  }

  clone(workspaceId: string, actorId: string, agentId: string, dto: CloneAgentDto) {
    return this.repository.clone({ workspaceId, actorId, agentId, ...dto });
  }

  archive(workspaceId: string, actorId: string, agentId: string) {
    return this.repository.archive(workspaceId, actorId, agentId);
  }

  restore(workspaceId: string, actorId: string, agentId: string) {
    return this.repository.restore(workspaceId, actorId, agentId);
  }

  delete(workspaceId: string, actorId: string, agentId: string) {
    return this.repository.softDelete(workspaceId, actorId, agentId);
  }

  get(workspaceId: string, agentId: string) {
    return this.repository.get(workspaceId, agentId);
  }

  history(workspaceId: string, agentId: string) {
    return this.repository.history(workspaceId, agentId);
  }

  list(workspaceId: string, query: AgentListQueryDto) {
    return this.repository.list({
      workspaceId,
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      search: query.search,
      status: query.status,
      visibility: query.visibility,
      category: query.category
    });
  }
}
