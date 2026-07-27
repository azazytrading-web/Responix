import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PlatformControlService } from "../platform-control/platform-control.service";
import type { JsonRecord } from "../platform-control/platform-control.types";
import { DashboardRuntimeCacheService } from "./dashboard-runtime-cache.service";
import { LayoutRegistryService } from "./layout-registry.service";
import type { DashboardRuntimeBootstrap } from "./dashboard-runtime.types";
import { WidgetRegistryService } from "./widget-registry.service";

@Injectable()
export class DashboardRuntimeService {
  constructor(
    private readonly platform: PlatformControlService,
    private readonly cache: DashboardRuntimeCacheService,
    private readonly layouts: LayoutRegistryService,
    private readonly widgets: WidgetRegistryService
  ) {}

  async bootstrap(input: { workspaceId: string; userId: string; roleId: string; roleName: string }): Promise<DashboardRuntimeBootstrap> {
    const permissions = await this.platform.resolvedPermissions(input);
    const [branding, features, license, manifest] = await Promise.all([
      this.platform.brandingFor(input.workspaceId),
      this.platform.featuresFor(input.workspaceId),
      this.platform.licenseFor(input.workspaceId),
      this.platform.manifestFor({ workspaceId: input.workspaceId, role: input.roleName, permissions })
    ]);
    if (!manifest) throw new NotFoundException("Workspace platform manifest is not configured");
    const key = `${input.workspaceId}:${manifest.revision}:${branding?.revision ?? 0}:${license.status ?? "none"}:${license.expiresAt?.toISOString() ?? "none"}:${features.join(",")}:${permissions.join(",")}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const resolved = this.validateAndClone(manifest.manifest);
    const navigation = this.record(resolved.navigation);
    const bootstrap: DashboardRuntimeBootstrap = Object.freeze({
      version: manifest.schemaVersion,
      compatibilityVersion: manifest.compatibilityVersion,
      revision: manifest.revision,
      generatedAt: manifest.generatedAt,
      manifestHash: this.hash(resolved),
      manifest: resolved,
      navigation,
      branding: branding ? this.asRecord(branding) : null,
      features,
      permissions: [...permissions],
      layouts: this.layouts.list(),
      widgets: this.widgets.list()
    });
    this.cache.set(key, bootstrap);
    return bootstrap;
  }

  private validateAndClone(value: JsonRecord): JsonRecord {
    const copy = JSON.parse(JSON.stringify(value)) as JsonRecord;
    const dashboard = this.record(copy.dashboard);
    const pages = Array.isArray(dashboard.pages) ? dashboard.pages : [];
    for (const page of pages) this.validatePage(this.record(page));
    return copy;
  }

  private validatePage(page: JsonRecord): void {
    if (typeof page.layout === "string" && !this.layouts.has(page.layout)) throw new NotFoundException(`Unknown dashboard layout '${page.layout}'`);
    const sections = Array.isArray(page.sections) ? page.sections : [];
    for (const section of sections) {
      const node = this.record(section);
      if (typeof node.layout === "string" && !this.layouts.has(node.layout)) throw new NotFoundException(`Unknown dashboard layout '${node.layout}'`);
      const widgets = Array.isArray(node.widgets) ? node.widgets : [];
      for (const widget of widgets) {
        const item = this.record(widget);
        if (typeof item.kind === "string" && !this.widgets.has(item.kind)) throw new NotFoundException(`Unknown dashboard widget '${item.kind}'`);
      }
    }
  }

  private hash(value: JsonRecord): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
  private record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
  private asRecord(value: object): JsonRecord { return JSON.parse(JSON.stringify(value)) as JsonRecord; }
}
