import { beforeEach, describe, expect, it } from "vitest";
import { clearRegistry, getAuthorizedPlugins, getPlugin, registerBuiltInPlugins } from ".";

describe("team management plugin", () => {
  beforeEach(() => clearRegistry());

  it("registers idempotently with the physical route and read permission", () => {
    registerBuiltInPlugins();
    registerBuiltInPlugins();

    expect(getPlugin("team-management")?.routes[0]).toMatchObject({
      path: "/company/members",
      permissions: ["workspace.members.read"]
    });
  });

  it("is exposed to member readers without granting management actions", () => {
    registerBuiltInPlugins();

    expect(getAuthorizedPlugins(["workspace.members.read"], []).map((plugin) => plugin.id))
      .toContain("team-management");
    expect(getAuthorizedPlugins(["workspace.members.manage"], []).map((plugin) => plugin.id))
      .not.toContain("team-management");
  });
});
