import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthController, REFRESH_COOKIE_NAME } from "./auth.controller";
import type { AuthService, IssuedCredentials } from "./auth.service";

const credentials: IssuedCredentials = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresIn: 900,
  user: {
    id: "user",
    email: "user@example.com",
    fullName: "User",
    workspaceId: "workspace",
    permissions: ["platform.read"]
  },
  workspace: { id: "workspace", name: "Workspace", slug: "workspace", status: "ACTIVE" }
};

describe("AuthController", () => {
  const auth = {
    login: jest.fn(),
    selectWorkspace: jest.fn(),
    refresh: jest.fn(),
    switchWorkspace: jest.fn(),
    logout: jest.fn()
  } as unknown as AuthService;
  const response = { cookie: jest.fn(), clearCookie: jest.fn() };
  const controller = new AuthController(auth);

  beforeEach(() => jest.clearAllMocks());

  it("sets an HttpOnly refresh cookie and excludes it from the login body", async () => {
    jest.spyOn(auth, "login").mockResolvedValue(credentials);
    await expect(
      controller.login(
        { email: "user@example.com", password: "Password1!" },
        "127.0.0.1",
        response,
        "jest"
      )
    ).resolves.toEqual({
      accessToken: "access",
      expiresIn: 900,
      user: credentials.user,
      workspace: credentials.workspace
    });
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "refresh",
      expect.objectContaining({ httpOnly: true, sameSite: "strict" })
    );
  });

  it("returns a workspace challenge only after credential verification", async () => {
    const challenge = {
      requiresWorkspaceSelection: true as const,
      selectionToken: "selection",
      expiresIn: 300,
      workspaces: [credentials.workspace]
    };
    jest.spyOn(auth, "login").mockResolvedValue(challenge);
    await expect(
      controller.login(
        { email: "user@example.com", password: "Password1!" },
        "127.0.0.1",
        response
      )
    ).resolves.toEqual(challenge);
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it("refreshes only from the protected cookie with the CSRF header", async () => {
    const refresh = jest.spyOn(auth, "refresh").mockResolvedValue(credentials);
    await expect(
      controller.refresh(
        { headers: { cookie: `${REFRESH_COOKIE_NAME}=encoded%20token` } },
        response,
        "XMLHttpRequest"
      )
    ).resolves.toMatchObject({ accessToken: "access" });
    expect(refresh).toHaveBeenCalledWith("encoded token");
  });

  it("rejects refresh without the CSRF header", async () => {
    await expect(controller.refresh({ headers: {} }, response)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("rejects logout without an authenticated session", async () => {
    await expect(controller.logout({}, response)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokes logout and clears the refresh cookie", async () => {
    const logout = jest.spyOn(auth, "logout");
    await expect(
      controller.logout(
        { user: { sub: "user", workspaceId: "workspace", membershipId: "member", sessionId: "session" } },
        response
      )
    ).resolves.toEqual({ status: "ok" });
    expect(logout).toHaveBeenCalledWith("session", "user", "workspace");
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, sameSite: "strict" })
    );
  });
});
