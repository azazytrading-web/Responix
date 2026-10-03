import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { IntelligenceProfileService } from "./intelligence-profile.service";
import { policyInputSchema } from "./engines/profile-policy";
import { IntelligenceDataService } from "./intelligence-data.service";

type RequestWithIds = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const traceHeader = (request: RequestWithIds) => { const value = request.headers["x-trace-id"]; return Array.isArray(value) ? value[0] : value; };
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new BadRequestException("Request validation failed"); return result.data; }
const identitySchema = z.object({ profileKey: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/), displayName: z.string().trim().min(1).max(160), description: z.string().max(1000).optional() }).strict();
const createSchema = identitySchema.extend({ policy: policyInputSchema }).strict();
const lifecycleSchema = z.object({ lifecycle: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]) }).strict();
const evidenceDependencySchema = z.object({ sourceKey: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/i), sourceRef: z.string().trim().min(1).max(512) }).strict();
const knowledgeSchema = z.object({ tenantId: z.string().uuid().optional(), sourceKey: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/i), sourceRef: z.string().trim().min(1).max(512), title: z.string().trim().min(1).max(240), content: z.string().trim().min(1).max(200_000), dependsOn: z.array(evidenceDependencySchema).max(16).default([]), authority: z.number().int().min(0).max(100).default(50), sourcePriority: z.number().int().min(0).max(100).default(50) }).strict();
const knowledgeUpdateSchema = z.object({ title: z.string().trim().min(1).max(240).optional(), authority: z.number().int().min(0).max(100).optional(), sourcePriority: z.number().int().min(0).max(100).optional(), dependsOn: z.array(evidenceDependencySchema).max(16).optional(), lifecycle: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).optional() }).strict();
const memorySchema = z.object({ tenantId: z.string().uuid().optional(), kind: z.enum(["EPISODIC", "SEMANTIC", "PROCEDURAL", "SESSION", "APPLICATION"]), sensitivity: z.enum(["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"]).default("INTERNAL"), title: z.string().trim().min(1).max(240), content: z.string().trim().min(1).max(20_000), sourceType: z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/i), sourceRef: z.string().max(256).optional(), confidence: z.number().int().min(0).max(100).default(50), salience: z.number().int().min(0).max(100).default(50), sessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/).optional(), validUntil: z.string().datetime({ offset: true }).optional() }).strict();
const memoryUpdateSchema = z.object({ lifecycle: z.enum(["ACTIVE", "STALE", "SUPERSEDED", "CONFLICTED", "UNVERIFIED", "ARCHIVED"]).optional(), sensitivity: z.enum(["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"]).optional(), validUntil: z.string().datetime({ offset: true }).nullable().optional() }).strict();

@ApiTags("OIC Intelligence Profiles")
@ApiBearerAuth()
@Controller("admin/intelligence")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class IntelligenceController {
  constructor(private readonly profiles: IntelligenceProfileService, private readonly data: IntelligenceDataService) {}

  @Version("1") @Get("profiles") @RequireScopes("oic:models:read")
  list(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.profiles.list(actor); }

  @Version("1") @Get("profiles/:profileId") @RequireScopes("oic:models:read")
  get(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("profileId", ParseUUIDPipe) id: string) { return this.profiles.get(actor, id); }

  @Version("1") @Post("profiles") @RequireScopes("oic:models:manage")
  create(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) { return this.profiles.create(actor, parse(createSchema, body), { requestId: request.requestId, traceId: traceHeader(request) }); }

  @Version("1") @Post("profiles/:profileId/clone") @RequireScopes("oic:models:manage")
  clone(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("profileId", ParseUUIDPipe) profileId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    const input = parse(identitySchema, body);
    return this.profiles.clone(actor, profileId, input, { requestId: request.requestId, traceId: traceHeader(request) });
  }

  @Version("1") @Post("profiles/:profileId/revisions") @RequireScopes("oic:models:manage")
  revision(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("profileId", ParseUUIDPipe) profileId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    const policy = parse(policyInputSchema, body);
    return this.profiles.createRevision(actor, profileId, policy, { requestId: request.requestId, traceId: traceHeader(request) });
  }

  @Version("1") @Patch("profiles/:profileId/lifecycle") @RequireScopes("oic:models:manage")
  lifecycle(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("profileId", ParseUUIDPipe) profileId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    const { lifecycle } = parse(lifecycleSchema, body);
    return this.profiles.changeLifecycle(actor, profileId, lifecycle, { requestId: request.requestId, traceId: traceHeader(request) });
  }

  @Version("1") @Get("executions") @RequireScopes("oic:models:read")
  executions(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("limit") limit?: string) { return this.profiles.listExecutions(actor, Number(limit) || 50); }

  @Version("1") @Get("executions/:traceId") @RequireScopes("oic:models:read")
  execution(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("traceId") traceId: string) { return this.profiles.getExecution(actor, traceId); }

  @Version("1") @Get("knowledge") @RequireScopes("oic:models:read")
  knowledge(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("tenantId") tenantId?: string, @Query("q") q?: string, @Query("lifecycle") lifecycle?: "ACTIVE" | "DISABLED" | "ARCHIVED") { return this.data.listKnowledge(actor, { tenantId, q, lifecycle }); }
  @Version("1") @Get("knowledge/:id") @RequireScopes("oic:models:read")
  inspectKnowledge(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.data.inspectKnowledge(actor, id); }
  @Version("1") @Post("knowledge") @RequireScopes("oic:models:manage")
  createKnowledge(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) { const input = parse(knowledgeSchema, body); return this.data.createKnowledge(actor, { ...input, authority: input.authority ?? 50, sourcePriority: input.sourcePriority ?? 50 }, { requestId: request.requestId, traceId: traceHeader(request) }); }
  @Version("1") @Patch("knowledge/:id") @RequireScopes("oic:models:manage")
  updateKnowledge(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: RequestWithIds) { return this.data.updateKnowledge(actor, id, parse(knowledgeUpdateSchema, body), { requestId: request.requestId, traceId: traceHeader(request) }); }

  @Version("1") @Get("memory") @RequireScopes("oic:models:read")
  memory(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("tenantId") tenantId?: string, @Query("q") q?: string, @Query("kind") kind?: string, @Query("lifecycle") lifecycle?: string) { return this.data.listMemory(actor, { tenantId, q, kind, lifecycle }); }
  @Version("1") @Post("memory") @RequireScopes("oic:models:manage")
  createMemory(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) { const input = parse(memorySchema, body); return this.data.createMemory(actor, { ...input, sensitivity: input.sensitivity ?? "INTERNAL", confidence: input.confidence ?? 50, salience: input.salience ?? 50 }, { requestId: request.requestId, traceId: traceHeader(request) }); }
  @Version("1") @Get("memory/:id") @RequireScopes("oic:models:read")
  inspectMemory(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.data.inspectMemory(actor, id); }
  @Version("1") @Patch("memory/:id") @RequireScopes("oic:models:manage")
  updateMemory(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: RequestWithIds) { return this.data.updateMemory(actor, id, parse(memoryUpdateSchema, body), { requestId: request.requestId, traceId: traceHeader(request) }); }
}
