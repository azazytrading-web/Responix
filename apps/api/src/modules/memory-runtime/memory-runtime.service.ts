import { Inject, Injectable } from "@nestjs/common";
import type {
  CommitMemoryWritesDto, CreateMemoryRuntimeDto, MemoryRuntimeListQueryDto,
  MemorySnapshotListQueryDto, ResolveMemoryRuntimeDto, UpdateMemoryRuntimeDto
} from "./dto/memory-runtime.dto";
import { MemoryRuntimeRepository } from "./memory-runtime.repository";
import {
  MEMORY_RUNTIME_STORE, type MemoryRuntimeStore
} from "./memory-runtime.types";

@Injectable()
export class MemoryRuntimeService {
  constructor(
    private readonly repository: MemoryRuntimeRepository,
    @Inject(MEMORY_RUNTIME_STORE) private readonly store: MemoryRuntimeStore
  ) {}
  create(w: string, a: string, dto: CreateMemoryRuntimeDto) {
    return this.repository.create(w, a, dto);
  }
  update(w: string, a: string, id: string, dto: UpdateMemoryRuntimeDto) {
    return this.repository.update(w, a, id, dto);
  }
  publish(w: string, a: string, id: string, expected?: number) {
    return this.repository.publish(w, a, id, expected);
  }
  rollback(w: string, a: string, id: string, versionId: string, expected: number) {
    return this.repository.rollback(w, a, id, versionId, expected);
  }
  archive(w: string, a: string, id: string) { return this.repository.archive(w, a, id); }
  resolve(w: string, a: string, dto: ResolveMemoryRuntimeDto) {
    return this.store.loadResolved(w, a, dto.snapshotIds, dto.compatibilityVersion,
      dto.executionRequestId, dto.executionRunId);
  }
  commitWrite(w: string, a: string, dto: CommitMemoryWritesDto) {
    return this.repository.commitWrite(w, a, dto);
  }
  commitWrites(w: string, a: string, dto: CommitMemoryWritesDto[]) {
    return this.repository.commitWrites(w, a, dto);
  }
  get(w: string, id: string) { return this.repository.get(w, id); }
  getSnapshot(w: string, id: string) { return this.repository.getSnapshot(w, id); }
  list(w: string, q: MemoryRuntimeListQueryDto) { return this.repository.list(w, q); }
  listSnapshots(w: string, q: MemorySnapshotListQueryDto) {
    return this.repository.listSnapshots(w, q);
  }
  compare(w: string, left: string, right: string) {
    return this.repository.compare(w, left, right);
  }
  diagnostics(w: string, id: string) { return this.repository.diagnostics(w, id); }
  metrics(w: string, id: string) { return this.repository.metrics(w, id); }
  history(w: string, id: string) { return this.repository.history(w, id); }
}
