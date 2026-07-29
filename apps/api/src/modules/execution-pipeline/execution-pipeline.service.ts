import { Injectable } from "@nestjs/common";
import {
  CloneExecutionPipelineDto, CreateExecutionPipelineDto, ExecutionPipelineListQueryDto,
  ExecutionPipelineSnapshotQueryDto, UpdateExecutionPipelineDto
} from "./dto/execution-pipeline.dto";
import { ExecutionPipelineRepository } from "./execution-pipeline.repository";

@Injectable()
export class ExecutionPipelineService {
  constructor(private readonly repository: ExecutionPipelineRepository) {}
  create(workspaceId: string, actorId: string, dto: CreateExecutionPipelineDto) {
    return this.repository.create(workspaceId, actorId, dto);
  }
  update(workspaceId: string, actorId: string, id: string, dto: UpdateExecutionPipelineDto) {
    return this.repository.update(workspaceId, actorId, id, dto);
  }
  validate(workspaceId: string, actorId: string, id: string) {
    return this.repository.validate(workspaceId, actorId, id);
  }
  publish(workspaceId: string, actorId: string, id: string) {
    return this.repository.publish(workspaceId, actorId, id);
  }
  rollback(workspaceId: string, actorId: string, id: string, revisionId: string) {
    return this.repository.rollback(workspaceId, actorId, id, revisionId);
  }
  clone(workspaceId: string, actorId: string, id: string, dto: CloneExecutionPipelineDto) {
    return this.repository.clone(workspaceId, actorId, id, dto);
  }
  archive(workspaceId: string, actorId: string, id: string) {
    return this.repository.archive(workspaceId, actorId, id);
  }
  restore(workspaceId: string, actorId: string, id: string) {
    return this.repository.restore(workspaceId, actorId, id);
  }
  softDelete(workspaceId: string, actorId: string, id: string) {
    return this.repository.softDelete(workspaceId, actorId, id);
  }
  get(workspaceId: string, id: string) { return this.repository.get(workspaceId, id); }
  getSnapshot(workspaceId: string, id: string) { return this.repository.getSnapshot(workspaceId, id); }
  list(workspaceId: string, query: ExecutionPipelineListQueryDto) {
    return this.repository.list(workspaceId, query);
  }
  listSnapshots(workspaceId: string, query: ExecutionPipelineSnapshotQueryDto) {
    return this.repository.listSnapshots(workspaceId, query);
  }
  compare(workspaceId: string, leftId: string, rightId: string) {
    return this.repository.compare(workspaceId, leftId, rightId);
  }
}
