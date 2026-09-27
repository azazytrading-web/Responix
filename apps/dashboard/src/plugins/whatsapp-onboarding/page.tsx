"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@responix/api-client";
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  EmptyState, ErrorFallback, Input, Label, PageSkeleton
} from "@responix/ui";
import { MessageCircle, Copy, Check, AlertTriangle, Pencil } from "lucide-react";
import QRCode from "qrcode";
import { usePlatformBootstrap } from "../../platform";
import { env, isLocalUrl } from "../../devx/env";
import {
  createWhatsAppChannel, createWhatsAppConnection, getChannelConfiguration, listChannels,
  listChannelConversations, listConnections, disconnectBaileys, getBaileysDiagnostics,
  newBaileysPairing, reconnectBaileys, regenerateVerifyToken, transitionWhatsAppConnection,
  updateChannelConfiguration, updateWhatsAppConnection, validateWhatsAppConnection, whatsappQueryKey,
  listAgents, switchAgentChannel,
  type ChannelRecord, type CreateWhatsAppConnectionInput, type UpdateWhatsAppConnectionInput, type WhatsAppConnection
} from "./whatsapp-api";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function WhatsAppOnboardingPage() {
  const platform = usePlatformBootstrap();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("channel.runtime.read") &&
    platform.hasPermission("whatsapp.connection.read");
  const canCreateChannel = platform.hasPermission("channel.runtime.write");
  const query = useQuery({
    queryKey: whatsappQueryKey(workspaceId), queryFn: listChannels,
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead
  });
  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={6} />;
  if (platform.state === "ERROR" || !platform.snapshot) return <ErrorFallback title="WhatsApp unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  if (!canRead) return <ErrorFallback title="Access denied" description="Channel and WhatsApp read permissions are required." code="whatsapp.connection.read" />;
  if (query.isPending) return <PageSkeleton rows={6} />;
  if (query.isError || !query.data) return <ErrorFallback title="WhatsApp unavailable" description="Workspace channel configuration could not be loaded." onRetry={() => { void query.refetch(); }} />;
  const channels = query.data.data;
  return <section className="space-y-6 p-6" data-testid="whatsapp-onboarding">
    <div><h1 className="text-2xl font-semibold tracking-tight">WhatsApp Business</h1><p className="text-sm text-muted-foreground">Connect Meta WhatsApp Cloud to this workspace through encrypted, write-only credentials.</p></div>
    <Card><CardHeader><CardTitle>Connection boundary</CardTitle><CardDescription>This backend supports direct Meta Cloud configuration, webhook verification, health checks, messaging, and delivery callbacks. It does not expose Meta OAuth or Embedded Signup, so account identifiers and tokens are entered from Meta Business Manager.</CardDescription></CardHeader></Card>
    {channels.length === 0 ? <Card><CardContent className="pt-6"><EmptyState title="No WhatsApp channel" description="Create the workspace channel container before adding the Meta connection." icon={<MessageCircle className="h-5 w-5" />} />{canCreateChannel && <CreateChannel />}</CardContent></Card> :
      <div className="space-y-4">{channels.map((channel) => <ChannelConnection key={channel.id} channel={channel} />)}</div>}
  </section>;
}

function CreateChannel() {
  const platform = usePlatformBootstrap(), client = useQueryClient();
  const workspaceId = platform.snapshot?.workspace.id;
  const [name, setName] = useState("WhatsApp Business"), [failure, setFailure] = useState("");
  const mutation = useMutation({ mutationFn: () => createWhatsAppChannel(name.trim()), onSuccess: async () => {
    await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) });
  }});
  const submit = async (event: FormEvent) => { event.preventDefault(); setFailure(""); if (!name.trim()) { setFailure("Channel name is required."); return; }
    try { await mutation.mutateAsync(); } catch (error) { setFailure(errorMessage(error, "The WhatsApp channel could not be created.")); } };
  return <form className="mx-auto mt-5 flex max-w-xl items-end gap-3" onSubmit={(event) => { void submit(event); }}><div className="flex-1 space-y-2"><Label htmlFor="whatsapp-channel-name">Channel name</Label><Input id="whatsapp-channel-name" value={name} maxLength={120} disabled={mutation.isPending} onChange={(event) => setName(event.target.value)} /></div><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create channel"}</Button>{failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}</form>;
}

