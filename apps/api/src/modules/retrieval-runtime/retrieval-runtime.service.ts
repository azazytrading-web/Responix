import { Injectable } from "@nestjs/common";
import type {
  PrepareRetrievalRuntimeDto,
  RetrievalRuntimeListQueryDto,
  RetrievalSnapshotListQueryDto
} from "./dto/retrieval-runtime.dto";
import { RetrievalRuntimeRepository } from "./retrieval-runtime.repository";

@Injectable()
export class RetrievalRuntimeService {
  constructor(private readonly repository: RetrievalRuntimeRepository) {}

  prepare(workspaceId: string, actorId: string, dto: PrepareRetrievalRuntimeDto) {
    return this.repository.prepare(workspaceId, actorId, dto);
  }

  validate(workspaceId: string, actorId: string, id: string) {
    return this.repository.validate(workspaceId, actorId, id);
  }

  publish(workspaceId: string, actorId: string, id: string) {
    return this.repository.publish(workspaceId, actorId, id);
  }

  archive(workspaceId: string, actorId: string, id: string) {
    return this.repository.archive(workspaceId, actorId, id);
  }

  restore(workspaceId: string, actorId: string, id: string) {
    return this.repository.restore(workspaceId, actorId, id);
  }

  get(workspaceId: string, id: string) {
    return this.repository.get(workspaceId, id);
  }

  getSnapshot(workspaceId: string, id: string) {
    return this.repository.getSnapshot(workspaceId, id);
  }

  list(workspaceId: string, query: RetrievalRuntimeListQueryDto) {
    return this.repository.list(workspaceId, query);
  }

  listSnapshots(workspaceId: string, query: RetrievalSnapshotListQueryDto) {
    return this.repository.listSnapshots(workspaceId, query);
  }

  compare(workspaceId: string, leftId: string, rightId: string) {
    return this.repository.compare(workspaceId, leftId, rightId);
  }
}
