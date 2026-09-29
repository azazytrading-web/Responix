"use client";

import { useEffect,useState,type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@responix/api-client";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, ErrorFallback, Input, Label, PageSkeleton } from "@responix/ui";
import { Plug } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import { configureProvider,getProviderConfiguration,listProviders,providerQueryKey,validateProvider,type ProviderOption } from "./provider-api";

const capabilityLabels = [
  ["supportsStreaming", "Streaming"], ["supportsTools", "Tools"], ["supportsVision", "Vision"],
  ["supportsAudio", "Audio"], ["supportsReasoning", "Reasoning"],
  ["supportsFunctionCalling", "Function calling"], ["supportsVideo", "Video"], ["supportsMcp", "MCP"]
] as const;
const errorText=(error:unknown,fallback:string)=>error instanceof ApiError?error.message:fallback;

export function ProviderManagementPage() {
  const platform = usePlatformBootstrap();
  const workspaceId = platform.snapshot?.workspace.id;
  const allowed = platform.hasPermission("ai.configure");
  const query = useQuery({ queryKey: providerQueryKey(workspaceId), queryFn: listProviders, enabled: platform.state === "READY" && Boolean(workspaceId) && allowed });
  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={6} />;
  if (platform.state === "ERROR" || !platform.snapshot) return <ErrorFallback title="Providers unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  if (!allowed) return <ErrorFallback title="Access denied" description="The ai.configure permission is required to view provider resources." code="ai.configure" />;
  if (query.isPending) return <PageSkeleton rows={6} />;
  if (query.isError || !query.data) return <ErrorFallback title="Providers unavailable" description={errorText(query.error,"Configured AI providers could not be loaded.")} onRetry={() => { void query.refetch(); }} />;
  return <section className="space-y-6 p-6" data-testid="provider-management">
    <div><h1 className="text-2xl font-semibold tracking-tight">AI Providers</h1><p className="text-sm text-muted-foreground">Authoritative provider availability and model capabilities for this workspace.</p></div>
    <Card><CardHeader><CardTitle>Credential security</CardTitle><CardDescription>Credentials are write-only and encrypted by the backend. Existing credential values are never returned; leave the replacement field blank to preserve the current credential.</CardDescription></CardHeader></Card>
    {query.data.length === 0 ? <Card><EmptyState title="No providers available" description="This workspace has no active AI providers. Provider availability is managed by the platform registry." icon={<Plug className="h-5 w-5" />} /></Card> :
      <div className="space-y-4">{query.data.map((provider) => <Card key={provider.id}>
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{provider.providerName}</CardTitle><CardDescription>{provider.models.length} model{provider.models.length === 1 ? "" : "s"} exposed by the backend</CardDescription></div><div className="flex gap-2"><Badge variant={provider.status === "ACTIVE" ? "default" : "secondary"}>{provider.status}</Badge><Badge variant={provider.configured && provider.enabled ? "default" : "outline"}>{provider.configured ? provider.enabled ? "Configured" : "Disabled" : "Not configured"}</Badge><Badge variant="outline">Priority {provider.priority}</Badge></div></div></CardHeader>
        <CardContent className="space-y-5">{provider.models.length === 0 ? <p className="text-sm text-muted-foreground">No models are exposed for this provider.</p> : <div className="grid gap-3 lg:grid-cols-2">{provider.models.map((model) => <div key={model.modelId} className="space-y-3 rounded-md border p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{model.displayName || model.modelName}</p><p className="text-xs text-muted-foreground">{model.modelId}</p>{model.version && <p className="text-xs text-muted-foreground">Version: {model.version}</p>}</div><Badge variant={model.status === "ACTIVE" ? "default" : "secondary"}>{model.status}</Badge></div><div className="text-sm text-muted-foreground"><p>Context: {model.contextWindow.toLocaleString()} tokens</p><p>Max output: {model.maxOutputTokens?.toLocaleString() ?? "Not specified"}</p><p>Priority: {model.priority}</p>{model.categories.length > 0 && <p>Categories: {model.categories.join(", ")}</p>}</div><div className="flex flex-wrap gap-1">{capabilityLabels.map(([key, label]) => <Badge key={key} variant={model[key] ? "secondary" : "outline"}>{label}: {model[key] ? "Yes" : "No"}</Badge>)}</div></div>)}</div>}<ProviderConfigurationForm provider={provider}/></CardContent>
      </Card>)}</div>}
  </section>;
}

function ProviderConfigurationForm({provider}:{provider:ProviderOption}){
 const platform=usePlatformBootstrap(),workspaceId=platform.snapshot?.workspace.id,client=useQueryClient(),canRead=platform.hasPermission("ai.providers.read"),canWrite=platform.hasPermission("ai.providers.write"),canValidate=platform.hasPermission("ai.providers.validate");
 const query=useQuery({queryKey:[...providerQueryKey(workspaceId),provider.id,"configuration"],queryFn:()=>getProviderConfiguration(provider.id),enabled:Boolean(workspaceId&&canRead)});
 const [endpoint,setEndpoint]=useState(""),[secret,setSecret]=useState(""),[enabled,setEnabled]=useState(provider.enabled),[failure,setFailure]=useState(""),[notice,setNotice]=useState("");
 const save=useMutation({mutationFn:()=>configureProvider(provider.id,{enabled,settings:endpoint?{apiBaseUrl:endpoint}:{},...(secret?{credential:{name:"default",secret}}:{}),...(query.data?.updatedAt?{expectedUpdatedAt:query.data.updatedAt}:{})}),onSuccess:async()=>{setSecret("");setNotice("Provider configuration saved.");await client.invalidateQueries({queryKey:providerQueryKey(workspaceId)})}});
 const validate=useMutation({mutationFn:()=>validateProvider(provider.id),onSuccess:async result=>{setNotice(result.available?`Provider validated in ${result.latencyMs??0} ms.`:`Validation failed (${result.errorCode??"VALIDATION_FAILED"}).`);await client.invalidateQueries({queryKey:providerQueryKey(workspaceId)})}});
 const configUpdatedAt=query.data?.updatedAt;
 useEffect(()=>{if(configUpdatedAt!==undefined&&query.data)setEnabled(query.data.enabled);},[configUpdatedAt]);
 if(!canRead)return <p className="text-sm text-muted-foreground">Configuration details require ai.providers.read.</p>;
 if(query.isPending)return <p className="text-sm text-muted-foreground">Loading workspace configuration…</p>;
 if(query.isError||!query.data)return <div className="flex items-center gap-2"><p className="text-sm text-destructive">Workspace configuration could not be loaded.</p><Button type="button" size="sm" variant="outline" onClick={()=>{void query.refetch()}}>Retry</Button></div>;
 const submit=async(e:FormEvent)=>{e.preventDefault();setFailure("");setNotice("");try{await save.mutateAsync()}catch(error){setFailure(errorText(error,"Provider configuration could not be saved."));if(error instanceof ApiError&&error.status===409){void query.refetch()}}}
 const runValidation=async()=>{setFailure("");setNotice("");try{await validate.mutateAsync()}catch(error){setFailure(error instanceof ApiError?error.message:"Provider validation could not be completed.")}};
 const configuredEndpoint=typeof query.data?.settings?.apiBaseUrl==="string"?query.data.settings.apiBaseUrl:"";
 const canValidateNow=Boolean(query.data.enabled&&query.data.credentialConfigured&&provider.models.length>0);
 return <form className="space-y-3 border-t pt-4" onSubmit={e=>{void submit(e)}}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">Workspace configuration</p><p className="text-xs text-muted-foreground">Credential: {query.data.credentialConfigured?"Configured":"Not configured"}{query.data.lastValidatedAt?` · Last validated ${new Date(query.data.lastValidatedAt).toLocaleString()}${query.data.available===true?" · OK":query.data.available===false?` · Failed (${query.data.errorCode??"UNKNOWN"})`:""}`:""}</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!canWrite||save.isPending} onChange={e=>setEnabled(e.target.checked)}/>Enabled</label></div><div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor={`endpoint-${provider.id}`}>HTTPS endpoint {provider.providerName==="Azure OpenAI"?"(required)":"(optional)"}</Label><Input id={`endpoint-${provider.id}`} type="url" placeholder={configuredEndpoint||"Use provider default"} value={endpoint} disabled={!canWrite||save.isPending} onChange={e=>setEndpoint(e.target.value)}/></div><div className="space-y-2"><Label htmlFor={`secret-${provider.id}`}>API credential replacement</Label><Input id={`secret-${provider.id}`} type="password" autoComplete="new-password" minLength={8} maxLength={4096} value={secret} disabled={!canWrite||save.isPending} onChange={e=>setSecret(e.target.value)}/></div></div>{failure&&<p role="alert" className="text-sm text-destructive">{failure}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}{canValidate&&!canValidateNow&&<p className="text-xs text-muted-foreground">Validation requires saved credentials, an enabled provider, and at least one active model.</p>}<div className="flex gap-2">{canWrite&&<Button type="submit" size="sm" disabled={save.isPending}>{save.isPending?"Saving…":"Save configuration"}</Button>}{canValidate&&<Button type="button" size="sm" variant="outline" disabled={validate.isPending||!canValidateNow} onClick={()=>{void runValidation()}}>{validate.isPending?"Validating…":"Validate connection"}</Button>}</div></form>;
}
