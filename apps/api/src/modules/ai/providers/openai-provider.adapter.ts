import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { AiContractError } from "../contracts";
import type {
  ProviderExecutionCredential,
  ProviderExecutionRequest,
  ProviderExecutionResult
} from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import { ProviderDestinationRejectedError } from "../security/provider-destination-policy.service";
import {
  ProviderHttpClient,
  ProviderNetworkTimeoutError,
  ProviderResponseTooLargeError
} from "../security/provider-http-client.service";

const openAiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable().optional()
      })
    )
    .min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    prompt_tokens_details: z
      .object({ cached_tokens: z.number().int().nonnegative().optional() })
      .optional()
  })
});

@Injectable()
export class OpenAiProviderAdapter implements AiProviderAdapter {
  readonly providerName = "OpenAI";

  constructor(private readonly http: ProviderHttpClient) {}

  async invoke(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential
  ): Promise<ProviderExecutionResult> {
    let response: { status: number; body: string };
    try {
      response = await this.http.postJson({
        provider: this.providerName,
        url: `${(request.apiBaseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
        authorization: `Bearer ${credential.secret}`,
        body: JSON.stringify({
          model: request.modelName,
          messages: request.messages,
          max_tokens: request.maxOutputTokens
        }),
        signal: request.signal
      });
    } catch (error: unknown) {
      if (request.signal.aborted) throw error;
      if (error instanceof ProviderDestinationRejectedError) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "Provider destination rejected.");
      }
      if (error instanceof ProviderResponseTooLargeError) {
        throw new AiContractError("RESPONSE_INVALID", "AI provider response exceeded size limit");
      }
      if (error instanceof ProviderNetworkTimeoutError) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider request timed out");
      }
      throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider request failed");
    }
    if (response.status < 200 || response.status >= 300) throw this.httpError(response.status);

    let payload: unknown;
    try {
      payload = JSON.parse(response.body) as unknown;
    } catch {
      throw new AiContractError("RESPONSE_INVALID", "AI provider returned invalid JSON");
    }
    const parsed = openAiResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiContractError("RESPONSE_INVALID", "AI provider response was invalid");
    }
    const choice = parsed.data.choices[0];
    if (!choice) {
      throw new AiContractError("RESPONSE_INVALID", "AI provider response was empty");
    }
    if (parsed.data.usage.completion_tokens > request.maxOutputTokens) {
      throw new AiContractError(
        "RESPONSE_INVALID",
        "AI provider output exceeded the reserved token limit"
      );
    }
    return {
      content: choice.message.content ?? "",
      ...(choice.finish_reason ? { finishReason: choice.finish_reason } : {}),
      usage: {
        inputTokens: parsed.data.usage.prompt_tokens,
        outputTokens: parsed.data.usage.completion_tokens,
        cachedTokens: parsed.data.usage.prompt_tokens_details?.cached_tokens ?? 0
      }
    };
  }

  private httpError(status: number): AiContractError {
    if (status === 401 || status === 403) {
      return new AiContractError("AUTHENTICATION_FAILED", "AI provider authentication failed");
    }
    if (status === 429) {
      return new AiContractError("RATE_LIMITED", "AI provider rate limit exceeded");
    }
    return new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable");
  }
}
