import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { Injectable } from "@nestjs/common";
import { OicDatabaseService } from "@oic/database";
import type { OicResolvedModel, OicRuntimeContext, OicRuntimeExecutionResult, OicRuntimeExecutor, OicRuntimeExecutionStreamChunk, OicRuntimeRequest } from "@oic/contracts";
import { decryptProviderCredential } from "../control-plane/provider-credential.crypto";
import { resolvePublicHttpsEndpoint } from "../control-plane/provider-endpoint";
import type { ResolvedProviderEndpoint } from "../control-plane/provider-endpoint";
import { registeredProvider } from "../control-plane/provider-registry";
import { isLocalFixtureConnection, LOCAL_PROVIDER_FIXTURE_ENDPOINT, LOCAL_PROVIDER_FIXTURE_KEY, localProviderFixtureEnabled } from "../control-plane/local-provider-fixture";
import { OicRuntimeException } from "./runtime-errors";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_STREAM_EVENT_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const timedOutResponses = new WeakSet<IncomingMessage>();
type InternalResolvedModel = OicResolvedModel & { bindingId: string };
type ProviderTestNetwork = {
  resolveEndpoint(input: string): Promise<ResolvedProviderEndpoint>;
  request(url: URL, headers: Record<string, string>, body: Buffer, signal: AbortSignal | undefined, timeoutMs: number): Promise<IncomingMessage>;
  timeoutMs?: number;
};
type ProviderResponse = { error?: unknown; choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> }; finish_reason?: string; delta?: { content?: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } } };
type ResponsesProviderResponse = { type?: string; error?: unknown; status?: string; output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>; incomplete_details?: { reason?: string }; response?: { usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } } }; usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } }; delta?: string };

function normalizedTransportError(error: unknown): OicRuntimeException {
  if (error instanceof OicRuntimeException) return error;
  if (error instanceof Error && /timeout/i.test(error.message)) return new OicRuntimeException("UPSTREAM_TIMEOUT");
  return new OicRuntimeException("PROVIDER_UNAVAILABLE");
}
function providerStatusError(status: number): OicRuntimeException {
  if (status === 400 || status === 422) return new OicRuntimeException("PROVIDER_REQUEST_REJECTED");
  if (status === 401) return new OicRuntimeException("PROVIDER_AUTHENTICATION_FAILED");
  if (status === 403) return new OicRuntimeException("PROVIDER_AUTHORIZATION_FAILED");
  if (status === 404) return new OicRuntimeException("UPSTREAM_MODEL_UNAVAILABLE");
  if (status === 408) return new OicRuntimeException("UPSTREAM_TIMEOUT");
  if (status === 429) return new OicRuntimeException("RATE_LIMITED");
  return new OicRuntimeException("PROVIDER_UNAVAILABLE");
}

function toMessages(request: OicRuntimeRequest) {
  return request.input.map((message) => ({
    role: message.speaker === "instruction" || message.speaker === "context" ? "system" : message.speaker,
    content: message.content.map((part) => part.text).join("")
  }));
}
function usageOf(usage: ProviderResponse["usage"]) {
  if (!usage) return undefined;
  return {
    ...(Number.isSafeInteger(usage.prompt_tokens) && usage.prompt_tokens! >= 0 ? { inputTokens: usage.prompt_tokens } : {}),
    ...(Number.isSafeInteger(usage.completion_tokens) && usage.completion_tokens! >= 0 ? { outputTokens: usage.completion_tokens } : {}),
    ...(Number.isSafeInteger(usage.prompt_tokens_details?.cached_tokens) && usage.prompt_tokens_details!.cached_tokens! >= 0 ? { cachedInputTokens: usage.prompt_tokens_details!.cached_tokens } : {}),
    ...(Number.isSafeInteger(usage.completion_tokens_details?.reasoning_tokens) && usage.completion_tokens_details!.reasoning_tokens! >= 0 ? { reasoningTokens: usage.completion_tokens_details!.reasoning_tokens } : {})
  };
}
function responsesUsageOf(usage: ResponsesProviderResponse["usage"]) {
  if (!usage) return undefined;
  return {
    ...(Number.isSafeInteger(usage.input_tokens) && usage.input_tokens! >= 0 ? { inputTokens: usage.input_tokens } : {}),
    ...(Number.isSafeInteger(usage.output_tokens) && usage.output_tokens! >= 0 ? { outputTokens: usage.output_tokens } : {}),
    ...(Number.isSafeInteger(usage.input_tokens_details?.cached_tokens) && usage.input_tokens_details!.cached_tokens! >= 0 ? { cachedInputTokens: usage.input_tokens_details!.cached_tokens } : {}),
    ...(Number.isSafeInteger(usage.output_tokens_details?.reasoning_tokens) && usage.output_tokens_details!.reasoning_tokens! >= 0 ? { reasoningTokens: usage.output_tokens_details!.reasoning_tokens } : {})
  };
}
function responsesInput(request: OicRuntimeRequest) {
  return request.input.map((message) => ({
    role: message.speaker === "instruction" || message.speaker === "context" ? "developer" : message.speaker,
    content: [{ type: "input_text", text: message.content.map((part) => part.text).join("") }]
  }));
}

