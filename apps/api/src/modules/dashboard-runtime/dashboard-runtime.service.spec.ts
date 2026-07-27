import { DashboardRuntimeCacheService } from "./dashboard-runtime-cache.service";
import { DashboardRuntimeService } from "./dashboard-runtime.service";
import { LayoutRegistryService } from "./layout-registry.service";
import { WidgetRegistryService } from "./widget-registry.service";

describe("DashboardRuntimeService", () => {
  const input = { workspaceId: "workspace", userId: "user", roleId: "role", roleName: "Admin" };
  const platform = {
    resolvedPermissions: jest.fn().mockResolvedValue(["platform.read"]),
    brandingFor: jest.fn().mockResolvedValue({ revision: 2, appName: "Responix" }),
    featuresFor: jest.fn().mockResolvedValue(["ai"]),
    licenseFor: jest.fn().mockResolvedValue({ status: "ACTIVE", expiresAt: null }),
    manifestFor: jest.fn().mockResolvedValue({
      schemaVersion: "1.0", compatibilityVersion: "1.0", revision: 4, generatedAt: "2026-01-01T00:00:00.000Z",
      manifest: { dashboard: { pages: [{ id: "home", layout: "grid", sections: [{ id: "main", layout: "flex", widgets: [{ id: "metric", kind: "metric" }] }] }] }, navigation: { items: [] } }
    })
  };

  it("returns a versioned immutable renderer-neutral bootstrap and caches matching revisions", async () => {
    const service = new DashboardRuntimeService(platform as never, new DashboardRuntimeCacheService(), new LayoutRegistryService(), new WidgetRegistryService());
    const first = await service.bootstrap(input);
    const second = await service.bootstrap(input);
    expect(first.manifestHash).toHaveLength(64);
    expect(first.layouts).toContain("split-view");
    expect(first.widgets.map((item) => item.kind)).toContain("table");
    expect(second).toBe(first);
    expect(platform.manifestFor).toHaveBeenCalledTimes(2);
  });

  it("rejects widgets that are not registered", async () => {
    platform.manifestFor.mockResolvedValueOnce({
      schemaVersion: "1.0", compatibilityVersion: "1.0", revision: 5, generatedAt: "2026-01-01T00:00:00.000Z",
      manifest: { dashboard: { pages: [{ layout: "grid", sections: [{ layout: "grid", widgets: [{ kind: "unregistered" }] }] }] }, navigation: { items: [] } }
    });
    const service = new DashboardRuntimeService(platform as never, new DashboardRuntimeCacheService(), new LayoutRegistryService(), new WidgetRegistryService());
    await expect(service.bootstrap(input)).rejects.toThrow("Unknown dashboard widget");
  });
});
