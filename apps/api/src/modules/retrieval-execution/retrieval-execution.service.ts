import { Inject, Injectable } from "@nestjs/common";
import type { ExecuteRetrievalDto, RetrievalExecutionListQueryDto } from "./dto/retrieval-execution.dto";
import { RetrievalExecutionRepository } from "./retrieval-execution.repository";
import { RETRIEVAL_EXECUTION_STORE, type RetrievalExecutionStore } from "./retrieval-execution.types";

@Injectable()
export class RetrievalExecutionService {
  constructor(private readonly repository: RetrievalExecutionRepository,
    @Inject(RETRIEVAL_EXECUTION_STORE) private readonly store: RetrievalExecutionStore) {}
  async execute(workspaceId: string, actorId: string, dto: ExecuteRetrievalDto, signal?: AbortSignal) {
    const input = {
      ...dto, mode: dto.mode ?? "HYBRID", topK: dto.topK ?? 10,
      minScore: dto.minScore ?? 0, maxTokens: dto.maxTokens ?? 4000,
      compatibilityVersion: dto.compatibilityVersion ?? "1.0"
    } as const;
    try { return await this.store.execute(workspaceId, actorId, input, signal); }
    catch (error) {
      const cancelled = signal?.aborted === true || (error instanceof DOMException && error.name === "AbortError");
      await this.repository.recordFailure(workspaceId, actorId, dto, error, cancelled);
      throw error;
    }
  }
  get(workspaceId: string, id: string) { return this.repository.get(workspaceId, id); }
  list(workspaceId: string, query: RetrievalExecutionListQueryDto) { return this.repository.list(workspaceId, query); }
  diagnostics(workspaceId: string, id: string) { return this.repository.diagnostics(workspaceId, id); }
  metrics(workspaceId: string, id: string) { return this.repository.metrics(workspaceId, id); }
}
