import { ConflictException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { OicRuntimeContext, OicRuntimeRequest } from "@oic/contracts";

type Bounds = Record<string, string>;
type AdmissionResult = { id: string; status: string; planRevisionId: string | null; denialCode: string | null };
const decimal = (value: unknown): Decimal | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = new Decimal(value);
  return result.isFinite() && !result.isNegative() ? result : null;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const scopeKey = (applicationId: string, tenantId: string | null) => `${applicationId}:${tenantId ?? "application"}`;

function windowOf(policy: { window: string; windowSeconds: number | null; effectiveFrom: Date; effectiveTo: Date | null }, at: Date): { start: Date; end: Date | null } {
  if (policy.window === "UTC_DAY") {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    return { start, end: new Date(start.getTime() + 86_400_000) };
  }
  if (policy.window === "UTC_MONTH") {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    return { start, end: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1)) };
  }
  if (policy.window === "ROLLING" && policy.windowSeconds && policy.windowSeconds > 0) {
    return { start: new Date(at.getTime() - policy.windowSeconds * 1000), end: at };
  }
  if (policy.window === "CONTRACT_PERIOD") {
    if (policy.effectiveFrom > at || (policy.effectiveTo && policy.effectiveTo <= at)) throw new ConflictException("UNKNOWN_BOUND");
    return { start: policy.effectiveFrom, end: policy.effectiveTo };
  }
  return { start: new Date(0), end: null };
}

@Injectable()
export class AdmissionService {
  constructor(private readonly db: OicDatabaseService) {}

