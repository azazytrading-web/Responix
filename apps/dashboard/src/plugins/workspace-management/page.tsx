"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@responix/auth";
import { ApiError } from "@responix/api-client";
import { platformBootstrapService } from "@responix/state";
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
  Label,
  PageSkeleton
} from "@responix/ui";
import { Building2, Database, Globe2, PlugZap } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import {
  WORKSPACE_EDITABLE_FIELDS,
  changedWorkspaceFields,
  getCurrentWorkspace,
  updateCurrentWorkspace,
  validateWorkspaceUpdate,
  type WorkspaceDetails,
  type WorkspaceEditableField
} from "./workspace-api";

type WorkspaceForm = Record<WorkspaceEditableField, string>;

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function workspaceForm(workspace: WorkspaceDetails): WorkspaceForm {
  return {
    name: workspace.name,
    companyName: textValue(workspace.companyName),
    country: textValue(workspace.country),
    timezone: workspace.timezone,
    language: workspace.language,
    currency: workspace.currency
  };
}

export function WorkspaceManagementPage() {
  const platform = usePlatformBootstrap();
  const { restoreSession } = useAuth();
  const queryClient = useQueryClient();
  const canReadWorkspace = platform.hasPermission("workspace.read");
  const canUpdateWorkspace = platform.hasPermission("workspace.update");
  const workspaceId = platform.snapshot?.workspace.id;
  const queryKey = ["workspace", workspaceId, "current"] as const;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<WorkspaceForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<WorkspaceEditableField | "form", string>>>({});
  const workspaceQuery = useQuery({
    queryKey,
    queryFn: getCurrentWorkspace,
    enabled: platform.state === "READY" && Boolean(workspaceId) && canReadWorkspace
  });
  const updateMutation = useMutation({ mutationFn: updateCurrentWorkspace });

  if (platform.state === "IDLE" || platform.state === "LOADING") {
    return <PageSkeleton rows={3} />;
  }

  if (platform.state === "ERROR" || !platform.snapshot) {
    return (
      <ErrorFallback
        title="Workspace unavailable"
        description="The workspace platform state could not be loaded."
        onRetry={platform.retry}
      />
    );
  }

  if (!canReadWorkspace) {
    return (
      <ErrorFallback
        title="Access denied"
        description="The workspace.read permission is required to view workspace details."
        code="workspace.read"
      />
    );
  }

  if (workspaceQuery.isPending) return <PageSkeleton rows={3} />;

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <ErrorFallback
        title="Workspace details unavailable"
        description="The current workspace could not be loaded from the server."
        onRetry={() => { void workspaceQuery.refetch(); }}
      />
    );
  }

  const workspace = workspaceQuery.data;
  const enabledIntegrations = [
    workspace.aiEnabled && "AI",
    workspace.whatsappEnabled && "WhatsApp",
    workspace.emailEnabled && "Email",
    workspace.apiEnabled && "API"
  ].filter((value): value is string => Boolean(value));

  const enterEditMode = () => {
    setForm(workspaceForm(workspace));
    setErrors({});
    updateMutation.reset();
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(null);
    setErrors({});
    updateMutation.reset();
    setEditing(false);
  };

  const updateField = (field: WorkspaceEditableField, value: string) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || updateMutation.isPending) return;
    const validationErrors = validateWorkspaceUpdate(form);
    const payload = changedWorkspaceFields(workspaceForm(workspace), form);
    if (Object.keys(payload).length === 0) validationErrors.form = "Change at least one field before saving.";
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    try {
      const updated = await updateMutation.mutateAsync(payload);
      queryClient.setQueryData(queryKey, updated);
      if (workspaceId) platformBootstrapService.invalidate(workspaceId);
      if (payload.name !== undefined) await restoreSession();
      platform.retry();
      setForm(null);
      setEditing(false);
    } catch (error) {
      setErrors({
        form: error instanceof ApiError ? error.message : "The workspace update could not be completed."
      });
    }
  };

  return (
    <section className="space-y-6 p-6" data-testid="workspace-management">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Company</h1>
          <p className="text-sm text-muted-foreground">
            Current workspace configuration from the authenticated tenant context.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={workspace.status === "ACTIVE" ? "default" : "secondary"}>
            {workspace.status}
          </Badge>
          {canUpdateWorkspace && !editing && (
            <Button type="button" variant="outline" onClick={enterEditMode}>Edit workspace</Button>
          )}
        </div>
      </div>

      {editing && form && (
        <Card>
          <CardHeader>
            <CardTitle>Edit workspace</CardTitle>
            <CardDescription>Only fields supported by the current-workspace API can be changed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { void submit(event); }}>
              {(Object.keys(WORKSPACE_EDITABLE_FIELDS) as WorkspaceEditableField[]).map((field) => {
                const metadata = WORKSPACE_EDITABLE_FIELDS[field];
                return (
                  <div className="space-y-2" key={field}>
                    <Label htmlFor={`workspace-${field}`}>{metadata.label}</Label>
                    <Input
                      id={`workspace-${field}`}
                      name={field}
                      value={form[field]}
                      maxLength={metadata.maxLength}
                      disabled={updateMutation.isPending}
                      aria-invalid={Boolean(errors[field])}
                      aria-describedby={errors[field] ? `workspace-${field}-error` : undefined}
                      onChange={(event) => updateField(field, event.target.value)}
                    />
                    {errors[field] && <p id={`workspace-${field}-error`} className="text-sm text-destructive">{errors[field]}</p>}
                  </div>
                );
              })}
              <div className="space-y-3 md:col-span-2">
                {errors.form && <p role="alert" className="text-sm text-destructive">{errors.form}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                  <Button type="button" variant="outline" disabled={updateMutation.isPending} onClick={cancelEditing}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard title="Workspace" value={workspace.name} detail={workspace.slug} icon={<Building2 className="h-5 w-5" />} />
        <DetailCard title="Locale" value={workspace.language} detail={`${workspace.timezone} · ${workspace.currency}`} icon={<Globe2 className="h-5 w-5" />} />
        <DetailCard title="Location" value={textValue(workspace.country) || "Not configured"} detail={textValue(workspace.companyName) || "No company name"} icon={<Globe2 className="h-5 w-5" />} />
        <DetailCard title="User capacity" value={String(workspace.maxUsers)} detail="Maximum active users" icon={<Database className="h-5 w-5" />} />
        <DetailCard title="Integrations" value={String(enabledIntegrations.length)} detail="Enabled for this workspace" icon={<PlugZap className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enabled integrations</CardTitle>
          <CardDescription>Capabilities configured by the backend for this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {enabledIntegrations.length === 0 ? (
            <EmptyState
              title="No workspace integrations enabled"
              description="Core workspace access remains available."
              icon={<PlugZap className="h-5 w-5" />}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {enabledIntegrations.map((integration) => (
                <Badge key={integration} variant="secondary">{integration}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DetailCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
