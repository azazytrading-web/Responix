import { ConfigService } from "@nestjs/config";
import { ConflictException, Injectable, OnApplicationBootstrap, OnApplicationShutdown, Optional } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { OicDatabaseService, Prisma } from "@oic/database";
import type { OicRuntimeRequest } from "@oic/contracts";
import { OicRuntimeService, type EvaluationRuntimeTargetSnapshot } from "../runtime-plane/runtime.service";
import { OicRuntimeException } from "../runtime-plane/runtime-errors";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { EvaluationArtifactError, EvaluationArtifactVault } from "./artifact-vault";
import { EMPTY_VISIBLE_OUTPUT_ENCODING, encodeEmptyVisibleOutput } from "./visible-output-evidence";
import { EvaluationSandboxAdapter, SandboxUnavailableError, type SandboxResult } from "./sandbox-adapter";
import { sha256 } from "./evaluation.service";
import { estimatePacket76Input } from "./basis-bridge";
import { packet76SuccessorBaseBudgetEligible, packet76SuccessorResumeHistoryEligible } from "./packet76-successor";
import { EvaluationWorkQueue, type EvaluationFailureDiagnostic, type EvaluationWorkLease } from "./evaluation-work-queue";
import { EvaluationOutboxDispatcher } from "./evaluation-outbox";
import { EvaluationSealedOracle } from "./sealed-oracle";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODEL_ID = /^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const EXPOSURE_TIERS = new Set(["PUBLIC", "INTERNAL", "PRIVATE_HOLDOUT", "PROTECTED_CERTIFICATION"]);
const LEASE_MS = 300_000;
const READINESS_HEARTBEAT_MS = 2_000;

type JsonObject = Record<string, unknown>;
type RuntimeTargetIdentity = { modelId: string; runtimePrincipalId: string; resolvedTarget: JsonObject };

class EvaluationWorkerFailure extends Error {
  constructor(readonly failureClass: string) { super(failureClass); }
}

type PreflightDiagnosticContext = { id?: string; stage: string; lastCompletedStage: string | null; stopBeforeAdmission?: boolean };

export function safeWorkerDiagnostic(error: unknown, stage: string): EvaluationFailureDiagnostic {
  const safeStage = /^[A-Z][A-Z0-9_]{1,47}$/.test(stage) ? stage : "UNKNOWN_STAGE";
  const resolverDiagnostic = error instanceof OicRuntimeException
    ? (error as OicRuntimeException & { safeModelResolutionDiagnostic?: Record<string, unknown> }).safeModelResolutionDiagnostic
    : undefined;
  const operationId = resolverDiagnostic?.operationId === "OIC_MODEL_EDITION_FIND_FIRST" ? resolverDiagnostic.operationId : null;
  const prismaErrorType = typeof resolverDiagnostic?.prismaErrorType === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(resolverDiagnostic.prismaErrorType)
    ? resolverDiagnostic.prismaErrorType : null;
  const prismaErrorCode = typeof resolverDiagnostic?.prismaErrorCode === "string" && /^P[0-9]{4}$/.test(resolverDiagnostic.prismaErrorCode)
    ? resolverDiagnostic.prismaErrorCode : null;
  const typeCandidate = error instanceof Error ? error.constructor.name : "UnknownError";
  const type = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(typeCandidate) ? typeCandidate : "UnknownError";
  const codeCandidate = operationId ? `PRISMA_${operationId}${prismaErrorCode ? `_${prismaErrorCode}` : ""}`
    : error instanceof EvaluationWorkerFailure ? error.failureClass
    : error instanceof OicRuntimeException ? error.code
      : error instanceof Prisma.PrismaClientKnownRequestError && /^P[0-9]{4}$/.test(error.code) ? `PRISMA_${error.code}`
        : "UNKNOWN_EXCEPTION";
  const code = /^[A-Z][A-Z0-9_]{1,63}$/.test(codeCandidate) ? codeCandidate : "UNKNOWN_EXCEPTION";
  const diagnosticType = prismaErrorType ?? type;
  const message = operationId
    ? `Pre-provider ${safeStage} failed: OicModelEdition.findFirst (${prismaErrorType ?? "PrismaError"}${prismaErrorCode ? ` ${prismaErrorCode}` : "; code unavailable"})`.slice(0, 240)
    : `Pre-provider ${safeStage} failed: ${code}`.slice(0, 240);
  const fingerprint = createHash("sha256").update(`${safeStage}\n${code}\n${diagnosticType}\n${operationId ?? ""}`).digest("hex");
  const stack = error instanceof Error ? error.stack ?? "" : "";
  const stackFrame = stack.split(/\r?\n/).map((line) => {
    const match = line.match(/(?:[A-Za-z]:\\|\/)[^\r\n()]*?[\\/]apps[\\/]oic-api[\\/](src|dist)[\\/]([A-Za-z0-9_.\\/-]+):(\d+):(\d+)/i);
    if (!match) return null;
    const sourceKind = match[1] ?? "dist";
    const sourceFile = (match[2] ?? "unknown").replace(/\\/g, "/");
    return `oic-api/${sourceKind}/${sourceFile}:${match[3] ?? "0"}:${match[4] ?? "0"}`;
  }).find((line): line is string => line !== null) ?? null;
  const details = operationId ? {
    operationId,
    modelName: "OicModelEdition",
    prismaErrorCode,
    safeDatabaseMeta: resolverDiagnostic?.safeDatabaseMeta && typeof resolverDiagnostic.safeDatabaseMeta === "object" ? resolverDiagnostic.safeDatabaseMeta : {},
    inputShape: resolverDiagnostic?.inputShape && typeof resolverDiagnostic.inputShape === "object" ? resolverDiagnostic.inputShape : {}
  } : undefined;
  return { stage: safeStage, code, type: diagnosticType, message, fingerprint, component: safeStage, stackFrame, ...(details ? { details } : {}) };
}

function vaultFailure(error: unknown, stage: "CAND" | "OUTPUT"): EvaluationWorkerFailure {
  const code = error instanceof EvaluationArtifactError ? error.code : "WRITE_FAILED";
  return new EvaluationWorkerFailure(`VAULT_${stage}_${code}`);
}

function finalizationFailure(error: unknown): EvaluationWorkerFailure {
  const known = error instanceof ConflictException ? error.message : "";
  const codes: Record<string, string> = {
    EVALUATION_OUTPUT_EVIDENCE_INVALID: "FINALIZE_OUTPUT_EVIDENCE_INVALID",
    EVALUATION_EXECUTION_EVIDENCE_INVALID: "FINALIZE_EXECUTION_EVIDENCE_INVALID",
    EVALUATION_WORK_LEASE_LOST: "FINALIZE_WORK_LEASE_LOST",
    EVALUATION_ATTEMPT_FENCE_MISMATCH: "FINALIZE_ATTEMPT_FENCE_MISMATCH",
    EVALUATION_CASE_FENCE_MISMATCH: "FINALIZE_CASE_FENCE_MISMATCH"
  };
  return new EvaluationWorkerFailure(codes[known] ?? "FINALIZE_WRITE_FAILED");
}