@Injectable()
export class ProviderRuntimeExecutor implements OicRuntimeExecutor {
  private testNetwork?: ProviderTestNetwork;
  constructor(private readonly db: OicDatabaseService) {}

  static forTest(db: OicDatabaseService, network: ProviderTestNetwork): ProviderRuntimeExecutor {
    if (!process.env.NODE_TEST_CONTEXT) throw new Error("Test-only provider network injection is unavailable outside Node test execution");
    const executor = new ProviderRuntimeExecutor(db);
    executor.testNetwork = network;
    return executor;
  }

  async execute(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): Promise<OicRuntimeExecutionResult> {
    const prepared = await this.prepare(model, request, context);
    if (prepared.localFixture) {
      if (signal?.aborted) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
      const inputText = request.input.flatMap((message) => message.content.map((part) => part.text)).join(" ").trim();
      return { outputText: `OIC local fixture accepted: ${inputText || "empty input"}`, usage: { inputTokens: Math.max(1, Math.ceil(inputText.length / 4)), outputTokens: 5 }, finishReason: "completed", executorVersion: "oic-local-fixture-v1" };
    }
    if (prepared.transportProfile === "openai-responses-v1") {
      const data = await this.sendJson(prepared, { model: prepared.upstreamModelId, input: responsesInput(request), stream: false, ...(request.maxOutputUnits ? { max_output_tokens: request.maxOutputUnits } : {}) }, signal) as unknown as ResponsesProviderResponse;
      if (data.error || (data.type === "response.failed")) throw new OicRuntimeException("PROVIDER_UNAVAILABLE");
      const outputText = typeof data.output_text === "string" ? data.output_text : data.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && typeof item.text === "string").map((item) => item.text!).join("");
      if (typeof outputText !== "string") throw new OicRuntimeException("PROVIDER_RESPONSE_INVALID");
      return { outputText, usage: responsesUsageOf(data.usage ?? data.response?.usage), finishReason: data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens" ? "output-limit" : "completed", executorVersion: "openai-responses-v1" };
    }
    const data = await this.sendJson(prepared, {
      model: prepared.upstreamModelId, messages: toMessages(request), stream: false,
      ...(request.maxOutputUnits ? { max_tokens: request.maxOutputUnits } : {})
    }, signal);
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const outputText = typeof content === "string" ? content : Array.isArray(content) ? content.filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text).join("") : null;
    if (outputText === null || outputText === undefined) throw new OicRuntimeException("PROVIDER_RESPONSE_INVALID");
    return { outputText, usage: usageOf(data.usage), finishReason: choice?.finish_reason === "length" ? "output-limit" : "completed", executorVersion: "openai-chat-completions-v1" };
  }

  async *stream(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext, signal?: AbortSignal): AsyncIterable<OicRuntimeExecutionStreamChunk> {
    const prepared = await this.prepare(model, request, context);
    if (prepared.localFixture) {
      if (signal?.aborted) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
      const inputText = request.input.flatMap((message) => message.content.map((part) => part.text)).join(" ").trim();
      const text = `OIC local fixture accepted: ${inputText || "empty input"}`;
      yield { type: "content.delta", text };
      yield { type: "usage.updated", usage: { inputTokens: Math.max(1, Math.ceil(inputText.length / 4)), outputTokens: 5 } };
      return;
    }
    const responsesTransport = prepared.transportProfile === "openai-responses-v1";
    const response = await this.sendStream(prepared, {
      model: prepared.upstreamModelId,
      ...(responsesTransport ? { input: responsesInput(request) } : { messages: toMessages(request), stream_options: { include_usage: true } }),
      stream: true,
      ...(request.maxOutputUnits ? (responsesTransport ? { max_output_tokens: request.maxOutputUnits } : { max_tokens: request.maxOutputUnits }) : {})
    }, signal);
    let buffer = "";
    let total = 0;
    let terminalSeen = false;
    try {
      for await (const chunk of response as AsyncIterable<Uint8Array>) {
        if (signal?.aborted) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
        total += chunk.length;
        if (total > MAX_RESPONSE_BYTES) throw new OicRuntimeException("PROVIDER_RESPONSE_TOO_LARGE");
        buffer += Buffer.from(chunk).toString("utf8");
        if (Buffer.byteLength(buffer, "utf8") > MAX_STREAM_EVENT_BYTES && !buffer.includes("\n")) throw new OicRuntimeException("PROVIDER_RESPONSE_TOO_LARGE");
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trimEnd();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") { terminalSeen = true; continue; }
          if (Buffer.byteLength(payload, "utf8") > MAX_STREAM_EVENT_BYTES) throw new OicRuntimeException("PROVIDER_RESPONSE_TOO_LARGE");
          let data: ProviderResponse & ResponsesProviderResponse;
          try { data = JSON.parse(payload) as ProviderResponse; } catch { throw new OicRuntimeException("PROVIDER_RESPONSE_INVALID"); }
          if (data.error || data.type === "response.failed" || data.type === "error") throw new OicRuntimeException("PROVIDER_STREAM_INTERRUPTED");
          if (responsesTransport && data.type === "response.output_text.delta" && typeof data.delta === "string" && data.delta) yield { type: "content.delta", text: data.delta };
          if (responsesTransport && data.type === "response.completed") {
            terminalSeen = true;
            const usage = responsesUsageOf(data.response?.usage);
            if (usage && Object.keys(usage).length) yield { type: "usage.updated", usage };
            continue;
          }
          const choice = data.choices?.[0];
          const text = responsesTransport ? undefined : choice?.delta?.content;
          if (typeof text === "string" && text) yield { type: "content.delta", text };
          const usage = responsesTransport ? undefined : usageOf(data.usage);
          if (usage && Object.keys(usage).length) yield { type: "usage.updated", usage };
        }
      }
    } catch (error) {
      if (error instanceof OicRuntimeException) throw error;
      if (error instanceof Error && /timeout/i.test(error.message)) throw new OicRuntimeException("UPSTREAM_TIMEOUT");
      throw new OicRuntimeException("PROVIDER_STREAM_INTERRUPTED");
    }
    if (!terminalSeen) throw new OicRuntimeException(timedOutResponses.has(response) ? "UPSTREAM_TIMEOUT" : "PROVIDER_STREAM_INTERRUPTED");
  }

  private async prepare(model: OicResolvedModel, request: OicRuntimeRequest, context: OicRuntimeContext) {
    const bindingId = (model as InternalResolvedModel).bindingId;
    if (!bindingId) throw new OicRuntimeException("MODEL_NOT_AVAILABLE");
    const binding = await this.db.oicRuntimeBinding.findFirst({
      where: { id: bindingId, edition: { publicId: request.model, lifecycle: "PRODUCTION", visibility: { some: { applicationId: context.applicationId } } }, status: "ACTIVE", environment: "production" },
      include: { connection: { include: { providerDefinition: true, credentials: { where: { status: "ACTIVE" }, orderBy: { version: "desc" }, take: 1 } } }, variant: { include: { upstreamModel: true } } }
    });
    if (!binding || binding.connection.status !== "ACTIVE" || binding.connection.healthStatus !== "HEALTHY" || !binding.connection.lastValidatedAt || !binding.variant.upstreamModel) throw new OicRuntimeException("MODEL_NOT_AVAILABLE");
    const profile = binding.connection.transportProfile;
    const provider = registeredProvider(binding.connection.providerDefinition.key);
    if ((profile !== "openai-chat-completions-v1" && profile !== "openai-responses-v1") || binding.variant.transportProfile !== profile || !provider?.transportProfiles.includes(profile) || (profile === "openai-responses-v1" && binding.connection.providerDefinition.key !== "openai")) throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
    const localFixture = binding.connection.providerDefinition.key === LOCAL_PROVIDER_FIXTURE_KEY;
    if (localFixture && (!localProviderFixtureEnabled() || !isLocalFixtureConnection(binding.connection))) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
    const endpoint = localFixture
      ? { url: new URL(LOCAL_PROVIDER_FIXTURE_ENDPOINT), hostname: "local-fixture.oic.invalid", addresses: [] }
      : await (this.testNetwork ? this.testNetwork.resolveEndpoint(binding.connection.endpointUrl ?? "") : resolvePublicHttpsEndpoint(binding.connection.endpointUrl ?? "")).catch(() => { throw new OicRuntimeException("RUNTIME_UNAVAILABLE"); });
    const credential = binding.connection.providerDefinition.authStrategy === "NONE" ? null : binding.connection.credentials[0];
    if (binding.connection.providerDefinition.authStrategy !== "NONE" && binding.connection.providerDefinition.authStrategy !== "BEARER") throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
    if (binding.connection.providerDefinition.authStrategy !== "NONE" && !credential) throw new OicRuntimeException("RUNTIME_UNAVAILABLE");
    let token: string | null = null;
    if (credential) {
      try { token = decryptProviderCredential(credential, binding.connectionId, credential.version); }
      catch { throw new OicRuntimeException("RUNTIME_UNAVAILABLE"); }
    }
    const route = profile === "openai-responses-v1" ? "responses" : "chat/completions";
    return { transportProfile: profile, endpoint: new URL(route, endpoint.url.toString().replace(/\/?$/, "/")), address: endpoint.addresses[0]!, upstreamModelId: binding.variant.upstreamModel.upstreamModelId, token, localFixture };
  }

  private sendJson(prepared: Awaited<ReturnType<ProviderRuntimeExecutor["prepare"]>>, payload: unknown, signal?: AbortSignal): Promise<ProviderResponse> {
    return this.send(prepared, payload, false, signal).then(async (response) => {
      const bytes = await this.readBounded(response);
      try { return JSON.parse(bytes.toString("utf8")) as ProviderResponse; } catch { throw new OicRuntimeException("PROVIDER_RESPONSE_INVALID"); }
    }).catch((error: unknown) => { throw normalizedTransportError(error); });
  }
  private sendStream(prepared: Awaited<ReturnType<ProviderRuntimeExecutor["prepare"]>>, payload: unknown, signal?: AbortSignal): Promise<IncomingMessage> {
    return this.send(prepared, payload, true, signal);
  }
  private send(prepared: Awaited<ReturnType<ProviderRuntimeExecutor["prepare"]>>, payload: unknown, stream: boolean, signal?: AbortSignal): Promise<IncomingMessage> {
    if (signal?.aborted) return Promise.reject(new OicRuntimeException("RUNTIME_UNAVAILABLE"));
    return new Promise((resolve, reject) => {
      let settled = false;
      const headers: Record<string, string> = { "content-type": "application/json", accept: stream ? "text/event-stream" : "application/json" };
      if (prepared.token) headers.authorization = `Bearer ${prepared.token}`;
      const body = Buffer.from(JSON.stringify(payload));
      headers["content-length"] = String(body.length);
      const onResponse = (response: IncomingMessage) => {
        if (settled) { response.destroy(); return; }
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          let errorBytes = 0;
          response.on("data", (chunk: Buffer) => { errorBytes += chunk.length; if (errorBytes > 64 * 1024) response.destroy(); });
          response.resume();
          settled = true;
          reject(providerStatusError(response.statusCode ?? 0));
          return;
        }
        const contentType = response.headers["content-type"]?.toLowerCase() ?? "";
        const contentTypeAccepted = stream ? contentType.startsWith("text/event-stream") : contentType.includes("application/json");
        if (!contentTypeAccepted) {
          response.resume();
          settled = true;
          reject(new OicRuntimeException("PROVIDER_RESPONSE_INVALID"));
          return;
        }
        response.setTimeout(this.testNetwork?.timeoutMs ?? REQUEST_TIMEOUT_MS, () => {
          timedOutResponses.add(response);
          response.destroy(new Error("provider response timeout"));
        });
        settled = true;
        resolve(response);
      };
      if (this.testNetwork) {
        void this.testNetwork.request(prepared.endpoint, headers, body, signal, this.testNetwork.timeoutMs ?? REQUEST_TIMEOUT_MS).then(onResponse).catch((error: unknown) => {
          if (!settled) { settled = true; reject(normalizedTransportError(error)); }
        });
        return;
      }
      let receivedResponse: IncomingMessage | undefined;
      const request = httpsRequest(prepared.endpoint, {
        method: "POST", headers, signal, timeout: REQUEST_TIMEOUT_MS,
        servername: prepared.endpoint.hostname,
        lookup: (_hostname: string, _options: unknown, callback: (error: Error | null, address: string, family: number) => void) => callback(null, prepared.address.address, prepared.address.family)
      }, (response) => { receivedResponse = response; onResponse(response); });
      request.on("timeout", () => {
        const error = new Error("provider request timeout");
        if (receivedResponse && !receivedResponse.destroyed) receivedResponse.destroy(error);
        request.destroy(error);
      });
      request.on("error", (error) => { if (!settled) { settled = true; reject(normalizedTransportError(error)); } });
      request.end(body);
    });
  }
  private async readBounded(response: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const item of response as AsyncIterable<Uint8Array>) {
      const chunk = Buffer.from(item);
      size += chunk.length;
      if (size > MAX_RESPONSE_BYTES) { response.destroy(); throw new OicRuntimeException("PROVIDER_RESPONSE_TOO_LARGE"); }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
