import { PermissionResolutionService } from "./permission-resolution.service";

describe("PermissionResolutionService", () => {
  it("resolves multi-level roles and applies deny precedence after grants", () => {
    const service = new PermissionResolutionService({} as never);

    expect(service.resolveSnapshot({
      workspaceId: "workspace", userId: "user", roleId: "manager", roleName: "Manager",
      roles: [
        { id: "manager", parentRoleIds: ["lead"], permissions: ["reports.view"] },
        { id: "lead", parentRoleIds: ["agent"], permissions: [] },
        { id: "agent", parentRoleIds: [], permissions: ["crm.view"] }
      ],
      permissionInheritance: [{ permission: "reports.view", inheritedPermission: "reports.export" }],
      workspaceOverrides: [{ permission: "crm.view", effect: "REVOKE" }],
      userOverrides: [{ permission: "billing.view", effect: "GRANT" }],
      temporaryRoleIds: [], temporaryPermissionOverrides: [], hasActiveTemporaryAssignments: false
    })).toEqual(["billing.view", "reports.export", "reports.view"]);
  });

  it("omits expired assignments by resolving only active snapshot assignments", () => {
    const service = new PermissionResolutionService({} as never);
    expect(service.resolveSnapshot({
      workspaceId: "workspace", userId: "user", roleId: "agent", roleName: "Agent",
      roles: [{ id: "agent", parentRoleIds: [], permissions: [] }, { id: "temporary", parentRoleIds: [], permissions: ["reports.view"] }],
      permissionInheritance: [], workspaceOverrides: [], userOverrides: [],
      temporaryRoleIds: ["temporary"], temporaryPermissionOverrides: [{ permission: "reports.export", effect: "GRANT" }], hasActiveTemporaryAssignments: true
    })).toEqual(["reports.export", "reports.view"]);
  });

  it("uses the workspace revision to invalidate a cached decision", async () => {
    const repository = {
      permissionRevision: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      permissionSnapshot: jest.fn().mockResolvedValue({
        workspaceId: "workspace", userId: "user", roleId: "agent", roleName: "Agent",
        roles: [{ id: "agent", parentRoleIds: [], permissions: ["crm.view"] }], permissionInheritance: [],
        workspaceOverrides: [], userOverrides: [], temporaryRoleIds: [], temporaryPermissionOverrides: [], hasActiveTemporaryAssignments: false
      })
    };
    const service = new PermissionResolutionService(repository as never);
    const input = { workspaceId: "workspace", userId: "user", roleId: "agent", roleName: "Agent" };
    await service.resolve(input); await service.resolve(input); await service.resolve(input);
    expect(repository.permissionSnapshot).toHaveBeenCalledTimes(2);
  });

  it("keeps a deny terminal when a lower-risk grant also exists", () => {
    const service = new PermissionResolutionService({} as never);
    expect(service.resolveSnapshot({
      workspaceId: "workspace", userId: "user", roleId: "agent", roleName: "Agent",
      roles: [{ id: "agent", parentRoleIds: [], permissions: ["billing.view"] }], permissionInheritance: [],
      workspaceOverrides: [{ permission: "billing.view", effect: "REVOKE" }], userOverrides: [{ permission: "billing.view", effect: "GRANT" }],
      temporaryRoleIds: [], temporaryPermissionOverrides: [], hasActiveTemporaryAssignments: false
    })).toEqual([]);
  });
});
