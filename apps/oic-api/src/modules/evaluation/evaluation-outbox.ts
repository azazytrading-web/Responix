import { ConflictException, Injectable, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OicDatabaseService, Prisma } from "@oic/database";
import { EvaluationSealedOracle } from "./sealed-oracle";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKER_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const LEASE_MS = 30_000;
const MAX_ATTEMPTS = 8;

type EventLease = {
  id: string;
  applicationId: string;
  tenantId: string | null;
  runId: string | null;
  eventType: string;
  payload: unknown;
  generation: number;
  attemptCount: number;
};

function eventPayload(value: unknown): { runId: string; caseExecutionId: string; workItemId?: string; recoveryGenerationId?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConflictException("EVALUATION_OUTBOX_PAYLOAD_INVALID");
  const payload = value as Record<string, unknown>;
  const keys = Object.keys(payload).sort().join(",");
  if (Object.keys(payload).some((key) => !["runId", "caseExecutionId", "workItemId", "recoveryGenerationId"].includes(key))
    || !["caseExecutionId,runId", "caseExecutionId,recoveryGenerationId,runId", "caseExecutionId,runId,workItemId", "caseExecutionId,recoveryGenerationId,runId,workItemId"].includes(keys)) throw new ConflictException("EVALUATION_OUTBOX_PAYLOAD_INVALID");
  if (
    typeof payload.runId !== "string" || !UUID.test(payload.runId) ||
    typeof payload.caseExecutionId !== "string" || !UUID.test(payload.caseExecutionId) ||
    (payload.workItemId !== undefined && (typeof payload.workItemId !== "string" || !UUID.test(payload.workItemId))) ||
    (payload.recoveryGenerationId !== undefined && (typeof payload.recoveryGenerationId !== "string" || !UUID.test(payload.recoveryGenerationId)))
  ) throw new ConflictException("EVALUATION_OUTBOX_PAYLOAD_INVALID");
  return payload as { runId: string; caseExecutionId: string; workItemId?: string; recoveryGenerationId?: string };
}

function regradePayload(value: unknown): { regradePassId: string; reportId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConflictException("EVALUATION_OUTBOX_PAYLOAD_INVALID");
  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).sort().join(",") !== "regradePassId,reportId" || typeof payload.regradePassId !== "string" || !UUID.test(payload.regradePassId) || typeof payload.reportId !== "string" || !UUID.test(payload.reportId)) throw new ConflictException("EVALUATION_OUTBOX_PAYLOAD_INVALID");
  return payload as { regradePassId: string; reportId: string };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedField(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length <= 128 ? value : fallback;
}

export function safeOutboxFailureCode(error: unknown): string {
  if (error instanceof ConflictException) {
    const response = error.getResponse();
    const message = typeof response === "string" ? response : record(response)?.message;
    if (typeof message === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(message)) return message;
  }
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^P[0-9]{4}$/.test(error.code)) return `PRISMA_${error.code}`;
  return "OUTBOX_DELIVERY_FAILED";
}

function metricRevisionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => typeof item === "string" ? item : record(item)?.id).filter((item): item is string => typeof item === "string" && UUID.test(item));
  if (ids.length !== value.length || new Set(ids).size !== ids.length) throw new ConflictException("EVALUATION_METRIC_REVISION_INVALID");
  return ids;
}

