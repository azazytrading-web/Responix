import { CapabilityResolver } from "./capability.resolver";
import { routingCandidate } from "./routing.test-fixtures";

describe("CapabilityResolver", () => {
  const resolver = new CapabilityResolver();
  const capabilities = routingCandidate().capabilities;

  it("matches every requested model capability", () => {
    expect(
      resolver.matches(capabilities, {
        workspaceId: "workspace-id",
        minimumContextWindow: 16_000,
        minimumOutputTokens: 2_048,
        vision: true,
        tools: true,
        streaming: true
      })
    ).toBe(true);
  });

  it("rejects missing capabilities and insufficient token limits", () => {
    expect(
      resolver.matches(capabilities, {
        workspaceId: "workspace-id",
        audio: true
      })
    ).toBe(false);
    expect(
      resolver.matches(capabilities, {
        workspaceId: "workspace-id",
        minimumOutputTokens: 8_192
      })
    ).toBe(false);
  });
});
