import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationService } from "./evaluation.service";
import { EvaluationWorkQueue } from "./evaluation-work-queue";

const capabilities = () => ({
  database: true, durableQueue: true, claimFencing: true, claimLoopAlive: true,
  compatibilityIdentity: "oic-evaluation-worker-readiness-v1",
  artifactWriteKeyVersion: 2, legacyWriteDisabled: true, artifactEvidence: true,
  artifactFinalization: true, sealedOracle: true, admission: true,
  outboxFinalization: true, textGeneration: true,
  supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"], sandbox: "NOT_REQUIRED_FOR_TEXT"
});

function healthService(readiness: unknown, config: Record<string, string> = {}) {
  const db = { oicProviderConnection: { count: () => Promise.resolve(1) } };
  const queue = { workerReadiness: () => Promise.resolve(readiness) };
  return new EvaluationService(db as never, {} as never, undefined, { get: (key: string) => config[key] ?? (key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : key === "OIC_ADMISSION_MODE" ? "ENFORCE" : "false") } as never, undefined, undefined, queue as never);
}

const actor = { id: "operator", applicationId: "app", tenantIds: [], scopes: ["oic:evaluation:manage"] };
const state = (workerState: string, fresh: boolean, extra: Record<string, unknown> = {}) => ({
  state: workerState, fresh, instanceId: "evaluation-worker:opaque", generation: 3,
  startedAt: new Date("2026-10-14T00:00:00.000Z"), heartbeatAt: new Date("2026-10-14T00:00:01.000Z"),
  heartbeatAgeMs: 100, reasonCode: null, capabilities: capabilities(), activeExecutionSlots: 0,
  configuredConcurrency: 1, availableExecutionSlots: 1, ...extra
});

void test("disabled scheduler and worker make run execution unavailable", async () => {
  const response = await healthService(state("READY", true), { OIC_EVALUATION_WORKER_ENABLED: "false" }).health(actor);
  assert.equal(response.scheduler, "DISABLED");
  assert.equal(response.runExecution, "UNAVAILABLE");
});

void test("enabled scheduler without an attestation stays unverified", async () => {
  const response = await healthService(state("ABSENT", false, { reasonCode: "NO_WORKER_ATTESTATION", capabilities: null })).health(actor);
  assert.equal(response.scheduler, "ENABLED");
  assert.equal(response.worker, "ABSENT");
  assert.equal(response.runExecution, "ENABLED_UNVERIFIED");
});

void test("starting, stale, draining, and degraded workers cannot make run execution ready", async () => {
  for (const [workerState, fresh, reason] of [["STARTING", true, null], ["STALE", false, "WORKER_ATTESTATION_STALE"], ["DRAINING", false, null], ["DEGRADED", true, "QUEUE_UNAVAILABLE"]] as const) {
    const response = await healthService(state(workerState, fresh, { reasonCode: reason })).health(actor);
    assert.equal(response.scheduler, "ENABLED", workerState);
    assert.notEqual(response.runExecution, "AVAILABLE_VERIFIED", workerState);
  }
});

void test("fresh complete worker attestation verifies text execution without requiring Docker", async () => {
  const response = await healthService(state("READY", true)).health(actor);
  assert.equal(response.scheduler, "READY");
  assert.equal(response.worker, "READY");
  assert.equal(response.workerFresh, true);
  assert.equal(response.runExecution, "AVAILABLE_VERIFIED");
  assert.equal(response.workerAttestation?.instanceId, "evaluation-worker:opaque");
  assert.deepEqual(response.workerAttestation?.capabilities?.supportedTargetClasses, ["MODEL_WITH_OIC_RUNTIME"]);
  assert.equal(response.workerAttestation?.capabilities?.sandbox, "NOT_REQUIRED_FOR_TEXT");
});

void test("wrong artifact key version or missing admission/outbox capability degrades execution readiness", async () => {
  for (const patch of [{ artifactWriteKeyVersion: 1 }, { admission: false }, { outboxFinalization: false }]) {
    const cap = { ...capabilities(), ...patch };
    const response = await healthService(state("READY", true, { capabilities: cap })).health(actor);
    assert.equal(response.scheduler, "ENABLED");
    assert.equal(response.runExecution, "ENABLED_UNVERIFIED");
  }
});

void test("scheduler database failure is reduced to a bounded safe reason", async () => {
  const db = { oicProviderConnection: { count: () => Promise.resolve(0) } };
  const queue = { workerReadiness: () => Promise.reject(new Error("secret-bearing database exception")) };
  const service = new EvaluationService(db as never, {} as never, undefined, { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : "ENFORCE" } as never, undefined, undefined, queue as never);
  const response = await service.health(actor);
  assert.equal(response.worker, "DEGRADED");
  assert.equal(response.workerReasonCode, "QUEUE_UNAVAILABLE");
  assert.equal(response.runExecution, "UNAVAILABLE");
  assert.equal(JSON.stringify(response).includes("secret-bearing"), false);
});

