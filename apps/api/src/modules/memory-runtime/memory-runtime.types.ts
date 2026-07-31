export interface ResolvedMemorySnapshot {
  snapshotId: string;
  runtimeId: string;
  identifier: string;
  type: string;
  scopeKey: string;
  revision: number;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  packageHash: string;
}

export interface ResolvedMemoryPackage {
  snapshots: ReadonlyArray<Readonly<ResolvedMemorySnapshot>>;
  packageHash: string;
  resolvedAt: string;
}

export const MEMORY_RUNTIME_STORE = Symbol("MEMORY_RUNTIME_STORE");

export interface MemoryRuntimeStore {
  loadResolved(workspaceId: string, actorId: string, snapshotIds: string[],
    compatibilityVersion: string, executionRequestId?: string,
    executionRunId?: string): Promise<ResolvedMemoryPackage>;
}
