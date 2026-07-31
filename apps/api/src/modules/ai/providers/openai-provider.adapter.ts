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
import { unsupportedProviderPromptCache } from "./provider-prompt-cache.interface";
import { streamOpenAiCompatible } from "./openai-compatible-stream";
import { openAiCompatibleTools } from "./openai-compatible";

const openAiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable(), tool_calls: z.array(z.object({
          id: z.string(), function: z.object({ name: z.string(), arguments: z.string() })
        })).optional() }),
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
  readonly contractVersion = "1.0";
  readonly promptCache = unsupportedProviderPromptCache;

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
          max_tokens: request.maxOutputTokens,
          ...(request.tools?.length ? { tools: openAiCompatibleTools(request) } : {})
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
    const toolCalls = (choice.message.tool_calls ?? []).map((call) => {
        let value: unknown;
        try { value = JSON.parse(call.function.arguments) as unknown; }
        catch { throw new AiContractError("RESPONSE_INVALID", "AI provider returned invalid tool arguments"); }
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new AiContractError("RESPONSE_INVALID", "AI provider returned invalid tool arguments");
        }
        return { id: call.id, name: call.function.name, arguments: value as Record<string, unknown>,
          status: "pending" as const };
      });
    return {
      content: choice.message.content ?? "",
      ...(toolCalls.length ? { toolCalls } : {}),
      ...(choice.finish_reason ? { finishReason: choice.finish_reason } : {}),
      usage: {
        inputTokens: parsed.data.usage.prompt_tokens,
        outputTokens: parsed.data.usage.completion_tokens,
        cachedTokens: parsed.data.usage.prompt_tokens_details?.cached_tokens ?? 0
      }
    };
  }

  stream(request: ProviderExecutionRequest, credential: ProviderExecutionCredential, emit: Parameters<NonNullable<AiProviderAdapter["stream"]>>[2]) {
    return streamOpenAiCompatible({ http: this.http, provider: this.providerName,
      url: `${(request.apiBaseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      authorization: `Bearer ${credential.secret}`, request, credential, emit });
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
