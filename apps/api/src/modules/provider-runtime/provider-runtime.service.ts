import { Injectable } from "@nestjs/common";
import type {
  PrepareProviderRequestDto,
  ProviderRequestListQueryDto,
  ProviderSnapshotListQueryDto
} from "./dto/provider-runtime.dto";
import { ProviderRuntimeRepository } from "./provider-runtime.repository";

@Injectable()
export class ProviderRuntimeService {
  constructor(private readonly repository: ProviderRuntimeRepository) {}

  prepare(workspaceId: string, actorId: string, dto: PrepareProviderRequestDto) {
    return this.repository.prepare(workspaceId, actorId, dto);
  }

  validate(workspaceId: string, actorId: string, id: string) {
    return this.repository.validate(workspaceId, actorId, id);
  }

  createSnapshot(workspaceId: string, actorId: string, id: string) {
    return this.repository.createSnapshot(workspaceId, actorId, id);
  }

  getRequest(workspaceId: string, id: string) {
    return this.repository.getRequest(workspaceId, id);
  }

  listRequests(workspaceId: string, query: ProviderRequestListQueryDto) {
    return this.repository.listRequests(workspaceId, query);
  }

  getSnapshot(workspaceId: string, id: string) {
    return this.repository.getSnapshot(workspaceId, id);
  }

  listSnapshots(workspaceId: string, query: ProviderSnapshotListQueryDto) {
    return this.repository.listSnapshots(workspaceId, query);
  }

  compareSnapshots(workspaceId: string, leftId: string, rightId: string) {
    return this.repository.compareSnapshots(workspaceId, leftId, rightId);
  }
}
