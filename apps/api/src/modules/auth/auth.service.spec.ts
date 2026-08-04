import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

jest.mock("@node-rs/argon2", () => ({
  hash: jest.fn().mockResolvedValue("hashed-refresh"),
  verify: jest.fn().mockResolvedValue(true)
}));

function membership(id: string, workspaceId: string) {
  return {
    id,
    userId: "user",
    workspaceId,
    roleId: "role",
    status: "ACTIVE",
    invitedAt: null,
    acceptedAt: new Date(),
    suspendedAt: null,
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: "user", email: "user@example.com", fullName: "User", status: "ACTIVE" },
    workspace: { id: workspaceId, name: workspaceId, slug: workspaceId, status: "ACTIVE" },
    role: {
      id: "role",
      rolePermissions: [{ permission: { code: "platform.read" } }]
    }
  };
}

describe("AuthService authentication contracts", () => {
  const repository = {
    findUsersForLogin: jest.fn(),
    findSession: jest.fn(),
    createSession: jest.fn(),
    rotateRefreshSession: jest.fn(),
    revokeSession: jest.fn(),
    findActiveMembershipByIdForUser: jest.fn(),
    findActiveMembershipForUserWorkspace: jest.fn()
  };
  const jwt = {
    signAsync: jest.fn().mockImplementation((claims: { purpose?: string }) =>
      Promise.resolve(claims.purpose === "workspace-selection" ? "selection-token" : "credential-token")
    ),
    verifyAsync: jest.fn()
  };
  const config = { getOrThrow: jest.fn().mockReturnValue("secret") };
  const tenantRepository = { findActiveMembership: jest.fn() };
  const service = new AuthService(
    repository as never,
    jwt as never,
    config as never,
    tenantRepository as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createSession.mockResolvedValue({});
    repository.rotateRefreshSession.mockResolvedValue(true);
  });

  it("rejects login when no active workspace membership is available", async () => {
    repository.findUsersForLogin.mockResolvedValue([
      { status: "SUSPENDED", passwordHash: "hash", memberships: [] }
    ]);
    await expect(service.login("user@example.com", "password", {})).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("returns only credential-verified workspaces when selection is required", async () => {
    const first = membership("membership-1", "workspace-1");
    const second = membership("membership-2", "workspace-2");
    repository.findUsersForLogin.mockResolvedValue([
      { status: "ACTIVE", passwordHash: "hash", memberships: [first, second] }
    ]);

    await expect(service.login("user@example.com", "password", {})).resolves.toEqual({
      requiresWorkspaceSelection: true,
      selectionToken: "selection-token",
      expiresIn: 300,
      workspaces: [first.workspace, second.workspace]
    });
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("accepts only a workspace contained in the signed selection challenge", async () => {
    const selected = membership("membership-2", "workspace-2");
    jwt.verifyAsync.mockResolvedValue({
      sub: "user",
      purpose: "workspace-selection",
      membershipIds: ["membership-1", "membership-2"]
    });
    repository.findActiveMembershipByIdForUser
      .mockResolvedValueOnce(membership("membership-1", "workspace-1"))
      .mockResolvedValueOnce(selected);

    const result = await service.selectWorkspace("selection-token", "workspace-2", {});
    expect(result.workspace.id).toBe("workspace-2");
    expect(repository.createSession).toHaveBeenCalled();
  });

  it("rejects refresh when the persisted session is revoked or absent", async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: "user",
      workspaceId: "workspace",
      membershipId: "membership",
      sessionId: "session"
    });
    repository.findSession.mockResolvedValue(null);

    await expect(service.refresh("refresh-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("switches only to an active membership and rotates the previous workspace session", async () => {
    const claims = {
      sub: "user",
      workspaceId: "workspace-1",
      membershipId: "membership-1",
      sessionId: "session-1"
    };
    repository.findSession.mockResolvedValue({
      id: "session-1",
      userId: "user",
      workspaceId: "workspace-1"
    });
    repository.findActiveMembershipForUserWorkspace.mockResolvedValue(
      membership("membership-2", "workspace-2")
    );

    const result = await service.switchWorkspace(claims, "workspace-2");
    expect(result.workspace.id).toBe("workspace-2");
    expect(repository.rotateRefreshSession).toHaveBeenCalledWith(
      { id: "session-1", userId: "user", workspaceId: "workspace-1" },
      expect.objectContaining({ workspaceId: "workspace-2" })
    );
  });
});
