"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
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
import { BookOpen, Plus, Search, Star } from "lucide-react";
import { ApiError } from "@responix/api-client";
import { usePlatformBootstrap } from "../../platform";
import {
  archivePrompt,
  deletePrompt,
  favoritePrompt,
  listPrompts,
  promptQueryRoot,
  restorePrompt,
  type PromptStatus
} from "./prompt-api";
import { PromptResourceManager } from "./resource-manager";

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : e instanceof Error && e.message ? e.message : fallback;

export function PromptListPage() {
  const platform = usePlatformBootstrap(),
    workspaceId = platform.snapshot?.workspace.id,
    client = useQueryClient();
  const canRead = platform.hasPermission("prompt.library.read"),
    canWrite = platform.hasPermission("prompt.library.write"),
    canArchive = platform.hasPermission("prompt.library.archive"),
    canDelete = platform.hasPermission("prompt.library.delete");
  const [page, setPage] = useState(1),
    [searchInput, setSearchInput] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState<PromptStatus | "">(""),
    [archived, setArchived] = useState(false),
    [failure, setFailure] = useState("");
  const query = useQuery({
    queryKey: [...promptQueryRoot(workspaceId), "list", { page, search, status, archived }],
    queryFn: () => listPrompts({ page, search, status: status || undefined, archived }),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead
  });
  const refresh = async () => client.invalidateQueries({ queryKey: promptQueryRoot(workspaceId) });
  const lifecycle = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "restore" }) =>
      action === "archive" ? archivePrompt(id) : restorePrompt(id),
    onSuccess: refresh
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePrompt(id),
    onSuccess: refresh
  });
  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => favoritePrompt(id, value),
    onSuccess: refresh
  });
  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={5} />;
  if (platform.state === "ERROR" || !platform.snapshot)
    return (
      <ErrorFallback
        title="Prompt Library unavailable"
        description="The workspace platform state could not be loaded."
        onRetry={platform.retry}
      />
    );
  if (!canRead)
    return (
      <ErrorFallback
        title="Access denied"
        description="The prompt.library.read permission is required to view prompts."
        code="prompt.library.read"
      />
    );
  if (query.isPending) return <PageSkeleton rows={5} />;
  if (query.isError || !query.data)
    return (
      <ErrorFallback
        title="Prompt Library unavailable"
        description={errorText(query.error, "Workspace prompts could not be loaded.")}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const run = async (id: string, action: "archive" | "restore") => {
    setFailure("");
    try {
      await lifecycle.mutateAsync({ id, action });
    } catch (e) {
      setFailure(errorText(e, `The prompt could not be ${action}d.`));
    }
  };
  const runDelete = async (id: string) => {
    setFailure("");
    if (!window.confirm("Delete this Prompt? This action cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setFailure(errorText(e, "The prompt could not be deleted."));
    }
  };
  return (
    <section className="space-y-6 p-6" data-testid="prompt-library-list">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Prompt Library</h1>
          <p className="text-sm text-muted-foreground">
            Workspace prompt drafts, immutable publications, variables, and lifecycle.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/ai/prompts/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create Prompt
          </Link>
        )}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <Input
          className="max-w-sm"
          aria-label="Search prompts"
          placeholder="Search prompts"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          maxLength={200}
        />
        <Button variant="outline" type="submit">
          <Search className="h-4 w-4" />
          Search
        </Button>
        <select
          aria-label="Prompt status"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as PromptStatus | "");
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All states</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setPage(1);
              setArchived(e.target.checked);
              setStatus("");
            }}
          />
          Archived only
        </label>
      </form>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              search ? "No matching prompts" : archived ? "No archived prompts" : "No prompts yet"
            }
            description={
              canWrite && !search && !archived
                ? "Create the first Prompt Library resource for this workspace."
                : "Change the current filters or search."
            }
            icon={<BookOpen className="h-5 w-5" />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.data.map((prompt) => (
            <Card key={prompt.id} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex justify-between gap-2">
                  <div>
                    <CardTitle>
                      <Link className="hover:underline" href={`/ai/prompts/${prompt.id}`}>
                        {prompt.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>{prompt.description || prompt.slug}</CardDescription>
                  </div>
                  <Badge variant={prompt.status === "PUBLISHED" ? "default" : "secondary"}>
                    {prompt.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Revision {prompt.revision} · {prompt.variables.length} variable
                  {prompt.variables.length === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canWrite && prompt.status === "DRAFT" && (
                    <Link
                      className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
                      href={`/ai/prompts/${prompt.id}`}
                    >
                      Edit
                    </Link>
                  )}
                  {canWrite && prompt.status !== "ARCHIVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                        onClick={() => {
                          void (async () => {
                            setFailure("");
                            try {
                              await favorite.mutateAsync({ id: prompt.id, value: !prompt.favorite });
                            } catch (e) {
                              setFailure(errorText(e, "The favorite state could not be updated."));
                            }
                          })();
                        }}
                    >
                      <Star className="h-4 w-4" />
                      {prompt.favorite ? "Unfavorite" : "Favorite"}
                    </Button>
                  )}
                  {(prompt.status === "DRAFT" || prompt.status === "ARCHIVED") && canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        void runDelete(prompt.id);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                  {canArchive && prompt.status !== "DRAFT" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={lifecycle.isPending}
                      onClick={() => {
                        void run(prompt.id, prompt.status === "ARCHIVED" ? "restore" : "archive");
                      }}
                    >
                      {prompt.status === "ARCHIVED" ? "Restore" : "Archive"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {query.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {query.data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {platform.hasPermission("prompt.library.manage") && workspaceId && (
        <PromptResourceManager workspaceId={workspaceId} />
      )}
    </section>
  );
}
