import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { EconomicsService } from "./economics.service";

const actor = { id: "principal-1", applicationId: "app-1", scopes: ["oic:economics:manage"], tenantIds: ["tenant-1"] };
const date = new Date("2026-01-01T00:00:00.000Z");
const event = (normalizedDimensions: Record<string, unknown>, occurredAt: Date | null = date) => ({
  id: "usage-1", applicationId: "app-1", tenantId: "tenant-1", providerAttemptId: "attempt-1", providerKey: "openai", transportProfile: "openai-chat-completions-v1",
  rawDimensions: {}, normalizedDimensions, sourceDigest: "usage-digest", occurredAt, recordedAt: date,
  providerAttempt: { id: "attempt-1", applicationId: "app-1", tenantId: "tenant-1", principalId: "principal-1", connectionId: "connection-1", upstreamModelId: "model-1", usageStatus: "REPORTED" }
});

function oiuHarness(source: ReturnType<typeof event>, policy?: Record<string, unknown>) {
  const captured: { assessment?: Record<string, unknown>; posting?: Record<string, unknown>; policyEffectiveAt?: Date } = {};
  const tx = {
    oicOiuAssessment: {
      findUnique: () => Promise.resolve(null),
      create: ({ data }: { data: Record<string, unknown> }) => { captured.assessment = { ...data, id: "assessment-1" }; return Promise.resolve(captured.assessment); },
      findUniqueOrThrow: () => Promise.resolve({ ...captured.assessment, posting: captured.posting ?? null })
    },
    oicOiuPosting: { create: ({ data }: { data: Record<string, unknown> }) => { captured.posting = { ...data, id: "posting-1" }; return Promise.resolve(captured.posting); } },
    oicAuditEvent: { create: () => Promise.resolve({ id: "audit-1" }) }
  };
  const db = {
    oicUsageEvent: { findUnique: () => Promise.resolve(source) },
    oicOiuPolicyRevision: { findMany: ({ where }: { where: { effectiveFrom: { lte: Date } } }) => { captured.policyEffectiveAt = where.effectiveFrom.lte; return Promise.resolve(policy ? [policy] : []); } },
    $transaction: <T>(operation: (value: unknown) => Promise<T>) => operation(tx)
  } as never;
  return { service: new EconomicsService(db), captured };
}

void test("OIC-6.2 OIU applies cached-input policy and rounds half-even once into an idempotent posting", async () => {
  const source = event({ inputTokens: 100, cachedInputTokens: 20, outputTokens: 1 });
  const policy = {
    id: "policy-1", policyKey: "default", applicationId: "app-1", tenantId: "tenant-1", sourceDigest: "policy-digest", minimumIncrement: "0", roundingMode: "HALF_EVEN",
    dimensions: [
      { dimension: "inputTokens", unit: "TOKENS", weightNumerator: "1", weightDenominator: "1", required: true, included: true },
      { dimension: "cachedInputTokens", unit: "TOKENS", weightNumerator: "0.5", weightDenominator: "1", required: true, included: true },
      { dimension: "outputTokens", unit: "TOKENS", weightNumerator: "1.2345675", weightDenominator: "1", required: true, included: true }
    ]
  };
  const { service, captured } = oiuHarness(source, policy);
  const result = await service.assessOiu(actor, source.id, "ORIGINAL");
  assert.equal(result.status, "ASSESSED");
  assert.equal(result.oiu, "91.234568");
  assert.equal(result.posting?.amount, "91.234568");
  assert.equal(captured.assessment?.policyRevisionId, "policy-1");
  assert.deepEqual(captured.assessment?.inputs, {
    inputTokens: { reported: "100", rated: "80" },
    cachedInputTokens: { reported: "20", rated: "20" },
    outputTokens: { reported: "1", rated: "1" }
  });
});

