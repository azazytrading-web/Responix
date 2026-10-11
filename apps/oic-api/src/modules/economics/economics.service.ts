import { ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import Decimal from "decimal.js";
import { createHash } from "node:crypto";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { hasOicConsoleManage, hasOicConsoleRead } from "../identity/foundation-policy";
import { AdmissionService } from "../admission/admission.service";

const PRODUCER_VERSION = "oic-economics-v1";
Decimal.set({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -100, toExpPos: 100 });
const dimensions = ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "internalComputeUnits", "retrievalUnits", "toolUnits", "imageInputUnits", "imageOutputUnits", "audioInputSeconds", "audioOutputSeconds", "videoSeconds", "embeddingTokens", "rerankUnits", "requestUnits", "cacheWriteTokens", "batchTokens", "priorityTokens", "storageByteHours"] as const;
type Dimension = typeof dimensions[number];
type DimensionInput = { dimension: Dimension; unit: string; required?: boolean; included?: boolean; weightNumerator?: string; weightDenominator?: string };
type RateInput = { upstreamModelId?: string; dimension: Dimension; unit: string; quantityDivisor?: string; pricePerUnit: string; required?: boolean };
type Correlation = { requestId?: string; traceId?: string };
type ScopeInput = { applicationId?: string; tenantId?: string };
const dimensionUnits: Record<Dimension, string> = {
  inputTokens: "TOKENS", cachedInputTokens: "TOKENS", outputTokens: "TOKENS", reasoningTokens: "TOKENS", embeddingTokens: "TOKENS", cacheWriteTokens: "TOKENS", batchTokens: "TOKENS", priorityTokens: "TOKENS",
  internalComputeUnits: "UNITS", retrievalUnits: "UNITS", toolUnits: "UNITS", imageInputUnits: "UNITS", imageOutputUnits: "UNITS", rerankUnits: "UNITS", requestUnits: "REQUESTS",
  audioInputSeconds: "SECONDS", audioOutputSeconds: "SECONDS", videoSeconds: "SECONDS", storageByteHours: "BYTE_HOURS"
};

