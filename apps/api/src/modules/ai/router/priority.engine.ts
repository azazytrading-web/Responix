import { Injectable } from "@nestjs/common";
import type { RoutingCandidate } from "./routing.types";

@Injectable()
export class PriorityEngine {
  order(candidates: readonly RoutingCandidate[]): RoutingCandidate[] {
    return [...candidates].sort(
      (left, right) =>
        right.providerPriority - left.providerPriority ||
        right.modelPriority - left.modelPriority ||
        right.credentialPriority - left.credentialPriority ||
        left.providerId.localeCompare(right.providerId) ||
        left.modelId.localeCompare(right.modelId)
    );
  }

  select(candidates: readonly RoutingCandidate[]): RoutingCandidate | undefined {
    return this.order(candidates)[0];
  }
}
