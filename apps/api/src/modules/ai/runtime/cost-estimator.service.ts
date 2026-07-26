import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NormalizedInvocationRequest } from "../contracts";
import type { RuntimeEstimate } from "./runtime.types";

@Injectable()
export class CostEstimator {
  constructor(private readonly config: ConfigService) {}

  estimate(
    request: NormalizedInvocationRequest,
    outputTokens = this.config.getOrThrow<number>("ai.runtime.expectedOutputTokens")
  ): RuntimeEstimate {
    const charactersPerToken = this.config.getOrThrow<number>(
      "ai.runtime.tokenEstimationCharactersPerToken"
    );
    const inputCharacters = request.messages.reduce(
      (total, message) => total + message.role.length + message.content.length,
      0
    );
    const inputTokens = Math.max(1, Math.ceil(inputCharacters / charactersPerToken));
    const totalTokens = inputTokens + outputTokens;
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: this.estimateCost(totalTokens)
    };
  }

  private estimateCost(tokens: number): string {
    const price = this.parseDecimal(
      this.config.getOrThrow<string>("ai.runtime.estimatedCostPerMillionTokens")
    );
    const cost = (BigInt(tokens) * price + 500_000n) / 1_000_000n;
    return this.formatDecimal(cost);
  }

  private parseDecimal(value: string): bigint {
    const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(value);
    if (!match) throw new Error("Invalid runtime cost estimate configuration");
    return BigInt(match[1]!) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
  }

  private formatDecimal(value: bigint): string {
    return `${value / 1_000_000n}.${(value % 1_000_000n)
      .toString()
      .padStart(6, "0")}`;
  }
}
