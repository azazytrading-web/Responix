import { Injectable } from "@nestjs/common";
import type {
  CloneConversationRuntimeDto,
  ConversationRuntimeListQueryDto,
  ConversationSnapshotListQueryDto,
  PrepareConversationRuntimeDto,
  TransitionConversationStateDto
} from "./dto/conversation-runtime.dto";
import { ConversationRuntimeRepository } from "./conversation-runtime.repository";

@Injectable()
export class ConversationRuntimeService {
  constructor(private readonly repository: ConversationRuntimeRepository) {}
  prepare(workspaceId: string, actorId: string, dto: PrepareConversationRuntimeDto) {
    return this.repository.prepare(workspaceId, actorId, dto);
  }
  validate(workspaceId: string, actorId: string, id: string) {
    return this.repository.validate(workspaceId, actorId, id);
  }
  transition(workspaceId: string, actorId: string, id: string, dto: TransitionConversationStateDto) {
    return this.repository.transition(workspaceId, actorId, id, dto);
  }
  publish(workspaceId: string, actorId: string, id: string) {
    return this.repository.publish(workspaceId, actorId, id);
  }
  rollback(workspaceId: string, actorId: string, id: string, versionId: string) {
    return this.repository.rollback(workspaceId, actorId, id, versionId);
  }
  clone(workspaceId: string, actorId: string, id: string, dto: CloneConversationRuntimeDto) {
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
  list(workspaceId: string, query: ConversationRuntimeListQueryDto) {
    return this.repository.list(workspaceId, query);
  }
  listSnapshots(workspaceId: string, query: ConversationSnapshotListQueryDto) {
    return this.repository.listSnapshots(workspaceId, query);
  }
  compare(workspaceId: string, leftId: string, rightId: string) {
    return this.repository.compare(workspaceId, leftId, rightId);
  }
}
