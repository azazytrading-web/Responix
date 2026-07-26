import { Injectable } from "@nestjs/common";
import type { AiModelCapabilityContract } from "../contracts";
import type { RoutingRequirements } from "./routing.types";

@Injectable()
export class CapabilityResolver {
  matches(capabilities: AiModelCapabilityContract, requirements: RoutingRequirements): boolean {
    if (
      requirements.minimumContextWindow !== undefined &&
      capabilities.contextWindow < requirements.minimumContextWindow
    ) {
      return false;
    }
    if (
      requirements.minimumOutputTokens !== undefined &&
      (capabilities.maxOutputTokens === undefined ||
        capabilities.maxOutputTokens < requirements.minimumOutputTokens)
    ) {
      return false;
    }
    return (
      (!requirements.vision || capabilities.supportsVision) &&
      (!requirements.audio || capabilities.supportsAudio) &&
      (!requirements.tools || capabilities.supportsTools) &&
      (!requirements.reasoning || capabilities.supportsReasoning) &&
      (!requirements.streaming || capabilities.supportsStreaming)
    );
  }
}
