import { Injectable } from "@nestjs/common";
import type {
  ProviderExecutionCredential, ProviderExecutionRequest, ProviderExecutionResult
} from "../contracts";
import { ProviderHttpClient } from "../security/provider-http-client.service";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import {
  normalizeHttpStatus, normalizeTransportError
} from "./provider-adapter.utils";
import { normalizeOpenAiCompatibleResponse, openAiCompatibleTools } from "./openai-compatible";
import { streamOpenAiCompatible } from "./openai-compatible-stream";

@Injectable()
export class AzureOpenAiProviderAdapter implements AiProviderAdapter {
  readonly providerName = "Azure OpenAI";
  readonly contractVersion = "1.0";
  constructor(private readonly http: ProviderHttpClient) {}
  async invoke(request: ProviderExecutionRequest, credential: ProviderExecutionCredential):
  Promise<ProviderExecutionResult> {
    if (!request.apiBaseUrl) {
      throw new Error("Azure OpenAI requires a configured HTTPS endpoint");
    }
    let response;
    try {
      const base = request.apiBaseUrl.replace(/\/$/, "");
      response = await this.http.postJson({
        provider: this.providerName,
        url: `${base}/openai/deployments/${encodeURIComponent(request.modelName)}` +
          "/chat/completions?api-version=2024-10-21",
        headers: { "api-key": credential.secret },
        body: JSON.stringify({
          messages: request.messages, max_tokens: request.maxOutputTokens,
          ...(request.tools?.length ? { tools: openAiCompatibleTools(request) } : {})
        }),
        signal: request.signal
      });
    } catch (error: unknown) { return normalizeTransportError(error, request.signal); }
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    return normalizeOpenAiCompatibleResponse(response, request);
  }
  stream(request: ProviderExecutionRequest, credential: ProviderExecutionCredential, emit: Parameters<NonNullable<AiProviderAdapter["stream"]>>[2]) {
    if (!request.apiBaseUrl) throw new Error("Azure OpenAI requires a configured HTTPS endpoint");
    const base = request.apiBaseUrl.replace(/\/$/, "");
    return streamOpenAiCompatible({ http: this.http, provider: this.providerName,
      url: `${base}/openai/deployments/${encodeURIComponent(request.modelName)}/chat/completions?api-version=2024-10-21`,
      headers: { "api-key": credential.secret }, request, credential, emit });
  }
}
