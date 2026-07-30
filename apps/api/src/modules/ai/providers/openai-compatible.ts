import { z } from "zod";
import { AiContractError } from "../contracts";
import type { ProviderExecutionRequest, ProviderExecutionResult } from "../contracts";
import type { ProviderHttpResponse } from "../security/provider-http-client.service";
import { assertTokenLimit, parseJson } from "./provider-adapter.utils";

const schema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
    finish_reason: z.string().nullable().optional()
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    prompt_tokens_details: z.object({
      cached_tokens: z.number().int().nonnegative().optional()
    }).optional()
  })
});

export function normalizeOpenAiCompatibleResponse(
  response: ProviderHttpResponse, request: ProviderExecutionRequest
): ProviderExecutionResult {
  const parsed = schema.safeParse(parseJson(response.body));
  if (!parsed.success) throw new AiContractError("RESPONSE_INVALID", "AI provider response was invalid");
  const choice = parsed.data.choices[0];
  if (!choice) throw new AiContractError("RESPONSE_INVALID", "AI provider response was empty");
  assertTokenLimit(parsed.data.usage.completion_tokens, request.maxOutputTokens);
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
