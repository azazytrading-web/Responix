import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../auth/auth.guard";
import type { TenantRequest } from "../tenant/tenant-context.service";
import { PlatformControlService } from "./platform-control.service";
import { CreateRoleDto, TemporaryPermissionDto, TemporaryRoleDto, UpdateBrandingDto, UpdateFeatureDto, UpdateManifestDto, UpdatePermissionOverrideDto, UpdateRoleDto } from "./dto/platform-control.dto";

@ApiTags("Platform Control")
@ApiBearerAuth()
@ApiForbiddenResponse({ description: "Active workspace membership and declared permission are required" })
@Controller("platform")
export class PlatformControlController {
  constructor(private readonly service: PlatformControlService) {}

  @Get("current") @Version("1") @Permissions("platform.read")
  @ApiOperation({ summary: "Resolve the current workspace control plane" }) @ApiOkResponse({ description: "Resolved permissions, features, license, branding, and manifest" })
  async current(@Req() request: TenantRequest) {
    const context = request.tenantContext!;
    const input = { workspaceId: context.workspace.id, userId: context.user.id, roleId: context.role.id, roleName: context.role.name };
    const permissions = await this.service.resolvedPermissions(input);
    const [features, license, branding, manifest] = await Promise.all([
      this.service.featuresFor(context.workspace.id), this.service.licenseFor(context.workspace.id),
      this.service.brandingFor(context.workspace.id), this.service.manifestFor({ workspaceId: context.workspace.id, role: context.role.name, permissions })
    ]);
    return { permissions, features, license, branding, manifest };
  }

  @Get("manifest") @Version("1") @Permissions("platform.read")
  @ApiOperation({ summary: "Resolve a visibility-filtered workspace manifest" })
  async manifest(@Req() request: TenantRequest) {
    const context = request.tenantContext!;
    const permissions = await this.service.resolvedPermissions({ workspaceId: context.workspace.id, userId: context.user.id, roleId: context.role.id, roleName: context.role.name });
    return this.service.manifestFor({ workspaceId: context.workspace.id, role: context.role.name, permissions });
  }

  @Get("features") @Version("1") @Permissions("platform.read")
  @ApiOperation({ summary: "Resolve runtime workspace features" })
  features(@Req() request: TenantRequest) { return this.service.featuresFor(request.tenantContext!.workspace.id); }

  @Get("license") @Version("1") @Permissions("platform.read")
  @ApiOperation({ summary: "Resolve workspace license limits and entitlements" })
  license(@Req() request: TenantRequest) { return this.service.licenseFor(request.tenantContext!.workspace.id); }

  @Get("branding") @Version("1") @Permissions("platform.read")
  @ApiOperation({ summary: "Resolve workspace branding metadata" })
  branding(@Req() request: TenantRequest) { return this.service.brandingFor(request.tenantContext!.workspace.id); }

  @Patch("branding") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Update workspace branding metadata" })
  updateBranding(@Req() request: TenantRequest, @Body() dto: UpdateBrandingDto) { return this.service.updateBranding(request.tenantContext!.workspace.id, dto); }

  @Put("features") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Set a workspace feature override" })
  updateFeature(@Req() request: TenantRequest, @Body() dto: UpdateFeatureDto) { return this.service.updateFeature(request.tenantContext!.workspace.id, dto); }

  @Put("permissions/overrides") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Set a workspace or user permission override" })
  async updatePermissionOverride(@Req() request: TenantRequest, @Body() dto: UpdatePermissionOverrideDto) {
    await this.service.updatePermissionOverride(request.tenantContext!.workspace.id, dto);
    return { updated: true };
  }

  @Get("permissions/roles") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "List workspace and system roles" })
  roles(@Req() request: TenantRequest) { return this.service.listRoles(request.tenantContext!.workspace.id); }

  @Post("permissions/roles") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Create a workspace role" })
  createRole(@Req() request: TenantRequest, @Body() dto: CreateRoleDto) { const c = request.tenantContext!; return this.service.createRole(c.workspace.id, c.user.id, dto); }

  @Patch("permissions/roles/:roleId") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Update a workspace role" })
  updateRole(@Req() request: TenantRequest, @Param("roleId") roleId: string, @Body() dto: UpdateRoleDto) { const c = request.tenantContext!; return this.service.updateRole(c.workspace.id, c.user.id, roleId, dto); }

  @Delete("permissions/roles/:roleId") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Delete a workspace role" })
  async deleteRole(@Req() request: TenantRequest, @Param("roleId") roleId: string) { const c = request.tenantContext!; await this.service.deleteRole(c.workspace.id, c.user.id, roleId); return { deleted: true }; }

  @Get("permissions") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "List available permission keys" })
  permissions() { return this.service.listPermissions(); }

  @Put("permissions/roles/:roleId/:permissionCode") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Grant a permission to a role" })
  async grant(@Req() request: TenantRequest, @Param("roleId") roleId: string, @Param("permissionCode") permissionCode: string) { const c = request.tenantContext!; await this.service.setRolePermission(c.workspace.id, c.user.id, roleId, permissionCode, true); return { updated: true }; }

  @Delete("permissions/roles/:roleId/:permissionCode") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Revoke a permission from a role" })
  async revoke(@Req() request: TenantRequest, @Param("roleId") roleId: string, @Param("permissionCode") permissionCode: string) { const c = request.tenantContext!; await this.service.setRolePermission(c.workspace.id, c.user.id, roleId, permissionCode, false); return { updated: true }; }

  @Put("permissions/assignments/:userId/:roleId") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Assign a role to an active workspace member" })
  async assignRole(@Req() request: TenantRequest, @Param("userId") userId: string, @Param("roleId") roleId: string) { const c = request.tenantContext!; await this.service.assignRole(c.workspace.id, c.user.id, userId, roleId); return { updated: true }; }

  @Delete("permissions/assignments/:userId") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Remove a member role by removing workspace membership" })
  async removeRole(@Req() request: TenantRequest, @Param("userId") userId: string) { const c = request.tenantContext!; await this.service.removeRole(c.workspace.id, c.user.id, userId); return { updated: true }; }

  @Post("permissions/temporary-roles") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Assign a time-bound role" })
  temporaryRole(@Req() request: TenantRequest, @Body() dto: TemporaryRoleDto) { const c = request.tenantContext!; return this.service.createTemporaryRole(c.workspace.id, c.user.id, { ...dto, startAt: new Date(dto.startAt), expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined }); }

  @Post("permissions/temporary-permissions") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Assign a time-bound permission override" })
  temporaryPermission(@Req() request: TenantRequest, @Body() dto: TemporaryPermissionDto) { const c = request.tenantContext!; return this.service.createTemporaryPermission(c.workspace.id, c.user.id, { ...dto, startAt: new Date(dto.startAt), expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined }); }

  @Put("manifest") @Version("1") @Permissions("platform.configure")
  @ApiOperation({ summary: "Store a versioned workspace platform manifest" })
  updateManifest(@Req() request: TenantRequest, @Body() dto: UpdateManifestDto) { return this.service.updateManifest(request.tenantContext!.workspace.id, dto); }
}
