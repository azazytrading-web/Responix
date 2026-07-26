import { Injectable } from "@nestjs/common";
import type { RoutingCandidate } from "./routing.types";

@Injectable()
export class HealthResolver {
  isHealthy(candidate: RoutingCandidate): boolean {
    return (
      candidate.providerStatus === "ACTIVE" &&
      candidate.modelStatus === "ACTIVE" &&
      candidate.latestHealth?.available !== false
    );
  }
}
