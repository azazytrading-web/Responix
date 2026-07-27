import { FeatureResolutionService } from "./feature-resolution.service";

describe("FeatureResolutionService", () => {
  it("uses workspace state, license entitlements, dependencies, and experimental policy", async () => {
    const repository = {
      featureSnapshots: jest.fn().mockResolvedValue([
        { key: "crm", state: "ENABLED", experimental: false, dependencies: [], workspaceId: null },
        { key: "reports", state: "ENABLED", experimental: false, dependencies: ["crm"], workspaceId: "workspace" },
        { key: "beta", state: "ENABLED", experimental: true, dependencies: [], workspaceId: null },
        { key: "export", state: "HIDDEN", experimental: false, dependencies: [], workspaceId: "workspace" }
      ]),
      licenseSnapshot: jest.fn().mockResolvedValue({ features: ["export"] })
    };
    const service = new FeatureResolutionService(repository as never);

    await expect(service.resolve("workspace")).resolves.toEqual(["crm", "reports"]);
    await expect(service.resolve("workspace", true)).resolves.toEqual(["beta", "crm", "reports"]);
  });
});
