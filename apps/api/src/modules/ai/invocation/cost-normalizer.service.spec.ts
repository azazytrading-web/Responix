import { CostNormalizerService } from "./cost-normalizer.service";

describe("CostNormalizerService", () => {
  it("calculates deterministic six-decimal costs from per-million pricing", () => {
    const service = new CostNormalizerService();

    expect(
      service.normalize(
        {
          inputTokens: 1_000,
          outputTokens: 500,
          cachedTokens: 0,
          totalTokens: 1_500
        },
        {
          inputCostPerMillion: "2.500000",
          outputCostPerMillion: "10.000000",
          currency: "USD"
        }
      )
    ).toEqual({
      inputCost: "0.002500",
      outputCost: "0.005000",
      totalCost: "0.007500",
      currency: "USD"
    });
  });
});