function ChannelConnection({ channel }: { channel: ChannelRecord }) {
  const platform = usePlatformBootstrap(), workspaceId = platform.snapshot?.workspace.id;
  const query = useQuery({ queryKey: [...whatsappQueryKey(workspaceId), channel.id, "connections"], queryFn: () => listConnections(channel.id),
    refetchInterval: channel.provider?.name === "baileys" ? 3000 : false });
  if (query.isPending) return <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Loading WhatsApp connection…</p></CardContent></Card>;
  if (query.isError || !query.data) return <Card><CardContent className="flex items-center gap-3 pt-6"><p role="alert" className="text-sm text-destructive">The connection state could not be loaded.</p><Button size="sm" variant="outline" onClick={() => { void query.refetch(); }}>Retry</Button></CardContent></Card>;
  const connection = query.data[0];
  if (channel.provider?.name === "baileys") return <BaileysConnectionCard connection={connection} />;
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{channel.name}</CardTitle><CardDescription>Workspace channel · {channel.compatibilityVersion}</CardDescription></div><div className="flex shrink-0 flex-wrap items-center gap-2"><Badge variant="outline">{channel.state}</Badge><Badge variant={connectionStateVariant(connection?.state ?? "DISCONNECTED")}>{connection?.state ?? "DISCONNECTED"}</Badge></div></div></CardHeader><CardContent className="space-y-4">{connection ? <ConnectionStatus connection={connection} /> : <ConnectionForm channelId={channel.id} />}{connection && <ChannelConversations channelId={channel.id} />}</CardContent></Card>;
}

function connectionStateVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "CONNECTED") return "default";
  if (state === "FAILED") return "destructive";
  if (state === "CONNECTING" || state === "DEGRADED") return "outline";
  return "secondary";
}