function record(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

export function candidateInstructionFromProtocol(protocolValue: unknown): string | null {
  const protocol = record(protocolValue) ?? {};
  const candidate = record(protocol.candidateRevision);
  if (!candidate) return null;
  const change = record(candidate.changeSet);
  const instruction = change?.instruction;
  if (typeof candidate.id !== "string" || !UUID.test(candidate.id) || change?.type !== "SYSTEM_INSTRUCTION" || typeof instruction !== "string" || instruction.trim().length < 16 || instruction.length > 512 || typeof candidate.changeDigest !== "string" || !/^[a-f0-9]{64}$/.test(candidate.changeDigest) || sha256({ type: "SYSTEM_INSTRUCTION", instruction: instruction.trim() }) !== candidate.changeDigest || typeof protocol.candidateTreatmentFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(protocol.candidateTreatmentFingerprint)) throw new EvaluationWorkerFailure("CANDIDATE_PROTOCOL_INVALID");
  return instruction.trim();
}

function parseTarget(value: unknown): RuntimeTargetIdentity {
  const target = record(value);
  if (!target || Object.keys(target).sort().join(",") !== "modelId,resolvedTarget,runtimePrincipalId" || typeof target.modelId !== "string" || !MODEL_ID.test(target.modelId) || typeof target.runtimePrincipalId !== "string" || !UUID.test(target.runtimePrincipalId) || !record(target.resolvedTarget)) throw new EvaluationWorkerFailure("TARGET_IDENTITY_INVALID");
  return target as unknown as RuntimeTargetIdentity;
}

function sameTarget(expected: JsonObject, actual: EvaluationRuntimeTargetSnapshot): boolean {
  const keys = Object.keys(actual).sort();
  return Object.keys(expected).sort().join("\0") === keys.join("\0") && keys.every((key) => expected[key] === actual[key as keyof EvaluationRuntimeTargetSnapshot]);
}

@Injectable()
export class EvaluationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private stopped = false;
  private loopStarted = false;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private attesting = false;
  private workerGeneration: number | null = null;
  private readonly workerId = `evaluation-worker:${randomUUID()}`;
  private readinessVerified = false;
  private pollLoopActive = false;
  private pollLoopExited = false;
  private pollWorkInFlight = false;
  private lastPollTickMonotonicMs = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly db: OicDatabaseService,
    private readonly queue: EvaluationWorkQueue,
    private readonly runtime: OicRuntimeService,
    private readonly artifacts: EvaluationArtifactVault,
    @Optional() private readonly sandbox?: EvaluationSandboxAdapter,
    @Optional() private readonly outbox?: EvaluationOutboxDispatcher,
    @Optional() private readonly sealedOracle?: EvaluationSealedOracle
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true" || this.loopStarted) return;
    this.loopStarted = true;
    this.heartbeatTimer = setInterval(() => { void this.refreshReadiness(); }, READINESS_HEARTBEAT_MS);
    void this.poll();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.readinessVerified = false;
    if (this.workerGeneration !== null) await this.queue.releaseWorkerSlot(this.workerId, this.workerGeneration).catch(() => undefined);
  }

  async readiness(): Promise<{ ready: boolean; reasonCode: string | null; workerId: string; generation: number | null }> {
    const ready = this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") === "true" && this.loopStarted && this.readinessVerified && this.workerGeneration !== null
      && await this.queue.ownsFreshWorkerSlot(this.workerId, this.workerGeneration).catch(() => false);
    return { ready, reasonCode: ready ? null : !this.loopStarted ? "WORKER_NOT_STARTED" : "WORKER_ATTESTATION_UNAVAILABLE", workerId: this.workerId, generation: this.workerGeneration };
  }

  /** One bounded iteration, also used by the local worker acceptance harness. */
  async processOne(workerId = `evaluation-worker:${process.pid}`): Promise<"DISABLED" | "IDLE" | "SUCCEEDED" | "FAILED"> {
    if (this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true") return "DISABLED";
    if (workerId === this.workerId && !await this.readiness().then((value) => value.ready)) return "IDLE";
    this.artifacts.assertConfigured();
    const lease = await this.queue.claimNext(workerId, LEASE_MS);
    if (!lease) return "IDLE";
    return this.executeLease(lease, workerId === this.workerId ? this.workerGeneration ?? undefined : undefined);
  }

  private async poll(): Promise<void> {
    this.pollLoopActive = true;
    try {
      while (!this.stopped) {
        this.lastPollTickMonotonicMs = performance.now();
        try {
          await this.refreshReadiness();
          if (!this.readinessVerified) {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
            continue;
          }
          this.pollWorkInFlight = true;
          const result = await this.processOne(this.workerId);
          this.pollWorkInFlight = false;
          if (result === "IDLE" || result === "DISABLED") await new Promise((resolve) => setTimeout(resolve, 1_000));
        } catch {
          this.pollWorkInFlight = false;
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }
    } finally {
      this.pollWorkInFlight = false;
      this.pollLoopActive = false;
      this.pollLoopExited = true;
      this.readinessVerified = false;
      if (this.workerGeneration !== null) await this.queue.releaseWorkerSlot(this.workerId, this.workerGeneration).catch(() => undefined);
    }
  }

  private async refreshReadiness(): Promise<void> {
    if (this.stopped || this.attesting || this.config.get<string>("OIC_EVALUATION_WORKER_ENABLED") !== "true") return;
    this.attesting = true;
    try {
      if (!this.pollLoopActive || this.pollLoopExited) {
        this.readinessVerified = false;
        if (this.workerGeneration !== null) await this.queue.degradeWorker(this.workerId, this.workerGeneration, "WORKER_LOOP_UNAVAILABLE");
        return;
      }
      if (this.workerGeneration === null) this.workerGeneration = await this.queue.acquireWorkerSlot(this.workerId) ?? null;
      if (this.workerGeneration === null) { this.readinessVerified = false; return; }
      const outbox = this.outbox?.readiness();
      const vault = this.artifacts.readiness();
      const admissionAvailable = this.runtime?.evaluationAdmissionAvailable() === true && this.config.get<string>("OIC_ADMISSION_MODE") === "ENFORCE";
      const oracleAvailable = Boolean(this.sealedOracle && this.outbox);
      if (!outbox?.ready || !vault.available || !admissionAvailable || !oracleAvailable) {
        const reason = !outbox?.ready ? outbox?.reasonCode ?? "OUTBOX_UNAVAILABLE" : !vault.available ? "ARTIFACT_VAULT_UNAVAILABLE" : !admissionAvailable ? "ADMISSION_UNAVAILABLE" : "SEALED_ORACLE_UNAVAILABLE";
        await this.queue.degradeWorker(this.workerId, this.workerGeneration, reason);
        this.readinessVerified = false;
        return;
      }
      const capabilities = {
        database: true, durableQueue: true, claimFencing: true,
        claimLoopAlive: this.pollLoopActive && !this.pollLoopExited && (this.pollWorkInFlight || performance.now() - this.lastPollTickMonotonicMs <= READINESS_HEARTBEAT_MS * 5),
        compatibilityIdentity: "oic-evaluation-worker-readiness-v1",
        artifactEvidence: true, artifactFinalization: true,
        artifactWriteKeyVersion: vault.activeWriteKeyVersion, legacyWriteDisabled: vault.legacyWriteDisabled,
        sealedOracle: oracleAvailable, admission: admissionAvailable, outboxFinalization: outbox.ready,
        supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"], textGeneration: true,
        sandbox: this.config.get<string>("OIC_EVALUATOR_ENABLED") === "true" ? "INDEPENDENTLY_CONFIGURED" : "NOT_REQUIRED_FOR_TEXT",
        heartbeatIntervalMs: READINESS_HEARTBEAT_MS
      };
      this.readinessVerified = await this.queue.heartbeatWorker(this.workerId, this.workerGeneration, capabilities);
      if (!this.readinessVerified) this.workerGeneration = null;
    } catch (error) {
      const reason = error instanceof EvaluationArtifactError ? "ARTIFACT_WRITE_KEY_INVALID" : "QUEUE_UNAVAILABLE";
      this.readinessVerified = false;
      if (this.workerGeneration !== null) await this.queue.degradeWorker(this.workerId, this.workerGeneration, reason).catch(() => undefined);
    } finally {
      this.attesting = false;
    }
  }

  async runPacket76PreflightDiagnostic(actor: AuthenticatedPrincipal, workItemId: string): Promise<Record<string, unknown>> {
    if (!actor.scopes.some((scope) => ["oic:evaluation:manage", "oic:foundation:admin"].includes(scope)) || !UUID.test(workItemId)) throw new EvaluationWorkerFailure("DIAGNOSTIC_AUTHORIZATION_DENIED");
    const work = await this.db.oicEvaluationWorkItem.findFirst({
      where: { id: workItemId, runId: "72959ad6-8a2a-42da-abd1-0b671c5d05a9", applicationId: "7f25c69e-bdbb-4949-ad7b-ef6412119850" },
      select: { id: true, applicationId: true, tenantId: true, runId: true, caseExecutionId: true, status: true, attemptCount: true, maxAttempts: true, leaseGeneration: true, caseExecution: { select: { id: true, caseRevisionId: true, repetitionOrdinal: true } } }
    });
    if (!work || work.status !== "FAILED") throw new EvaluationWorkerFailure("DIAGNOSTIC_WORK_ITEM_INELIGIBLE");
    if (actor.applicationId && actor.applicationId !== work.applicationId && !actor.scopes.includes("oic:foundation:admin")) throw new EvaluationWorkerFailure("DIAGNOSTIC_SCOPE_DENIED");
    const run = await this.db.oicEvaluationRun.findFirst({
      where: { id: work.runId, applicationId: work.applicationId, tenantId: work.tenantId },
      include: { manifest: { select: { id: true, payload: true, releaseId: true } } }
    });
    const protocol = record(run?.manifest?.payload);
    const cohort = record(protocol?.cohort);
    const slots: JsonObject[] = Array.isArray(cohort?.slots) ? cohort.slots.map((value: unknown) => record(value) ?? {}) : [];
    const slot = slots.find((value) => value.caseRevisionId === work.caseExecution.caseRevisionId && value.repetitionOrdinal === work.caseExecution.repetitionOrdinal);
    const generation = await this.db.oicEvaluationRecoveryGeneration.findFirst({ where: { workItemId: work.id }, orderBy: { generationOrdinal: "desc" }, select: { id: true, generationOrdinal: true, status: true, usedPhysicalAttempts: true, maxPhysicalAttempts: true } });
    const sourceAttempt = await this.db.oicEvaluationAttempt.findFirst({ where: { caseExecutionId: work.caseExecutionId }, orderBy: { attemptOrdinal: "desc" }, select: { id: true, attemptOrdinal: true, status: true, recoveryGenerationId: true, recoveryOrdinal: true, admissionId: true, providerAttemptId: true, providerDispatchStartedAt: true } });
    if (!run?.manifest || !slot || cohort?.cohortKey !== "packet76-cohort-20261016-v1" || work.caseExecution.repetitionOrdinal !== 2
      || !generation || ![1, 2, 3].includes(generation.generationOrdinal) || generation.status !== "EXHAUSTED" || generation.usedPhysicalAttempts !== 3 || generation.maxPhysicalAttempts !== 3
      || work.attemptCount !== work.maxAttempts || work.maxAttempts !== 5 + generation.generationOrdinal * 3
      || !sourceAttempt || sourceAttempt.status !== "INFRA_FAILURE" || sourceAttempt.recoveryGenerationId !== generation.id || sourceAttempt.recoveryOrdinal !== 3
      || sourceAttempt.admissionId || sourceAttempt.providerAttemptId || sourceAttempt.providerDispatchStartedAt) throw new EvaluationWorkerFailure("DIAGNOSTIC_SOURCE_STATE_INVALID");
    const diagnosticId = randomUUID();
    const diagnosticRunId = randomUUID();
    const diagnosticCaseId = randomUUID();
    const retryPolicy = record(protocol?.retryPolicy);
    const maxAttempts = Number(retryPolicy?.maxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 32 || !run?.manifest) throw new EvaluationWorkerFailure("DIAGNOSTIC_PROTOCOL_INVALID");
    await this.db.$transaction(async (tx) => {
      await tx.oicEvaluationPreflightDiagnostic.create({ data: {
        id: diagnosticId, applicationId: work.applicationId, tenantId: work.tenantId, runId: work.runId,
        workItemId: work.id, caseExecutionId: work.caseExecutionId, sourceAttemptId: sourceAttempt.id,
        manifestId: run.manifest.id, releaseId: run.manifest.releaseId, cohortKey: String(cohort.cohortKey),
        pairKey: String(slot.pairKey), repetitionOrdinal: work.caseExecution.repetitionOrdinal, initiatedByPrincipalId: actor.id,
        status: "RUNNING", failingStage: "QUEUE_ENQUEUE"
      } });
      await tx.oicEvaluationRun.create({ data: {
        id: diagnosticRunId, applicationId: run.applicationId, tenantId: run.tenantId, campaignId: run.campaignId,
        manifestId: run.manifestId, targetClass: run.targetClass, targetFingerprint: run.targetFingerprint,
        targetIdentity: run.targetIdentity as Prisma.InputJsonValue, requestHash: run.requestHash,
        plannedTrials: 1, plannedDenominator: 1, status: "QUEUED", verificationTier: "OIC_EXECUTED_PARTIAL",
        createdBy: actor.id, idempotencyKey: `packet76-queue-diagnostic:${diagnosticId}`,
        budgetReservationOiu: run.budgetReservationOiu ? run.budgetReservationOiu.minus(run.budgetReleasedOiu) : null,
        diagnosticOnly: true, diagnosticSourceRunId: run.id
      } });
      await tx.oicEvaluationCaseExecution.create({ data: {
        id: diagnosticCaseId, runId: diagnosticRunId, caseRevisionId: work.caseExecution.caseRevisionId,
        repetitionOrdinal: work.caseExecution.repetitionOrdinal, seed: `diag-${diagnosticId}`
      } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: work.applicationId, tenantId: work.tenantId, action: "evaluation.packet76.real_queue_diagnostic.started", targetType: "evaluation-preflight-diagnostic", targetId: diagnosticId, metadata: { sourceRunId: work.runId, sourceWorkItemId: work.id, sourceAttemptId: sourceAttempt.id, diagnosticRunId, diagnosticCaseExecutionId: diagnosticCaseId, recoveryGenerationId: generation.id, cohortKey: String(cohort.cohortKey), pairKey: String(slot.pairKey), repetitionOrdinal: work.caseExecution.repetitionOrdinal, executionMode: "DIAGNOSTIC", admissionCreated: false, providerAttemptCreated: false, providerDispatchStarted: false } } });
    });
    const queued = await this.queue.enqueueCase({ applicationId: work.applicationId, tenantId: work.tenantId, runId: diagnosticRunId, caseExecutionId: diagnosticCaseId, maxAttempts, executionMode: "DIAGNOSTIC", diagnosticProbeId: diagnosticId });
    await this.db.oicEvaluationPreflightDiagnostic.update({ where: { id: diagnosticId }, data: { queueRunId: diagnosticRunId, queueWorkItemId: queued.id, queueCaseExecutionId: diagnosticCaseId } });
    for (let i = 0; i < 120; i += 1) {
      const result = await this.db.oicEvaluationPreflightDiagnostic.findUnique({ where: { id: diagnosticId }, select: { id: true, status: true, lastCompletedStage: true, failingStage: true, safeErrorCode: true, safeErrorType: true, safeErrorMessage: true, errorFingerprint: true, result: true, startedAt: true, completedAt: true, queueRunId: true, queueWorkItemId: true, queueCaseExecutionId: true, workerAttemptId: true, leaseOwner: true, claimedAt: true, leaseAcquiredAt: true, leaseHeartbeatCount: true } });
      if (!result) throw new EvaluationWorkerFailure("DIAGNOSTIC_RESULT_UNAVAILABLE");
      if (["READY", "FAILED"].includes(result.status)) return result;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const pending = await this.db.oicEvaluationPreflightDiagnostic.findUnique({ where: { id: diagnosticId }, select: { id: true, status: true, lastCompletedStage: true, failingStage: true, startedAt: true, completedAt: true, queueRunId: true, queueWorkItemId: true, queueCaseExecutionId: true, workerAttemptId: true, leaseOwner: true, claimedAt: true, leaseAcquiredAt: true, leaseHeartbeatCount: true } });
    if (!pending) throw new EvaluationWorkerFailure("DIAGNOSTIC_RESULT_UNAVAILABLE");
    return pending;
  }

  private async executeLease(lease: EvaluationWorkLease, workerAttestationGeneration?: number): Promise<"SUCCEEDED" | "FAILED"> {
    let activeLease = lease;
    let renewing = false;
    const failureContext: PreflightDiagnosticContext = lease.executionMode === "DIAGNOSTIC" && lease.diagnosticProbeId
      ? { id: lease.diagnosticProbeId, stage: "WORK_ITEM_LOAD", lastCompletedStage: null, stopBeforeAdmission: true }
      : { stage: "WORK_ITEM_LOAD", lastCompletedStage: null };
    const cancellation = new AbortController();
    const renewalTimer = setInterval(() => {
      if (renewing || cancellation.signal.aborted) return;
      renewing = true;
      const heartbeatDeadline = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("lease renewal deadline exceeded")), 12_000));
      void Promise.race([this.queue.renew(activeLease, LEASE_MS), heartbeatDeadline]).then((leaseUntil) => {
        activeLease = { ...activeLease, leaseUntil };
      }).catch(() => cancellation.abort(new Error("lease lost"))).finally(() => { renewing = false; });
    }, 30_000);
    try {
      await this.executeRuntimeTarget(activeLease, cancellation, workerAttestationGeneration, failureContext);
      if (activeLease.executionMode === "DIAGNOSTIC") await this.queue.completeDiagnostic(activeLease);
      return "SUCCEEDED";
    } catch (error) {
      const hasModelResolutionDiagnostic = error instanceof OicRuntimeException
        && (error as OicRuntimeException & { safeModelResolutionDiagnostic?: unknown }).safeModelResolutionDiagnostic !== undefined;
      const failureClass = hasModelResolutionDiagnostic ? "MODEL_RESOLUTION_FAILURE"
        : error instanceof EvaluationWorkerFailure ? error.failureClass : error instanceof OicRuntimeException ? (["EXHAUSTED", "UNKNOWN_BOUND"].includes(error.code) ? "BUDGET_BLOCKED" : error.code) : "EVALUATION_WORKER_FAILURE";
      const diagnostic = safeWorkerDiagnostic(error, failureContext.stage);
      try { await this.queue.failTerminal(activeLease, failureClass, diagnostic); }
      catch { return "FAILED"; }
      if (activeLease.diagnosticProbeId) await this.db.oicEvaluationPreflightDiagnostic.update({ where: { id: activeLease.diagnosticProbeId }, data: {
        status: "FAILED", lastCompletedStage: failureContext.lastCompletedStage, failingStage: failureContext.stage,
        safeErrorCode: diagnostic.code, safeErrorType: diagnostic.type, safeErrorMessage: diagnostic.message,
        errorFingerprint: diagnostic.fingerprint, completedAt: new Date(), result: { failureComponent: diagnostic.component, safeStackFrame: diagnostic.stackFrame, ...(diagnostic.details ? { operationDiagnostic: diagnostic.details } : {}), admissionCreated: false, providerAttemptCreated: false, providerDispatchStarted: false } as Prisma.InputJsonObject
      } });
      return "FAILED";
    } finally {
      clearInterval(renewalTimer);
    }
  }

  private async executeRuntimeTarget(lease: EvaluationWorkLease, cancellation: AbortController, workerAttestationGeneration?: number, diagnostic?: PreflightDiagnosticContext): Promise<void> {
    const stage = async (value: string) => {
      if (!diagnostic) return;
      if (diagnostic.stage !== value) diagnostic.lastCompletedStage = diagnostic.stage;
      diagnostic.stage = value;
      if (diagnostic.id) await this.db.oicEvaluationPreflightDiagnostic.update({ where: { id: diagnostic.id }, data: { lastCompletedStage: diagnostic.lastCompletedStage, failingStage: value } });
    };
    if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT");
    await stage("WORK_ITEM_LOAD");
    const run = await this.db.oicEvaluationRun.findUnique({
      where: { id: lease.runId },
      include: { manifest: { include: { release: { select: { id: true, status: true, compromisedAt: true, manifestDigest: true, caseManifest: true, environment: { select: { id: true, definitionDigest: true, definition: true } } } } } } }
    });
    await stage("RELEASE_RESOLUTION");
    const diagnosticRunStatusValid = !!run?.diagnosticOnly && lease.executionMode === "DIAGNOSTIC"
      ? ["QUEUED", "RUNNING"].includes(run.status)
      : ["PARTIAL", "FAILED"].includes(run?.status ?? "");
    if (!run || (!diagnostic?.stopBeforeAdmission && !["QUEUED", "RUNNING", "CANCEL_PENDING"].includes(run.status))
      || (diagnostic?.stopBeforeAdmission && !diagnosticRunStatusValid)
      || run.manifest.release.status !== "PUBLISHED" || run.manifest.release.compromisedAt) throw new EvaluationWorkerFailure("RUN_PROTOCOL_INVALID");
    if (run.targetClass !== "MODEL_WITH_OIC_RUNTIME" || run.manifest.targetClass !== run.targetClass) throw new EvaluationWorkerFailure("TARGET_CLASS_UNSUPPORTED");
    if (run.manifest.canonicalDigest !== sha256(run.manifest.payload)) throw new EvaluationWorkerFailure("PROTOCOL_DIGEST_INVALID");
    if (sha256(run.targetIdentity) !== run.targetFingerprint) throw new EvaluationWorkerFailure("TARGET_FINGERPRINT_INVALID");

    await stage("PROTOCOL_RESOLUTION");
    const protocol = record(run.manifest.payload);
    const budget = record(protocol?.budgetPolicy);
    const retry = record(protocol?.retryPolicy);
    const requiredCapabilities = protocol?.requiredCapabilities;
    if (!protocol || !budget || !retry || !Array.isArray(requiredCapabilities) || requiredCapabilities.some((item) => typeof item !== "string")) throw new EvaluationWorkerFailure("PROTOCOL_POLICY_INVALID");
    await stage("EPM_RESOLUTION");
    if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT_PROTOCOL");
    if (this.config.get<string>("OIC_ADMISSION_MODE") !== "ENFORCE" || !run.campaignId || !run.budgetReservationOiu) throw new EvaluationWorkerFailure("HARD_BUDGET_ENFORCEMENT_REQUIRED");
    const campaign = await this.db.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId, status: "ACTIVE" }, select: { status: true, budgetLimitOiu: true, budgetRevisionId: true, budgetPolicyDigest: true, reservationPerAttemptOiu: true, reservedOiu: true, budgetRevision: { select: { status: true, sourceDigest: true, applicationId: true, tenantId: true, planRevisionId: true, unit: true, enforcement: true, amount: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true, reservationUpperBound: true } } } });
    const now = new Date();
    const cohortBasis = record(protocol.cohort);
      const supplementRunId = run.diagnosticOnly ? run.diagnosticSourceRunId ?? run.id : run.id;
      const activeSupplement = cohortBasis?.cohortKey === "packet76-cohort-20261016-v1" && campaign?.budgetRevisionId
      ? await this.db.oicEvaluationCapacityExtension.findFirst({
        where: { applicationId: run.applicationId, tenantId: run.tenantId, campaignId: run.campaignId, runId: supplementRunId, baseBudgetRevisionId: campaign.budgetRevisionId, cohortKey: cohortBasis.cohortKey, status: "ACTIVE", expiresAt: { gt: now } },
        select: { id: true, authorizedOiu: true, perAdmissionLimitOiu: true, budgetRevision: { select: { status: true, unit: true, enforcement: true, unknownLiabilityRule: true, effectiveFrom: true, effectiveTo: true, reservationUpperBound: true } } }
      })
      : null;
    const baseExpired = !!campaign?.budgetRevision?.effectiveTo && campaign.budgetRevision.effectiveTo <= now;
    if (!campaign?.budgetRevision || !campaign.reservationPerAttemptOiu || campaign.budgetRevision.status !== "PUBLISHED" || campaign.budgetRevision.effectiveFrom > now || (baseExpired && !activeSupplement)
      || campaign.budgetRevisionId !== budget.budgetRevisionId || campaign.budgetPolicyDigest !== budget.budgetRevisionDigest || campaign.budgetRevision.sourceDigest !== budget.budgetRevisionDigest
      || campaign.reservationPerAttemptOiu.toString() !== budget.reservationUpperBoundOiu || !campaign.budgetRevision.reservationUpperBound?.equals(campaign.reservationPerAttemptOiu)
      || run.budgetReservationOiu.minus(run.budgetReleasedOiu).gt(campaign.reservedOiu)
      || (activeSupplement && (activeSupplement.authorizedOiu.toString() !== "1536" || activeSupplement.perAdmissionLimitOiu.toString() !== "256"
        || activeSupplement.budgetRevision.status !== "PUBLISHED" || activeSupplement.budgetRevision.unit !== "OIU" || activeSupplement.budgetRevision.enforcement !== "HARD"
        || activeSupplement.budgetRevision.unknownLiabilityRule !== "DENY" || activeSupplement.budgetRevision.effectiveFrom > now
        || (activeSupplement.budgetRevision.effectiveTo && activeSupplement.budgetRevision.effectiveTo <= now)
        || !activeSupplement.budgetRevision.reservationUpperBound?.equals(activeSupplement.perAdmissionLimitOiu)))) throw new EvaluationWorkerFailure("CAMPAIGN_HARD_BUDGET_INVALID");
    if (protocol.releaseDigest !== run.manifest.release.manifestDigest || !Array.isArray(protocol.caseSchedule)) throw new EvaluationWorkerFailure("PROTOCOL_RELEASE_MISMATCH");
    const environment = record(protocol.environment);
    if (!environment || !run.manifest.release.environment || environment.revisionId !== run.manifest.release.environment.id || environment.digest !== run.manifest.release.environment.definitionDigest) throw new EvaluationWorkerFailure("PROTOCOL_ENVIRONMENT_MISMATCH");
    if (protocol.targetFingerprint !== run.targetFingerprint || !record(protocol.targetIdentity) || sha256(protocol.targetIdentity) !== run.targetFingerprint) throw new EvaluationWorkerFailure("TARGET_PROTOCOL_MISMATCH");
    const environmentDefinition = record(run.manifest.release.environment.definition);
    if (environmentDefinition?.kind !== "DETERMINISTIC_REFERENCE" && environmentDefinition?.kind !== "EXECUTABLE_SHELL_V1") throw new EvaluationWorkerFailure("ENVIRONMENT_ADAPTER_UNAVAILABLE");
    const executable = environmentDefinition?.kind === "EXECUTABLE_SHELL_V1";
    const supported = new Set(["MODEL_WITH_OIC_RUNTIME", "TEXT_GENERATION", "OIC6_ADMISSION", "PINNED_PROVIDER_TARGET", "EXECUTABLE_SANDBOX", "SHELL_SCRIPT_V1"]);
    if ((requiredCapabilities as string[]).some((capability) => !supported.has(capability))) throw new EvaluationWorkerFailure("REQUIRED_CAPABILITY_UNSUPPORTED");
    if (executable !== ((requiredCapabilities as string[]).includes("EXECUTABLE_SANDBOX") && (requiredCapabilities as string[]).includes("SHELL_SCRIPT_V1"))) throw new EvaluationWorkerFailure("REQUIRED_CAPABILITY_UNSUPPORTED");
    let sandboxImage: string | null = null;
    if (executable) {
      if (!this.sandbox || typeof environmentDefinition.imageDigest !== "string" || !record(protocol.sandboxEnvironment)) throw new EvaluationWorkerFailure("SANDBOX_POLICY_UNAVAILABLE");
      try {
        const current = await this.sandbox.preflight(environmentDefinition.imageDigest);
        if (sha256(current) !== sha256(protocol.sandboxEnvironment)) throw new EvaluationWorkerFailure("SANDBOX_ENVIRONMENT_CHANGED");
      } catch (error) {
        if (error instanceof EvaluationWorkerFailure) throw error;
        throw new EvaluationWorkerFailure(error instanceof SandboxUnavailableError && error.reasonCode === "POLICY_UNAVAILABLE" ? "SANDBOX_POLICY_UNAVAILABLE" : "SANDBOX_UNAVAILABLE");
      }
      sandboxImage = environmentDefinition.imageDigest;
    } else if (protocol.sandboxEnvironment !== "NONE") throw new EvaluationWorkerFailure("PROTOCOL_ENVIRONMENT_MISMATCH");
    if (!Number.isInteger(budget.maxOutputUnits) || (budget.maxOutputUnits as number) < 1 || (budget.maxOutputUnits as number) > 65_536 || (budget.maxInputUnits !== undefined && (!Number.isInteger(budget.maxInputUnits) || (budget.maxInputUnits as number) < 1 || (budget.maxInputUnits as number) > 1_000_000)) || !Number.isInteger(budget.maxExecutionMs) || (budget.maxExecutionMs as number) < 1_000 || (budget.maxExecutionMs as number) > 300_000 || !Number.isInteger(retry.maxAttempts) || (retry.maxAttempts as number) < 1 || (retry.maxAttempts as number) > 32) throw new EvaluationWorkerFailure("PROTOCOL_BUDGET_INVALID");
    const runtimeMaximum = this.config.get<number>("OIC_RUNTIME_MAX_EXECUTION_MS") ?? 60_000;
    if ((budget.maxExecutionMs as number) > runtimeMaximum) throw new EvaluationWorkerFailure("PROTOCOL_BUDGET_EXCEEDS_RUNTIME_POLICY");

    await stage("COHORT_SLOT_RESOLUTION");
    const work = await this.db.oicEvaluationWorkItem.findUnique({ where: { id: lease.workItemId }, select: { maxAttempts: true, attemptCount: true, status: true, executionMode: true, diagnosticProbeId: true } });
    const execution = await this.db.oicEvaluationCaseExecution.findUnique({ where: { id: lease.caseExecutionId }, select: { id: true, runId: true, caseRevisionId: true, repetitionOrdinal: true } });
    if (!execution || execution.runId !== run.id) throw new EvaluationWorkerFailure("CASE_EXECUTION_SCOPE_INVALID");
    if (!work) throw new EvaluationWorkerFailure("RETRY_POLICY_MISMATCH");
    if (lease.executionMode === "DIAGNOSTIC") {
      const cohort = record(protocol.cohort);
      const slots: JsonObject[] = Array.isArray(cohort?.slots) ? cohort.slots.map((value: unknown) => record(value) ?? {}) : [];
      if (cohort?.cohortKey !== "packet76-cohort-20261016-v1" || !slots.some((item) => item.caseRevisionId === execution.caseRevisionId && item.repetitionOrdinal === execution.repetitionOrdinal)
        || !run.diagnosticOnly || run.diagnosticSourceRunId === null || work.executionMode !== "DIAGNOSTIC" || work.diagnosticProbeId !== lease.diagnosticProbeId) throw new EvaluationWorkerFailure("DIAGNOSTIC_WORK_ITEM_INVALID");
    } else if (work.maxAttempts >= 8) {
      await stage("RECOVERY_CONTEXT");
      const cohort = record(protocol.cohort);
      const slots: JsonObject[] = Array.isArray(cohort?.slots) ? cohort.slots.map((value: unknown) => record(value) ?? {}) : [];
      const slot = slots.find((item) => item.caseRevisionId === execution.caseRevisionId && item.repetitionOrdinal === execution.repetitionOrdinal);
      const currentRecoveryAttempt = await this.db.oicEvaluationAttempt.findUnique({ where: { id: lease.attemptId }, select: { recoveryGenerationId: true, recoveryOrdinal: true, providerAttemptId: true, providerDispatchStartedAt: true } });
      const generation = currentRecoveryAttempt?.recoveryGenerationId ? await this.db.oicEvaluationRecoveryGeneration.findUnique({ where: { id: currentRecoveryAttempt.recoveryGenerationId } }) : null;
      const previousGenerationAttempt = generation ? await this.db.oicEvaluationAttempt.findUnique({ where: { id: generation.previousAttemptId }, select: { id: true, attemptOrdinal: true } }) : null;
      const previousAttemptOrdinal = previousGenerationAttempt?.attemptOrdinal ?? 0;
      const historical = await this.db.oicEvaluationAttempt.findMany({ where: { caseExecutionId: execution.id, attemptOrdinal: { lte: previousAttemptOrdinal } }, orderBy: { attemptOrdinal: "asc" }, select: { id: true, attemptOrdinal: true, status: true, admissionId: true, providerAttemptId: true, providerDispatchStartedAt: true, artifactManifest: true, evidenceDigest: true } });
      await stage("LEASE_VALIDATION");
      const validGenerationState = generation?.status === "ACTIVE" || (diagnostic?.stopBeforeAdmission && generation?.status === "EXHAUSTED");
      if (!cohort || cohort.cohortKey !== "packet76-cohort-20261016-v1" || !slot || !generation || !validGenerationState
        || generation.runId !== run.id || generation.applicationId !== run.applicationId || generation.tenantId !== run.tenantId
        || generation.cohortKey !== cohort.cohortKey || generation.pairKey !== slot.pairKey || generation.repetitionOrdinal !== execution.repetitionOrdinal
        || ![1, 2, 3].includes(generation.generationOrdinal) || generation.maxPhysicalAttempts !== 3 || generation.usedPhysicalAttempts < 1 || generation.usedPhysicalAttempts > 3
        || !previousGenerationAttempt || work.maxAttempts !== previousAttemptOrdinal + 3 || work.attemptCount !== previousAttemptOrdinal + generation.usedPhysicalAttempts || lease.attemptOrdinal !== work.attemptCount
        || currentRecoveryAttempt?.recoveryGenerationId !== generation.id || currentRecoveryAttempt.recoveryOrdinal !== generation.usedPhysicalAttempts
        || currentRecoveryAttempt.providerAttemptId || currentRecoveryAttempt.providerDispatchStartedAt
        || (diagnostic?.stopBeforeAdmission && (work.status !== "FAILED" || generation.status !== "EXHAUSTED" || generation.usedPhysicalAttempts !== 3))
        || historical.length !== previousAttemptOrdinal || historical.some((attempt, index) => attempt.attemptOrdinal !== index + 1 || attempt.providerAttemptId || attempt.providerDispatchStartedAt || attempt.artifactManifest || attempt.evidenceDigest)
        || historical.at(-1)?.id !== generation.previousAttemptId) throw new EvaluationWorkerFailure("PACKET76_RECOVERY_GENERATION_INVALID");
      for (const attempt of historical) {
        if (!attempt.admissionId) continue;
        const admission = await this.db.oicAdmission.findFirst({ where: { id: attempt.admissionId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { status: true } });
        if (admission?.status !== "RELEASED" || await this.db.oicProviderAttempt.count({ where: { admissionId: attempt.admissionId } }) !== 0) throw new EvaluationWorkerFailure("PACKET76_RECOVERY_HISTORY_UNRESOLVED");
      }
    } else if (run.id === "733615b4-15c7-42a9-a247-1e24b4218ae7" && work.maxAttempts >= 2 && work.maxAttempts <= 3 && work.attemptCount === work.maxAttempts) {
      const [resumeMarkers, physicalAttempts] = await Promise.all([
        this.db.oicAuditEvent.findMany({ where: { applicationId: run.applicationId, action: "evaluation.packet76.successor.pre_dispatch_resumed", targetType: "evaluation-case", targetId: execution.id }, select: { requestId: true, metadata: true } }),
        this.db.oicEvaluationAttempt.findMany({ where: { caseExecutionId: execution.id }, orderBy: { attemptOrdinal: "asc" }, select: { id: true, attemptOrdinal: true, status: true, failureClass: true, failureStage: true, lastDurableStage: true, safeErrorCode: true, admissionId: true, providerAttemptId: true, providerDispatchStartedAt: true, artifactManifest: true, evidenceDigest: true, recoveryGenerationId: true } })
      ]);
      const resumeHistoryValid = packet76SuccessorResumeHistoryEligible({
        runId: run.id, manifestId: run.manifest.id, campaignId: run.campaignId, applicationId: run.applicationId,
        cohortKey: record(protocol.cohort)?.cohortKey, caseExecutionId: execution.id, workStatus: work.status,
        workAttemptCount: work.attemptCount, workMaxAttempts: work.maxAttempts, currentAttemptId: lease.attemptId,
        attempts: physicalAttempts.map((item) => ({ ...item, artifactManifestPresent: item.artifactManifest !== null, evidenceDigestPresent: item.evidenceDigest !== null, repetitionOrdinal: execution.repetitionOrdinal })),
        resumeMarkers
      });
      if (!resumeHistoryValid) throw new EvaluationWorkerFailure("PACKET76_SUCCESSOR_RESUME_HISTORY_INVALID");
    } else if (work.maxAttempts !== retry.maxAttempts) {
      const cohort = record(protocol.cohort);
      if (!cohort) throw new EvaluationWorkerFailure("PACKET76_CONTINGENCY_AUTHORIZATION_INVALID");
      const slots: JsonObject[] = Array.isArray(cohort.slots) ? cohort.slots.map((value: unknown) => record(value) ?? {}) : [];
      const slot = slots.find((item) => item.caseRevisionId === execution.caseRevisionId && item.repetitionOrdinal === execution.repetitionOrdinal);
      const markers = await this.db.oicAuditEvent.findMany({ where: { applicationId: run.applicationId, action: "evaluation.case.contingency.requested", targetType: "evaluation-case", targetId: execution.id }, select: { metadata: true } });
      const cohortMarkers = markers.filter((item) => (record(item.metadata) ?? {}).cohortKey === cohort.cohortKey);
      const priorAttempts = await this.db.oicEvaluationAttempt.findMany({ where: { caseExecutionId: execution.id }, orderBy: { attemptOrdinal: "asc" }, select: { id: true, attemptOrdinal: true, status: true, failureClass: true, admissionId: true, evidenceDigest: true, artifactManifest: true, budgetReconciledAt: true, budgetReleasedOiu: true } });
      const original = priorAttempts.find((item) => item.id !== lease.attemptId);
      const admission = original?.admissionId ? await this.db.oicAdmission.findFirst({ where: { id: original.admissionId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { status: true } }) : null;
      const providerAttemptCount = original?.admissionId ? await this.db.oicProviderAttempt.count({ where: { admissionId: original.admissionId } }) : 1;
      const bound = run.campaignId ? await this.db.oicEvaluationCampaign.findFirst({ where: { id: run.campaignId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { reservationPerAttemptOiu: true } }) : null;
      const marker = cohortMarkers[0] ? record(cohortMarkers[0].metadata) ?? {} : {};
      const recoveryCount = work.maxAttempts - Number(retry.maxAttempts) - 1;
      const expectedAttemptCount = Number(retry.maxAttempts) + 1 + recoveryCount;
      const infraRetries = await this.db.oicAuditEvent.findMany({ where: { applicationId: run.applicationId, action: "evaluation.case.contingency.infrastructure_requeued", targetType: "evaluation-case", targetId: execution.id }, select: { metadata: true } });
      let infraRetryValid = recoveryCount >= 0 && recoveryCount <= 2 && infraRetries.length === recoveryCount;
      for (let index = 0; infraRetryValid && index < recoveryCount; index += 1) {
        const recovery = record(infraRetries[index]!.metadata) ?? {};
        const previous = priorAttempts.find((item) => item.attemptOrdinal === Number(retry.maxAttempts) + 1 + index);
        const previousAdmission = previous?.admissionId ? await this.db.oicAdmission.findFirst({ where: { id: previous.admissionId, applicationId: run.applicationId, tenantId: run.tenantId }, select: { status: true } }) : null;
        const previousProviderAttempts = previous?.admissionId ? await this.db.oicProviderAttempt.count({ where: { admissionId: previous.admissionId } }) : 1;
        infraRetryValid = recovery.cohortKey === cohort.cohortKey && recovery.pairKey === slot?.pairKey && recovery.repetitionOrdinal === execution.repetitionOrdinal
          && typeof recovery.failedAttemptId === "string" && recovery.failedAttemptId === previous?.id && recovery.admissionId === previous?.admissionId && recovery.providerAttemptCount === 0
          && previous?.status === "INFRA_FAILURE" && previous.failureClass === "RUNTIME_UNAVAILABLE" && !previous.evidenceDigest && !previous.artifactManifest
          && !!previous.budgetReconciledAt && !!bound?.reservationPerAttemptOiu?.equals(previous.budgetReleasedOiu)
          && previousAdmission?.status === "RELEASED" && previousProviderAttempts === 0;
      }
      if (work.maxAttempts !== expectedAttemptCount || work.attemptCount !== expectedAttemptCount || !infraRetryValid || cohortMarkers.length !== 1 || cohortMarkers[0]?.metadata === null || !slot || markers.length !== 1
        || marker.pairKey !== slot.pairKey || marker.repetitionOrdinal !== execution.repetitionOrdinal || typeof marker.originalAttemptId !== "string"
        || !original || original.id !== marker.originalAttemptId || original.attemptOrdinal !== retry.maxAttempts || original.status !== "INFRA_FAILURE" || original.failureClass !== "RUNTIME_UNAVAILABLE"
        || original.evidenceDigest || original.artifactManifest || !original.budgetReconciledAt || !bound?.reservationPerAttemptOiu?.equals(original.budgetReleasedOiu)
        || admission?.status !== "RELEASED" || providerAttemptCount !== 0) throw new EvaluationWorkerFailure("PACKET76_CONTINGENCY_AUTHORIZATION_INVALID");
      const allContingencies = await this.db.oicAuditEvent.findMany({ where: { applicationId: run.applicationId, action: "evaluation.case.contingency.requested", targetType: "evaluation-case" }, select: { metadata: true } });
      if (allContingencies.filter((item) => (record(item.metadata) ?? {}).cohortKey === cohort.cohortKey).length !== 1) throw new EvaluationWorkerFailure("PACKET76_CONTINGENCY_ALREADY_USED");
    }
    if (!protocol.caseSchedule.includes(execution.caseRevisionId)) throw new EvaluationWorkerFailure("CASE_PLAN_MISMATCH");
    if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT_CASE");
    await stage("REPETITION_RESOLUTION");
    const caseRevision = await this.db.oicEvaluationCaseRevision.findFirst({ where: { id: execution.caseRevisionId, applicationId: run.applicationId, tenantId: run.tenantId, status: "PUBLISHED" } });
    if (!caseRevision || !EXPOSURE_TIERS.has(caseRevision.exposureTier)) throw new EvaluationWorkerFailure("CASE_REVISION_UNAVAILABLE");
    await stage("RELEASE_RESOLUTION");
    const releaseCase = Array.isArray(run.manifest.release.caseManifest) ? run.manifest.release.caseManifest.map(record).find((item) => item?.caseRevisionId === execution.caseRevisionId) : null;
    if (!releaseCase || releaseCase.contentHash !== caseRevision.sourceDigest || releaseCase.oracleHash !== caseRevision.oracleDigest || releaseCase.exposureTier !== caseRevision.exposureTier) throw new EvaluationWorkerFailure("CASE_RELEASE_MISMATCH");

    const input = record(caseRevision.inputArtifact);
    const referenceKey = caseRevision.exposureTier === "PRIVATE_HOLDOUT" || caseRevision.exposureTier === "PROTECTED_CERTIFICATION" ? "encryptedArtifactId" : "artifactId";
    const inputArtifactId = input?.[referenceKey];
    if (!input || typeof inputArtifactId !== "string" || !UUID.test(inputArtifactId) || input.digest !== caseRevision.sourceDigest) throw new EvaluationWorkerFailure("INPUT_ARTIFACT_REFERENCE_INVALID");
    if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT_ARTIFACT");
    await stage("ARTIFACT_RESOLUTION");
    const source = await this.artifacts.read(inputArtifactId, { applicationId: run.applicationId, tenantId: run.tenantId, purpose: "INPUT", exposureTier: caseRevision.exposureTier });
    if (createHash("sha256").update(source).digest("hex") !== caseRevision.sourceDigest) throw new EvaluationWorkerFailure("INPUT_ARTIFACT_DIGEST_MISMATCH");
    if (budget.maxInputUnits !== undefined && source.byteLength > (budget.maxInputUnits as number)) throw new EvaluationWorkerFailure("INPUT_BUDGET_EXCEEDED");
    const prompt = source.toString("utf8");
    if (!Buffer.from(prompt, "utf8").equals(source) || prompt.length > 200_000) throw new EvaluationWorkerFailure("INPUT_ARTIFACT_ENCODING_UNSUPPORTED");
    const candidateInstruction = candidateInstructionFromProtocol(protocol);
    if (budget.maxInputUnits !== undefined && source.byteLength + Buffer.byteLength(typeof candidateInstruction === "string" ? candidateInstruction : "", "utf8") > (budget.maxInputUnits as number) * 4) throw new EvaluationWorkerFailure("INPUT_BUDGET_EXCEEDED");
    if (record(protocol.cohort)?.cohortKey !== undefined) {
      await stage("TOKEN_PREFLIGHT");
      const preflight = estimatePacket76Input([prompt, ...(typeof candidateInstruction === "string" ? [candidateInstruction] : [])]);
      if (!preflight.valid) throw new EvaluationWorkerFailure(`PACKET76_INPUT_PREFLIGHT_${preflight.reasonCodes[0] ?? "INVALID"}`);
    }

    await stage("TARGET_RESOLUTION");
    const target = parseTarget(run.targetIdentity);
    if (protocol.cohort !== undefined) {
      const { providerConnectionId, providerKey, upstreamModelRef } = target.resolvedTarget;
      if (typeof providerConnectionId !== "string" || typeof providerKey !== "string" || typeof upstreamModelRef !== "string") throw new EvaluationWorkerFailure("TARGET_IDENTITY_INVALID");
      if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT_ECONOMICS");
      await stage("ECONOMIC_POLICY_RESOLUTION");
      await this.assertPacket76EconomicCoverage(run.applicationId, run.tenantId, providerConnectionId, providerKey, upstreamModelRef);
    }
    await stage("APPLICATION_SCOPE");
    if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT_PRINCIPAL");
    const principal = await this.db.oicServicePrincipal.findFirst({
      where: { id: target.runtimePrincipalId, applicationId: run.applicationId, status: "ACTIVE" },
      include: {
        scopes: { where: { revokedAt: null }, select: { scope: true } },
        tenantGrants: { where: { revokedAt: null }, include: { tenant: { select: { status: true } } } }
      }
    });
    const scopes = principal?.scopes.map((grant) => grant.scope) ?? [];
    if (!principal || scopes.length !== 1 || scopes[0] !== "oic:runtime:invoke") throw new EvaluationWorkerFailure("RUNTIME_PRINCIPAL_UNAVAILABLE");
    const tenantIds = principal.tenantGrants.filter((grant) => grant.tenant.status === "ACTIVE").map((grant) => grant.tenantId);
    if (run.tenantId && !tenantIds.includes(run.tenantId)) throw new EvaluationWorkerFailure("RUNTIME_TENANT_GRANT_REQUIRED");
    const actor: AuthenticatedPrincipal = { id: principal.id, applicationId: principal.applicationId, scopes, tenantIds };
    const request: OicRuntimeRequest = {
      model: target.modelId as OicRuntimeRequest["model"],
      input: [
        ...(typeof candidateInstruction === "string" ? [{ speaker: "instruction" as const, content: [{ type: "text" as const, text: candidateInstruction }] }] : []),
        { speaker: "user", content: [{ type: "text", text: prompt }] }
      ],
      ...(run.tenantId ? { tenant: { kind: "id", tenantId: run.tenantId } as const } : {}),
      maxOutputUnits: budget.maxOutputUnits as number
    };
    await stage("RUNTIME_CONTEXT");
    if (workerAttestationGeneration !== undefined && !await this.queue.ownsFreshWorkerSlot(lease.workerId, workerAttestationGeneration)) throw new EvaluationWorkerFailure("WORKER_READINESS_LOST");
    await stage("ORACLE_RESOLUTION");
    if (diagnostic?.stopBeforeAdmission && (!this.sealedOracle || !this.outbox?.readiness().ready)) throw new EvaluationWorkerFailure("SEALED_ORACLE_UNAVAILABLE");
    const timeout = setTimeout(() => cancellation.abort(new Error("evaluation target deadline exceeded")), budget.maxExecutionMs as number);
    try {
      if (cancellation.signal.aborted) throw new EvaluationWorkerFailure("WORKER_DEADLINE_EXCEEDED");
      await stage("ADMISSION_PREFLIGHT");
      if (!diagnostic?.id) await this.queue.recordLifecycle(lease, "PREFLIGHT_ADMISSION");
      const capacityExtension = record(protocol.cohort)?.cohortKey === "packet76-cohort-20261016-v1"
        ? await this.db.oicEvaluationCapacityExtension.findFirst({
          where: { applicationId: run.applicationId, tenantId: run.tenantId, runId: run.diagnosticOnly ? run.diagnosticSourceRunId ?? run.id : run.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
          select: { id: true }
        })
        : null;
      const packet76SuccessorBaseBudget = !!campaign?.budgetRevision && packet76SuccessorBaseBudgetEligible({
        runId: run.id, campaignId: run.campaignId, manifestId: run.manifestId, cohortKey: record(protocol.cohort)?.cohortKey,
        budgetRevisionId: budget.budgetRevisionId, budgetRevisionDigest: budget.budgetRevisionDigest,
        protocolBound: budget.reservationUpperBoundOiu, retryLimit: retry.maxAttempts, automaticRetry: retry.automaticRetry,
        applicationId: run.applicationId, tenantId: run.tenantId,
        campaignStatus: campaign.status, campaignBudgetRevisionId: campaign.budgetRevisionId ?? "",
        campaignLimit: campaign.budgetLimitOiu?.toString() ?? "", campaignPerAdmission: campaign.reservationPerAttemptOiu?.toString() ?? "",
        budgetStatus: campaign.budgetRevision.status, budgetApplicationId: campaign.budgetRevision.applicationId,
        budgetTenantId: campaign.budgetRevision.tenantId, budgetPlanRevisionId: campaign.budgetRevision.planRevisionId,
        budgetSourceDigest: campaign.budgetRevision.sourceDigest, budgetAmount: campaign.budgetRevision.amount.toString(),
        budgetUpperBound: campaign.budgetRevision.reservationUpperBound?.toString() ?? null,
        budgetUnit: campaign.budgetRevision.unit, budgetEnforcement: campaign.budgetRevision.enforcement,
        unknownLiabilityRule: campaign.budgetRevision.unknownLiabilityRule,
        budgetEffectiveFrom: campaign.budgetRevision.effectiveFrom, budgetEffectiveTo: campaign.budgetRevision.effectiveTo, now
      });
      if (record(protocol.cohort)?.cohortKey === "packet76-cohort-20261016-v1" && !capacityExtension && !packet76SuccessorBaseBudget) throw new EvaluationWorkerFailure("PACKET76_CAPACITY_EXTENSION_UNAVAILABLE");
      if (diagnostic?.stopBeforeAdmission && diagnostic.id) {
        if (!this.runtime.evaluationAdmissionAvailable() || this.config.get<string>("OIC_ADMISSION_MODE") !== "ENFORCE") throw new EvaluationWorkerFailure("HARD_BUDGET_ENFORCEMENT_REQUIRED");
        await stage("BINDING_RESOLUTION");
        const resolvedTarget = await this.runtime.describeEvaluationTarget(actor, request,
          { requestId: `evaluation-diagnostic-${diagnostic.id}`, traceId: `evaluation-preflight-${diagnostic.id}` },
          async (runtimeStage) => { await stage(runtimeStage); });
        if (!sameTarget(target.resolvedTarget, resolvedTarget) || resolvedTarget.modelId !== target.modelId) throw new EvaluationWorkerFailure("TARGET_RESOLUTION_MISMATCH");
        await stage("READY_FOR_ADMISSION");
        await this.db.oicEvaluationPreflightDiagnostic.update({ where: { id: diagnostic.id }, data: {
          status: "READY", lastCompletedStage: "READY_FOR_ADMISSION", failingStage: null, completedAt: new Date(),
          result: { runtimeContext: "READY", targetResolution: "READY", protocol: "READY", epm: "READY", cohortSlot: "READY", tokenPreflight: "PASS", admissionBoundary: "READY", admissionCreated: false, providerAttemptCreated: false, providerDispatchStarted: false, providerKey: resolvedTarget.providerKey, upstreamModelRef: resolvedTarget.upstreamModelRef, bindingId: resolvedTarget.bindingId, revisionId: resolvedTarget.revisionId, targetFingerprint: run.targetFingerprint }
        } });
        return;
      }
      if (run.diagnosticOnly || lease.executionMode === "DIAGNOSTIC") throw new EvaluationWorkerFailure("DIAGNOSTIC_ADMISSION_HARD_STOP");
      await this.queue.recordLifecycle(lease, "ADMISSION_REQUESTED");
      const { response, target: resolvedTarget } = await this.runtime.invokeEvaluationAttempt(
        actor,
        request,
        // A trace is the durable IntelligenceExecution identity, so it must be
        // unique per physical attempt even when attempts share one evaluation run.
        { requestId: `evaluation-${lease.attemptId}`, traceId: `evaluation-run-${lease.runId}-attempt-${lease.attemptId}`, ...(capacityExtension ? { evaluationRunId: run.id, capacityExtensionId: capacityExtension.id } : {}) },
        lease.attemptId,
        async (admissionId, actualTarget) => {
          if (!sameTarget(target.resolvedTarget, actualTarget) || actualTarget.modelId !== target.modelId || !actualTarget.revisionId || !actualTarget.variantId || !actualTarget.bindingId || !actualTarget.providerConnectionId || !actualTarget.providerDefinitionId || !actualTarget.providerKey || !actualTarget.upstreamModelRef || !actualTarget.transportProfile || !actualTarget.profileId || actualTarget.profileRevision === null) throw new EvaluationWorkerFailure("TARGET_RESOLUTION_MISMATCH");
          await this.queue.recordAdmission(lease, admissionId);
        },
        cancellation.signal,
        async (stage, providerAttemptId) => { await this.queue.recordLifecycle(lease, stage, providerAttemptId); },
        async (runtimeStage) => { await stage(runtimeStage); }
      );
      await this.queue.recordLifecycle(lease, "PROVIDER_RESPONSE_RECEIVED");
      if (!sameTarget(target.resolvedTarget, resolvedTarget)) throw new EvaluationWorkerFailure("TARGET_RESOLUTION_MISMATCH");
      const outputText = response.output[0]?.content.map((part) => part.text).join("");
      if (typeof outputText !== "string" || Buffer.byteLength(outputText, "utf8") > 1_000_000) throw new EvaluationWorkerFailure("PROVIDER_RESULT_INVALID");
      let measuredOutput = Buffer.from(outputText, "utf8");
      let executionEvidence: Record<string, unknown> | null = null;
      if (sandboxImage) {
        if (!this.sandbox) throw new EvaluationWorkerFailure("SANDBOX_POLICY_UNAVAILABLE");
        let candidate: Awaited<ReturnType<EvaluationArtifactVault["store"]>>;
        try {
          candidate = await this.artifacts.store(measuredOutput.length === 0 ? encodeEmptyVisibleOutput(lease.attemptId, response.finishReason) : measuredOutput, { applicationId: run.applicationId, tenantId: run.tenantId, purpose: "EVIDENCE", exposureTier: caseRevision.exposureTier }, principal.id);
        } catch (error) {
          throw vaultFailure(error, "CAND");
        }
        let sandboxResult: SandboxResult;
        try {
          sandboxResult = await this.sandbox.run({
            image: sandboxImage, command: ["/bin/sh", "/workspace/candidate.sh"],
            files: { "candidate.sh": measuredOutput, "input.txt": source },
            runId: run.id, caseExecutionId: lease.caseExecutionId, attemptId: lease.attemptId,
            signal: cancellation.signal
          });
        } catch (error) {
          throw new EvaluationWorkerFailure(error instanceof SandboxUnavailableError && error.reasonCode === "POLICY_UNAVAILABLE" ? "SANDBOX_POLICY_UNAVAILABLE" : "POST_PROVIDER_SANDBOX_FAILURE");
        }
        if (sandboxResult.status === "SANDBOX_UNAVAILABLE" || sandboxResult.status === "POLICY_UNAVAILABLE") throw new EvaluationWorkerFailure("POST_PROVIDER_SANDBOX_FAILURE");
        measuredOutput = Buffer.from(sandboxResult.stdout, "utf8");
        const stderrDigest = createHash("sha256").update(sandboxResult.stderr).digest("hex");
        executionEvidence = {
          backend: sandboxResult.backend, imageDigest: sandboxImage,
          environmentDigest: sandboxResult.environmentDigest,
          resourcePolicyRevision: sandboxResult.resourcePolicyRevision,
          dockerEngineVersion: sandboxResult.dockerEngineVersion, architecture: sandboxResult.architecture,
          networkPolicy: sandboxResult.networkPolicy, status: sandboxResult.status,
          exitCode: sandboxResult.exitCode, signal: sandboxResult.signal,
          resourceLimit: sandboxResult.resourceLimit, outputTruncated: sandboxResult.outputTruncated,
          durationMs: sandboxResult.durationMs, stderrDigest,
          candidateArtifactId: candidate.id, candidateDigest: candidate.digest
        };
      }
      let output: Awaited<ReturnType<EvaluationArtifactVault["store"]>>;
      await this.queue.recordLifecycle(lease, "EVIDENCE_PERSISTING");
      try {
        output = await this.artifacts.store(measuredOutput.length === 0 ? encodeEmptyVisibleOutput(lease.attemptId, response.finishReason) : measuredOutput, { applicationId: run.applicationId, tenantId: run.tenantId, purpose: "OUTPUT", exposureTier: caseRevision.exposureTier }, principal.id);
      } catch (error) {
        throw vaultFailure(error, "OUTPUT");
      }
      try {
        await this.queue.recordLifecycle(lease, "REPORTING");
        await this.queue.completeTargetInvocation(lease, { artifactId: output.id, digest: output.digest, exposureTier: output.exposureTier, ...(measuredOutput.length === 0 ? { encoding: EMPTY_VISIBLE_OUTPUT_ENCODING } : {}) }, resolvedTarget, executionEvidence);
      } catch (error) {
        throw finalizationFailure(error);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async assertPacket76EconomicCoverage(applicationId: string, tenantId: string | null, connectionId: string, providerKey: string, upstreamModelRef: string): Promise<void> {
    const now = new Date();
    const policies = await this.db.oicOiuPolicyRevision.findMany({ where: { policyKey: "oic7-deepseek-canary", status: "PUBLISHED", effectiveFrom: { lte: now }, AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, { OR: [{ applicationId: null }, { applicationId }] }, { OR: [{ tenantId: null }, { tenantId }] }] }, include: { dimensions: true } });
    const matchingPolicies = policies.filter((item) => item.tenantId === tenantId || item.tenantId === null).sort((a, b) => Number(!!b.tenantId) - Number(!!a.tenantId) || Number(!!b.applicationId) - Number(!!a.applicationId));
    const policy = matchingPolicies[0];
    const policyAmbiguous = !!policy && matchingPolicies.length > 1 && Number(!!policy.tenantId) === Number(!!matchingPolicies[1]?.tenantId) && Number(!!policy.applicationId) === Number(!!matchingPolicies[1]?.applicationId);
    const policyDimensions = new Map(policy?.dimensions.map((item) => [item.dimension, item]) ?? []);
    if (!policy || policyAmbiguous || ["inputTokens", "outputTokens"].some((dimension) => !policyDimensions.get(dimension)?.required || !policyDimensions.get(dimension)?.included)) throw new EvaluationWorkerFailure("PACKET76_OIU_POLICY_UNAVAILABLE");

    const books = await this.db.oicProviderRateBookRevision.findMany({ where: { providerKey, status: "PUBLISHED", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], AND: [{ OR: [{ applicationId: null }, { applicationId }] }, { OR: [{ tenantId: null }, { tenantId }] }, { OR: [{ connectionId: null }, { connectionId }] }] }, include: { rates: true } });
    const rank = (item: typeof books[number]) => (item.connectionId ? 8 : 0) + (item.tenantId ? 4 : 0) + (item.applicationId ? 2 : 0);
    const matchingBooks = books.filter((item) => item.tenantId === tenantId || item.tenantId === null).sort((a, b) => rank(b) - rank(a));
    const book = matchingBooks[0];
    if (!book || (matchingBooks.length > 1 && rank(book) === rank(matchingBooks[1]!)) || book.sourceQuality === "OPERATOR_ESTIMATE" || book.currency !== "USD") throw new EvaluationWorkerFailure("PACKET76_PROVIDER_RATEBOOK_UNAVAILABLE");
    const selectedRates = new Map<string, typeof book.rates[number]>();
    for (const rate of book.rates.filter((item) => item.upstreamModelId === upstreamModelRef || item.upstreamModelId === null)) {
      const prior = selectedRates.get(rate.dimension);
      if (!prior || (prior.upstreamModelId === null && rate.upstreamModelId !== null)) selectedRates.set(rate.dimension, rate);
    }
    if (["inputTokens", "outputTokens"].some((dimension) => !selectedRates.get(dimension)?.required || !selectedRates.get(dimension)?.pricePerUnit.gt(0))) throw new EvaluationWorkerFailure("PACKET76_PROVIDER_RATE_UNAVAILABLE");
  }
}
