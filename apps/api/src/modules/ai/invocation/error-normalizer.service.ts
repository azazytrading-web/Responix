import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { AiErrorCode } from "../contracts";

export class InvocationTimeoutError extends Error {
  constructor() {
    super("AI provider request timed out");
    this.name = "InvocationTimeoutError";
  }
}

export interface NormalizedInvocationError {
  code: AiErrorCode;
  message: string;
  status: "FAILED" | "BLOCKED";
}

@Injectable()
export class ErrorNormalizerService {
  normalize(error: unknown): NormalizedInvocationError {
    if (error instanceof InvocationTimeoutError) {
      return {
        code: "PROVIDER_UNAVAILABLE",
        message: error.message,
        status: "FAILED"
      };
    }
    if (error instanceof AiContractError) {
      return {
        code: error.code,
        message: error.message,
        status:
          error.code === "SAFETY_BLOCKED" || error.code === "AUTHORIZATION_FAILED"
            ? "BLOCKED"
            : "FAILED"
      };
    }
    return {
      code: "UNKNOWN",
      message: "AI invocation failed",
      status: "FAILED"
    };
  }
}
