import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard, PermissionsGuard } from "./auth.guard";

describe("authentication guards", () => {
  it("attaches verified JWT claims to the request", async () => {
    const request = { headers: { authorization: "Bearer token" } };
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request })
    } as never;
    const guard = new JwtAuthGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ sub: "user" }) } as never,
      { getOrThrow: jest.fn().mockReturnValue("secret") } as never,
      { getAllAndOverride: jest.fn() } as never
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({ user: { sub: "user" } });
  });

  it("rejects missing bearer tokens", async () => {
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
    } as never;
    const guard = new JwtAuthGuard(
      {} as never,
      {} as never,
      { getAllAndOverride: jest.fn() } as never
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("allows requests without declared permissions", async () => {
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => ({ user: { permissions: ["users.view"] } }) })
    } as never;
    await expect(
      new PermissionsGuard(
        { getAllAndOverride: jest.fn().mockReturnValue([]) } as never,
        { resolve: jest.fn() } as never
      ).canActivate(context)
    ).resolves.toBe(true);
  });
});
