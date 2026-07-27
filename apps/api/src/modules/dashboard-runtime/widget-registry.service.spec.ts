import { WidgetRegistryService } from "./widget-registry.service";

describe("WidgetRegistryService", () => {
  it("supports extension registration without runtime branching", () => {
    const registry = new WidgetRegistryService();
    registry.register({ kind: "crm-score", version: "1.0" });
    expect(registry.has("crm-score")).toBe(true);
    expect(() => registry.register({ kind: "crm-score", version: "1.0" })).toThrow("already registered");
  });
});
