import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { assertNoProtocolIdentityOverride, assertSafeArtifact, canonicalJson, EvaluationService, sha256 } from "./evaluation.service";
import { Prisma } from "@oic/database";

void test("protected artifacts accept only encrypted references and a digest", () => {
  const digest = "a".repeat(64);
  const id = "c8b49b66-a9a9-4edf-b955-ef5084ea46a3";
  assert.doesNotThrow(() => assertSafeArtifact({ encryptedArtifactId: id, digest }, true));
  assert.doesNotThrow(() => assertSafeArtifact({ artifactId: id, digest }, false));
  for (const extra of [{ content: "secret" }, { metadata: { answer: "secret" } }, { protectedAnswer: "secret" }]) {
    assert.throws(() => assertSafeArtifact({ encryptedArtifactId: id, digest, ...extra }, true), BadRequestException);
    assert.throws(() => assertSafeArtifact({ artifactId: id, digest, ...extra }, false), BadRequestException);
  }
});

void test("client cannot override server-pinned protocol identity", () => {
  assert.doesNotThrow(() => assertNoProtocolIdentityOverride({ harnessRevision: "h1" }));
  for (const key of ["applicationId", "tenantId", "targetClass", "releaseId", "caseSchedule", "targetIdentity", "targetFingerprint"]) {
    assert.throws(() => assertNoProtocolIdentityOverride({ [key]: "forged" }), BadRequestException);
  }
});

void test("metric definitions reject inline prompts and arbitrary fields before persistence", async () => {
  const service = new EvaluationService({} as never, {} as never);
  const actor = { id: randomUUID(), applicationId: randomUUID(), tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const definition = {
    type: "BOOLEAN", unit: "RATIO", polarity: "HIGH_IS_GOOD", applicableTargetClasses: ["MODEL_WITH_OIC_RUNTIME"],
    applicableDomains: ["reasoning"], rangeOrCategories: { minimum: 0, maximum: 1 }, missingSemantics: "MISSING_IS_UNKNOWN",
    oracleOrJudgeRevisionId: "NONE", aggregationMethodRevision: "BOOLEAN_MEAN_V1", uncertaintyMethodRevision: "PAIRED_BOOTSTRAP_V1",
    minimumEffectiveN: 2, criticality: "REQUIRED", normalizationRevisionOrNone: "NONE",
    sourceArtifactRequirement: "SEALED_OBJECTIVE_ORACLE", methodRevision: "REFERENCE_EXACT_BYTES_V1"
  };
  await assert.rejects(service.createMetric(actor, { metricKey: "quality.match", revision: 1, definition: { ...definition, prompt: "hidden content" } }), BadRequestException);
});

void test("human metric rubric references fail closed when the immutable artifact is not resolvable", async () => {
  const artifactId = randomUUID();
  const actor = { id: randomUUID(), applicationId: randomUUID(), tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const definition = {
    type: "BOOLEAN", unit: "RATIO", polarity: "HIGH_IS_GOOD", applicableTargetClasses: ["STATIC_LOCAL_FIXTURE"],
    applicableDomains: ["instruction_adherence"], rangeOrCategories: { minimum: 0, maximum: 1 }, missingSemantics: "ABSTENTION_IS_MISSING",
    oracleOrJudgeRevisionId: "NONE", aggregationMethodRevision: "BOOLEAN_MEAN_V1", uncertaintyMethodRevision: "NOT_APPLICABLE_V1",
    minimumEffectiveN: 1, criticality: "REQUIRED", normalizationRevisionOrNone: "NONE", sourceArtifactRequirement: "ATTEMPT_EVIDENCE",
    methodRevision: "human-visible-v1", humanRubricArtifactId: artifactId, humanRubricDigest: "a".repeat(64)
  };
  const service = new EvaluationService({} as never, { verifyReference: () => Promise.reject(new Error("missing")) } as never);
  await assert.rejects(service.createMetric(actor, { metricKey: "oic7.human.boolean", revision: 1, definition }), (error: unknown) => error instanceof ConflictException && error.message === "HUMAN_RUBRIC_UNRESOLVABLE");
});

void test("run dispatch fails closed while the evaluator worker is unavailable", () => {
  const service = new EvaluationService({} as never, {} as never);
  return assert.rejects(service.startRun({ id: "actor", applicationId: "app", tenantIds: [], scopes: ["oic:evaluation:manage"] }, {}), /EVALUATOR_WORKER_UNAVAILABLE/);
});

void test("run cancellation closes pending work and records an identifier-only event", async () => {
  const runId = "c8b49b66-a9a9-4edf-b955-ef5084ea46d1";
  const applicationId = "c8b49b66-a9a9-4edf-b955-ef5084ea46d2";
  const executionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46d3";
  const workId = "c8b49b66-a9a9-4edf-b955-ef5084ea46d4";
  const events: Array<{ payload: unknown; eventType: string }> = [];
  const tx = {
    oicEvaluationRun: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationWorkItem: {
      findMany: () => Promise.resolve([{ id: workId, caseExecutionId: executionId }]),
      updateMany: () => Promise.resolve({ count: 1 })
    },
    oicEvaluationCaseExecution: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationOutbox: { create: ({ data }: { data: { payload: unknown; eventType: string } }) => { events.push(data); return Promise.resolve({}); } },
    oicAuditEvent: { create: () => Promise.resolve({}) }
  };
  const db = {
    oicEvaluationRun: { findFirst: () => Promise.resolve({ id: runId, status: "QUEUED", applicationId, tenantId: null }) },
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
  };
  const service = new EvaluationService(db as never, {} as never);
  const result = await service.cancelRun({ id: "actor", applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] }, runId, { reason: "Operator cancelled the run", idempotencyKey: "cancel-run-1" });
  assert.deepEqual(result, { id: runId, status: "CANCEL_PENDING", pendingCancelled: 1 });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "EVALUATION_CASE_CANCELLED");
  assert.deepEqual(events[0]?.payload, { runId, caseExecutionId: executionId });
});

