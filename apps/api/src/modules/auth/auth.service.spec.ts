import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService membership validation", () => {
  const repository = {
    findUsersForLogin: jest.fn(),
    findSession: jest.fn(),
    createSession: jest.fn(),
    rotateRefreshSession: jest.fn(),
    revokeSession: jest.fn()
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue("token"), verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue("secret") };
  const tenantRepository = { findActiveMembership: jest.fn() };
  const service = new AuthService(
    repository as never,
    jwt as never,
    config as never,
    tenantRepository as never
  );

  beforeEach(() => jest.clearAllMocks());

  it("rejects login when no active workspace membership is available", async () => {
    repository.findUsersForLogin.mockResolvedValue([
      { status: "SUSPENDED", passwordHash: "hash", memberships: [] }
    ]);
    await expect(service.login("user@example.com", "password", {})).rejects.toBeInstanceOf(
      UnauthorizedException
    );
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
});
