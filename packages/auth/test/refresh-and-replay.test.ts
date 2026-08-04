/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../src/auth-api";
import { clearAccessSession, getAccessToken } from "../src/session";
import { SilentRefreshManager, silentRefreshManager } from "../src/refresh/refresh-manager";
import { authRequestInterceptor, authResponseInterceptor } from "../src/refresh/interceptor";
import type { AuthSession } from "../src/types";

vi.mock("../src/auth-api", () => ({ authApi: { refresh: vi.fn() } }));

const session: AuthSession = {
  accessToken: "new-token",
  expiresIn: 900,
  user: { id: "u", email: "u@example.com", fullName: "User", workspaceId: "w", permissions: [] },
  workspace: { id: "w", name: "Workspace", slug: "workspace", status: "ACTIVE" }
};

describe("refresh coordination and replay", () => {
  beforeEach(() => {
    vi.mocked(authApi.refresh).mockReset().mockResolvedValue(session);
    clearAccessSession();
    silentRefreshManager.reset();
  });

  it("uses one refresh for concurrent callers", async () => {
    const manager = new SilentRefreshManager();
    const [first, second] = await Promise.all([manager.refresh(), manager.refresh()]);
    expect(first).toBe(second);
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("new-token");
  });

  it("propagates refresh failure and permits a later recovery attempt", async () => {
    const manager = new SilentRefreshManager();
    vi.mocked(authApi.refresh).mockRejectedValueOnce(new Error("revoked"));
    await expect(manager.refresh()).rejects.toThrow("revoked");
    vi.mocked(authApi.refresh).mockResolvedValueOnce(session);
    await expect(manager.refresh()).resolves.toEqual(session);
  });

  it("adds credentials and the current access token", async () => {
    await silentRefreshManager.refresh();
    const result = await authRequestInterceptor({ path: "/api/v1/platform/current", url: "http://localhost/api/v1/platform/current", config: {}, attempt: 0 });
    expect(result.config.credentials).toBe("include");
    expect(new Headers(result.config.headers).get("authorization")).toBe("Bearer new-token");
  });

  it("refreshes and replays a 401 exactly once", async () => {
    const replay = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const request = { path: "/api/v1/platform/current", url: "http://localhost/api/v1/platform/current", config: {}, attempt: 0 };
    await authResponseInterceptor({ request, response: new Response(null, { status: 401 }), replay });
    expect(replay).toHaveBeenCalledTimes(1);
    await authResponseInterceptor({ request: { ...request, attempt: 1 }, response: new Response(null, { status: 401 }), replay });
    expect(replay).toHaveBeenCalledTimes(1);
  });
});
