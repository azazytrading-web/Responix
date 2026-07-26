import { CapabilityResolver } from "./capability.resolver";
import { EligibilityResolver } from "./eligibility.resolver";
import { HealthResolver } from "./health.resolver";
import { routingCandidate } from "./routing.test-fixtures";

describe("EligibilityResolver", () => {
  const resolver = new EligibilityResolver(new CapabilityResolver(), new HealthResolver());

  it("keeps only configured, enabled, credentialed, healthy capability matches", () => {
    const eligible = routingCandidate();
    const result = resolver.filter(
      [
        eligible,
        routingCandidate({ modelId: "not-configured", configured: false }),
        routingCandidate({ modelId: "disabled", enabled: false }),
        routingCandidate({ modelId: "no-credential", credentialExists: false }),
        routingCandidate({
          modelId: "unhealthy",
          latestHealth: {
            available: false,
            checkedAt: new Date("2026-07-25T00:00:00.000Z")
          }
        }),
        routingCandidate({
          modelId: "no-audio",
          capabilities: {
            ...eligible.capabilities,
            modelId: "no-audio",
            supportsAudio: false
          }
        })
      ],
      { workspaceId: "workspace-id", audio: false }
    );

    expect(result.map(({ modelId }) => modelId)).toEqual(["model-a", "no-audio"]);
  });

  it("rejects candidates from another workspace", () => {
    expect(
      resolver.filter([routingCandidate({ workspaceId: "other-workspace" })], {
        workspaceId: "workspace-id"
      })
    ).toEqual([]);
  });
});
