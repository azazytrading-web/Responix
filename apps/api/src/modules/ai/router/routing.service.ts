import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import { EligibilityResolver } from "./eligibility.resolver";
import { FallbackEngine } from "./fallback.engine";
import { PriorityEngine } from "./priority.engine";
import { RoutingRepository } from "./routing.repository";
import type { RoutingCandidate, RoutingDecision, RoutingRequirements } from "./routing.types";

@Injectable()
export class RoutingService {
  constructor(
    private readonly repository: RoutingRepository,
    private readonly eligibility: EligibilityResolver,
    private readonly priority: PriorityEngine,
    private readonly fallback: FallbackEngine
  ) {}

  async route(requirements: RoutingRequirements): Promise<RoutingDecision> {
    const candidates = await this.repository.findCandidates(requirements.workspaceId);
    const eligible = this.eligibility.filter(candidates, requirements);
    const selected = this.priority.select(eligible);
    if (!selected) {
      throw new AiContractError(
        "CAPABILITY_UNAVAILABLE",
        "No eligible AI provider model is available"
      );
    }
    const fallbacks = this.fallback.order(eligible, selected);
    return {
      providerId: selected.providerId,
      modelId: selected.modelId,
      decisionFactors: {
        providerPriority: selected.providerPriority,
        modelPriority: selected.modelPriority,
        credentialPriority: selected.credentialPriority
      },
      candidateMetadata: this.candidateMetadata(eligible),
      fallbacks: fallbacks.map(({ providerId, modelId }) => ({
        providerId,
        modelId
      }))
    };
  }

  private candidateMetadata(candidates: readonly RoutingCandidate[]): Record<string, unknown>[] {
    return this.priority.order(candidates).map((candidate, index) => ({
      rank: index + 1,
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      providerPriority: candidate.providerPriority,
      modelPriority: candidate.modelPriority,
      credentialPriority: candidate.credentialPriority
    }));
  }
}
