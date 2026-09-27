"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorFallback,
  PageSkeleton
} from "@responix/ui";
import { FileJson2, Flag, KeyRound, ShieldCheck } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function recordId(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Not configured";
  const record = value as Record<string, unknown>;
  return stringValue(record.id, stringValue(record.schemaVersion, "Configured"));
}

export function PlatformControlPage() {
  const platform = usePlatformBootstrap();

  if (platform.state === "IDLE" || platform.state === "LOADING") {
    return <PageSkeleton rows={4} />;
  }

  if (platform.state === "ERROR" || !platform.snapshot) {
    return (
      <ErrorFallback
        title="Platform control unavailable"
        description="The workspace control-plane state could not be loaded."
        onRetry={platform.retry}
      />
    );
  }

  if (!platform.hasPermission("platform.configure")) {
    return (
      <ErrorFallback
        title="Access denied"
        description="The platform.configure permission is required to open Platform Control."
        code="platform.configure"
      />
    );
  }

  const current = platform.snapshot.platform;
  const license = current.license;
  const branding = current.branding;
  const licenseActive = booleanValue(license.active);
  const licenseStatus = stringValue(license.status, licenseActive === true ? "ACTIVE" : "Not configured");
  const applicationName = stringValue(branding.appName, "Responix");
  const accentColor = stringValue(branding.accentColor, "Default theme");

  return (
    <section className="space-y-6 p-6" data-testid="platform-control">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Platform Control</h1>
        <p className="text-sm text-muted-foreground">
          Resolved control-plane state for the active workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Permissions" value={String(current.permissions.length)} detail="Resolved for this session" icon={<KeyRound className="h-5 w-5" />} />
        <SummaryCard title="Feature entitlements" value={String(current.features.length)} detail="Optional features enabled by license and overrides" icon={<Flag className="h-5 w-5" />} />
        <SummaryCard title="License" value={licenseStatus} detail={licenseActive === false ? "Inactive" : "Current entitlement"} icon={<ShieldCheck className="h-5 w-5" />} />
        <SummaryCard title="Manifest" value={recordId(current.manifest)} detail="Workspace platform manifest" icon={<FileJson2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Optional feature entitlements</CardTitle>
            <CardDescription>Resolved by the backend for this workspace. Permission-only core modules do not appear in this list.</CardDescription>
          </CardHeader>
          <CardContent>
            {current.features.length === 0 ? (
              <EmptyState title="No optional feature entitlements" description="Core permission-gated modules remain available through the workspace manifest." icon={<Flag className="h-5 w-5" />} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {current.features.map((feature) => <Badge key={feature} variant="secondary">{feature}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace branding</CardTitle>
            <CardDescription>Brand metadata resolved by the platform service.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetadataRow label="Application" value={applicationName} />
            <MetadataRow label="Accent color" value={accentColor} />
            <MetadataRow label="Locale" value={stringValue(branding.locale, "Workspace default")} />
            <MetadataRow label="Direction" value={stringValue(branding.direction, "LTR")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authorization snapshot</CardTitle>
          <CardDescription>Read-only permissions resolved for this session and published atomically during platform bootstrap. Manage access through the workspace role and permission APIs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {current.permissions.map((permission) => <Badge key={permission} variant="outline">{permission}</Badge>)}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SummaryCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
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

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
