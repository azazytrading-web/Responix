import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformBootstrapProvider, usePlatformBootstrap } from "./platform-provider";

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  invalidate: vi.fn(),
  auth: {
    isAuthenticated: false,
    workspace: null as { id: string; name: string; slug: string; status: "ACTIVE" } | null
  }
}));

vi.mock("@responix/auth", () => ({
  useAuth: () => mocks.auth
}));
vi.mock("@responix/state", () => ({
  platformBootstrapService: { bootstrap: mocks.bootstrap, invalidate: mocks.invalidate }
}));

let observed: ReturnType<typeof usePlatformBootstrap>;
function Probe() { observed = usePlatformBootstrap(); return null; }

const snapshot = {
  workspace: { id: "w1", name: "One", slug: "one", status: "ACTIVE" },
  platform: { permissions: [], features: [], license: {}, branding: {}, manifest: {} },
  dashboard: {}, permissions: ["platform.read"], features: ["ai"],
  featureManifest: {}, navigation: { items: [] }
};

describe("PlatformBootstrapProvider", () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.workspace = null;
    mocks.bootstrap.mockReset();
    mocks.invalidate.mockReset();
  });

  it("waits for authentication, then exposes permissions, features, and navigation atomically", async () => {
    mocks.bootstrap.mockResolvedValue(snapshot);
    const view = render(<PlatformBootstrapProvider><Probe /></PlatformBootstrapProvider>);
    expect(observed.state).toBe("IDLE");
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    mocks.auth.isAuthenticated = true;
    mocks.auth.workspace = snapshot.workspace as typeof mocks.auth.workspace;
    view.rerender(<PlatformBootstrapProvider><Probe /></PlatformBootstrapProvider>);
    await waitFor(() => expect(observed.state).toBe("READY"));
    expect(observed.permissions).toEqual(["platform.read"]);
    expect(observed.features).toEqual(["ai"]);
    expect(observed.navigationRegistry).not.toBeNull();
  });

  it("exposes a stable error state and retries after invalidation", async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.workspace = snapshot.workspace as typeof mocks.auth.workspace;
    mocks.bootstrap.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(snapshot);
    render(<PlatformBootstrapProvider><Probe /></PlatformBootstrapProvider>);
    await waitFor(() => expect(observed.state).toBe("ERROR"));
    act(() => observed.retry());
    await waitFor(() => expect(observed.state).toBe("READY"));
    expect(mocks.invalidate).toHaveBeenCalledWith("w1");
  });
});