void test("enabled run scheduling atomically pins target, repetitions, work and outbox IDs", async () => {
  const applicationId = randomUUID();
  const releaseId = randomUUID();
  const manifestId = randomUUID();
  const environmentId = randomUUID();
  const caseRevisionId = randomUUID();
  const principalId = randomUUID();
  const campaignId = randomUUID();
  const budgetRevisionId = randomUUID();
  const runId = randomUUID();
  const releaseDigest = "a".repeat(64);
  const payload = {
    releaseDigest, environment: { revisionId: environmentId, digest: "9".repeat(64) }, sandboxEnvironment: "NONE", caseSchedule: [caseRevisionId], requiredCapabilities: ["TEXT_GENERATION", "OIC6_ADMISSION"],
    budgetPolicy: { maxOutputUnits: 128, maxExecutionMs: 10_000, budgetRevisionId, budgetRevisionDigest: "7".repeat(64), reservationUpperBoundOiu: "10" }, retryPolicy: { maxAttempts: 2 },
    repetitionPolicy: { plannedRepetitions: 2, seedRoot: "fixed-seed-root" }, samplingPolicy: { mode: "FULL_SUITE" }
  };
  const target = {
    modelId: "oi-demo", resolverVersion: "oic-model-resolver-v1", runtimeVersion: "1",
    revisionId: randomUUID(), variantId: randomUUID(), bindingId: randomUUID(), profileId: randomUUID(),
    profileRevision: 1, providerConnectionId: randomUUID(), providerDefinitionId: randomUUID(),
    providerKey: "fixture", upstreamModelRef: "upstream-model", transportProfile: "HTTP_JSON"
  };
  const targetIdentity = { modelId: "oi-demo", runtimePrincipalId: principalId, resolvedTarget: target };
  const pinnedPayload = { ...payload, targetIdentity, targetFingerprint: sha256(targetIdentity) };
  let exposureTier = "INTERNAL";
  const events: Array<{ eventType: string; payload: unknown }> = [];
  const seeds: string[] = [];
  const tx = {
    $queryRaw: () => Promise.resolve([{ id: campaignId }]),
    oicEvaluationRun: { create: ({ data }: { data: { targetIdentity: unknown; plannedDenominator: number } }) => {
      assert.deepEqual(data.targetIdentity, { modelId: "oi-demo", runtimePrincipalId: principalId, resolvedTarget: target });
      return Promise.resolve({ id: runId, status: "QUEUED", applicationId, tenantId: null, plannedDenominator: data.plannedDenominator });
    } },
    oicEvaluationCaseExecution: { create: ({ data }: { data: { seed: string } }) => { seeds.push(data.seed); return Promise.resolve({ id: randomUUID() }); } },
    oicEvaluationWorkItem: { create: () => Promise.resolve({ id: randomUUID() }) },
    oicEvaluationOutbox: { create: ({ data }: { data: { eventType: string; payload: unknown } }) => { events.push(data); return Promise.resolve({}); } },
    oicAuditEvent: { create: () => Promise.resolve({}) }
  };
  const db = {
    oicEvaluationRun: { findFirst: () => Promise.resolve(null) },
    oicEvaluationCampaign: { findFirst: () => Promise.resolve({ id: campaignId, budgetRevisionId, budgetLimitOiu: new Prisma.Decimal(100), reservationPerAttemptOiu: new Prisma.Decimal(10), budgetPolicyDigest: "7".repeat(64), budgetRevision: { status: "PUBLISHED", sourceDigest: "7".repeat(64), effectiveFrom: new Date(0), effectiveTo: null, reservationUpperBound: new Prisma.Decimal(10) } }) },
    oicEvaluationProtocolManifest: { findFirst: () => Promise.resolve({
      id: manifestId, targetClass: "MODEL_WITH_OIC_RUNTIME", canonicalDigest: sha256(pinnedPayload), payload: pinnedPayload,
      release: { id: releaseId, applicationId, tenantId: null, status: "PUBLISHED", compromisedAt: null,
        packId: randomUUID(), manifestDigest: releaseDigest, caseManifest: [{ caseRevisionId, contentHash: "b".repeat(64), oracleHash: "c".repeat(64), exposureTier }], suite: { plan: { plannedRepetitions: 2 } }, environment: { id: environmentId, definitionDigest: "9".repeat(64), definition: { kind: "DETERMINISTIC_REFERENCE" } } }
    }) },
    oicEvaluationCaseRevision: { findMany: () => Promise.resolve([{ id: caseRevisionId, sourceDigest: "b".repeat(64), oracleDigest: "c".repeat(64), exposureTier }]) },
    oicServicePrincipal: { findFirst: () => Promise.resolve({ id: principalId, applicationId, scopes: [{ scope: "oic:runtime:invoke" }], tenantGrants: [] }) },
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
  };
  const artifacts = { assertConfigured: () => undefined };
  const runtime = { describeEvaluationTarget: () => Promise.resolve(target) };
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : key === "OIC_ADMISSION_MODE" ? "ENFORCE" : 60_000 };
  const readyQueue = { workerReadiness: () => Promise.resolve({ state: "READY", fresh: true, capabilities: {
    database: true, durableQueue: true, claimFencing: true, claimLoopAlive: true, compatibilityIdentity: "oic-evaluation-worker-readiness-v1",
    artifactWriteKeyVersion: 2, legacyWriteDisabled: true, artifactEvidence: true, artifactFinalization: true,
    sealedOracle: true, admission: true, outboxFinalization: true, textGeneration: true, supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"]
  } }) };
  const service = new EvaluationService(db as never, artifacts as never, runtime as never, config as never, undefined, undefined, readyQueue as never);
  const result = await service.startRun({ id: randomUUID(), applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] }, {
    manifestId, modelId: "oi-demo", runtimePrincipalId: principalId, campaignId, idempotencyKey: "run-001234"
  });
  assert.deepEqual(result, { id: runId, status: "QUEUED", targetFingerprint: sha256({ modelId: "oi-demo", runtimePrincipalId: principalId, resolvedTarget: target }), plannedDenominator: 2 });
  assert.equal(seeds.length, 2);
  assert.notEqual(seeds[0], seeds[1]);
  assert.equal(events.length, 2);
  assert.ok(events.every((event) => event.eventType === "EVALUATION_CASE_ENQUEUED" && Object.keys(event.payload as object).sort().join(",") === "caseExecutionId,runId,workItemId"));
  exposureTier = "PRIVATE_HOLDOUT";
  await assert.rejects(service.startRun({ id: randomUUID(), applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] }, {
    manifestId, modelId: "oi-demo", runtimePrincipalId: principalId, campaignId, idempotencyKey: "run-001235"
  }), /PROTECTED_VALIDATION_WORKER_UNAVAILABLE/);
  const protectedService = new EvaluationService(db as never, artifacts as never, runtime as never, config as never, undefined, {} as never, readyQueue as never);
  const protectedRun = await protectedService.startRun({ id: randomUUID(), applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] }, {
    manifestId, modelId: "oi-demo", runtimePrincipalId: principalId, campaignId, idempotencyKey: "run-001236"
  });
  assert.equal(protectedRun.plannedDenominator, 2);
  assert.ok(events.every((event) => !JSON.stringify(event.payload).includes("oracle")));
});

