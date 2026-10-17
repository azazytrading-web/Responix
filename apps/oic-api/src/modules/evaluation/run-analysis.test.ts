import test from "node:test";
import assert from "node:assert/strict";
import { buildRunAnalysis, estimatePairedMetric, accountingEvidence } from "./run-analysis";
import { Prisma } from "@oic/database";

void test("analysis preserves absent measurements and decision ineligibility instead of coercing missing data to zero", () => {
  const result = buildRunAnalysis({ plannedCases: 1, terminalCases: 1, expectedMetrics: [], measurements: [], failures: [] });
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.decisionEligible, false);
  assert.deepEqual(result.metrics, []);
  assert.ok(result.limitations.includes("NO_PREREGISTERED_METRICS"));
});

void test("accounting evidence canonicalizes exact Decimal values without changing unknown values to zero", () => {
  assert.equal(accountingEvidence(new Prisma.Decimal("0.0000978000")), "0.0000978");
  assert.equal(accountingEvidence(new Prisma.Decimal("164")), "164");
  assert.equal(accountingEvidence(null), null);
  assert.equal(accountingEvidence(Number.NaN), null);
});

void test("typed numeric and boolean measurements expose bounded descriptive values and missingness", () => {
  const result = buildRunAnalysis({
    plannedCases: 2,
    terminalCases: 2,
    expectedMetrics: [
      { metricKey: "quality.match", revision: 1, type: "BOOLEAN", unit: "RATIO", polarity: "HIGH_IS_GOOD", minimumEffectiveN: 2 },
      { metricKey: "latency.ms", revision: 1, type: "DECIMAL", unit: "MS", polarity: "LOW_IS_GOOD", minimumEffectiveN: 2 }
    ],
    measurements: [
      { caseId: "case-a", trial: 1, metricKey: "quality.match", metricRevision: 1, type: "BOOLEAN", unit: "RATIO", availability: "MEASURED", value: true, evidenceDigest: "a".repeat(64) },
      { caseId: "case-b", trial: 1, metricKey: "quality.match", metricRevision: 1, type: "BOOLEAN", unit: "RATIO", availability: "MEASURED", value: false, evidenceDigest: "b".repeat(64) },
      { caseId: "case-a", trial: 1, metricKey: "latency.ms", metricRevision: 1, type: "DECIMAL", unit: "MS", availability: "MEASURED", value: 10, evidenceDigest: "c".repeat(64) },
      { caseId: "case-b", trial: 1, metricKey: "latency.ms", metricRevision: 1, type: "DECIMAL", unit: "MS", availability: "INSUFFICIENT", value: null, evidenceDigest: null }
    ],
    failures: []
  });
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.decisionEligible, false);
  assert.equal(result.metrics[0]?.descriptive?.mean, 0.5);
  assert.equal(result.metrics[1]?.measuredN, 1);
  assert.equal(result.metrics[1]?.missingByReason.INSUFFICIENT, 1);
  assert.equal(result.metrics[1]?.descriptive?.mean, 10);
});

void test("paired estimates keep missing observations visible and deterministic", () => {
  const baseline = [{ caseId: "a", trial: 1, value: 1, availability: "MEASURED" }, { caseId: "b", trial: 1, value: null, availability: "INSUFFICIENT" }];
  const candidate = [{ caseId: "a", trial: 1, value: 2, availability: "MEASURED" }, { caseId: "b", trial: 1, value: 3, availability: "MEASURED" }];
  const options = { valueType: "DECIMAL", plannedPairs: 2, minimumCases: 1, seed: 13 };
  const estimate = estimatePairedMetric({ baseline, candidate, ...options });
  assert.equal(estimate.availability, "INSUFFICIENT");
  assert.equal(estimate.estimate, 1);
  assert.equal(estimate.missingPairs, 1);
  assert.deepEqual(estimate, estimatePairedMetric({ baseline, candidate, ...options }));
});

void test("paired estimates retain measured Boolean trials as 0/1 observations", () => {
  const baseline = [
    { caseId: "case-a", trial: 1, value: false, availability: "MEASURED" },
    { caseId: "case-a", trial: 2, value: true, availability: "MEASURED" }
  ];
  const candidate = [
    { caseId: "case-a", trial: 1, value: false, availability: "MEASURED" },
    { caseId: "case-a", trial: 2, value: false, availability: "MEASURED" }
  ];
  const estimate = estimatePairedMetric({ baseline, candidate, valueType: "BOOLEAN", plannedPairs: 2, minimumCases: 1, seed: 42 });
  assert.equal(estimate.availability, "MEASURED");
  assert.equal(estimate.pairedCases, 1);
  assert.equal(estimate.pairedTrials, 2);
  assert.equal(estimate.plannedPairs, 2);
  assert.equal(estimate.missingPairs, 0);
  assert.equal(estimate.estimate, -0.5);
  assert.ok(estimate.interval);
  assert.equal(estimate.method, "STRATIFIED_PAIRED_BOOTSTRAP_V1");
  assert.equal(estimatePairedMetric({ baseline, candidate, valueType: "DECIMAL", plannedPairs: 2, minimumCases: 1, seed: 42 }).availability, "INSUFFICIENT");
});

void test("Boolean pairing stays typed, keeps missing trials, and rejects generic truthy coercion", () => {
  const baseline = [
    { caseId: "case-a", trial: 1, value: false, availability: "MEASURED" },
    { caseId: "case-a", trial: 2, value: true, availability: "MEASURED" }
  ];
  const candidate = [
    { caseId: "case-a", trial: 1, value: false, availability: "MEASURED" },
    { caseId: "case-a", trial: 2, value: null, availability: "INSUFFICIENT" }
  ];
  const missing = estimatePairedMetric({ baseline, candidate, valueType: "BOOLEAN", plannedPairs: 2, minimumCases: 1, seed: 7 });
  assert.equal(missing.pairedTrials, 1);
  assert.equal(missing.missingPairs, 1);
  assert.equal(missing.availability, "INSUFFICIENT");

  const truthyString = estimatePairedMetric({
    baseline: [{ caseId: "case-a", trial: 1, value: "true", availability: "MEASURED" }],
    candidate: [{ caseId: "case-a", trial: 1, value: true, availability: "MEASURED" }],
    valueType: "BOOLEAN", plannedPairs: 1, minimumCases: 1, seed: 7
  });
  assert.equal(truthyString.pairedTrials, 0);
  assert.equal(truthyString.availability, "INSUFFICIENT");
});
