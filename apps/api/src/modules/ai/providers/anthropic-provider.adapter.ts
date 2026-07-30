import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { AiContractError } from "../contracts";
import type {
  ProviderExecutionCredential, ProviderExecutionRequest, ProviderExecutionResult
} from "../contracts";
import { ProviderHttpClient } from "../security/provider-http-client.service";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import {
  assertTokenLimit, normalizeHttpStatus, normalizeTransportError, parseJson
} from "./provider-adapter.utils";
import { unsupportedProviderPromptCache } from "./provider-prompt-cache.interface";
import type { ProviderStreamEvent } from "../contracts";

const schema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).min(1),
  stop_reason: z.string().nullable().optional(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cache_read_input_tokens: z.number().int().nonnegative().optional()
  })
});

@Injectable()
export class AnthropicProviderAdapter implements AiProviderAdapter {
  readonly providerName = "Claude";
  readonly contractVersion = "1.0";
  readonly promptCache = unsupportedProviderPromptCache;
  constructor(private readonly http: ProviderHttpClient) {}
  async invoke(request: ProviderExecutionRequest, credential: ProviderExecutionCredential):
  Promise<ProviderExecutionResult> {
    const system = request.messages.filter(({ role }) => role === "system")
      .map(({ content }) => content).join("\n\n");
    const messages = request.messages.filter(({ role }) => role !== "system")
      .map(({ role, content }) => ({ role: role === "assistant" ? "assistant" : "user", content }));
    let response;
    try {
      response = await this.http.postJson({
        provider: this.providerName,
        url: `${(request.apiBaseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "")}/messages`,
        headers: { "x-api-key": credential.secret, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: request.modelName, max_tokens: request.maxOutputTokens,
          ...(system ? { system } : {}), messages
        }),
        signal: request.signal
      });
    } catch (error: unknown) { return normalizeTransportError(error, request.signal); }
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    const parsed = schema.safeParse(parseJson(response.body));
    if (!parsed.success) throw new AiContractError("RESPONSE_INVALID", "AI provider response was invalid");
    assertTokenLimit(parsed.data.usage.output_tokens, request.maxOutputTokens);
    return {
      content: parsed.data.content.map(({ text }) => text ?? "").join(""),
      ...(parsed.data.stop_reason ? { finishReason: parsed.data.stop_reason } : {}),
      usage: {
        inputTokens: parsed.data.usage.input_tokens,
        outputTokens: parsed.data.usage.output_tokens,
        cachedTokens: parsed.data.usage.cache_read_input_tokens ?? 0
      }
    };
  }
  async stream(request: ProviderExecutionRequest, credential: ProviderExecutionCredential, emit: (event: ProviderStreamEvent) => Promise<void>): Promise<void> {
    const system = request.messages.filter(({ role }) => role === "system").map(({ content }) => content).join("\n\n");
    const messages = request.messages.filter(({ role }) => role !== "system").map(({ role, content }) => ({ role: role === "assistant" ? "assistant" : "user", content }));
    let terminal = false;
    let inputTokens: number | undefined;
    let cachedTokens: number | undefined;
    try {
      const response = await this.http.postSse({ provider: this.providerName,
        url: `${(request.apiBaseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "")}/messages`,
        headers: { "x-api-key": credential.secret, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: request.modelName, max_tokens: request.maxOutputTokens, stream: true, ...(system ? { system } : {}), messages }), signal: request.signal,
        onEvent: async ({ event, data }) => {
          const value = JSON.parse(data) as { type?: string; delta?: { text?: string; stop_reason?: string }; message?: { usage?: { input_tokens?: number; cache_read_input_tokens?: number } }; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number } };
          if (event === "message_start") {
            inputTokens = value.message?.usage?.input_tokens;
            cachedTokens = value.message?.usage?.cache_read_input_tokens;
          }
          if (event === "content_block_delta" && value.delta?.text) await emit({ type: "delta", content: value.delta.text, role: "assistant" });
          if (event === "message_delta") await emit({ type: "delta", ...(value.delta?.stop_reason ? { finishReason: value.delta.stop_reason } : {}) });
          if (event === "message_stop") terminal = true;
          if (event === "message_delta" && value.usage?.output_tokens !== undefined) {
            await emit({ type: "completed", usage: {
              ...(inputTokens !== undefined ? { inputTokens } : {}),
              outputTokens: value.usage.output_tokens,
              ...(cachedTokens !== undefined ? { cachedTokens } : {})
            } });
          }
        } });
      if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    } catch (error: unknown) { return normalizeTransportError(error, request.signal); }
    if (!terminal) throw new AiContractError("RESPONSE_INVALID", "Anthropic stream ended without message_stop");
  }
}