void test("OIC-6.2 usage without provider occurrence time selects OIU policy at durable receipt time", async () => {
  const source = event({ inputTokens: 94, cachedInputTokens: 0, outputTokens: 8 }, null);
  const policy = { id: "policy-time-fallback", policyKey: "oic7-deepseek-canary", applicationId: "app-1", tenantId: "tenant-1", sourceDigest: "policy-digest", minimumIncrement: "0", roundingMode: "HALF_EVEN", dimensions: [
    { dimension: "inputTokens", unit: "TOKENS", weightNumerator: "1", weightDenominator: "1", required: true, included: true },
    { dimension: "outputTokens", unit: "TOKENS", weightNumerator: "1", weightDenominator: "1", required: true, included: true }
  ] };
  const { service, captured } = oiuHarness(source, policy);
  const result = await service.assessOiu(actor, source.id, "ORIGINAL", {}, "oic7-deepseek-canary");
  assert.equal(captured.policyEffectiveAt?.toISOString(), source.recordedAt.toISOString());
  assert.equal(result.status, "ASSESSED");
  assert.equal(result.oiu, "102.000000");
});

void test("OIC-6.2 missing policy or required usage yields UNKNOWN/PARTIAL with no OIU posting", async () => {
  const noPolicySource = event({ inputTokens: 0 }, null);
  const noPolicy = oiuHarness(noPolicySource);
  const unknown = await noPolicy.service.assessOiu(actor, noPolicySource.id);
  assert.equal(unknown.status, "UNKNOWN");
  assert.equal(unknown.oiu, null);
  assert.equal(unknown.posting, null);

  const partialSource = event({ inputTokens: 10 });
  const partialPolicy = { id: "policy-2", policyKey: "default", applicationId: "app-1", tenantId: "tenant-1", sourceDigest: "policy-digest", minimumIncrement: "0", roundingMode: "HALF_EVEN", dimensions: [
    { dimension: "inputTokens", unit: "TOKENS", weightNumerator: "1", weightDenominator: "1", required: true, included: true },
    { dimension: "outputTokens", unit: "TOKENS", weightNumerator: "1", weightDenominator: "1", required: true, included: true }
  ] };
  const partial = oiuHarness(partialSource, partialPolicy);
  const result = await partial.service.assessOiu(actor, partialSource.id);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.oiu, null);
  assert.equal(result.posting, null);
});

void test("OIC-6.2 provider expense keeps currency native, separates cached units, and never invents a missing rate", async () => {
  const source = event({ inputTokens: 100, cachedInputTokens: 20, outputTokens: 10, reasoningTokens: 4 });
  const rateBook = {
    id: "ratebook-1", providerKey: "openai", currency: "USD", sourceQuality: "PROVIDER_CONTRACT", sourceDigest: "rate-digest", applicationId: "app-1", tenantId: "tenant-1", connectionId: "connection-1",
    rates: [
      { upstreamModelId: "model-1", dimension: "inputTokens", unit: "TOKENS", quantityDivisor: "1", pricePerUnit: "0.01", required: true },
      { upstreamModelId: "model-1", dimension: "cachedInputTokens", unit: "TOKENS", quantityDivisor: "1", pricePerUnit: "0.005", required: true },
      { upstreamModelId: "model-1", dimension: "outputTokens", unit: "TOKENS", quantityDivisor: "1", pricePerUnit: "0.02", required: true }
    ]
  };
  const captured: { row?: Record<string, unknown> } = {};
  const tx = {
    oicProviderCostAssessment: {
      findUnique: () => Promise.resolve(null),
      create: ({ data }: { data: Record<string, unknown> }) => { captured.row = data; return Promise.resolve(data); }
    },
    oicAuditEvent: { create: () => Promise.resolve({ id: "audit-1" }) }
  };
  const db = {
    oicUsageEvent: { findUnique: () => Promise.resolve(source) },
    oicProviderRateBookRevision: { findMany: () => Promise.resolve([rateBook]) },
    $transaction: <T>(operation: (value: unknown) => Promise<T>) => operation(tx)
  } as never;
  const result = await new EconomicsService(db).assessProviderCost(actor, source.id);
  assert.equal(result.status, "ASSESSED");
  assert.equal(result.evidenceClass, "PROVIDER_REPORTED");
  assert.equal(result.nativeAmount, "1.100000000000000000");
  assert.equal(result.currency, "USD");
  const lines = captured.row?.dimensionLines as Array<Record<string, unknown>>;
  assert.equal(lines.find((line) => line.dimension === "inputTokens")?.quantity, "80");

  const unknownDb = {
    oicUsageEvent: { findUnique: () => Promise.resolve(event({ inputTokens: 0 }, null)) },
    oicProviderRateBookRevision: { findMany: () => Promise.resolve([]) },
    $transaction: <T>(operation: (value: unknown) => Promise<T>) => operation({
      oicProviderCostAssessment: { findUnique: () => Promise.resolve(null), create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve(data) },
      oicAuditEvent: { create: () => Promise.resolve({ id: "audit-2" }) }
    })
  } as never;
  const noPrice = await new EconomicsService(unknownDb).assessProviderCost(actor, source.id);
  assert.equal(noPrice.status, "UNKNOWN");
  assert.equal(noPrice.evidenceClass, "UNKNOWN");
  assert.equal(noPrice.nativeAmount, null);
  assert.equal(noPrice.currency, null);

  const partialDb = {
    oicUsageEvent: { findUnique: () => Promise.resolve(source) },
    oicProviderRateBookRevision: { findMany: () => Promise.resolve([{ ...rateBook, rates: [rateBook.rates[0]] }]) },
    $transaction: <T>(operation: (value: unknown) => Promise<T>) => operation({
      oicProviderCostAssessment: { findUnique: () => Promise.resolve(null), create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve(data) },
      oicAuditEvent: { create: () => Promise.resolve({ id: "audit-3" }) }
    })
  } as never;
  const incomplete = await new EconomicsService(partialDb).assessProviderCost(actor, source.id);
  assert.equal(incomplete.status, "PARTIAL");
  assert.equal(incomplete.nativeAmount, null);
  assert.equal(incomplete.currency, null);
});

