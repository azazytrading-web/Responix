import { Injectable } from "@nestjs/common";
import type {
  CompilePromptDto,
  CompiledPromptListQueryDto
} from "./dto/prompt-compiler.dto";
import { PromptCompilerRepository } from "./prompt-compiler.repository";

@Injectable()
export class PromptCompilerService {
  constructor(private readonly repository: PromptCompilerRepository) {}

  compile(workspaceId: string, actorId: string, dto: CompilePromptDto) {
    return this.repository.compile(workspaceId, actorId, dto);
  }

  preview(workspaceId: string, actorId: string, dto: CompilePromptDto) {
    return this.repository.preview(workspaceId, actorId, dto);
  }

  validate(workspaceId: string, actorId: string, dto: CompilePromptDto) {
    return this.repository.validate(workspaceId, actorId, dto);
  }

  list(workspaceId: string, query: CompiledPromptListQueryDto) {
    return this.repository.list(workspaceId, query);
  }

  get(workspaceId: string, id: string) {
    return this.repository.get(workspaceId, id);
  }

  compare(workspaceId: string, leftId: string, rightId: string) {
    return this.repository.compare(workspaceId, leftId, rightId);
  }
}

