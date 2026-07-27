import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  BrandingSnapshot,
  FeatureSnapshot,
  JsonRecord,
  LicenseSnapshot,
  ManifestSnapshot,
  PermissionSnapshot
} from "./platform-control.types";

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function inputJson(value: JsonRecord | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

function nullableInputJson(value: JsonRecord | null | undefined): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
  return value === null ? Prisma.JsonNull : inputJson(value);
}

@Injectable()
export class PlatformControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async permissionSnapshot(input: {
    workspaceId: string;
    userId: string;
    roleId: string;
    roleName: string;
  }): Promise<PermissionSnapshot> {
    const now = new Date();
    const [roles, inheritance, workspaceOverrides, userOverrides, temporaryRoles, temporaryPermissions] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where: { deletedAt: null, OR: [{ workspaceId: input.workspaceId }, { workspaceId: null }] },
        select: {
          id: true,
          rolePermissions: { select: { permission: { select: { code: true } } } },
          inheritedRoles: { select: { parentRoleId: true } }
        }
      }),
      this.prisma.permissionInheritance.findMany({
        select: { permission: { select: { code: true } }, inheritedPermission: { select: { code: true } } }
      }),
      this.prisma.workspacePermissionOverride.findMany({
        where: { workspaceId: input.workspaceId },
        select: { effect: true, permission: { select: { code: true } } }
      }),
      this.prisma.userPermissionOverride.findMany({
        where: { workspaceId: input.workspaceId, userId: input.userId },
        select: { effect: true, permission: { select: { code: true } } }
      }),
      this.prisma.temporaryRoleAssignment.findMany({
        where: { workspaceId: input.workspaceId, userId: input.userId, startAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { roleId: true }
      }),
      this.prisma.temporaryPermissionAssignment.findMany({
        where: { workspaceId: input.workspaceId, userId: input.userId, startAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { effect: true, permission: { select: { code: true } } }
      })
    ]);
    return {
      ...input,
      roles: roles.map((role) => ({
        id: role.id,
        parentRoleIds: role.inheritedRoles.map((parent) => parent.parentRoleId),
        permissions: role.rolePermissions.map(({ permission }) => permission.code)
      })),
      permissionInheritance: inheritance.map((item) => ({
        permission: item.permission.code,
        inheritedPermission: item.inheritedPermission.code
      })),
      workspaceOverrides: workspaceOverrides.map((item) => ({
        permission: item.permission.code,
        effect: item.effect
      })),
      userOverrides: userOverrides.map((item) => ({ permission: item.permission.code, effect: item.effect })),
      temporaryRoleIds: temporaryRoles.map((item) => item.roleId),
      temporaryPermissionOverrides: temporaryPermissions.map((item) => ({ permission: item.permission.code, effect: item.effect })),
      hasActiveTemporaryAssignments: temporaryRoles.length > 0 || temporaryPermissions.length > 0
    };
  }

  async permissionRevision(workspaceId: string): Promise<number> {
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null }, select: { permissionRevision: true } });
    return workspace?.permissionRevision ?? 0;
  }

  async roles(workspaceId: string) {
    const roles = await this.prisma.role.findMany({ where: { deletedAt: null, OR: [{ workspaceId }, { workspaceId: null }] }, orderBy: [{ priority: "desc" }, { name: "asc" }], select: { id: true, workspaceId: true, name: true, description: true, priority: true, systemRole: true, rolePermissions: { select: { permission: { select: { code: true } } } }, parentRoles: { select: { parentRoleId: true } } } });
    return roles.map((role) => ({ id: role.id, workspaceId: role.workspaceId, name: role.name, description: role.description, priority: role.priority, systemRole: role.systemRole, permissions: role.rolePermissions.map((item) => item.permission.code), parentRoleIds: role.parentRoles.map((item) => item.parentRoleId) }));
  }

  async permissions() {
    const permissions = await this.prisma.permission.findMany({ orderBy: { code: "asc" }, select: { code: true, description: true, group: { select: { key: true, name: true } } } });
    return permissions.map((permission) => ({ code: permission.code, description: permission.description, group: permission.group ? { key: permission.group.key, name: permission.group.name } : null }));
  }

  async createRole(input: { workspaceId: string; actorId: string; name: string; description?: string; priority?: number; parentRoleIds?: string[] }) {
    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.create({ data: { workspaceId: input.workspaceId, name: input.name, description: input.description, priority: input.priority ?? 0, inheritedRoles: input.parentRoleIds?.length ? { create: input.parentRoleIds.map((parentRoleId) => ({ parentRole: { connect: { id: parentRoleId } } })) } : undefined }, select: { id: true, name: true, description: true, priority: true } });
      await this.auditAndTouch(transaction, input.workspaceId, input.actorId, "permission.role.created", "Role", role.id, { target: role.name });
      return role;
    });
  }

  async updateRole(input: { workspaceId: string; actorId: string; roleId: string; name?: string; description?: string; priority?: number; parentRoleIds?: string[] }) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.role.findFirst({ where: { id: input.roleId, workspaceId: input.workspaceId, systemRole: false }, select: { id: true } });
      if (!existing) throw new Error("Role is not available in this workspace");
      const role = await transaction.role.update({ where: { id: input.roleId }, data: { name: input.name, description: input.description, priority: input.priority, inheritedRoles: input.parentRoleIds ? { deleteMany: {}, create: input.parentRoleIds.map((parentRoleId) => ({ parentRole: { connect: { id: parentRoleId } } })) } : undefined }, select: { id: true, name: true, description: true, priority: true } });
      await this.auditAndTouch(transaction, input.workspaceId, input.actorId, "permission.role.updated", "Role", role.id, { target: role.name });
      return role;
    });
  }

  async deleteRole(workspaceId: string, actorId: string, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const deleted = await transaction.role.updateMany({ where: { id: roleId, workspaceId, systemRole: false, deletedAt: null }, data: { deletedAt: new Date() } });
      if (deleted.count !== 1) throw new Error("Role is not available in this workspace");
      await this.auditAndTouch(transaction, workspaceId, actorId, "permission.role.deleted", "Role", roleId, { target: roleId });
    });
  }

  async setRolePermission(input: { workspaceId: string; actorId: string; roleId: string; permissionCode: string; grant: boolean }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findFirst({ where: { id: input.roleId, workspaceId: input.workspaceId, systemRole: false, deletedAt: null }, select: { id: true } });
      if (!role) throw new Error("Role is not available in this workspace");
      const permission = await transaction.permission.findUniqueOrThrow({ where: { code: input.permissionCode }, select: { id: true } });
      if (input.grant) await transaction.rolePermission.upsert({ where: { roleId_permissionId: { roleId: input.roleId, permissionId: permission.id } }, create: { roleId: input.roleId, permissionId: permission.id }, update: {} });
      else await transaction.rolePermission.deleteMany({ where: { roleId: input.roleId, permissionId: permission.id } });
      await this.auditAndTouch(transaction, input.workspaceId, input.actorId, input.grant ? "permission.granted" : "permission.revoked", "Role", input.roleId, { target: input.permissionCode });
    });
  }

  async createTemporaryRole(input: { workspaceId: string; actorId: string; userId: string; roleId: string; startAt: Date; expiresAt?: Date }) {
    return this.prisma.$transaction(async (transaction) => {
      const [role, membership] = await Promise.all([
        transaction.role.findFirst({ where: { id: input.roleId, OR: [{ workspaceId: input.workspaceId }, { workspaceId: null }], deletedAt: null }, select: { id: true } }),
        transaction.workspaceMembership.findFirst({ where: { workspaceId: input.workspaceId, userId: input.userId, status: "ACTIVE", removedAt: null }, select: { id: true } })
      ]);
      if (!role || !membership) throw new Error("Temporary assignment target is not available in this workspace");
      const assignment = await transaction.temporaryRoleAssignment.create({ data: { workspaceId: input.workspaceId, userId: input.userId, roleId: input.roleId, startAt: input.startAt, expiresAt: input.expiresAt }, select: { id: true, startAt: true, expiresAt: true } });
      await this.auditAndTouch(transaction, input.workspaceId, input.actorId, "permission.temporary_role.assigned", "TemporaryRoleAssignment", assignment.id, { target: input.userId });
      return assignment;
    });
  }

  async createTemporaryPermission(input: { workspaceId: string; actorId: string; userId: string; permissionCode: string; effect: "GRANT" | "REVOKE"; startAt: Date; expiresAt?: Date }) {
    return this.prisma.$transaction(async (transaction) => {
      const permission = await transaction.permission.findUniqueOrThrow({ where: { code: input.permissionCode }, select: { id: true } });
      const membership = await transaction.workspaceMembership.findFirst({ where: { workspaceId: input.workspaceId, userId: input.userId, status: "ACTIVE", removedAt: null }, select: { id: true } });
      if (!membership) throw new Error("Temporary assignment target is not available in this workspace");
      const assignment = await transaction.temporaryPermissionAssignment.create({ data: { workspaceId: input.workspaceId, userId: input.userId, permissionId: permission.id, effect: input.effect, startAt: input.startAt, expiresAt: input.expiresAt }, select: { id: true, startAt: true, expiresAt: true } });
      await this.auditAndTouch(transaction, input.workspaceId, input.actorId, "permission.temporary_permission.assigned", "TemporaryPermissionAssignment", assignment.id, { target: input.userId });
      return assignment;
    });
  }

  async assignRole(workspaceId: string, actorId: string, userId: string, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findFirst({ where: { id: roleId, OR: [{ workspaceId }, { workspaceId: null }], deletedAt: null }, select: { id: true } });
      if (!role) throw new Error("Role is not available in this workspace");
      const membership = await transaction.workspaceMembership.updateMany({ where: { workspaceId, userId, removedAt: null }, data: { roleId } });
      if (membership.count !== 1) throw new Error("Active workspace membership was not found");
      await this.auditAndTouch(transaction, workspaceId, actorId, "permission.role.assigned", "WorkspaceMembership", userId, { target: roleId });
    });
  }

  async removeRole(workspaceId: string, actorId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.workspaceMembership.updateMany({ where: { workspaceId, userId, removedAt: null }, data: { status: "REMOVED", removedAt: new Date() } });
      if (membership.count !== 1) throw new Error("Active workspace membership was not found");
      await this.auditAndTouch(transaction, workspaceId, actorId, "permission.role.removed", "WorkspaceMembership", userId, { target: userId });
    });
  }

  private async auditAndTouch(transaction: Prisma.TransactionClient, workspaceId: string, actorId: string, action: string, entityType: string, entityId: string, metadata: JsonRecord): Promise<void> {
    await transaction.workspace.update({ where: { id: workspaceId }, data: { permissionRevision: { increment: 1 } } });
    await transaction.auditLog.create({ data: { workspaceId, userId: actorId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue } });
  }

  async featureSnapshots(workspaceId: string): Promise<FeatureSnapshot[]> {
    const flags = await this.prisma.featureFlag.findMany({
      where: { OR: [{ workspaceId: null }, { workspaceId }] },
      orderBy: { updatedAt: "asc" },
      select: { featureName: true, state: true, experimental: true, dependencies: true, workspaceId: true }
    });
    return flags.map((flag) => ({
      key: flag.featureName,
      state: flag.state,
      experimental: flag.experimental,
      dependencies: flag.dependencies,
      workspaceId: flag.workspaceId
    }));
  }

  async licenseSnapshot(workspaceId: string): Promise<LicenseSnapshot> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxUsers: true,
            maxAgents: true,
            maxMessages: true,
            maxStorage: true,
            maxTokens: true,
            featuresJson: true,
            metadata: true,
            entitlements: { select: { key: true, value: true } }
          }
        },
        activeSubscription: { select: { status: true, expiresAt: true, graceEndsAt: true, metadata: true } }
      }
    });
    const plan = workspace?.plan;
    const features = Array.isArray(plan?.featuresJson)
      ? plan.featuresJson.filter((item): item is string => typeof item === "string")
      : [];
    return {
      workspaceId,
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      status: workspace?.activeSubscription?.status ?? null,
      expiresAt: workspace?.activeSubscription?.expiresAt ?? null,
      graceEndsAt: workspace?.activeSubscription?.graceEndsAt ?? null,
      limits: {
        users: plan?.maxUsers ?? 0,
        agents: plan?.maxAgents ?? 0,
        messages: plan?.maxMessages ?? 0,
        storage: plan?.maxStorage?.toString() ?? "0",
        tokens: plan?.maxTokens ?? 0
      },
      features,
      entitlements: Object.fromEntries(plan?.entitlements.map((item) => [item.key, item.value]) ?? []),
      metadata: record(workspace?.activeSubscription?.metadata ?? plan?.metadata)
    };
  }

  async branding(workspaceId: string): Promise<BrandingSnapshot | null> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true, name: true, companyName: true, logoUrl: true, primaryColor: true, secondaryColor: true,
        language: true, timezone: true, currency: true,
        branding: {
          select: {
            appName: true, accentColor: true, darkTheme: true, lightTheme: true, fonts: true, icons: true,
            faviconMetadata: true, emailBranding: true, loginBackground: true, dashboardStyle: true,
            locale: true, dateFormat: true, timeFormat: true, direction: true, revision: true
          }
        }
      }
    });
    if (!workspace) return null;
    const branding = workspace.branding;
    return {
      workspaceId, appName: branding?.appName ?? workspace.name, companyName: workspace.companyName,
      logoUrl: workspace.logoUrl, primaryColor: workspace.primaryColor, secondaryColor: workspace.secondaryColor,
      accentColor: branding?.accentColor ?? null, language: workspace.language, timezone: workspace.timezone,
      currency: workspace.currency, locale: branding?.locale ?? null, dateFormat: branding?.dateFormat ?? null,
      timeFormat: branding?.timeFormat ?? null, direction: branding?.direction ?? null,
      darkTheme: record(branding?.darkTheme), lightTheme: record(branding?.lightTheme), fonts: record(branding?.fonts),
      icons: record(branding?.icons), faviconMetadata: record(branding?.faviconMetadata),
      emailBranding: record(branding?.emailBranding), loginBackground: branding?.loginBackground ?? null,
      dashboardStyle: record(branding?.dashboardStyle), revision: branding?.revision ?? 0
    };
  }

  async upsertBranding(input: {
    workspaceId: string;
    appName?: string;
    accentColor?: string;
    darkTheme?: JsonRecord;
    lightTheme?: JsonRecord;
    fonts?: JsonRecord;
    icons?: JsonRecord;
    faviconMetadata?: JsonRecord;
    emailBranding?: JsonRecord;
    loginBackground?: string;
    dashboardStyle?: JsonRecord;
    locale?: string;
    dateFormat?: string;
    timeFormat?: string;
    direction?: string;
  }): Promise<void> {
    const { workspaceId, ...data } = input;
    await this.prisma.workspaceBranding.upsert({
      where: { workspaceId },
      create: {
        ...data, workspaceId, darkTheme: inputJson(data.darkTheme), lightTheme: inputJson(data.lightTheme),
        fonts: inputJson(data.fonts), icons: inputJson(data.icons), faviconMetadata: inputJson(data.faviconMetadata),
        emailBranding: inputJson(data.emailBranding), dashboardStyle: inputJson(data.dashboardStyle)
      },
      update: {
        ...data, darkTheme: inputJson(data.darkTheme), lightTheme: inputJson(data.lightTheme),
        fonts: inputJson(data.fonts), icons: inputJson(data.icons), faviconMetadata: inputJson(data.faviconMetadata),
        emailBranding: inputJson(data.emailBranding), dashboardStyle: inputJson(data.dashboardStyle),
        revision: { increment: 1 }
      }
    });
  }

  async manifest(workspaceId: string): Promise<ManifestSnapshot | null> {
    const manifest = await this.prisma.workspacePlatformManifest.findFirst({ where: { workspaceId } });
    return manifest ? {
      workspaceId: manifest.workspaceId, schemaVersion: manifest.schemaVersion,
      compatibilityVersion: manifest.compatibilityVersion, revision: manifest.revision,
      manifest: record(manifest.manifest) ?? {}, migrationMetadata: record(manifest.migrationMetadata),
      updatedAt: manifest.updatedAt
    } : null;
  }

  async upsertManifest(input: Omit<ManifestSnapshot, "updatedAt">): Promise<ManifestSnapshot> {
    const saved = await this.prisma.workspacePlatformManifest.upsert({
      where: { workspaceId: input.workspaceId },
      create: { ...input, manifest: input.manifest as Prisma.InputJsonValue, migrationMetadata: nullableInputJson(input.migrationMetadata) },
      update: {
        schemaVersion: input.schemaVersion, compatibilityVersion: input.compatibilityVersion,
        revision: { increment: 1 }, manifest: input.manifest as Prisma.InputJsonValue, migrationMetadata: nullableInputJson(input.migrationMetadata)
      }
    });
    return { ...input, revision: saved.revision, updatedAt: saved.updatedAt };
  }

  async upsertWorkspaceFeature(input: {
    workspaceId: string;
    key: string;
    state: "ENABLED" | "DISABLED" | "HIDDEN";
    experimental: boolean;
    dependencies: string[];
    metadata?: JsonRecord;
  }): Promise<FeatureSnapshot> {
    const flag = await this.prisma.featureFlag.upsert({
      where: { workspaceId_featureName: { workspaceId: input.workspaceId, featureName: input.key } },
      create: {
        workspaceId: input.workspaceId, featureName: input.key, state: input.state,
        enabled: input.state === "ENABLED", experimental: input.experimental,
        dependencies: input.dependencies, metadata: inputJson(input.metadata)
      },
      update: {
        state: input.state, enabled: input.state === "ENABLED", experimental: input.experimental,
        dependencies: input.dependencies, metadata: inputJson(input.metadata)
      },
      select: { featureName: true, state: true, experimental: true, dependencies: true, workspaceId: true }
    });
    return { key: flag.featureName, state: flag.state, experimental: flag.experimental, dependencies: flag.dependencies, workspaceId: flag.workspaceId };
  }

  async upsertPermissionOverride(input: {
    workspaceId: string;
    userId?: string;
    permissionCode: string;
    effect: "GRANT" | "REVOKE";
  }): Promise<void> {
    const permission = await this.prisma.permission.findUnique({ where: { code: input.permissionCode }, select: { id: true } });
    if (!permission) throw new Error("Unknown permission");
    await this.prisma.$transaction(async (transaction) => {
    if (input.userId) {
      await transaction.userPermissionOverride.upsert({
        where: { workspaceId_userId_permissionId: { workspaceId: input.workspaceId, userId: input.userId, permissionId: permission.id } },
        create: { workspaceId: input.workspaceId, userId: input.userId, permissionId: permission.id, effect: input.effect },
        update: { effect: input.effect }
      });
    } else await transaction.workspacePermissionOverride.upsert({
      where: { workspaceId_permissionId: { workspaceId: input.workspaceId, permissionId: permission.id } },
      create: { workspaceId: input.workspaceId, permissionId: permission.id, effect: input.effect },
      update: { effect: input.effect }
    });
    await transaction.workspace.update({ where: { id: input.workspaceId }, data: { permissionRevision: { increment: 1 } } });
    });
  }
}
