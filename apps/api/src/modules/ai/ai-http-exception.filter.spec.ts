import type { ArgumentsHost } from "@nestjs/common";
import { AiHttpExceptionFilter } from "./ai-http-exception.filter";
import { AiContractError } from "./contracts";

describe("AiHttpExceptionFilter", () => {
  it("maps internal errors to stable responses without sensitive metadata", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: "request-id" }),
        getResponse: () => ({ status })
      })
    } as unknown as ArgumentsHost;

    new AiHttpExceptionFilter().catch(
      new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable", {
        secret: "provider-secret",
        stack: "internal-stack"
      }),
      host
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      code: "PROVIDER_UNAVAILABLE",
      message: "AI provider is unavailable",
      requestId: "request-id"
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain("provider-secret");
    expect(JSON.stringify(json.mock.calls)).not.toContain("internal-stack");
  });

  it("redacts provider secret canaries from HTTP failures", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: "request-id" }),
        getResponse: () => ({ status })
      })
    };

    new AiHttpExceptionFilter().catch(
      new AiContractError(
        "PROVIDER_UNAVAILABLE",
        "Provider failed secret=FORTRESS_PROVIDER_CANARY"
      ),
      host as never
    );

    const calls = json.mock.calls as unknown[][];
    expect(JSON.stringify(calls[0]?.[0])).not.toContain(
      "FORTRESS_PROVIDER_CANARY"
    );
  });
});
