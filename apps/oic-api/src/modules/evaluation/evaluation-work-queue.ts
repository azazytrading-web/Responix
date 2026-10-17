import { ConflictException, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { OicDatabaseService, Prisma } from "@oic/database";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const workerIdentity = /^[A-Za-z0-9._:-]{1,128}$/;
const WORKER_ATTESTATION_LEASE_MS = 10_000;
const executionEvidenceFields = new Set(["backend", "imageDigest", "environmentDigest", "resourcePolicyRevision", "dockerEngineVersion", "architecture", "networkPolicy", "status", "exitCode", "signal", "resourceLimit", "outputTruncated", "durationMs", "stderrDigest", "candidateArtifactId", "candidateDigest"]);
const invalidEnvironmentFailures = new Set([
  "RUN_PROTOCOL_INVALID", "TARGET_CLASS_UNSUPPORTED", "PROTOCOL_DIGEST_INVALID", "TARGET_FINGERPRINT_INVALID",
  "PROTOCOL_POLICY_INVALID", "CAMPAIGN_HARD_BUDGET_INVALID", "PROTOCOL_RELEASE_MISMATCH", "PROTOCOL_ENVIRONMENT_MISMATCH",
  "TARGET_PROTOCOL_MISMATCH", "ENVIRONMENT_ADAPTER_UNAVAILABLE", "REQUIRED_CAPABILITY_UNSUPPORTED",
  "SANDBOX_POLICY_UNAVAILABLE", "SANDBOX_ENVIRONMENT_CHANGED", "PROTOCOL_BUDGET_INVALID",
  "PROTOCOL_BUDGET_EXCEEDS_RUNTIME_POLICY", "CASE_EXECUTION_SCOPE_INVALID", "CASE_PLAN_MISMATCH",
  "CASE_REVISION_UNAVAILABLE", "CASE_RELEASE_MISMATCH", "INPUT_ARTIFACT_REFERENCE_INVALID",
  "INPUT_ARTIFACT_DIGEST_MISMATCH", "INPUT_ARTIFACT_ENCODING_UNSUPPORTED", "RUNTIME_PRINCIPAL_UNAVAILABLE",
  "RUNTIME_TENANT_GRANT_REQUIRED", "TARGET_RESOLUTION_MISMATCH", "AUTHORIZATION_DENIED", "TENANT_NOT_ALLOWED",
  "MODEL_NOT_AVAILABLE", "CAPABILITY_NOT_SUPPORTED", "MODEL_RESOLUTION_FAILURE", "NOT_ENTITLED"
]);

export type EvaluationWorkLease = {
  workItemId: string;
  runId: string;
  caseExecutionId: string;
  attemptId: string;
  workerId: string;
  generation: number;
  attemptOrdinal: number;
  leaseUntil: Date;
  executionMode?: "STANDARD" | "DIAGNOSTIC";
  diagnosticProbeId?: string | null;
};

export type EvaluationWorkerReadiness = {
  state: "ABSENT" | "STARTING" | "READY" | "DEGRADED" | "DRAINING" | "STALE";
  fresh: boolean;
  instanceId: string | null;
  generation: number | null;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  heartbeatAgeMs: number | null;
  reasonCode: string | null;
  capabilities: Record<string, unknown> | null;
  activeExecutionSlots: number;
  configuredConcurrency: 1;
  availableExecutionSlots: 0 | 1;
};

export type EvaluationFailureDiagnostic = {
  stage: string;
  code: string;
  type: string;
  message: string;
  fingerprint: string;
  component?: string;
  stackFrame?: string | null;
  details?: Record<string, unknown>;
};

export function evaluationAttemptBudgetRelease(input: { bound: Prisma.Decimal; consumed: Prisma.Decimal; admissionExists: boolean; recoveryGenerationId: string | null }): Prisma.Decimal {
  if (!input.admissionExists && input.recoveryGenerationId) return new Prisma.Decimal(0);
  return input.bound.minus(input.consumed);
}

/** Keep a stale/corrupt projection from aborting the entire reconciliation sweep. */
export function evaluationBudgetReleaseFitsProjection(input: { amount: Prisma.Decimal; campaignReserved: Prisma.Decimal; runReserved: Prisma.Decimal | null; runReleased: Prisma.Decimal; extensionFunded: boolean }): boolean {
  if (input.amount.lte(0) || input.extensionFunded) return true;
  if (input.campaignReserved.lt(input.amount)) return false;
  if (!input.runReserved || input.runReleased.plus(input.amount).gt(input.runReserved)) return false;
  return true;
}

function validateLeaseRequest(workerId: string, leaseMs: number): void {
  if (!workerIdentity.test(workerId) || !Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 300_000) throw new ConflictException("WORKER_LEASE_POLICY_INVALID");
}

export function packet76RecoveryLeaseRetryable(input: {
  generationStatus: string;
  usedPhysicalAttempts: number;
  maxPhysicalAttempts: number;
  attemptStatus: string;
  providerAttemptId: string | null;
  providerDispatchStarted: boolean;
  admissionStatus: string | null;
  providerAttemptCount: number;
}): boolean {
  return input.generationStatus === "ACTIVE" && input.maxPhysicalAttempts === 3
    && Number.isInteger(input.usedPhysicalAttempts) && input.usedPhysicalAttempts >= 1 && input.usedPhysicalAttempts <= 3
    && ["CREATED", "RUNNING", "DISPATCHED"].includes(input.attemptStatus) && input.providerAttemptId === null && !input.providerDispatchStarted
    && input.providerAttemptCount === 0 && (input.admissionStatus === null || input.admissionStatus === "RELEASED")
    && input.usedPhysicalAttempts < input.maxPhysicalAttempts;
}

function sanitizeWorkerCapabilities(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of ["database", "durableQueue", "claimFencing", "claimLoopAlive", "legacyWriteDisabled", "artifactEvidence", "artifactFinalization", "sealedOracle", "admission", "outboxFinalization", "textGeneration"] as const) {
    if (typeof source[field] === "boolean") result[field] = source[field];
  }
  if (source.compatibilityIdentity === "oic-evaluation-worker-readiness-v1") result.compatibilityIdentity = source.compatibilityIdentity;
  if (source.artifactWriteKeyVersion === 2) result.artifactWriteKeyVersion = 2;
  if (Array.isArray(source.supportedTargetClasses)) result.supportedTargetClasses = source.supportedTargetClasses.filter((item) => item === "MODEL_WITH_OIC_RUNTIME").slice(0, 1);
  if (source.sandbox === "NOT_REQUIRED_FOR_TEXT" || source.sandbox === "INDEPENDENTLY_CONFIGURED") result.sandbox = source.sandbox;
  if (typeof source.heartbeatIntervalMs === "number" && Number.isInteger(source.heartbeatIntervalMs) && source.heartbeatIntervalMs >= 1_000 && source.heartbeatIntervalMs <= 10_000) result.heartbeatIntervalMs = source.heartbeatIntervalMs;
  return result;
}

@Injectable()
export class EvaluationWorkQueue {
  constructor(private readonly db: OicDatabaseService, @Optional() private readonly config?: ConfigService) {}

