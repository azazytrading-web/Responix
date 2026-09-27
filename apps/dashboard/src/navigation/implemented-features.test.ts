import { describe, expect, it } from "vitest";
import type { PlatformNavigationSchemaDto } from "@responix/types";
import { NavigationRegistry } from "./registry";
import { resolveNavigationForPlacement } from "./resolver";

const navigation: PlatformNavigationSchemaDto = {
  items: [
    { id: "dashboard", label: "Dashboard", route: "/", icon: { name: "LayoutDashboard" }, order: 1, placement: "sidebar" },
    { id: "company", label: "Company", route: "/company", icon: { name: "Building2" }, order: 2, placement: "sidebar", visibility: { permissions: ["workspace.read"] } },
    { id: "platform", label: "Platform Control", route: "/platform", icon: { name: "Settings" }, order: 3, placement: "sidebar", visibility: { permissions: ["platform.configure"] } },
    { id: "team", label: "Team", route: "/company/members", icon: { name: "Users" }, order: 4, placement: "sidebar", visibility: { permissions: ["workspace.members.read"] } },
    { id: "agents", label: "Agents", route: "/ai/agents", icon: { name: "Bot" }, order: 5, placement: "sidebar", visibility: { permissions: ["agent.studio.read"] } },
    { id: "providers", label: "Providers", route: "/ai/providers", icon: { name: "Plug" }, order: 6, placement: "sidebar", visibility: { permissions: ["ai.configure"] } },
    { id: "prompts", label: "Prompt Library", route: "/ai/prompts", icon: { name: "BookOpen" }, order: 7, placement: "sidebar", visibility: { permissions: ["prompt.library.read"] } }
  ]
};

describe("implemented feature navigation", () => {
  it("exposes all completed permission-gated modules without optional feature entitlements", () => {
    const registry = new NavigationRegistry();
    registry.load(navigation);
    const resolved = resolveNavigationForPlacement(registry.getAll(), {
      permissions: ["workspace.read", "platform.configure", "workspace.members.read", "agent.studio.read", "ai.configure", "prompt.library.read"],
      features: []
    }, "/ai/agents", "sidebar");

    expect(resolved.map((item) => [item.label, item.route])).toEqual([
      ["Dashboard", "/"],
      ["Company", "/company"],
      ["Platform Control", "/platform"],
      ["Team", "/company/members"],
      ["Agents", "/ai/agents"],
      ["Providers", "/ai/providers"],
      ["Prompt Library", "/ai/prompts"]
    ]);
    expect(resolved.find((item) => item.id === "agents")?.active).toBe(true);
  });

  it("does not expose permission-gated modules when permissions are absent", () => {
    const registry = new NavigationRegistry();
    registry.load(navigation);
    const resolved = resolveNavigationForPlacement(registry.getAll(), {
      permissions: ["workspace.read", "platform.configure"],
      features: []
    }, "/", "sidebar");

    expect(resolved.map((item) => item.id)).toEqual(["dashboard", "company", "platform"]);
  });
});
