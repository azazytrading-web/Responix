import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { AiContractError } from "../contracts";
import type {
  ProviderExecutionCredential,
  ProviderExecutionRequest,
  ProviderExecutionResult
} from "../contracts";
import type { AiProviderAdapter } from "./provider-adapter.interface";

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

  async invoke(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential
  ): Promise<ProviderExecutionResult> {
    let response: Response;
    try {
      response = await fetch(
        `${(request.apiBaseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${credential.secret}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: request.modelName,
            messages: request.messages
          }),
          signal: request.signal
        }
      );
    } catch (error: unknown) {
      if (request.signal.aborted) throw error;
      throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider request failed");
    }
    if (!response.ok) throw this.httpError(response.status);

    let payload: unknown;
    try {
      payload = await response.json();
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