  /** Acquire the one durable evaluator slot using PostgreSQL time and the scheduler's existing lock. */
  async acquireWorkerSlot(workerId: string): Promise<number | null> {
    if (!workerIdentity.test(workerId)) throw new ConflictException("EVALUATION_WORKER_IDENTITY_INVALID");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(730072::bigint)`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "OicEvaluationSchedulerCursor" ("id", "lastScopeKey") VALUES ('EVALUATION', NULL) ON CONFLICT ("id") DO NOTHING`);
      const current = await tx.$queryRaw<Array<{ workerInstanceId: string | null; workerGeneration: number; workerLeaseUntil: Date | null; databaseNow: Date }>>(Prisma.sql`
        SELECT "workerInstanceId", "workerGeneration", "workerLeaseUntil", clock_timestamp() AS "databaseNow"
        FROM "OicEvaluationSchedulerCursor" WHERE "id" = 'EVALUATION' FOR UPDATE
      `);
      const row = current[0];
      if (!row) throw new ConflictException("EVALUATION_SCHEDULER_CURSOR_UNAVAILABLE");
      const leaseActive = row.workerLeaseUntil !== null && row.workerLeaseUntil > row.databaseNow;
      if (leaseActive && row.workerInstanceId !== workerId) return null;
      const generation = row.workerInstanceId === workerId && leaseActive ? row.workerGeneration : row.workerGeneration + 1;
      const updated = await tx.$queryRaw<Array<{ workerGeneration: number }>>(Prisma.sql`
        UPDATE "OicEvaluationSchedulerCursor"
        SET "workerInstanceId" = ${workerId}, "workerGeneration" = ${generation},
            "workerState" = 'STARTING', "workerReasonCode" = NULL,
            "workerStartedAt" = CASE WHEN "workerInstanceId" = ${workerId} AND "workerLeaseUntil" > clock_timestamp() THEN "workerStartedAt" ELSE clock_timestamp() END,
            "workerHeartbeatAt" = clock_timestamp(),
            "workerLeaseUntil" = clock_timestamp() + (${WORKER_ATTESTATION_LEASE_MS} * INTERVAL '1 millisecond'),
            "workerCapabilities" = NULL, "updatedAt" = clock_timestamp()
        WHERE "id" = 'EVALUATION' RETURNING "workerGeneration"
      `);
      return updated[0]?.workerGeneration ?? null;
    });
  }

  /** Prove the queue, fencing lock, outbox tables and one-slot view are usable without creating work. */
  async heartbeatWorker(workerId: string, generation: number, capabilities: Record<string, unknown>): Promise<boolean> {
    if (!workerIdentity.test(workerId) || !Number.isInteger(generation) || generation < 1) throw new ConflictException("EVALUATION_WORKER_IDENTITY_INVALID");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(730072::bigint)`);
      const owner = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "OicEvaluationSchedulerCursor"
        WHERE "id" = 'EVALUATION' AND "workerInstanceId" = ${workerId}
          AND "workerGeneration" = ${generation} AND "workerLeaseUntil" > clock_timestamp()
        FOR UPDATE
      `);
      if (!owner.length) return false;
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OicEvaluationWorkItem" WHERE false`);
      await tx.$executeRaw(Prisma.sql`UPDATE "OicEvaluationWorkItem" SET "updatedAt" = "updatedAt" WHERE false`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OicEvaluationOutbox" WHERE false`);
      await tx.$executeRaw(Prisma.sql`UPDATE "OicEvaluationOutbox" SET "status" = "status" WHERE false`);
      const slots = await tx.$queryRaw<Array<{ active: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS "active" FROM "OicEvaluationWorkItem"
        WHERE "status" = 'LEASED' AND "leaseUntil" > clock_timestamp()
      `);
      const safeCapabilities = { ...capabilities, activeExecutionSlots: Number(slots[0]?.active ?? 0), configuredConcurrency: 1 };
      const changed = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationSchedulerCursor"
        SET "workerState" = 'READY', "workerReasonCode" = NULL,
            "workerHeartbeatAt" = clock_timestamp(),
            "workerLeaseUntil" = clock_timestamp() + (${WORKER_ATTESTATION_LEASE_MS} * INTERVAL '1 millisecond'),
            "workerCapabilities" = ${JSON.stringify(safeCapabilities)}::jsonb,
            "updatedAt" = clock_timestamp()
        WHERE "id" = 'EVALUATION' AND "workerInstanceId" = ${workerId}
          AND "workerGeneration" = ${generation} AND "workerLeaseUntil" > clock_timestamp()
        RETURNING "id"
      `);
      return changed.length === 1;
    });
  }

  async degradeWorker(workerId: string, generation: number, reasonCode: string): Promise<void> {
    if (!workerIdentity.test(workerId) || !Number.isInteger(generation) || generation < 1 || !/^[A-Z0-9_]{1,48}$/.test(reasonCode)) return;
    await this.db.$executeRaw(Prisma.sql`
      UPDATE "OicEvaluationSchedulerCursor"
      SET "workerState" = 'DEGRADED', "workerReasonCode" = ${reasonCode},
          "workerHeartbeatAt" = clock_timestamp(), "workerLeaseUntil" = clock_timestamp(),
          "workerCapabilities" = NULL, "updatedAt" = clock_timestamp()
      WHERE "id" = 'EVALUATION' AND "workerInstanceId" = ${workerId} AND "workerGeneration" = ${generation}
    `);
  }

  async releaseWorkerSlot(workerId: string, generation: number): Promise<void> {
    if (!workerIdentity.test(workerId) || !Number.isInteger(generation) || generation < 1) return;
    await this.db.$executeRaw(Prisma.sql`
      UPDATE "OicEvaluationSchedulerCursor"
      SET "workerState" = 'DRAINING', "workerReasonCode" = NULL,
          "workerHeartbeatAt" = clock_timestamp(), "workerLeaseUntil" = clock_timestamp(),
          "workerCapabilities" = NULL, "updatedAt" = clock_timestamp()
      WHERE "id" = 'EVALUATION' AND "workerInstanceId" = ${workerId} AND "workerGeneration" = ${generation}
    `);
  }

  async ownsFreshWorkerSlot(workerId: string, generation: number): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
      SELECT ("workerState" = 'READY' AND "workerLeaseUntil" > clock_timestamp()) AS "ready"
      FROM "OicEvaluationSchedulerCursor"
      WHERE "id" = 'EVALUATION' AND "workerInstanceId" = ${workerId} AND "workerGeneration" = ${generation}
    `);
    return rows[0]?.ready === true;
  }

  async workerReadiness(): Promise<EvaluationWorkerReadiness> {
    const rows = await this.db.$queryRaw<Array<{
      workerInstanceId: string | null; workerGeneration: number; workerState: string | null;
      workerReasonCode: string | null; workerStartedAt: Date | null; workerHeartbeatAt: Date | null;
      workerLeaseUntil: Date | null; workerCapabilities: unknown; databaseNow: Date; activeExecutionSlots: bigint;
    }>>(Prisma.sql`
      SELECT cursor."workerInstanceId", cursor."workerGeneration", cursor."workerState", cursor."workerReasonCode",
             cursor."workerStartedAt", cursor."workerHeartbeatAt", cursor."workerLeaseUntil", cursor."workerCapabilities",
             clock_timestamp() AS "databaseNow",
             (SELECT count(*)::bigint FROM "OicEvaluationWorkItem" work
              WHERE work."status" = 'LEASED' AND work."leaseUntil" > clock_timestamp()) AS "activeExecutionSlots"
      FROM "OicEvaluationSchedulerCursor" cursor WHERE cursor."id" = 'EVALUATION'
    `);
    const row = rows[0];
    if (!row || !row.workerInstanceId || !row.workerState || !row.workerLeaseUntil) return {
      state: "ABSENT", fresh: false, instanceId: null, generation: null, startedAt: null, heartbeatAt: null,
      heartbeatAgeMs: null, reasonCode: "NO_WORKER_ATTESTATION", capabilities: null,
      activeExecutionSlots: Number(row?.activeExecutionSlots ?? 0n), configuredConcurrency: 1,
      availableExecutionSlots: row && Number(row.activeExecutionSlots) >= 1 ? 0 : 1
    };
    const fresh = row.workerLeaseUntil > row.databaseNow && row.workerHeartbeatAt !== null
      && row.databaseNow.getTime() - row.workerHeartbeatAt.getTime() <= WORKER_ATTESTATION_LEASE_MS;
    const state = !fresh && row.workerState !== "DRAINING" ? "STALE" : row.workerState;
    const capabilities = sanitizeWorkerCapabilities(row.workerCapabilities);
    return {
      state: ["STARTING", "READY", "DEGRADED", "DRAINING", "STALE"].includes(state) ? state as EvaluationWorkerReadiness["state"] : "DEGRADED",
      fresh, instanceId: row.workerInstanceId, generation: row.workerGeneration, startedAt: row.workerStartedAt,
      heartbeatAt: row.workerHeartbeatAt,
      heartbeatAgeMs: row.workerHeartbeatAt ? Math.max(0, row.databaseNow.getTime() - row.workerHeartbeatAt.getTime()) : null,
      reasonCode: row.workerReasonCode && /^[A-Z0-9_]{1,48}$/.test(row.workerReasonCode) ? row.workerReasonCode : null,
      capabilities, activeExecutionSlots: Number(row.activeExecutionSlots), configuredConcurrency: 1,
      availableExecutionSlots: Number(row.activeExecutionSlots) >= 1 ? 0 : 1
    };
  }

  /** Create the durable work row and wake-up event atomically with case/run creation. Payload contains identifiers only. */
  async enqueueCase(input: { applicationId: string; tenantId: string | null; runId: string; caseExecutionId: string; maxAttempts?: number; executionMode?: "STANDARD" | "DIAGNOSTIC"; diagnosticProbeId?: string }) {
    if (![input.applicationId, input.runId, input.caseExecutionId].every((value) => uuid.test(value)) || (input.tenantId !== null && !uuid.test(input.tenantId))) throw new ConflictException("EVALUATION_WORK_SCOPE_INVALID");
    const maxAttempts = input.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 32) throw new ConflictException("EVALUATION_WORK_RETRY_POLICY_INVALID");
    const eventKey = `${input.caseExecutionId}:enqueued`;
    try {
      return await this.db.$transaction(async (tx) => {
        const work = await tx.oicEvaluationWorkItem.create({ data: {
          applicationId: input.applicationId,
          tenantId: input.tenantId,
          runId: input.runId,
          caseExecutionId: input.caseExecutionId,
          maxAttempts,
          executionMode: input.executionMode ?? "STANDARD",
          ...(input.diagnosticProbeId ? { diagnosticProbeId: input.diagnosticProbeId } : {})
        } });
        await tx.oicEvaluationOutbox.create({ data: {
          applicationId: input.applicationId,
          tenantId: input.tenantId,
          runId: input.runId,
          eventKey,
          eventType: "EVALUATION_CASE_ENQUEUED",
          payload: { workItemId: work.id, runId: input.runId, caseExecutionId: input.caseExecutionId }
        } });
        return { id: work.id, eventKey, status: work.status };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const existing = await this.db.oicEvaluationWorkItem.findUnique({ where: { caseExecutionId: input.caseExecutionId }, select: { id: true, applicationId: true, tenantId: true, runId: true, maxAttempts: true, status: true } });
        if (existing && existing.applicationId === input.applicationId && existing.tenantId === input.tenantId && existing.runId === input.runId && existing.maxAttempts === maxAttempts) return { id: existing.id, eventKey, status: existing.status };
        throw new ConflictException("EVALUATION_WORK_IDEMPOTENCY_CONFLICT");
      }
      throw error;
    }
  }

  /** Reconcile expired leases even when no worker is claiming new work. Admission uncertainty remains terminal. */
  async reconcileExpired(): Promise<{ admissionUncertain: number; cancelled: number; exhausted: number }> {
    return this.db.$transaction((tx) => this.reconcileExpiredInTransaction(tx));
  }

  /** Release only proven unused attempt envelope after authoritative OIC-6 resolution. */
  async reconcileBudget(limit = 100, runId?: string): Promise<{ inspected: number; reconciled: number; releasedOiu: string }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ConflictException("EVALUATION_BUDGET_RECONCILE_LIMIT_INVALID");
    return this.db.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT attempt."id"
        FROM "OicEvaluationAttempt" attempt
        JOIN "OicEvaluationCaseExecution" execution ON execution."id" = attempt."caseExecutionId"
        JOIN "OicEvaluationRun" run ON run."id" = execution."runId"
        WHERE attempt."budgetReconciledAt" IS NULL
          AND attempt."status" IN ('SUCCEEDED', 'INFRA_FAILURE', 'BUDGET_BLOCKED')
          AND run."campaignId" IS NOT NULL AND run."budgetReservationOiu" IS NOT NULL
          ${runId ? Prisma.sql`AND run."id" = ${runId}::uuid` : Prisma.empty}
        ORDER BY attempt."completedAt" ASC NULLS LAST, attempt."id" ASC
        FOR UPDATE OF attempt SKIP LOCKED LIMIT ${limit}
      `);
      let reconciled = 0;
      let releasedOiu = new Prisma.Decimal(0);
      for (const candidate of candidates) {
        const attempt = await tx.oicEvaluationAttempt.findUniqueOrThrow({ where: { id: candidate.id }, include: { caseExecution: { include: { run: true } } } });
        const run = attempt.caseExecution.run;
        const campaign = run.campaignId ? await tx.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId } }) : null;
        if (!campaign || !campaign.budgetRevisionId || !run.budgetReservationOiu) continue;
        const admission = await tx.oicAdmission.findFirst({ where: {
          applicationId: run.applicationId, tenantId: run.tenantId,
          ...(attempt.admissionId ? { OR: [{ id: attempt.admissionId }, { idempotencyKey: `evaluation-attempt:${attempt.id}` }] } : { idempotencyKey: `evaluation-attempt:${attempt.id}` })
        }, select: { id: true, status: true, capacityExtensionId: true } });
        if (!admission && (attempt.admissionId || attempt.status === "SUCCEEDED")) continue;
        const extension = admission?.capacityExtensionId ? await tx.oicEvaluationCapacityExtension.findFirst({
          where: { id: admission.capacityExtensionId, applicationId: run.applicationId, tenantId: run.tenantId, runId: run.id },
          select: { id: true, budgetRevisionId: true, perAdmissionLimitOiu: true }
        }) : null;
        if (admission?.capacityExtensionId && !extension) continue;
        const reservationBudgetRevisionId = extension?.budgetRevisionId ?? campaign.budgetRevisionId;
        const bound = extension?.perAdmissionLimitOiu ?? campaign.reservationPerAttemptOiu;
        if (!bound) continue;
        let consumed = new Prisma.Decimal(0);
        if (admission) {
          if (["DENIED", "RELEASED"].includes(admission.status)) {
            if (await tx.oicProviderAttempt.count({ where: { admissionId: admission.id } })) continue;
          } else if (admission.status === "SETTLED") {
            const legs = await tx.oicReservationLeg.findMany({ where: { admissionId: admission.id, budgetRevisionId: reservationBudgetRevisionId }, select: { bucketId: true, amount: true, state: true } });
            const leg = legs[0];
            if (legs.length !== 1 || !leg || !leg.amount.equals(bound) || !["SETTLED", "RELEASED"].includes(leg.state)) continue;
            const actual = await tx.oicUsagePosting.aggregate({ where: { admissionId: admission.id, bucketId: leg.bucketId, kind: "CONSUME" }, _sum: { amount: true } });
            consumed = actual._sum.amount ?? new Prisma.Decimal(0);
          } else continue;
        }
        if (consumed.lt(0) || consumed.gt(bound)) continue;
        // Recovery generations consume physical worker attempts, not additional run-level
        // OIC-6 reservations. A pre-dispatch recovery attempt with no admission therefore
        // has nothing to release; recording a synthetic per-admission release would double
        // count the earlier run envelope and can violate the immutable run check.
        const noAdmissionRecovery = !admission && !attempt.admissionId && !!attempt.recoveryGenerationId;
        const amount = evaluationAttemptBudgetRelease({ bound, consumed, admissionExists: !!admission, recoveryGenerationId: attempt.recoveryGenerationId });
        if (!evaluationBudgetReleaseFitsProjection({ amount, campaignReserved: campaign.reservedOiu, runReserved: run.budgetReservationOiu, runReleased: run.budgetReleasedOiu, extensionFunded: !!extension })) continue;
        const marked = await tx.oicEvaluationAttempt.updateMany({ where: { id: attempt.id, budgetReconciledAt: null }, data: { budgetReconciledAt: new Date(), budgetReleasedOiu: amount } });
        if (marked.count !== 1) throw new ConflictException("EVALUATION_BUDGET_RECONCILE_CONFLICT");
        if (amount.gt(0) && !extension) {
          const campaignChanged = await tx.oicEvaluationCampaign.updateMany({ where: { id: campaign.id, reservedOiu: { gte: amount } }, data: { reservedOiu: { decrement: amount } } });
          const runChanged = await tx.oicEvaluationRun.updateMany({ where: { id: run.id }, data: { budgetReleasedOiu: { increment: amount } } });
          if (campaignChanged.count !== 1 || runChanged.count !== 1) throw new ConflictException("EVALUATION_BUDGET_RECONCILE_CONFLICT");
          releasedOiu = releasedOiu.plus(amount);
        }
        await tx.oicAuditEvent.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.budget.attempt_reconciled", targetType: "evaluation-attempt", targetId: attempt.id, metadata: { runId: run.id, admissionId: admission?.id ?? null, ...(extension ? { capacityExtensionId: extension.id } : {}), budgetRevisionId: reservationBudgetRevisionId, reservedUpperOiu: noAdmissionRecovery ? "0" : bound.toString(), actualOiu: admission?.status === "SETTLED" ? consumed.toString() : null, releasedOiu: amount.toString(), ...(noAdmissionRecovery ? { reconciliationReason: "NO_ADMISSION_NO_NEW_RESERVATION" } : {}), accountingAuthority: "OIC6" } } });
        reconciled += 1;
      }
      return { inspected: candidates.length, reconciled, releasedOiu: releasedOiu.toString() };
    });
  }

  private async reconcileExpiredInTransaction(tx: Prisma.TransactionClient): Promise<{ admissionUncertain: number; cancelled: number; exhausted: number }> {
      const admissionUncertain = await tx.$queryRaw<Array<{ id: string; caseExecutionId: string; runId: string; leaseGeneration: number; admissionId: string | null }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem" AS work
        SET "status" = 'FAILED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "lastFailureClass" = 'ADMISSION_RECONCILIATION_REQUIRED', "completedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE work."status" = 'LEASED' AND work."leaseUntil" <= CURRENT_TIMESTAMP
          AND EXISTS (
            SELECT 1
            FROM "OicEvaluationAttempt" attempt
            JOIN "OicAdmission" admission ON admission."id" = attempt."admissionId"
              OR admission."idempotencyKey" = ('evaluation-attempt:' || attempt."id"::text)
            WHERE attempt."caseExecutionId" = work."caseExecutionId"
              AND attempt."physicalKey" = ('evaluation-work:' || work."id"::text || ':' || work."leaseGeneration"::text)
              AND admission."status" IN ('ADMITTED', 'DISPATCHED', 'SHADOW', 'UNCERTAIN', 'SETTLED')
          )
        RETURNING work."id", work."caseExecutionId", work."runId", work."leaseGeneration",
          (SELECT admission."id"
           FROM "OicEvaluationAttempt" attempt
           JOIN "OicAdmission" admission ON admission."id" = attempt."admissionId"
             OR admission."idempotencyKey" = ('evaluation-attempt:' || attempt."id"::text)
           WHERE attempt."caseExecutionId" = work."caseExecutionId"
             AND attempt."physicalKey" = ('evaluation-work:' || work."id"::text || ':' || work."leaseGeneration"::text)
             AND admission."status" IN ('ADMITTED', 'DISPATCHED', 'SHADOW', 'UNCERTAIN', 'SETTLED')
           ORDER BY attempt."attemptOrdinal" DESC LIMIT 1) AS "admissionId"
      `);
      for (const item of admissionUncertain) {
        const activeAttempt = await tx.oicEvaluationAttempt.findFirst({ where: { caseExecutionId: item.caseExecutionId, physicalKey: `evaluation-work:${item.id}:${item.leaseGeneration}`, status: { in: ["CREATED", "RUNNING", "DISPATCHED"] } }, select: { lifecycleStage: true, recoveryGenerationId: true, id: true } });
        await tx.oicEvaluationAttempt.updateMany({
          where: { caseExecutionId: item.caseExecutionId, physicalKey: `evaluation-work:${item.id}:${item.leaseGeneration}`, status: { in: ["CREATED", "RUNNING", "DISPATCHED"] } },
          data: { status: "INFRA_FAILURE", failureClass: "ADMISSION_RECONCILIATION_REQUIRED", lastDurableStage: activeAttempt?.lifecycleStage ?? null, lifecycleStage: "FAILED", ...(item.admissionId ? { admissionId: item.admissionId } : {}), completedAt: new Date() }
        });
        await tx.oicEvaluationCaseExecution.updateMany({
          where: { id: item.caseExecutionId, runId: item.runId, status: "RUNNING", leaseGeneration: item.leaseGeneration },
          data: { status: "INCONCLUSIVE", leaseOwner: null, leaseUntil: null, completedAt: new Date(), outcome: { failureClass: "ADMISSION_RECONCILIATION_REQUIRED", measurementAvailability: "NO_MEASUREMENT" } }
        });
        const scope = await tx.oicEvaluationWorkItem.findUniqueOrThrow({ where: { caseExecutionId: item.caseExecutionId }, select: { applicationId: true, tenantId: true } });
        if (activeAttempt?.recoveryGenerationId) {
          const generation = await tx.oicEvaluationRecoveryGeneration.findUnique({ where: { id: activeAttempt.recoveryGenerationId }, select: { id: true, status: true, usedPhysicalAttempts: true } });
          if (generation?.status === "ACTIVE") {
            await tx.oicEvaluationRecoveryGeneration.update({ where: { id: generation.id }, data: { status: "CLOSED", closedAt: new Date() } });
            await tx.oicAuditEvent.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, action: "evaluation.packet76.recovery_generation.closed", targetType: "evaluation-recovery-generation", targetId: generation.id, metadata: { runId: item.runId, workItemId: item.id, terminalAttemptId: activeAttempt.id, usedPhysicalAttempts: generation.usedPhysicalAttempts, providerDispatchStarted: true, closure: "ADMISSION_OUTCOME_UNCERTAIN" } } });
          }
        }
        await tx.oicEvaluationOutbox.create({ data: {
          applicationId: scope.applicationId,
          tenantId: scope.tenantId,
          runId: item.runId,
          eventKey: `${item.caseExecutionId}:inconclusive:${item.leaseGeneration}`, eventType: "EVALUATION_CASE_INCONCLUSIVE",
          payload: { runId: item.runId, caseExecutionId: item.caseExecutionId }
        } });
      }
      const cancelled = await tx.$queryRaw<Array<{ id: string; caseExecutionId: string; runId: string; leaseGeneration: number }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem" AS work
        SET "status" = 'CANCELLED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "lastFailureClass" = 'WORKER_LEASE_EXPIRED', "completedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        FROM "OicEvaluationRun" AS run
        WHERE work."runId" = run."id" AND run."status" = 'CANCEL_PENDING'
          AND work."status" = 'LEASED' AND work."leaseUntil" <= CURRENT_TIMESTAMP
        RETURNING work."id", work."caseExecutionId", work."runId", work."leaseGeneration"
      `);
      for (const item of cancelled) {
        await tx.oicEvaluationAttempt.updateMany({
          where: { caseExecutionId: item.caseExecutionId, physicalKey: `evaluation-work:${item.id}:${item.leaseGeneration}`, status: { in: ["CREATED", "RUNNING", "DISPATCHED"] } },
          data: { status: "INFRA_FAILURE", failureClass: "WORKER_LEASE_EXPIRED", completedAt: new Date() }
        });
        await tx.oicEvaluationCaseExecution.updateMany({
          where: { id: item.caseExecutionId, runId: item.runId, status: "RUNNING", leaseGeneration: item.leaseGeneration },
          data: { status: "CANCELLED", leaseOwner: null, leaseUntil: null, completedAt: new Date(), outcome: { cancellation: "OWNER_REQUESTED", failureClass: "WORKER_LEASE_EXPIRED" } }
        });
        const scope = await tx.oicEvaluationWorkItem.findUniqueOrThrow({ where: { id: item.id }, select: { applicationId: true, tenantId: true } });
        await tx.oicEvaluationOutbox.create({ data: {
          applicationId: scope.applicationId, tenantId: scope.tenantId, runId: item.runId,
          eventKey: `${item.caseExecutionId}:cancelled`, eventType: "EVALUATION_CASE_CANCELLED",
          payload: { runId: item.runId, caseExecutionId: item.caseExecutionId }
        } });
      }
      const recoveryExpired = await tx.$queryRaw<Array<{ id: string; caseExecutionId: string; runId: string; leaseGeneration: number; generationId: string; usedPhysicalAttempts: number; maxPhysicalAttempts: number }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem" AS work
        SET "status" = CASE WHEN generation."usedPhysicalAttempts" >= generation."maxPhysicalAttempts" THEN 'FAILED' ELSE 'PENDING' END,
            "leaseOwner" = NULL, "leaseUntil" = NULL, "lastFailureClass" = 'WORKER_LEASE_EXPIRED',
            "completedAt" = CASE WHEN generation."usedPhysicalAttempts" >= generation."maxPhysicalAttempts" THEN CURRENT_TIMESTAMP ELSE NULL END,
            "availableAt" = CASE WHEN generation."usedPhysicalAttempts" >= generation."maxPhysicalAttempts" THEN work."availableAt" ELSE CURRENT_TIMESTAMP END,
            "updatedAt" = CURRENT_TIMESTAMP
        FROM "OicEvaluationRecoveryGeneration" AS generation, "OicEvaluationRun" AS run
        WHERE work."status" = 'LEASED' AND work."leaseUntil" <= CURRENT_TIMESTAMP
          AND work."attemptCount" >= 6 AND work."attemptCount" <= work."maxAttempts"
          AND generation."workItemId" = work."id" AND generation."status" = 'ACTIVE'
          AND run."id" = work."runId" AND run."status" <> 'CANCEL_PENDING'
          AND EXISTS (
            SELECT 1 FROM "OicEvaluationAttempt" attempt
            WHERE attempt."caseExecutionId" = work."caseExecutionId"
              AND attempt."physicalKey" = ('evaluation-work:' || work."id"::text || ':' || work."leaseGeneration"::text)
              AND attempt."status" IN ('CREATED','RUNNING','DISPATCHED')
              AND attempt."recoveryGenerationId" = generation."id"
              AND attempt."providerAttemptId" IS NULL AND attempt."providerDispatchStartedAt" IS NULL
              AND (
                (attempt."admissionId" IS NULL AND NOT EXISTS (
                  SELECT 1 FROM "OicAdmission" admission WHERE admission."idempotencyKey" = ('evaluation-attempt:' || attempt."id"::text)
                ))
                OR EXISTS (
                  SELECT 1 FROM "OicAdmission" admission
                  WHERE admission."id" = attempt."admissionId" AND admission."status" = 'RELEASED'
                    AND NOT EXISTS (SELECT 1 FROM "OicProviderAttempt" provider WHERE provider."admissionId" = admission."id")
                )
              )
          )
        RETURNING work."id", work."caseExecutionId", work."runId", work."leaseGeneration",
          generation."id" AS "generationId", generation."usedPhysicalAttempts", generation."maxPhysicalAttempts"
      `);
      for (const item of recoveryExpired) {
        const attempt = await tx.oicEvaluationAttempt.findFirst({
          where: { caseExecutionId: item.caseExecutionId, physicalKey: `evaluation-work:${item.id}:${item.leaseGeneration}`, recoveryGenerationId: item.generationId, status: { in: ["CREATED", "RUNNING", "DISPATCHED"] } },
          select: { id: true, status: true, lifecycleStage: true, admissionId: true, providerAttemptId: true, providerDispatchStartedAt: true }
        });
        if (!attempt) throw new ConflictException("PACKET76_RECOVERY_LEASE_ATTEMPT_MISSING");
        const scope = await tx.oicEvaluationWorkItem.findUniqueOrThrow({ where: { id: item.id }, select: { applicationId: true, tenantId: true } });
        const admission = await tx.oicAdmission.findFirst({ where: {
          applicationId: scope.applicationId, tenantId: scope.tenantId,
          ...(attempt.admissionId ? { OR: [{ id: attempt.admissionId }, { idempotencyKey: `evaluation-attempt:${attempt.id}` }] } : { idempotencyKey: `evaluation-attempt:${attempt.id}` })
        }, select: { id: true, status: true } });
        const providerAttemptCount = admission ? await tx.oicProviderAttempt.count({ where: { admissionId: admission.id } }) : 0;
        if (!packet76RecoveryLeaseRetryable({ generationStatus: "ACTIVE", usedPhysicalAttempts: item.usedPhysicalAttempts, maxPhysicalAttempts: item.maxPhysicalAttempts,
          attemptStatus: attempt.status, providerAttemptId: attempt.providerAttemptId, providerDispatchStarted: Boolean(attempt.providerDispatchStartedAt),
          admissionStatus: admission?.status ?? null, providerAttemptCount })) throw new ConflictException("PACKET76_RECOVERY_LEASE_NOT_SAFE_TO_RETRY");
        await tx.oicEvaluationAttempt.update({ where: { id: attempt.id }, data: { status: "INFRA_FAILURE", failureClass: "WORKER_LEASE_EXPIRED", lastDurableStage: attempt.lifecycleStage, lifecycleStage: "FAILED", ...(admission ? { admissionId: admission.id } : {}), completedAt: new Date() } });
        await tx.oicEvaluationCaseExecution.updateMany({ where: { id: item.caseExecutionId, runId: item.runId, status: "RUNNING", leaseGeneration: item.leaseGeneration }, data: {
          status: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? "FAILED" : "QUEUED", leaseOwner: null, leaseUntil: null,
          completedAt: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? new Date() : null,
          outcome: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? { failureClass: "WORKER_LEASE_EXPIRED", measurementAvailability: "NO_MEASUREMENT" } : Prisma.DbNull
        } });
        if (item.usedPhysicalAttempts >= item.maxPhysicalAttempts) {
          await tx.oicEvaluationRecoveryGeneration.update({ where: { id: item.generationId }, data: { status: "EXHAUSTED", closedAt: new Date() } });
        }
        await tx.oicAuditEvent.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId,
          action: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? "evaluation.packet76.recovery_generation.closed" : "evaluation.packet76.recovery_attempt.requeued",
          targetType: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? "evaluation-recovery-generation" : "evaluation-attempt",
          targetId: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? item.generationId : attempt.id,
          metadata: { runId: item.runId, workItemId: item.id, caseExecutionId: item.caseExecutionId, recoveryGenerationId: item.generationId,
            usedPhysicalAttempts: item.usedPhysicalAttempts, maxPhysicalAttempts: item.maxPhysicalAttempts, providerDispatchStarted: false,
            admissionId: attempt.admissionId, failureClass: "WORKER_LEASE_EXPIRED", ...(item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? { closure: "THREE_PRE_DISPATCH_ATTEMPTS_EXHAUSTED" } : { nextRecoveryOrdinal: item.usedPhysicalAttempts + 1 }) } } });
        await tx.oicEvaluationOutbox.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, runId: item.runId,
          eventKey: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? `${item.caseExecutionId}:failed:${item.leaseGeneration}` : `${item.caseExecutionId}:recovery-lease-requeue:${attempt.id}`,
          eventType: item.usedPhysicalAttempts >= item.maxPhysicalAttempts ? "EVALUATION_CASE_FAILED" : "EVALUATION_CASE_ENQUEUED",
          payload: { runId: item.runId, caseExecutionId: item.caseExecutionId, workItemId: item.id, recoveryGenerationId: item.generationId } } });
      }
      const exhausted = await tx.$queryRaw<Array<{ id: string; caseExecutionId: string; runId: string; leaseGeneration: number }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem"
        SET "status" = 'FAILED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "lastFailureClass" = 'WORKER_LEASE_EXPIRED', "completedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "status" = 'LEASED' AND "leaseUntil" <= CURRENT_TIMESTAMP
          AND "attemptCount" >= "maxAttempts"
        RETURNING "id", "caseExecutionId", "runId", "leaseGeneration"
      `);
      for (const item of exhausted) {
        const activeAttempt = await tx.oicEvaluationAttempt.findFirst({ where: { caseExecutionId: item.caseExecutionId, physicalKey: `evaluation-work:${item.id}:${item.leaseGeneration}`, status: { in: ["CREATED", "RUNNING", "DISPATCHED"] } }, select: { lifecycleStage: true, recoveryGenerationId: true, id: true } });
        await tx.oicEvaluationAttempt.updateMany({
          where: { caseExecutionId: item.caseExecutionId, physicalKey: `evaluation-work:${item.id}:${item.leaseGeneration}`, status: { in: ["CREATED", "RUNNING", "DISPATCHED"] } },
          data: { status: "INFRA_FAILURE", failureClass: "WORKER_LEASE_EXPIRED", lastDurableStage: activeAttempt?.lifecycleStage ?? null, lifecycleStage: "FAILED", completedAt: new Date() }
        });
        await tx.oicEvaluationCaseExecution.updateMany({
          where: { id: item.caseExecutionId, runId: item.runId, status: "RUNNING", leaseGeneration: item.leaseGeneration },
          data: { status: "FAILED", leaseOwner: null, leaseUntil: null, completedAt: new Date(), outcome: { failureClass: "WORKER_LEASE_EXPIRED" } }
        });
        const scope = await tx.oicEvaluationWorkItem.findUniqueOrThrow({ where: { caseExecutionId: item.caseExecutionId }, select: { applicationId: true, tenantId: true } });
        if (activeAttempt?.recoveryGenerationId) {
          const generation = await tx.oicEvaluationRecoveryGeneration.findUnique({ where: { id: activeAttempt.recoveryGenerationId }, select: { id: true, status: true, usedPhysicalAttempts: true, maxPhysicalAttempts: true } });
          if (generation?.status === "ACTIVE") {
            const generationStatus = generation.usedPhysicalAttempts >= generation.maxPhysicalAttempts ? "EXHAUSTED" : "CLOSED";
            await tx.oicEvaluationRecoveryGeneration.update({ where: { id: generation.id }, data: { status: generationStatus, closedAt: new Date() } });
            await tx.oicAuditEvent.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, action: "evaluation.packet76.recovery_generation.closed", targetType: "evaluation-recovery-generation", targetId: generation.id, metadata: { runId: item.runId, workItemId: item.id, terminalAttemptId: activeAttempt.id, usedPhysicalAttempts: generation.usedPhysicalAttempts, providerDispatchStarted: false, closure: generationStatus === "EXHAUSTED" ? "THREE_PRE_DISPATCH_ATTEMPTS_EXHAUSTED" : "LEASE_TERMINAL" } } });
          }
        }
        await tx.oicEvaluationOutbox.create({ data: {
          applicationId: scope.applicationId, tenantId: scope.tenantId, runId: item.runId,
          eventKey: `${item.caseExecutionId}:failed:${item.leaseGeneration}`, eventType: "EVALUATION_CASE_FAILED",
          payload: { runId: item.runId, caseExecutionId: item.caseExecutionId }
        } });
      }
    return { admissionUncertain: admissionUncertain.length, cancelled: cancelled.length, exhausted: exhausted.length };
  }

  /** A PostgreSQL row lock plus generation fence permits one claimant across API/worker replicas. */
  async claimNext(workerId: string, leaseMs: number): Promise<EvaluationWorkLease | null> {
    validateLeaseRequest(workerId, leaseMs);
    const providerMinIntervalMs = this.config?.get<number>("OIC_EVALUATOR_PROVIDER_MIN_INTERVAL_MS") ?? 1_000;
    if (!Number.isInteger(providerMinIntervalMs) || providerMinIntervalMs < 100 || providerMinIntervalMs > 60_000) throw new ConflictException("EVALUATION_PROVIDER_RATE_POLICY_INVALID");
    return this.db.$transaction(async (tx) => {
      await this.reconcileExpiredInTransaction(tx);
      // Serialize queue selection across API replicas and keep one bounded active execution.
      await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(730072::bigint)`);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "OicEvaluationSchedulerCursor" ("id", "lastScopeKey")
        VALUES ('EVALUATION', NULL) ON CONFLICT ("id") DO NOTHING
      `);
      const cursorRows = await tx.$queryRaw<Array<{ lastScopeKey: string | null }>>(Prisma.sql`
        SELECT "lastScopeKey" FROM "OicEvaluationSchedulerCursor"
        WHERE "id" = 'EVALUATION' FOR UPDATE
      `);
      if (!cursorRows[0]) throw new ConflictException("EVALUATION_SCHEDULER_CURSOR_UNAVAILABLE");
      const selected = await tx.$queryRaw<Array<{ id: string; scopeKey: string; providerConnectionId: string | null }>>(Prisma.sql`
        WITH eligible AS (
          SELECT work."id",
                 work."applicationId"::text || ':' || COALESCE(work."tenantId"::text, '~') AS "scopeKey",
                 run."targetIdentity" #>> '{resolvedTarget,providerConnectionId}' AS "providerConnectionId",
                 ROW_NUMBER() OVER (
                   PARTITION BY work."applicationId", work."tenantId"
                   ORDER BY work."priority" DESC, work."availableAt" ASC, work."createdAt" ASC, work."id" ASC
                 ) AS "scopeRank"
          FROM "OicEvaluationWorkItem" work
          JOIN "OicEvaluationRun" run ON run."id" = work."runId"
          JOIN "OicEvaluationProtocolManifest" manifest ON manifest."id" = run."manifestId"
          JOIN "OicEvaluationRelease" release ON release."id" = manifest."releaseId"
          LEFT JOIN "OicEvaluationEnvironmentRevision" environment ON environment."id" = release."environmentId"
          WHERE run."status" IN ('QUEUED', 'RUNNING')
            AND work."attemptCount" < work."maxAttempts"
            AND work."availableAt" <= clock_timestamp()
            AND (work."status" = 'PENDING' OR (work."status" = 'LEASED' AND work."leaseUntil" <= clock_timestamp()))
            AND NOT EXISTS (
              SELECT 1 FROM "OicEvaluationWorkItem" active
              WHERE active."status" = 'LEASED' AND active."leaseUntil" > clock_timestamp()
            )
            AND (
              run."targetIdentity" #>> '{resolvedTarget,providerConnectionId}' IS NULL
              OR NOT EXISTS (
                SELECT 1 FROM "OicProviderAttempt" priorProviderAttempt
                WHERE priorProviderAttempt."connectionId"::text = run."targetIdentity" #>> '{resolvedTarget,providerConnectionId}'
                  AND priorProviderAttempt."startedAt" > clock_timestamp() - (${providerMinIntervalMs} * INTERVAL '1 millisecond')
              )
            )
            AND (environment."definition"->>'kind' IS DISTINCT FROM 'EXECUTABLE_SHELL_V1' OR NOT EXISTS (
              SELECT 1
              FROM "OicEvaluationWorkItem" active
              JOIN "OicEvaluationRun" activeRun ON activeRun."id" = active."runId"
              JOIN "OicEvaluationProtocolManifest" activeManifest ON activeManifest."id" = activeRun."manifestId"
              JOIN "OicEvaluationRelease" activeRelease ON activeRelease."id" = activeManifest."releaseId"
              JOIN "OicEvaluationEnvironmentRevision" activeEnvironment ON activeEnvironment."id" = activeRelease."environmentId"
              WHERE active."status" = 'LEASED' AND active."leaseUntil" > clock_timestamp()
                AND activeEnvironment."definition"->>'kind' = 'EXECUTABLE_SHELL_V1'
            ))
        ), scope_heads AS (
          SELECT * FROM eligible WHERE "scopeRank" = 1
        )
        SELECT work."id", head."scopeKey", head."providerConnectionId"
        FROM scope_heads head
        JOIN "OicEvaluationWorkItem" work ON work."id" = head."id"
        ORDER BY CASE WHEN head."scopeKey" > ${cursorRows[0].lastScopeKey ?? ""} THEN 0 ELSE 1 END,
                 head."scopeKey" ASC
        FOR UPDATE OF work SKIP LOCKED
        LIMIT 1
      `);
      const candidate = selected[0];
      const selectedId = candidate?.id;
      if (!selectedId) return null;
      const claimed = await tx.$queryRaw<Array<{ id: string; applicationId: string; tenantId: string | null; runId: string; caseExecutionId: string; leaseGeneration: number; attemptCount: number; leaseUntil: Date; executionMode: string; diagnosticProbeId: string | null }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem"
        SET "status" = 'LEASED', "leaseOwner" = ${workerId},
            "leaseGeneration" = "leaseGeneration" + 1,
            "leaseUntil" = CURRENT_TIMESTAMP + (${leaseMs} * INTERVAL '1 millisecond'),
            "attemptCount" = "attemptCount" + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${selectedId}::uuid
        RETURNING "id", "applicationId", "tenantId", "runId", "caseExecutionId", "leaseGeneration", "attemptCount", "leaseUntil", "executionMode", "diagnosticProbeId"
      `);
      const row = claimed[0];
      if (!row) throw new ConflictException("EVALUATION_WORK_CLAIM_LOST");
      const recoveryGeneration = row.attemptCount > 5 ? await tx.oicEvaluationRecoveryGeneration.findFirst({ where: { workItemId: row.id, status: "ACTIVE" }, orderBy: { generationOrdinal: "desc" } }) : null;
      const recoveryAnchor = recoveryGeneration ? await tx.oicEvaluationAttempt.findUnique({ where: { id: recoveryGeneration.previousAttemptId }, select: { attemptOrdinal: true } }) : null;
      const recoveryOrdinal = recoveryGeneration && recoveryAnchor ? row.attemptCount - recoveryAnchor.attemptOrdinal : null;
      if (row.attemptCount > 5) {
        if (!recoveryGeneration || recoveryGeneration.status !== "ACTIVE" || !recoveryOrdinal || recoveryOrdinal > recoveryGeneration.maxPhysicalAttempts) throw new ConflictException("EVALUATION_RECOVERY_GENERATION_EXHAUSTED");
        const consumed = await tx.oicEvaluationRecoveryGeneration.updateMany({ where: { id: recoveryGeneration.id, status: "ACTIVE", usedPhysicalAttempts: recoveryOrdinal - 1, maxPhysicalAttempts: { gte: recoveryOrdinal } }, data: { usedPhysicalAttempts: { increment: 1 } } });
        if (consumed.count !== 1) throw new ConflictException("EVALUATION_RECOVERY_GENERATION_CONFLICT");
      }
      const changedCase = await tx.oicEvaluationCaseExecution.updateMany({
        where: { id: row.caseExecutionId, runId: row.runId, leaseGeneration: row.leaseGeneration - 1, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "RUNNING", leaseOwner: workerId, leaseGeneration: row.leaseGeneration, leaseUntil: row.leaseUntil }
      });
      if (changedCase.count !== 1) throw new ConflictException("EVALUATION_CASE_FENCE_MISMATCH");
      await tx.oicEvaluationRun.updateMany({ where: { id: row.runId, status: "QUEUED" }, data: { status: "RUNNING" } });
      await tx.$executeRaw(Prisma.sql`
        UPDATE "OicEvaluationAttempt" SET "status" = 'INFRA_FAILURE', "failureClass" = 'WORKER_LEASE_EXPIRED',
          "lastDurableStage" = "lifecycleStage", "lifecycleStage" = 'FAILED', "lifecycleUpdatedAt" = clock_timestamp(), "completedAt" = clock_timestamp()
        WHERE "caseExecutionId" = ${row.caseExecutionId}::uuid AND "status" IN ('CREATED','RUNNING','DISPATCHED')
      `);
      const attemptOrdinal = row.attemptCount;
      const attempt = await tx.oicEvaluationAttempt.create({ data: {
        caseExecutionId: row.caseExecutionId,
        physicalKey: `evaluation-work:${row.id}:${row.leaseGeneration}`,
        attemptOrdinal,
        ...(recoveryOrdinal && recoveryGeneration ? { recoveryGenerationId: recoveryGeneration.id, recoveryOrdinal } : {}),
        status: "CREATED", lifecycleStage: "LEASE_ACQUIRED", lifecycleUpdatedAt: new Date(),
        leaseOwner: workerId, leaseAcquiredAt: new Date(), leaseExpiresAt: row.leaseUntil, leaseHeartbeatAt: new Date()
      }, select: { id: true } });
      if (recoveryOrdinal && recoveryGeneration) {
        const previousAttempt = await tx.oicEvaluationAttempt.findFirst({ where: { caseExecutionId: row.caseExecutionId, attemptOrdinal: attemptOrdinal - 1 }, select: { id: true, lastDurableStage: true, lifecycleStage: true } });
        await tx.oicAuditEvent.create({ data: { applicationId: row.applicationId, tenantId: row.tenantId, action: "evaluation.packet76.recovery_attempt.claimed", targetType: "evaluation-attempt", targetId: attempt.id, metadata: { recoveryGenerationId: recoveryGeneration.id, recoveryOrdinal, workItemId: row.id, previousAttemptId: previousAttempt?.id ?? null, previousDurableStage: previousAttempt?.lastDurableStage ?? previousAttempt?.lifecycleStage ?? "UNKNOWN", leaseGeneration: row.leaseGeneration } } });
      }
      await tx.oicEvaluationWorkItem.update({ where: { id: row.id }, data: { leaseAcquiredAt: new Date(), leaseHeartbeatAt: new Date(), leaseHeartbeatCount: 0 } });
      if (row.executionMode === "DIAGNOSTIC" && row.diagnosticProbeId) await tx.oicEvaluationPreflightDiagnostic.update({ where: { id: row.diagnosticProbeId }, data: {
        workerAttemptId: attempt.id, leaseOwner: workerId, claimedAt: new Date(), leaseAcquiredAt: new Date(), leaseHeartbeatCount: 0,
        lastCompletedStage: "LEASE_ACQUIRED", failingStage: "WORKER_EXECUTION"
      } });
      await tx.$executeRaw(Prisma.sql`
        UPDATE "OicEvaluationSchedulerCursor"
        SET "lastScopeKey" = ${candidate.scopeKey}, "updatedAt" = clock_timestamp()
        WHERE "id" = 'EVALUATION'
      `);
      return { workItemId: row.id, runId: row.runId, caseExecutionId: row.caseExecutionId, attemptId: attempt.id, workerId, generation: row.leaseGeneration, attemptOrdinal, leaseUntil: row.leaseUntil, executionMode: row.executionMode === "DIAGNOSTIC" ? "DIAGNOSTIC" : "STANDARD", diagnosticProbeId: row.diagnosticProbeId };
    });
  }

  async renew(lease: EvaluationWorkLease, leaseMs: number): Promise<Date> {
    validateLeaseRequest(lease.workerId, leaseMs);
    return this.db.$transaction(async (tx) => {
      const work = await tx.$queryRaw<Array<{ leaseUntil: Date }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem"
        SET "leaseUntil" = CURRENT_TIMESTAMP + (${leaseMs} * INTERVAL '1 millisecond'),
            "leaseHeartbeatAt" = CURRENT_TIMESTAMP, "leaseHeartbeatCount" = "leaseHeartbeatCount" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${lease.workItemId}::uuid AND "status" = 'LEASED'
          AND "leaseOwner" = ${lease.workerId} AND "leaseGeneration" = ${lease.generation}
          AND "leaseUntil" > CURRENT_TIMESTAMP
        RETURNING "leaseUntil"
      `);
      const leaseUntil = work[0]?.leaseUntil;
      if (!leaseUntil) throw new ConflictException("EVALUATION_WORK_LEASE_LOST");
      const execution = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationCaseExecution"
        SET "leaseUntil" = ${leaseUntil}
        WHERE "id" = ${lease.caseExecutionId}::uuid AND "runId" = ${lease.runId}::uuid
          AND "status" = 'RUNNING' AND "leaseOwner" = ${lease.workerId}
          AND "leaseGeneration" = ${lease.generation}
          AND "leaseUntil" > CURRENT_TIMESTAMP
        RETURNING "id"
      `);
      if (execution.length !== 1) throw new ConflictException("EVALUATION_WORK_LEASE_LOST");
      await tx.oicEvaluationAttempt.updateMany({ where: { caseExecutionId: lease.caseExecutionId, physicalKey: `evaluation-work:${lease.workItemId}:${lease.generation}`, leaseOwner: lease.workerId }, data: { leaseExpiresAt: leaseUntil, leaseHeartbeatAt: new Date() } });
      if (lease.diagnosticProbeId) await tx.oicEvaluationPreflightDiagnostic.update({ where: { id: lease.diagnosticProbeId }, data: { leaseHeartbeatCount: { increment: 1 } } });
      return leaseUntil;
    }, { maxWait: 5_000, timeout: 10_000 });
  }

  async completeDiagnostic(lease: EvaluationWorkLease): Promise<void> {
    if (lease.executionMode !== "DIAGNOSTIC" || !lease.diagnosticProbeId) throw new ConflictException("EVALUATION_DIAGNOSTIC_LEASE_INVALID");
    const diagnosticProbeId = lease.diagnosticProbeId;
    await this.db.$transaction(async (tx) => {
      const work = await tx.oicEvaluationWorkItem.updateMany({ where: { id: lease.workItemId, runId: lease.runId, caseExecutionId: lease.caseExecutionId, status: "LEASED", leaseOwner: lease.workerId, leaseGeneration: lease.generation }, data: { status: "SUCCEEDED", leaseOwner: null, leaseUntil: null, completedAt: new Date() } });
      const attempt = await tx.oicEvaluationAttempt.updateMany({ where: { id: lease.attemptId, caseExecutionId: lease.caseExecutionId, status: "CREATED", leaseOwner: lease.workerId }, data: { status: "DIAGNOSTIC", lastDurableStage: "READY_FOR_ADMISSION", lifecycleStage: "DIAGNOSTIC_READY", lifecycleUpdatedAt: new Date(), completedAt: new Date() } });
      const execution = await tx.oicEvaluationCaseExecution.updateMany({ where: { id: lease.caseExecutionId, runId: lease.runId, status: "RUNNING", leaseOwner: lease.workerId, leaseGeneration: lease.generation }, data: { status: "DIAGNOSTIC_READY", leaseOwner: null, leaseUntil: null, completedAt: new Date(), outcome: { diagnosticOnly: true, terminalStage: "READY_FOR_ADMISSION", admissionCreated: false, providerAttemptCreated: false, providerDispatchStarted: false } } });
      if (work.count !== 1 || attempt.count !== 1 || execution.count !== 1) throw new ConflictException("EVALUATION_DIAGNOSTIC_LEASE_LOST");
      const run = await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: lease.runId }, select: { applicationId: true, tenantId: true, diagnosticOnly: true } });
      if (!run.diagnosticOnly) throw new ConflictException("EVALUATION_DIAGNOSTIC_RUN_REQUIRED");
      await tx.oicEvaluationRun.update({ where: { id: lease.runId }, data: { status: "DIAGNOSTIC_READY", completedAt: new Date() } });
      await tx.oicEvaluationPreflightDiagnostic.update({ where: { id: diagnosticProbeId }, data: { status: "READY", lastCompletedStage: "READY_FOR_ADMISSION", failingStage: null, completedAt: new Date(), result: { queueClaim: "PASS", leaseOwnership: "PASS", workerExecution: "PASS", admissionCreated: false, providerAttemptCreated: false, providerDispatchStarted: false } } });
      await tx.oicAuditEvent.create({ data: { applicationId: run.applicationId, tenantId: run.tenantId, action: "evaluation.packet76.real_queue_diagnostic.ready", targetType: "evaluation-preflight-diagnostic", targetId: diagnosticProbeId, metadata: { queueRunId: lease.runId, workItemId: lease.workItemId, caseExecutionId: lease.caseExecutionId, workerAttemptId: lease.attemptId, leaseOwner: lease.workerId, leaseGeneration: lease.generation, terminalStage: "READY_FOR_ADMISSION", admissionCreated: false, providerAttemptCreated: false, providerDispatchStarted: false } } });
    });
  }

  async recordLifecycle(lease: EvaluationWorkLease, stage: string, providerAttemptId?: string): Promise<void> {
    const stages = ["PREFLIGHT", "PREFLIGHT_PROTOCOL", "PREFLIGHT_CASE", "PREFLIGHT_ARTIFACT", "PREFLIGHT_ECONOMICS", "PREFLIGHT_PRINCIPAL", "PREFLIGHT_ADMISSION", "ADMISSION_REQUESTED", "PROVIDER_ATTEMPT_CREATED", "PROVIDER_DISPATCH_STARTED", "PROVIDER_RESPONSE_RECEIVED", "EVIDENCE_PERSISTING", "REPORTING"];
    if (!stages.includes(stage) || (providerAttemptId !== undefined && !uuid.test(providerAttemptId))) throw new ConflictException("EVALUATION_LIFECYCLE_STAGE_INVALID");
    const updated = await this.db.$executeRaw(Prisma.sql`
      UPDATE "OicEvaluationAttempt" SET "lastDurableStage" = ${stage}, "lifecycleStage" = ${stage}, "lifecycleUpdatedAt" = clock_timestamp(),
        "providerAttemptId" = COALESCE(${providerAttemptId ?? null}::uuid, "providerAttemptId"),
        "providerDispatchStartedAt" = CASE WHEN ${stage} = 'PROVIDER_DISPATCH_STARTED' THEN clock_timestamp() ELSE "providerDispatchStartedAt" END
      WHERE "id" = ${lease.attemptId}::uuid AND "caseExecutionId" = ${lease.caseExecutionId}::uuid
        AND "leaseOwner" = ${lease.workerId} AND "status" IN ('CREATED','DISPATCHED')
    `);
    if (updated !== 1) throw new ConflictException("EVALUATION_ATTEMPT_FENCE_MISMATCH");
  }

  async recordAdmission(lease: EvaluationWorkLease, admissionId: string): Promise<void> {
    if (!uuid.test(admissionId)) throw new ConflictException("EVALUATION_ADMISSION_ID_INVALID");
    const changed = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "OicEvaluationAttempt" AS attempt
      SET "admissionId" = ${admissionId}::uuid, "status" = 'DISPATCHED',
          "startedAt" = clock_timestamp(), "lastDurableStage" = 'ADMISSION_GRANTED', "lifecycleStage" = 'ADMISSION_GRANTED', "lifecycleUpdatedAt" = clock_timestamp()
      FROM "OicEvaluationWorkItem" AS work
      WHERE attempt."id" = ${lease.attemptId}::uuid
        AND attempt."caseExecutionId" = ${lease.caseExecutionId}::uuid
        AND work."id" = ${lease.workItemId}::uuid
        AND work."caseExecutionId" = attempt."caseExecutionId"
        AND work."runId" = ${lease.runId}::uuid
        AND work."status" = 'LEASED' AND work."leaseOwner" = ${lease.workerId}
        AND work."leaseGeneration" = ${lease.generation}
        AND work."leaseUntil" > CURRENT_TIMESTAMP
      RETURNING attempt."id"
    `);
    if (changed.length !== 1) throw new ConflictException("EVALUATION_WORK_LEASE_LOST");
  }

  async completeTargetInvocation(lease: EvaluationWorkLease, output: { artifactId: string; digest: string; exposureTier: string; encoding?: string }, target: Record<string, unknown>, executionEvidence: Record<string, unknown> | null = null): Promise<void> {
    if (!uuid.test(output.artifactId) || !/^[a-f0-9]{64}$/.test(output.digest) || !/^(PUBLIC|INTERNAL|PRIVATE_HOLDOUT|PROTECTED_CERTIFICATION)$/.test(output.exposureTier) || (output.encoding !== undefined && output.encoding !== "OIC_EMPTY_VISIBLE_OUTPUT_V1")) throw new ConflictException("EVALUATION_OUTPUT_EVIDENCE_INVALID");
    if (executionEvidence && (
      Object.keys(executionEvidence).some((key) => !executionEvidenceFields.has(key)) ||
      executionEvidence.backend !== "DOCKER_LINUX" || executionEvidence.networkPolicy !== "DENY" ||
      typeof executionEvidence.imageDigest !== "string" || !/^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/i.test(executionEvidence.imageDigest) ||
      typeof executionEvidence.environmentDigest !== "string" || !/^[a-f0-9]{64}$/.test(executionEvidence.environmentDigest) ||
      typeof executionEvidence.candidateArtifactId !== "string" || !uuid.test(executionEvidence.candidateArtifactId) ||
      typeof executionEvidence.candidateDigest !== "string" || !/^[a-f0-9]{64}$/.test(executionEvidence.candidateDigest) ||
      typeof executionEvidence.stderrDigest !== "string" || !/^[a-f0-9]{64}$/.test(executionEvidence.stderrDigest) ||
      !["SUCCEEDED", "TARGET_FAILED", "TIMEOUT", "RESOURCE_LIMIT"].includes(String(executionEvidence.status)) ||
      typeof executionEvidence.outputTruncated !== "boolean" ||
      !Number.isInteger(executionEvidence.durationMs) || (executionEvidence.durationMs as number) < 0 || (executionEvidence.durationMs as number) > 300_000
    )) throw new ConflictException("EVALUATION_EXECUTION_EVIDENCE_INVALID");
    const evidence = { output: { artifactId: output.artifactId, digest: output.digest, purpose: "OUTPUT", exposureTier: output.exposureTier, ...(output.encoding ? { encoding: output.encoding } : {}) }, target, ...(executionEvidence ? { execution: executionEvidence } : {}) };
    if (JSON.stringify(evidence).length > 16_384) throw new ConflictException("EVALUATION_EXECUTION_EVIDENCE_INVALID");
    const evidenceDigest = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
    await this.db.$transaction(async (tx) => {
      const work = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem"
        SET "status" = 'SUCCEEDED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "completedAt" = clock_timestamp(), "updatedAt" = clock_timestamp()
        WHERE "id" = ${lease.workItemId}::uuid AND "runId" = ${lease.runId}::uuid
          AND "caseExecutionId" = ${lease.caseExecutionId}::uuid
          AND "status" = 'LEASED' AND "leaseOwner" = ${lease.workerId}
          AND "leaseGeneration" = ${lease.generation} AND "leaseUntil" > clock_timestamp()
        RETURNING "id"
      `);
      if (work.length !== 1) throw new ConflictException("EVALUATION_WORK_LEASE_LOST");
      const attempt = await tx.oicEvaluationAttempt.updateMany({
        where: { id: lease.attemptId, caseExecutionId: lease.caseExecutionId, status: "DISPATCHED" },
        data: { status: "SUCCEEDED", completedAt: new Date(), artifactManifest: evidence as Prisma.InputJsonValue, evidenceDigest }
      });
      if (attempt.count !== 1) throw new ConflictException("EVALUATION_ATTEMPT_FENCE_MISMATCH");
      await tx.oicEvaluationAttempt.updateMany({ where: { id: lease.attemptId }, data: { lastDurableStage: "COMPLETED", lifecycleStage: "COMPLETED", lifecycleUpdatedAt: new Date() } });
      const execution = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationCaseExecution"
        SET "status" = 'EXECUTED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "completedAt" = clock_timestamp(), "outcome" = ${JSON.stringify({ output: evidence.output, evidenceDigest, ...(executionEvidence ? { executionStatus: executionEvidence.status } : {}) })}::jsonb
        WHERE "id" = ${lease.caseExecutionId}::uuid AND "runId" = ${lease.runId}::uuid
          AND "status" = 'RUNNING' AND "leaseOwner" = ${lease.workerId}
          AND "leaseGeneration" = ${lease.generation} AND "leaseUntil" > clock_timestamp()
        RETURNING "id"
      `);
      if (execution.length !== 1) throw new ConflictException("EVALUATION_CASE_FENCE_MISMATCH");
      const scope = await tx.oicEvaluationWorkItem.findUniqueOrThrow({ where: { id: lease.workItemId }, select: { applicationId: true, tenantId: true } });
      const finalizedAttempt = await tx.oicEvaluationAttempt.findUnique({ where: { id: lease.attemptId }, select: { recoveryGenerationId: true } });
      const recovery = finalizedAttempt?.recoveryGenerationId ? await tx.oicEvaluationRecoveryGeneration.findUnique({ where: { id: finalizedAttempt.recoveryGenerationId }, select: { id: true, status: true, usedPhysicalAttempts: true } }) : null;
      if (recovery?.status === "ACTIVE") {
        await tx.oicEvaluationRecoveryGeneration.update({ where: { id: recovery.id }, data: { status: "CLOSED", closedAt: new Date() } });
        await tx.oicAuditEvent.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, action: "evaluation.packet76.recovery_generation.closed", targetType: "evaluation-recovery-generation", targetId: recovery.id, metadata: { runId: lease.runId, workItemId: lease.workItemId, successfulAttemptId: lease.attemptId, usedPhysicalAttempts: recovery.usedPhysicalAttempts, providerDispatchOccurred: true, closure: "VALID_PROVIDER_EXECUTION" } } });
      }
      await tx.oicEvaluationOutbox.create({ data: {
        applicationId: scope.applicationId, tenantId: scope.tenantId, runId: lease.runId,
        eventKey: `${lease.caseExecutionId}:executed`, eventType: "EVALUATION_CASE_EXECUTED",
        payload: { runId: lease.runId, caseExecutionId: lease.caseExecutionId }
      } });
    });
  }

  async failTerminal(lease: EvaluationWorkLease, failureClass: string, diagnostic?: EvaluationFailureDiagnostic): Promise<void> {
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(failureClass)) throw new ConflictException("EVALUATION_FAILURE_CLASS_INVALID");
    if (diagnostic && (!/^[A-Z][A-Z0-9_]{1,47}$/.test(diagnostic.stage) || !/^[A-Z][A-Z0-9_]{1,63}$/.test(diagnostic.code)
      || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(diagnostic.type) || diagnostic.message.length > 240 || !/^[a-f0-9]{64}$/.test(diagnostic.fingerprint))) throw new ConflictException("EVALUATION_FAILURE_DIAGNOSTIC_INVALID");
    const budgetBlocked = ["BUDGET_BLOCKED", "HARD_BUDGET_ENFORCEMENT_REQUIRED"].includes(failureClass);
    await this.db.$transaction(async (tx) => {
      const work = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationWorkItem"
        SET "status" = 'FAILED', "leaseOwner" = NULL, "leaseUntil" = NULL,
            "lastFailureClass" = ${failureClass}, "completedAt" = clock_timestamp(), "updatedAt" = clock_timestamp()
        WHERE "id" = ${lease.workItemId}::uuid AND "runId" = ${lease.runId}::uuid
          AND "caseExecutionId" = ${lease.caseExecutionId}::uuid
          AND "status" = 'LEASED' AND "leaseOwner" = ${lease.workerId}
          AND "leaseGeneration" = ${lease.generation} AND "leaseUntil" > clock_timestamp()
        RETURNING "id"
      `);
      if (work.length !== 1) throw new ConflictException("EVALUATION_WORK_LEASE_LOST");
      const scope = await tx.oicEvaluationWorkItem.findFirst({ where: { id: lease.workItemId, runId: lease.runId, caseExecutionId: lease.caseExecutionId }, select: { applicationId: true, tenantId: true } });
      const priorAttempt = await tx.oicEvaluationAttempt.findFirst({ where: { id: lease.attemptId, caseExecutionId: lease.caseExecutionId }, select: { admissionId: true } });
      if (!scope || !priorAttempt) throw new ConflictException("EVALUATION_ATTEMPT_FENCE_MISMATCH");
      const admission = await tx.oicAdmission.findFirst({
        where: {
          ...(priorAttempt.admissionId ? { id: priorAttempt.admissionId } : {}),
          applicationId: scope.applicationId, tenantId: scope.tenantId,
          idempotencyKey: `evaluation-attempt:${lease.attemptId}`
        },
        select: { id: true, status: true }
      });
      const admissionUnresolved = !!admission && ["DISPATCHED", "UNCERTAIN", "SETTLED"].includes(admission.status);
      const linkedAdmissionMissing = priorAttempt.admissionId !== null && !admission;
      const providerOutcomeUnresolved = !budgetBlocked && (admissionUnresolved || linkedAdmissionMissing);
      const invalidEnvironment = !budgetBlocked && !providerOutcomeUnresolved && invalidEnvironmentFailures.has(failureClass);
      const caseStatus = budgetBlocked ? "BUDGET_BLOCKED" : providerOutcomeUnresolved ? "INCONCLUSIVE" : invalidEnvironment ? "INVALID_ENVIRONMENT" : "FAILED";
      const attempt = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationAttempt" AS attempt
        SET "admissionId" = COALESCE(attempt."admissionId", ${admission?.id ?? null}::uuid),
            "status" = ${budgetBlocked ? "BUDGET_BLOCKED" : "INFRA_FAILURE"}, "failureClass" = ${failureClass}, "completedAt" = clock_timestamp(),
            "failureStage" = ${diagnostic?.stage ?? null}, "safeErrorCode" = ${diagnostic?.code ?? null}, "safeErrorType" = ${diagnostic?.type ?? null},
            "safeErrorMessage" = ${diagnostic?.message ?? null}, "errorFingerprint" = ${diagnostic?.fingerprint ?? null},
            "failureRecordedAt" = CASE WHEN ${diagnostic ? true : false} THEN clock_timestamp() ELSE NULL END,
            "lastDurableStage" = attempt."lifecycleStage", "lifecycleStage" = 'FAILED', "lifecycleUpdatedAt" = clock_timestamp()
        WHERE attempt."id" = ${lease.attemptId}::uuid AND attempt."caseExecutionId" = ${lease.caseExecutionId}::uuid
          AND attempt."status" IN ('CREATED', 'DISPATCHED', 'RUNNING')
        RETURNING attempt."id"
      `);
      if (attempt.length !== 1) throw new ConflictException("EVALUATION_ATTEMPT_FENCE_MISMATCH");
      if (diagnostic?.details || diagnostic?.stackFrame) await tx.oicAuditEvent.create({ data: {
        applicationId: scope.applicationId, tenantId: scope.tenantId,
        action: "evaluation.worker.failure_diagnostic.captured", targetType: "evaluation-attempt", targetId: lease.attemptId,
        metadata: { runId: lease.runId, failureStage: diagnostic.stage, safeErrorCode: diagnostic.code, safeErrorType: diagnostic.type, errorFingerprint: diagnostic.fingerprint,
          ...(diagnostic.stackFrame ? { safeStackFrame: diagnostic.stackFrame } : {}), ...(diagnostic.details ?? {}) }
      } });
      const execution = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "OicEvaluationCaseExecution"
        SET "status" = ${caseStatus}, "leaseOwner" = NULL, "leaseUntil" = NULL,
            "completedAt" = clock_timestamp(), "outcome" = ${JSON.stringify({ failureClass, measurementAvailability: "NO_MEASUREMENT", ...(providerOutcomeUnresolved ? { admissionState: admission?.status ?? "UNKNOWN" } : {}) })}::jsonb
        WHERE "id" = ${lease.caseExecutionId}::uuid AND "runId" = ${lease.runId}::uuid
          AND "status" = 'RUNNING' AND "leaseOwner" = ${lease.workerId}
          AND "leaseGeneration" = ${lease.generation} AND "leaseUntil" > clock_timestamp()
        RETURNING "id"
      `);
      if (execution.length !== 1) throw new ConflictException("EVALUATION_CASE_FENCE_MISMATCH");
      const recoveryAttempt = await tx.oicEvaluationAttempt.findUnique({ where: { id: lease.attemptId }, select: { recoveryGenerationId: true, providerAttemptId: true, providerDispatchStartedAt: true } });
      const recovery = recoveryAttempt?.recoveryGenerationId
        ? await tx.oicEvaluationRecoveryGeneration.findUnique({ where: { id: recoveryAttempt.recoveryGenerationId }, select: { id: true, status: true, usedPhysicalAttempts: true, maxPhysicalAttempts: true } })
        : null;
      const admissionProviderAttempts = admission?.id ? await tx.oicProviderAttempt.count({ where: { admissionId: admission.id } }) : 0;
      const retryablePreDispatch = !!recovery && recovery.status === "ACTIVE" && recovery.usedPhysicalAttempts < recovery.maxPhysicalAttempts
        && !recoveryAttempt?.providerAttemptId && !recoveryAttempt?.providerDispatchStartedAt && admissionProviderAttempts === 0
        && (!admission || admission.status === "RELEASED")
        && ["RUNTIME_UNAVAILABLE", "WORKER_LEASE_EXPIRED", "WORKER_READINESS_LOST", "WORKER_DEADLINE_EXCEEDED"].includes(failureClass);
      if (retryablePreDispatch && recovery) {
        await tx.oicEvaluationWorkItem.update({ where: { id: lease.workItemId }, data: { status: "PENDING", lastFailureClass: failureClass, completedAt: null, availableAt: new Date() } });
        await tx.oicEvaluationCaseExecution.update({ where: { id: lease.caseExecutionId }, data: { status: "QUEUED", completedAt: null, outcome: Prisma.DbNull } });
        await tx.oicEvaluationRun.updateMany({ where: { id: lease.runId, status: { in: ["RUNNING", "PARTIAL", "INCONCLUSIVE"] } }, data: { status: "RUNNING", completedAt: null } });
        await tx.oicEvaluationOutbox.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, runId: lease.runId, eventKey: `${lease.caseExecutionId}:recovery-requeue:${lease.attemptId}`, eventType: "EVALUATION_CASE_ENQUEUED", payload: { runId: lease.runId, caseExecutionId: lease.caseExecutionId, workItemId: lease.workItemId, recoveryGenerationId: recovery.id } } });
        await tx.oicAuditEvent.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, action: "evaluation.packet76.recovery_attempt.requeued", targetType: "evaluation-attempt", targetId: lease.attemptId, metadata: { recoveryGenerationId: recovery.id, workItemId: lease.workItemId, caseExecutionId: lease.caseExecutionId, failureClass, providerAttemptCount: admissionProviderAttempts, providerDispatchStarted: false, nextRecoveryOrdinal: recovery.usedPhysicalAttempts + 1 } } });
      } else if (recovery?.status === "ACTIVE") {
        const exhausted = recovery.usedPhysicalAttempts >= recovery.maxPhysicalAttempts;
        await tx.oicEvaluationRecoveryGeneration.update({ where: { id: recovery.id }, data: { status: exhausted ? "EXHAUSTED" : "CLOSED", closedAt: new Date() } });
        await tx.oicAuditEvent.create({ data: { applicationId: scope.applicationId, tenantId: scope.tenantId, action: "evaluation.packet76.recovery_generation.closed", targetType: "evaluation-recovery-generation", targetId: recovery.id, metadata: { runId: lease.runId, workItemId: lease.workItemId, terminalAttemptId: lease.attemptId, usedPhysicalAttempts: recovery.usedPhysicalAttempts, providerAttemptCount: admissionProviderAttempts, providerDispatchStarted: Boolean(recoveryAttempt?.providerDispatchStartedAt || recoveryAttempt?.providerAttemptId), closure: exhausted ? "THREE_PRE_DISPATCH_ATTEMPTS_EXHAUSTED" : "NON_RECOVERABLE_OR_PROVIDER_BOUNDARY" } } });
      }
      const inconclusive = caseStatus === "INCONCLUSIVE";
      if (!retryablePreDispatch) await tx.oicEvaluationOutbox.create({ data: {
        applicationId: scope.applicationId, tenantId: scope.tenantId, runId: lease.runId,
        eventKey: `${lease.caseExecutionId}:${inconclusive ? "inconclusive" : "failed"}:${lease.generation}`,
        eventType: inconclusive ? "EVALUATION_CASE_INCONCLUSIVE" : "EVALUATION_CASE_FAILED",
        payload: { runId: lease.runId, caseExecutionId: lease.caseExecutionId }
      } });
    });
  }

  async heartbeat(workerId: string): Promise<{ workerId: string; observedAt: Date }> {
    if (!workerIdentity.test(workerId)) throw new ConflictException("WORKER_IDENTITY_INVALID");
    await this.db.$queryRaw`SELECT 1`;
    return { workerId, observedAt: new Date() };
  }

  /** The sandbox adapter uses this DB-time check before retaining an owned container after a crash. */
  async isAttemptLeaseValid(attemptId: string): Promise<boolean> {
    if (!uuid.test(attemptId)) return false;
    const rows = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT attempt."id"
      FROM "OicEvaluationAttempt" attempt
      JOIN "OicEvaluationWorkItem" work ON work."caseExecutionId" = attempt."caseExecutionId"
      JOIN "OicEvaluationCaseExecution" execution ON execution."id" = attempt."caseExecutionId"
      WHERE attempt."id" = ${attemptId}::uuid
        AND attempt."status" IN ('CREATED', 'RUNNING', 'DISPATCHED')
        AND attempt."physicalKey" = ('evaluation-work:' || work."id"::text || ':' || work."leaseGeneration"::text)
        AND work."status" = 'LEASED' AND work."leaseUntil" > CURRENT_TIMESTAMP
        AND execution."status" = 'RUNNING'
        AND execution."leaseGeneration" = work."leaseGeneration"
        AND execution."leaseOwner" = work."leaseOwner"
        AND execution."leaseUntil" > CURRENT_TIMESTAMP
      LIMIT 1
    `);
    return rows.length === 1;
  }
}
