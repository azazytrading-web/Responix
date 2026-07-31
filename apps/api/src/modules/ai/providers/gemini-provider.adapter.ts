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
import type { ProviderStreamEvent } from "../contracts";

const schema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(),
      functionCall: z.object({ name: z.string(), args: z.record(z.string(), z.unknown()) }).optional() })) }),
    finishReason: z.string().optional()
  })).min(1),
  usageMetadata: z.object({
    promptTokenCount: z.number().int().nonnegative(),
    candidatesTokenCount: z.number().int().nonnegative(),
    cachedContentTokenCount: z.number().int().nonnegative().optional()
  })
});

@Injectable()
export class GeminiProviderAdapter implements AiProviderAdapter {
  readonly providerName = "Gemini";
  readonly contractVersion = "1.0";
  constructor(private readonly http: ProviderHttpClient) {}
  async invoke(request: ProviderExecutionRequest, credential: ProviderExecutionCredential):
  Promise<ProviderExecutionResult> {
    const system = request.messages.filter(({ role }) => role === "system")
      .map(({ content }) => ({ text: content }));
    const contents = request.messages.filter(({ role }) => role !== "system")
      .map(({ role, content }) => ({
        role: role === "assistant" ? "model" : "user", parts: [{ text: content }]
      }));
    let response;
    try {
      const base = (request.apiBaseUrl ?? "https://generativelanguage.googleapis.com/v1beta")
        .replace(/\/$/, "");
      response = await this.http.postJson({
        provider: this.providerName,
        url: `${base}/models/${encodeURIComponent(request.modelName)}:generateContent`,
        headers: { "x-goog-api-key": credential.secret },
        body: JSON.stringify({
          ...(system.length ? { systemInstruction: { parts: system } } : {}),
          contents, generationConfig: { maxOutputTokens: request.maxOutputTokens },
          ...(request.tools?.length ? { tools: [{ functionDeclarations: request.tools.map((tool) => ({
            name: tool.name, description: tool.description, parameters: tool.inputSchema
          })) }] } : {})
        }),
        signal: request.signal
      });
    } catch (error: unknown) { return normalizeTransportError(error, request.signal); }
    if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    const parsed = schema.safeParse(parseJson(response.body));
    if (!parsed.success) throw new AiContractError("RESPONSE_INVALID", "AI provider response was invalid");
    const candidate = parsed.data.candidates[0];
    if (!candidate) throw new AiContractError("RESPONSE_INVALID", "AI provider response was empty");
    assertTokenLimit(parsed.data.usageMetadata.candidatesTokenCount, request.maxOutputTokens);
    const toolCalls = candidate.content.parts.flatMap((part, index) => part.functionCall ? [{
      id: `gemini:${part.functionCall.name}:${index}`, name: part.functionCall.name,
      arguments: part.functionCall.args, status: "pending" as const
    }] : []);
    return {
      content: candidate.content.parts.map(({ text }) => text ?? "").join(""),
      ...(toolCalls.length ? { toolCalls } : {}),
      ...(candidate.finishReason ? { finishReason: candidate.finishReason } : {}),
      usage: {
        inputTokens: parsed.data.usageMetadata.promptTokenCount,
        outputTokens: parsed.data.usageMetadata.candidatesTokenCount,
        cachedTokens: parsed.data.usageMetadata.cachedContentTokenCount ?? 0
      }
    };
  }
  async stream(request: ProviderExecutionRequest, credential: ProviderExecutionCredential, emit: (event: ProviderStreamEvent) => Promise<void>): Promise<void> {
    const system = request.messages.filter(({ role }) => role === "system").map(({ content }) => ({ text: content }));
    const contents = request.messages.filter(({ role }) => role !== "system").map(({ role, content }) => ({ role: role === "assistant" ? "model" : "user", parts: [{ text: content }] }));
    let completed = false;
    try {
      const base = (request.apiBaseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
      const response = await this.http.postSse({ provider: this.providerName,
        url: `${base}/models/${encodeURIComponent(request.modelName)}:streamGenerateContent?alt=sse`, headers: { "x-goog-api-key": credential.secret },
        body: JSON.stringify({ ...(system.length ? { systemInstruction: { parts: system } } : {}), contents,
          generationConfig: { maxOutputTokens: request.maxOutputTokens },
          ...(request.tools?.length ? { tools: [{ functionDeclarations: request.tools.map((tool) => ({
            name: tool.name, description: tool.description, parameters: tool.inputSchema
          })) }] } : {}) }), signal: request.signal,
        onEvent: async ({ data }) => { const value = JSON.parse(data) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number } };
          const candidate = value.candidates?.[0]; const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("");
          if (text || candidate?.finishReason) await emit({ type: "delta", ...(text ? { content: text } : {}), role: "assistant", ...(candidate?.finishReason ? { finishReason: candidate.finishReason } : {}) });
          if (candidate?.finishReason) { completed = true; const usage = value.usageMetadata; await emit({ type: "completed", ...(usage ? { usage: {
            ...(usage.promptTokenCount !== undefined ? { inputTokens: usage.promptTokenCount } : {}),
            ...(usage.candidatesTokenCount !== undefined ? { outputTokens: usage.candidatesTokenCount } : {}),
            ...(usage.cachedContentTokenCount !== undefined ? { cachedTokens: usage.cachedContentTokenCount } : {})
          } } : {}) }); }
        } });
      if (response.status < 200 || response.status >= 300) normalizeHttpStatus(response.status);
    } catch (error: unknown) { return normalizeTransportError(error, request.signal); }
    if (!completed) throw new AiContractError("RESPONSE_INVALID", "Gemini stream ended without a finish reason");
  }
}
