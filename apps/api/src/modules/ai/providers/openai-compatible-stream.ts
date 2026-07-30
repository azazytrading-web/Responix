import { AiContractError } from "../contracts";
import type {
  ProviderExecutionCredential, ProviderExecutionRequest, ProviderStreamEvent
} from "../contracts";
import type { ProviderHttpClient } from "../security/provider-http-client.service";
import { normalizeHttpStatus, normalizeTransportError } from "./provider-adapter.utils";

export async function streamOpenAiCompatible(input: {
  http: ProviderHttpClient;
  provider: string;
  url: string;
  authorization?: string;
  headers?: Record<string, string>;
  request: ProviderExecutionRequest;
  credential: ProviderExecutionCredential;
  emit: (event: ProviderStreamEvent) => Promise<void>;
  body?: Record<string, unknown>;
}): Promise<void> {
  let terminal = false;
  let usage: ProviderStreamEvent["usage"] | undefined;
  try {
    const response = await input.http.postSse({
      provider: input.provider, url: input.url, authorization: input.authorization,
      headers: input.headers,
      body: JSON.stringify({
        model: input.request.modelName, messages: input.request.messages,
        max_tokens: input.request.maxOutputTokens, stream: true,
        stream_options: { include_usage: true }, ...input.body
      }), signal: input.request.signal,
      onEvent: async ({ data }) => {
        if (data === "[DONE]") { terminal = true; return; }
        let value: Record<string, unknown>;
        try { value = JSON.parse(data) as Record<string, unknown>; } catch {
          throw new AiContractError("RESPONSE_INVALID", "Provider sent invalid stream JSON");
        }
        const choices = Array.isArray(value.choices) ? value.choices : [];
        const choice = choices[0] as Record<string, unknown> | undefined;
        const delta = choice?.delta as Record<string, unknown> | undefined;
        const content = typeof delta?.content === "string" ? delta.content : undefined;
        const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined;
        const rawUsage = value.usage as Record<string, unknown> | undefined;
        if (rawUsage && typeof rawUsage.prompt_tokens === "number" && typeof rawUsage.completion_tokens === "number") {
          usage = { inputTokens: rawUsage.prompt_tokens, outputTokens: rawUsage.completion_tokens,
            cachedTokens: typeof (rawUsage.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens === "number" ? (rawUsage.prompt_tokens_details as Record<string, number>).cached_tokens : 0 };
        }
        if (content || finishReason) await input.emit({ type: "delta", ...(content ? { content } : {}), role: "assistant", ...(finishReason ? { finishReason } : {}) });
      }
    });
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
  } catch (error: unknown) { return normalizeTransportError(error, input.request.signal); }
  if (!terminal) throw new AiContractError("RESPONSE_INVALID", "Provider stream ended without a terminal event");
  await input.emit({ type: "completed", ...(usage ? { usage } : {}) });
}
