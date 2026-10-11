import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { EconomicsService } from "./economics.service";

const appId = "application-a";
const tenantId = "tenant-a";
const principalId = "operator-a";
const actor: AuthenticatedPrincipal = { id: principalId, applicationId: appId, tenantIds: [tenantId], scopes: ["oic:rating:read", "oic:rating:manage"] };
const occurredAt = new Date("2026-10-11T10:00:00.000Z");
const planRevision = (commercialModel = "POSTPAID") => ({ id: "plan-revision-a", effectiveFrom: new Date("2026-10-01T00:00:00.000Z"), effectiveTo: null, entitlements: { commercialModel }, plan: { applicationId: appId } });
const usage = (id: string, commercialModel = "POSTPAID") => ({
  id, applicationId: appId, tenantId, occurredAt, sourceDigest: "d".repeat(64), normalizedDimensions: { inputTokens: "5" },
  providerAttempt: { providerKey: "local", upstreamModelId: "oi-test", completedAt: occurredAt, admission: { operation: "native.invoke.v1", status: "SETTLED", planRevision: planRevision(commercialModel) } }
});
const book = (id: string, scope: "application" | "tenant", strategy: string, rule: Record<string, unknown>) => ({
  id, applicationId: appId, tenantId: scope === "tenant" ? tenantId : null, scopeKey: `${appId}:${scope === "tenant" ? tenantId : "application"}`,
  status: "PUBLISHED", strategy, currency: "USD", sourceDigest: id.padEnd(64, "0"), rules: [rule]
});

function ratingHarness(input: { event: ReturnType<typeof usage>; books: ReturnType<typeof book>[]; oiu?: string; allowanceConsumed?: string }) {
  const persisted = new Map<string, Record<string, unknown>>();
  const postings: Array<Record<string, unknown>> = [];
  const bucket = { id: "allowance-bucket", allowance: "10", consumed: input.allowanceConsumed ?? "0", sequence: 0 };
  let writeCount = 0;
  const db = {
    oicUsageEvent: { findUnique: () => Promise.resolve(input.event) },
    oicCustomerPriceBookRevision: { findMany: () => Promise.resolve(input.books) },
    oicOiuAssessment: { findFirst: () => Promise.resolve(input.oiu === undefined ? null : { id: "oiu-assessment", oiu: input.oiu }) },
    $transaction: (work: (tx: Record<string, unknown>) => Promise<unknown>) => work({
      oicRatedUsageEvent: {
        findUnique: ({ where }: { where: { eventKey: string } }) => Promise.resolve(persisted.get(where.eventKey) ?? null),
        create: ({ data }: { data: Record<string, unknown> }) => { writeCount += 1; const row = { id: `rated-${writeCount}`, ...data }; persisted.set(String(data.eventKey), row); return Promise.resolve(row); }
      },
      oicCustomerAllowanceBucket: {
        upsert: () => Promise.resolve({ id: bucket.id }),
        findUniqueOrThrow: () => Promise.resolve({ ...bucket }),
        update: ({ data }: { data: { consumed: { increment: string }; sequence: number } }) => { bucket.consumed = String(Number(bucket.consumed) + Number(data.consumed.increment)); bucket.sequence = data.sequence; return Promise.resolve(bucket); }
      },
      $queryRaw: () => Promise.resolve([]),
      oicCustomerAllowancePosting: { create: ({ data }: { data: Record<string, unknown> }) => { postings.push(data); return Promise.resolve(data); } },
      oicAuditEvent: { create: () => Promise.resolve({}) }
    })
  };
  return { service: new EconomicsService(db as unknown as OicDatabaseService), persisted, postings, bucket, get writes() { return writeCount; } };
}

void test("OIC-6.4 rating resolves tenant precedence, pins the admission plan, and replays once", async () => {
  const harness = ratingHarness({ event: usage("usage-1"), books: [
    book("app-price", "application", "REQUEST", { fixedAmount: "0.90" }),
    book("tenant-price", "tenant", "REQUEST", { fixedAmount: "1.23" })
  ] });
  const first = await harness.service.rateCustomerUsage(actor, "usage-1");
  const replay = await harness.service.rateCustomerUsage(actor, "usage-1");
  assert.equal(first.priceBookRevisionId, "tenant-price");
  assert.equal(first.planRevisionId, "plan-revision-a");
  assert.equal(first.nativeAmount?.toString(), "1.23");
  assert.equal(replay.id, first.id);
  assert.equal(harness.writes, 1);
});

void test("OIC-6.4 FREE plans retain an explicit zero-rated event rather than suppressing usage", async () => {
  const harness = ratingHarness({ event: usage("usage-free", "FREE"), books: [book("free-price", "tenant", "REQUEST", { fixedAmount: "3.00" })] });
  const rated = await harness.service.rateCustomerUsage(actor, "usage-free");
  assert.equal(rated.status, "RATED");
  assert.equal(rated.nativeAmount?.toString(), "0");
  assert.equal(rated.reasonCode, "FREE_PLAN");
  assert.equal(rated.usageEventId, "usage-free");
});

