import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { EvaluationOutboxDispatcher, safeOutboxFailureCode } from "./evaluation-outbox";

const ids = {
  event: "c8b49b66-a9a9-4edf-b955-ef5084ea46c1",
  application: "c8b49b66-a9a9-4edf-b955-ef5084ea46c2",
  run: "c8b49b66-a9a9-4edf-b955-ef5084ea46c3",
  execution: "c8b49b66-a9a9-4edf-b955-ef5084ea46c4"
};

void test("outbox failure diagnostics retain safe codes and redact arbitrary error text", () => {
  assert.equal(safeOutboxFailureCode(new ConflictException("ORACLE_ADMISSION_UNSETTLED")), "ORACLE_ADMISSION_UNSETTLED");
  assert.equal(safeOutboxFailureCode(Object.assign(new Error("database password=secret"), { code: "P2002" })), "PRISMA_P2002");
  assert.equal(safeOutboxFailureCode(new Error("Authorization: Bearer private-token")), "OUTBOX_DELIVERY_FAILED");
});

void test("outbox remains dormant with the evaluator worker disabled", async () => {
  let touched = false;
  const db = { $transaction: () => { touched = true; throw new Error("unexpected database access"); } };
  const dispatcher = new EvaluationOutboxDispatcher({ get: () => "false" } as never, db as never);
  assert.equal(await dispatcher.processOne(), "DISABLED");
  assert.equal(touched, false);
});

void test("outbox accepts the audited recovery-generation identity on a requeued work event", async () => {
  const recoveryGenerationId = "c8b49b66-a9a9-4edf-b955-ef5084ea46c5";
  const workItemId = "c8b49b66-a9a9-4edf-b955-ef5084ea46c6";
  const event = {
    id: ids.event, applicationId: ids.application, tenantId: null, runId: ids.run,
    eventType: "EVALUATION_CASE_ENQUEUED",
    payload: { runId: ids.run, caseExecutionId: ids.execution, workItemId, recoveryGenerationId },
    leaseGeneration: 1, attemptCount: 1
  };
  const tx = {
    $executeRaw: () => Promise.resolve(0),
    $queryRaw: (query: { sql: string }) => {
      if (query.sql.includes("SELECT \"id\" FROM \"OicEvaluationOutbox\"")) return Promise.resolve([{ id: ids.event }]);
      if (query.sql.includes("RETURNING \"id\", \"applicationId\"")) return Promise.resolve([event]);
      if (query.sql.includes("publishedAt")) return Promise.resolve([{ id: ids.event }]);
      throw new Error("unexpected recovery outbox query");
    },
    oicEvaluationRun: { findFirst: () => Promise.resolve({ id: ids.run, status: "RUNNING", plannedDenominator: 1, manifest: { payload: {} } }) },
    oicEvaluationCaseExecution: { findFirst: () => Promise.resolve({ id: ids.execution, status: "RUNNING", outcome: null }) },
    oicEvaluationWorkItem: { findFirst: () => Promise.resolve({ id: workItemId }) }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const dispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, db as never);
  assert.equal(await dispatcher.processOne("outbox-recovery-test"), "PUBLISHED");
});

void test("outbox projects a terminal run and acknowledges under its lease fence", async () => {
  const statements: string[] = [];
  const projected: string[] = [];
  const scored: unknown[] = [];
  const tx = {
    $executeRaw: () => Promise.resolve(0),
    $queryRaw: (query: { sql: string }) => {
      statements.push(query.sql);
      if (query.sql.includes("SELECT \"id\" FROM \"OicEvaluationOutbox\"")) return Promise.resolve([{ id: ids.event }]);
      if (query.sql.includes("RETURNING \"id\", \"applicationId\"")) return Promise.resolve([{
        id: ids.event, applicationId: ids.application, tenantId: null, runId: ids.run,
        eventType: "EVALUATION_CASE_EXECUTED", payload: { runId: ids.run, caseExecutionId: ids.execution },
        leaseGeneration: 2, attemptCount: 1
      }]);
      if (query.sql.includes("publishedAt")) return Promise.resolve([{ id: ids.event }]);
      throw new Error("unexpected query");
    },
    oicEvaluationRun: {
      findFirst: () => Promise.resolve({ id: ids.run, status: "RUNNING", plannedDenominator: 1, manifest: { payload: { metricRevisions: [] } } }),
      updateMany: ({ data }: { data: { status: string } }) => { projected.push(data.status); return Promise.resolve({ count: 1 }); }
    },
    oicEvaluationCaseExecution: {
      findFirst: () => Promise.resolve({ id: ids.execution, status: "EXECUTED", outcome: { output: { digest: "a".repeat(64) } } }),
      updateMany: ({ data }: { data: { outcome: unknown } }) => { scored.push(data.outcome); return Promise.resolve({ count: 1 }); },
      count: ({ where }: { where: { status?: string } }) => Promise.resolve(where.status === undefined || where.status === "EXECUTED" ? 1 : 0)
    }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const oracle = { verifyCaseExecution: () => Promise.resolve({ method: "REFERENCE_EXACT_BYTES_V1", availability: "MEASURED", success: true, reason: "MATCH", evidenceDigest: "b".repeat(64), caseExecutionId: ids.execution, attemptId: ids.event }) };
  const dispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, db as never, oracle as never);
  assert.equal(await dispatcher.processOne("outbox-test"), "PUBLISHED");
  assert.deepEqual(projected, ["EXECUTED"]);
  assert.equal(scored.length, 1);
  assert.equal(JSON.stringify(scored[0]).includes("REFERENCE_EXACT_BYTES_V1"), true);
  assert.ok(statements.some((statement) => statement.includes("leaseGeneration") && statement.includes("CURRENT_TIMESTAMP") && statement.includes("publishedAt")));
});

