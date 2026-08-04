import { describe, it, expect } from "vitest";
import { NavigationRegistry } from "./registry";
import { mockManifest } from "../lib/mock-manifest";

describe("NavigationRegistry", () => {
  it("loads manifest items", () => {
    const registry = new NavigationRegistry();
    registry.load(mockManifest.navigation);
    expect(registry.getAll().length).toBeGreaterThan(0);
  });

  it("finds item by id", () => {
    const registry = new NavigationRegistry();
    registry.load(mockManifest.navigation);
    const entry = registry.getById("dashboard");
    expect(entry).toBeDefined();
    expect(entry?.item.id).toBe("dashboard");
  });

  it("finds item by route", () => {
    const registry = new NavigationRegistry();
    registry.load(mockManifest.navigation);
    const entry = registry.findByRoute("/settings");
    expect(entry?.item.id).toBe("settings");
  });

  it("returns roots only", () => {
    const registry = new NavigationRegistry();
    registry.load(mockManifest.navigation);
    const roots = registry.getRoots();
    expect(roots.every((r) => r.depth === 0)).toBe(true);
  });

  it("clears entries", () => {
    const registry = new NavigationRegistry();
    registry.load(mockManifest.navigation);
    registry.clear();
    expect(registry.getAll().length).toBe(0);
  });
});
