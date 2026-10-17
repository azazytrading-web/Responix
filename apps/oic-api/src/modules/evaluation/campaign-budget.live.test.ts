import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import { EvaluationService, sha256 } from "./evaluation.service";
import { EvaluationOutboxDispatcher } from "./evaluation-outbox";
import { EvaluationWorkQueue } from "./evaluation-work-queue";

void test("live campaign budget pins OIC-6 policy and atomically reserves planned physical attempts", { skip: !process.env.OIC_DATABASE_URL }, async () => {
  const db = new OicDatabaseService();
  const rollback = "OIC_EVALUATION_BUDGET_ROLLBACK";
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const client = new Proxy(tx, { get(target, property, receiver) {
        if (property === "$transaction") return (callback: (transaction: typeof tx) => Promise<unknown>) => callback(target);
        return Reflect.get(target, property, receiver) as unknown;
      } }) as unknown as OicDatabaseService;
      await tx.oicEvaluationSchedulerCursor.update({ where: { id: "EVALUATION" }, data: {
        workerInstanceId: "evaluation-worker:budget-fixture", workerGeneration: 1, workerState: "READY",
        workerStartedAt: new Date(), workerHeartbeatAt: new Date(), workerLeaseUntil: new Date(Date.now() + 60_000),
        workerCapabilities: {
          database: true, durableQueue: true, claimFencing: true, claimLoopAlive: true,
          compatibilityIdentity: "oic-evaluation-worker-readiness-v1", artifactWriteKeyVersion: 2,
          legacyWriteDisabled: true, artifactEvidence: true, artifactFinalization: true,
          sealedOracle: true, admission: true, outboxFinalization: true, textGeneration: true,
          supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"]
        }
      } });
      const application = await tx.oicApplication.create({ data: { key: `OIC7BUDGET_${randomUUID().slice(0, 16)}`, displayName: "OIC-7 budget rollback fixture" } });
      const principal = await tx.oicServicePrincipal.create({ data: { applicationId: application.id, key: "oic7-budget-test", displayName: "OIC-7 budget test" } });
      await tx.oicPrincipalScopeGrant.create({ data: { applicationId: application.id, principalId: principal.id, scope: "oic:runtime:invoke" } });
      const budget = await tx.oicBudgetRevision.create({ data: {
        applicationId: application.id, scopeKey: application.id, budgetKey: "oic7-campaign", revision: 1,
        status: "PUBLISHED", unit: "OIU", enforcement: "HARD", amount: "100",
        reservationUpperBound: "10", purpose: "evaluation campaign rollback fixture",
        sourceDigest: "7".repeat(64), effectiveFrom: new Date("2020-01-01T00:00:00.000Z")
      } });
      const pack = await tx.oicEvaluationPackRevision.create({ data: {
        applicationId: application.id, packKey: "budget-fixture", revision: 1, domain: "mathematics",
        taskTypes: ["mathematics"], targetClasses: ["MODEL_WITH_OIC_RUNTIME"], license: "internal-fixture",
        securityTier: "INTERNAL", manifest: {}, manifestDigest: "a".repeat(64), status: "PUBLISHED", createdBy: principal.id
      } });
      const caseRevision = await tx.oicEvaluationCaseRevision.create({ data: {
        applicationId: application.id, packId: pack.id, caseKey: "one", revision: 1,
        taskType: "mathematics", slices: ["arithmetic"], inputArtifact: {}, oracle: {}, rights: {},
        sourceDigest: "b".repeat(64), oracleDigest: "c".repeat(64), exposureTier: "INTERNAL", status: "PUBLISHED"
      } });
      const environment = await tx.oicEvaluationEnvironmentRevision.create({ data: {
        applicationId: application.id, packId: pack.id, revision: 1,
        definition: { kind: "DETERMINISTIC_REFERENCE" }, definitionDigest: "e".repeat(64),
        status: "PUBLISHED", createdBy: principal.id
      } });
      const dataset = await tx.oicEvaluationDatasetRevision.create({ data: {
        applicationId: application.id, packId: pack.id, revision: 1,
        caseManifest: [{ caseRevisionId: caseRevision.id }], manifestDigest: "9".repeat(64), status: "PUBLISHED", createdBy: principal.id
      } });
      const suite = await tx.oicEvaluationSuiteRevision.create({ data: {
        applicationId: application.id, packId: pack.id, datasetId: dataset.id, environmentId: environment.id,
        revision: 1, plan: { plannedRepetitions: 1 }, planDigest: "8".repeat(64), status: "PUBLISHED", createdBy: principal.id
      } });
      const release = await tx.oicEvaluationRelease.create({ data: {
        applicationId: application.id, packId: pack.id, datasetId: dataset.id, environmentId: environment.id, suiteId: suite.id,
        revision: 1, releaseTier: "INTERNAL", caseManifest: [{ caseRevisionId: caseRevision.id, contentHash: caseRevision.sourceDigest, oracleHash: caseRevision.oracleDigest, exposureTier: "INTERNAL" }],
        protocol: {}, manifestDigest: "d".repeat(64), status: "PUBLISHED", changelog: "Budget fixture release", createdBy: principal.id
      } });
      const actor = { id: principal.id, applicationId: application.id, tenantIds: [], scopes: ["oic:evaluation:manage"] };
      const target = {
        modelId: "oi-budget", resolverVersion: "oic-model-resolver-v1", runtimeVersion: "1",
        revisionId: randomUUID(), variantId: randomUUID(), bindingId: randomUUID(), profileId: randomUUID(),
        profileRevision: 1, providerConnectionId: randomUUID(), providerDefinitionId: randomUUID(),
        providerKey: "fixture", upstreamModelRef: "upstream-model", transportProfile: "HTTP_JSON"
      };
      const targetIdentity = { modelId: "oi-budget", runtimePrincipalId: principal.id, resolvedTarget: target };
      const payload = {
        releaseDigest: release.manifestDigest, environment: { revisionId: environment.id, digest: environment.definitionDigest },
        sandboxEnvironment: "NONE", caseSchedule: [caseRevision.id], targetIdentity, targetFingerprint: sha256(targetIdentity),
        requiredCapabilities: ["TEXT_GENERATION", "OIC6_ADMISSION"],
        budgetPolicy: { maxOutputUnits: 128, maxExecutionMs: 10_000, budgetRevisionId: budget.id, budgetRevisionDigest: budget.sourceDigest, reservationUpperBoundOiu: "10" },
        retryPolicy: { maxAttempts: 2 }, repetitionPolicy: { plannedRepetitions: 1, seedRoot: "fixed-seed-root" }, samplingPolicy: { mode: "FULL_SUITE" }
      };
      const manifest = await tx.oicEvaluationProtocolManifest.create({ data: {
        applicationId: application.id, releaseId: release.id, protocolVersion: "oic-evaluation-v1",
        targetClass: "MODEL_WITH_OIC_RUNTIME", payload, canonicalDigest: sha256(payload), createdBy: principal.id
      } });
      const service = new EvaluationService(client, { assertConfigured: () => undefined } as never,
        { describeEvaluationTarget: () => Promise.resolve(target) } as never,
        { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : key === "OIC_ADMISSION_MODE" ? "ENFORCE" : 60_000 } as never,
        undefined, undefined,
        { workerReadiness: () => Promise.resolve({ state: "READY", fresh: true, capabilities: {
          database: true, durableQueue: true, claimFencing: true, claimLoopAlive: true, compatibilityIdentity: "oic-evaluation-worker-readiness-v1",
          artifactWriteKeyVersion: 2, legacyWriteDisabled: true, artifactEvidence: true, artifactFinalization: true,
          sealedOracle: true, admission: true, outboxFinalization: true, textGeneration: true, supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"]
        } }),
        reconcileExpired: () => Promise.resolve({ admissionUncertain: 0, cancelled: 0, exhausted: 0 }),
        reconcileBudget: () => Promise.resolve({ inspected: 0, reconciled: 0, releasedOiu: "0" }),
        isAttemptLeaseValid: () => Promise.resolve(false)
      } as never);
      const campaign = await service.createCampaign(actor, {
        releaseId: release.id, campaignKey: "budget-fixture", budgetRevisionId: budget.id,
        budgetLimitOiu: "30", idempotencyKey: "budget-fixture-create"
      });
      assert.equal(campaign.status, "ACTIVE");
      const request = { manifestId: manifest.id, modelId: "oi-budget", runtimePrincipalId: principal.id, campaignId: campaign.id, idempotencyKey: "budget-run-one" };
      const first = await service.startRun(actor, request);
      assert.equal(first.plannedDenominator, 1);
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "20");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: first.id } })).budgetReservationOiu?.toString(), "20");
      assert.equal((await service.startRun(actor, request)).id, first.id);
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "20");
      await assert.rejects(service.startRun(actor, { ...request, idempotencyKey: "budget-run-two" }), /CAMPAIGN_BUDGET_EXHAUSTED/);
      await service.cancelRun(actor, first.id, { reason: "fixture cancellation", idempotencyKey: "budget-run-cancel" });
      // CURRENT_TIMESTAMP is fixed at the start of this rollback-only outer transaction.
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: first.id }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      const dispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, client);
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "0");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: first.id } })).budgetReleasedOiu.toString(), "20");
      assert.equal((await tx.oicEvaluationCaseExecution.findFirstOrThrow({ where: { runId: first.id } })).unusedReservationReleasedOiu.toString(), "20");
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "IDLE");
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: first.id, eventType: "EVALUATION_CASE_CANCELLED", status: "PUBLISHED" }, data: { status: "PENDING", availableAt: new Date("2020-01-01T00:00:00.000Z"), publishedAt: null } });
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "0");
      const second = await service.startRun(actor, { ...request, idempotencyKey: "budget-run-two" });
      assert.notEqual(second.id, first.id);
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "20");
      const secondCase = await tx.oicEvaluationCaseExecution.findFirstOrThrow({ where: { runId: second.id } });
      const secondWork = await tx.oicEvaluationWorkItem.findFirstOrThrow({ where: { caseExecutionId: secondCase.id } });
      await tx.oicEvaluationWorkItem.update({ where: { id: secondWork.id }, data: { status: "FAILED", attemptCount: 1, leaseGeneration: 1, lastFailureClass: "WORKER_LEASE_EXPIRED", completedAt: new Date() } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: secondCase.id }, data: { status: "FAILED", leaseGeneration: 1, outcome: { failureClass: "WORKER_LEASE_EXPIRED" }, completedAt: new Date() } });
      const priorAttempt = await tx.oicEvaluationAttempt.create({ data: { caseExecutionId: secondCase.id, physicalKey: `evaluation-work:${secondWork.id}:1`, attemptOrdinal: 1, status: "INFRA_FAILURE", failureClass: "WORKER_LEASE_EXPIRED", completedAt: new Date() } });
      await tx.oicEvaluationOutbox.create({ data: { applicationId: application.id, runId: second.id, eventKey: `${secondCase.id}:failed:1`, eventType: "EVALUATION_CASE_FAILED", payload: { runId: second.id, caseExecutionId: secondCase.id }, availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: second.id, eventType: "EVALUATION_CASE_ENQUEUED" }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "10");
      const retry = { reason: "reconciled infrastructure loss", idempotencyKey: "budget-safe-retry" };
      const uncertainAdmission = await tx.oicAdmission.create({ data: { applicationId: application.id, principalId: principal.id, scopeKey: application.id, operation: "native.generate.v1", idempotencyKey: `evaluation-attempt:${priorAttempt.id}`, requestHash: "f".repeat(64), status: "UNCERTAIN", requestBounds: {}, dispatchDeadline: new Date("2030-01-01T00:00:00.000Z") } });
      await assert.rejects(service.retryCase(actor, second.id, secondCase.id, retry), /EVALUATION_RETRY_ADMISSION_UNRESOLVED/);
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "10");
      assert.deepEqual(await new EvaluationWorkQueue(client).reconcileBudget(100, second.id), { inspected: 1, reconciled: 0, releasedOiu: "0" });
      await tx.oicAdmission.update({ where: { id: uncertainAdmission.id }, data: { status: "SETTLED" } });
      await assert.rejects(service.retryCase(actor, second.id, secondCase.id, retry), /EVALUATION_RETRY_ADMISSION_UNRESOLVED/);
      const bucket = await tx.oicQuotaBucket.create({ data: { bucketKey: `oic7-budget-${randomUUID()}`, applicationId: application.id, budgetRevisionId: budget.id, unit: "OIU", limitValue: "100", consumed: "4", sequence: 1, windowStart: new Date("2020-01-01T00:00:00.000Z") } });
      await tx.oicReservationLeg.create({ data: { admissionId: uncertainAdmission.id, bucketId: bucket.id, budgetRevisionId: budget.id, amount: "10", state: "SETTLED", expiresAt: new Date("2030-01-01T00:00:00.000Z") } });
      await tx.oicUsagePosting.create({ data: { admissionId: uncertainAdmission.id, bucketId: bucket.id, sourceKey: `budget-consume:${uncertainAdmission.id}:${bucket.id}`, kind: "CONSUME", amount: "4", sequence: 1 } });
      assert.equal((await service.retryCase(actor, second.id, secondCase.id, retry)).replayed, false);
      assert.equal((await service.retryCase(actor, second.id, secondCase.id, retry)).replayed, true);
      await assert.rejects(service.retryCase(actor, second.id, secondCase.id, { ...retry, reason: "different retry purpose" }), /EVALUATION_RETRY_IDEMPOTENCY_CONFLICT/);
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "20");
      assert.equal((await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: secondCase.id } })).status, "QUEUED");
      assert.equal(await tx.oicEvaluationCaseExecution.count({ where: { runId: second.id } }), 1);
      assert.equal((await tx.oicAdmission.findUniqueOrThrow({ where: { id: uncertainAdmission.id } })).status, "SETTLED");
      assert.equal(await tx.oicReservationLeg.count({ where: { admissionId: uncertainAdmission.id, budgetRevisionId: budget.id, state: "SETTLED" } }), 1);
      const queue = new EvaluationWorkQueue(client);
      assert.deepEqual(await queue.reconcileBudget(100, second.id), { inspected: 1, reconciled: 1, releasedOiu: "6" });
      assert.deepEqual(await queue.reconcileBudget(100, second.id), { inspected: 0, reconciled: 0, releasedOiu: "0" });
      assert.equal((await tx.oicEvaluationAttempt.findUniqueOrThrow({ where: { id: priorAttempt.id } })).budgetReleasedOiu.toString(), "6");
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "14");
      await tx.oicEvaluationWorkItem.update({ where: { id: secondWork.id }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      const retryLease = await queue.claimNext("budget-fixture-worker", 10_000);
      assert.equal(retryLease?.attemptOrdinal, 2);
      if (!retryLease) throw new Error("retry lease was not claimed");
      const futureLease = new Date("2030-01-01T00:00:00.000Z");
      await tx.oicEvaluationWorkItem.update({ where: { id: secondWork.id }, data: { leaseUntil: futureLease } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: secondCase.id }, data: { leaseUntil: futureLease } });
      await queue.failTerminal(retryLease, "SANDBOX_UNAVAILABLE");
      assert.equal(await tx.oicEvaluationOutbox.count({ where: { runId: second.id, eventType: "EVALUATION_CASE_FAILED" } }), 2);
      const failedEvent = await tx.oicEvaluationOutbox.findFirstOrThrow({ where: { runId: second.id, eventKey: `${secondCase.id}:failed:2` } });
      await tx.oicEvaluationOutbox.update({ where: { id: failedEvent.id }, data: { status: "FAILED", attemptCount: 8, lastFailureClass: "OUTBOX_ATTEMPTS_EXHAUSTED" } });
      const recovery = { reason: "transient projection failure resolved", idempotencyKey: "budget-outbox-recovery" };
      assert.equal((await service.retryOutbox(actor, failedEvent.id, recovery)).replayed, false);
      assert.equal((await service.retryOutbox(actor, failedEvent.id, recovery)).replayed, true);
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: second.id, status: "PENDING" }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: second.id } })).status, "FAILED");
      assert.deepEqual(await queue.reconcileBudget(100, second.id), { inspected: 1, reconciled: 1, releasedOiu: "10" });
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "4");
      const blockedRun = await service.startRun(actor, { ...request, idempotencyKey: "budget-blocked-run" });
      const blockedCase = await tx.oicEvaluationCaseExecution.findFirstOrThrow({ where: { runId: blockedRun.id } });
      const blockedWork = await tx.oicEvaluationWorkItem.findFirstOrThrow({ where: { caseExecutionId: blockedCase.id } });
      await tx.oicEvaluationWorkItem.update({ where: { id: blockedWork.id }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      const blockedLease = await queue.claimNext("budget-blocked-worker", 10_000);
      assert.equal(blockedLease?.caseExecutionId, blockedCase.id);
      if (!blockedLease) throw new Error("budget-blocked lease was not claimed");
      await tx.oicEvaluationWorkItem.update({ where: { id: blockedWork.id }, data: { leaseUntil: futureLease } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: blockedCase.id }, data: { leaseUntil: futureLease } });
      await queue.failTerminal(blockedLease, "BUDGET_BLOCKED");
      assert.equal((await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: blockedCase.id } })).status, "BUDGET_BLOCKED");
      assert.equal(await tx.oicProviderAttempt.count({ where: { applicationId: application.id } }), 0);
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: blockedRun.id }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: blockedRun.id } })).status, "BUDGET_BLOCKED");
      assert.deepEqual(await queue.reconcileBudget(100, blockedRun.id), { inspected: 1, reconciled: 1, releasedOiu: "10" });
      assert.equal((await tx.oicEvaluationCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).reservedOiu.toString(), "4");
      const evidenceFailureRun = await service.startRun(actor, { ...request, idempotencyKey: "budget-evidence-persist-failure" });
      const evidenceFailureCase = await tx.oicEvaluationCaseExecution.findFirstOrThrow({ where: { runId: evidenceFailureRun.id } });
      const evidenceFailureWork = await tx.oicEvaluationWorkItem.findFirstOrThrow({ where: { caseExecutionId: evidenceFailureCase.id } });
      await tx.oicEvaluationWorkItem.update({ where: { id: evidenceFailureWork.id }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      const evidenceFailureLease = await queue.claimNext("budget-evidence-failure-worker", 10_000);
      assert.equal(evidenceFailureLease?.caseExecutionId, evidenceFailureCase.id);
      if (!evidenceFailureLease) throw new Error("evidence-failure lease was not claimed");
      const settledEvidenceFailureAdmission = await tx.oicAdmission.create({ data: {
        applicationId: application.id, principalId: principal.id, scopeKey: application.id,
        operation: "text.generate", idempotencyKey: `evaluation-attempt:${evidenceFailureLease.attemptId}`,
        requestHash: "8".repeat(64), status: "SETTLED", requestBounds: {},
        dispatchDeadline: new Date("2100-01-01T00:00:00.000Z")
      } });
      await queue.recordAdmission(evidenceFailureLease, settledEvidenceFailureAdmission.id);
      await tx.oicReservationLeg.create({ data: { admissionId: settledEvidenceFailureAdmission.id, bucketId: bucket.id, budgetRevisionId: budget.id, amount: "10", state: "SETTLED", expiresAt: new Date("2100-01-01T00:00:00.000Z") } });
      await tx.oicUsagePosting.create({ data: { admissionId: settledEvidenceFailureAdmission.id, bucketId: bucket.id, sourceKey: `budget-consume:${settledEvidenceFailureAdmission.id}:${bucket.id}`, kind: "CONSUME", amount: "4", sequence: 2 } });
      await queue.failTerminal(evidenceFailureLease, "EVIDENCE_PERSISTENCE_FAILED");
      assert.equal((await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: evidenceFailureCase.id } })).status, "INCONCLUSIVE");
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: evidenceFailureRun.id }, data: { availableAt: new Date("2020-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("budget-fixture-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: evidenceFailureRun.id } })).status, "INCONCLUSIVE");
      assert.deepEqual(await queue.reconcileBudget(100, evidenceFailureRun.id), { inspected: 1, reconciled: 1, releasedOiu: "6" });
      await assert.rejects(service.retryCase(actor, evidenceFailureRun.id, evidenceFailureCase.id, { reason: "artifact write did not persist", idempotencyKey: "budget-evidence-no-retry" }), /EVALUATION_RETRY_FAILURE_INELIGIBLE/);
      await assert.rejects(tx.oicEvaluationCampaign.update({ where: { id: campaign.id }, data: { budgetLimitOiu: "99" } }), /campaign budget identity is immutable/);
      throw new Error(rollback);
    }, { timeout: 60_000 }), new RegExp(rollback));
  } finally {
    await db.$disconnect();
  }
});