void test("outbox creates only preregistered typed oracle measurements and preserves unsupported metrics as missing", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const tx = {
    $executeRaw: () => Promise.resolve(0),
    $queryRaw: (query: { sql: string }) => {
      if (query.sql.includes("SELECT \"id\" FROM \"OicEvaluationOutbox\"")) return Promise.resolve([{ id: ids.event }]);
      if (query.sql.includes("RETURNING \"id\", \"applicationId\"")) return Promise.resolve([{ id: ids.event, applicationId: ids.application, tenantId: null, runId: ids.run, eventType: "EVALUATION_CASE_EXECUTED", payload: { runId: ids.run, caseExecutionId: ids.execution }, leaseGeneration: 1, attemptCount: 1 }]);
      if (query.sql.includes("publishedAt")) return Promise.resolve([{ id: ids.event }]);
      throw new Error("unexpected query");
    },
    oicEvaluationRun: { findFirst: () => Promise.resolve({ id: ids.run, status: "RUNNING", plannedDenominator: 1, manifest: { payload: { metricRevisions: ["c8b49b66-a9a9-4edf-b955-ef5084ea46c5", "c8b49b66-a9a9-4edf-b955-ef5084ea46c6"] } } }), updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationCaseExecution: { findFirst: () => Promise.resolve({ id: ids.execution, status: "EXECUTED", outcome: { output: { digest: "a".repeat(64) } } }), updateMany: () => Promise.resolve({ count: 1 }), count: () => Promise.resolve(1) },
    oicEvaluationMetricRevision: { findMany: () => Promise.resolve([
      { id: "c8b49b66-a9a9-4edf-b955-ef5084ea46c5", metricKey: "oracle.match", revision: 1, definition: { methodRevision: "REFERENCE_EXACT_BYTES_V1", sourceArtifactRequirement: "SEALED_OBJECTIVE_ORACLE", type: "BOOLEAN", unit: "RATIO", polarity: "HIGH_IS_GOOD" } },
      { id: "c8b49b66-a9a9-4edf-b955-ef5084ea46c6", metricKey: "custom.quality", revision: 1, definition: { methodRevision: "UNCONFIGURED_METHOD", sourceArtifactRequirement: "SEALED_OBJECTIVE_ORACLE", type: "DECIMAL", unit: "SCORE", polarity: "HIGH_IS_GOOD" } }
    ]) },
    oicEvaluationMeasurement: { upsert: ({ create }: { create: Record<string, unknown> }) => { writes.push(create); return Promise.resolve(create); } }
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const oracle = { verifyCaseExecution: () => Promise.resolve({ method: "REFERENCE_EXACT_BYTES_V1", availability: "MEASURED", success: true, reason: "MATCH", evidenceDigest: "b".repeat(64), caseExecutionId: ids.execution, attemptId: ids.event }) };
  const dispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, db as never, oracle as never);
  assert.equal(await dispatcher.processOne("outbox-metric-projection"), "PUBLISHED");
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map((row) => ({ availability: row.availability, value: row.value ?? null, unit: row.unit })), [
    { availability: "MEASURED", value: true, unit: "RATIO" },
    { availability: "UNSUPPORTED", value: null, unit: "SCORE" }
  ]);
});

void test("oracle failure leaves case evidence intact and returns the leased event to bounded retry", async () => {
  let failureUpdate = "";
  let acknowledged = false;
  const event = {
    id: ids.event, applicationId: ids.application, tenantId: null, runId: ids.run,
    eventType: "EVALUATION_CASE_EXECUTED", payload: { runId: ids.run, caseExecutionId: ids.execution },
    leaseGeneration: 3, attemptCount: 2
  };
  const tx = {
    $executeRaw: () => Promise.resolve(0),
    $queryRaw: (query: { sql: string }) => {
      if (query.sql.includes("SELECT \"id\" FROM \"OicEvaluationOutbox\"")) return Promise.resolve([{ id: ids.event }]);
      if (query.sql.includes("RETURNING \"id\", \"applicationId\"")) return Promise.resolve([event]);
      if (query.sql.includes("publishedAt")) { acknowledged = true; return Promise.resolve([{ id: ids.event }]); }
      throw new Error("unexpected transaction query");
    },
    oicEvaluationRun: { findFirst: () => Promise.resolve({ id: ids.run, status: "RUNNING", plannedDenominator: 1, manifest: { payload: { metricRevisions: [] } } }) },
    oicEvaluationCaseExecution: { findFirst: () => Promise.resolve({ id: ids.execution, status: "EXECUTED", outcome: { output: { digest: "a".repeat(64) } } }) }
  };
  const db = {
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    $queryRaw: (query: { sql: string }) => { failureUpdate = query.sql; return Promise.resolve([]); }
  };
  const oracle = { verifyCaseExecution: () => Promise.reject(new Error("synthetic verifier outage")) };
  const dispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, db as never, oracle as never);
  assert.equal(await dispatcher.processOne("outbox-oracle-failure"), "RETRY");
  assert.equal(acknowledged, false);
  assert.match(failureUpdate, /OUTBOX_DELIVERY_FAILED/);
  assert.match(failureUpdate, /leaseGeneration/);
});
