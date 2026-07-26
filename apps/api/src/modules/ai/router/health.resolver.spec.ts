import { HealthResolver } from "./health.resolver";
import { routingCandidate } from "./routing.test-fixtures";

describe("HealthResolver", () => {
  const resolver = new HealthResolver();

  it("accepts active candidates with healthy or unknown health", () => {
    expect(resolver.isHealthy(routingCandidate())).toBe(true);
    expect(resolver.isHealthy(routingCandidate({ latestHealth: null }))).toBe(true);
  });

  it("rejects unhealthy providers and inactive models deterministically", () => {
    expect(
      resolver.isHealthy(
        routingCandidate({
          latestHealth: {
            available: false,
            checkedAt: new Date("2026-07-25T00:00:00.000Z")
          }
        })
      )
    ).toBe(false);
    expect(resolver.isHealthy(routingCandidate({ providerStatus: "UNHEALTHY" }))).toBe(false);
    expect(resolver.isHealthy(routingCandidate({ modelStatus: "DISABLED" }))).toBe(false);
  });
});