function BaileysConnectionCard({ connection }: { connection?: WhatsAppConnection }) {
  const platform = usePlatformBootstrap(), client = useQueryClient(), workspaceId = platform.snapshot?.workspace.id;
  const canAdmin = platform.hasPermission("whatsapp.connection.admin");
  const [failure, setFailure] = useState("");
  const diagnostics = useQuery({
    queryKey: [...whatsappQueryKey(workspaceId), connection?.id, "diagnostics"],
    queryFn: () => getBaileysDiagnostics(connection!.id), enabled: Boolean(connection),
    refetchInterval: (query) => ["CONNECTING", "RECONNECTING", "QR_REQUIRED"].includes(query.state.data?.state ?? "") ? 2000 : 10000
  });
  const runtimeState = diagnostics.data?.state ?? connection?.health?.state ?? "DISCONNECTED";
  const qr = connection?.health?.qr;
  const active = runtimeState === "RECONNECTING" || runtimeState === "CONNECTING" || Boolean(qr);
  const status = runtimeState === "CONNECTED" ? "Connected" : qr ? "Waiting for scan" : active ? "Connecting to WhatsApp..." : "Not connected";
  const refresh = useMutation({
    mutationFn: () => validateWhatsAppConnection(connection!.id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) }); },
    onError: (error) => setFailure(errorMessage(error, "Baileys could not start."))
  });
  const control = useMutation({ mutationFn: (action: "reconnect" | "disconnect" | "pair") =>
    action === "reconnect" ? reconnectBaileys(connection!.id) : action === "disconnect" ? disconnectBaileys(connection!.id) : newBaileysPairing(connection!.id),
    onSuccess: async () => { await Promise.all([diagnostics.refetch(), client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) })]); },
    onError: (error) => setFailure(errorMessage(error, "The session control request failed.")) });
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Baileys WhatsApp</CardTitle><CardDescription>Link a WhatsApp device with a QR code.</CardDescription></div><Badge variant={runtimeState === "CONNECTED" ? "default" : "secondary"}>{status}</Badge></div></CardHeader><CardContent className="space-y-4">
    {!connection ? <p className="text-sm text-muted-foreground">A Baileys connection has not been created for this channel.</p> : <>
      <div className="grid gap-3 text-sm md:grid-cols-3"><Info label="State" value={runtimeState} /><Info label="Socket" value={diagnostics.data?.socketPresent ? "Present" : "Absent"} /><Info label="Session" value={diagnostics.data?.sessionPresent ? "Present" : "Absent"} /><Info label="Last change" value={diagnostics.data?.lastStateChangeAt ? new Date(diagnostics.data.lastStateChangeAt).toLocaleString() : "Not recorded"} /><Info label="Last inbound" value={diagnostics.data?.lastInboundAt ? new Date(diagnostics.data.lastInboundAt).toLocaleString() : "None"} /><Info label="Reconnect attempts" value={String(diagnostics.data?.reconnectAttempts ?? 0)} /></div>
      {qr && <BaileysQr value={qr} />}
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      {diagnostics.data?.lastError && <p role="alert" className="text-sm text-destructive">Last error: {diagnostics.data.lastError}</p>}
      {canAdmin && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { void diagnostics.refetch(); }} disabled={diagnostics.isFetching}>Refresh status</Button>
        {runtimeState !== "CONNECTED" && <Button size="sm" onClick={() => { setFailure(""); void control.mutateAsync("reconnect"); }} disabled={control.isPending}>Reconnect</Button>}
        {runtimeState === "CONNECTED" && <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Disconnect the live socket but retain the existing WhatsApp pairing?")) void control.mutateAsync("disconnect"); }} disabled={control.isPending}>Disconnect</Button>}
        <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Pair a new device? This logs out and removes the existing Baileys pairing.")) void control.mutateAsync("pair"); }} disabled={control.isPending}>Pair new device</Button>
        {(runtimeState === "QR_REQUIRED" || Boolean(qr)) && <Button size="sm" onClick={() => { void refresh.mutateAsync(); }} disabled={refresh.isPending}>Refresh QR</Button>}
      </div>}
      <div className="rounded-md border"><div className="border-b px-4 py-3"><p className="font-medium">Activity</p><p className="text-xs text-muted-foreground">Safe connection and message-processing metadata.</p></div><div className="max-h-72 divide-y overflow-auto">
        {diagnostics.data?.recentEvents.length ? diagnostics.data.recentEvents.map((event, index) => <div key={`${event.at}-${index}`} className="grid grid-cols-[7rem_6rem_1fr] gap-2 px-4 py-2 text-xs"><span className="text-muted-foreground">{new Date(event.at).toLocaleTimeString()}</span><span className="font-medium">{event.stage}</span><span>{event.detail}</span></div>) : <p className="px-4 py-3 text-sm text-muted-foreground">No activity recorded in this API process.</p>}
      </div></div>
      <ResponixBinding connection={connection} />
      <ChannelConversations channelId={connection.channelId} />
    </>}
  </CardContent></Card>;
}

