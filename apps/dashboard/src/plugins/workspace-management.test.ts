import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getAuthorizedPlugins,
  getPlugin,
  registerBuiltInPlugins
} from ".";

describe("workspace management plugin", () => {
  beforeEach(() => clearRegistry());

  it("registers idempotently with the backend-authorized route and permission", () => {
    registerBuiltInPlugins();
    registerBuiltInPlugins();

    expect(getPlugin("workspace-management")?.routes[0]).toMatchObject({
      path: "/company",
      permissions: ["workspace.read"]
    });
  });

  it("is exposed only when workspace.read is available", () => {
    registerBuiltInPlugins();

    expect(getAuthorizedPlugins(["platform.read"], []).map((plugin) => plugin.id))
      .toEqual(["dashboard-home"]);
    expect(getAuthorizedPlugins(["workspace.read"], []).map((plugin) => plugin.id))
      .toEqual(["workspace-management"]);
  });
});
