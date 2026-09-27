"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ApiError } from "@responix/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorFallback,
  Input,
  PageSkeleton
} from "@responix/ui";
import { Database, FileText, Plus, Search, Upload } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import {
  archiveDocument,
  deleteDocument,
  listDocuments,
  listRetrievalRuntimes,
  listSpaces,
  publishDocument,
  publishSpace,
  restoreDocument,
  uploadDocument,
  type KnowledgeDocument,
  type KnowledgeSpace,
  type KnowledgeStatus
} from "./knowledge-api";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;
}

function statusBadgeVariant(status: KnowledgeStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "FAILED") return "destructive";
  if (status === "PUBLISHED") return "default";
  if (status === "INDEXING" || status === "READY") return "secondary";
  return "outline";
}

function formatFileSize(value: number | string | null | undefined): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function documentFailureReason(document: KnowledgeDocument): string | null {
  if (document.status !== "FAILED" && document.indexingStatus !== "FAILED") return null;
  const metadata = document.embeddingStatusMetadata;
  if (metadata && typeof metadata === "object") {
    const message = metadata.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Indexing failed.";
}


export function KnowledgeBaseListPage() {
  const platform = usePlatformBootstrap();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("knowledge.base.read");
  const canWrite = platform.hasPermission("knowledge.base.write");
  const canPublish = platform.hasPermission("knowledge.base.publish");
  const canArchive = platform.hasPermission("knowledge.base.archive");
  const canDelete = platform.hasPermission("knowledge.base.delete");
  const canManage = platform.hasPermission("knowledge.base.manage");
  const canViewRuntimes = platform.hasPermission("retrieval.runtime.read");
  const client = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [spaceId, setSpaceId] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<KnowledgeStatus | "">("");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");

  const spaces = useQuery({
    queryKey: ["workspace", workspaceId, "knowledge", "spaces"],
    queryFn: () => listSpaces(),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead
  });
  const selectedSpace: KnowledgeSpace | undefined =
    spaces.data?.find((space) => space.id === spaceId) ?? spaces.data?.[0];
  const selectedSpaceId = selectedSpace?.id ?? "";

  const documents = useQuery({
    queryKey: ["workspace", workspaceId, "knowledge", "documents", { page, search, status, spaceId: selectedSpaceId }],
    queryFn: () => listDocuments(page, { spaceId: selectedSpaceId, search: search || undefined, status: status || undefined }),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead && Boolean(selectedSpaceId)
  });
  const runtimes = useQuery({
    queryKey: ["workspace", workspaceId, "knowledge", "runtimes", selectedSpaceId],
    queryFn: () => listRetrievalRuntimes(selectedSpaceId),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canViewRuntimes && Boolean(selectedSpaceId)
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "knowledge"] });
  };

  const lifecycle = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "publish" | "archive" | "restore" | "delete" }) =>
      action === "publish"
        ? publishDocument(id)
        : action === "archive"
          ? archiveDocument(id)
          : action === "restore"
            ? restoreDocument(id)
            : deleteDocument(id),
    onSuccess: async (_result, variables) => {
      setNotice(
        variables.action === "publish"
          ? "Document published."
          : variables.action === "delete"
            ? "Document deleted."
            : `Document ${variables.action}d.`
      );
      await refresh();
    }
  });
  const publishSpaceMutation = useMutation({
    mutationFn: (id: string) => publishSpace(id),
    onSuccess: async () => {
      setNotice("Knowledge space published.");
      await refresh();
    }
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument(selectedSpaceId, file),
    onSuccess: async (document) => {
      setNotice(`Uploaded ${document.fileName}.`);
      await refresh();
    }
  });

  const run = async (id: string, action: "publish" | "archive" | "restore" | "delete") => {
    setFailure("");
    setNotice("");
    if (action === "delete" && !window.confirm("Delete this document? The document is removed from the active list but its history is retained.")) return;
    try {
      await lifecycle.mutateAsync({ id, action });
    } catch (error) {
      setFailure(errorMessage(error, `The document could not be ${action === "archive" ? "archived" : action}d.`));
    }
  };
  const publishSelectedSpace = async (id: string) => {
    setFailure("");
    setNotice("");
    try {
      await publishSpaceMutation.mutateAsync(id);
    } catch (error) {
      setFailure(errorMessage(error, "The knowledge space could not be published."));
    }
  };
  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFailure("");
    setNotice("");
    try {
      await upload.mutateAsync(file);
    } catch (error) {
      setFailure(errorMessage(error, "The document could not be uploaded."));
    }
  };

  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={5} />;
  if (platform.state === "ERROR" || !platform.snapshot) {
    return <ErrorFallback title="Knowledge Base unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  }
  if (!canRead) {
    return <ErrorFallback title="Access denied" description="The knowledge.base.read permission is required to view the knowledge base." code="knowledge.base.read" />;
  }
  if (spaces.isPending) return <PageSkeleton rows={5} />;
  if (spaces.isError || !spaces.data) {
    return <ErrorFallback title="Knowledge Base unavailable" description="Workspace knowledge spaces could not be loaded." onRetry={() => { void spaces.refetch(); }} />;
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (spaces.data.length === 0) {
    return (
      <section className="space-y-6 p-6" data-testid="knowledge-base-list">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">Organize workspace documents and publish them to agents.</p>
          </div>
          {canManage && (
            <Link href="/knowledge/new" className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              <Plus className="h-4 w-4" />Create space
            </Link>
          )}
        </div>
        <Card>
          <EmptyState
            title="No knowledge spaces yet"
            description={canManage ? "Create the first space to start uploading documents." : "No knowledge spaces are available in this workspace."}
            icon={<Database className="h-5 w-5" />}
            action={
              canManage ? (
                <Link href="/knowledge/new" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">Create space</Link>
              ) : undefined
            }
          />
        </Card>
      </section>
    );
  }



  return (
    <section className="space-y-6 p-6" data-testid="knowledge-base-list">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Organize workspace documents and publish them to agents.</p>
        </div>
        {canManage && (
          <Link href="/knowledge/new" className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            <Plus className="h-4 w-4" />Create space
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Space</span>
          <select
            aria-label="Select knowledge space"
            value={selectedSpaceId}
            onChange={(event) => { setPage(1); setSpaceId(event.target.value); }}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            {spaces.data.map((space) => (
              <option key={space.id} value={space.id}>{space.name}</option>
            ))}
          </select>
        </label>
        {selectedSpace && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(selectedSpace.status)}>{selectedSpace.status}</Badge>
            {canViewRuntimes && runtimes.data && (
              <Badge variant="outline" title="Retrieval packages prepared from this space">
                {runtimes.data.data.length} retrieval package{runtimes.data.data.length === 1 ? "" : "s"}
              </Badge>
            )}
            {canPublish && selectedSpace.status !== "PUBLISHED" && (
              <Button size="sm" variant="outline" disabled={publishSpaceMutation.isPending} onClick={() => { void publishSelectedSpace(selectedSpaceId); }}>
                {publishSpaceMutation.isPending ? "Publishing…" : "Publish space"}
              </Button>
            )}
            {canManage && (
              <Link href={`/knowledge/${selectedSpace.id}`} className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
                Edit space
              </Link>
            )}
          </div>
        )}
      </div>

      <form className="flex max-w-2xl flex-wrap gap-2" onSubmit={submitSearch}>
        <Input aria-label="Search documents" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={200} placeholder="Search by name, slug, or description" />
        <select aria-label="Filter documents by status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as KnowledgeStatus | ""); }} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="INDEXING">Indexing</option>
          <option value="READY">Ready</option>
          <option value="FAILED">Failed</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" />Search</Button>
        {canWrite && selectedSpace && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" data-testid="document-file-input" onChange={(event) => { void onFileChange(event); }} />
            <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />{upload.isPending ? "Uploading…" : "Upload document"}
            </Button>
          </>
        )}
      </form>

      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

      {!selectedSpace || documents.isPending ? (
        <PageSkeleton rows={5} />
      ) : documents.isError || !documents.data ? (
        <ErrorFallback title="Documents unavailable" description="Knowledge documents could not be loaded." onRetry={() => { void documents.refetch(); }} />
      ) : documents.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={search || status ? "No matching documents" : "No documents in this space"}
            description={search || status ? "Try a different search term or status filter." : canWrite ? "Upload the first document for this space." : "No documents are available in this space."}
            icon={<FileText className="h-5 w-5" />}
            action={canWrite && !search && !status ? (
              <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />Upload document
              </Button>
            ) : undefined}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{selectedSpace.name}</CardTitle>
            <CardDescription>{selectedSpace.description || selectedSpace.slug || "Workspace knowledge documents"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Document</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Indexing</th>
                    <th className="px-3 py-2 font-medium">Chunks</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.data.data.map((document) => {
                    const failureReason = documentFailureReason(document);
                    return (
                      <tr key={document.id} className="border-t align-top hover:bg-accent/40">
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{document.fileName || document.name || document.slug}</p>
                          {document.originalName && document.originalName !== document.fileName && (
                            <p className="text-xs text-muted-foreground">{document.originalName}</p>
                          )}
                          {failureReason && <p role="alert" className="text-xs text-destructive">{failureReason}</p>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{document.sourceType}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadgeVariant(document.status)}>{document.status}</Badge>
                          {document.revision > 0 && <span className="ml-1 text-xs text-muted-foreground">v{document.revision}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={document.indexingStatus === "FAILED" ? "destructive" : document.indexingStatus === "PROCESSING" ? "secondary" : "outline"}>
                            {document.indexingStatus}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{document.totalChunks}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatFileSize(document.fileSize)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDateTime(document.updatedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            {(document.status === "DRAFT" || document.status === "READY") && canPublish && (
                              <Button size="sm" disabled={lifecycle.isPending} onClick={() => { void run(document.id, "publish"); }}>Publish</Button>
                            )}
                            {document.status !== "ARCHIVED" && canArchive && (
                              <Button size="sm" variant="outline" disabled={lifecycle.isPending} onClick={() => { void run(document.id, "archive"); }}>Archive</Button>
                            )}
                            {document.status === "ARCHIVED" && canArchive && (
                              <Button size="sm" variant="outline" disabled={lifecycle.isPending} onClick={() => { void run(document.id, "restore"); }}>Restore</Button>
                            )}
                            {(document.status === "DRAFT" || document.status === "FAILED" || document.status === "ARCHIVED") && canDelete && (
                              <Button size="sm" variant="outline" disabled={lifecycle.isPending} onClick={() => { void run(document.id, "delete"); }}>Delete</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSpace && documents.data && documents.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {documents.data.pagination.totalPages}</span>
          <Button type="button" variant="outline" disabled={page >= documents.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      )}
    </section>
  );
}


