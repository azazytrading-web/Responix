import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { EvaluationWorkQueue, evaluationAttemptBudgetRelease, evaluationBudgetReleaseFitsProjection, packet76RecoveryLeaseRetryable, type EvaluationWorkLease } from "./evaluation-work-queue";
import { Prisma } from "@oic/database";

void test("recovery worker attempts without an OIC-6 admission release no invented reservation", () => {
  const bound = new Prisma.Decimal("256.000000000000000000");
  const zero = new Prisma.Decimal(0);
  assert.equal(evaluationAttemptBudgetRelease({ bound, consumed: zero, admissionExists: false, recoveryGenerationId: "generation" }).toString(), "0");
  assert.equal(evaluationAttemptBudgetRelease({ bound, consumed: new Prisma.Decimal("174.125"), admissionExists: true, recoveryGenerationId: null }).toString(), "81.875");
});

void test("budget reconciliation skips releases that violate stale campaign or run projections", () => {
  const amount = new Prisma.Decimal("82");
  const runReserved = new Prisma.Decimal("256");
  assert.equal(evaluationBudgetReleaseFitsProjection({ amount, campaignReserved: new Prisma.Decimal("82"), runReserved, runReleased: new Prisma.Decimal("174"), extensionFunded: false }), true);
  assert.equal(evaluationBudgetReleaseFitsProjection({ amount, campaignReserved: new Prisma.Decimal("81"), runReserved, runReleased: new Prisma.Decimal("0"), extensionFunded: false }), false);
  assert.equal(evaluationBudgetReleaseFitsProjection({ amount, campaignReserved: new Prisma.Decimal("256"), runReserved, runReleased: new Prisma.Decimal("175"), extensionFunded: false }), false);
  assert.equal(evaluationBudgetReleaseFitsProjection({ amount, campaignReserved: new Prisma.Decimal("0"), runReserved: null, runReleased: new Prisma.Decimal("0"), extensionFunded: true }), true);
});

const scope = {
  applicationId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a3",
  tenantId: null,
  runId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a4",
  caseExecutionId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a5"
};

void test("expired Packet 7.6 recovery leases requeue only when no provider boundary or unresolved admission exists", () => {
  const eligible = {
    generationStatus: "ACTIVE", usedPhysicalAttempts: 1, maxPhysicalAttempts: 3,
    attemptStatus: "CREATED", providerAttemptId: null, providerDispatchStarted: false,
    admissionStatus: null, providerAttemptCount: 0
  };
  assert.equal(packet76RecoveryLeaseRetryable(eligible), true);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, admissionStatus: "RELEASED" }), true);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, admissionStatus: "ADMITTED" }), false);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, providerAttemptCount: 1 }), false);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, providerAttemptId: "provider-attempt" }), false);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, providerDispatchStarted: true }), false);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, generationStatus: "CLOSED" }), false);
  assert.equal(packet76RecoveryLeaseRetryable({ ...eligible, usedPhysicalAttempts: 3 }), false);
});

