"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@responix/ui";
import { usePlatformBootstrap } from "../../platform";
import { listAgents, updateAutomaticExecution, updateOperationalPersonality, type AgentRecord, type OperationalPersonality } from "../agent-management/agent-api";
import { PersonalityConsole, personalityOrDefault } from "../agent-management/personality-console";
import { listInboxConnections, listWorkspaceMessages } from "../conversation-inbox/inbox-api";

export function ActiveResponix() {
  const platform = usePlatformBootstrap();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("agent.studio.read");
  const canWrite = platform.hasPermission("agent.studio.write");
  const canReadChannels = platform.hasPermission("channel.runtime.read");
  const client = useQueryClient();
  const agents = useQuery({ queryKey: ["workspace", workspaceId, "active-responix"],
    queryFn: () => listAgents(1, undefined, "PUBLISHED"), enabled: Boolean(workspaceId && canRead) });
  const options = agents.data?.data ?? [];
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => { if (options.length && !options.some((agent) => agent.id === selectedId)) {
    setSelectedId((options.find((agent) => agent.activeChannels.length)?.id ?? options[0]!.id));
  } }, [options, selectedId]);
  const agent = options.find((item) => item.id === selectedId);
  const [personalityDraft, setPersonalityDraft] = useState<OperationalPersonality>();
  useEffect(() => { setPersonalityDraft(agent ? personalityOrDefault(agent.runtimeConfiguration?.personality) : undefined); }, [agent?.id, agent?.runtimeConfiguration?.personality]);
  const channelIds = [...new Set(agent?.activeChannels.map((item) => item.channelId) ?? [])];
  const connections = useQuery({ queryKey: ["workspace", workspaceId, "active-responix-connections", channelIds],
    queryFn: async () => (await Promise.all(channelIds.map((id) => listInboxConnections(id)))).flat(),
    enabled: Boolean(agent && canReadChannels && channelIds.length) });
  const messages = useQuery({ queryKey: ["workspace", workspaceId, "active-responix-messages"],
    queryFn: () => listWorkspaceMessages(1, 100), enabled: Boolean(agent && canReadChannels), refetchInterval: 5000 });
  const boundConnectionIds = useMemo(() => new Set(agent?.activeChannels.map((item) => item.connectionId) ?? []), [agent]);
  const recent = (messages.data?.data ?? []).filter((item) => boundConnectionIds.has(item.connectionId));
  const inbound = recent.filter((item) => item.direction === "INCOMING").length;
  const replies = recent.filter((item) => item.direction === "OUTGOING" && item.normalizedPayload?.producer?.agentId === agent?.id).length;
  const seen = useRef<{ agentId: string; ids: Set<string> }>({ agentId: "", ids: new Set() });
  const [newMessage, setNewMessage] = useState<{ id: string; conversationId: string }>();
  useEffect(() => {
    if (!agent || !messages.data) return;
    const rows = messages.data.data.filter((item) => boundConnectionIds.has(item.connectionId));
    if (seen.current.agentId !== agent.id) {
      seen.current = { agentId: agent.id, ids: new Set(rows.map((item) => item.id)) };
      setNewMessage(undefined);
      return;
    }
    const arriving = rows.find((item) => item.direction === "INCOMING" && !seen.current.ids.has(item.id));
    seen.current.ids = new Set(rows.map((item) => item.id));
    if (arriving) setNewMessage({ id: arriving.id, conversationId: arriving.conversationId });
  }, [agent, boundConnectionIds, messages.data]);
  const paused = agent?.runtimeConfiguration?.automaticExecution?.enabled === false;
  const pause = useMutation({ mutationFn: () => updateAutomaticExecution(agent!.id, Boolean(paused)),
    onSuccess: async (updated) => { client.setQueryData(["workspace", workspaceId, "agent", updated.id], updated);
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "active-responix"] }); } });
  const savePersonality = useMutation({ mutationFn: (value: OperationalPersonality) => updateOperationalPersonality(agent!.id, value),
    onSuccess: async (updated) => { client.setQueryData(["workspace", workspaceId, "agent", updated.id], updated);
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "active-responix"] }); } });

  if (!canRead) return <Card><CardHeader><CardTitle>Active Responix</CardTitle><CardDescription>Agent Studio read permission is required.</CardDescription></CardHeader></Card>;
  return <Card data-testid="active-responix">
    <CardHeader><CardTitle>Active Responix Control Center</CardTitle><CardDescription>Select a published Agent to view its channel activity and operational controls.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {agents.isPending ? <p className="text-sm text-muted-foreground">Loading Agents…</p> : options.length === 0 ? <p className="text-sm text-muted-foreground">No published Agents are available.</p> : <>
        <label className="block space-y-2 text-sm">Active Agent<select aria-label="Active Agent" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm">{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {agent && <>
          <div className="flex flex-wrap items-center gap-2"><strong>{agent.name}</strong><Badge>{agent.status}</Badge><Badge variant={paused ? "secondary" : "default"}>{paused ? "Paused" : "Running"}</Badge></div>
          <div className="text-sm"><p>Channels / connections</p>{!agent.activeChannels.length ? <p className="text-muted-foreground">No active channel bindings.</p> : connections.isError || !canReadChannels ? <p className="text-muted-foreground">Connection status unavailable.</p> : <ul className="mt-1 flex flex-wrap gap-2">{agent.activeChannels.map((binding) => { const connection = connections.data?.find((item) => item.id === binding.connectionId); const health = connection?.health?.status; return <li key={binding.connectionId}><Badge variant="outline">{connection ? `${connection.state} · ${typeof health === "string" ? health : "health unknown"}` : "Status unavailable"}</Badge></li>; })}</ul>}</div>
          <div className="rounded-md border p-3"><p className="text-sm font-medium">Message activity</p>{messages.isError || !canReadChannels ? <p className="text-sm text-muted-foreground">Activity unavailable.</p> : <><p className="text-sm">Incoming customer messages: {messages.isPending ? "Loading…" : inbound}</p><p className="text-sm">Automated replies: {messages.isPending ? "Loading…" : replies}</p><p className="mt-1 text-xs text-muted-foreground">Counts are for this Agent’s bound connections in the latest 100 workspace messages.</p></>}
            {newMessage && <Link className="mt-2 inline-flex text-sm font-medium text-primary underline" href={`/inbox#conversationId=${encodeURIComponent(newMessage.conversationId)}`}>New incoming message · Open conversation</Link>}
          </div>
          <div className="flex items-center gap-2"><Button type="button" variant={paused ? "default" : "outline"} disabled={!canWrite || pause.isPending} onClick={() => pause.mutate()}>{pause.isPending ? "Saving…" : paused ? "Resume Agent" : "Pause Agent"}</Button>{pause.isError && <span role="alert" className="text-sm text-destructive">Agent control could not be saved.</span>}</div>
          <PersonalityConsole value={personalityDraft} disabled={!canWrite} saving={savePersonality.isPending} onChange={setPersonalityDraft} onSave={() => savePersonality.mutate(personalityOrDefault(personalityDraft))} />
          {savePersonality.isError && <p role="alert" className="text-sm text-destructive">Personality could not be saved.</p>}
        </>}
      </>}
    </CardContent>
  </Card>;
}
