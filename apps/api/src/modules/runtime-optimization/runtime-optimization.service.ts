import { Injectable } from "@nestjs/common";
import type {
  CacheCompiledPromptDto, CacheImmutablePackageDto, CacheMemoryRuntimeDto, CacheRenderedPromptDto, CacheRetrievalRuntimeDto,
  CreateRuntimeContextSnapshotDto, RuntimeOptimizationListQueryDto
} from "./dto/runtime-optimization.dto";
import { RuntimeOptimizationRepository } from "./runtime-optimization.repository";

@Injectable()
export class RuntimeOptimizationService {
  constructor(private readonly repository: RuntimeOptimizationRepository) {}
  cacheCompiled(w: string, a: string, d: CacheCompiledPromptDto) {
    return this.repository.cacheCompiled(w, a, d.compiledPromptId);
  }
  cacheRendered(w: string, a: string, d: CacheRenderedPromptDto) {
    return this.repository.cacheRendered(w, a, d);
  }
  createContext(w: string, a: string, d: CreateRuntimeContextSnapshotDto) {
    return this.repository.createContext(w, a, d);
  }
  cacheRetrieval(w: string, a: string, d: CacheRetrievalRuntimeDto) {
    return this.repository.cacheRetrieval(w, a, d);
  }
  cacheMemory(w: string, a: string, d: CacheMemoryRuntimeDto) {
    return this.repository.cacheMemory(w, a, d);
  }
  cacheImmutable(w: string, a: string, d: CacheImmutablePackageDto) {
    return this.repository.cacheImmutable(w, a, d);
  }
  invalidate(w: string, a: string, id: string, reason: string) {
    return this.repository.invalidate(w, a, id, reason);
  }
  recordProviderOutcome(w: string, a: string, input: Parameters<RuntimeOptimizationRepository["recordProviderOutcome"]>[2]) {
    return this.repository.recordProviderOutcome(w, a, input);
  }
  get(w: string, id: string) { return this.repository.get(w, id); }
  list(w: string, q: RuntimeOptimizationListQueryDto) {
    return this.repository.list(w, q);
  }
  getMetrics(w: string, id: string) { return this.repository.getMetrics(w, id); }
}