void test("readiness slot uses the existing scheduler lock, PostgreSQL time, and a bounded single owner generation", async () => {
  const now = new Date("2026-10-14T12:00:00.000Z");
  const statements: string[] = [];
  const tx = {
    $queryRaw: (query: { sql: string }) => {
      statements.push(query.sql);
      if (query.sql.includes("pg_advisory_xact_lock")) return Promise.resolve([{ locked: 1 }]);
      if (query.sql.includes('SELECT "workerInstanceId"')) return Promise.resolve([{ workerInstanceId: null, workerGeneration: 0, workerLeaseUntil: null, databaseNow: now }]);
      if (query.sql.includes("RETURNING \"workerGeneration\"")) return Promise.resolve([{ workerGeneration: 1 }]);
      throw new Error("unexpected readiness query");
    },
    $executeRaw: (query: { sql: string }) => { statements.push(query.sql); return Promise.resolve(1); }
  };
  const queue = new EvaluationWorkQueue({ $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as never);
  assert.equal(await queue.acquireWorkerSlot("evaluation-worker:instance-a"), 1);
  assert.ok(statements.some((sql) => sql.includes("pg_advisory_xact_lock(730072")));
  assert.ok(statements.some((sql) => sql.includes("clock_timestamp()")));
  assert.equal(statements.some((sql) => /INSERT INTO "OicProviderAttempt"|INSERT INTO "OicEvaluationRun"/.test(sql)), false);
});

void test("a second replica cannot claim the live evaluator slot", async () => {
  const now = new Date("2026-10-14T12:00:00.000Z");
  const tx = {
    $queryRaw: (query: { sql: string }) => query.sql.includes("pg_advisory_xact_lock")
      ? Promise.resolve([{ locked: 1 }])
      : Promise.resolve([{ workerInstanceId: "evaluation-worker:replica-a", workerGeneration: 4, workerLeaseUntil: new Date(now.getTime() + 5_000), databaseNow: now }]),
    $executeRaw: () => Promise.resolve(1)
  };
  const queue = new EvaluationWorkQueue({ $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as never);
  assert.equal(await queue.acquireWorkerSlot("evaluation-worker:replica-b"), null);
});

void test("scheduler heartbeat proves queue/outbox and fenced-slot SQL without manufacturing work", async () => {
  const statements: string[] = [];
  let queryNumber = 0;
  const tx = {
    $queryRaw: (query: { sql: string }) => {
      statements.push(query.sql);
      queryNumber++;
      if (query.sql.includes("pg_advisory_xact_lock")) return Promise.resolve([{ locked: 1 }]);
      if (query.sql.includes("FOR UPDATE") && query.sql.includes('workerGeneration')) return Promise.resolve([{ id: "EVALUATION" }]);
      if (query.sql.includes('count(*)::bigint')) return Promise.resolve([{ active: 0n }]);
      if (query.sql.includes("RETURNING \"id\"")) return Promise.resolve([{ id: "EVALUATION" }]);
      return Promise.resolve([]);
    },
    $executeRaw: (query: { sql: string }) => { statements.push(query.sql); return Promise.resolve(0); }
  };
  const queue = new EvaluationWorkQueue({ $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as never);
  const ready = await queue.heartbeatWorker("evaluation-worker:instance-a", 1, { database: true, artifactWriteKeyVersion: 2 });
  assert.equal(ready, true);
  assert.ok(statements.some((sql) => sql.includes('FROM "OicEvaluationWorkItem" WHERE false')));
  assert.ok(statements.some((sql) => sql.includes('UPDATE "OicEvaluationWorkItem"') && sql.includes("WHERE false")));
  assert.ok(statements.some((sql) => sql.includes('FROM "OicEvaluationOutbox" WHERE false')));
  assert.ok(statements.some((sql) => sql.includes("clock_timestamp()")));
  assert.equal(statements.some((sql) => /INSERT INTO "OicProviderAttempt"|INSERT INTO "OicEvaluationRun"|INSERT INTO "OicEvaluationWorkItem"/.test(sql)), false);
  assert.ok(queryNumber >= 6);
});

void test("freshness is computed against PostgreSQL time and clean shutdown revokes the lease", async () => {
  const now = new Date("2026-10-14T12:00:00.000Z");
  const run = async (workerLeaseUntil: Date, workerState: string) => {
    const db = { $queryRaw: () => Promise.resolve([{
      workerInstanceId: "evaluation-worker:instance-a", workerGeneration: 2, workerState,
      workerReasonCode: null, workerStartedAt: now, workerHeartbeatAt: now, workerLeaseUntil,
      workerCapabilities: { database: true, key: "never-return" }, databaseNow: now, activeExecutionSlots: 0n
    }]) };
    return new EvaluationWorkQueue(db as never).workerReadiness();
  };
  assert.equal((await run(new Date(now.getTime() + 5_000), "READY")).state, "READY");
  assert.equal((await run(new Date(now.getTime() - 1), "READY")).state, "STALE");
  const draining = await run(now, "DRAINING");
  assert.equal(draining.state, "DRAINING");
  assert.equal(draining.fresh, false);
  assert.equal(JSON.stringify(draining).includes("never-return"), false);
});

void test("enqueue creates durable work and an identifier-only outbox event in one transaction", async () => {
  const writes: Array<{ model: string; data: Record<string, unknown> }> = [];
  const tx = {
    oicEvaluationWorkItem: { create: ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "work", data }); return Promise.resolve({ id: "work-id", status: "PENDING" }); } },
    oicEvaluationOutbox: { create: ({ data }: { data: Record<string, unknown> }) => { writes.push({ model: "outbox", data }); return Promise.resolve({}); } }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const result = await new EvaluationWorkQueue(db as never).enqueueCase(scope);
  assert.deepEqual(result, { id: "work-id", eventKey: `${scope.caseExecutionId}:enqueued`, status: "PENDING" });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1]?.data.payload, { workItemId: "work-id", runId: scope.runId, caseExecutionId: scope.caseExecutionId });
  assert.equal(JSON.stringify(writes[1]?.data.payload).includes("oracle"), false);
});

