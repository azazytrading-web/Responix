import { AiContractError } from "../contracts";
import { CapabilityResolver } from "./capability.resolver";
import { EligibilityResolver } from "./eligibility.resolver";
import { FallbackEngine } from "./fallback.engine";
import { HealthResolver } from "./health.resolver";
import { PriorityEngine } from "./priority.engine";
import { RoutingService } from "./routing.service";
import { routingCandidate } from "./routing.test-fixtures";

describe("RoutingService", () => {
  const priority = new PriorityEngine();

  function service(candidates: ReturnType<typeof routingCandidate>[]) {
    return new RoutingService(
      { findCandidates: jest.fn().mockResolvedValue(candidates) } as never,
      new EligibilityResolver(new CapabilityResolver(), new HealthResolver()),
      priority,
      new FallbackEngine(priority)
    );
  }

  it("produces the same provider-neutral decision regardless of input order", async () => {
    const first = routingCandidate({
      providerId: "provider-a",
      modelId: "model-a",
      providerPriority: 10
    });
    const second = routingCandidate({
      providerId: "provider-b",
      modelId: "model-b",
      providerPriority: 20
    });

    const forward = await service([first, second]).route({
      workspaceId: "workspace-id"
    });
    const reverse = await service([second, first]).route({
      workspaceId: "workspace-id"
    });

    expect(forward).toEqual(reverse);
    expect(forward).toEqual(
      expect.objectContaining({
        providerId: "provider-b",
        modelId: "model-b",
        fallbacks: [{ providerId: "provider-a", modelId: "model-a" }]
      })
    );
  });

  it("fails without invoking a provider when no candidate is eligible", async () => {
    await expect(
      service([routingCandidate({ credentialExists: false })]).route({
        workspaceId: "workspace-id"
      })
    ).rejects.toBeInstanceOf(AiContractError);
  });
});