/** Durable internal delivery and run projection. Work claims remain authoritative in EvaluationWorkQueue. */
@Injectable()
export class EvaluationOutboxDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private stopped = false;
  private loopStarted = false;
  private lastSuccessfulPollAt: Date | null = null;
  private lastSuccessfulPollMonotonicMs: number | null = null;
  private lastFailureCode: string | null = null;

  constructor(private readonly config: ConfigService, private readonly db: OicDatabaseService, @Optional() private readonly oracle?: EvaluationSealedOracle) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || this.loopStarted) return;
    this.loopStarted = true;
    void this.poll();
  }

  onApplicationShutdown(): void { this.stopped = true; }

  readiness(now = performance.now()): { ready: boolean; reasonCode: string | null; lastSuccessfulPollAt: Date | null } {
    const fresh = this.lastSuccessfulPollMonotonicMs !== null && now - this.lastSuccessfulPollMonotonicMs <= 10_000;
    const ready = this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") === "true" && this.loopStarted && fresh && this.lastFailureCode === null && Boolean(this.oracle);
    return { ready, reasonCode: ready ? null : this.lastFailureCode ?? (!this.loopStarted ? "OUTBOX_NOT_STARTED" : !fresh ? "OUTBOX_HEARTBEAT_STALE" : !this.oracle ? "SEALED_ORACLE_UNAVAILABLE" : "OUTBOX_UNAVAILABLE"), lastSuccessfulPollAt: this.lastSuccessfulPollAt };
  }

  async processOne(workerId = `evaluation-outbox:${process.pid}`): Promise<"DISABLED" | "IDLE" | "PUBLISHED" | "RETRY"> {
    if (this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true") return "DISABLED";
    if (!WORKER_ID.test(workerId)) throw new ConflictException("EVALUATION_OUTBOX_WORKER_INVALID");
    const event = await this.claim(workerId);
    if (!event) return "IDLE";
    try {
      await this.apply(event, workerId);
      return "PUBLISHED";
    } catch (error) {
      const failureCode = safeOutboxFailureCode(error);
      const eventType = /^[A-Z][A-Z0-9_]{1,63}$/.test(event.eventType) ? event.eventType : "UNKNOWN";
      process.stderr.write(`${JSON.stringify({ event: "evaluation.outbox_delivery_failed", outboxEventId: event.id, eventType, failureCode })}\n`);
      await this.fail(event, workerId);
      return "RETRY";
    }
  }

  private async poll(): Promise<void> {
    while (!this.stopped) {
      try {
        const result = await this.processOne();
        if (result === "IDLE" || result === "PUBLISHED") { this.lastSuccessfulPollAt = new Date(); this.lastSuccessfulPollMonotonicMs = performance.now(); this.lastFailureCode = null; }
        else if (result === "RETRY") this.lastFailureCode = "OUTBOX_DELIVERY_RETRY";
        if (result === "IDLE" || result === "DISABLED") await new Promise((resolve) => setTimeout(resolve, 1_000));
      } catch {
        this.lastFailureCode = "OUTBOX_UNAVAILABLE";
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }

  private async claim(workerId: string): Promise<EventLease | null> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "OicEvaluationOutbox"
        SET "status" = 'FAILED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "lastFailureClass" = 'OUTBOX_ATTEMPTS_EXHAUSTED'
        WHERE "status" IN ('PENDING', 'LEASED') AND "attemptCount" >= ${MAX_ATTEMPTS}
          AND ("status" = 'PENDING' OR "leaseUntil" <= CURRENT_TIMESTAMP)
      `);
      const selected = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "OicEvaluationOutbox"
        WHERE "attemptCount" < ${MAX_ATTEMPTS} AND "availableAt" <= CURRENT_TIMESTAMP
          AND ("status" = 'PENDING' OR ("status" = 'LEASED' AND "leaseUntil" <= CURRENT_TIMESTAMP))
        ORDER BY "availableAt", "createdAt", "id"
        FOR UPDATE SKIP LOCKED LIMIT 1
      `);
      if (!selected[0]) return null;
      const claimed = await tx.$queryRaw<Array<{
        id: string; applicationId: string; tenantId: string | null; runId: string | null;
        eventType: string; payload: unknown; leaseGeneration: number; attemptCount: number;
      }>>(Prisma.sql`
        UPDATE "OicEvaluationOutbox"
        SET "status" = 'LEASED', "leaseOwner" = ${workerId},
            "leaseGeneration" = "leaseGeneration" + 1,
            "leaseUntil" = CURRENT_TIMESTAMP + (${LEASE_MS} * INTERVAL '1 millisecond'),
            "attemptCount" = "attemptCount" + 1
        WHERE "id" = ${selected[0].id}::uuid
        RETURNING "id", "applicationId", "tenantId", "runId", "eventType", "payload", "leaseGeneration", "attemptCount"
      `);
      const row = claimed[0];
      if (!row) throw new ConflictException("EVALUATION_OUTBOX_CLAIM_LOST");
      return { ...row, generation: row.leaseGeneration };
    });
  }

  private async apply(event: EventLease, workerId: string): Promise<void> {
    if (event.eventType === "EVALUATION_REGRADE_COMPLETED") {
      const payload = regradePayload(event.payload);
      await this.db.$transaction(async (tx) => {
        const pass = await tx.oicEvaluationRegradePass.findFirst({ where: { id: payload.regradePassId, applicationId: event.applicationId, tenantId: event.tenantId, status: "COMPLETE", report: { id: payload.reportId } }, select: { id: true, resultDigest: true } });
        if (!pass) throw new ConflictException("EVALUATION_REGRADE_OUTBOX_SCOPE_INVALID");
        const delivered = await tx.oicEvaluationOutbox.updateMany({ where: { id: event.id, applicationId: event.applicationId, tenantId: event.tenantId, runId: null, status: "LEASED", leaseOwner: workerId, leaseGeneration: event.generation, eventType: "EVALUATION_REGRADE_COMPLETED" }, data: { status: "PUBLISHED", publishedAt: new Date(), leaseOwner: null, leaseUntil: null, lastFailureClass: null } });
        if (delivered.count !== 1) throw new ConflictException("EVALUATION_OUTBOX_LEASE_LOST");
        await tx.oicAuditEvent.create({ data: { applicationId: event.applicationId, tenantId: event.tenantId, action: "evaluation.regrade.outbox.published", targetType: "evaluation-regrade-pass", targetId: pass.id, metadata: { reportId: payload.reportId, resultDigest: pass.resultDigest } } });
      });
      return;
    }
    const payload = eventPayload(event.payload);
    if (!event.runId || event.runId !== payload.runId) throw new ConflictException("EVALUATION_OUTBOX_SCOPE_INVALID");
    if (event.eventType === "EVALUATION_CASE_EXECUTED" && !this.oracle) throw new ConflictException("EVALUATION_ORACLE_UNAVAILABLE");
    await this.db.$transaction(async (tx) => {
      const run = await tx.oicEvaluationRun.findFirst({
        where: { id: payload.runId, applicationId: event.applicationId, tenantId: event.tenantId },
        select: { id: true, applicationId: true, tenantId: true, status: true, plannedDenominator: true, campaignId: true, budgetReservationOiu: true, budgetReleasedOiu: true, manifest: { select: { payload: true } } }
      });
      if (!run) throw new ConflictException("EVALUATION_OUTBOX_SCOPE_INVALID");
      const execution = await tx.oicEvaluationCaseExecution.findFirst({
        where: { id: payload.caseExecutionId, runId: run.id }, select: { id: true, status: true, outcome: true, unusedReservationReleasedOiu: true }
      });
      if (!execution) throw new ConflictException("EVALUATION_OUTBOX_SCOPE_INVALID");
      const oracleResult = event.eventType === "EVALUATION_CASE_EXECUTED" ? await this.oracle!.verifyCaseExecution(execution.id) : null;
      if (event.eventType === "EVALUATION_CASE_ENQUEUED") {
        if (!payload.workItemId) throw new ConflictException("EVALUATION_OUTBOX_PAYLOAD_INVALID");
        const work = await tx.oicEvaluationWorkItem.findFirst({ where: { id: payload.workItemId, runId: run.id, caseExecutionId: execution.id }, select: { id: true } });
        if (!work) throw new ConflictException("EVALUATION_OUTBOX_WORK_MISSING");
      } else if (["EVALUATION_CASE_EXECUTED", "EVALUATION_CASE_FAILED", "EVALUATION_CASE_CANCELLED", "EVALUATION_CASE_INCONCLUSIVE"].includes(event.eventType)) {
        const expected = event.eventType === "EVALUATION_CASE_EXECUTED" ? "EXECUTED" : event.eventType === "EVALUATION_CASE_FAILED" ? "FAILED" : event.eventType === "EVALUATION_CASE_INCONCLUSIVE" ? "INCONCLUSIVE" : "CANCELLED";
        if (execution.status !== expected && !(event.eventType === "EVALUATION_CASE_FAILED" && ["BUDGET_BLOCKED", "INVALID_ENVIRONMENT"].includes(execution.status))) throw new ConflictException("EVALUATION_OUTBOX_CASE_STATE_INVALID");
        if (oracleResult) {
          const outcome = execution.outcome && typeof execution.outcome === "object" && !Array.isArray(execution.outcome) ? execution.outcome as Record<string, unknown> : null;
          if (!outcome || (outcome.oracle && JSON.stringify(outcome.oracle) !== JSON.stringify(oracleResult))) throw new ConflictException("EVALUATION_ORACLE_OUTCOME_CONFLICT");
          if (!outcome.oracle) {
            const scored = await tx.oicEvaluationCaseExecution.updateMany({ where: { id: execution.id, runId: run.id, status: "EXECUTED" }, data: { outcome: { ...outcome, oracle: oracleResult } } });
            if (scored.count !== 1) throw new ConflictException("EVALUATION_ORACLE_OUTCOME_CONFLICT");
          }
          await this.projectObjectiveMeasurements(tx, run, execution, oracleResult);
        }
        // A terminal logical case cannot use its remaining physical retry slots.
        // Keep every created attempt's upper bound held until authoritative OIC-6
        // settlement is reconciled; never infer actual consumption from this release.
        if (run.campaignId && run.budgetReservationOiu) {
          const work = await tx.oicEvaluationWorkItem.findFirst({ where: { runId: run.id, caseExecutionId: execution.id }, select: { attemptCount: true, maxAttempts: true } });
          const campaign = await tx.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: event.applicationId, tenantId: event.tenantId }, select: { reservationPerAttemptOiu: true } });
          if (!work || !campaign?.reservationPerAttemptOiu || work.attemptCount > work.maxAttempts) throw new ConflictException("EVALUATION_BUDGET_RELEASE_STATE_INVALID");
          const unused = work.maxAttempts - work.attemptCount;
          const targetRelease = campaign.reservationPerAttemptOiu.mul(unused);
          const amount = targetRelease.minus(execution.unusedReservationReleasedOiu);
          if (amount.isNegative()) throw new ConflictException("EVALUATION_BUDGET_RELEASE_STATE_INVALID");
          if (amount.gt(0)) {
            const marked = await tx.oicEvaluationCaseExecution.updateMany({ where: { id: execution.id, runId: run.id, status: execution.status, unusedReservationReleasedOiu: execution.unusedReservationReleasedOiu }, data: { unusedReservationReleasedOiu: targetRelease } });
            if (marked.count !== 1) throw new ConflictException("EVALUATION_BUDGET_RELEASE_CONFLICT");
            const reduced = await tx.oicEvaluationCampaign.updateMany({ where: { id: run.campaignId, reservedOiu: { gte: amount } }, data: { reservedOiu: { decrement: amount } } });
            const credited = await tx.oicEvaluationRun.updateMany({ where: { id: run.id }, data: { budgetReleasedOiu: { increment: amount } } });
            if (reduced.count !== 1 || credited.count !== 1) throw new ConflictException("EVALUATION_BUDGET_RELEASE_CONFLICT");
            await tx.oicAuditEvent.create({ data: { applicationId: event.applicationId, tenantId: event.tenantId, action: "evaluation.budget.unused_retry_slots_released", targetType: "evaluation-case", targetId: execution.id, metadata: { runId: run.id, unusedPhysicalAttempts: unused, releasedOiu: amount.toString(), accountingAuthority: "OIC6" } } });
          }
        }
        const total = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id } });
        const executed = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id, status: "EXECUTED" } });
        const failed = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id, status: "FAILED" } });
        const invalidEnvironment = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id, status: "INVALID_ENVIRONMENT" } });
        const budgetBlocked = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id, status: "BUDGET_BLOCKED" } });
        const inconclusive = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id, status: "INCONCLUSIVE" } });
        const cancelled = await tx.oicEvaluationCaseExecution.count({ where: { runId: run.id, status: "CANCELLED" } });
        if (total !== run.plannedDenominator) throw new ConflictException("EVALUATION_RUN_PLAN_MISMATCH");
        if (executed + failed + invalidEnvironment + budgetBlocked + inconclusive + cancelled === total) {
          await tx.oicEvaluationRun.updateMany({
            where: { id: run.id, status: { in: ["QUEUED", "RUNNING", "CANCEL_PENDING"] } },
            data: { status: run.status === "CANCEL_PENDING" ? "CANCELLED" : budgetBlocked === total ? "BUDGET_BLOCKED" : inconclusive === total ? "INCONCLUSIVE" : invalidEnvironment === total ? "INVALID_ENVIRONMENT" : failed === 0 && invalidEnvironment === 0 && budgetBlocked === 0 && inconclusive === 0 && cancelled === 0 ? "EXECUTED" : executed === 0 && budgetBlocked === 0 && inconclusive === 0 ? "FAILED" : "PARTIAL", completedAt: new Date() }
          });
        }
      } else {
        throw new ConflictException("EVALUATION_OUTBOX_EVENT_UNSUPPORTED");
      }
      const acknowledged = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationOutbox"
        SET "status" = 'PUBLISHED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "publishedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${event.id}::uuid AND "status" = 'LEASED'
          AND "leaseOwner" = ${workerId} AND "leaseGeneration" = ${event.generation}
          AND "leaseUntil" > CURRENT_TIMESTAMP
        RETURNING "id"
      `);
      if (acknowledged.length !== 1) throw new ConflictException("EVALUATION_OUTBOX_LEASE_LOST");
    });
  }

  private async fail(event: EventLease, workerId: string): Promise<void> {
    const backoffMs = Math.min(60_000, 1_000 * 2 ** Math.min(event.attemptCount, 6));
    await this.db.$queryRaw(Prisma.sql`
      UPDATE "OicEvaluationOutbox"
      SET "status" = ${event.attemptCount >= MAX_ATTEMPTS ? "FAILED" : "PENDING"},
          "leaseOwner" = NULL, "leaseUntil" = NULL,
          "availableAt" = CURRENT_TIMESTAMP + (${backoffMs} * INTERVAL '1 millisecond'),
          "lastFailureClass" = 'OUTBOX_DELIVERY_FAILED'
      WHERE "id" = ${event.id}::uuid AND "status" = 'LEASED'
        AND "leaseOwner" = ${workerId} AND "leaseGeneration" = ${event.generation}
        AND "leaseUntil" > CURRENT_TIMESTAMP
    `);
  }

  private async projectObjectiveMeasurements(
    tx: Prisma.TransactionClient,
    run: { id: string; applicationId: string; tenantId: string | null; manifest: { payload: unknown } },
    execution: { id: string },
    oracle: { method: string; availability: string; success: boolean | null; evidenceDigest: string }
  ): Promise<void> {
    const protocol = record(run.manifest.payload);
    const ids = metricRevisionIds(protocol?.metricRevisions);
    if (!ids.length) return;
    const revisions = await tx.oicEvaluationMetricRevision.findMany({ where: { id: { in: ids }, applicationId: run.applicationId, tenantId: run.tenantId }, select: { id: true, metricKey: true, revision: true, definition: true } });
    if (revisions.length !== ids.length) throw new ConflictException("EVALUATION_METRIC_REVISION_INVALID");
    for (const revision of revisions) {
      const definition = record(revision.definition) ?? {};
      const supported = definition.methodRevision === oracle.method
        && definition.sourceArtifactRequirement === "SEALED_OBJECTIVE_ORACLE"
        && definition.type === "BOOLEAN"
        && oracle.availability === "MEASURED"
        && typeof oracle.success === "boolean";
      const availability = supported ? "MEASURED" : "UNSUPPORTED";
      await tx.oicEvaluationMeasurement.upsert({
        where: { caseExecutionId_metricKey_metricRevision_judgeType: { caseExecutionId: execution.id, metricKey: revision.metricKey, metricRevision: revision.revision, judgeType: "REFERENCE" } },
        create: {
          caseExecutionId: execution.id, metricKey: revision.metricKey, metricRevision: revision.revision,
          judgeType: "REFERENCE", valueType: boundedField(definition.type, "BOOLEAN"),
          ...(supported ? { value: oracle.success as Prisma.InputJsonValue } : {}),
          unit: boundedField(definition.unit, "UNKNOWN"), polarity: boundedField(definition.polarity, "TARGET_RANGE"), availability,
          evidenceDigest: supported ? oracle.evidenceDigest : null
        },
        update: {}
      });
    }
  }
}
