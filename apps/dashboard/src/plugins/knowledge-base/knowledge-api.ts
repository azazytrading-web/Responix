import { apiClient } from "@responix/api-client";

export type KnowledgeStatus = "DRAFT" | "INDEXING" | "READY" | "FAILED" | "ARCHIVED" | "PUBLISHED";
export type KnowledgeIndexingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type KnowledgeSourceType = "FILE" | "URL" | "TEXT" | "IMPORT" | "API";

export interface KnowledgeSpace {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  metadata: Record<string, unknown> | null;
  status: KnowledgeStatus;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface KnowledgeSpaceInput {
  name: string;
  slug: string;
  description?: string;
}

export interface KnowledgeDocument {
  id: string;
  workspaceId: string;
  knowledgeBaseId: string;
  collectionId: string | null;
  folderId: string | null;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sourceType: KnowledgeSourceType;
  fileName: string | null;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  language: string | null;
  indexingStatus: KnowledgeIndexingStatus;
  totalChunks: number;
  status: KnowledgeStatus;
  revision: number;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  embeddingStatusMetadata?: Record<string, unknown> | null;
}

export interface KnowledgeDocumentPage {
  data: KnowledgeDocument[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface RetrievalRuntimeRecord {
  id: string;
  workspaceId: string;
  knowledgeBaseId: string;
  name: string;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeVersion { id: string; revision: number }

const config = { credentials: "include" as const };

export function listSpaces(): Promise<KnowledgeSpace[]> {
  return apiClient.get<KnowledgeSpace[]>("/api/v1/knowledge-base/spaces", config);
}

export function createSpace(input: KnowledgeSpaceInput): Promise<KnowledgeSpace> {
  return apiClient.post<KnowledgeSpace>(
    "/api/v1/knowledge-base/spaces",
    { ...input, ...(input.description ? { description: input.description } : {}) },
    config
  );
}

export function deleteSpace(spaceId: string): Promise<KnowledgeSpace> {
  return apiClient.delete<KnowledgeSpace>(`/api/v1/knowledge-base/spaces/${spaceId}`, config);
}

export function updateSpace(spaceId: string, input: { name?: string; slug?: string; description?: string }): Promise<KnowledgeSpace> {
  return apiClient.put<KnowledgeSpace>(`/api/v1/knowledge-base/spaces/${spaceId}`, input, config);
}

export function publishSpace(spaceId: string): Promise<unknown> {
  return apiClient.post(`/api/v1/knowledge-base/spaces/${spaceId}/publish`, {}, config);
}

export function listDocuments(
  page: number,
  options: { spaceId: string; search?: string; status?: KnowledgeStatus }
): Promise<KnowledgeDocumentPage> {
  return apiClient.get<KnowledgeDocumentPage>("/api/v1/knowledge-base/documents", {
    ...config,
    query: {
      page,
      limit: 25,
      spaceId: options.spaceId,
      ...(options.search ? { search: options.search } : {}),
      ...(options.status ? { status: options.status } : {})
    }
  });
}

export function uploadDocument(
  spaceId: string,
  file: File,
  name?: string
): Promise<KnowledgeDocument> {
  const body = new FormData();
  body.append("file", file);
  body.append("spaceId", spaceId);
  if (name) body.append("name", name);
  return apiClient.post<KnowledgeDocument>("/api/v1/knowledge-base/documents/upload", body, config);
}

export function publishDocument(documentId: string): Promise<unknown> {
  return apiClient.post(
    `/api/v1/knowledge-base/documents/${documentId}/publish`,
    { changeSummary: "Published from Knowledge Base" },
    config
  );
}

export function archiveDocument(documentId: string): Promise<unknown> {
  return apiClient.post(`/api/v1/knowledge-base/documents/${documentId}/archive`, {}, config);
}

export function restoreDocument(documentId: string): Promise<unknown> {
  return apiClient.post(`/api/v1/knowledge-base/documents/${documentId}/restore`, {}, config);
}

export function deleteDocument(documentId: string): Promise<unknown> {
  return apiClient.delete(`/api/v1/knowledge-base/documents/${documentId}`, config);
}

export function listRetrievalRuntimes(knowledgeBaseId?: string): Promise<{ data: RetrievalRuntimeRecord[] }> {
  return apiClient.get<{ data: RetrievalRuntimeRecord[] }>("/api/v1/retrieval-runtime", {
    ...config,
    query: { page: 1, limit: 100, ...(knowledgeBaseId ? { knowledgeBaseId } : {}) }
  });
}

export function documentHistory(documentId: string): Promise<KnowledgeVersion[]> {
  return apiClient.get<KnowledgeVersion[]>(`/api/v1/knowledge-base/documents/${documentId}/history`, config);
}

export function prepareRetrievalRuntime(input: {
  name: string;
  knowledgeBaseId: string;
  sources: Array<{ documentId: string; versionId: string }>;
}): Promise<RetrievalRuntimeRecord> {
  return apiClient.post<RetrievalRuntimeRecord>("/api/v1/retrieval-runtime", input, config);
}

export function publishRetrievalRuntime(runtimeId: string): Promise<unknown> {
  return apiClient.post(`/api/v1/retrieval-runtime/${runtimeId}/publish`, {}, config);
}
