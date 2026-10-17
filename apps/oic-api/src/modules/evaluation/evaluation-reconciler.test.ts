import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationReconciler } from "./evaluation-reconciler";

void test("sandbox orphan reconciliation consults the authoritative attempt lease", async () => {
  const attemptId = "c8b49b66-a9a9-4edf-b955-ef5084ea46e1";
  const calls: string[] = [];
  const queue = { reconcileExpired: () => Promise.resolve({ admissionUncertain: 1, cancelled: 3, exhausted: 2 }), reconcileBudget: () => Promise.resolve({ inspected: 4, reconciled: 2, releasedOiu: "3" }), isAttemptLeaseValid: (id: string) => { calls.push(id); return Promise.resolve(id === attemptId); } };
  const sandbox = { reconcileOrphans: async (valid: (id: string) => Promise<boolean>) => {
    assert.equal(await valid(attemptId), true);
    assert.equal(await valid("c8b49b66-a9a9-4edf-b955-ef5084ea46e2"), false);
    return { inspected: 2, removed: 1, retained: 1 };
  } };
  const reconciler = new EvaluationReconciler({ get: () => "true" } as never, queue as never, sandbox as never);
  assert.deepEqual(await reconciler.processOnce(), { inspected: 2, removed: 1, retained: 1, admissionUncertain: 1, cancelled: 3, exhausted: 2, budgetInspected: 4, budgetReconciled: 2, budgetReleasedOiu: "3" });
  assert.equal(calls.length, 2);
});

void test("orphan reconciliation does not touch Docker when disabled", async () => {
  const sandbox = { reconcileOrphans: () => { throw new Error("must not call Docker"); } };
  const reconciler = new EvaluationReconciler({ get: () => "false" } as never, {} as never, sandbox as never);
  assert.equal(await reconciler.processOnce(), "DISABLED");
});

void test("text worker reconciles expired leases without requiring Docker", async () => {
  const queue = { reconcileExpired: () => Promise.resolve({ admissionUncertain: 0, cancelled: 1, exhausted: 0 }), reconcileBudget: () => Promise.resolve({ inspected: 1, reconciled: 1, releasedOiu: "10" }) };
  const sandbox = { reconcileOrphans: () => { throw new Error("must not call Docker"); } };
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : "false" };
  const reconciler = new EvaluationReconciler(config as never, queue as never, sandbox as never);
  assert.deepEqual(await reconciler.processOnce(), { inspected: 0, removed: 0, retained: 0, admissionUncertain: 0, cancelled: 1, exhausted: 0, budgetInspected: 1, budgetReconciled: 1, budgetReleasedOiu: "10" });
});
