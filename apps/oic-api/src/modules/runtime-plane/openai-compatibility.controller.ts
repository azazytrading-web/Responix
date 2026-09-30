import { Body, Controller, Get, Post, Query, Req, Res, UseGuards, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { OicModelReference, OicRuntimeRequest, OicRuntimeResponse, OicRuntimeStreamEvent, OicRuntimeMessage, OicTenantSelector } from "@oic/contracts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { once } from "node:events";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { OicRuntimeException, runtimeErrorMessage } from "./runtime-errors";
import { parseOicRuntimeRequest, validateRuntimeHeaders } from "./runtime-request";
import { OicRuntimeService } from "./runtime.service";

type CompatibilityRequest = IncomingMessage & { requestId?: string; runtimeInvalidHeader?: boolean; principal?: AuthenticatedPrincipal; query?: Record<string, string | string[] | undefined> };
type Role = "system" | "developer" | "user" | "assistant";
const CHAT_ROLES = new Set<Role>(["system", "developer", "user", "assistant"]);
function header(request: CompatibilityRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
function requestIdentity(request: CompatibilityRequest) {
  if (request.runtimeInvalidHeader) throw new OicRuntimeException("INVALID_REQUEST");
  validateRuntimeHeaders(request.headers);
  return {
    requestId: request.requestId,
    traceId: header(request, "x-trace-id") ?? header(request, "x-correlation-id"),
    callerRequestId: header(request, "x-caller-request-id")
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OicRuntimeException("INVALID_REQUEST");
  return value as Record<string, unknown>;
}
function allowedKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
}
function modelRef(value: unknown): OicModelReference {
  if (typeof value !== "string" || value.length > 64 || !/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(value)) throw new OicRuntimeException("INVALID_REQUEST");
  return value as OicModelReference;
}
function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
  return value.map((entry) => {
    const part = record(entry);
    allowedKeys(part, ["type", "text"]);
    if ((part.type !== "text" && part.type !== "input_text") || typeof part.text !== "string") throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
    return part.text;
  }).join("");
}
function messages(value: unknown, source: "chat" | "responses"): OicRuntimeMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1000) throw new OicRuntimeException("INVALID_REQUEST");
  return value.map((entry) => {
    const message = record(entry);
    if (source === "responses" && message.type !== undefined && message.type !== "message") throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
    allowedKeys(message, source === "responses" ? ["type", "role", "content"] : ["role", "content"]);
    if (typeof message.role !== "string" || !CHAT_ROLES.has(message.role as Role)) throw new OicRuntimeException("CAPABILITY_NOT_SUPPORTED");
    const role: OicRuntimeMessage["speaker"] = message.role === "system" || message.role === "developer" ? "instruction" : message.role as OicRuntimeMessage["speaker"];
    return { speaker: role, content: [{ type: "text", text: textContent(message.content) }] };
  });
}
function tenantFrom(bodyTenant: unknown, headerTenant?: string): OicTenantSelector | undefined {
  if (bodyTenant !== undefined && typeof bodyTenant !== "string") throw new OicRuntimeException("INVALID_REQUEST");
  if (bodyTenant && headerTenant && bodyTenant !== headerTenant) throw new OicRuntimeException("INVALID_REQUEST");
  const value = bodyTenant ?? headerTenant;
  if (!value) return undefined;
  const parsed = parseOicRuntimeRequest({ model: "oi-validation", input: [{ speaker: "user", content: [{ type: "text", text: "" }] }], tenant: { kind: "id", tenantId: value } });
  return parsed.tenant;
}
function nativeChatRequest(bodyValue: unknown, headerTenant?: string): { request: OicRuntimeRequest; stream: boolean } {
  const body = record(bodyValue);
  allowedKeys(body, ["model", "messages", "stream", "tenant_id"]);
  if (body.stream !== undefined && typeof body.stream !== "boolean") throw new OicRuntimeException("INVALID_REQUEST");
  const request = parseOicRuntimeRequest({
    model: modelRef(body.model), input: messages(body.messages, "chat"),
    tenant: tenantFrom(body.tenant_id, headerTenant)
  });
  return { request, stream: body.stream === true };
}
function nativeResponsesRequest(bodyValue: unknown, headerTenant?: string): { request: OicRuntimeRequest; stream: boolean } {
  const body = record(bodyValue);
  allowedKeys(body, ["model", "input", "instructions", "stream", "tenant_id"]);
  if (body.stream !== undefined && typeof body.stream !== "boolean") throw new OicRuntimeException("INVALID_REQUEST");
  if (body.instructions !== undefined && typeof body.instructions !== "string") throw new OicRuntimeException("INVALID_REQUEST");
  const input = typeof body.input === "string"
    ? [{ speaker: "user", content: [{ type: "text", text: body.input }] }]
    : messages(body.input, "responses");
  if (body.instructions) input.unshift({ speaker: "instruction", content: [{ type: "text", text: body.instructions }] });
  const request = parseOicRuntimeRequest({ model: modelRef(body.model), input, tenant: tenantFrom(body.tenant_id, headerTenant) });
  return { request, stream: body.stream === true };
}
function usageFields(usage: OicRuntimeResponse["usage"]): Record<string, unknown> | undefined {
  if (!usage) return undefined;
  const result: Record<string, unknown> = {};
  if (usage.inputTokens !== undefined) result.prompt_tokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) result.completion_tokens = usage.outputTokens;
  if (usage.inputTokens !== undefined && usage.outputTokens !== undefined) result.total_tokens = usage.inputTokens + usage.outputTokens;
  if (usage.cachedInputTokens !== undefined) result.prompt_tokens_details = { cached_tokens: usage.cachedInputTokens };
  return Object.keys(result).length ? result : undefined;
}
function chatResponse(response: OicRuntimeResponse): Record<string, unknown> {
  const usage = usageFields(response.usage);
  return {
    id: `chatcmpl_${response.id}`, object: "chat.completion", created: Math.floor(Date.parse(response.createdAt) / 1000), model: response.model,
    choices: [{ index: 0, message: { role: "assistant", content: response.output.flatMap((item) => item.content).map((part) => part.text).join("") }, finish_reason: response.finishReason === "output-limit" ? "length" : "stop" }],
    ...(usage ? { usage } : {})
  };
}
function responseUsage(usage: OicRuntimeResponse["usage"]): Record<string, unknown> | undefined {
  if (!usage) return undefined;
  const result: Record<string, unknown> = {};
  if (usage.inputTokens !== undefined) result.input_tokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) result.output_tokens = usage.outputTokens;
  if (usage.cachedInputTokens !== undefined) result.input_tokens_details = { cached_tokens: usage.cachedInputTokens };
  if (Object.keys(result).length === 0) return undefined;
  if (usage.inputTokens !== undefined && usage.outputTokens !== undefined) result.total_tokens = usage.inputTokens + usage.outputTokens;
  return result;
}
function responsesResponse(response: OicRuntimeResponse): Record<string, unknown> {
  const usage = responseUsage(response.usage);
  return {
    id: `resp_${response.id}`, object: "response", created_at: Math.floor(Date.parse(response.createdAt) / 1000), status: "completed", model: response.model,
    output: response.output.map((item, index) => ({
      id: `msg_${response.id}_${index}`, type: "message", status: "completed", role: "assistant",
      content: item.content.map((part) => ({ type: "output_text", text: part.text, annotations: [] }))
    })),
    ...(usage ? { usage } : {})
  };
}
function abortConnection(request: CompatibilityRequest, response: ServerResponse): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const aborted = () => controller.abort(new Error("Request disconnected"));
  const closed = () => { if (!response.writableEnded) controller.abort(new Error("Client disconnected")); };
  request.once("aborted", aborted);
  response.once("close", closed);
  return { controller, cleanup: () => { request.off("aborted", aborted); response.off("close", closed); } };
}
async function writeSse(response: ServerResponse, event: string, payload: unknown, signal: AbortSignal): Promise<boolean> {
  if (!response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)) {
    try { await once(response, "drain", { signal }); }
    catch { return false; }
  }
  return !signal.aborted;
}
async function writeDone(response: ServerResponse, signal: AbortSignal): Promise<boolean> {
  if (!response.write("data: [DONE]\n\n")) {
    try { await once(response, "drain", { signal }); }
    catch { return false; }
  }
  return !signal.aborted;
}
function chatChunk(responseId: string, model: OicModelReference, delta: Record<string, string>, finishReason: string | null): Record<string, unknown> {
  return { id: `chatcmpl_${responseId}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason: finishReason }] };
}
function streamError(event: Extract<OicRuntimeStreamEvent, { type: "response.error" }>): Record<string, unknown> {
  return { error: { code: event.error.code, message: runtimeErrorMessage(event.error.code), type: "oic_error", request_id: event.error.requestId } };
}

@ApiTags("OpenAI Compatibility")
@ApiBearerAuth()
@Controller({ path: "v1", version: VERSION_NEUTRAL })
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class OpenAICompatibilityController {
  constructor(private readonly runtime: OicRuntimeService) {}

  @Get("models")
  @RequireScopes("oic:runtime:models:read")
  @ApiOperation({ summary: "List Application-visible Oi Models", description: "Returns only Oi Model identities visible to the authenticated Application and selected Tenant. OIC-2 has no production catalog, so the list is empty until OIC-3 publishes models. Upstream/provider model IDs are never listed." })
  @ApiResponse({ status: 200, description: "OpenAI-compatible model list containing Oi IDs only", schema: { type: "object", required: ["object", "data"], properties: { object: { type: "string", enum: ["list"] }, data: { type: "array", items: { type: "object", required: ["id", "object", "owned_by"], properties: { id: { type: "string", pattern: "^oi-" }, object: { type: "string", enum: ["model"] }, owned_by: { type: "string", enum: ["oi"] } } } } } } })
  @ApiResponse({ status: 401, description: "AUTHENTICATION_FAILED" })
  @ApiResponse({ status: 403, description: "AUTHORIZATION_DENIED" })
  async listModels(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: CompatibilityRequest, @Query() query: Record<string, unknown>) {
    requestIdentity(request);
    allowedKeys(query, ["tenant_id"]);
    const tenant = tenantFrom(query.tenant_id, header(request, "x-oic-tenant-id"));
    const { models } = await this.runtime.listVisibleModels(actor, tenant, requestIdentity(request));
    return { object: "list", data: models.map((model) => ({ id: model.id, object: "model", owned_by: "oi" })) };
  }

  @Post("chat/completions")
  @RequireScopes("oic:runtime:invoke")
  @ApiConsumes("application/json")
  @ApiProduces("application/json", "text/event-stream")
  @ApiOperation({ summary: "OpenAI Chat Completions compatibility adapter", description: "Translates text-only system/developer/user/assistant messages to Native OIC Runtime. Supports only model, messages, stream and tenant_id. Rejects tools, vision/image, audio, response_format, logprobs, reasoning fields, max_tokens and all unrecognized parameters with CAPABILITY_NOT_SUPPORTED. Streaming uses OpenAI chat chunks above the Native OIC stream." })
  @ApiBody({ schema: { type: "object", additionalProperties: false, required: ["model", "messages"], properties: {
    model: { type: "string", pattern: "^oi-" }, stream: { type: "boolean" }, tenant_id: { type: "string", format: "uuid" },
    messages: {
      type: "array", minItems: 1, maxItems: 1000,
      items: { type: "object", additionalProperties: false, required: ["role", "content"], properties: {
        role: { type: "string", enum: ["system", "developer", "user", "assistant"] },
        content: { oneOf: [
          { type: "string" },
          { type: "array", items: { type: "object", required: ["type", "text"], properties: { type: { type: "string", enum: ["text"] }, text: { type: "string" } } } }
        ] }
      } }
    }
  } } })
  @ApiResponse({ status: 200, description: "Chat completion response or text/event-stream chunks" })
  @ApiResponse({ status: 400, description: "INVALID_REQUEST or CAPABILITY_NOT_SUPPORTED" })
  @ApiResponse({ status: 401, description: "AUTHENTICATION_FAILED" })
  @ApiResponse({ status: 403, description: "AUTHORIZATION_DENIED" })
  @ApiResponse({ status: 503, description: "MODEL_NOT_AVAILABLE" })
  async chatCompletions(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: CompatibilityRequest, @Res({ passthrough: true }) response: ServerResponse) {
    const identity = requestIdentity(request);
    const mapped = nativeChatRequest(body, header(request, "x-oic-tenant-id"));
    if (mapped.stream) return this.streamCompatibility("chat", actor, mapped.request, identity, request, response);
    const cancellation = abortConnection(request, response);
    try {
      const result = await this.runtime.invoke(actor, mapped.request, identity, header(request, "idempotency-key"), cancellation.controller.signal, "compat.chat.v1");
      return chatResponse(result);
    } finally { cancellation.cleanup(); }
  }

  @Post("responses")
  @RequireScopes("oic:runtime:invoke")
  @ApiConsumes("application/json")
  @ApiProduces("application/json", "text/event-stream")
  @ApiOperation({ summary: "OpenAI Responses compatibility adapter", description: "Translates text input, text message items and optional instructions to Native OIC Runtime. Supports only model, input, instructions, stream and tenant_id. Rejects tools, images, audio, function calls, stored conversations and unrecognized fields. Streaming emits response.created, response.output_text.delta and a terminal response event." })
  @ApiBody({ schema: { type: "object", additionalProperties: false, required: ["model", "input"], properties: { model: { type: "string", pattern: "^oi-" }, input: { oneOf: [{ type: "string" }, { type: "array", items: { type: "object" } }] }, instructions: { type: "string" }, stream: { type: "boolean" }, tenant_id: { type: "string", format: "uuid" } } } })
  @ApiResponse({ status: 200, description: "Responses-compatible response or text/event-stream events" })
  @ApiResponse({ status: 400, description: "INVALID_REQUEST or CAPABILITY_NOT_SUPPORTED" })
  @ApiResponse({ status: 401, description: "AUTHENTICATION_FAILED" })
  @ApiResponse({ status: 403, description: "AUTHORIZATION_DENIED" })
  @ApiResponse({ status: 503, description: "MODEL_NOT_AVAILABLE" })
  async responses(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: CompatibilityRequest, @Res({ passthrough: true }) response: ServerResponse) {
    const identity = requestIdentity(request);
    const mapped = nativeResponsesRequest(body, header(request, "x-oic-tenant-id"));
    if (mapped.stream) return this.streamCompatibility("responses", actor, mapped.request, identity, request, response);
    const cancellation = abortConnection(request, response);
    try {
      const result = await this.runtime.invoke(actor, mapped.request, identity, header(request, "idempotency-key"), cancellation.controller.signal, "compat.responses.v1");
      return responsesResponse(result);
    } finally { cancellation.cleanup(); }
  }

  private async streamCompatibility(kind: "chat" | "responses", actor: AuthenticatedPrincipal, requestBody: OicRuntimeRequest, identity: ReturnType<typeof requestIdentity>, request: CompatibilityRequest, response: ServerResponse): Promise<void> {
    const cancellation = abortConnection(request, response);
    try {
      const events = await this.runtime.stream(actor, requestBody, identity, header(request, "idempotency-key"), cancellation.controller.signal);
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders();
      let responseId = "";
      for await (const event of events) {
        if (cancellation.controller.signal.aborted) break;
        let keepGoing: boolean;
        if (kind === "chat") {
          if (event.type === "response.started") {
            responseId = event.responseId;
            keepGoing = await writeSse(response, "message", chatChunk(responseId, event.model, { role: "assistant" }, null), cancellation.controller.signal);
          } else if (event.type === "content.delta") {
            keepGoing = await writeSse(response, "message", chatChunk(responseId, requestBody.model, { content: event.text }, null), cancellation.controller.signal);
          } else if (event.type === "usage.updated") {
            keepGoing = true;
          } else if (event.type === "response.completed") {
            const final = chatChunk(responseId, requestBody.model, {}, event.response.finishReason === "output-limit" ? "length" : "stop");
            const compatUsage = usageFields(event.response.usage);
            if (compatUsage) Object.assign(final, { usage: compatUsage });
            keepGoing = await writeSse(response, "message", final, cancellation.controller.signal);
            if (keepGoing) keepGoing = await writeDone(response, cancellation.controller.signal);
          } else {
            keepGoing = await writeSse(response, "message", streamError(event), cancellation.controller.signal);
            if (keepGoing) keepGoing = await writeDone(response, cancellation.controller.signal);
          }
        } else {
          if (event.type === "response.started") {
            responseId = event.responseId;
            keepGoing = await writeSse(response, "response.created", { type: "response.created", response: { id: `resp_${responseId}`, object: "response", status: "in_progress", model: event.model } }, cancellation.controller.signal);
          } else if (event.type === "content.delta") {
            keepGoing = await writeSse(response, "response.output_text.delta", { type: "response.output_text.delta", item_id: `msg_${responseId}_0`, output_index: 0, content_index: 0, delta: event.text }, cancellation.controller.signal);
          } else if (event.type === "usage.updated") {
            keepGoing = true;
          } else if (event.type === "response.completed") {
            keepGoing = await writeSse(response, "response.completed", { type: "response.completed", response: responsesResponse(event.response) }, cancellation.controller.signal);
          } else {
            keepGoing = await writeSse(response, "error", { type: "error", ...streamError(event) }, cancellation.controller.signal);
          }
        }
        if (!keepGoing || event.type === "response.error" || event.type === "response.completed") break;
      }
    } finally {
      cancellation.cleanup();
      if (response.headersSent && !response.writableEnded) response.end();
    }
  }
}

export const compatibilityContract = { nativeChatRequest, nativeResponsesRequest, chatResponse, responsesResponse, usageFields };
