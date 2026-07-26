import { Injectable } from "@nestjs/common";
import { CapabilityResolver } from "./capability.resolver";
import { HealthResolver } from "./health.resolver";
import type { RoutingCandidate, RoutingRequirements } from "./routing.types";

@Injectable()
export class EligibilityResolver {
  constructor(
    private readonly capabilities: CapabilityResolver,
    private readonly health: HealthResolver
  ) {}

  filter(
    candidates: readonly RoutingCandidate[],
    requirements: RoutingRequirements
  ): RoutingCandidate[] {
    return candidates.filter(
      (candidate) =>
        candidate.workspaceId === requirements.workspaceId &&
        candidate.configured &&
        candidate.enabled &&
        candidate.credentialExists &&
        this.health.isHealthy(candidate) &&
        this.capabilities.matches(candidate.capabilities, requirements)
    );
  }
}