void test("readiness recovers when a healthy fresh worker attestation appears", async () => {
  let current = state("STALE", false, { reasonCode: "WORKER_ATTESTATION_STALE" });
  const service = healthService(current);
  const queue = (service as unknown as { workQueue: { workerReadiness: () => Promise<unknown> } }).workQueue;
  queue.workerReadiness = () => Promise.resolve(current);
  assert.equal((await service.health(actor)).runExecution, "ENABLED_UNVERIFIED");
  current = state("READY", true);
  assert.equal((await service.health(actor)).scheduler, "READY");
  assert.equal((await service.health(actor)).runExecution, "AVAILABLE_VERIFIED");
});

void test("evaluation overview exposes scoped pending, leased, and active execution counts", async () => {
  const calls: Array<{ where: Record<string, unknown> }> = [];
  const count = (value: number) => ({ count: ({ where }: { where: Record<string, unknown> }) => { calls.push({ where }); return Promise.resolve(value); } });
  const db = {
    oicEvaluationPackRevision: count(1), oicEvaluationRelease: count(2), oicEvaluationCampaign: count(3),
    oicEvaluationRun: { ...count(4), count: ({ where }: { where: Record<string, unknown> }) => { calls.push({ where }); return Promise.resolve(where.status === "RUNNING" ? 1 : 4); } },
    oicEvaluationReport: { count: ({ where }: { where: Record<string, unknown> }) => { calls.push({ where }); return Promise.resolve(5); } },
    oicEvaluationCandidate: count(6),
    oicEvaluationWorkItem: { count: ({ where }: { where: Record<string, unknown> }) => { calls.push({ where }); return Promise.resolve(where.status === "PENDING" ? 7 : 8); } }
  };
  const response = await new EvaluationService(db as never, {} as never).overview(actor, actor.applicationId);
  assert.equal(response.queue.queuedWorkItems, 7);
  assert.equal(response.queue.leasedWorkItems, 8);
  assert.equal(response.queue.activeRuns, 1);
  assert.ok(calls.every(({ where }) => where.applicationId === actor.applicationId || (where.run as Record<string, unknown> | undefined)?.applicationId === actor.applicationId));
  assert.ok(calls.some(({ where }) => where.status === "RUNNING"));
});

void test("worker attestation serialization drops credentials, key material, oracle data, and unknown fields", async () => {
  const now = new Date();
  const db = { $queryRaw: () => Promise.resolve([{
    workerInstanceId: "evaluation-worker:opaque", workerGeneration: 3, workerState: "READY", workerReasonCode: null,
    workerStartedAt: now, workerHeartbeatAt: now, workerLeaseUntil: new Date(now.getTime() + 5_000),
    workerCapabilities: { ...capabilities(), authorization: "private-token", key: "private-key", oracle: "sealed-answer", unknown: "do-not-return" },
    databaseNow: now, activeExecutionSlots: 0n
  }]) };
  const response = await new EvaluationWorkQueue(db as never).workerReadiness();
  assert.equal(response.state, "READY");
  const serialized = JSON.stringify(response);
  for (const forbidden of ["private-token", "private-key", "sealed-answer", "unknown"]) assert.equal(serialized.includes(forbidden), false);
  assert.equal((response.capabilities as Record<string, unknown>).artifactWriteKeyVersion, 2);
});

void test("stale worker readiness blocks run creation before protocol lookup or runtime work", async () => {
  let protocolReads = 0;
  let targetReads = 0;
  const db = { oicEvaluationProtocolManifest: { findFirst: () => { protocolReads++; return Promise.resolve(null); } } };
  const runtime = { describeEvaluationTarget: () => { targetReads++; return Promise.reject(new Error("must not resolve target")); } };
  const queue = { workerReadiness: () => Promise.resolve(state("STALE", false, { reasonCode: "WORKER_ATTESTATION_STALE" })) };
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : "ENFORCE" };
  const service = new EvaluationService(db as never, {} as never, runtime as never, config as never, undefined, undefined, queue as never);
  await assert.rejects(service.startRun(actor, { manifestId: "manifest", modelId: "oi-model", runtimePrincipalId: "runtime", campaignId: "campaign", idempotencyKey: "readiness-test-01" }), /EVALUATION_EXECUTION_NOT_VERIFIED/);
  assert.equal(protocolReads, 0);
  assert.equal(targetReads, 0);
});
