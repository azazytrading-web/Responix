import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { ProviderControlService } from "./provider-control.service";

type RequestWithIds = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const connectionDto = z.object({
  providerKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  scope: z.enum(["PLATFORM", "APPLICATION", "TENANT"]),
  applicationId: z.string().uuid().optional(), tenantId: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(160), endpointUrl: z.string().url().max(2048).optional(),
  transportProfile: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/)
}).strict();
const credentialDto = z.object({ credential: z.string().min(8).max(4096) }).strict();
const connectionStatusDto = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]) }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Request validation failed");
  return result.data;
}
function traceId(request: RequestWithIds): string | undefined {
  const value = request.headers["x-trace-id"];
  return Array.isArray(value) ? value[0] : value;
}

@ApiTags("OIC Provider Administration")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class ProviderControlController {
  constructor(private readonly providers: ProviderControlService) {}

  @Version("1")
  @Get("providers")
  @RequireScopes("oic:providers:read")
  listDefinitions(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.providers.listDefinitions(actor); }

  @Version("1")
  @Get("provider-connections")
  @RequireScopes("oic:providers:read")
  listConnections(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.providers.listConnections(actor); }

  @Version("1")
  @Post("provider-connections")
  @RequireScopes("oic:connections:manage")
  createConnection(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.providers.createConnection(actor, parse(connectionDto, body), request.requestId, traceId(request));
  }

  @Version("1")
  @Get("provider-connections/:id")
  @RequireScopes("oic:providers:read")
  getConnection(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.providers.getConnection(actor, id); }

  @Version("1")
  @Post("provider-connections/:id/test")
  @RequireScopes("oic:connections:manage")
  testConnection(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    return this.providers.testConnection(actor, id, request.requestId, traceId(request));
  }

  @Version("1")
  @Patch("provider-connections/:id/status")
  @RequireScopes("oic:connections:manage")
  changeConnectionStatus(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.providers.changeConnectionStatus(actor, id, parse(connectionStatusDto, body).status, request.requestId, traceId(request));
  }

  @Version("1")
  @Put("provider-connections/:id/credentials")
  @RequireScopes("oic:connections:manage")
  setCredential(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.providers.setCredential(actor, id, parse(credentialDto, body).credential, request.requestId, traceId(request));
  }

  @Version("1")
  @Delete("provider-connections/:id/credentials/:credentialId")
  @RequireScopes("oic:connections:manage")
  revokeCredential(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Param("credentialId", ParseUUIDPipe) credentialId: string, @Req() request: RequestWithIds) {
    return this.providers.revokeCredential(actor, id, credentialId, request.requestId, traceId(request));
  }
}
