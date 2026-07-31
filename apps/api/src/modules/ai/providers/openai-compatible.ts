import { z } from "zod";
import { AiContractError } from "../contracts";
import type { ProviderExecutionRequest, ProviderExecutionResult } from "../contracts";
import type { ProviderHttpResponse } from "../security/provider-http-client.service";
import { assertTokenLimit, parseJson } from "./provider-adapter.utils";

const schema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable(), tool_calls: z.array(z.object({
      id: z.string(), function: z.object({ name: z.string(), arguments: z.string() })
    })).optional() }),
    finish_reason: z.string().nullable().optional()
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    prompt_cache_hit_tokens: z.number().int().nonnegative().optional(),
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
  const toolCalls = (choice.message.tool_calls ?? []).map((call) => ({ id: call.id,
    name: call.function.name, arguments: parseToolArguments(call.function.arguments), status: "pending" as const }));
  return {
    content: choice.message.content ?? "",
    ...(toolCalls.length ? { toolCalls } : {}),
    ...(choice.finish_reason ? { finishReason: choice.finish_reason } : {}),
    usage: {
      inputTokens: parsed.data.usage.prompt_tokens,
      outputTokens: parsed.data.usage.completion_tokens,
      cachedTokens: parsed.data.usage.prompt_tokens_details?.cached_tokens ??
        parsed.data.usage.prompt_cache_hit_tokens ?? 0
    }
  };
}

export function openAiCompatibleTools(request: ProviderExecutionRequest) {
  return request.tools?.map((tool) => ({ type: "function", function: {
    name: tool.name, description: tool.description, parameters: tool.inputSchema
  } }));
}

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* normalized below */ }
  throw new AiContractError("RESPONSE_INVALID", "AI provider returned invalid tool arguments");
}
