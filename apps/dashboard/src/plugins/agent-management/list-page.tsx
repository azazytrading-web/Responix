"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Bot, Plus, Search, X } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import {
  archiveAgent,
  cloneAgent,
  deleteAgent,
  listAgents,
  publishAgent,
  restoreAgent,
  switchAgentChannel,
  type AgentRecord,
  type AgentStatus
} from "./agent-api";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;
}

function SwitchChannelDialog({
  agent,
  candidates,
  busy,
  onSwitch,
  onClose
}: {
  agent: AgentRecord;
  candidates: AgentRecord[];
  busy: boolean;
  onSwitch: (connectionId: string, targetAgentId: string, stateVersion: number) => Promise<void>;
  onClose: () => void;
}) {
  const [connectionId, setConnectionId] = useState(agent.activeChannels[0]?.connectionId ?? "");
  const [targetAgentId, setTargetAgentId] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Switch active agent on channel"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-4 rounded-lg border bg-background p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Switch channel agent</h2>
            <p className="text-sm text-muted-foreground">
              Change which agent answers this channel connection. The current agent is {agent.name}.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" disabled={busy} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">Channel connection</span>
          <div className="space-y-2">
            {agent.activeChannels.map((channel) => (
              <label
                key={channel.connectionId}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${connectionId === channel.connectionId ? "border-primary" : ""}`}
              >
                <input
                  type="radio"
                  name="switch-connection"
                  value={channel.connectionId}
                  checked={connectionId === channel.connectionId}
                  disabled={busy}
                  onChange={() => setConnectionId(channel.connectionId)}
                />
                <span>Connection {channel.connectionId.slice(0, 8)} · Channel {channel.channelId.slice(0, 8)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="switch-target">Target agent</label>
          <select
            id="switch-target"
            value={targetAgentId}
            onChange={(event) => setTargetAgentId(event.target.value)}
            disabled={busy || candidates.length === 0}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a target agent…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">No published target agents to switch to.</p>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={busy || !connectionId || !targetAgentId}
            onClick={() => {
              setConfirming(true);
              const selected = agent.activeChannels.find((channel) => channel.connectionId === connectionId);
              if (!selected) return;
              void onSwitch(connectionId, targetAgentId, selected.stateVersion).then(
                () => setError(""),
                (reason: unknown) => {
                  const message =
                    reason instanceof Error ? reason.message : "The agent could not be switched.";
                  setError(message || "The agent could not be switched.");
                  setConfirming(false);
                }
              );
            }}
          >
            {confirming ? "Switching…" : "Confirm switch"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AgentListPage() {
  const platform = usePlatformBootstrap();
  const router = useRouter();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("agent.studio.read");
  const canWrite = platform.hasPermission("agent.studio.write");
  const canPublish = platform.hasPermission("agent.studio.publish");
  const canArchive = platform.hasPermission("agent.studio.archive");
  const canDelete = platform.hasPermission("agent.studio.delete");
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AgentStatus | "">("");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [switchAgent, setSwitchAgent] = useState<AgentRecord | null>(null);
  const query = useQuery({
    queryKey: ["workspace", workspaceId, "agents", { page, search, status }],
    queryFn: () => listAgents(page, search, status || undefined),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "agents"] });
  };
  const lifecycle = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "archive" | "restore" | "delete" | "publish" }) =>
      action === "publish"
        ? (await publishAgent(id)).agent
        : action === "archive"
          ? archiveAgent(id)
          : action === "restore"
            ? restoreAgent(id)
            : deleteAgent(id),
    onSuccess: async (_result, variables) => {
      setNotice(
        variables.action === "publish"
          ? "Agent published."
          : variables.action === "delete"
            ? "Agent deleted."
            : `Agent ${variables.action}d.`
      );
      await refresh();
    }
  });
  const clone = useMutation({
    mutationFn: (agent: AgentRecord) => {
      const suffix = Date.now();
      return cloneAgent(agent.id, {
        name: `${agent.name} Draft`,
        slug: `${agent.slug}-draft-${suffix}`.slice(0, 160)
      });
    },
    onSuccess: (draft) => router.push(`/ai/agents/${draft.id}`)
  });
  const run = async (id: string, action: "archive" | "restore" | "delete" | "publish") => {
    setFailure("");
    setNotice("");
    if (action === "delete" && !window.confirm("Delete this Agent? This action cannot be undone.")) return;
    try {
      await lifecycle.mutateAsync({ id, action });
    } catch (error) {
      setFailure(errorMessage(error, `The agent could not be ${action === "archive" ? "archived" : action}d.`));
    }
  };
  const editAsDraft = async (agent: AgentRecord) => {
    setFailure("");
    setNotice("");
    try {
      await clone.mutateAsync(agent);
    } catch (error) {
      setFailure(errorMessage(error, "A draft could not be created from this agent."));
    }
  };
  const switchChannel = useMutation({
    mutationFn: ({ id, connectionId, stateVersion }: { id: string; connectionId: string; stateVersion: number }) =>
      switchAgentChannel(id, connectionId, stateVersion),
    onSuccess: () => {
      setSwitchAgent(null);
      void refresh();
    }
  });
  const switchCurrent = async (
    connectionId: string,
    targetAgentId: string,
    stateVersion: number
  ) => {
    await switchChannel.mutateAsync({ id: targetAgentId, connectionId, stateVersion });
  };

  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={5} />;
  if (platform.state === "ERROR" || !platform.snapshot) {
    return <ErrorFallback title="Agents unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  }
  if (!canRead) {
    return <ErrorFallback title="Access denied" description="The agent.studio.read permission is required to view agents." code="agent.studio.read" />;
  }
  if (query.isPending) return <PageSkeleton rows={5} />;
  if (query.isError || !query.data) {
    return <ErrorFallback title="Agents unavailable" description="Workspace agents could not be loaded." onRetry={() => { void query.refetch(); }} />;
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <section className="space-y-6 p-6" data-testid="agent-list">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">Create and configure workspace AI agents.</p>
        </div>
        {canWrite && <Link href="/ai/agents/new" className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"><Plus className="h-4 w-4" />Create Agent</Link>}
      </div>

      <form className="flex max-w-xl flex-wrap gap-2" onSubmit={submitSearch}>
        <Input aria-label="Search agents" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={200} placeholder="Search by name, slug, or description" />
        <select aria-label="Filter agents by status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as AgentStatus | ""); }} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" />Search</Button>
      </form>

      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

      {query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? "No matching agents" : "No agents yet"}
            description={search ? "Try a different search term." : canWrite ? "Create the first agent for this workspace." : "No agents are available in this workspace."}
            icon={<Bot className="h-5 w-5" />}
            action={canWrite && !search ? <Link href="/ai/agents/new" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">Create Agent</Link> : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.data.map((agent) => {
            const activeCount = agent.activeChannels?.length ?? 0;
            return (
            <Card key={agent.id} className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle><Link href={`/ai/agents/${agent.id}`} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{agent.name}</Link></CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeCount > 0 && (
                        <Badge variant="default" title={`Used by ${activeCount} channel connection${activeCount === 1 ? "" : "s"}`}>
                          ACTIVE
                        </Badge>
                      )}
                      <Badge variant={agent.status === "PUBLISHED" || agent.status === "ACTIVE" ? "secondary" : "outline"}>{agent.status}</Badge>
                    </div>
                  </div>
                  <CardDescription>{agent.description || agent.slug}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{agent.category || "Uncategorized"}</p>
                  <p>Version {agent.version} · {agent.visibility}</p>
                  {activeCount > 0 && (
                    <p className="text-xs text-foreground/80" data-testid="active-channel-hint">
                      {activeCount === 1
                        ? "Active on a channel connection."
                        : `Active on ${activeCount} channel connections.`}{" "}
                      <span
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer text-primary underline"
                        onClick={() => setSwitchAgent(agent)}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setSwitchAgent(agent); } }}
                      >
                        Switch agent
                      </span>
                      .
                    </p>
                  )}
                  {((agent.status === "DRAFT" || agent.status === "ARCHIVED") && canDelete) ||
                  ((agent.status === "PUBLISHED" || agent.status === "ACTIVE") && canArchive) ||
                  (agent.status === "ARCHIVED" && canArchive) ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link href={`/ai/agents/${agent.id}`} className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">View</Link>
                      {agent.status === "DRAFT" && canPublish && (
                        <Button size="sm" disabled={lifecycle.isPending || clone.isPending} onClick={() => { void run(agent.id, "publish"); }}>Publish</Button>
                      )}
                      {(agent.status === "DRAFT" || agent.status === "ARCHIVED") && canDelete && (
                        <Button size="sm" variant="outline" disabled={lifecycle.isPending || clone.isPending} onClick={() => { void run(agent.id, "delete"); }}>Delete</Button>
                      )}
                      {(agent.status === "PUBLISHED" || agent.status === "ACTIVE") && canArchive && (
                        <Button size="sm" variant="outline" disabled={lifecycle.isPending || clone.isPending || activeCount > 0} title={activeCount > 0 ? "This agent is active on a channel. Switch or disconnect it in Channels before archiving." : undefined} onClick={() => { void run(agent.id, "archive"); }}>Archive</Button>
                      )}
                      {agent.status === "ARCHIVED" && canArchive && (
                        <Button size="sm" variant="outline" disabled={lifecycle.isPending || clone.isPending} onClick={() => { void run(agent.id, "restore"); }}>Restore</Button>
                      )}
                      {(agent.status === "PUBLISHED" || agent.status === "ACTIVE") && canWrite && (
                        <Button size="sm" variant="outline" disabled={lifecycle.isPending || clone.isPending} onClick={() => { void editAsDraft(agent); }}>Edit as new draft</Button>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            
            );
          })}
        </div>
      )}

      {query.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {query.data.pagination.totalPages}</span>
          <Button type="button" variant="outline" disabled={page >= query.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      )}

      {switchAgent && (
        <SwitchChannelDialog
          agent={switchAgent}
          candidates={query.data.data.filter(
            (value) => value.id !== switchAgent.id && value.status === "PUBLISHED"
          )}
          busy={switchChannel.isPending}
          onSwitch={switchCurrent}
          onClose={() => { if (!switchChannel.isPending) setSwitchAgent(null); }}
        />
      )}
    </section>
  );
}
