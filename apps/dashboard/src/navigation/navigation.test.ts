import { describe, it, expect } from "vitest";
import { NavigationRegistry } from "../navigation/registry";
import { resolveNavigation } from "../navigation/resolver";
import { generateBreadcrumbs } from "../navigation/breadcrumbs";
import { mockManifest } from "../lib/mock-manifest";

const t = (key: string) => key;

describe("NavigationResolver", () => {
  const registry = new NavigationRegistry();
  registry.load(mockManifest.navigation);

  it("resolves all sidebar items without filtering", () => {
    const items = resolveNavigation(registry.getAll(), { permissions: [], features: [] }, "/");
    const sidebarItems = items.filter((i) => i.placement === "sidebar");
    expect(sidebarItems.length).toBeGreaterThan(0);
  });

  it("filters items by permission", () => {
    const items = resolveNavigation(registry.getAll(), { permissions: ["ai.read"], features: [] }, "/");
    const aiItem = items.find((i) => i.id === "ai-studio");
    expect(aiItem).toBeDefined();
  });

  it("hides items when permission is missing", () => {
    const items = resolveNavigation(registry.getAll(), { permissions: [], features: [] }, "/");
    const aiItem = items.find((i) => i.id === "ai-studio");
    expect(aiItem).toBeUndefined();
  });

  it("marks active route correctly", () => {
    const items = resolveNavigation(registry.getAll(), { permissions: [], features: [] }, "/settings");
    const settingsItem = items.find((i) => i.id === "settings");
    expect(settingsItem?.active).toBe(true);
  });
});

describe("BreadcrumbGenerator", () => {
  const registry = new NavigationRegistry();
  registry.load(mockManifest.navigation);

  it("generates breadcrumbs for known route", () => {
    const crumbs = generateBreadcrumbs(registry, "/settings", t);
    expect(crumbs.length).toBeGreaterThan(0);
    expect(crumbs[crumbs.length - 1]?.active).toBe(true);
  });

  it("falls back to path segments for unknown routes", () => {
    const crumbs = generateBreadcrumbs(registry, "/unknown/route", t);
    expect(crumbs.length).toBeGreaterThan(1);
  });
});