void test("OIC-6.4 included OIU allowance is cumulative and replay does not consume twice", async () => {
  const harness = ratingHarness({ event: usage("usage-overage"), books: [book("overage-price", "tenant", "INCLUDED_PLUS_OVERAGE", { includedQuantity: "10", pricePerUnit: "0.25" })], oiu: "5", allowanceConsumed: "9" });
  const first = await harness.service.rateCustomerUsage(actor, "usage-overage");
  const replay = await harness.service.rateCustomerUsage(actor, "usage-overage");
  assert.equal(first.nativeAmount?.toString(), "1");
  assert.equal(harness.bucket.consumed, "10");
  assert.equal(harness.postings.length, 1);
  assert.equal(replay.id, first.id);
});

void test("OIC-6.4 credits are append-only, replay-safe, and bounded by original native amount", async () => {
  const ratedEvent = { id: "rated-source", applicationId: appId, tenantId, status: "RATED", nativeAmount: "5.00", currency: "USD", adjustments: [] as Array<Record<string, unknown>> };
  const adjustments = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db = {
    oicRatedUsageEvent: { findUnique: () => Promise.resolve(ratedEvent) },
    $transaction: (work: (tx: Record<string, unknown>) => Promise<unknown>) => work({
      oicRatedUsageAdjustment: {
        findUnique: ({ where }: { where: { sourceKey: string } }) => Promise.resolve(adjustments.get(where.sourceKey) ?? null),
        create: ({ data }: { data: Record<string, unknown> }) => { writes += 1; const row = { id: `adjustment-${writes}`, ...data }; adjustments.set(String(data.sourceKey), row); ratedEvent.adjustments.push(row); return Promise.resolve(row); }
      },
      $queryRaw: () => Promise.resolve([]),
      oicRatedUsageEvent: { findUniqueOrThrow: () => Promise.resolve(ratedEvent) },
      oicAuditEvent: { create: () => Promise.resolve({}) }
    })
  };
  const service = new EconomicsService(db as unknown as OicDatabaseService);
  const first = await service.createRatedAdjustment(actor, ratedEvent.id, { sourceKey: "credit-1", kind: "CREDIT", amount: "2.00", reason: "service recovery" });
  const replay = await service.createRatedAdjustment(actor, ratedEvent.id, { sourceKey: "credit-1", kind: "CREDIT", amount: "2.00", reason: "service recovery" });
  assert.equal(replay.id, first.id);
  await assert.rejects(() => service.createRatedAdjustment(actor, ratedEvent.id, { sourceKey: "credit-1", kind: "CREDIT", amount: "1.00", reason: "different request" }));
  const reversal = await service.createRatedAdjustment(actor, ratedEvent.id, { sourceKey: "reversal-1", kind: "REVERSAL", reason: "close remaining balance" });
  assert.equal(reversal.amount?.toString(), "-3.000000000000000000");
  await assert.rejects(() => service.createRatedAdjustment(actor, ratedEvent.id, { sourceKey: "credit-too-large", kind: "CREDIT", amount: "0.01", reason: "over original" }));
  assert.equal(writes, 2);
});

void test("OIC-6.4 FX evidence is idempotent and never substitutes for missing conversion", async () => {
  const rows = new Map<string, Record<string, unknown>>();
  let writes = 0;
  let audits = 0;
  const db = {
    $transaction: (work: (tx: Record<string, unknown>) => Promise<unknown>) => work({
      oicFxRateEvidence: {
        findUnique: ({ where }: { where: { evidenceKey: string } }) => Promise.resolve(rows.get(where.evidenceKey) ?? null),
        create: ({ data }: { data: Record<string, unknown> }) => { writes += 1; const row = { id: `fx-${writes}`, ...data }; rows.set(String(data.evidenceKey), row); return Promise.resolve(row); }
      },
      oicAuditEvent: { create: () => { audits += 1; return Promise.resolve({}); } }
    })
  };
  const service = new EconomicsService(db as unknown as OicDatabaseService);
  const input = { baseCurrency: "USD", quoteCurrency: "EUR", rate: "0.92", source: "approved feed", sourceReference: "fx-ref-1", policyRevision: "fx-v1", effectiveAt: occurredAt };
  const first = await service.createFxRateEvidence(actor, input);
  const replay = await service.createFxRateEvidence(actor, input);
  assert.equal(replay.id, first.id);
  assert.equal(writes, 1);
  assert.equal(audits, 1);
});

void test("OIC-6.4 rating requires its explicit domain scope", async () => {
  const harness = ratingHarness({ event: usage("usage-scope"), books: [] });
  await assert.rejects(() => harness.service.rateCustomerUsage({ ...actor, scopes: ["oic:economics:manage"] }, "usage-scope"));
});
