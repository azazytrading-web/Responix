import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { EconomicsService } from "./economics.service";

type RequestWithIds = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const dimension = z.enum(["inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "internalComputeUnits", "retrievalUnits", "toolUnits", "imageInputUnits", "imageOutputUnits", "audioInputSeconds", "audioOutputSeconds", "videoSeconds", "embeddingTokens", "rerankUnits", "requestUnits", "cacheWriteTokens", "batchTokens", "priorityTokens", "storageByteHours"]);
const decimal = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/).max(60);
const scope = { applicationId: z.string().uuid().optional(), tenantId: z.string().uuid().optional() };
const providerBook = z.object({
  ...scope, connectionId: z.string().uuid().optional(), providerKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/), currency: z.string().regex(/^[A-Z]{3}$/),
  sourceQuality: z.enum(["PROVIDER_CONTRACT", "PROVIDER_INVOICE", "STANDARD_PUBLISHED", "OPERATOR_ESTIMATE"]), sourceReference: z.string().trim().min(1).max(256),
  effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().optional(),
  rates: z.array(z.object({ upstreamModelId: z.string().min(1).max(256).optional(), dimension, unit: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), quantityDivisor: decimal.optional(), pricePerUnit: decimal, required: z.boolean().optional() }).strict()).min(1).max(128)
}).strict();
const oiuPolicy = z.object({
  ...scope, policyKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), minimumIncrement: decimal, effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().optional(),
  dimensions: z.array(z.object({ dimension, unit: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), weightNumerator: decimal.optional(), weightDenominator: decimal.optional(), required: z.boolean().optional(), included: z.boolean().optional() }).strict()).min(1).max(32)
}).strict();
const reconcileDto = z.object({ cursor: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).default(50) }).strict();
const customerRule = z.object({ dimension: dimension.optional(), unit: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/).optional(), pricePerUnit: decimal.optional(), quantityDivisor: decimal.optional(), fixedAmount: decimal.optional(), includedQuantity: decimal.optional(), tiers: z.array(z.object({ upTo: decimal.nullable(), pricePerUnit: decimal }).strict()).max(64).optional() }).strict();
const customerBook = z.object({ ...scope, planRevisionId: z.string().uuid(), priceBookKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), strategy: z.enum(["OIU_RATE", "RESOURCE_RATE", "REQUEST", "TASK", "FEATURE", "TIERED", "INCLUDED_PLUS_OVERAGE", "FIXED_PLUS_VARIABLE"]), currency: z.string().regex(/^[A-Z]{3}$/), sourceReference: z.string().trim().min(1).max(256), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().optional(), rules: z.array(customerRule).min(1).max(64) }).strict();
const fxEvidence = z.object({ baseCurrency: z.string().regex(/^[A-Z]{3}$/), quoteCurrency: z.string().regex(/^[A-Z]{3}$/), rate: decimal, source: z.string().trim().min(1).max(128), sourceReference: z.string().trim().min(1).max(256), policyRevision: z.string().trim().min(1).max(64), effectiveAt: z.coerce.date() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Request validation failed");
  return result.data;
}
function correlation(request: RequestWithIds) {
  const trace = request.headers["x-trace-id"];
  return { requestId: request.requestId, traceId: Array.isArray(trace) ? trace[0] : trace };
}
function limit(raw?: string): number {
  if (raw === undefined) return 50;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new BadRequestException("Invalid page size");
  return value;
}

@ApiTags("OIC Economics")
@ApiBearerAuth()
@Controller("admin/economics")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class EconomicsController {
  constructor(private readonly economics: EconomicsService) {}

  @Version("1") @Get("policies") policies(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.economics.listPolicies(actor); }
  @Version("1") @Get("rate-books") rateBooks(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.economics.listRateBooks(actor); }
  @Version("1") @Get("costs") costs(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("cursor") cursor?: string, @Query("limit") rawLimit?: string) { return this.economics.listAssessments(actor, "cost", cursor, limit(rawLimit)); }
  @Version("1") @Get("oiu") oiu(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("cursor") cursor?: string, @Query("limit") rawLimit?: string) { return this.economics.listAssessments(actor, "oiu", cursor, limit(rawLimit)); }
  @Version("1") @Get("customer-price-books") customerPriceBooks(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.economics.listCustomerPriceBooks(actor); }
  @Version("1") @Get("rated") rated(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("cursor") cursor?: string, @Query("limit") rawLimit?: string) { return this.economics.listRatedUsage(actor, cursor, limit(rawLimit)); }
  @Version("1") @Get("fx-evidence") fxEvidence(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("limit") rawLimit?: string) { return this.economics.listFxRateEvidence(actor, limit(rawLimit)); }

  @Version("1") @Post("rate-books") createRateBook(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.economics.createProviderRateBook(actor, parse(providerBook, body), correlation(request));
  }
  @Version("1") @Post("rate-books/:id/publish") publishRateBook(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    return this.economics.publishProviderRateBook(actor, id, correlation(request));
  }
  @Version("1") @Post("oiu/policies") createPolicy(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.economics.createOiuPolicy(actor, parse(oiuPolicy, body), correlation(request));
  }
  @Version("1") @Post("oiu/policies/:id/publish") publishPolicy(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    return this.economics.publishOiuPolicy(actor, id, correlation(request));
  }
  @Version("1") @Post("costs/:usageEventId/assess") costAssessment(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("usageEventId", ParseUUIDPipe) id: string, @Query("kind") kind: string | undefined, @Req() request: RequestWithIds) {
    if (kind !== undefined && kind !== "ORIGINAL" && kind !== "REPLAY") throw new BadRequestException("Invalid assessment kind");
    return this.economics.assessProviderCost(actor, id, kind === "REPLAY" ? "REPLAY" : "ORIGINAL", correlation(request));
  }
  @Version("1") @Post("oiu/:usageEventId/assess") oiuAssessment(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("usageEventId", ParseUUIDPipe) id: string, @Query("kind") kind: string | undefined, @Query("policyKey") policyKey: string | undefined, @Req() request: RequestWithIds) {
    if (kind !== undefined && kind !== "ORIGINAL" && kind !== "REPLAY") throw new BadRequestException("Invalid assessment kind");
    if (policyKey !== undefined && !/^[a-z][a-z0-9-]{1,63}$/.test(policyKey)) throw new BadRequestException("Invalid policy key");
    return this.economics.assessOiu(actor, id, kind === "REPLAY" ? "REPLAY" : "ORIGINAL", correlation(request), policyKey ?? "default");
  }
  @Version("1") @Post("reconcile") reconcile(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    const input = parse(reconcileDto, body);
    return this.economics.reconcile(actor, { cursor: input.cursor, limit: input.limit ?? 50 }, correlation(request));
  }
  @Version("1") @Post("customer-price-books") createCustomerPriceBook(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.economics.createCustomerPriceBook(actor, parse(customerBook, body), correlation(request));
  }
  @Version("1") @Post("customer-price-books/:id/publish") publishCustomerPriceBook(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    return this.economics.publishCustomerPriceBook(actor, id, correlation(request));
  }
  @Version("1") @Post("rated/:usageEventId/rate") rateCustomerUsage(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("usageEventId", ParseUUIDPipe) id: string, @Query("kind") kind: string | undefined, @Req() request: RequestWithIds) {
    if (kind !== undefined && kind !== "ORIGINAL" && kind !== "REPLAY") throw new BadRequestException("Invalid rating kind");
    return this.economics.rateCustomerUsage(actor, id, kind === "REPLAY" ? "REPLAY" : "ORIGINAL", correlation(request));
  }
  @Version("1") @Post("rated/:id/adjustments") adjustRatedUsage(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    const input = parse(z.object({ sourceKey: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/), kind: z.enum(["CREDIT", "REVERSAL"]), amount: decimal.optional(), reason: z.string().trim().min(1).max(256) }).strict(), body);
    return this.economics.createRatedAdjustment(actor, id, input, correlation(request));
  }
  @Version("1") @Post("fx-evidence") createFxEvidence(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    return this.economics.createFxRateEvidence(actor, parse(fxEvidence, body), correlation(request));
  }
}
