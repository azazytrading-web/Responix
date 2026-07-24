export interface AiUsageContract {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

export interface AiCostContract {
  inputCost: string;
  outputCost: string;
  totalCost: string;
  currency: string;
}