void test("queue rejects malformed scope, unsafe worker identity and unbounded leases before database access", async () => {
  let touched = false;
  const db = { $transaction: () => { touched = true; return Promise.reject(new Error("unexpected database access")); } };
  const queue = new EvaluationWorkQueue(db as never);
  await assert.rejects(queue.enqueueCase({ ...scope, caseExecutionId: "../outside" }), ConflictException);
  await assert.rejects(queue.claimNext("worker with spaces", 10_000), ConflictException);
  await assert.rejects(queue.claimNext("worker-1", 999), ConflictException);
  assert.equal(touched, false);
});

void test("claims use a durable round-robin scope cursor, one active slot, and per-provider dispatch spacing", async () => {
  const statements: string[] = [];
  let advisoryLockSeen = false;
  const tx = {
    $queryRaw: (query: { sql: string }) => {
      const statement = query.sql;
      statements.push(statement);
      if (statement.includes("pg_advisory_xact_lock")) { advisoryLockSeen = true; return Promise.resolve([{ locked: 1 }]); }
      if (!advisoryLockSeen) return Promise.resolve([]);
      if (statement.includes('SELECT "lastScopeKey"')) return Promise.resolve([{ lastScopeKey: null }]);
      if (statement.includes("WITH eligible AS")) return Promise.resolve([{ id: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6", scopeKey: `${scope.applicationId}:~`, providerConnectionId: null }]);
      if (statement.includes('UPDATE "OicEvaluationWorkItem"')) return Promise.resolve([{ id: "work-id", applicationId: scope.applicationId, tenantId: null, runId: scope.runId, caseExecutionId: scope.caseExecutionId, leaseGeneration: 1, attemptCount: 1, leaseUntil: new Date("2026-10-13T10:00:00.000Z") }]);
      return Promise.resolve([]);
    },
    $executeRaw: (query: { sql: string }) => { statements.push(query.sql); return Promise.resolve(1); },
    oicEvaluationWorkItem: { update: () => Promise.resolve({}) },
    oicEvaluationCaseExecution: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationRun: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationRecoveryGeneration: { findUnique: () => Promise.resolve(null) },
    oicEvaluationAttempt: {
      updateMany: () => Promise.resolve({ count: 0 }),
      create: () => Promise.resolve({ id: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7" })
    }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const config = { get: (key: string) => key === "OIC_EVALUATOR_PROVIDER_MIN_INTERVAL_MS" ? 500 : undefined };
  const lease = await new EvaluationWorkQueue(db as never, config as never).claimNext("worker-1", 30_000);
  assert.equal(lease?.caseExecutionId, scope.caseExecutionId);
  const claim = statements.find((statement) => statement.includes("WITH eligible AS")) ?? "";
  assert.match(claim, /ROW_NUMBER\(\) OVER/);
  assert.match(claim, /PARTITION BY work\."applicationId", work\."tenantId"/);
  assert.match(claim, /priorProviderAttempt\."startedAt" > clock_timestamp\(\)/);
  assert.match(claim, /active\."status" = 'LEASED'/);
  assert.ok(statements.some((statement) => statement.includes('UPDATE "OicEvaluationSchedulerCursor"')));
});

void test("Packet 7.6 recovery claims consume one durable generation ordinal and attach it to a unique physical attempt", async () => {
  const generationId = "2faeb177-bb35-41b3-9ceb-3f8fa97dfcbe";
  const attemptId = "5a5f2bc7-f8f9-4f68-a644-e2ef081bf232";
  const observed: string[] = [];
  let countPredicate: unknown;
  let attemptData: Record<string, unknown> | undefined;
  const generation = { id: generationId, workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6", previousAttemptId: "prior-physical-attempt", status: "ACTIVE", usedPhysicalAttempts: 0, maxPhysicalAttempts: 3 };
  const tx = {
    $queryRaw: (query: { sql: string }) => {
      const sql = query.sql;
      if (sql.includes("pg_advisory_xact_lock")) return Promise.resolve([{ locked: 1 }]);
      if (sql.includes('SELECT "lastScopeKey"')) return Promise.resolve([{ lastScopeKey: null }]);
      if (sql.includes("WITH eligible AS")) return Promise.resolve([{ id: generation.workItemId, scopeKey: `${scope.applicationId}:~`, providerConnectionId: null }]);
      if (sql.includes('UPDATE "OicEvaluationWorkItem"') && sql.includes('RETURNING "id", "applicationId"')) return Promise.resolve([{ id: generation.workItemId, applicationId: scope.applicationId, tenantId: null, runId: scope.runId, caseExecutionId: scope.caseExecutionId, leaseGeneration: 6, attemptCount: 6, leaseUntil: new Date("2026-10-16T10:00:00.000Z") }]);
      return Promise.resolve([]);
    },
    $executeRaw: () => Promise.resolve(1),
    oicEvaluationRecoveryGeneration: {
      findFirst: () => Promise.resolve(generation),
      updateMany: (input: { where: unknown }) => { countPredicate = input.where; return Promise.resolve({ count: 1 }); }
    },
    oicEvaluationWorkItem: { update: () => Promise.resolve({}) },
    oicEvaluationCaseExecution: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationRun: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationAttempt: {
      updateMany: () => Promise.resolve({ count: 0 }),
      findUnique: () => Promise.resolve({ attemptOrdinal: 5 }),
      create: ({ data }: { data: Record<string, unknown> }) => { attemptData = data; return Promise.resolve({ id: attemptId }); },
      findFirst: () => Promise.resolve({ id: "prior-physical-attempt", lastDurableStage: "FAILED", lifecycleStage: "FAILED" })
    },
    oicAuditEvent: { create: ({ data }: { data: { action: string } }) => { observed.push(data.action); return Promise.resolve({}); } }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const config = { get: (key: string) => key === "OIC_EVALUATOR_PROVIDER_MIN_INTERVAL_MS" ? 500 : undefined };
  const lease = await new EvaluationWorkQueue(db as never, config as never).claimNext("worker-recovery", 30_000);
  assert.equal(lease?.attemptOrdinal, 6);
  assert.equal(attemptData?.recoveryGenerationId, generationId);
  assert.equal(attemptData?.recoveryOrdinal, 1);
  assert.deepEqual(countPredicate, { id: generationId, status: "ACTIVE", usedPhysicalAttempts: 0, maxPhysicalAttempts: { gte: 1 } });
  assert.ok(observed.includes("evaluation.packet76.recovery_attempt.claimed"));
});

void test("second Packet 7.6 recovery generation resumes physical ordinals after its immutable anchor", async () => {
  const generationId = "6bf7423d-2cbd-480a-bbc1-a6de4959e06f";
  let attemptData: Record<string, unknown> | undefined;
  const wherePredicates: unknown[] = [];
  const generation = { id: generationId, workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6", previousAttemptId: "attempt-eight", generationOrdinal: 2, status: "ACTIVE", usedPhysicalAttempts: 0, maxPhysicalAttempts: 3 };
  const tx = {
    $queryRaw: (query: { sql: string }) => {
      const sql = query.sql;
      if (sql.includes("pg_advisory_xact_lock")) return Promise.resolve([{ locked: 1 }]);
      if (sql.includes('SELECT "lastScopeKey"')) return Promise.resolve([{ lastScopeKey: null }]);
      if (sql.includes("WITH eligible AS")) return Promise.resolve([{ id: generation.workItemId, scopeKey: `${scope.applicationId}:~`, providerConnectionId: null }]);
      if (sql.includes('UPDATE "OicEvaluationWorkItem"') && sql.includes('RETURNING "id", "applicationId"')) return Promise.resolve([{ id: generation.workItemId, applicationId: scope.applicationId, tenantId: null, runId: scope.runId, caseExecutionId: scope.caseExecutionId, leaseGeneration: 9, attemptCount: 9, leaseUntil: new Date("2026-10-16T10:00:00.000Z") }]);
      return Promise.resolve([]);
    },
    $executeRaw: () => Promise.resolve(1),
    oicEvaluationRecoveryGeneration: {
      findFirst: () => Promise.resolve(generation),
      updateMany: (input: { where: unknown }) => { wherePredicates.push(input.where); return Promise.resolve({ count: 1 }); }
    },
    oicEvaluationWorkItem: { update: () => Promise.resolve({}) },
    oicEvaluationCaseExecution: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationRun: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationAttempt: {
      updateMany: () => Promise.resolve({ count: 0 }),
      findUnique: () => Promise.resolve({ attemptOrdinal: 8 }),
      create: ({ data }: { data: Record<string, unknown> }) => { attemptData = data; return Promise.resolve({ id: "attempt-nine" }); },
      findFirst: () => Promise.resolve({ id: "attempt-eight", lastDurableStage: "FAILED", lifecycleStage: "FAILED" })
    },
    oicAuditEvent: { create: () => Promise.resolve({}) }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const config = { get: (key: string) => key === "OIC_EVALUATOR_PROVIDER_MIN_INTERVAL_MS" ? 500 : undefined };
  const lease = await new EvaluationWorkQueue(db as never, config as never).claimNext("worker-recovery-two", 30_000);
  assert.equal(lease?.attemptOrdinal, 9);
  assert.equal(attemptData?.recoveryGenerationId, generationId);
  assert.equal(attemptData?.recoveryOrdinal, 1);
  assert.deepEqual(wherePredicates, [{ id: generationId, status: "ACTIVE", usedPhysicalAttempts: 0, maxPhysicalAttempts: { gte: 1 } }]);
});

void test("lease renewal uses database time and requires matching work and case generation fences", async () => {
  const leaseUntil = new Date("2026-10-13T10:00:00.000Z");
  const statements: string[] = [];
  const tx = {
    $queryRaw: (query: { sql: string }) => {
      const statement = query.sql;
      statements.push(statement);
      if (statement.includes("UPDATE \"OicEvaluationWorkItem\"")) return Promise.resolve([{ leaseUntil }]);
      return Promise.resolve([{ id: scope.caseExecutionId }]);
    },
    oicEvaluationAttempt: { updateMany: () => Promise.resolve({ count: 1 }) }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const lease: EvaluationWorkLease = {
    workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6",
    runId: scope.runId,
    caseExecutionId: scope.caseExecutionId,
    attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7",
    workerId: "worker-1",
    generation: 4,
    attemptOrdinal: 2,
    leaseUntil: new Date("2026-10-13T09:59:00.000Z")
  };
  assert.equal(await new EvaluationWorkQueue(db as never).renew(lease, 15_000), leaseUntil);
  assert.equal(statements.length, 2);
  assert.ok(statements.every((statement) => statement.includes("CURRENT_TIMESTAMP") && statement.includes("leaseGeneration")));
});

void test("stale lease renewal fails without touching the case row", async () => {
  let queryCount = 0;
  const tx = { $queryRaw: () => { queryCount += 1; return Promise.resolve([]); } };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const lease: EvaluationWorkLease = {
    workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6",
    runId: scope.runId,
    caseExecutionId: scope.caseExecutionId,
    attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7",
    workerId: "worker-1",
    generation: 4,
    attemptOrdinal: 2,
    leaseUntil: new Date("2026-10-13T09:59:00.000Z")
  };
  await assert.rejects(new EvaluationWorkQueue(db as never).renew(lease, 15_000), ConflictException);
  assert.equal(queryCount, 1);
});

void test("admission evidence attaches to an attempt only under its live worker generation", async () => {
  let statement = "";
  const db = { $queryRaw: (query: { sql: string }) => { statement = query.sql; return Promise.resolve([{ id: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7" }]); } };
  const lease: EvaluationWorkLease = {
    workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6",
    runId: scope.runId,
    caseExecutionId: scope.caseExecutionId,
    attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7",
    workerId: "worker-1",
    generation: 4,
    attemptOrdinal: 2,
    leaseUntil: new Date("2026-10-13T09:59:00.000Z")
  };
  await new EvaluationWorkQueue(db as never).recordAdmission(lease, "c8b49b66-a9a9-4edf-b955-ef5084ea46a8");
  assert.match(statement, /UPDATE "OicEvaluationAttempt"/);
  assert.match(statement, /leaseGeneration/);
  assert.match(statement, /leaseUntil.*CURRENT_TIMESTAMP/s);
});

void test("worker lifecycle diagnostics accept only bounded stage codes and persist provider boundary timestamps", async () => {
  let statement = "";
  let affected = 1;
  const db = { $executeRaw: (query: { sql: string }) => { statement = query.sql; return Promise.resolve(affected); } };
  const queue = new EvaluationWorkQueue(db as never);
  const lease: EvaluationWorkLease = { workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6", runId: scope.runId, caseExecutionId: scope.caseExecutionId, attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7", workerId: "worker-1", generation: 4, attemptOrdinal: 2, leaseUntil: new Date("2026-10-13T09:59:00.000Z") };
  const providerAttemptId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a8";
  await queue.recordLifecycle(lease, "PROVIDER_DISPATCH_STARTED", providerAttemptId);
  assert.ok(statement.includes('"lastDurableStage" = ?'));
  assert.ok(statement.includes('"lifecycleStage" = ?'));
  assert.match(statement, /"providerAttemptId" = COALESCE/);
  assert.match(statement, /"providerDispatchStartedAt" = CASE/);
  await assert.rejects(queue.recordLifecycle(lease, "NOT_A_STAGE;secret=abc"), ConflictException);
  await assert.rejects(queue.recordLifecycle(lease, "PROVIDER_ATTEMPT_CREATED", "Bearer secret"), ConflictException);
  affected = 0;
  await assert.rejects(queue.recordLifecycle(lease, "PREFLIGHT"), ConflictException);
});

void test("stale worker cannot finalize a provider result after its lease fence is lost", async () => {
  let statements = 0;
  const tx = { $queryRaw: () => { statements += 1; return Promise.resolve([]); } };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const lease: EvaluationWorkLease = {
    workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a6",
    runId: scope.runId,
    caseExecutionId: scope.caseExecutionId,
    attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a7",
    workerId: "stale-worker",
    generation: 8,
    attemptOrdinal: 2,
    leaseUntil: new Date("2026-10-13T09:59:00.000Z")
  };
  await assert.rejects(new EvaluationWorkQueue(db as never).completeTargetInvocation(lease, {
    artifactId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a8", digest: "a".repeat(64), exposureTier: "INTERNAL"
  }, {}), /EVALUATION_WORK_LEASE_LOST/);
  assert.equal(statements, 1, "the work-generation fence rejects completion before attempt or case state changes");
});

void test("orphan lease lookup requires DB-time work and case fences", async () => {
  let statement = "";
  const db = { $queryRaw: (query: { sql: string }) => { statement = query.sql; return Promise.resolve([{ id: scope.caseExecutionId }]); } };
  const queue = new EvaluationWorkQueue(db as never);
  assert.equal(await queue.isAttemptLeaseValid("c8b49b66-a9a9-4edf-b955-ef5084ea46a7"), true);
  assert.match(statement, /attempt\."physicalKey"/);
  assert.match(statement, /work\."leaseGeneration"/);
  assert.match(statement, /CURRENT_TIMESTAMP/);
  assert.equal(await queue.isAttemptLeaseValid("../outside"), false);
});
