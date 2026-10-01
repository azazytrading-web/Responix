import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { OIC_UPSTREAM_CAPABILITIES, ModelFabricService } from "./model-fabric.service";

type RequestWithIds = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const traceHeader = (request: RequestWithIds) => {
  const value = request.headers["x-trace-id"];
  return Array.isArray(value) ? value[0] : value;
};
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Request validation failed");
  return result.data;
}
const evidenceDto = z.object({
  capability: z.enum(OIC_UPSTREAM_CAPABILITIES), status: z.enum(["SUPPORTED", "UNSUPPORTED", "UNKNOWN"]), sourceRef: z.string().trim().min(1).max(256).optional()
}).strict();
const hasControlCharacters = (value: string) => [...value].some((character) => {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
});
const pricingDto = z.union([
  z.object({ status: z.literal("UNKNOWN"), sourceRef: z.string().trim().min(1).max(256).optional() }).strict(),
  z.object({
    status: z.literal("KNOWN"), inputRate: z.number().finite().nonnegative().nullable().optional(),
    outputRate: z.number().finite().nonnegative().nullable().optional(), cachedInputRate: z.number().finite().nonnegative().nullable().optional(),
    currency: z.literal("USD"), unit: z.literal("USD_PER_MILLION_TOKENS").optional(),
    sourceRef: z.string().trim().min(1).max(256).optional(), effectiveAt: z.string().datetime({ offset: true })
  }).strict().refine((value) => value.inputRate != null || value.outputRate != null || value.cachedInputRate != null)
]);
const syncDto = z.object({ models: z.array(z.object({
  upstreamModelId: z.string().min(1).max(256).refine((value) => value.trim().length > 0 && !hasControlCharacters(value)),
  displayName: z.string().trim().min(1).max(160), family: z.string().trim().max(128).optional(),
  contextLimit: z.number().int().positive().max(10_000_000).optional(), outputLimit: z.number().int().positive().max(10_000_000).optional(),
  capabilities: z.array(evidenceDto).max(32).optional(), pricing: pricingDto.optional()
}).strict()).max(500) }).strict();
const catalogRequestDto = z.union([syncDto, z.object({ source: z.literal("provider") }).strict()]);
const familyDto = z.object({ familyKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/), displayName: z.string().trim().min(1).max(160) }).strict();
const editionDto = z.object({
  publicId: z.string().regex(/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/).max(64),
  editionKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/), displayName: z.string().trim().min(1).max(160), domain: z.string().trim().min(1).max(128).optional()
}).strict();
const revisionDto = z.object({ instructions: z.string().max(100_000).optional(), specification: z.string().max(100_000).optional() }).strict();
const variantDto = z.object({ variantKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/), upstreamModelId: z.string().uuid(), transportProfile: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/) }).strict();
const bindingDto = z.object({
  variantId: z.string().uuid(), connectionId: z.string().uuid(), scope: z.enum(["PLATFORM", "APPLICATION", "TENANT"]),
  applicationId: z.string().uuid().optional(), tenantId: z.string().uuid().optional(), environment: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).optional()
}).strict();
const visibilityDto = z.object({ visible: z.boolean() }).strict();
const lifecycleDto = z.object({ lifecycle: z.enum(["DRAFT", "EXPERIMENTAL", "CANDIDATE", "CANARY", "PRODUCTION", "MAINTENANCE", "DEPRECATED", "RETIRED"]) }).strict();
const bindingStatusDto = z.object({ status: z.enum(["DRAFT", "ACTIVE", "DISABLED"]) }).strict();
const catalogLifecycleDto = z.object({ lifecycle: z.enum(["ACTIVE", "DISABLED", "DEPRECATED", "ARCHIVED"]) }).strict();

@ApiTags("OIC Provider and Oi Model Administration")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class ModelFabricController {
  constructor(private readonly models: ModelFabricService) {}

  @Version("1")
  @Get("provider-connections/:connectionId/upstream-models")
  @RequireScopes("oic:catalog:read")
  listUpstreamModels(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("connectionId", ParseUUIDPipe) connectionId: string) { return this.models.listUpstreamModels(actor, connectionId); }

  @Version("1")
  @Patch("upstream-models/:upstreamModelId/lifecycle")
  @RequireScopes("oic:catalog:manage")
  changeUpstreamModelLifecycle(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("upstreamModelId", ParseUUIDPipe) upstreamModelId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.changeUpstreamModelLifecycle(actor, upstreamModelId, parse(catalogLifecycleDto, body).lifecycle, request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("provider-connections/:connectionId/catalog/sync")
  @RequireScopes("oic:catalog:manage")
  syncManualCatalog(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("connectionId", ParseUUIDPipe) connectionId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    const input = parse(catalogRequestDto, body);
    return "source" in input
      ? this.models.syncFixtureCatalog(actor, connectionId, request.requestId, traceHeader(request))
      : this.models.syncManualCatalog(actor, connectionId, input.models, request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("provider-connections/:connectionId/catalog/preview")
  @RequireScopes("oic:catalog:manage")
  previewManualCatalog(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("connectionId", ParseUUIDPipe) connectionId: string, @Body() body: unknown) {
    const input = parse(catalogRequestDto, body);
    return "source" in input
      ? this.models.previewFixtureCatalog(actor, connectionId)
      : this.models.previewManualCatalog(actor, connectionId, input.models);
  }

  @Version("1")
  @Post("model-families")
  @RequireScopes("oic:models:manage")
  createFamily(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.createFamily(actor, parse(familyDto, body), request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("model-families/:familyId/editions")
  @RequireScopes("oic:models:manage")
  createEdition(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("familyId", ParseUUIDPipe) familyId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.createEdition(actor, familyId, parse(editionDto, body), request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("model-editions/:editionId/revisions")
  @RequireScopes("oic:models:manage")
  createRevision(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("editionId", ParseUUIDPipe) editionId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.createRevision(actor, editionId, parse(revisionDto, body), request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("model-revisions/:revisionId/variants")
  @RequireScopes("oic:models:manage")
  createVariant(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("revisionId", ParseUUIDPipe) revisionId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.createVariant(actor, revisionId, parse(variantDto, body), request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("model-editions/:editionId/runtime-bindings")
  @RequireScopes("oic:models:manage")
  createBinding(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("editionId", ParseUUIDPipe) editionId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.createBinding(actor, editionId, parse(bindingDto, body), request.requestId, traceHeader(request));
  }

  @Version("1")
  @Patch("runtime-bindings/:bindingId/status")
  @RequireScopes("oic:models:manage")
  changeBindingStatus(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("bindingId", ParseUUIDPipe) bindingId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.changeBindingStatus(actor, bindingId, parse(bindingStatusDto, body).status, request.requestId, traceHeader(request));
  }

  @Version("1")
  @Patch("model-editions/:editionId/lifecycle")
  @RequireScopes("oic:models:manage")
  changeEditionLifecycle(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("editionId", ParseUUIDPipe) editionId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.changeEditionLifecycle(actor, editionId, parse(lifecycleDto, body).lifecycle, request.requestId, traceHeader(request));
  }

  @Version("1")
  @Post("applications/:applicationId/models/:editionId/visibility")
  @RequireScopes("oic:models:manage")
  setVisibility(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("applicationId", ParseUUIDPipe) applicationId: string, @Param("editionId", ParseUUIDPipe) editionId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.models.setVisibility(actor, applicationId, editionId, parse(visibilityDto, body).visible, request.requestId, traceHeader(request));
  }
}
