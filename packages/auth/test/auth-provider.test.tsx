/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { act, render, waitFor } from "@testing-library/react";
import { ApiError, NetworkError } from "@responix/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/providers/auth-provider";
import { authApi } from "../src/auth-api";
import { silentRefreshManager } from "../src/refresh/refresh-manager";
import type { AuthContextValue } from "../src/providers/auth-provider";
import type { AuthSession } from "../src/types";

const publish = vi.fn();
let syncHandler: ((event: unknown) => void) | undefined;
const { resolvePlatformCurrent } = vi.hoisted(() => ({ resolvePlatformCurrent: vi.fn() }));

vi.mock("../src/auth-api", () => ({
  authApi: { login: vi.fn(), selectWorkspace: vi.fn(), refresh: vi.fn(), logout: vi.fn(), switchWorkspace: vi.fn() }
}));
vi.mock("@responix/state", () => ({ platformBootstrapService: { resolvePlatformCurrent } }));
vi.mock("../src/refresh/interceptor", () => ({ installAuthInterceptors: () => () => undefined }));
vi.mock("../src/refresh/detector", () => ({ tokenExpirationDetector: { start: vi.fn(), stop: vi.fn() } }));
vi.mock("../src/cross-tab", () => ({
  createAuthSync: (handler: (event: unknown) => void) => {
    syncHandler = handler;
    return { publish, close: vi.fn() };
  }
}));

const session: AuthSession = {
  accessToken: "token", expiresIn: 900,
  user: { id: "u", email: "u@example.com", fullName: "User", workspaceId: "w1", permissions: ["legacy"] },
  workspace: { id: "w1", name: "One", slug: "one", status: "ACTIVE" }
};
const secondSession: AuthSession = {
  ...session, accessToken: "token-2",
  user: { ...session.user, workspaceId: "w2" },
  workspace: { id: "w2", name: "Two", slug: "two", status: "ACTIVE" }
};
let auth: AuthContextValue;
function Probe() { auth = useAuth(); return null; }

describe("authentication lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    publish.mockReset();
    resolvePlatformCurrent.mockReset().mockResolvedValue({ permissions: ["orders.read"], features: ["orders"], license: {}, branding: {}, manifest: {} });
    vi.mocked(authApi.logout).mockReset().mockResolvedValue({ status: "ok" });
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.selectWorkspace).mockReset();
    vi.mocked(authApi.switchWorkspace).mockReset();
    vi.spyOn(silentRefreshManager, "refresh").mockReset().mockResolvedValue(session);
    vi.spyOn(silentRefreshManager, "setHandlers").mockReturnValue(() => undefined);
  });

  it("restores, hydrates permissions/features, and ignores stale authority metadata", async () => {
    localStorage.setItem("responix:session", JSON.stringify({ permissions: ["stale"], features: ["stale"] }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth.state).toBe("AUTHENTICATED"));
    expect(auth.permissions).toEqual(["orders.read"]);
    expect(auth.features).toEqual(["orders"]);
    expect(localStorage.getItem("responix:session")).toBeNull();
    expect(localStorage.getItem("responix:display-session")).not.toContain("orders.read");
  });

  it("logs in, handles workspace selection, switches with cache isolation, and logs out", async () => {
    vi.mocked(silentRefreshManager.refresh).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "revoked"));
    const clearCache = vi.fn();
    render(<AuthProvider onSessionBoundary={clearCache}><Probe /></AuthProvider>);
    await waitFor(() => expect(auth.state).toBe("ANONYMOUS"));
    vi.mocked(authApi.login).mockResolvedValue({ requiresWorkspaceSelection: true, selectionToken: "challenge", expiresIn: 300, workspaces: [session.workspace, secondSession.workspace] });
    let result: Awaited<ReturnType<AuthContextValue["login"]>> | undefined;
    await act(async () => { result = await auth.login("u@example.com", "secret"); });
    expect(result?.status).toBe("workspace-selection-required");
    vi.mocked(authApi.selectWorkspace).mockResolvedValue(session);
    await act(async () => auth.selectWorkspace("w1"));
    expect(auth.state).toBe("AUTHENTICATED");
    vi.mocked(authApi.switchWorkspace).mockResolvedValue(secondSession);
    await act(async () => auth.switchWorkspace("w2"));
    expect(auth.workspace?.id).toBe("w2");
    expect(clearCache).toHaveBeenCalled();
    await act(async () => auth.logout());
    expect(auth.state).toBe("ANONYMOUS");
    expect(authApi.logout).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith({ type: "LOGOUT" });
  });

  it("authenticates a single-workspace login directly", async () => {
    vi.mocked(silentRefreshManager.refresh).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "missing"));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth.state).toBe("ANONYMOUS"));
    vi.mocked(authApi.login).mockResolvedValue(session);
    await act(async () => auth.login("u@example.com", "secret"));
    expect(auth.state).toBe("AUTHENTICATED");
    expect(auth.user?.id).toBe("u");
  });

  it("surfaces offline startup and synchronizes revoked sessions across tabs", async () => {
    vi.mocked(silentRefreshManager.refresh).mockRejectedValueOnce(new NetworkError());
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(auth.state).toBe("RECOVERY_REQUIRED"));
    await act(async () => { syncHandler?.({ type: "SESSION_INVALIDATED" }); });
    await waitFor(() => expect(auth.state).toBe("ANONYMOUS"));
  });
});
