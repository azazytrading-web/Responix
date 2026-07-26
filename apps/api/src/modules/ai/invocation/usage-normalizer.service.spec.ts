import { AiContractError } from "../contracts";
import { UsageNormalizerService } from "./usage-normalizer.service";

describe("UsageNormalizerService", () => {
  const service = new UsageNormalizerService();

  it("normalizes provider token counts", () => {
    expect(
      service.normalize({
        inputTokens: 100,
        outputTokens: 25,
        cachedTokens: 40
      })
    ).toEqual({
      inputTokens: 100,
      outputTokens: 25,
      cachedTokens: 40,
      totalTokens: 125
    });
  });

  it("rejects invalid provider usage", () => {
    expect(() => service.normalize({ inputTokens: -1, outputTokens: 1 })).toThrow(AiContractError);
    expect(() =>
      service.normalize({
        inputTokens: 1,
        outputTokens: 1,
        cachedTokens: 2
      })
    ).toThrow(AiContractError);
  });
});
