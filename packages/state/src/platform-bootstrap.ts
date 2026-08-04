import { apiClient } from "@responix/api-client";
import type { components } from "@responix/api-client";
import type { PlatformNavigationSchemaDto } from "@responix/types";

export type PlatformCurrent = components["schemas"]["PlatformCurrentResponseDto"];
export type DashboardBootstrap = components["schemas"]["DashboardRuntimeBootstrapDto"];

export interface BootstrapWorkspace {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface PlatformBootstrapSnapshot {
  workspace: BootstrapWorkspace;
  platform: PlatformCurrent;
  dashboard: DashboardBootstrap;
  permissions: readonly string[];
  features: readonly string[];
  featureManifest: PlatformCurrent["manifest"];
  navigation: PlatformNavigationSchemaDto;
}

function parseNavigation(value: Record<string, unknown>): PlatformNavigationSchemaDto {
  if (!Array.isArray(value.items)) {
    throw new Error("Platform bootstrap returned an invalid navigation manifest");
  }
  return value as unknown as PlatformNavigationSchemaDto;
}

export class PlatformBootstrapService {
  private currentCache = new Map<string, PlatformCurrent>();
  private currentRequests = new Map<string, Promise<PlatformCurrent>>();
  private bootstrapCache = new Map<string, PlatformBootstrapSnapshot>();
  private bootstrapRequests = new Map<string, Promise<PlatformBootstrapSnapshot>>();

  resolvePlatformCurrent(workspaceId: string): Promise<PlatformCurrent> {
    const cached = this.currentCache.get(workspaceId);
    if (cached) return Promise.resolve(cached);
    const pending = this.currentRequests.get(workspaceId);
    if (pending) return pending;
    const request = apiClient
      .get<PlatformCurrent>("/api/v1/platform/current", { credentials: "include" })
      .then((current) => {
        this.currentCache.set(workspaceId, current);
        return current;
      })
      .finally(() => this.currentRequests.delete(workspaceId));
    this.currentRequests.set(workspaceId, request);
    return request;
  }

  bootstrap(workspace: BootstrapWorkspace): Promise<PlatformBootstrapSnapshot> {
    const cached = this.bootstrapCache.get(workspace.id);
    if (cached) return Promise.resolve(cached);
    const pending = this.bootstrapRequests.get(workspace.id);
    if (pending) return pending;
    const request = this.load(workspace).finally(() => this.bootstrapRequests.delete(workspace.id));
    this.bootstrapRequests.set(workspace.id, request);
    return request;
  }

  invalidate(workspaceId?: string): void {
    if (workspaceId) {
      this.currentCache.delete(workspaceId);
      this.currentRequests.delete(workspaceId);
      this.bootstrapCache.delete(workspaceId);
      this.bootstrapRequests.delete(workspaceId);
      return;
    }
    this.currentCache.clear();
    this.currentRequests.clear();
    this.bootstrapCache.clear();
    this.bootstrapRequests.clear();
  }

  private async load(workspace: BootstrapWorkspace): Promise<PlatformBootstrapSnapshot> {
    const platform = await this.resolvePlatformCurrent(workspace.id);
    const dashboard = await apiClient.get<DashboardBootstrap>(
      "/api/v1/dashboard-runtime/bootstrap",
      { credentials: "include" }
    );
    const snapshot: PlatformBootstrapSnapshot = Object.freeze({
      workspace: { ...workspace },
      platform,
      dashboard,
      permissions: Object.freeze([...dashboard.permissions]),
      features: Object.freeze([...dashboard.features]),
      featureManifest: platform.manifest,
      navigation: parseNavigation(dashboard.navigation)
    });
    this.bootstrapCache.set(workspace.id, snapshot);
    return snapshot;
  }
}

export const platformBootstrapService = new PlatformBootstrapService();
