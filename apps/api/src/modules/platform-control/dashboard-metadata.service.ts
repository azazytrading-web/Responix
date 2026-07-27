import { Injectable, NotFoundException } from "@nestjs/common";
import { FeatureResolutionService } from "./feature-resolution.service";
import { LicenseResolutionService } from "./license-resolution.service";
import { PlatformControlRepository } from "./platform-control.repository";
import type { JsonRecord, ManifestSnapshot } from "./platform-control.types";

@Injectable()
export class DashboardMetadataService {
  constructor(
    private readonly repository: PlatformControlRepository,
    private readonly features: FeatureResolutionService,
    private readonly licenses: LicenseResolutionService
  ) {}

  async resolve(input: {
    workspaceId: string;
    role: string;
    permissions: string[];
  }): Promise<ManifestSnapshot & { generatedAt: string }> {
    const manifest = await this.repository.manifest(input.workspaceId);
    if (!manifest) throw new NotFoundException("Workspace platform manifest is not configured");
    const [features, license] = await Promise.all([
      this.features.resolve(input.workspaceId),
      this.licenses.resolve(input.workspaceId)
    ]);
    return {
      ...manifest,
      manifest: (this.filterNode(manifest.manifest, {
        workspaceId: input.workspaceId,
        role: input.role,
        planId: license.planId,
        permissions: new Set(input.permissions),
        features: new Set(features),
        licenseActive: license.active
      }) ?? {}) as JsonRecord,
      generatedAt: new Date().toISOString()
    };
  }

  private filterNode(value: unknown, context: {
    workspaceId: string; role: string; planId: string | null; permissions: Set<string>;
    features: Set<string>; licenseActive: boolean;
  }): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.filterNode(item, context)).filter((item) => item !== undefined);
    }
    if (!value || typeof value !== "object") return value;
    const source = value as JsonRecord;
    if (!this.visible(source.visibility, context)) return undefined;
    return Object.fromEntries(
      Object.entries(source)
        .filter(([key]) => key !== "visibility")
        .map(([key, child]) => [key, this.filterNode(child, context)] as const)
        .filter(([, child]) => child !== undefined)
    );
  }

  private visible(visibility: unknown, context: {
    workspaceId: string; role: string; planId: string | null; permissions: Set<string>;
    features: Set<string>; licenseActive: boolean;
  }): boolean {
    if (!visibility || typeof visibility !== "object") return true;
    if (!context.licenseActive) return false;
    const rule = visibility as Record<string, unknown>;
    const strings = (key: string): string[] => Array.isArray(rule[key])
      ? rule[key].filter((value): value is string => typeof value === "string") : [];
    const permissions = strings("permissions");
    const roles = strings("roles");
    const plans = strings("planIds");
    const workspaces = strings("workspaceIds");
    const features = strings("featureFlags");
    return permissions.every((permission) => context.permissions.has(permission)) &&
      (roles.length === 0 || roles.includes(context.role)) &&
      (plans.length === 0 || (context.planId !== null && plans.includes(context.planId))) &&
      (workspaces.length === 0 || workspaces.includes(context.workspaceId)) &&
      features.every((feature) => context.features.has(feature));
  }
}
