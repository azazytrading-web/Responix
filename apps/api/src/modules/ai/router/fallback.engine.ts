import { Injectable } from "@nestjs/common";
import { PriorityEngine } from "./priority.engine";
import type { RoutingCandidate } from "./routing.types";

@Injectable()
export class FallbackEngine {
  constructor(private readonly priority: PriorityEngine) {}

  order(candidates: readonly RoutingCandidate[], selected: RoutingCandidate): RoutingCandidate[] {
    return this.priority
      .order(candidates)
      .filter(
        (candidate) =>
          candidate.providerId !== selected.providerId || candidate.modelId !== selected.modelId
      );
  }
}
