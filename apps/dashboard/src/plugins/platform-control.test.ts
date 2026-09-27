import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRegistry,
  getAuthorizedPlugins,
  getPlugin,
  registerBuiltInPlugins
} from ".";

describe("platform control plugin", () => {
  beforeEach(() => clearRegistry());

  it("registers idempotently with the approved route and permission", () => {
    registerBuiltInPlugins();
    registerBuiltInPlugins();

    expect(getPlugin("platform-control")?.routes[0]).toMatchObject({
      path: "/platform",
      permissions: ["platform.configure"]
    });
  });

  it("is exposed only when platform.configure is available", () => {
    registerBuiltInPlugins();

    expect(getAuthorizedPlugins(["platform.read"], []).map((plugin) => plugin.id))
      .not.toContain("platform-control");
    expect(getAuthorizedPlugins(["platform.configure"], []).map((plugin) => plugin.id))
      .toContain("platform-control");
  });
});
