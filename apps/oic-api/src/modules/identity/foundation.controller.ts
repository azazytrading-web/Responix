import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "./auth.guard";
import { AuditContext, FoundationService, OIC_SCOPES } from "./foundation.service";

type RequestWithIds = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const appDto = z.object({ key: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), displayName: z.string().trim().min(1).max(160) }).strict();
const tenantDto = z.object({ key: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(), displayName: z.string().trim().min(1).max(160) }).strict();
const externalDto = z.object({ sourceType: z.string().regex(/^[a-zA-Z0-9._:-]{1,64}$/), externalId: z.string().min(1).max(256) }).strict();
const principalDto = z.object({ key: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), displayName: z.string().trim().min(1).max(160) }).strict();
const scopeDto = z.object({ scope: z.enum(OIC_SCOPES) }).strict();
const credentialDto = z.object({ expiresAt: z.string().datetime({ offset: true }).nullable().optional(), replacesId: z.string().uuid().nullable().optional() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException("Request validation failed");
  return parsed.data;
}
function auditContext(request: RequestWithIds): AuditContext {
  const header = request.headers["x-trace-id"];
  const trace = Array.isArray(header) ? header[0] : header;
  return { requestId: request.requestId, traceId: trace };
}
function idempotencyKey(headers: Record<string, string | string[] | undefined>): string {
  const value = headers["idempotency-key"];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

@ApiTags("OIC Foundation Administration")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class FoundationController {
  constructor(private readonly foundation: FoundationService) {}

  @Version("1")
  @Post("applications")
  @RequireScopes("oic:foundation:admin")
  createApplication(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    return this.foundation.createApplication(actor, parse(appDto, body), idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Get("applications/:applicationId")
  @RequireScopes("oic:applications:read")
  getApplication(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) id: string) { return this.foundation.getApplication(actor, id); }

  @Version("1")
  @Get("applications/by-key/:key")
  @RequireScopes("oic:applications:read")
  getApplicationByKey(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("key") key: string) {
    return this.foundation.getApplicationByKey(actor, key);
  }

  @Version("1")
  @Post("applications/:applicationId/tenants")
  @RequireScopes("oic:tenants:manage")
  createTenant(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    return this.foundation.createTenant(actor, appId, parse(tenantDto, body), idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Get("applications/:applicationId/tenants/by-external-reference/:sourceType/:externalId")
  @RequireScopes("oic:tenants:read")
  getTenantByExternalReference(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("sourceType") sourceType: string, @Param("externalId") externalId: string) {
    return this.foundation.getTenantByExternalReference(actor, appId, sourceType, externalId);
  }

  @Version("1")
  @Get("tenants/:tenantId")
  @RequireScopes("oic:tenants:read")
  getTenant(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("tenantId", ParseUUIDPipe) tenantId: string) { return this.foundation.getTenant(actor, tenantId); }

  @Version("1")
  @Post("applications/:applicationId/tenants/:tenantId/external-references")
  @RequireScopes("oic:tenants:manage")
  createExternalReference(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("tenantId", ParseUUIDPipe) tenantId: string, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    return this.foundation.createExternalReference(actor, appId, tenantId, parse(externalDto, body), idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Post("applications/:applicationId/service-principals")
  @RequireScopes("oic:principals:manage")
  createPrincipal(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    return this.foundation.createPrincipal(actor, appId, parse(principalDto, body), idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Post("applications/:applicationId/service-principals/:principalId/scopes")
  @RequireScopes("oic:principals:manage")
  grantScope(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("principalId", ParseUUIDPipe) principalId: string, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    return this.foundation.grantScope(actor, appId, principalId, parse(scopeDto, body).scope, idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Delete("applications/:applicationId/service-principals/:principalId/scopes")
  @RequireScopes("oic:principals:manage")
  revokeScope(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("principalId", ParseUUIDPipe) principalId: string, @Body() body: unknown, @Req() req: RequestWithIds) {
    const parsed = scopeDto.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Request validation failed");
    return this.foundation.revokeScope(actor, appId, principalId, parsed.data.scope, auditContext(req));
  }
  @Version("1")
  @Post("applications/:applicationId/service-principals/:principalId/tenants/:tenantId/grant")
  @RequireScopes("oic:tenants:manage")
  grantTenant(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("principalId", ParseUUIDPipe) principalId: string, @Param("tenantId", ParseUUIDPipe) tenantId: string, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    return this.foundation.grantTenant(actor, appId, principalId, tenantId, idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Delete("applications/:applicationId/service-principals/:principalId/tenants/:tenantId/grant")
  @RequireScopes("oic:tenants:manage")
  revokeTenant(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("principalId", ParseUUIDPipe) principalId: string, @Param("tenantId", ParseUUIDPipe) tenantId: string, @Req() req: RequestWithIds) {
    return this.foundation.revokeTenant(actor, appId, principalId, tenantId, auditContext(req));
  }

  @Version("1")
  @Post("applications/:applicationId/service-principals/:principalId/credentials")
  @RequireScopes("oic:credentials:rotate")
  issueCredential(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("principalId", ParseUUIDPipe) principalId: string, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    const dto = parse(credentialDto, body ?? {});
    return this.foundation.issueCredential(actor, appId, principalId, dto.expiresAt ? new Date(dto.expiresAt) : null, dto.replacesId ?? null, idempotencyKey(headers), auditContext(req));
  }

  @Version("1")
  @Delete("applications/:applicationId/credentials/:credentialId")
  @RequireScopes("oic:credentials:revoke")
  revokeCredential(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("credentialId", ParseUUIDPipe) credentialId: string, @Req() req: RequestWithIds) { return this.foundation.revokeCredential(actor, appId, credentialId, auditContext(req)); }

  @Version("1")
  @Delete("applications/:applicationId/external-references/:referenceId")
  @RequireScopes("oic:tenants:manage")
  revokeExternalReference(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("referenceId", ParseUUIDPipe) referenceId: string, @Req() req: RequestWithIds) {
    return this.foundation.revokeExternalReference(actor, appId, referenceId, auditContext(req));
  }

  @Version("1")
  @Patch("applications/:applicationId/external-references/:referenceId")
  @RequireScopes("oic:tenants:manage")
  remapExternalReference(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("referenceId", ParseUUIDPipe) referenceId: string, @Body() body: unknown, @Headers() headers: RequestWithIds["headers"], @Req() req: RequestWithIds) {
    const parsed = z.object({ tenantId: z.string().uuid() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Request validation failed");
    return this.foundation.remapExternalReference(actor, appId, referenceId, parsed.data.tenantId, idempotencyKey(headers), auditContext(req));
  }
  @Version("1")
  @Get("applications/:applicationId/service-principals/:principalId")
  @RequireScopes("oic:principals:read")
  getPrincipal(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("principalId", ParseUUIDPipe) principalId: string) {
    return this.foundation.getPrincipal(actor, appId, principalId);
  }

  @Version("1")
  @Post("applications/:applicationId/:kind/:id/status")
  @RequireScopes("oic:foundation:admin")
  changeLifecycle(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) appId: string, @Param("kind") kind: string, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: RequestWithIds) {
    const parsedKind = z.enum(["application", "tenant", "principal"]).safeParse(kind);
    const parsedBody = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]) }).strict().safeParse(body);
    if (!parsedKind.success || !parsedBody.success) throw new BadRequestException("Request validation failed");
    return this.foundation.changeLifecycle(actor, parsedKind.data, appId, id, parsedBody.data.status, auditContext(req));
  }
  @Version("1")
  @Get("audit")
  @RequireScopes("oic:audit:read")
  readAudit(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") appId?: string, @Query("limit") limit?: string) {
    if (appId && !z.string().uuid().safeParse(appId).success) throw new BadRequestException("Request validation failed");
    const size = limit === undefined ? 50 : Number(limit);
    if (!Number.isInteger(size) || size < 1 || size > 100) throw new BadRequestException("Request validation failed");
    return this.foundation.readAudit(actor, appId, size);
  }
}