  async admit(context: OicRuntimeContext, request: OicRuntimeRequest, operation: string, idempotencyKey: string, bounds: Bounds): Promise<AdmissionResult> {
    const hash = digest({ operation, request, applicationId: context.applicationId, tenantId: context.tenantId, principalId: context.principalId, bounds });
    const appScope = scopeKey(context.applicationId, context.tenantId);
    const now = new Date();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.db.$transaction(async (tx) => {
          const prior = await tx.oicAdmission.findUnique({ where: { scopeKey_operation_idempotencyKey: { scopeKey: appScope, operation, idempotencyKey } } });
          if (prior) {
            if (prior.requestHash !== hash) throw new ConflictException("CONFLICT");
            if (["DENIED", "UNCERTAIN", "DISPATCHED"].includes(prior.status)) return { id: prior.id, status: prior.status, planRevisionId: prior.planRevisionId, denialCode: prior.denialCode ?? (prior.status === "UNCERTAIN" ? "UNCERTAIN_USAGE" : "ADMISSION_BUSY") };
            return { id: prior.id, status: prior.status, planRevisionId: prior.planRevisionId, denialCode: prior.denialCode };
          }

          const mode = process.env.OIC_ADMISSION_MODE === "ENFORCE" ? "ENFORCE" : "SHADOW";
          const assignments = await tx.oicPlanAssignment.findMany({ where: {
            applicationId: context.applicationId, status: "ACTIVE", subjectKey: { in: ["*", context.principalId] }, effectiveFrom: { lte: now },
            AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, { OR: [{ tenantId: null }, { tenantId: context.tenantId ?? undefined }] }]
          }, include: { planRevision: { include: { plan: true } } }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
          const selected = assignments.filter((item) => (item.tenantId === context.tenantId || item.tenantId === null) && item.planRevision.effectiveFrom <= now && (!item.planRevision.effectiveTo || item.planRevision.effectiveTo > now))
            .sort((left, right) => Number(right.tenantId !== null) - Number(left.tenantId !== null) || right.priority - left.priority)[0];
          let denialCode: string | null = mode === "ENFORCE" && (!selected || selected.planRevision.status !== "PUBLISHED") ? "NOT_ENTITLED" : null;
          if (selected) {
            const entitlements = selected.planRevision.entitlements as Record<string, unknown>;
            const models = Array.isArray(entitlements.models) ? entitlements.models.filter((value): value is string => typeof value === "string") : [];
            if (mode === "ENFORCE" && !models.includes(request.model)) denialCode = "NOT_ENTITLED";
            if (mode === "ENFORCE" && selected.planRevision.maxOutputUnits !== null && (decimal(bounds.outputTokens)?.gt(selected.planRevision.maxOutputUnits) ?? false)) denialCode = "NOT_ENTITLED";
            if (mode === "ENFORCE" && selected.planRevision.maxConcurrency !== null) {
              const inFlight = await tx.oicAdmission.count({ where: { planRevisionId: selected.planRevisionId, status: { in: ["ADMITTED", "DISPATCHED"] } } });
              if (inFlight >= selected.planRevision.maxConcurrency) denialCode = "EXHAUSTED";
            }
          }

          const quotaPolicies = selected ? (await tx.oicQuotaPolicyRevision.findMany({ where: {
            status: "PUBLISHED", effectiveFrom: { lte: now },
            AND: [{ OR: [{ planRevisionId: null }, { planRevisionId: selected.planRevisionId }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, { OR: [{ applicationId: null }, { applicationId: context.applicationId }] }, { OR: [{ tenantId: null }, { tenantId: context.tenantId }] }]
          } })).filter((item) => (item.tenantId === context.tenantId || item.tenantId === null) && (item.applicationId === context.applicationId || item.applicationId === null)) : [];
          const budgets = selected ? (await tx.oicBudgetRevision.findMany({ where: {
            status: "PUBLISHED", effectiveFrom: { lte: now },
            AND: [{ OR: [{ planRevisionId: null }, { planRevisionId: selected.planRevisionId }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, { OR: [{ applicationId: null }, { applicationId: context.applicationId }] }, { OR: [{ tenantId: null }, { tenantId: context.tenantId }] }]
          } })).filter((item) => (item.tenantId === context.tenantId || item.tenantId === null) && (item.applicationId === context.applicationId || item.applicationId === null)) : [];
          if (mode === "ENFORCE" && budgets.some((budget) => budget.enforcement === "HARD" && (budget.reservationUpperBound === null || (budget.unknownLiabilityRule === "HOLD_MAXIMUM" && budget.reservationUpperBound === null)))) denialCode ??= "UNKNOWN_BOUND";
          if (mode === "ENFORCE" && quotaPolicies.some((policy) => policy.enforcement === "HARD" && policy.unknownLiabilityRule === "HOLD_MAXIMUM" && policy.reservationUpperBound === null && bounds[policy.dimension] === undefined)) denialCode ??= "UNKNOWN_BOUND";

          const admission = await tx.oicAdmission.create({ data: {
            applicationId: context.applicationId, tenantId: context.tenantId, principalId: context.principalId,
            scopeKey: appScope, planRevisionId: selected?.planRevisionId ?? null, operation, idempotencyKey, requestHash: hash,
            status: denialCode ? "DENIED" : mode === "SHADOW" ? "SHADOW" : "ADMITTED", denialCode,
            requestBounds: bounds, dispatchDeadline: new Date(now.getTime() + 60_000)
          } });
          if (!denialCode && mode === "ENFORCE") {
            const legs: Array<{ bucketId: string; amount: Decimal; policyId: string | null; budgetId: string | null }> = [];
            for (const policy of quotaPolicies) {
              const bound = decimal(bounds[policy.dimension]) ?? decimal(policy.reservationUpperBound);
              if (!bound) {
                if (policy.enforcement === "HARD") denialCode = "UNKNOWN_BOUND";
                continue;
              }
              const amount = bound.plus(policy.safetyMargin.toString());
              const window = windowOf(policy, now);
              const entitlements = selected?.planRevision.entitlements as Record<string, unknown> | undefined;
              const subjectScope = policy.subject === "APPLICATION" ? context.applicationId : policy.subject === "TENANT" ? context.tenantId : policy.subject === "PRINCIPAL" ? context.principalId : policy.subject === "MODEL" ? request.model : policy.subject === "TIER" ? (typeof entitlements?.tier === "string" ? entitlements.tier : null) : policy.subject === "CAPABILITY" ? "text.generate" : null;
              if (!subjectScope) { if (policy.enforcement === "HARD") denialCode = "NOT_ENTITLED"; continue; }
              const bucketKey = digest({ scope: subjectScope, policyId: policy.id, start: window.start.toISOString() });
              const bucket = await tx.oicQuotaBucket.upsert({ where: { bucketKey }, create: {
                bucketKey, applicationId: context.applicationId, tenantId: policy.subject === "APPLICATION" ? null : context.tenantId, quotaPolicyRevisionId: policy.id,
                unit: policy.unit, limitValue: policy.limitValue.toString(), windowStart: window.start, windowEnd: window.end
              }, update: {} });
              await tx.$queryRaw`SELECT id FROM "OicQuotaBucket" WHERE id = ${bucket.id}::uuid FOR UPDATE`;
              const locked = await tx.oicQuotaBucket.findUniqueOrThrow({ where: { id: bucket.id } });
              if (policy.enforcement === "HARD" && locked.consumed.plus(locked.held).plus(locked.uncertain).plus(amount.toString()).gt(locked.limitValue)) denialCode = "EXHAUSTED";
              legs.push({ bucketId: bucket.id, amount, policyId: policy.id, budgetId: null });
            }
            for (const budget of budgets) {
              const bound = decimal(budget.reservationUpperBound);
              if (!bound) { if (budget.enforcement === "HARD") denialCode = "UNKNOWN_BOUND"; continue; }
              const amount = bound.plus(budget.safetyMargin.toString());
              const window = { start: budget.effectiveFrom, end: budget.effectiveTo };
              const bucketKey = digest({ appScope, budgetId: budget.id, start: window.start.toISOString() });
              const bucket = await tx.oicQuotaBucket.upsert({ where: { bucketKey }, create: {
                bucketKey, applicationId: context.applicationId, tenantId: context.tenantId, budgetRevisionId: budget.id,
                unit: budget.unit, currency: budget.currency, limitValue: budget.amount.toString(), windowStart: window.start, windowEnd: window.end
              }, update: {} });
              await tx.$queryRaw`SELECT id FROM "OicQuotaBucket" WHERE id = ${bucket.id}::uuid FOR UPDATE`;
              const locked = await tx.oicQuotaBucket.findUniqueOrThrow({ where: { id: bucket.id } });
              if (budget.enforcement === "HARD" && locked.consumed.plus(locked.held).plus(locked.uncertain).plus(amount.toString()).gt(locked.limitValue)) denialCode = "EXHAUSTED";
              legs.push({ bucketId: bucket.id, amount, policyId: null, budgetId: budget.id });
            }
            if (denialCode) {
              await tx.oicAdmission.update({ where: { id: admission.id }, data: { status: "DENIED", denialCode } });
              await tx.oicAuditEvent.create({ data: { applicationId: context.applicationId, tenantId: context.tenantId, action: "admission.denied", targetType: "admission", targetId: admission.id, requestId: context.requestId, traceId: context.traceId, metadata: { status: "DENIED", denialCode, planRevisionId: selected?.planRevisionId ?? null, requestHash: hash } } });
              return { id: admission.id, status: "DENIED", planRevisionId: selected?.planRevisionId ?? null, denialCode };
            }
            for (const leg of legs.sort((a, b) => a.bucketId.localeCompare(b.bucketId))) {
              const bucket = await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { held: { increment: leg.amount.toString() }, sequence: { increment: 1 } } });
              await tx.oicReservationLeg.create({ data: { admissionId: admission.id, bucketId: leg.bucketId, quotaPolicyRevisionId: leg.policyId, budgetRevisionId: leg.budgetId, amount: leg.amount.toString(), expiresAt: admission.dispatchDeadline } });
              await tx.oicUsagePosting.create({ data: { bucketId: bucket.id, admissionId: admission.id, sourceKey: `reserve:${admission.id}:${bucket.id}`, kind: "RESERVE", amount: leg.amount.toString(), sequence: bucket.sequence } });
            }
          }
          await tx.oicAuditEvent.create({ data: { applicationId: context.applicationId, tenantId: context.tenantId, action: `admission.${denialCode ? "denied" : mode.toLowerCase()}`, targetType: "admission", targetId: admission.id, requestId: context.requestId, traceId: context.traceId, metadata: { status: denialCode ? "DENIED" : mode === "SHADOW" ? "SHADOW" : "ADMITTED", denialCode, planRevisionId: selected?.planRevisionId ?? null, requestHash: hash } } });
          return { id: admission.id, status: denialCode ? "DENIED" : mode === "SHADOW" ? "SHADOW" : "ADMITTED", planRevisionId: selected?.planRevisionId ?? null, denialCode };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    throw new ConflictException("BUSY");
  }

  async markDispatched(admissionId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const admission = await tx.oicAdmission.findUniqueOrThrow({ where: { id: admissionId }, include: { legs: true } });
      if (["SHADOW", "ADMITTED"].includes(admission.status)) await tx.oicAdmission.update({ where: { id: admissionId }, data: { status: "DISPATCHED", fenceGeneration: { increment: 1 } } });
      for (const leg of admission.legs) if (leg.state === "HELD") await tx.oicReservationLeg.update({ where: { id: leg.id, state: "HELD" }, data: { state: "DISPATCHED", fenceGeneration: { increment: 1 } } });
    });
  }

  async settle(admissionId: string, usage: Record<string, unknown> | null): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const admission = await tx.oicAdmission.findUniqueOrThrow({ where: { id: admissionId }, include: { legs: { include: { bucket: true, quotaPolicy: true, budgetPolicy: true } } } });
      if (admission.status === "SETTLED") return;
      if (!usage) {
        await tx.oicAdmission.update({ where: { id: admissionId }, data: { status: "UNCERTAIN" } });
        for (const leg of admission.legs) if (leg.state === "DISPATCHED" || leg.state === "HELD") {
          await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { held: { decrement: leg.amount.toString() }, uncertain: { increment: leg.amount.toString() } } });
          await tx.oicReservationLeg.update({ where: { id: leg.id }, data: { state: "UNCERTAIN" } });
        }
        return;
      }
      for (const leg of admission.legs) {
        // Currency and OIU liabilities need an independently assessed economic source.
        // Runtime-reported token dimensions are never treated as zero-valued budgets.
        if (leg.budgetRevisionId) continue;
        const dimension = leg.quotaPolicy?.dimension;
        if (!dimension || typeof usage[dimension] !== "number") {
          if (leg.state !== "UNCERTAIN") {
            await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { held: { decrement: leg.amount.toString() }, uncertain: { increment: leg.amount.toString() } } });
            await tx.oicReservationLeg.update({ where: { id: leg.id }, data: { state: "UNCERTAIN" } });
          }
          continue;
        }
        const consumed = new Decimal(usage[dimension]);
        const held = new Decimal(leg.amount.toString());
        const bucket = await tx.oicQuotaBucket.findUniqueOrThrow({ where: { id: leg.bucketId } });
        const available = Decimal.min(held, leg.state === "UNCERTAIN" ? new Decimal(bucket.uncertain.toString()) : new Decimal(bucket.held.toString()));
        const release = Decimal.max(available.minus(consumed), 0);
        const settled = await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: {
          ...(leg.state === "UNCERTAIN" ? { uncertain: { decrement: Decimal.min(available, consumed.plus(release)).toString() } } : { held: { decrement: Decimal.min(available, consumed.plus(release)).toString() } }),
          ...(consumed.isZero() ? {} : { consumed: { increment: consumed.toString() }, sequence: { increment: 1 } })
        } });
        const updated = settled;
        if (!consumed.isZero()) await tx.oicUsagePosting.create({ data: { bucketId: leg.bucketId, admissionId, sourceKey: `consume:${admissionId}:${leg.bucketId}`, kind: "CONSUME", amount: consumed.toString(), sequence: updated.sequence } });
        if (!release.isZero()) {
          const released = await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { sequence: { increment: 1 } } });
          await tx.oicUsagePosting.create({ data: { bucketId: leg.bucketId, admissionId, sourceKey: `release:${admissionId}:${leg.bucketId}`, kind: "RELEASE", amount: release.toString(), sequence: released.sequence } });
        }
        if (consumed.gt(available)) {
          await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { uncertain: { increment: consumed.minus(available).toString() } } });
        }
        await tx.oicReservationLeg.update({ where: { id: leg.id }, data: { state: consumed.gt(available) ? "UNCERTAIN" : "SETTLED" } });
      }
      const overrun = admission.legs.some((leg) => {
        if (leg.budgetRevisionId) return false;
        const dimension = leg.quotaPolicy?.dimension;
        const amount = dimension && typeof usage[dimension] === "number" ? new Decimal(usage[dimension]) : null;
        return amount !== null && amount.gt(leg.amount.toString());
      });
      const unresolved = await tx.oicReservationLeg.count({ where: { admissionId, state: { notIn: ["SETTLED", "RELEASED"] } } });
      await tx.oicAdmission.update({ where: { id: admissionId }, data: { status: overrun || unresolved > 0 ? "UNCERTAIN" : "SETTLED" } });
    });
  }

  async settleBudgetFromUsageEvent(usageEventId: string, unit: "OIU" | "CURRENCY", amount: string | null, currency: string | null): Promise<void> {
    if (amount === null) return;
    const actual = decimal(amount);
    if (!actual) return;
    await this.db.$transaction(async (tx) => {
      const event = await tx.oicUsageEvent.findUnique({ where: { id: usageEventId }, select: { providerAttempt: { select: { admissionId: true } } } });
      const admissionId = event?.providerAttempt.admissionId;
      if (!admissionId) return;
      const admission = await tx.oicAdmission.findUniqueOrThrow({ where: { id: admissionId }, include: { legs: { include: { budgetPolicy: true, bucket: true } } } });
      let unresolved = false;
      for (const leg of admission.legs) {
        const budget = leg.budgetPolicy;
        if (!budget) { if (leg.state === "UNCERTAIN") unresolved = true; continue; }
        if (budget.unit !== unit || (unit === "CURRENCY" && budget.currency !== currency)) { unresolved = true; continue; }
        if (["SETTLED", "RELEASED"].includes(leg.state)) continue;
        const held = new Decimal(leg.amount.toString());
        const liability = ["UNCERTAIN"].includes(leg.state) ? new Decimal(leg.bucket.uncertain.toString()) : new Decimal(leg.bucket.held.toString());
        const applicable = Decimal.min(held, liability);
        const overrun = actual.gt(held);
        if (!liability.isZero()) await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: {
          ...(leg.state === "UNCERTAIN" ? { uncertain: { decrement: applicable.toString() } } : { held: { decrement: applicable.toString() } }),
          ...(actual.isZero() ? {} : { consumed: { increment: actual.toString() }, sequence: { increment: 1 } })
        } });
        const bucket = await tx.oicQuotaBucket.findUniqueOrThrow({ where: { id: leg.bucketId }, select: { sequence: true } });
        if (!actual.isZero()) await tx.oicUsagePosting.create({ data: { bucketId: leg.bucketId, admissionId, sourceKey: `budget-consume:${usageEventId}:${leg.bucketId}`, kind: "CONSUME", amount: actual.toString(), sequence: bucket.sequence } });
        const release = Decimal.max(applicable.minus(actual), 0);
        if (!release.isZero()) {
          const released = await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { sequence: { increment: 1 } } });
          await tx.oicUsagePosting.create({ data: { bucketId: leg.bucketId, admissionId, sourceKey: `budget-release:${usageEventId}:${leg.bucketId}`, kind: "RELEASE", amount: release.toString(), sequence: released.sequence } });
        }
        if (overrun) await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { uncertain: { increment: actual.minus(held).toString() } } });
        await tx.oicReservationLeg.update({ where: { id: leg.id }, data: { state: overrun ? "UNCERTAIN" : "SETTLED" } });
        unresolved ||= overrun;
      }
      const remaining = await tx.oicReservationLeg.count({ where: { admissionId, state: { notIn: ["SETTLED", "RELEASED"] } } });
      await tx.oicAdmission.update({ where: { id: admissionId }, data: { status: remaining === 0 ? "SETTLED" : unresolved ? "UNCERTAIN" : "UNCERTAIN" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reconcileExpired(limit = 100): Promise<{ inspected: number; released: number }> {
    const now = new Date();
    const candidates = await this.db.oicAdmission.findMany({ where: { status: "ADMITTED", dispatchDeadline: { lt: now }, attempts: { none: {} } }, orderBy: [{ dispatchDeadline: "asc" }, { id: "asc" }], take: Math.max(1, Math.min(100, limit)), select: { id: true } });
    let released = 0;
    for (const candidate of candidates) {
      const changed = await this.db.$transaction(async (tx) => {
        const admission = await tx.oicAdmission.findUniqueOrThrow({ where: { id: candidate.id }, include: { legs: true } });
        if (admission.status !== "ADMITTED" || admission.dispatchDeadline >= now || await tx.oicProviderAttempt.count({ where: { admissionId: admission.id } })) return false;
        for (const leg of admission.legs.filter((item) => item.state === "HELD").sort((a, b) => a.bucketId.localeCompare(b.bucketId))) {
          const bucket = await tx.oicQuotaBucket.update({ where: { id: leg.bucketId }, data: { held: { decrement: leg.amount.toString() }, sequence: { increment: 1 } } });
          await tx.oicUsagePosting.create({ data: { bucketId: bucket.id, admissionId: admission.id, sourceKey: `release-expired:${admission.id}:${bucket.id}`, kind: "RELEASE", amount: leg.amount.toString(), sequence: bucket.sequence } });
          await tx.oicReservationLeg.update({ where: { id: leg.id, state: "HELD" }, data: { state: "RELEASED" } });
        }
        await tx.oicAdmission.update({ where: { id: admission.id, status: "ADMITTED" }, data: { status: "RELEASED" } });
        await tx.oicAuditEvent.create({ data: { applicationId: admission.applicationId, tenantId: admission.tenantId, action: "admission.expired.released", targetType: "admission", targetId: admission.id, metadata: { proof: "dispatch-deadline-passed-with-no-persisted-provider-attempt" } } });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (changed) released += 1;
    }
    return { inspected: candidates.length, released };
  }

  async uncertain(admissionId: string): Promise<void> { await this.settle(admissionId, null); }
}
