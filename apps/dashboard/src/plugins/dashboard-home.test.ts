import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getAuthorizedPlugins,
  getPlugin,
  registerBuiltInPlugins
} from ".";

describe("dashboard home plugin", () => {
  beforeEach(() => clearRegistry());

  it("registers idempotently with the canonical route and permission", () => {
    registerBuiltInPlugins();
    registerBuiltInPlugins();

    const plugin = getPlugin("dashboard-home");
    expect(plugin?.routes).toHaveLength(1);
    expect(plugin?.routes[0]).toMatchObject({
      path: "/",
      permissions: ["platform.read"]
    });
  });

  it("is exposed only when platform.read is available", () => {
    registerBuiltInPlugins();

    expect(getAuthorizedPlugins([], [])).toEqual([]);
    expect(getAuthorizedPlugins(["platform.read"], []).map((plugin) => plugin.id))
      .toEqual(["dashboard-home"]);
  });
});
