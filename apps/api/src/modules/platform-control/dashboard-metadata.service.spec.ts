import { DashboardMetadataService } from "./dashboard-metadata.service";

describe("DashboardMetadataService", () => {
  it("omits inaccessible sections and actions instead of returning disabled controls", async () => {
    const service = new DashboardMetadataService(
      {
        manifest: jest.fn().mockResolvedValue({
          workspaceId: "workspace", schemaVersion: "1.0", compatibilityVersion: "1.0", revision: 2,
          migrationMetadata: null, updatedAt: new Date("2026-01-01"),
          manifest: {
            dashboard: {
              pages: [{ id: "home", sections: [
                { id: "visible", visibility: { permissions: ["crm.view"] } },
                { id: "hidden", visibility: { permissions: ["billing.view"] } }
              ] }]
            },
            navigation: { items: [{ id: "crm" }, { id: "billing", visibility: { featureFlags: ["billing"] } }] }
          }
        })
      } as never,
      { resolve: jest.fn().mockResolvedValue(["crm"]) } as never,
      { resolve: jest.fn().mockResolvedValue({ planId: "plan", active: true }) } as never
    );

    const result = await service.resolve({ workspaceId: "workspace", role: "Manager", permissions: ["crm.view"] });
    const dashboard = result.manifest.dashboard as { pages: Array<{ sections: Array<{ id: string }> }> };
    const navigation = result.manifest.navigation as { items: Array<{ id: string }> };

    expect(dashboard.pages[0]!.sections).toEqual([{ id: "visible" }]);
    expect(navigation.items).toEqual([{ id: "crm" }]);
    expect(result.generatedAt).toEqual(expect.any(String));
  });
});
