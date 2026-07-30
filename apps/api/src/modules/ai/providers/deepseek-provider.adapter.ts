import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
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

export const DEEPSEEK_CAPABILITIES = Object.freeze({
  chatCompletions: true,
  streaming: false,
  tools: false,
  functionCalling: false,
  structuredOutput: false,
  vision: false,
  contextWindowTokens: 65_536,
  maximumOutputTokens: 8_192
});

@Injectable()
export class DeepSeekProviderAdapter implements AiProviderAdapter {
  readonly providerName = "DeepSeek";
  readonly contractVersion = "1.0";
  readonly capabilities = DEEPSEEK_CAPABILITIES;
  readonly promptCache = unsupportedProviderPromptCache;

  constructor(private readonly http: ProviderHttpClient) {}

  supportsModel(modelName: string): boolean {
    return /^deepseek-chat(?:[-.:][A-Za-z0-9._-]+)?$/.test(modelName);
  }

  async invoke(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential
  ): Promise<ProviderExecutionResult> {
    if (!this.supportsModel(request.modelName)) {
      throw new AiContractError(
        "INVALID_REQUEST", "DeepSeek adapter requires a compatible DeepSeek Chat model"
      );
    }
    if (request.maxOutputTokens > this.capabilities.maximumOutputTokens) {
      throw new AiContractError(
        "CONTEXT_LIMIT_EXCEEDED", "DeepSeek output token limit exceeds model capability"
      );
    }
    let response;
    try {
      response = await this.http.postJson({
        provider: this.providerName,
        url: `${(request.apiBaseUrl ?? "https://api.deepseek.com").replace(/\/$/, "")}` +
          "/chat/completions",
        authorization: `Bearer ${credential.secret}`,
        body: JSON.stringify({
          model: request.modelName,
          messages: request.messages,
          max_tokens: request.maxOutputTokens,
          stream: false
        }),
        signal: request.signal
      });
    } catch (error: unknown) {
      return normalizeTransportError(error, request.signal);
    }
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    return normalizeOpenAiCompatibleResponse(response, request);
  }

  stream(request: ProviderExecutionRequest, credential: ProviderExecutionCredential, emit: Parameters<NonNullable<AiProviderAdapter["stream"]>>[2]) {
    if (!this.supportsModel(request.modelName)) throw new AiContractError("INVALID_REQUEST", "DeepSeek adapter requires a compatible DeepSeek Chat model");
    return streamOpenAiCompatible({ http: this.http, provider: this.providerName,
      url: `${(request.apiBaseUrl ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`,
      authorization: `Bearer ${credential.secret}`, request, credential, emit });
  }
}
