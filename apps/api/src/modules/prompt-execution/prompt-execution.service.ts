import { Injectable } from "@nestjs/common";
import type {
  PromptExecutionListQueryDto, RenderPromptExecutionDto
} from "./dto/prompt-execution.dto";
import { PromptExecutionRepository } from "./prompt-execution.repository";

@Injectable()
export class PromptExecutionService {
  constructor(private readonly repository: PromptExecutionRepository) {}
  render(workspaceId: string, actorId: string, dto: RenderPromptExecutionDto) {
    return this.repository.render(workspaceId, actorId, dto);
  }
  validate(workspaceId: string, actorId: string, dto: RenderPromptExecutionDto) {
    return this.repository.validate(workspaceId, actorId, dto);
  }
  get(workspaceId: string, id: string) { return this.repository.get(workspaceId, id); }
  list(workspaceId: string, query: PromptExecutionListQueryDto) {
    return this.repository.list(workspaceId, query);
  }
}
