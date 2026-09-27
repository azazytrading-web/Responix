import { beforeEach, describe, expect, it } from "vitest";
import { clearRegistry, getAuthorizedPlugins, getPlugin, registerBuiltInPlugins } from ".";

describe("knowledge base plugin", () => {
  beforeEach(() => clearRegistry());
  it("registers the Knowledge Base route idempotently", () => {
    registerBuiltInPlugins();
    registerBuiltInPlugins();
    expect(getPlugin("knowledge-base")?.routes[0]).toMatchObject({ path: "/knowledge", permissions: ["knowledge.base.read"] });
  });
  it("requires read permission for navigation", () => {
    registerBuiltInPlugins();
    expect(getAuthorizedPlugins(["knowledge.base.read"], []).map((p) => p.id)).toContain("knowledge-base");
    expect(getAuthorizedPlugins(["knowledge.base.write"], []).map((p) => p.id)).not.toContain("knowledge-base");
  });
});
