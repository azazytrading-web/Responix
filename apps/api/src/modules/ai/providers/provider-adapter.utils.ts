import { AiContractError } from "../contracts";
import {
  ProviderDestinationRejectedError
} from "../security/provider-destination-policy.service";
import {
  ProviderNetworkTimeoutError, ProviderResponseTooLargeError
} from "../security/provider-http-client.service";

export function normalizeTransportError(error: unknown, signal: AbortSignal): never {
  if (signal.aborted) {
    const cancelled = new Error("AI provider request cancelled");
    cancelled.name = "AbortError";
    throw cancelled;
  }
  if (error instanceof ProviderDestinationRejectedError) {
    throw new AiContractError("PROVIDER_UNAVAILABLE", "Provider destination rejected.");
  }
  if (error instanceof ProviderResponseTooLargeError) {
    throw new AiContractError("RESPONSE_INVALID", "AI provider response exceeded size limit");
  }
  if (error instanceof ProviderNetworkTimeoutError) {
    throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider request timed out");
  }
  if (error instanceof AiContractError) throw error;
  throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider request failed");
}

export function normalizeHttpStatus(status: number): never {
  if (status === 401 || status === 403) {
    throw new AiContractError("AUTHENTICATION_FAILED", "AI provider authentication failed");
  }
  if (status === 408 || status === 409 || status === 429) {
    throw new AiContractError(
      status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
      status === 429 ? "AI provider rate limit exceeded" : "AI provider request could not be completed"
    );
  }
  throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable");
}

export function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AiContractError("RESPONSE_INVALID", "AI provider returned invalid JSON");
  }
}

export function assertTokenLimit(outputTokens: number, maximum: number): void {
  if (outputTokens > maximum) {
    throw new AiContractError("RESPONSE_INVALID", "AI provider output exceeded the reserved token limit");
  }
}
