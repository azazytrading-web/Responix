export type RetrievalExecutionDiagnostic = Readonly<{
  severity: "INFO" | "WARNING" | "ERROR";
  code: string;
  path: string;
  message: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type RetrievalCitation = Readonly<{
  index: number;
  documentId: string;
  versionId: string;
  chunkId?: string;
  label: string;
}>;

export type RetrievalContextItem = Readonly<{
  documentId: string;
  versionId: string;
  collectionId?: string;
  name: string;
  mimeType: string;
  language?: string;
  score: number;
  content: unknown;
  chunks: ReadonlyArray<Readonly<{
    id: string; ordinal: number; tokenCount?: number; checksum?: string;
    metadata: Readonly<Record<string, unknown>>;
  }>>;
  citation: RetrievalCitation;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type RetrievalKnowledgePackage = Readonly<{
  schemaVersion: "1.0";
  compatibilityVersion: string;
  mode: "KEYWORD" | "SEMANTIC" | "HYBRID";
  query: string;
  queryTerms: ReadonlyArray<string>;
  snapshotId: string;
  runtimeId: string;
  knowledgeBaseId: string;
  documents: ReadonlyArray<RetrievalContextItem>;
  citations: ReadonlyArray<RetrievalCitation>;
  preparation: Readonly<{
    keyword: boolean;
    semantic: boolean;
    hybrid: boolean;
    connectorContractVersion: "1.0";
  }>;
  budget: Readonly<{ maxTokens: number; usedTokens: number; truncated: boolean }>;
  sourceHash: string;
  packageHash: string;
  createdAt: string;
}>;

export const RETRIEVAL_EXECUTION_STORE = Symbol("RETRIEVAL_EXECUTION_STORE");

export interface RetrievalExecutionStore {
  execute(workspaceId: string, actorId: string, input: {
    retrievalRuntimeSnapshotId: string; query: string;
    mode: "KEYWORD" | "SEMANTIC" | "HYBRID"; topK: number; minScore: number;
    maxTokens: number; compatibilityVersion: string;
    executionRequestId?: string; executionRunId?: string;
    filters?: Array<{ key: string; operator: "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN" | "EXISTS"; value: unknown }>;
    providerCapabilities?: string[]; metadata?: Record<string, unknown>;
  }, signal?: AbortSignal): Promise<RetrievalKnowledgePackage>;
}
