import { UnauthorizedException } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";

describe("AuthController", () => {
  const auth = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn()
  } as unknown as AuthService;
  const controller = new AuthController(auth);

  beforeEach(() => jest.clearAllMocks());

  it("forwards login metadata to the service", async () => {
    const login = jest.spyOn(auth, "login").mockResolvedValue({ accessToken: "access" } as never);
    await expect(
      controller.login({ email: "user@example.com", password: "Password1!" }, "127.0.0.1", "jest")
    ).resolves.toEqual({ accessToken: "access" });
    expect(login).toHaveBeenCalledWith("user@example.com", "Password1!", {
      ipAddress: "127.0.0.1",
      userAgent: "jest"
    });
  });

  it("rejects logout without an authenticated session", async () => {
    await expect(controller.logout({})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
