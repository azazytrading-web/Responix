import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { MembershipGuard } from "./membership.guard";
import { TenantContextService } from "./tenant-context.service";
import { TenantGuard } from "./tenant.guard";

const activeMembership = {
  id: "membership-id",
  workspaceId: "workspace-id",
  userId: "user-id",
  roleId: "role-id",
  status: "ACTIVE",
  invitedAt: new Date(),
  acceptedAt: new Date(),
  suspendedAt: null,
  removedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: "user-id", email: "user@example.com", fullName: "User", status: "ACTIVE" },
  workspace: { id: "workspace-id", name: "Workspace", slug: "workspace", status: "ACTIVE" },
  role: { id: "role-id", name: "Owner", rolePermissions: [{ permission: { code: "workspace.read" } }] }
};

describe("TenantContextService", () => {
  it("resolves and caches validated membership permissions", async () => {
    const request = {
      user: { sub: "user-id", workspaceId: "workspace-id", membershipId: "membership-id", sessionId: "s" }
    };
    const repository = { findActiveMembership: jest.fn().mockResolvedValue(activeMembership) };
    const service = new TenantContextService(request, repository as never);

    await expect(service.resolve()).resolves.toMatchObject({ permissions: ["workspace.read"] });
    await expect(service.resolve()).resolves.toMatchObject({ membership: { id: "membership-id" } });
    expect(repository.findActiveMembership).toHaveBeenCalledTimes(1);
  });

  it("rejects missing JWT tenant claims", async () => {
    const service = new TenantContextService({}, { findActiveMembership: jest.fn() } as never);
    await expect(service.resolve()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an inactive or missing membership", async () => {
    const service = new TenantContextService(
      { user: { sub: "user", workspaceId: "workspace", membershipId: "member", sessionId: "s" } },
      { findActiveMembership: jest.fn().mockResolvedValue(null) } as never
    );
    await expect(service.resolve()).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("tenant guards", () => {
  const context = {
    getHandler: () => function handler() {},
    getClass: () => class TestController {}
  } as never;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };

  it("resolves tenant context before allowing a protected route", async () => {
    const tenantContext = { resolve: jest.fn().mockResolvedValue({}) };
    const guard = new TenantGuard(reflector as never, tenantContext as never);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tenantContext.resolve).toHaveBeenCalled();
  });

  it("rejects an inactive membership", () => {
    const tenantContext = { resolved: { membership: { status: "SUSPENDED" } } };
    const guard = new MembershipGuard(reflector as never, tenantContext as never);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
