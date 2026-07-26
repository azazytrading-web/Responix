import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { ProviderModel } from "../providers/provider.types";
import type { RuntimeEstimate, RuntimeLimits } from "./runtime.types";

@Injectable()
export class CapabilityValidator {
  validateWorkspaceEstimate(estimate: RuntimeEstimate, limits: RuntimeLimits): void {
    if (estimate.outputTokens > limits.maxOutputTokens) {
      throw new AiContractError(
        "CONTEXT_LIMIT_EXCEEDED",
        "Requested output exceeds the workspace runtime limit"
      );
    }
    if (estimate.totalTokens > limits.maxContextTokens) {
      throw new AiContractError(
        "CONTEXT_LIMIT_EXCEEDED",
        "Request exceeds the workspace context limit"
      );
    }
  }

  validateModel(estimate: RuntimeEstimate, model: ProviderModel): void {
    if (estimate.totalTokens > model.contextWindow) {
      throw new AiContractError("CONTEXT_LIMIT_EXCEEDED", "Request exceeds model context limit");
    }
    if (model.maxOutputTokens !== undefined && estimate.outputTokens > model.maxOutputTokens) {
      throw new AiContractError("CONTEXT_LIMIT_EXCEEDED", "Requested output exceeds model limit");
    }
  }
}
