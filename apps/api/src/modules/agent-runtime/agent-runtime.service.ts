import { Injectable } from "@nestjs/common";
import type {
  AgentRuntimeListQueryDto,
  PrepareAgentRuntimeDto
} from "./dto/agent-runtime.dto";
import { AgentRuntimeRepository } from "./agent-runtime.repository";

@Injectable()
export class AgentRuntimeService {
  constructor(private readonly repository: AgentRuntimeRepository) {}

  prepare(workspaceId: string, actorId: string, dto: PrepareAgentRuntimeDto) {
    return this.repository.prepare(workspaceId, actorId, dto);
  }

  validate(workspaceId: string, actorId: string, runtimeId: string) {
    return this.repository.validate(workspaceId, actorId, runtimeId);
  }

  createSnapshot(workspaceId: string, actorId: string, runtimeId: string) {
    return this.repository.createSnapshot(workspaceId, actorId, runtimeId);
  }

  get(workspaceId: string, runtimeId: string) {
    return this.repository.get(workspaceId, runtimeId);
  }

  resolve(workspaceId: string, actorId: string, runtimeId: string) {
    return this.repository.resolveRuntime(workspaceId, actorId, runtimeId);
  }

  getSnapshot(workspaceId: string, snapshotId: string) {
    return this.repository.getSnapshot(workspaceId, snapshotId);
  }

  list(workspaceId: string, query: AgentRuntimeListQueryDto) {
    return this.repository.list(workspaceId, query);
  }
}