function ConnectionForm({ channelId }: { channelId: string }) {
  const platform = usePlatformBootstrap(), client = useQueryClient(), workspaceId = platform.snapshot?.workspace.id;
  const canWrite = platform.hasPermission("whatsapp.connection.write");
  const [form, setForm] = useState<CreateWhatsAppConnectionInput>({ businessAccountId: "", phoneNumberId: "", displayPhoneNumber: "", apiVersion: "v23.0", accessToken: "", verifyToken: "", appSecret: "" });
  const [failure, setFailure] = useState(""), [notice, setNotice] = useState("");
  const mutation = useMutation({ mutationFn: () => createWhatsAppConnection(channelId, { ...form, ...(form.displayPhoneNumber ? {} : { displayPhoneNumber: undefined }) }), onSuccess: async () => {
    setForm((value) => ({ ...value, accessToken: "", verifyToken: "", appSecret: "" })); setNotice("WhatsApp connection saved securely.");
    await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) });
  }});
  if (!canWrite) return <p className="text-sm text-muted-foreground">You can view this channel, but whatsapp.connection.write is required to connect it.</p>;
  const submit = async (event: FormEvent) => { event.preventDefault(); setFailure(""); setNotice("");
    if (![form.businessAccountId, form.phoneNumberId].every((value) => /^\d+$/.test(value)) || !form.accessToken || !form.verifyToken || !form.appSecret) { setFailure("Business account ID, phone number ID, access token, verify token, and app secret are required."); return; }
    try { await mutation.mutateAsync(); } catch (error) { setFailure(errorMessage(error, "The WhatsApp connection could not be saved.")); } };
  const field = (key: keyof CreateWhatsAppConnectionInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <form className="space-y-4" noValidate onSubmit={(event) => { void submit(event); }}>
    <div className="rounded-md border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20 p-3">
      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Meta Webhook Callback URL</p>
      <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">Fill the credentials below and click <strong>Save WhatsApp connection</strong>. The unique Callback URL will be generated and displayed here automatically. You will then copy it into Meta Developers.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2"><TextField id="wa-business" label="Business account ID" value={form.businessAccountId} change={(value) => field("businessAccountId", value)} /><TextField id="wa-phone-id" label="Phone number ID" value={form.phoneNumberId} change={(value) => field("phoneNumberId", value)} /><TextField id="wa-display" label="Display phone number (optional)" value={form.displayPhoneNumber ?? ""} change={(value) => field("displayPhoneNumber", value)} /><TextField id="wa-version" label="Graph API version" value={form.apiVersion} change={(value) => field("apiVersion", value)} /><SecretField id="wa-access-token" label="Access token" value={form.accessToken} change={(value) => field("accessToken", value)} /><SecretField id="wa-verify-token" label="Webhook verify token" value={form.verifyToken} change={(value) => field("verifyToken", value)} /><SecretField id="wa-app-secret" label="Meta app secret" value={form.appSecret} change={(value) => field("appSecret", value)} /></div><p className="text-xs text-muted-foreground">Secrets are submitted once to the encrypted Channel Runtime and are not returned to this page or stored in query data.</p>{failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}<Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Connecting…" : "Save WhatsApp connection"}</Button></form>;
}

function BaileysQr({ value }: { value: string }) {
  const [image, setImage] = useState<string | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, { width: 256, margin: 1 })
      .then((result) => { if (active) setImage(result); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [value]);
  if (failed) return <p role="alert" className="text-sm text-destructive">The WhatsApp QR could not be displayed.</p>;
  if (!image) return <p className="text-sm text-muted-foreground">Preparing QR…</p>;
  return <div className="flex flex-col items-start gap-3 rounded-md border p-4"><img src={image} width={256} height={256} alt="WhatsApp pairing QR code" className="h-64 w-64 bg-white p-2" /><div className="text-sm"><p className="font-medium">Open WhatsApp on your phone</p><p className="text-muted-foreground">Settings → Linked devices → Link a device, then scan this QR code.</p></div></div>;
}