void test("protocol publication pins the resolved runtime target into the immutable EPM digest", async () => {
  const applicationId = randomUUID();
  const releaseId = randomUUID();
  const environmentId = randomUUID();
  const caseRevisionId = randomUUID();
  const runtimePrincipalId = randomUUID();
  const budgetRevisionId = randomUUID();
  const metricId = randomUUID();
  const judgeId = randomUUID();
  const resolvedTarget = {
    modelId: "oi-demo", resolverVersion: "oic-model-resolver-v1", runtimeVersion: "1",
    revisionId: randomUUID(), variantId: randomUUID(), bindingId: randomUUID(), profileId: randomUUID(),
    profileRevision: 1, providerConnectionId: randomUUID(), providerDefinitionId: randomUUID(),
    providerKey: "fixture", upstreamModelRef: "upstream-model", transportProfile: "HTTP_JSON"
  };
  let storedPayload: Record<string, unknown> | undefined;
  const tx = {
    oicEvaluationProtocolManifest: { create: ({ data }: { data: { payload: Record<string, unknown>; canonicalDigest: string } }) => {
      storedPayload = data.payload;
      assert.equal(data.canonicalDigest, sha256(data.payload));
      return Promise.resolve({ id: randomUUID(), canonicalDigest: data.canonicalDigest, targetClass: "MODEL_WITH_OIC_RUNTIME", publishedAt: new Date() });
    } },
    oicAuditEvent: { create: () => Promise.resolve({}) }
  };
  const db = {
    oicEvaluationRelease: { findFirst: () => Promise.resolve({
      id: releaseId, applicationId, tenantId: null, status: "PUBLISHED", manifestDigest: "a".repeat(64),
      protocol: { requiredTargetClasses: ["MODEL_WITH_OIC_RUNTIME"] }, caseManifest: [{ caseRevisionId }],
      suite: { plan: { plannedRepetitions: 1 } }, environment: { id: environmentId, definitionDigest: "e".repeat(64), definition: { kind: "DETERMINISTIC_REFERENCE" } }
    }) },
    oicEvaluationMetricRevision: { findMany: () => Promise.resolve([{ id: metricId, definitionDigest: "b".repeat(64), metricKey: "success", revision: 1 }]) },
    oicBudgetRevision: { findFirst: () => Promise.resolve({ id: budgetRevisionId, sourceDigest: "7".repeat(64), reservationUpperBound: new Prisma.Decimal(10) }) },
    oicEvaluationJudgeRevision: { findMany: () => Promise.resolve([{ id: judgeId, definitionDigest: "c".repeat(64), judgeKey: "exact", revision: 1, judgeType: "RULE" }]) },
    oicServicePrincipal: { findFirst: () => Promise.resolve({ id: runtimePrincipalId, applicationId, scopes: [{ scope: "oic:runtime:invoke" }], tenantGrants: [] }) },
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
  };
  const runtime = { describeEvaluationTarget: () => Promise.resolve(resolvedTarget) };
  const service = new EvaluationService(db as never, {} as never, runtime as never);
  await service.createManifest({ id: randomUUID(), applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] }, {
    releaseId, targetClass: "MODEL_WITH_OIC_RUNTIME", modelId: "oi-demo", runtimePrincipalId,
    protocol: {
      harnessRevision: "v1", harnessDigest: "d".repeat(64), environment: { revisionId: environmentId, digest: "e".repeat(64) },
      requiredCapabilities: ["TEXT_GENERATION", "OIC6_ADMISSION"], oracleRevision: "REFERENCE_EXACT_BYTES_V1",
      metricRevisions: [metricId], judgeRevisions: [judgeId],
      repetitionPolicy: { plannedRepetitions: 1, seedRoot: "fixed-seed-root" }, retryPolicy: { maxAttempts: 2 },
      samplingPolicy: { mode: "FULL_SUITE" }, statisticsRevision: "fixed-v1",
      budgetPolicy: { maxInputUnits: 128, maxOutputUnits: 128, maxExecutionMs: 10_000, budgetRevisionId }, artifactPolicy: {},
      verificationTier: "OIC_EXECUTED_VERIFIED"
    }
  });
  const identity = { modelId: "oi-demo", runtimePrincipalId, resolvedTarget };
  assert.deepEqual(storedPayload?.targetIdentity, identity);
  assert.equal(storedPayload?.targetFingerprint, sha256(identity));
  assert.deepEqual(storedPayload?.caseSchedule, [caseRevisionId]);
  assert.deepEqual(storedPayload?.budgetPolicy, { maxInputUnits: 128, maxOutputUnits: 128, maxExecutionMs: 10_000, budgetRevisionId, budgetRevisionDigest: "7".repeat(64), reservationUpperBoundOiu: "10" });
});

void test("unconfigured model judges and inline prompts cannot be published", async () => {
  const service = new EvaluationService({} as never, {} as never);
  const actor = { id: "actor", applicationId: "app", tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const definition = { methodRevision: "v1", rubricDigest: "a".repeat(64), outputSchemaDigest: "b".repeat(64), abstentionPolicy: "record abstention", calibrationDigest: "c".repeat(64) };
  await assert.rejects(service.createJudge(actor, { judgeKey: "model-judge", revision: 1, judgeType: "MODEL", definition }), /JUDGE_EXECUTION_NOT_CONFIGURED/);
  await assert.rejects(service.createJudge(actor, { judgeKey: "rule-judge", revision: 1, judgeType: "RULE", definition: { ...definition, promptText: "private" } }), BadRequestException);
});

void test("protocol canonicalization is key-order stable and content-addressed", () => {
  const left = { protocol: { retry: 2, harness: "h1" }, target: "BASE_MODEL" };
  const right = { target: "BASE_MODEL", protocol: { harness: "h1", retry: 2 } };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(sha256(left), sha256(right));
  assert.throws(() => canonicalJson({ missing: undefined }), BadRequestException);
  assert.throws(() => canonicalJson({ invalid: Number.NaN }), BadRequestException);
});
