import { Body, Controller, Post, Req, Res, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { OicRuntimeResponse, OicRuntimeStreamEvent } from "@oic/contracts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { once } from "node:events";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { OicRuntimeException } from "./runtime-errors";
import { parseOicRuntimeRequest, validateRuntimeHeaders } from "./runtime-request";
import { OicRuntimeService } from "./runtime.service";

type RuntimeHttpRequest = IncomingMessage & { requestId?: string; runtimeInvalidHeader?: boolean; principal?: AuthenticatedPrincipal };
function header(headers: RuntimeHttpRequest["headers"], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}
function identity(request: RuntimeHttpRequest) {
  if (request.runtimeInvalidHeader) throw new OicRuntimeException("INVALID_REQUEST");
  validateRuntimeHeaders(request.headers);
  const traceId = header(request.headers, "x-trace-id") ?? header(request.headers, "x-correlation-id");
  const callerRequestId = header(request.headers, "x-caller-request-id");
  return { requestId: request.requestId, traceId, callerRequestId };
}
function inputWithTenantHeader(body: unknown, tenantId?: string): unknown {
  if (!tenantId) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new OicRuntimeException("INVALID_REQUEST");
  const record = body as Record<string, unknown>;
  if (record.tenant !== undefined) {
    const tenant = record.tenant;
    if (!tenant || typeof tenant !== "object" || Array.isArray(tenant) || (tenant as Record<string, unknown>).kind !== "id" || (tenant as Record<string, unknown>).tenantId !== tenantId) {
      throw new OicRuntimeException("INVALID_REQUEST");
    }
    return body;
  }
  return { ...record, tenant: { kind: "id", tenantId } };
}
function connectAbort(request: RuntimeHttpRequest, response: ServerResponse): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const onAborted = () => controller.abort(new Error("Request disconnected"));
  const onClose = () => { if (!response.writableEnded) controller.abort(new Error("Client disconnected")); };
  request.once("aborted", onAborted);
  response.once("close", onClose);
  return { controller, cleanup: () => { request.off("aborted", onAborted); response.off("close", onClose); } };
}

@ApiTags("OIC Native Runtime")
@ApiBearerAuth()
@Controller("runtime")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class OicRuntimeController {
  constructor(private readonly runtime: OicRuntimeService) {}

  @Post("invocations")
  @Version("1")
  @RequireScopes("oic:runtime:invoke")
  @ApiOperation({ summary: "Run a native OIC Runtime invocation", description: "Canonical provider-neutral Native Runtime request. Model identifiers are Oi Model references. If no approved Oi Model runtime binding is published, returns MODEL_NOT_AVAILABLE. Application and Principal are derived from the bearer credential; optional Tenant selection is checked against active grants." })
  @ApiBody({ schema: { type: "object", additionalProperties: false, required: ["model", "input"], properties: {
    model: { type: "string", pattern: "^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$", maxLength: 64 },
    input: { type: "array", minItems: 1, maxItems: 1000, items: { type: "object", additionalProperties: false, required: ["speaker", "content"], properties: {
      speaker: { type: "string", enum: ["instruction", "user", "assistant", "context"] },
      content: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", additionalProperties: false, required: ["type", "text"], properties: { type: { type: "string", enum: ["text"] }, text: { type: "string", maxLength: 1000000 } } } }
    } } },
    tenant: { oneOf: [ { type: "object", additionalProperties: false, required: ["kind", "tenantId"], properties: { kind: { type: "string", enum: ["id"] }, tenantId: { type: "string", format: "uuid" } } }, { type: "object", additionalProperties: false, required: ["kind", "sourceType", "externalId"], properties: { kind: { type: "string", enum: ["external-reference"] }, sourceType: { type: "string", maxLength: 64 }, externalId: { type: "string", maxLength: 256 } } } ] },
    maxOutputUnits: { type: "integer", minimum: 1, maximum: 65536 }
  } } })
  @ApiResponse({ status: 200, description: "Unified OIC Runtime result; usage is null when no raw evidence is known" })
  @ApiResponse({ status: 400, description: "INVALID_REQUEST or CAPABILITY_NOT_SUPPORTED" })
  @ApiResponse({ status: 401, description: "AUTHENTICATION_FAILED" })
  @ApiResponse({ status: 403, description: "AUTHORIZATION_DENIED" })
  @ApiResponse({ status: 404, description: "TENANT_NOT_ALLOWED or MODEL_NOT_FOUND" })
  @ApiResponse({ status: 409, description: "IDEMPOTENCY_CONFLICT or IDEMPOTENCY_IN_PROGRESS" })
  @ApiResponse({ status: 503, description: "MODEL_NOT_AVAILABLE or RUNTIME_UNAVAILABLE" })
  async invoke(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RuntimeHttpRequest, @Res({ passthrough: true }) response: ServerResponse): Promise<OicRuntimeResponse> {
    const requestIdentity = identity(request);
    const input = inputWithTenantHeader(body, header(request.headers, "x-oic-tenant-id"));
    const parsed = parseOicRuntimeRequest(input);
    const cancellation = connectAbort(request, response);
    try { return await this.runtime.invoke(actor, parsed, requestIdentity, header(request.headers, "idempotency-key"), cancellation.controller.signal); }
    finally { cancellation.cleanup(); }
  }

  @Post("stream")
  @Version("1")
  @RequireScopes("oic:runtime:invoke")
  @ApiConsumes("application/json")
  @ApiProduces("text/event-stream")
  @ApiOperation({ summary: "Stream a native OIC Runtime invocation", description: "Emits OIC-owned response.started, content.delta, usage.updated and one terminal response.completed or response.error event. Streaming replay with Idempotency-Key is explicitly unsupported. Client disconnect cancels execution where supported." })
  @ApiBody({ schema: { type: "object", additionalProperties: false, required: ["model", "input"], properties: { model: { type: "string", pattern: "^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$" }, input: { type: "array", items: { type: "object" } }, tenant: { type: "object" }, maxOutputUnits: { type: "integer" } } } })
  @ApiResponse({ status: 200, description: "Server-sent OIC Runtime stream events", content: { "text/event-stream": { schema: { type: "string" } } } })
  @ApiResponse({ status: 400, description: "INVALID_REQUEST or STREAMING_IDEMPOTENCY_UNSUPPORTED" })
  @ApiResponse({ status: 401, description: "AUTHENTICATION_FAILED" })
  @ApiResponse({ status: 403, description: "AUTHORIZATION_DENIED" })
  @ApiResponse({ status: 503, description: "MODEL_NOT_AVAILABLE or RUNTIME_UNAVAILABLE" })
  async stream(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RuntimeHttpRequest, @Res() response: ServerResponse): Promise<void> {
    const requestIdentity = identity(request);
    const input = inputWithTenantHeader(body, header(request.headers, "x-oic-tenant-id"));
    const parsed = parseOicRuntimeRequest(input);
    const cancellation = connectAbort(request, response);
    try {
      const events = await this.runtime.stream(actor, parsed, requestIdentity, header(request.headers, "idempotency-key"), cancellation.controller.signal);
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders();
      for await (const event of events) {
        if (cancellation.controller.signal.aborted) break;
        if (!writeEvent(response, event)) {
          try { await once(response, "drain", { signal: cancellation.controller.signal }); }
          catch { break; }
        }
        if (event.type === "response.error" || event.type === "response.completed") break;
      }
    } finally {
      cancellation.cleanup();
      if (response.headersSent && !response.writableEnded) response.end();
    }
  }
}

function writeEvent(response: ServerResponse, event: OicRuntimeStreamEvent): boolean {
  return response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}
