import { AiContractError } from "../contracts";
import { ErrorNormalizerService, InvocationTimeoutError } from "./error-normalizer.service";

describe("ErrorNormalizerService", () => {
  const service = new ErrorNormalizerService();

  it("classifies timeout, blocked, provider, and unknown failures", () => {
    expect(service.normalize(new InvocationTimeoutError())).toEqual({
      code: "PROVIDER_UNAVAILABLE",
      message: "AI provider request timed out",
      status: "FAILED"
    });
    expect(service.normalize(new AiContractError("SAFETY_BLOCKED", "Blocked"))).toEqual({
      code: "SAFETY_BLOCKED",
      message: "Blocked",
      status: "BLOCKED"
    });
    expect(service.normalize(new Error("provider payload"))).toEqual({
      code: "UNKNOWN",
      message: "AI invocation failed",
      status: "FAILED"
    });
  });
});
