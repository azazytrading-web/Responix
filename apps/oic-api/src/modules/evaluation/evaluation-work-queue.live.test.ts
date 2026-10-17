import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OicDatabaseService } from "@oic/database";
import { EvaluationWorkQueue } from "./evaluation-work-queue";
import { EvaluationOutboxDispatcher } from "./evaluation-outbox";
import { sha256 } from "./evaluation.service";
import { EvaluationArtifactVault, sealEvaluationArtifact } from "./artifact-vault";
import { EvaluationSealedOracle } from "./sealed-oracle";
import { OBJECTIVE_ORACLE_METHOD } from "./objective-oracle";
import { EMPTY_VISIBLE_OUTPUT_ENCODING, encodeEmptyVisibleOutput } from "./visible-output-evidence";

void test("live queue leases, renews, fails and projects one case atomically", { skip: !process.env.OIC_DATABASE_URL }, async () => {
  const db = new OicDatabaseService();
  const rollback = "OIC_EVALUATION_QUEUE_ROLLBACK";
  const previousKey = process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
  const previousVersion = process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION;
  process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = "5c".repeat(32);
  process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = "2";
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const client = new Proxy(tx, { get(target, property, receiver) {
        if (property === "$transaction") return (callback: (transaction: typeof tx) => Promise<unknown>) => callback(target);
        return Reflect.get(target, property, receiver) as unknown;
      } }) as unknown as OicDatabaseService;
      const application = await tx.oicApplication.create({ data: { key: `OIC7QUEUE_${randomUUID().slice(0, 16)}`, displayName: "OIC-7 queue rollback fixture" } });
      const principal = await tx.oicServicePrincipal.create({ data: { applicationId: application.id, key: "oic7-queue-test", displayName: "OIC-7 queue test" } });
      const answer = Buffer.from("SYNTHETIC_HOLDOUT_RESULT", "utf8");
      const sealedOracle = sealEvaluationArtifact(answer, { applicationId: application.id, tenantId: null, purpose: "ORACLE", exposureTier: "PRIVATE_HOLDOUT" });
      await tx.oicEvaluationArtifact.create({ data: { ...sealedOracle, ciphertext: Uint8Array.from(sealedOracle.ciphertext), createdBy: principal.id } });
      const pack = await tx.oicEvaluationPackRevision.create({ data: {
        applicationId: application.id, packKey: "queue-fixture", revision: 1, domain: "mathematics",
        taskTypes: ["mathematics"], targetClasses: ["MODEL_WITH_OIC_RUNTIME"], license: "internal-fixture",
        securityTier: "INTERNAL", manifest: {}, manifestDigest: "a".repeat(64), status: "PUBLISHED", createdBy: principal.id
      } });
      const caseRevision = await tx.oicEvaluationCaseRevision.create({ data: {
        applicationId: application.id, packId: pack.id, caseKey: "one", revision: 1,
        taskType: "mathematics", slices: ["arithmetic"], inputArtifact: {}, oracle: { encryptedArtifactId: sealedOracle.id, digest: sealedOracle.digest }, oracleMethod: OBJECTIVE_ORACLE_METHOD, rights: {},
        sourceDigest: "b".repeat(64), oracleDigest: sealedOracle.digest, exposureTier: "PRIVATE_HOLDOUT", status: "PUBLISHED"
      } });
      const environment = await tx.oicEvaluationEnvironmentRevision.create({ data: {
        applicationId: application.id, packId: pack.id, revision: 1,
        definition: { kind: "EXECUTABLE_SHELL_V1", networkPolicy: "DENY", imageDigest: `alpine@sha256:${"a".repeat(64)}` },
        definitionDigest: "1".repeat(64), status: "PUBLISHED", createdBy: principal.id
      } });
      const release = await tx.oicEvaluationRelease.create({ data: {
        applicationId: application.id, packId: pack.id, environmentId: environment.id, revision: 1, releaseTier: "INTERNAL",
        caseManifest: [{ caseRevisionId: caseRevision.id, contentHash: caseRevision.sourceDigest, oracleHash: caseRevision.oracleDigest, exposureTier: caseRevision.exposureTier, oracleMethod: OBJECTIVE_ORACLE_METHOD }], protocol: {}, manifestDigest: "d".repeat(64),
        status: "PUBLISHED", changelog: "Queue fixture release", createdBy: principal.id
      } });
      const payload = { requiredCapabilities: ["TEXT_GENERATION"] };
      const manifest = await tx.oicEvaluationProtocolManifest.create({ data: {
        applicationId: application.id, releaseId: release.id, protocolVersion: "oic-evaluation-v1",
        targetClass: "MODEL_WITH_OIC_RUNTIME", payload, canonicalDigest: sha256(payload), createdBy: principal.id
      } });
      const run = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 2, plannedDenominator: 2, createdBy: principal.id, idempotencyKey: "queue-live-fixture-1"
      } });
      const execution = await tx.oicEvaluationCaseExecution.create({ data: {
        runId: run.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "fixed-seed"
      } });
      const secondExecution = await tx.oicEvaluationCaseExecution.create({ data: {
        runId: run.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 2, seed: "fixed-seed-2"
      } });
      const queue = new EvaluationWorkQueue(client);
      const work = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: run.id, caseExecutionId: execution.id, maxAttempts: 2 });
      const secondWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: run.id, caseExecutionId: secondExecution.id, maxAttempts: 2 });
      assert.equal(work.status, "PENDING");
      // CURRENT_TIMESTAMP is fixed at the start of this rollback transaction.
      await tx.oicEvaluationWorkItem.updateMany({ where: { id: { in: [work.id, secondWork.id] } }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const lease = await queue.claimNext("queue-live-worker", 30_000);
      assert.ok(lease);
      assert.ok([execution.id, secondExecution.id].includes(lease.caseExecutionId));
      assert.equal(await queue.claimNext("queue-live-worker-2", 30_000), null, "the global executable slot must remain occupied");
      assert.equal(await queue.isAttemptLeaseValid(lease.attemptId), true);
      const renewed = await queue.renew(lease, 30_000);
      assert.ok(renewed instanceof Date);
      await queue.failTerminal(lease, "SYNTHETIC_INFRA_FAILURE");
      assert.equal(await queue.isAttemptLeaseValid(lease.attemptId), false);
      const nextLease = await queue.claimNext("queue-live-worker-2", 30_000);
      assert.ok(nextLease);
      assert.notEqual(nextLease.caseExecutionId, lease.caseExecutionId);
      await tx.oicEvaluationWorkItem.update({ where: { id: nextLease.workItemId }, data: { maxAttempts: 1, leaseUntil: new Date("2000-01-01T00:00:00.000Z") } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: nextLease.caseExecutionId }, data: { leaseUntil: new Date("2000-01-01T00:00:00.000Z") } });
      assert.deepEqual(await queue.reconcileExpired(), { admissionUncertain: 0, cancelled: 0, exhausted: 1 });
      assert.equal((await tx.oicEvaluationAttempt.findUniqueOrThrow({ where: { id: nextLease.attemptId } })).status, "INFRA_FAILURE");
      assert.equal(await queue.isAttemptLeaseValid(nextLease.attemptId), false);
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: run.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const dispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, client);
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: run.id } })).status, "FAILED");
      const cancelledRun = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 1, plannedDenominator: 1, createdBy: principal.id, idempotencyKey: "queue-live-fixture-cancel"
      } });
      const cancelledExecution = await tx.oicEvaluationCaseExecution.create({ data: {
        runId: cancelledRun.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "cancel-seed"
      } });
      const cancelledWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: cancelledRun.id, caseExecutionId: cancelledExecution.id, maxAttempts: 2 });
      await tx.oicEvaluationWorkItem.update({ where: { id: cancelledWork.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const cancelledLease = await queue.claimNext("queue-live-cancel", 30_000);
      assert.equal(cancelledLease?.caseExecutionId, cancelledExecution.id);
      await tx.oicEvaluationRun.update({ where: { id: cancelledRun.id }, data: { status: "CANCEL_PENDING" } });
      await tx.oicEvaluationWorkItem.update({ where: { id: cancelledWork.id }, data: { leaseUntil: new Date("2000-01-01T00:00:00.000Z") } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: cancelledExecution.id }, data: { leaseUntil: new Date("2000-01-01T00:00:00.000Z") } });
      assert.deepEqual(await queue.reconcileExpired(), { admissionUncertain: 0, cancelled: 1, exhausted: 0 });
      assert.equal((await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: cancelledExecution.id } })).status, "CANCELLED");
      assert.equal((await tx.oicEvaluationAttempt.findUniqueOrThrow({ where: { id: cancelledLease.attemptId } })).status, "INFRA_FAILURE");
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: cancelledRun.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: cancelledRun.id } })).status, "CANCELLED");
      const uncertainRun = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 1, plannedDenominator: 1, createdBy: principal.id, idempotencyKey: "queue-live-fixture-uncertain"
      } });
      const uncertainExecution = await tx.oicEvaluationCaseExecution.create({ data: { runId: uncertainRun.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "uncertain-seed" } });
      const uncertainWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: uncertainRun.id, caseExecutionId: uncertainExecution.id, maxAttempts: 1 });
      await tx.oicEvaluationWorkItem.update({ where: { id: uncertainWork.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const uncertainLease = await queue.claimNext("queue-live-uncertain", 30_000);
      assert.equal(uncertainLease?.caseExecutionId, uncertainExecution.id);
      if (!uncertainLease) throw new Error("uncertain lease was not claimed");
      const uncertainAdmission = await tx.oicAdmission.create({ data: { applicationId: application.id, principalId: principal.id, scopeKey: application.id, operation: "text.generate", idempotencyKey: `evaluation-attempt:${uncertainLease.attemptId}`, requestHash: "6".repeat(64), status: "UNCERTAIN", requestBounds: {}, dispatchDeadline: new Date("2100-01-01T00:00:00.000Z") } });
      await queue.recordAdmission(uncertainLease, uncertainAdmission.id);
      await tx.oicEvaluationWorkItem.update({ where: { id: uncertainWork.id }, data: { leaseUntil: new Date("2000-01-01T00:00:00.000Z") } });
      await tx.oicEvaluationCaseExecution.update({ where: { id: uncertainExecution.id }, data: { leaseUntil: new Date("2000-01-01T00:00:00.000Z") } });
      assert.deepEqual(await queue.reconcileExpired(), { admissionUncertain: 1, cancelled: 0, exhausted: 0 });
      assert.equal((await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: uncertainExecution.id } })).status, "INCONCLUSIVE");
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: uncertainRun.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: uncertainRun.id } })).status, "INCONCLUSIVE");
      const ambiguousRun = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 1, plannedDenominator: 1, createdBy: principal.id, idempotencyKey: "queue-live-fixture-ambiguous"
      } });
      const ambiguousExecution = await tx.oicEvaluationCaseExecution.create({ data: { runId: ambiguousRun.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "ambiguous-seed" } });
      const ambiguousWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: ambiguousRun.id, caseExecutionId: ambiguousExecution.id, maxAttempts: 1 });
      await tx.oicEvaluationWorkItem.update({ where: { id: ambiguousWork.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const ambiguousLease = await queue.claimNext("queue-live-ambiguous", 30_000);
      assert.equal(ambiguousLease?.caseExecutionId, ambiguousExecution.id);
      if (!ambiguousLease) throw new Error("ambiguous lease was not claimed");
      const ambiguousAdmission = await tx.oicAdmission.create({ data: {
        applicationId: application.id, principalId: principal.id, scopeKey: application.id,
        operation: "text.generate", idempotencyKey: `evaluation-attempt:${ambiguousLease.attemptId}`,
        requestHash: "7".repeat(64), status: "UNCERTAIN", requestBounds: {},
        dispatchDeadline: new Date("2100-01-01T00:00:00.000Z")
      } });
      await queue.recordAdmission(ambiguousLease, ambiguousAdmission.id);
      await queue.failTerminal(ambiguousLease, "VAULT_OUTPUT_WRITE_FAILED");
      const failedCase = await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: ambiguousExecution.id } });
      assert.equal(failedCase.status, "INCONCLUSIVE");
      assert.equal((failedCase.outcome as { failureClass: string }).failureClass, "VAULT_OUTPUT_WRITE_FAILED");
      assert.equal((await tx.oicEvaluationAttempt.findUniqueOrThrow({ where: { id: ambiguousLease.attemptId } })).failureClass, "VAULT_OUTPUT_WRITE_FAILED");
      assert.equal(await tx.oicEvaluationOutbox.count({ where: { runId: ambiguousRun.id, eventType: "EVALUATION_CASE_INCONCLUSIVE" } }), 1);
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: ambiguousRun.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: ambiguousRun.id } })).status, "INCONCLUSIVE");
      const failedWork = await tx.oicEvaluationWorkItem.findUniqueOrThrow({ where: { id: ambiguousWork.id } });
      assert.equal(failedWork.attemptCount, 1);
      assert.equal(failedWork.maxAttempts, 1);
      const invalidEnvironmentRun = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 1, plannedDenominator: 1, createdBy: principal.id, idempotencyKey: "queue-live-fixture-invalid-env"
      } });
      const invalidEnvironmentExecution = await tx.oicEvaluationCaseExecution.create({ data: { runId: invalidEnvironmentRun.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "invalid-env-seed" } });
      const invalidEnvironmentWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: invalidEnvironmentRun.id, caseExecutionId: invalidEnvironmentExecution.id, maxAttempts: 1 });
      await tx.oicEvaluationWorkItem.update({ where: { id: invalidEnvironmentWork.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const invalidEnvironmentLease = await queue.claimNext("queue-live-invalid-env", 30_000);
      assert.equal(invalidEnvironmentLease?.caseExecutionId, invalidEnvironmentExecution.id);
      if (!invalidEnvironmentLease) throw new Error("invalid-environment lease was not claimed");
      await queue.failTerminal(invalidEnvironmentLease, "REQUIRED_CAPABILITY_UNSUPPORTED");
      assert.equal((await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: invalidEnvironmentExecution.id } })).status, "INVALID_ENVIRONMENT");
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: invalidEnvironmentRun.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await dispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: invalidEnvironmentRun.id } })).status, "INVALID_ENVIRONMENT");
      const verifiedRun = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 1, plannedDenominator: 1, createdBy: principal.id, idempotencyKey: "queue-live-fixture-verified"
      } });
      const verifiedExecution = await tx.oicEvaluationCaseExecution.create({ data: {
        runId: verifiedRun.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "verified-seed"
      } });
      const verifiedWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: verifiedRun.id, caseExecutionId: verifiedExecution.id, maxAttempts: 1 });
      await tx.oicEvaluationWorkItem.update({ where: { id: verifiedWork.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const verifiedLease = await queue.claimNext("queue-live-verified", 30_000);
      assert.equal(verifiedLease?.caseExecutionId, verifiedExecution.id);
      const admitted = await tx.oicAdmission.create({ data: {
        applicationId: application.id, principalId: principal.id, scopeKey: application.id,
        operation: "text.generate", idempotencyKey: `evaluation-attempt:${verifiedLease.attemptId}`,
        requestHash: "4".repeat(64), status: "SETTLED", requestBounds: {},
        dispatchDeadline: new Date("2100-01-01T00:00:00.000Z")
      } });
      await queue.recordAdmission(verifiedLease, admitted.id);
      const sealedOutput = sealEvaluationArtifact(answer, { applicationId: application.id, tenantId: null, purpose: "OUTPUT", exposureTier: "PRIVATE_HOLDOUT" });
      await tx.oicEvaluationArtifact.create({ data: { ...sealedOutput, ciphertext: Uint8Array.from(sealedOutput.ciphertext), createdBy: principal.id } });
      await queue.completeTargetInvocation(verifiedLease, { artifactId: sealedOutput.id, digest: sealedOutput.digest, exposureTier: "PRIVATE_HOLDOUT" }, {});
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: verifiedRun.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const vault = new EvaluationArtifactVault(client);
      const sealedVerifier = new EvaluationSealedOracle(client, vault);
      const verifiedDispatcher = new EvaluationOutboxDispatcher({ get: () => "true" } as never, client, sealedVerifier);
      assert.equal(await verifiedDispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await verifiedDispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      const verifiedResult = await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: verifiedExecution.id } });
      assert.equal((verifiedResult.outcome as { oracle: { success: boolean } }).oracle.success, true);
      assert.equal(JSON.stringify(verifiedResult.outcome).includes(answer.toString("utf8")), false);
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: verifiedRun.id } })).status, "EXECUTED");
      const emptyRun = await tx.oicEvaluationRun.create({ data: {
        applicationId: application.id, manifestId: manifest.id, targetClass: "MODEL_WITH_OIC_RUNTIME",
        targetFingerprint: "e".repeat(64), targetIdentity: {}, requestHash: "f".repeat(64),
        plannedTrials: 1, plannedDenominator: 1, createdBy: principal.id, idempotencyKey: "queue-live-fixture-empty-visible-output"
      } });
      const emptyExecution = await tx.oicEvaluationCaseExecution.create({ data: { runId: emptyRun.id, caseRevisionId: caseRevision.id, repetitionOrdinal: 1, seed: "empty-visible-output-seed" } });
      const emptyWork = await queue.enqueueCase({ applicationId: application.id, tenantId: null, runId: emptyRun.id, caseExecutionId: emptyExecution.id, maxAttempts: 1 });
      await tx.oicEvaluationWorkItem.update({ where: { id: emptyWork.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      const emptyLease = await queue.claimNext("queue-live-empty", 30_000);
      assert.equal(emptyLease?.caseExecutionId, emptyExecution.id);
      const emptyAdmission = await tx.oicAdmission.create({ data: {
        applicationId: application.id, principalId: principal.id, scopeKey: application.id,
        operation: "text.generate", idempotencyKey: `evaluation-attempt:${emptyLease.attemptId}`,
        requestHash: "4".repeat(64), status: "SETTLED", requestBounds: {}, dispatchDeadline: new Date("2100-01-01T00:00:00.000Z")
      } });
      await queue.recordAdmission(emptyLease, emptyAdmission.id);
      const sealedEmpty = sealEvaluationArtifact(encodeEmptyVisibleOutput(emptyLease.attemptId), { applicationId: application.id, tenantId: null, purpose: "OUTPUT", exposureTier: "PRIVATE_HOLDOUT" });
      await tx.oicEvaluationArtifact.create({ data: { ...sealedEmpty, ciphertext: Uint8Array.from(sealedEmpty.ciphertext), createdBy: principal.id } });
      await queue.completeTargetInvocation(emptyLease, { artifactId: sealedEmpty.id, digest: sealedEmpty.digest, exposureTier: "PRIVATE_HOLDOUT", encoding: EMPTY_VISIBLE_OUTPUT_ENCODING }, {});
      await tx.oicEvaluationOutbox.updateMany({ where: { runId: emptyRun.id }, data: { availableAt: new Date("2000-01-01T00:00:00.000Z") } });
      assert.equal(await verifiedDispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      assert.equal(await verifiedDispatcher.processOne("queue-live-outbox"), "PUBLISHED");
      const emptyResult = await tx.oicEvaluationCaseExecution.findUniqueOrThrow({ where: { id: emptyExecution.id } });
      assert.equal((emptyResult.outcome as { oracle: { success: boolean; reason: string } }).oracle.success, false);
      assert.equal((emptyResult.outcome as { oracle: { reason: string } }).oracle.reason, "MISMATCH");
      assert.equal((await tx.oicEvaluationRun.findUniqueOrThrow({ where: { id: emptyRun.id } })).status, "EXECUTED");
      await assert.rejects(vault.read(sealedOracle.id, { applicationId: application.id, tenantId: null, purpose: "ORACLE", exposureTier: "PRIVATE_HOLDOUT" }));
      throw new Error(rollback);
    }, { timeout: 30_000 }), new RegExp(rollback));
  } finally {
    if (previousKey === undefined) delete process.env.OIC_EVALUATION_ARTIFACT_KEY_V2;
    else process.env.OIC_EVALUATION_ARTIFACT_KEY_V2 = previousKey;
    if (previousVersion === undefined) delete process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION;
    else process.env.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION = previousVersion;
    await db.$disconnect();
  }
});

