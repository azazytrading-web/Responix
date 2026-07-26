import { CostEstimator } from "./cost-estimator.service";

describe("CostEstimator", () => {
  it("estimates provider-neutral input, output, total tokens, and cost", () => {
    const values: Record<string, unknown> = {
      "ai.runtime.tokenEstimationCharactersPerToken": 4,
      "ai.runtime.expectedOutputTokens": 100,
      "ai.runtime.estimatedCostPerMillionTokens": "10.000000"
    };
    const estimator = new CostEstimator({
      getOrThrow: (key: string) => values[key]
    } as never);

    expect(
      estimator.estimate({
        requestId: "request-id",
        workspaceId: "workspace-id",
        membershipId: "membership-id",
        taskType: "completion",
        messages: [{ role: "user", content: "1234567890123456" }]
      })
    ).toEqual({
      inputTokens: 5,
      outputTokens: 100,
      totalTokens: 105,
      estimatedCost: "0.001050"
    });
  });
});
