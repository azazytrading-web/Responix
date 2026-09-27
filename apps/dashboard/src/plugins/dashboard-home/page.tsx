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
import { Blocks, Building2, Navigation, ShieldCheck } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import { ActiveResponix } from "./active-responix";

export function DashboardHomePage() {
  const platform = usePlatformBootstrap();

  if (platform.state === "IDLE" || platform.state === "LOADING") {
    return <PageSkeleton rows={2} />;
  }

  if (platform.state === "ERROR" || !platform.snapshot) {
    return (
      <ErrorFallback
        title="Dashboard unavailable"
        description="The workspace platform state could not be loaded."
        onRetry={platform.retry}
      />
    );
  }

  if (!platform.hasPermission("platform.read")) {
    return (
      <ErrorFallback
        title="Access denied"
        description="The platform.read permission is required to view this dashboard."
        code="platform.read"
      />
    );
  }

  const { workspace, dashboard } = platform.snapshot;
  const navigationCount = platform.snapshot.navigation.items.length;
  const featureCount = platform.features.length;

  return (
    <section className="space-y-6 p-6" data-testid="dashboard-home">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Current workspace and platform readiness from the authenticated bootstrap.
          </p>
        </div>
        <Badge variant={workspace.status === "ACTIVE" ? "default" : "secondary"}>
          {workspace.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Workspace"
          description={workspace.slug}
          value={workspace.name}
          icon={<Building2 className="h-5 w-5" />}
        />
        <SummaryCard
          title="Permissions"
          description="Resolved for this session"
          value={String(platform.permissions.length)}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <SummaryCard
          title="Navigation"
          description="Backend-authorized entries"
          value={String(navigationCount)}
          icon={<Navigation className="h-5 w-5" />}
        />
        <SummaryCard
          title="Runtime"
          description={`${dashboard.layouts.length} layouts · ${dashboard.widgets.length} widgets`}
          value={`v${dashboard.version}`}
          icon={<Blocks className="h-5 w-5" />}
        />
      </div>

      {platform.hasPermission("agent.studio.read") && <ActiveResponix />}

      {featureCount === 0 ? (
        <Card>
          <EmptyState
            title="No optional features enabled"
            description="This workspace is operational with its core platform capabilities."
            icon={<Blocks className="h-5 w-5" />}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Enabled features</CardTitle>
            <CardDescription>Resolved by the backend for this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {platform.features.map((feature) => (
              <Badge key={feature} variant="secondary">{feature}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function SummaryCard({
  title,
  description,
  value,
  icon
}: {
  title: string;
  description: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