void test("OIC-6.2 provider cost uses durable receipt time when upstream occurrence time is absent", async () => {
  const source = event({ inputTokens: 94, cachedInputTokens: 0, outputTokens: 8 }, null);
  let assessedAt: Date | undefined;
  const rateBook = {
    id: "ratebook-time-fallback", providerKey: "openai", currency: "USD", sourceQuality: "STANDARD_PUBLISHED", sourceDigest: "rate-digest", applicationId: "app-1", tenantId: "tenant-1", connectionId: "connection-1",
    rates: [
      { upstreamModelId: "model-1", dimension: "inputTokens", unit: "TOKENS", quantityDivisor: "1", pricePerUnit: "0.01", required: true },
      { upstreamModelId: "model-1", dimension: "cachedInputTokens", unit: "TOKENS", quantityDivisor: "1", pricePerUnit: "0.005", required: false },
      { upstreamModelId: "model-1", dimension: "outputTokens", unit: "TOKENS", quantityDivisor: "1", pricePerUnit: "0.02", required: true }
    ]
  };
  const db = {
    oicUsageEvent: { findUnique: () => Promise.resolve(source) },
    oicProviderRateBookRevision: { findMany: ({ where }: { where: { effectiveFrom: { lte: Date } } }) => { assessedAt = where.effectiveFrom.lte; return Promise.resolve([rateBook]); } },
    $transaction: <T>(operation: (tx: unknown) => Promise<T>) => operation({
      oicProviderCostAssessment: { findUnique: () => Promise.resolve(null), create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve(data) },
      oicAuditEvent: { create: () => Promise.resolve({ id: "audit-time-fallback" }) }
    })
  } as never;
  const result = await new EconomicsService(db).assessProviderCost(actor, source.id);
  assert.equal(assessedAt?.toISOString(), source.recordedAt.toISOString());
  assert.equal(result.status, "ASSESSED");
  assert.equal(result.currency, "USD");
  assert.equal(result.nativeAmount, "1.100000000000000000");
});

void test("OIC-6.2 economic commands require explicit authority and preserve application scope", async () => {
  const source = event({ inputTokens: 10 });
  const db = {
    oicUsageEvent: { findUnique: () => Promise.resolve({ ...source, applicationId: "another-app" }) }
  } as never;
  const service = new EconomicsService(db);
  await assert.rejects(service.assessProviderCost({ ...actor, scopes: [] }, source.id), ForbiddenException);
  await assert.rejects(service.assessProviderCost(actor, source.id), ForbiddenException);
});

void test("OIC-6.2 rejects decimal values that exceed the persisted precision", async () => {
  const service = new EconomicsService({} as never);
  await assert.rejects(service.createOiuPolicy(actor, {
    applicationId: actor.applicationId,
    policyKey: "default",
    minimumIncrement: "0",
    effectiveFrom: date,
    dimensions: [{ dimension: "inputTokens", unit: "TOKENS", weightNumerator: "100000000000000000000", weightDenominator: "1" }]
  }), /supported precision/);
});
