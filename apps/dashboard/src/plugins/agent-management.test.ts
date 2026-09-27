import { beforeEach, describe, expect, it } from "vitest";
import { clearRegistry, getAuthorizedPlugins, getPlugin, registerBuiltInPlugins } from ".";

describe("agent management plugin", () => {
  beforeEach(() => clearRegistry());
  it("registers the Agent Studio route idempotently", () => {
    registerBuiltInPlugins(); registerBuiltInPlugins();
    expect(getPlugin("agent-management")?.routes[0]).toMatchObject({ path: "/ai/agents", permissions: ["agent.studio.read"] });
  });
  it("requires read permission for navigation", () => {
    registerBuiltInPlugins();
    expect(getAuthorizedPlugins(["agent.studio.read"], []).map((p) => p.id)).toContain("agent-management");
    expect(getAuthorizedPlugins(["agent.studio.write"], []).map((p) => p.id)).not.toContain("agent-management");
  });
});
