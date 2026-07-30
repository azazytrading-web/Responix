import { Injectable } from "@nestjs/common";
import type {
  ProviderExecutionCredential, ProviderExecutionRequest, ProviderExecutionResult
} from "../contracts";
import { ProviderHttpClient } from "../security/provider-http-client.service";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import {
  normalizeHttpStatus, normalizeTransportError
} from "./provider-adapter.utils";
import { normalizeOpenAiCompatibleResponse } from "./openai-compatible";
import { unsupportedProviderPromptCache } from "./provider-prompt-cache.interface";
import { streamOpenAiCompatible } from "./openai-compatible-stream";

@Injectable()
export class OpenRouterProviderAdapter implements AiProviderAdapter {
  readonly providerName = "OpenRouter";
  readonly contractVersion = "1.0";
  readonly promptCache = unsupportedProviderPromptCache;
  constructor(private readonly http: ProviderHttpClient) {}
  async invoke(request: ProviderExecutionRequest, credential: ProviderExecutionCredential):
  Promise<ProviderExecutionResult> {
    let response;
    try {
      response = await this.http.postJson({
        provider: this.providerName,
        url: `${(request.apiBaseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "")}` +
          "/chat/completions",
        authorization: `Bearer ${credential.secret}`,
        body: JSON.stringify({
          model: request.modelName, messages: request.messages,
          max_tokens: request.maxOutputTokens
        }),
        signal: request.signal
      });
    } catch (error: unknown) { return normalizeTransportError(error, request.signal); }
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    return normalizeOpenAiCompatibleResponse(response, request);
  }
  stream(request: ProviderExecutionRequest, credential: ProviderExecutionCredential, emit: Parameters<NonNullable<AiProviderAdapter["stream"]>>[2]) {
    return streamOpenAiCompatible({ http: this.http, provider: this.providerName,
      url: `${(request.apiBaseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "")}/chat/completions`,
      authorization: `Bearer ${credential.secret}`, request, credential, emit });
  }
}
