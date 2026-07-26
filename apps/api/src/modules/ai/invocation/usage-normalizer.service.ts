import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { AiUsageContract, ProviderExecutionResult } from "../contracts";

@Injectable()
export class UsageNormalizerService {
  normalize(usage: ProviderExecutionResult["usage"]): AiUsageContract {
    const inputTokens = this.tokenCount(usage.inputTokens);
    const outputTokens = this.tokenCount(usage.outputTokens);
    const cachedTokens = this.tokenCount(usage.cachedTokens ?? 0);
    if (cachedTokens > inputTokens) {
      throw new AiContractError("RESPONSE_INVALID", "Provider usage was invalid");
    }
    return {
      inputTokens,
      outputTokens,
      cachedTokens,
      totalTokens: inputTokens + outputTokens
    };
  }

  private tokenCount(value: number): number {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new AiContractError("RESPONSE_INVALID", "Provider usage was invalid");
    }
    return value;
  }
}
