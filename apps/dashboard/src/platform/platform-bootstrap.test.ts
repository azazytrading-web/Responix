/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@responix/api-client";
import { PlatformBootstrapService } from "@responix/state";

vi.mock("@responix/api-client", () => ({ apiClient: { get: vi.fn() } }));

const workspace = { id: "w1", name: "One", slug: "one", status: "ACTIVE" };
const current = { permissions: ["platform.read"], features: ["ai"], license: {}, branding: {}, manifest: { schemaVersion: "1.0" } };
const dashboard = {
  version: "1.0", compatibilityVersion: "1.0", revision: 1,
  generatedAt: "2026-08-02T00:00:00Z", manifestHash: "hash",
  manifest: {}, navigation: { items: [] }, permissions: ["platform.read"],
  features: ["ai"], layouts: [], widgets: []
};

describe("PlatformBootstrapService", () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset());

  it("loads platform/current before dashboard bootstrap and caches the aggregate", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(current).mockResolvedValueOnce(dashboard);
    const service = new PlatformBootstrapService();
    const first = await service.bootstrap(workspace);
    const second = await service.bootstrap(workspace);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/api/v1/platform/current", { credentials: "include" });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/api/v1/dashboard-runtime/bootstrap", { credentials: "include" });
    expect(first).toBe(second);
    expect(first.permissions).toEqual(["platform.read"]);
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("invalidates workspace caches and rejects malformed navigation", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(current).mockResolvedValueOnce(dashboard)
      .mockResolvedValueOnce(current).mockResolvedValueOnce({ ...dashboard, navigation: {} });
    const service = new PlatformBootstrapService();
    await service.bootstrap(workspace);
    service.invalidate(workspace.id);
    await expect(service.bootstrap(workspace)).rejects.toThrow("invalid navigation manifest");
    expect(apiClient.get).toHaveBeenCalledTimes(4);
  });
});
