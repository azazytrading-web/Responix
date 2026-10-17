import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@oic/database";
import { computeBudgetLedgerAggregate, type BudgetReconciliationAdmission } from "./evaluation-budget-reconciliation";

const D = (value: string) => new Prisma.Decimal(value);
function admission(id: string, state: "SETTLED" | "RELEASED", capacityExtensionId: string | null, amount: string, release: string, consume: string, revision: string): BudgetReconciliationAdmission {
  const bucketId = `bucket-${id}`;
  return { id, status: state, capacityExtensionId, legs: [{ bucketId, amount: D(amount), state, budgetRevisionId: revision, bucket: { unit: "OIU" } }], postings: [
    { kind: "RESERVE", amount: D(amount), bucketId },
    ...(D(release).isZero() ? [] : [{ kind: "RELEASE", amount: D(release), bucketId }]),
    ...(D(consume).isZero() ? [] : [{ kind: "CONSUME", amount: D(consume), bucketId }])
  ] };
}

void test("run aggregate is recomputed exactly from terminal immutable OIC-6 postings with base and supplement kept distinct", () => {
  const result = computeBudgetLedgerAggregate([
    admission("base-settled", "SETTLED", null, "256", "82.125", "173.875", "base-revision"),
    admission("supplement-released", "RELEASED", "extension-1", "256", "256", "0", "supplement-revision")
  ]);
  assert.equal(result.admissionCount, 2);
  assert.equal(result.reservedOiu, "512");
  assert.equal(result.releasedOiu, "338.125");
  assert.equal(result.consumedOiu, "173.875");
  assert.equal(result.funding.BASE?.reservedOiu, "256");
  assert.equal(result.funding["SUPPLEMENT:extension-1"]?.reservedOiu, "256");
  assert.equal(result.ledgerBasisDigest.length, 64);
  assert.equal(computeBudgetLedgerAggregate([
    admission("supplement-released", "RELEASED", "extension-1", "256", "256", "0", "supplement-revision"),
    admission("base-settled", "SETTLED", null, "256", "82.125", "173.875", "base-revision")
  ]).ledgerBasisDigest, result.ledgerBasisDigest);
});

void test("ledger reconciliation rejects duplicate admissions, pending status and inconsistent reserve/release/consume arithmetic", () => {
  const released = admission("released", "RELEASED", null, "256", "256", "0", "base");
  assert.throws(() => computeBudgetLedgerAggregate([released, released]), /DUPLICATE_ADMISSION/);
  assert.throws(() => computeBudgetLedgerAggregate([{ ...released, status: "ADMITTED" }]), /NOT_TERMINAL/);
  assert.throws(() => computeBudgetLedgerAggregate([{ ...released, postings: released.postings.filter(p => p.kind !== "RELEASE") }]), /POSTINGS_INCONSISTENT/);
  assert.throws(() => computeBudgetLedgerAggregate([{ ...released, postings: [...released.postings, { kind: "RELEASE", amount: D("1"), bucketId: "bucket-released" }] }]), /POSTINGS_INCONSISTENT/);
});
