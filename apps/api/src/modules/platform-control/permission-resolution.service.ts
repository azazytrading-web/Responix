import { Injectable } from "@nestjs/common";
import type { PermissionSnapshot, ResolvedPermissionSnapshot } from "./platform-control.types";
import { PlatformControlRepository } from "./platform-control.repository";

@Injectable()
export class PermissionResolutionService {
  private readonly cache = new Map<string, ResolvedPermissionSnapshot>();
  constructor(private readonly repository: PlatformControlRepository) {}

  async resolve(input: {
    workspaceId: string;
    userId: string;
    roleId: string;
    roleName: string;
  }): Promise<string[]> {
    return (await this.resolveDetailed(input)).permissions;
  }

  async resolveDetailed(input: { workspaceId: string; userId: string; roleId: string; roleName: string }): Promise<ResolvedPermissionSnapshot> {
    const revision = await this.repository.permissionRevision(input.workspaceId);
    const key = `${input.workspaceId}:${input.userId}:${input.roleId}`;
    const cached = this.cache.get(key);
    if (cached?.revision === revision) return cached;
    const snapshot = await this.repository.permissionSnapshot(input);
    const resolved = this.resolveDetailedSnapshot(snapshot, revision);
    // Time-bound grants are intentionally never retained: their validity changes without a mutation.
    if (!snapshot.hasActiveTemporaryAssignments) this.cache.set(key, resolved);
    return resolved;
  }

  invalidateWorkspace(workspaceId: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(`${workspaceId}:`)) this.cache.delete(key);
  }

  resolveSnapshot(snapshot: PermissionSnapshot): string[] {
    const roles = new Map(snapshot.roles.map((role) => [role.id, role]));
    const roleIds = new Set<string>();
    const visitRole = (roleId: string): void => {
      if (roleIds.has(roleId)) return;
      roleIds.add(roleId);
      for (const parent of roles.get(roleId)?.parentRoleIds ?? []) visitRole(parent);
    };
    visitRole(snapshot.roleId);
    for (const roleId of snapshot.temporaryRoleIds) visitRole(roleId);

    const permissions = new Set<string>();
    for (const roleId of roleIds) {
      for (const permission of roles.get(roleId)?.permissions ?? []) permissions.add(permission);
    }
    const inherited = new Map<string, string[]>();
    for (const entry of snapshot.permissionInheritance) {
      inherited.set(entry.permission, [...(inherited.get(entry.permission) ?? []), entry.inheritedPermission]);
    }
    for (const permission of [...permissions]) this.addInherited(permission, inherited, permissions);
    const overrides = [...snapshot.workspaceOverrides, ...snapshot.userOverrides, ...snapshot.temporaryPermissionOverrides];
    // A deny is terminal for the resolved request. A more-specific allow cannot weaken it.
    const denied = new Set(overrides.filter((override) => override.effect === "REVOKE").map((override) => override.permission));
    for (const permission of denied) permissions.delete(permission);
    for (const override of overrides) if (override.effect === "GRANT" && !denied.has(override.permission)) permissions.add(override.permission);
    return [...permissions].sort();
  }

  resolveDetailedSnapshot(snapshot: PermissionSnapshot, revision = 0): ResolvedPermissionSnapshot {
    const permissions = this.resolveSnapshot(snapshot);
    const sources = new Map<string, string[]>();
    for (const role of snapshot.roles) {
      for (const permission of role.permissions) {
        const bucket = sources.get(permission) ?? [];
        bucket.push(`role:${role.id}`);
        sources.set(permission, bucket);
      }
    }
    const denied = new Set<string>();
    for (const override of [...snapshot.workspaceOverrides, ...snapshot.userOverrides, ...snapshot.temporaryPermissionOverrides]) {
      if (override.effect === "REVOKE") denied.add(override.permission);
      const bucket = sources.get(override.permission) ?? [];
      bucket.push(snapshot.temporaryPermissionOverrides.includes(override) ? "temporary:assignment" : `${override.effect.toLowerCase()}:override`);
      sources.set(override.permission, bucket);
    }
    return {
      workspaceId: snapshot.workspaceId, userId: snapshot.userId, revision, permissions,
      explanations: [...new Set([...permissions, ...denied])].sort().map((permission) => ({
        permission, decision: permissions.includes(permission) ? "GRANT" : "DENY",
        sources: sources.get(permission) ?? []
      }))
    };
  }

  private addInherited(permission: string, inherited: Map<string, string[]>, resolved: Set<string>): void {
    for (const child of inherited.get(permission) ?? []) {
      if (!resolved.has(child)) {
        resolved.add(child);
        this.addInherited(child, inherited, resolved);
      }
    }
  }

}
