import test from "node:test";
import assert from "node:assert/strict";
import { compareProtocols, holmAdjustedPValues, pairedStratifiedBootstrap } from "./statistics";

void test("paired bootstrap is deterministic, case-stratified, and keeps planned missingness visible", () => {
  const baseline = [
    { caseId: "a", trial: 1, value: 1 }, { caseId: "a", trial: 2, value: 1 },
    { caseId: "b", trial: 1, value: 3 }, { caseId: "b", trial: 2, value: 3 }
  ];
  const candidate = baseline.map((item) => ({ ...item, value: item.value + 2 }));
  const options = { plannedPairs: 4, minimumCases: 2, resamples: 1000, seed: 41 };
  const first = pairedStratifiedBootstrap(baseline, candidate, options);
  const second = pairedStratifiedBootstrap(baseline, candidate, options);
  assert.deepEqual(first, second);
  assert.equal(first.availability, "MEASURED");
  assert.equal(first.estimate, 2);
  assert.equal(first.interval?.lower, 2);
  assert.equal(first.interval?.upper, 2);
  assert.equal(first.coverage, 1);
  const incomplete = pairedStratifiedBootstrap(baseline.slice(0, 3), candidate.slice(0, 3), options);
  assert.equal(incomplete.availability, "INSUFFICIENT");
  assert.equal(incomplete.missingPairs, 1);
});

void test("Holm adjustment is monotone in ordered hypotheses", () => {
  assert.deepEqual(holmAdjustedPValues([0.03, 0.01, 0.04]), [0.06, 0.03, 0.06]);
});

void test("comparability keeps changed protocols descriptive and exposed holdouts ineligible", () => {
  const base = { targetClass: "BASE_MODEL", treatmentKey: "model", releaseId: "r1", harnessDigest: "h", environmentDigest: "e", oracleRevision: "o", metricRevision: "m", judgeRevision: "j", samplingRevision: "s", retryRevision: "t", caseIds: ["a", "b"], verificationTier: "OIC_EXECUTED_VERIFIED" } as const;
  assert.equal(compareProtocols(base, base).status, "DIRECTLY_COMPARABLE");
  assert.equal(compareProtocols(base, base).decisionEligible, false);
  const changed = compareProtocols(base, { ...base, harnessDigest: "h2" });
  assert.equal(changed.status, "DESCRIPTIVE_ONLY");
  assert.equal(changed.decisionEligible, false);
  const exposed = compareProtocols(base, { ...base, holdoutCompromised: true });
  assert.equal(exposed.status, "NOT_COMPARABLE");
  assert.ok(exposed.reasonCodes.includes("HOLDOUT_EXPOSED"));
  const incomplete = compareProtocols({ ...base, evidenceComplete: false }, base);
  assert.equal(incomplete.status, "NOT_COMPARABLE");
  assert.ok(incomplete.reasonCodes.includes("EVIDENCE_INVALID"));
  const invalidRelease = compareProtocols({ ...base, releaseEligible: false }, base);
  assert.equal(invalidRelease.status, "NOT_COMPARABLE");
  assert.ok(invalidRelease.reasonCodes.includes("RELEASE_INVALID"));
  const unverified = compareProtocols(base, { ...base, verificationTier: "SELF_REPORTED" });
  assert.equal(unverified.decisionEligible, false);
});
