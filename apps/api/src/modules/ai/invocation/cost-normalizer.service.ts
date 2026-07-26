import { Injectable } from "@nestjs/common";
import type { AiCostContract, AiUsageContract } from "../contracts";

export interface ModelPricing {
  inputCostPerMillion: string;
  outputCostPerMillion: string;
  currency: string;
}

@Injectable()
export class CostNormalizerService {
  normalize(usage: AiUsageContract, pricing: ModelPricing): AiCostContract {
    const inputCost = this.calculate(usage.inputTokens, pricing.inputCostPerMillion);
    const outputCost = this.calculate(usage.outputTokens, pricing.outputCostPerMillion);
    return {
      inputCost: this.format(inputCost),
      outputCost: this.format(outputCost),
      totalCost: this.format(inputCost + outputCost),
      currency: pricing.currency
    };
  }

  private calculate(tokens: number, price: string): bigint {
    const millionthUnits = this.parseDecimal(price);
    return (BigInt(tokens) * millionthUnits + 500_000n) / 1_000_000n;
  }

  private parseDecimal(value: string): bigint {
    const match = /^(\d+)(?:\.(\d{0,6}))?$/.exec(value);
    if (!match) throw new Error("Invalid model pricing");
    return BigInt(match[1]!) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
  }

  private format(value: bigint): string {
    const integer = value / 1_000_000n;
    const fraction = (value % 1_000_000n).toString().padStart(6, "0");
    return `${integer}.${fraction}`;
  }
}