function ConnectionStatus({ connection }: { connection: WhatsAppConnection }) {
  const platform = usePlatformBootstrap(), client = useQueryClient(), workspaceId = platform.snapshot?.workspace.id;
  const canWrite = platform.hasPermission("whatsapp.connection.write");
  const canAdmin = platform.hasPermission("whatsapp.connection.admin");
  const [notice, setNotice] = useState(""), [failure, setFailure] = useState("");
  const [editing, setEditing] = useState(false);
  const [regeneratedToken, setRegeneratedToken] = useState<string | null>(null);
  const refresh = useMutation({ mutationFn: () => validateWhatsAppConnection(connection.id), onSuccess: async (value) => { setNotice(value.state === "CONNECTED" ? "Meta connection validated." : `Connection state: ${value.state}.`); await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) }); }});
  const transition = useMutation({ mutationFn: (target: "CONNECTING" | "DISCONNECTED") => transitionWhatsAppConnection(connection.id, target, connection.stateVersion), onSuccess: async (value) => { setNotice(value.state === "CONNECTING" ? "Connection start requested." : "Connection state updated."); await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) }); }});
  const regen = useMutation({ mutationFn: () => regenerateVerifyToken(connection.id), onSuccess: (value) => { setRegeneratedToken(value.verifyToken); setNotice("Verify token regenerated. Copy it now — it will not be shown again."); } });
  const run = async (operation: "health" | "connect" | "disconnect") => { setFailure(""); setNotice(""); try { await (operation === "health" ? refresh.mutateAsync() : operation === "connect" ? transition.mutateAsync("CONNECTING") : transition.mutateAsync("DISCONNECTED")); } catch (error) { setFailure(errorMessage(error, "The connection operation failed.")); } };

  return <div className="space-y-4">
    <div className="grid gap-3 text-sm md:grid-cols-2"><Info label="Business account" value={connection.businessAccountId ?? "Not available"} /><Info label="Phone number ID" value={connection.phoneNumberId ?? "Not available"} /><Info label="Display number" value={connection.displayPhoneNumber ?? "Not provided"} /><Info label="Graph API" value={connection.apiVersion ?? "Not available"} /><Info label="Credentials" value={connection.accessTokenFingerprint ? "Encrypted and configured" : "Configuration incomplete"} /><Info label="Last health check" value={connection.lastHealthCheckAt ? new Date(connection.lastHealthCheckAt).toLocaleString() : "Not yet validated"} /></div>
    <WebhookCallback connection={connection} />
    <ResponixBinding connection={connection} />
    {regeneratedToken && <VerifyTokenDisplay token={regeneratedToken} onDismiss={() => setRegeneratedToken(null)} />}
    {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    {canAdmin && <div className="flex flex-wrap gap-2">
      {canWrite && <Button size="sm" variant="outline" onClick={() => { setEditing((v) => !v); setFailure(""); setNotice(""); }}><Pencil className="h-3 w-3 mr-1" />{editing ? "Cancel edit" : "Edit connection"}</Button>}
      <Button size="sm" onClick={() => { void run("health"); }} disabled={refresh.isPending}>{refresh.isPending ? "Validating…" : "Validate connection"}</Button>
      {(connection.state === "DISCONNECTED" || connection.state === "FAILED") && <Button size="sm" variant="outline" onClick={() => { void run("connect"); }} disabled={transition.isPending}>{transition.isPending ? "Updating…" : "Start connection"}</Button>}
      {connection.state === "DEGRADED" && <Button size="sm" variant="outline" onClick={() => { void run("connect"); }} disabled={transition.isPending}>{transition.isPending ? "Updating…" : "Reconnect"}</Button>}
      {(connection.state === "CONNECTING" || connection.state === "CONNECTED" || connection.state === "DEGRADED" || connection.state === "FAILED") && <Button size="sm" variant="outline" onClick={() => { void run("disconnect"); }} disabled={transition.isPending}>{transition.isPending ? "Updating…" : "Disconnect"}</Button>}
      {canWrite && <Button size="sm" variant="secondary" onClick={() => { void regen.mutateAsync(); }} disabled={regen.isPending}>{regen.isPending ? "Regenerating…" : "Regenerate verify token"}</Button>}
    </div>}
    {editing && <EditConnectionForm connection={connection} onDone={() => { setEditing(false); setFailure(""); setNotice(""); void client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) }); }} onError={(msg) => setFailure(msg)} />}
  </div>;
}