void test("live scheduler attestation elects one replica, records a fresh heartbeat, and fences stale/shutdown owners", { skip: !process.env.OIC_DATABASE_URL }, async () => {
  const db = new OicDatabaseService();
  const rollback = "OIC_EVALUATION_WORKER_READINESS_ROLLBACK";
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const client = new Proxy(tx, { get(target, property, receiver) {
        if (property === "$transaction") return (callback: (transaction: typeof tx) => Promise<unknown>) => callback(target);
        return Reflect.get(target, property, receiver) as unknown;
      } }) as unknown as OicDatabaseService;
      const queue = new EvaluationWorkQueue(client);
      const cursor = await tx.oicEvaluationSchedulerCursor.findUniqueOrThrow({ where: { id: "EVALUATION" }, select: { workerGeneration: true } });
      const providerAttemptCount = await tx.oicProviderAttempt.count();
      const first = await queue.acquireWorkerSlot("evaluation-worker:live-a");
      assert.equal(first, cursor.workerGeneration + 1, "the live generation advances from the durable cursor rather than assuming an empty database");
      const capabilities = {
        database: true, durableQueue: true, claimFencing: true, claimLoopAlive: true,
        compatibilityIdentity: "oic-evaluation-worker-readiness-v1", artifactWriteKeyVersion: 2,
        legacyWriteDisabled: true, artifactEvidence: true, artifactFinalization: true,
        sealedOracle: true, admission: true, outboxFinalization: true, textGeneration: true,
        supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"], sandbox: "NOT_REQUIRED_FOR_TEXT", heartbeatIntervalMs: 2_000
      };
      assert.equal(await queue.heartbeatWorker("evaluation-worker:live-a", first, capabilities), true);
      const ready = await queue.workerReadiness();
      assert.equal(ready.state, "READY");
      assert.equal(ready.fresh, true);
      assert.equal(await queue.ownsFreshWorkerSlot("evaluation-worker:live-a", first), true);
      assert.equal(await queue.acquireWorkerSlot("evaluation-worker:live-b"), null, "a second replica cannot own the live single slot");
      await client.$executeRawUnsafe(`UPDATE "OicEvaluationSchedulerCursor" SET "workerLeaseUntil" = clock_timestamp() - INTERVAL '1 second' WHERE "id" = 'EVALUATION'`);
      assert.equal((await queue.workerReadiness()).state, "STALE");
      assert.equal(await queue.ownsFreshWorkerSlot("evaluation-worker:live-a", first), false);
      const second = await queue.acquireWorkerSlot("evaluation-worker:live-b");
      assert.equal(second, first + 1, "expired owner is replaced under the next durable generation");
      await queue.releaseWorkerSlot("evaluation-worker:live-b", second);
      const draining = await queue.workerReadiness();
      assert.equal(draining.state, "DRAINING");
      assert.equal(draining.fresh, false);
      assert.equal(await client.oicProviderAttempt.count(), providerAttemptCount, "scheduler election must not create a provider attempt");
      throw new Error(rollback);
    }), new RegExp(rollback));
  } finally {
    await db.$disconnect();
  }
});
