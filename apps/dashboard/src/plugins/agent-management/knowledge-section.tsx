"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@responix/api-client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@responix/ui";
import { bindRetrievalRuntime, unbindRetrievalRuntime, type AgentRecord } from "./agent-api";
import {
  documentHistory,
  listDocuments,
  listRetrievalRuntimes,
  listSpaces,
  prepareRetrievalRuntime,
  publishRetrievalRuntime,
  type KnowledgeSpace,
  type RetrievalRuntimeRecord
} from "../knowledge-base/knowledge-api";

const message = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : "Knowledge configuration could not be updated.";

export function AgentKnowledgeSection({ agent, workspaceId, canWrite }: { agent: AgentRecord; workspaceId?: string; canWrite: boolean }) {
  const client = useQueryClient();
  const [spaceId, setSpaceId] = useState("");
  const [failure, setFailure] = useState("");
  const spaces = useQuery({ queryKey: ["workspace", workspaceId, "knowledge-spaces", "agent-options"], queryFn: listSpaces, enabled: Boolean(workspaceId) });
  const allRuntimes = useQuery({ queryKey: ["workspace", workspaceId, "retrieval-runtimes", "agent-options"], queryFn: () => listRetrievalRuntimes(), enabled: Boolean(workspaceId) });
  const boundRuntime = (Array.isArray(allRuntimes.data?.data) ? allRuntimes.data.data : []).find((runtime) => runtime.id === agent.retrievalRuntimeId);
  useEffect(() => {
    if (boundRuntime) setSpaceId(boundRuntime.knowledgeBaseId);
  }, [boundRuntime?.knowledgeBaseId]);
  const selected = (Array.isArray(spaces.data) ? spaces.data : []).find((space) => space.id === spaceId);
  const runtimes = useQuery({ queryKey: ["workspace", workspaceId, "retrieval-runtimes", spaceId], queryFn: () => listRetrievalRuntimes(spaceId), enabled: Boolean(workspaceId && spaceId) });
  const published = (Array.isArray(runtimes.data?.data) ? runtimes.data.data : []).find((runtime) => runtime.status === "PUBLISHED");
  const refresh = async (updated: AgentRecord) => {
    client.setQueryData(["workspace", workspaceId, "agent", agent.id], updated);
    await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "agents"] });
  };
  const connect = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a Knowledge Space.");
      let runtime: RetrievalRuntimeRecord | undefined = published;
      if (!runtime) {
        if (selected.status !== "PUBLISHED") throw new Error("Publish this Knowledge Space before connecting it.");
        const page = await listDocuments(1, { spaceId: selected.id, status: "PUBLISHED" });
        const sources = (await Promise.all(page.data.map(async (document) => {
          const versions = await documentHistory(document.id);
          return versions[0] ? { documentId: document.id, versionId: versions[0].id } : undefined;
        }))).filter((source): source is { documentId: string; versionId: string } => Boolean(source));
        if (!sources.length) throw new Error("This Knowledge Space has no published indexed documents.");
        runtime = await prepareRetrievalRuntime({ name: `${selected.name} Retrieval`, knowledgeBaseId: selected.id, sources });
        await publishRetrievalRuntime(runtime.id);
      }
      return bindRetrievalRuntime(agent.id, runtime.id);
    },
    onSuccess: refresh,
    onError: (error) => setFailure(message(error))
  });
  const disconnect = useMutation({ mutationFn: () => unbindRetrievalRuntime(agent.id), onSuccess: refresh, onError: (error) => setFailure(message(error)) });
  const connected = Boolean(agent.retrievalRuntimeId);
  const busy = connect.isPending || disconnect.isPending;
  return <Card>
    <CardHeader><CardTitle>Knowledge Retrieval</CardTitle><CardDescription>Connect one published Knowledge Space. Retrieval runs only when the Knowledge Retrieval capability is ON and a published snapshot is connected. Turning the capability OFF skips retrieval but preserves the binding and Knowledge data.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      {connected ? <p className="text-sm text-green-700">Connected to {selected?.name ?? "the persisted Knowledge Space"}.</p> : <p className="text-sm text-muted-foreground">No Knowledge Space is connected.</p>}
      <label className="block space-y-2 text-sm" htmlFor="agent-knowledge-space">Knowledge Space
        <select id="agent-knowledge-space" value={spaceId} disabled={!canWrite || busy} onChange={(event) => setSpaceId(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
          <option value="">Select a Knowledge Space</option>
          {(Array.isArray(spaces.data) ? spaces.data : []).map((space: KnowledgeSpace) => <option key={space.id} value={space.id}>{space.name} ({space.status})</option>)}
        </select>
      </label>
      {selected && <p className="text-xs text-muted-foreground">{published ? "Published retrieval state is ready to connect." : selected.status === "PUBLISHED" ? "A retrieval runtime will be prepared and published when connected." : "Publish the Knowledge Space first."}</p>}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      <div className="flex gap-2"><Button type="button" disabled={!canWrite || busy || !spaceId} onClick={() => { setFailure(""); void connect.mutateAsync(); }}>{connect.isPending ? "Connecting…" : "Connect Knowledge"}</Button>{connected && <Button type="button" variant="outline" disabled={!canWrite || busy} onClick={() => { setFailure(""); void disconnect.mutateAsync(); }}>{disconnect.isPending ? "Disconnecting…" : "Disconnect"}</Button>}</div>
    </CardContent>
  </Card>;
}
