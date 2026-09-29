import { Injectable } from "@nestjs/common";
import { AiContractError } from "../contracts";
import type { ProviderExecutionCredential, ProviderExecutionRequest, ProviderExecutionResult } from "../contracts";
import { ProviderHttpClient } from "../security/provider-http-client.service";
import type { AiProviderAdapter } from "./provider-adapter.interface";
import { normalizeOpenAiCompatibleResponse, openAiCompatibleTools } from "./openai-compatible";
import { normalizeHttpStatus, normalizeTransportError } from "./provider-adapter.utils";
import { streamOpenAiCompatible } from "./openai-compatible-stream";

export const OPENAI_CHAT_COMPLETIONS_V1_PROTOCOL = "openai-chat-completions-v1";

@Injectable()
export class OpenAiChatCompletionsV1Adapter implements AiProviderAdapter {
  readonly providerName = "OpenAI Compatible V1";
  readonly protocolId = OPENAI_CHAT_COMPLETIONS_V1_PROTOCOL;
  readonly contractVersion = "1.0";

  constructor(private readonly http: ProviderHttpClient) {}

  async invoke(request: ProviderExecutionRequest, credential: ProviderExecutionCredential): Promise<ProviderExecutionResult> {
    const customProvider = this.requireCustomProvider(request);
    this.requireToolCapability(request);
    let response;
    try {
      response = await this.http.postJson({
        provider: this.providerName,
        url: this.chatCompletionsUrl(request.apiBaseUrl),
        customProvider: {
          workspaceId: customProvider.workspaceId, providerId: customProvider.providerId,
          ...(customProvider.allowDisabledForValidation ? { allowDisabledForValidation: true } : {}),
          requiresTools: Boolean(request.tools?.length)
        },
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
      return normalizeTransportError(error, request.signal);
    }
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    const result = normalizeOpenAiCompatibleResponse(response, request, { usageOptional: true });
    if (result.toolCalls?.length && !request.tools?.length) {
      throw new AiContractError("RESPONSE_INVALID", "Provider returned unrequested tool calls");
    }
    return result;
  }

  stream(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential,
    emit: Parameters<NonNullable<AiProviderAdapter["stream"]>>[2]
  ): Promise<void> {
    const customProvider = this.requireCustomProvider(request);
    if (!customProvider.supportsStreaming) {
      throw new AiContractError("INVALID_REQUEST", "Custom Provider has not declared streaming support");
    }
    this.requireToolCapability(request);
    return streamOpenAiCompatible({
      http: this.http,
      provider: this.providerName,
      url: this.chatCompletionsUrl(request.apiBaseUrl),
      customProvider: {
        workspaceId: customProvider.workspaceId, providerId: customProvider.providerId,
        requiresStreaming: true, requiresTools: Boolean(request.tools?.length)
      },
      authorization: `Bearer ${credential.secret}`,
      request,
      credential,
      emit,
      allowToolCalls: Boolean(request.tools?.length && customProvider.supportsTools)
    });
  }

  private requireToolCapability(request: ProviderExecutionRequest): void {
    if (request.tools?.length && !request.customProvider?.supportsTools) {
      throw new AiContractError("INVALID_REQUEST", "Custom Provider has not declared tool support");
    }
  }

  private requireCustomProvider(request: ProviderExecutionRequest) {
    if (!request.customProvider?.workspaceId || !request.customProvider.providerId) {
      throw new AiContractError("PROVIDER_UNAVAILABLE", "Custom Provider execution context is unavailable");
    }
    if (!request.apiBaseUrl) {
      throw new AiContractError("PROVIDER_UNAVAILABLE", "Custom Provider endpoint is unavailable");
    }
    return request.customProvider;
  }

  private chatCompletionsUrl(baseUrl: string | null): string {
    if (!baseUrl) throw new AiContractError("PROVIDER_UNAVAILABLE", "Custom Provider endpoint is unavailable");
    let url: URL;
    try { url = new URL(baseUrl); }
    catch { throw new AiContractError("PROVIDER_UNAVAILABLE", "Custom Provider endpoint is invalid"); }
    const prefix = url.pathname.replace(/\/+$/, "");
    url.pathname = `${prefix}/chat/completions`;
    return url.toString();
  }
}