function sha(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function dec(value: string, allowZero = true): Decimal {
  if (typeof value !== "string" || value.length > 60 || !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) throw new Error("Invalid nonnegative decimal value");
  if (value.split(".")[0]!.length > 20) throw new Error("Decimal value exceeds the supported precision");
  const result = new Decimal(value);
  if (!result.isFinite() || result.isNegative() || (!allowZero && result.isZero())) throw new Error("Invalid nonnegative decimal value");
  return result;
}
function assertDateRange(from: Date, to?: Date): void {
  if (!Number.isFinite(from.getTime()) || (to && (!Number.isFinite(to.getTime()) || to <= from))) throw new Error("Invalid effective interval");
}
function overlap(aFrom: Date, aTo: Date | null, bFrom: Date, bTo: Date | null): boolean {
  return (!aTo || bFrom < aTo) && (!bTo || aFrom < bTo);
}
function toInputJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

@Injectable()
export class EconomicsService {
  constructor(private readonly db: OicDatabaseService, @Optional() private readonly admissions?: AdmissionService) {}

  private requireRead(actor: AuthenticatedPrincipal): void {
    if (!hasOicConsoleRead(actor.scopes) && !actor.scopes.includes("oic:economics:read")) throw new ForbiddenException();
  }

  private requireManage(actor: AuthenticatedPrincipal): void {
    if (!hasOicConsoleManage(actor.scopes) && !actor.scopes.includes("oic:economics:manage")) throw new ForbiddenException();
  }

  private validateScope(actor: AuthenticatedPrincipal, scope: ScopeInput): { applicationId: string | null; tenantId: string | null } {
    const globalAdmin = hasOicConsoleManage(actor.scopes);
    if (scope.tenantId && (!scope.applicationId || (!globalAdmin && (scope.applicationId !== actor.applicationId || !actor.tenantIds.includes(scope.tenantId))))) throw new ForbiddenException();
    if (scope.applicationId && !globalAdmin && scope.applicationId !== actor.applicationId) throw new ForbiddenException();
    if (!scope.applicationId && !globalAdmin) throw new ForbiddenException();
    return { applicationId: scope.applicationId ?? null, tenantId: scope.tenantId ?? null };
  }

  async createProviderRateBook(actor: AuthenticatedPrincipal, input: ScopeInput & {
    connectionId?: string; providerKey: string; currency: string; sourceQuality: string; sourceReference?: string;
    effectiveFrom: Date; effectiveTo?: Date; rates: RateInput[];
  }, correlation: Correlation = {}) {
    this.requireManage(actor);
    const scope = this.validateScope(actor, input);
    assertDateRange(input.effectiveFrom, input.effectiveTo);
    if (!/^[A-Z]{3}$/.test(input.currency) || input.rates.length === 0) throw new Error("A currency and at least one provider rate are required");
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(input.providerKey)) throw new Error("Invalid provider key");
    const sourceQuality = ["PROVIDER_CONTRACT", "PROVIDER_INVOICE", "STANDARD_PUBLISHED", "OPERATOR_ESTIMATE"].includes(input.sourceQuality) ? input.sourceQuality : null;
    if (!sourceQuality || !input.sourceReference?.trim()) throw new Error("A source quality and traceable source reference are required");
    if (input.connectionId) {
      const connection = await this.db.oicProviderConnection.findUnique({ where: { id: input.connectionId }, select: { applicationId: true, tenantId: true, providerDefinition: { select: { key: true } } } });
      if (!connection || connection.providerDefinition.key !== input.providerKey || (scope.applicationId && connection.applicationId !== scope.applicationId) || (scope.tenantId && connection.tenantId !== scope.tenantId)) throw new NotFoundException();
      if (!hasOicConsoleManage(actor.scopes) && connection.applicationId !== actor.applicationId) throw new ForbiddenException();
    }
    const rateRows = input.rates.map((rate) => {
      if (!dimensions.includes(rate.dimension) || rate.unit !== dimensionUnits[rate.dimension]) throw new Error("Invalid provider rate dimension or unit");
      const divisor = dec(rate.quantityDivisor ?? "1", false);
      const amount = dec(rate.pricePerUnit);
      return { upstreamModelId: rate.upstreamModelId ?? null, dimension: rate.dimension, unit: rate.unit, quantityDivisor: divisor.toFixed(), pricePerUnit: amount.toFixed(), required: rate.required ?? true };
    });
    const duplicate = new Set<string>();
    for (const rate of rateRows) {
      const key = `${rate.upstreamModelId ?? "*"}:${rate.dimension}`;
      if (duplicate.has(key)) throw new Error("Duplicate provider rate selector");
      duplicate.add(key);
    }
    const sourceDigest = sha({ scope, connectionId: input.connectionId ?? null, providerKey: input.providerKey, currency: input.currency, sourceQuality, sourceReference: input.sourceReference ?? null, effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() ?? null, rates: rateRows });
    return this.db.$transaction(async (tx) => {
      const revision = await tx.oicProviderRateBookRevision.aggregate({ where: { ...scope, connectionId: input.connectionId ?? null, providerKey: input.providerKey }, _max: { revision: true } });
      const row = await tx.oicProviderRateBookRevision.create({ data: {
        ...scope, connectionId: input.connectionId ?? null, revision: (revision._max.revision ?? 0) + 1, providerKey: input.providerKey,
        currency: input.currency, sourceQuality, sourceReference: input.sourceReference, sourceDigest, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo,
        rates: { create: rateRows }
      }, include: { rates: true } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: scope.applicationId, tenantId: scope.tenantId, action: "economics.provider-rate-book.drafted", targetType: "provider-rate-book", targetId: row.id, requestId: correlation.requestId, traceId: correlation.traceId, metadata: { revision: row.revision, sourceDigest } } });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async publishProviderRateBook(actor: AuthenticatedPrincipal, id: string, correlation: Correlation = {}) {
    this.requireManage(actor);
    const row = await this.db.oicProviderRateBookRevision.findUnique({ where: { id }, include: { rates: true } });
    if (!row) throw new NotFoundException();
    this.assertCanManageExisting(actor, row.applicationId, row.tenantId);
    if (row.status !== "DRAFT" || row.rates.length === 0) throw new ConflictException("Only a populated draft rate book can be published");
    const updated = await this.db.$transaction(async (tx) => {
      const published = await tx.oicProviderRateBookRevision.findMany({ where: { status: "PUBLISHED", providerKey: row.providerKey, applicationId: row.applicationId, tenantId: row.tenantId, connectionId: row.connectionId, NOT: { id: row.id } } });
      if (published.some((other) => overlap(row.effectiveFrom, row.effectiveTo, other.effectiveFrom, other.effectiveTo))) throw new ConflictException("A provider rate book already covers this scope and effective interval");
      const result = await tx.oicProviderRateBookRevision.update({ where: { id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() }, include: { rates: true } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: "economics.provider-rate-book.published", targetType: "provider-rate-book", targetId: id, requestId: correlation.requestId, traceId: correlation.traceId, metadata: { revision: row.revision, sourceDigest: row.sourceDigest } } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return updated;
  }

  async createOiuPolicy(actor: AuthenticatedPrincipal, input: ScopeInput & {
    policyKey: string; minimumIncrement: string; effectiveFrom: Date; effectiveTo?: Date; dimensions: DimensionInput[];
  }, correlation: Correlation = {}) {
    this.requireManage(actor);
    const scope = this.validateScope(actor, input);
    assertDateRange(input.effectiveFrom, input.effectiveTo);
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(input.policyKey) || input.dimensions.length === 0) throw new Error("Policy key and dimension rules are required");
    const minimumIncrement = dec(input.minimumIncrement);
    const rules = input.dimensions.map((rule) => {
      if (!dimensions.includes(rule.dimension) || rule.unit !== dimensionUnits[rule.dimension]) throw new Error("Invalid OIU dimension or unit");
      if (rule.required === false && (rule.included ?? true)) throw new Error("Optional OIU dimensions must be explicitly excluded");
      const numerator = dec(rule.weightNumerator ?? "1");
      const denominator = dec(rule.weightDenominator ?? "1", false);
      return { dimension: rule.dimension, unit: rule.unit, weightNumerator: numerator.toFixed(), weightDenominator: denominator.toFixed(), required: rule.required ?? true, included: rule.included ?? true };
    });
    if (new Set(rules.map((rule) => rule.dimension)).size !== rules.length) throw new Error("Duplicate OIU dimension rule");
    const sourceDigest = sha({ scope, policyKey: input.policyKey, minimumIncrement: minimumIncrement.toFixed(), roundingMode: "HALF_EVEN", missingRule: "PARTIAL", effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() ?? null, dimensions: rules });
    return this.db.$transaction(async (tx) => {
      const prior = await tx.oicOiuPolicyRevision.aggregate({ where: { ...scope, policyKey: input.policyKey }, _max: { revision: true } });
      const row = await tx.oicOiuPolicyRevision.create({ data: {
        ...scope, policyKey: input.policyKey, revision: (prior._max.revision ?? 0) + 1, minimumIncrement: minimumIncrement.toFixed(), sourceDigest,
        effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, dimensions: { create: rules }
      }, include: { dimensions: true } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: scope.applicationId, tenantId: scope.tenantId, action: "economics.oiu-policy.drafted", targetType: "oiu-policy", targetId: row.id, requestId: correlation.requestId, traceId: correlation.traceId, metadata: { revision: row.revision, sourceDigest } } });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async publishOiuPolicy(actor: AuthenticatedPrincipal, id: string, correlation: Correlation = {}) {
    this.requireManage(actor);
    const row = await this.db.oicOiuPolicyRevision.findUnique({ where: { id }, include: { dimensions: true } });
    if (!row) throw new NotFoundException();
    this.assertCanManageExisting(actor, row.applicationId, row.tenantId);
    if (row.status !== "DRAFT" || row.dimensions.length === 0 || row.roundingMode !== "HALF_EVEN") throw new ConflictException("Only a valid draft OIU policy can be published");
    return this.db.$transaction(async (tx) => {
      const overlaps = await tx.oicOiuPolicyRevision.findMany({ where: { status: "PUBLISHED", policyKey: row.policyKey, applicationId: row.applicationId, tenantId: row.tenantId, NOT: { id } } });
      if (overlaps.some((other) => overlap(row.effectiveFrom, row.effectiveTo, other.effectiveFrom, other.effectiveTo))) throw new ConflictException("Published OIU policy intervals for this scope may not overlap");
      const updated = await tx.oicOiuPolicyRevision.update({ where: { id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() }, include: { dimensions: true } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: "economics.oiu-policy.published", targetType: "oiu-policy", targetId: id, requestId: correlation.requestId, traceId: correlation.traceId, metadata: { revision: row.revision, sourceDigest: row.sourceDigest } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assessOiu(actor: AuthenticatedPrincipal, usageEventId: string, kind: "ORIGINAL" | "REPLAY" = "ORIGINAL", correlation: Correlation = {}, policyKey = "default") {
    this.requireManage(actor);
    const event = await this.db.oicUsageEvent.findUnique({ where: { id: usageEventId }, include: { providerAttempt: true } });
    if (!event) throw new NotFoundException();
    this.assertCanManageExisting(actor, event.applicationId, event.tenantId);
    const policies = event.occurredAt ? await this.db.oicOiuPolicyRevision.findMany({ where: {
      policyKey, status: "PUBLISHED", effectiveFrom: { lte: event.occurredAt },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: event.occurredAt } }] },
        { OR: [{ applicationId: null }, { applicationId: event.applicationId }] },
        { OR: [{ tenantId: null }, { tenantId: event.tenantId }] }
      ]
    }, include: { dimensions: true } }) : [];
    const matching = policies.filter((item) => item.tenantId === event.tenantId || item.tenantId === null).sort((a, b) => Number(!!b.tenantId) - Number(!!a.tenantId) || Number(!!b.applicationId) - Number(!!a.applicationId));
    const policy = matching[0];
    if (matching.length > 1 && Number(!!matching[0]?.tenantId) === Number(!!matching[1]?.tenantId) && Number(!!matching[0]?.applicationId) === Number(!!matching[1]?.applicationId)) throw new ConflictException("OIU policy is ambiguous for this scope and time");
    const normalized = event.normalizedDimensions as Record<string, unknown>;
    const inputs: Record<string, { reported: string | null; rated: string | null }> = {};
    let sum = new Decimal(0);
    let complete = Boolean(policy);
    if (policy) for (const rule of policy.dimensions) {
      const raw = normalized[rule.dimension];
      const reported = typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? new Decimal(raw) : null;
      let value = reported;
      if (rule.dimension === "inputTokens" && policy.dimensions.some((candidate) => candidate.dimension === "cachedInputTokens" && candidate.included)) {
        const cachedRaw = normalized.cachedInputTokens;
        const cached = typeof cachedRaw === "number" && Number.isSafeInteger(cachedRaw) && cachedRaw >= 0 ? new Decimal(cachedRaw) : null;
        if (!reported || !cached || cached.gt(reported)) { complete = false; value = null; }
        else value = reported.minus(cached);
      }
      inputs[rule.dimension] = { reported: reported?.toFixed() ?? null, rated: value?.toFixed() ?? null };
      if (!rule.included) continue;
      if (!value) { complete = false; continue; }
      sum = sum.plus(value.mul(rule.weightNumerator.toString()).div(rule.weightDenominator.toString()));
    }
    const status = !policy ? "UNKNOWN" : complete ? "ASSESSED" : "PARTIAL";
    let amount: Decimal | null = null;
    if (complete && policy) {
      const increment = new Decimal(policy.minimumIncrement.toString());
      amount = increment.isZero() ? sum.toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN) : sum.div(increment).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).mul(increment).toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);
      if (amount.gte(new Decimal(10).pow(32))) throw new Error("OIU assessment exceeds the supported precision");
    }
    const key = sha({ usageEventId, policyId: policy?.id ?? null, kind });
    const record = await this.db.$transaction(async (tx) => {
      const existing = await tx.oicOiuAssessment.findUnique({ where: { assessmentKey: key }, include: { posting: true } });
      if (existing) return existing;
      const assessment = await tx.oicOiuAssessment.create({ data: {
        assessmentKey: key, usageEventId, policyRevisionId: policy?.id ?? null, kind, status, inputs: toInputJson(inputs), oiu: amount?.toFixed(6) ?? null,
        sourceDigest: sha({ usage: event.sourceDigest, policy: policy?.sourceDigest ?? null, inputs }), producerVersion: PRODUCER_VERSION
      }, include: { posting: true } });
      if (amount) {
        await tx.oicOiuPosting.create({ data: { assessmentId: assessment.id, sourceKey: `oiu:${key}`, amount: amount.toFixed(6) } });
      }
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: event.applicationId, tenantId: event.tenantId, action: "economics.oiu.assessed", targetType: "usage-event", targetId: usageEventId, requestId: correlation.requestId, traceId: correlation.traceId, metadata: { assessmentKey: key, policyRevisionId: policy?.id ?? null, status } } });
      return tx.oicOiuAssessment.findUniqueOrThrow({ where: { id: assessment.id }, include: { posting: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (record.status === "ASSESSED" && record.oiu !== null) await this.admissions?.settleBudgetFromUsageEvent(usageEventId, "OIU", record.oiu.toString(), null);
    return record;
  }

  async assessProviderCost(actor: AuthenticatedPrincipal, usageEventId: string, kind: "ORIGINAL" | "REPLAY" = "ORIGINAL", correlation: Correlation = {}) {
    this.requireManage(actor);
    const event = await this.db.oicUsageEvent.findUnique({ where: { id: usageEventId }, include: { providerAttempt: true } });
    if (!event) throw new NotFoundException();
    this.assertCanManageExisting(actor, event.applicationId, event.tenantId);
    const candidates = event.occurredAt ? await this.db.oicProviderRateBookRevision.findMany({ where: {
      providerKey: event.providerKey, status: "PUBLISHED", effectiveFrom: { lte: event.occurredAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: event.occurredAt } }],
      AND: [{ OR: [{ applicationId: null }, { applicationId: event.applicationId }] }, { OR: [{ tenantId: null }, { tenantId: event.tenantId }] }, { OR: [{ connectionId: null }, { connectionId: event.providerAttempt.connectionId }] }]
    }, include: { rates: true } }) : [];
    const rank = (row: typeof candidates[number]) => (row.connectionId ? 8 : 0) + (row.tenantId ? 4 : 0) + (row.applicationId ? 2 : 0);
    const matching = candidates.filter((row) => row.tenantId === event.tenantId || row.tenantId === null).sort((a, b) => rank(b) - rank(a));
    const rateBook = matching[0];
    const ambiguous = !!rateBook && matching.length > 1 && rank(rateBook) === rank(matching[1]!);
    const normalized = event.normalizedDimensions as Record<string, unknown>;
    const lines: Array<Record<string, string | boolean | null>> = [];
    let total = new Decimal(0);
    let complete = !!rateBook && !ambiguous;
    if (rateBook && !ambiguous) {
      const applicable = rateBook.rates.filter((rate) => rate.upstreamModelId === event.providerAttempt.upstreamModelId || rate.upstreamModelId === null);
      const selectedRates = new Map<Dimension, typeof applicable[number]>();
      for (const rate of applicable) {
        const dimension = rate.dimension as Dimension;
        const current = selectedRates.get(dimension);
        if (!current || (current.upstreamModelId === null && rate.upstreamModelId !== null)) selectedRates.set(dimension, rate);
      }
      for (const rate of selectedRates.values()) {
        const quantityRaw = normalized[rate.dimension];
        let quantity = typeof quantityRaw === "number" && Number.isSafeInteger(quantityRaw) && quantityRaw >= 0 ? new Decimal(quantityRaw) : null;
        if (rate.dimension === "inputTokens" && selectedRates.has("cachedInputTokens")) {
          const cachedRaw = normalized.cachedInputTokens;
          const cached = typeof cachedRaw === "number" && Number.isSafeInteger(cachedRaw) && cachedRaw >= 0 ? new Decimal(cachedRaw) : null;
          if (!quantity || !cached || cached.gt(quantity)) { complete = false; quantity = null; }
          else quantity = quantity.minus(cached);
        }
        if (!quantity) {
          if (rate.required) { complete = false; lines.push({ dimension: rate.dimension, unit: rate.unit, quantity: null, amount: null, state: "MISSING_USAGE" }); }
          continue;
        }
        const amount = quantity.div(rate.quantityDivisor.toString()).mul(rate.pricePerUnit.toString());
        total = total.plus(amount);
        lines.push({ dimension: rate.dimension, unit: rate.unit, quantity: quantity.toFixed(), divisor: rate.quantityDivisor.toString(), pricePerUnit: rate.pricePerUnit.toString(), amount: amount.toFixed(18), state: "PRICED" });
      }
      for (const [dimension, raw] of Object.entries(normalized)) {
        if (typeof raw === "number" && raw !== 0 && !lines.some((line) => line.dimension === dimension && line.state === "PRICED")) {
          complete = false;
          lines.push({ dimension, unit: null, quantity: String(raw), amount: null, state: "UNPRICED" });
        }
      }
    }
    const status = !rateBook || ambiguous ? "UNKNOWN" : complete && event.providerAttempt.usageStatus === "REPORTED" ? "ASSESSED" : "PARTIAL";
    const evidenceClass = status === "UNKNOWN" ? "UNKNOWN" : status !== "ASSESSED" ? "UNKNOWN" : rateBook?.sourceQuality === "OPERATOR_ESTIMATE" ? "ESTIMATED" : "PROVIDER_REPORTED";
    const amount = status === "ASSESSED" ? total : null;
    if (amount?.gte(new Decimal(10).pow(20))) throw new Error("Provider cost assessment exceeds the supported precision");
    const key = sha({ usageEventId, rateBookRevisionId: rateBook?.id ?? (ambiguous ? "ambiguous" : null), kind });
    const record = await this.db.$transaction(async (tx) => {
      const existing = await tx.oicProviderCostAssessment.findUnique({ where: { assessmentKey: key } });
      if (existing) return existing;
      const row = await tx.oicProviderCostAssessment.create({ data: {
        assessmentKey: key, usageEventId, rateBookRevisionId: rateBook?.id ?? null, kind, status, evidenceClass,
        nativeAmount: amount?.toFixed(18) ?? null, currency: amount && rateBook ? rateBook.currency : null,
        dimensionLines: toInputJson(lines), sourceDigest: sha({ usage: event.sourceDigest, rates: rateBook?.sourceDigest ?? null, lines }), producerVersion: PRODUCER_VERSION
      } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: event.applicationId, tenantId: event.tenantId, action: "economics.provider-cost.assessed", targetType: "usage-event", targetId: usageEventId, requestId: correlation.requestId, traceId: correlation.traceId, metadata: { assessmentKey: key, rateBookRevisionId: rateBook?.id ?? null, status } } });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (record.status === "ASSESSED" && record.nativeAmount !== null && record.currency !== null) await this.admissions?.settleBudgetFromUsageEvent(usageEventId, "CURRENCY", record.nativeAmount.toString(), record.currency);
    return record;
  }

  async reconcile(actor: AuthenticatedPrincipal, input: { cursor?: string; limit: number }, correlation: Correlation = {}) {
    this.requireManage(actor);
    const rows = await this.db.oicUsageEvent.findMany({
      where: hasOicConsoleRead(actor.scopes) ? {} : { applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }], ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), take: input.limit + 1,
      select: { id: true }
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const results = [];
    for (const row of page) {
      results.push(await this.assessProviderCost(actor, row.id, "REPLAY", correlation));
      results.push(await this.assessOiu(actor, row.id, "REPLAY", correlation));
    }
    return { assessed: page.length, nextCursor: hasMore ? page.at(-1)?.id ?? null : null, results };
  }

  async listPolicies(actor: AuthenticatedPrincipal) {
    this.requireRead(actor);
    return this.db.oicOiuPolicyRevision.findMany({ where: hasOicConsoleRead(actor.scopes) ? {} : { applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, orderBy: [{ policyKey: "asc" }, { revision: "desc" }], include: { dimensions: true }, take: 100 });
  }

  async listRateBooks(actor: AuthenticatedPrincipal) {
    this.requireRead(actor);
    return this.db.oicProviderRateBookRevision.findMany({ where: hasOicConsoleRead(actor.scopes) ? {} : { applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { rates: true }, take: 100 });
  }

  async listAssessments(actor: AuthenticatedPrincipal, kind: "cost" | "oiu", cursor?: string, limit = 50) {
    this.requireRead(actor);
    const where = hasOicConsoleRead(actor.scopes) ? {} : { usageEvent: { applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] } };
    const options = { where, orderBy: [{ recordedAt: "desc" as const }, { id: "desc" as const }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: limit + 1 };
    if (kind === "cost") {
      const rows = await this.db.oicProviderCostAssessment.findMany({ ...options, include: {
        usageEvent: { select: { applicationId: true, tenantId: true, providerAttemptId: true, providerAttempt: { select: { providerKey: true, upstreamModelId: true, connectionId: true } } } },
        rateBookRevision: { select: { revision: true, sourceQuality: true, sourceDigest: true } }
      } });
      const items = rows.length > limit ? rows.slice(0, limit) : rows;
      return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
    }
    const rows = await this.db.oicOiuAssessment.findMany({ ...options, include: {
      usageEvent: { select: { applicationId: true, tenantId: true, providerAttemptId: true, providerAttempt: { select: { providerKey: true, upstreamModelId: true } } } },
      policyRevision: { select: { policyKey: true, revision: true, sourceDigest: true } }, posting: true
    } });
    const items = rows.length > limit ? rows.slice(0, limit) : rows;
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  }

  private assertCanManageExisting(actor: AuthenticatedPrincipal, applicationId: string | null, tenantId: string | null): void {
    if (hasOicConsoleManage(actor.scopes)) return;
    if (applicationId !== actor.applicationId || (tenantId !== null && !actor.tenantIds.includes(tenantId))) throw new ForbiddenException();
  }

  private async audit(actor: AuthenticatedPrincipal, action: string, targetType: string, targetId: string, scope: { applicationId: string | null; tenantId: string | null }, correlation: Correlation, metadata: Prisma.InputJsonObject): Promise<void> {
    await this.db.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: scope.applicationId, tenantId: scope.tenantId, action, targetType, targetId, requestId: correlation.requestId, traceId: correlation.traceId, metadata } });
  }
}