function WebhookCallback({ connection }: { connection: WhatsAppConnection }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${env.webhookBaseUrl}/api/v1/channel-runtime/webhooks/whatsapp/${connection.webhookPathKey}`;
  const isLocal = isLocalUrl(env.webhookBaseUrl);
  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="rounded-md border bg-muted/30 p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium">Meta Webhook Callback URL</p>
      <button type="button" onClick={() => { void copy(); }} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
    <code className="mt-1 block break-all text-xs">{fullUrl}</code>
    {isLocal && <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 p-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-400">Public webhook URL is not configured. Configure the application&apos;s public URL (NEXT_PUBLIC_WEBHOOK_BASE_URL or NEXT_PUBLIC_API_URL) before connecting Meta.</p>
    </div>}
    {!isLocal && <p className="mt-2 text-xs text-muted-foreground">Configure this exact callback URL in Meta Developers. Use the write-only verify token supplied during connection setup.</p>}
  </div>;
}

function VerifyTokenDisplay({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="rounded-md border border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20 p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-green-800 dark:text-green-300">New Verify Token</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => { void copy(); }} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onDismiss} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/80 transition-colors">Dismiss</button>
      </div>
    </div>
    <code className="mt-1 block break-all text-xs font-mono">{token}</code>
    <p className="mt-2 text-xs text-green-700 dark:text-green-400">Copy this token now — it will not be displayed again.</p>
  </div>;
}

function ResponixBinding({ connection }: { connection: WhatsAppConnection }) {
  const platform = usePlatformBootstrap(), client = useQueryClient(), workspaceId = platform.snapshot?.workspace.id;
  const canReadAgents = platform.hasPermission("agent.studio.read");
  const canBind = platform.hasPermission("agent.studio.write");
  const canUnbind = platform.hasPermission("channel.runtime.write");
  const agents = useQuery({
    queryKey: [...whatsappQueryKey(workspaceId), "agents"],
    queryFn: () => listAgents(1, undefined, "PUBLISHED"),
    enabled: canReadAgents
  });
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [notice, setNotice] = useState(""), [failure, setFailure] = useState("");
  const bound = agents.data?.data.find((agent) => agent.activeChannels.some((entry) => entry.connectionId === connection.id));
  const bind = useMutation({
    mutationFn: (agentId: string) => switchAgentChannel(agentId, connection.id, connection.stateVersion),
    onSuccess: async () => {
      setSelectedAgentId("");
      setFailure("");
      setNotice("Agent bound to this connection. Incoming messages will now trigger the agent.");
      await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) });
    }
  });
  const unbind = useMutation({
    mutationFn: async () => {
      const revisions = await getChannelConfiguration(connection.id);
      const latest = revisions[0];
      if (!latest) return;
      const current = latest.configuration && typeof latest.configuration === "object" ? { ...latest.configuration } : {};
      const remaining: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(current)) {
        if (key !== "agentExecution") remaining[key] = value;
      }
      await updateChannelConfiguration(connection.id, remaining, connection.stateVersion);
    },
    onSuccess: async () => {
      setFailure("");
      setNotice("Agent unbound from this connection.");
      await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) });
    }
  });
  if (!canReadAgents) return null;
  return <div className="space-y-3 rounded-md border p-4">
    <div><p className="font-medium">Responix binding</p><p className="text-xs text-muted-foreground">The published agent that answers messages received on this connection.</p></div>
    {agents.isPending && <p className="text-sm text-muted-foreground">Loading published agents…</p>}
    {agents.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(agents.error, "The available agents could not be loaded.")}</p>}
    {!agents.isPending && !agents.isError && (
      <>
        <p className="text-sm">{bound ? <>Bound agent: <span className="font-medium">{bound.name}</span></> : "No agent is bound to this connection yet."}</p>
        {agents.data.data.length === 0 && <p className="text-sm text-muted-foreground">No published agents are available in this workspace. Publish an agent in Agent Studio first.</p>}
        {canBind && agents.data.data.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-9 max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={selectedAgentId} aria-label="Responix agent to bind" onChange={(event) => setSelectedAgentId(event.target.value)}>
              <option value="">Select a published agent…</option>
              {agents.data.data.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}{agent.id === bound?.id ? " (current)" : ""}</option>)}
            </select>
            <Button size="sm" disabled={!selectedAgentId || bind.isPending} onClick={() => { setFailure(""); setNotice(""); void bind.mutateAsync(selectedAgentId).catch((error) => setFailure(errorMessage(error, "The agent could not be bound."))); }}>{bind.isPending ? "Binding…" : "Bind agent"}</Button>
          </div>
        )}
        {bound && canUnbind && <Button size="sm" variant="outline" disabled={unbind.isPending} onClick={() => { if (window.confirm("Unbind the agent from this connection? Incoming messages will no longer trigger the agent.")) { setFailure(""); setNotice(""); void unbind.mutateAsync().catch((error) => setFailure(errorMessage(error, "The agent could not be unbound."))); } }}>{unbind.isPending ? "Unbinding…" : "Unbind agent"}</Button>}
      </>
    )}
    {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
  </div>;
}

function ChannelConversations({ channelId }: { channelId: string }) {
  const platform = usePlatformBootstrap(), workspaceId = platform.snapshot?.workspace.id;
  const [loaded, setLoaded] = useState(false);
  const query = useQuery({
    queryKey: [...whatsappQueryKey(workspaceId), channelId, "conversations"],
    queryFn: () => listChannelConversations(channelId),
    enabled: loaded
  });
  return <div className="rounded-md border">
    <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
      <div><p className="font-medium">Recent conversations</p><p className="text-xs text-muted-foreground">WhatsApp conversations received through this channel.</p></div>
      {!loaded && <Button size="sm" variant="outline" onClick={() => { setLoaded(true); }}>Load conversations</Button>}
    </div>
    {loaded && (
      query.isError ? <p role="alert" className="px-4 py-3 text-sm text-destructive">{errorMessage(query.error, "The channel conversations could not be loaded.")}</p>
        : query.isPending ? <p className="px-4 py-3 text-sm text-muted-foreground">Loading conversations…</p>
        : query.data.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No conversations received yet.</p>
        : <div className="max-h-72 divide-y overflow-auto">{query.data.slice(0, 25).map((conversation) => <div key={conversation.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs"><span className="font-medium">{conversation.externalConversationId}</span><span className="text-muted-foreground">{new Date(conversation.updatedAt).toLocaleString()}</span></div>)}</div>
    )}
  </div>;
}

function EditConnectionForm({ connection, onDone, onError }: { connection: WhatsAppConnection; onDone: () => void; onError: (msg: string) => void }) {
  const platform = usePlatformBootstrap();
  const workspaceId = platform.snapshot?.workspace.id;
  const client = useQueryClient();
  const [form, setForm] = useState<UpdateWhatsAppConnectionInput>({
    businessAccountId: connection.businessAccountId ?? "",
    phoneNumberId: connection.phoneNumberId ?? "",
    displayPhoneNumber: connection.displayPhoneNumber ?? "",
    apiVersion: connection.apiVersion ?? "v23.0",
    expectedStateVersion: connection.stateVersion,
  });
  const [failure, setFailure] = useState("");
  const mutation = useMutation({
    mutationFn: () => updateWhatsAppConnection(connection.id, form),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: whatsappQueryKey(workspaceId) });
      onDone();
    },
    onError: (error) => {
      const msg = errorMessage(error, "The connection could not be updated.");
      setFailure(msg);
      onError(msg);
    },
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure("");
    if (!/^\d+$/.test(form.businessAccountId ?? "") || !/^\d+$/.test(form.phoneNumberId ?? "")) {
      setFailure("Business account ID and phone number ID must be numeric.");
      return;
    }
    try {
      await mutation.mutateAsync();
    } catch (err) {
      setFailure(errorMessage(err, "The connection could not be updated."));
    }
  };
  const field = (key: keyof UpdateWhatsAppConnectionInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <form className="space-y-4 rounded-md border p-4" noValidate onSubmit={(event) => { void submit(event); }}>
      <p className="text-sm font-medium">Edit Connection</p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField id="edit-wa-business" label="Business account ID" value={form.businessAccountId ?? ""} change={(value) => field("businessAccountId", value)} />
        <TextField id="edit-wa-phone-id" label="Phone number ID" value={form.phoneNumberId ?? ""} change={(value) => field("phoneNumberId", value)} />
        <TextField id="edit-wa-display" label="Display phone number (optional)" value={form.displayPhoneNumber ?? ""} change={(value) => field("displayPhoneNumber", value)} />
        <TextField id="edit-wa-version" label="Graph API version" value={form.apiVersion ?? ""} change={(value) => field("apiVersion", value)} />
        <SecretField id="edit-wa-access-token" label="Access token" value={form.accessToken ?? ""} change={(value) => field("accessToken", value)} placeholder="Leave blank to keep existing" />
        <SecretField id="edit-wa-verify-token" label="Webhook verify token" value={form.verifyToken ?? ""} change={(value) => field("verifyToken", value)} placeholder="Leave blank to keep existing" />
        <SecretField id="edit-wa-app-secret" label="Meta app secret" value={form.appSecret ?? ""} change={(value) => field("appSecret", value)} placeholder="Leave blank to keep existing" />
      </div>
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function TextField({ id, label, value, change }: { id: string; label: string; value: string; change: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} maxLength={128} onChange={(event) => change(event.target.value)} /></div>; }
function SecretField({ id, label, value, change, placeholder }: { id: string; label: string; value: string; change: (value: string) => void; placeholder?: string }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="password" autoComplete="new-password" value={value} maxLength={4096} placeholder={placeholder} onChange={(event) => change(event.target.value)} /></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>; }
