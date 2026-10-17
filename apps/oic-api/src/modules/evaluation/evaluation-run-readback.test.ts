import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationService } from "./evaluation.service";

const runId = "11111111-1111-4111-8111-111111111111";
const admissionId = "22222222-2222-4222-8222-222222222222";

function service(withProvider = true, releasedOiu = "84") {
  const run = {
    id: runId, applicationId: "33333333-3333-4333-8333-333333333333", tenantId: null,
    campaignId: "44444444-4444-4444-8444-444444444444", manifest: { id: "manifest", targetClass: "MODEL_WITH_OIC_RUNTIME", canonicalDigest: "a".repeat(64), protocolVersion: "v1" },
    targetClass: "MODEL_WITH_OIC_RUNTIME", targetFingerprint: "b".repeat(64), status: "EXECUTED", verificationTier: "OIC_EXECUTED",
    diagnosticOnly: false, plannedTrials: 1, plannedDenominator: 1, completedAt: new Date(), createdAt: new Date(),
    cases: [{ id: "case-execution", caseRevisionId: "case-revision", repetitionOrdinal: 1, status: "EXECUTED", unusedReservationReleasedOiu: "0", completedAt: new Date(), attempts: [{ id: "physical-attempt", attemptOrdinal: 1, status: "SUCCEEDED", admissionId, failureClass: null, verificationTier: "VERIFIED", evidenceDigest: "c".repeat(64), startedAt: new Date(), completedAt: new Date() }], _count: { attempts: 1, measurements: 1 } }],
    reports: []
  };
  const db = {
    oicEvaluationRun: { findFirst: () => Promise.resolve(run) },
    oicAdmission: { findMany: () => Promise.resolve([{ id: admissionId, status: "SETTLED", legs: [{ amount: "128", state: "SETTLED", bucket: { unit: "OIU" } }], postings: [
      { kind: "RESERVE", amount: "128", bucket: { unit: "OIU" } },
      { kind: "CONSUME", amount: "44", bucket: { unit: "OIU" } },
      { kind: "RELEASE", amount: releasedOiu, bucket: { unit: "OIU" } }
    ] }]) },
    oicProviderAttempt: { findMany: () => Promise.resolve(withProvider ? [{ id: "provider-attempt", admissionId, status: "SUCCEEDED", usageStatus: "REPORTED", providerKey: "openai-compatible", upstreamModelId: "deepseek-flash", bindingId: "binding", connectionId: "connection", binding: { status: "ACTIVE", environment: "production" }, connection: { displayName: "OIC-7 live canary", providerDefinition: { key: "deepseek", displayName: "DeepSeek" } }, startedAt: new Date(), completedAt: new Date(), usageEvents: [{ id: "usage-event", normalizedDimensions: { inputTokens: 10, outputTokens: 5 }, costAssessments: [{ kind: "ORIGINAL", status: "ASSESSED", nativeAmount: { toString: () => "0.001" }, currency: "USD", evidenceClass: "ASSESSED" }], oiuAssessments: [{ kind: "ORIGINAL", status: "ASSESSED", oiu: { toString: () => "44" } }] }] }] : []) }
  };
  return new EvaluationService(db as never, {} as never);
}

const actor = { id: "reader", applicationId: "33333333-3333-4333-8333-333333333333", tenantIds: [], scopes: ["oic:evaluation:read"] };

void test("run readback joins canonical provider, usage, cost and OIC-6 posting evidence", async () => {
  const result = await service().run(actor, runId);
  const accounting = result.accounting as Record<string, unknown>;
  assert.equal(accounting.state, "LIVE");
  assert.equal(accounting.dispatchCount, 1);
  assert.equal(accounting.inputTokens, 10);
  assert.equal(accounting.outputTokens, 5);
  assert.deepEqual(accounting.providerCosts, { USD: { amount: "0.001", state: "ASSESSED" } });
  assert.deepEqual(accounting.oiu, { reserved: "128", consumed: "44", released: "84", state: "SETTLED" });
  const row = (accounting.attempts as Array<Record<string, unknown>>)[0]!;
  const provider = (row.providerAttempts as Array<Record<string, unknown>>)[0]!;
  assert.equal(row.caseExecutionId, "case-execution");
  assert.equal(provider.model, "deepseek-flash");
  assert.equal(provider.provider, "DeepSeek");
  assert.equal(provider.bindingId, "binding");
});

void test("run readback leaves missing provider, token, cost and settlement evidence unknown", async () => {
  const result = await service(false).run(actor, runId);
  const accounting = result.accounting as Record<string, unknown>;
  assert.equal(accounting.dispatchCount, 0);
  assert.equal(accounting.inputTokens, null);
  assert.equal(accounting.outputTokens, null);
  assert.deepEqual(accounting.providerCosts, {});
  assert.deepEqual(accounting.oiu, { reserved: "128", consumed: null, released: "84", state: "UNKNOWN" });
  assert.equal(JSON.stringify(accounting).includes("0.001"), false);
});

void test("run readback refuses settled status when OIC-6 reserve, consume, and release postings do not balance", async () => {
  const result = await service(true, "83").run(actor, runId);
  const accounting = result.accounting as Record<string, unknown>;
  assert.equal(accounting.state, "PARTIAL");
  assert.deepEqual(accounting.oiu, { reserved: "128", consumed: "44", released: "83", state: "PARTIAL" });
});
