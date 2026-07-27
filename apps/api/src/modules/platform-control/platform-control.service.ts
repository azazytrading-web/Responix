import { Injectable } from "@nestjs/common";
import { BrandingService } from "./branding.service";
import { DashboardMetadataService } from "./dashboard-metadata.service";
import { FeatureResolutionService } from "./feature-resolution.service";
import { LicenseResolutionService } from "./license-resolution.service";
import { PermissionResolutionService } from "./permission-resolution.service";
import { PlatformControlRepository } from "./platform-control.repository";
import type { JsonRecord } from "./platform-control.types";

@Injectable()
export class PlatformControlService {
  constructor(
    private readonly repository: PlatformControlRepository,
    private readonly permissions: PermissionResolutionService,
    private readonly features: FeatureResolutionService,
    private readonly licenses: LicenseResolutionService,
    private readonly branding: BrandingService,
    private readonly dashboard: DashboardMetadataService
  ) {}

  resolvedPermissions(input: { workspaceId: string; userId: string; roleId: string; roleName: string }) {
    return this.permissions.resolve(input);
  }

  featuresFor(workspaceId: string) {
    return this.features.resolve(workspaceId);
  }

  licenseFor(workspaceId: string) {
    return this.licenses.resolve(workspaceId);
  }

  brandingFor(workspaceId: string) {
    return this.branding.resolve(workspaceId);
  }

  manifestFor(input: { workspaceId: string; role: string; permissions: string[] }) {
    return this.dashboard.resolve(input);
  }

  async updateBranding(
    workspaceId: string,
    input: Omit<Parameters<PlatformControlRepository["upsertBranding"]>[0], "workspaceId">
  ) {
    await this.repository.upsertBranding({ ...input, workspaceId });
    return this.brandingFor(workspaceId);
  }

  async updateFeature(workspaceId: string, input: {
    key: string; state: "ENABLED" | "DISABLED" | "HIDDEN"; experimental?: boolean;
    dependencies?: string[]; metadata?: JsonRecord;
  }) {
    return this.repository.upsertWorkspaceFeature({
      workspaceId, key: input.key, state: input.state, experimental: input.experimental ?? false,
      dependencies: input.dependencies ?? [], metadata: input.metadata
    });
  }

  async updatePermissionOverride(workspaceId: string, input: {
    permissionCode: string; effect: "GRANT" | "REVOKE"; userId?: string;
  }): Promise<void> {
    await this.repository.upsertPermissionOverride({ workspaceId, ...input });
    this.permissions.invalidateWorkspace(workspaceId);
  }

  listRoles(workspaceId: string) { return this.repository.roles(workspaceId); }
  listPermissions() { return this.repository.permissions(); }
  async createRole(workspaceId: string, actorId: string, input: { name: string; description?: string; priority?: number; parentRoleIds?: string[] }) {
    const role = await this.repository.createRole({ workspaceId, actorId, ...input }); this.permissions.invalidateWorkspace(workspaceId); return role;
  }
  async updateRole(workspaceId: string, actorId: string, roleId: string, input: { name?: string; description?: string; priority?: number; parentRoleIds?: string[] }) {
    const role = await this.repository.updateRole({ workspaceId, actorId, roleId, ...input }); this.permissions.invalidateWorkspace(workspaceId); return role;
  }
  async deleteRole(workspaceId: string, actorId: string, roleId: string) { await this.repository.deleteRole(workspaceId, actorId, roleId); this.permissions.invalidateWorkspace(workspaceId); }
  async setRolePermission(workspaceId: string, actorId: string, roleId: string, permissionCode: string, grant: boolean) { await this.repository.setRolePermission({ workspaceId, actorId, roleId, permissionCode, grant }); this.permissions.invalidateWorkspace(workspaceId); }
  async createTemporaryRole(workspaceId: string, actorId: string, input: { userId: string; roleId: string; startAt: Date; expiresAt?: Date }) { const result = await this.repository.createTemporaryRole({ workspaceId, actorId, ...input }); this.permissions.invalidateWorkspace(workspaceId); return result; }
  async createTemporaryPermission(workspaceId: string, actorId: string, input: { userId: string; permissionCode: string; effect: "GRANT" | "REVOKE"; startAt: Date; expiresAt?: Date }) { const result = await this.repository.createTemporaryPermission({ workspaceId, actorId, ...input }); this.permissions.invalidateWorkspace(workspaceId); return result; }
  async assignRole(workspaceId: string, actorId: string, userId: string, roleId: string) { await this.repository.assignRole(workspaceId, actorId, userId, roleId); this.permissions.invalidateWorkspace(workspaceId); }
  async removeRole(workspaceId: string, actorId: string, userId: string) { await this.repository.removeRole(workspaceId, actorId, userId); this.permissions.invalidateWorkspace(workspaceId); }

  async updateManifest(workspaceId: string, input: {
    schemaVersion: string; compatibilityVersion: string; manifest: JsonRecord; migrationMetadata?: JsonRecord;
  }) {
    return this.repository.upsertManifest({
      workspaceId, ...input, revision: 1, migrationMetadata: input.migrationMetadata ?? null
    });
  }
}
