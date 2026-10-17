import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EvaluationWorker, safeWorkerDiagnostic } from "./evaluation-worker";
import { EvaluationSandboxAdapter } from "./sandbox-adapter";
import { sha256 } from "./evaluation.service";
import { Prisma } from "@oic/database";
import { EMPTY_VISIBLE_OUTPUT_ENCODING, encodeEmptyVisibleOutput } from "./visible-output-evidence";
import { EvaluationArtifactError } from "./artifact-vault";
import { ConflictException } from "@nestjs/common";
import { OicRuntimeException } from "../runtime-plane/runtime-errors";

const lease = {
  workItemId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a1",
  runId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a2",
  caseExecutionId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a3",
  attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a4",
  workerId: "worker-1",
  generation: 1,
  attemptOrdinal: 1,
  leaseUntil: new Date("2026-10-13T10:05:00.000Z")
};

void test("worker persists a bounded model-resolution operation diagnostic", () => {
  const error = new OicRuntimeException("RUNTIME_UNAVAILABLE");
  Object.defineProperty(error, "safeModelResolutionDiagnostic", { value: {
    operationId: "OIC_MODEL_EDITION_FIND_FIRST", prismaErrorType: "PrismaClientUnknownRequestError", prismaErrorCode: null,
    modelName: "OicModelEdition", safeDatabaseMeta: { relation_name: "OicModelEdition" },
    inputShape: { applicationScoped: true, tenantScoped: false, modelIdValid: true }
  } });
  const diagnostic = safeWorkerDiagnostic(error, "MODEL_RESOLUTION");
  assert.equal(diagnostic.stage, "MODEL_RESOLUTION");
  assert.equal(diagnostic.code, "PRISMA_OIC_MODEL_EDITION_FIND_FIRST");
  assert.equal(diagnostic.type, "PrismaClientUnknownRequestError");
  assert.match(diagnostic.message, /OicModelEdition\.findFirst/);
  assert.equal(diagnostic.details?.operationId, "OIC_MODEL_EDITION_FIND_FIRST");
  assert.deepEqual(diagnostic.details?.inputShape, { applicationScoped: true, tenantScoped: false, modelIdValid: true });
});

void test("worker diagnostic keeps only a repository-relative stack frame and never copies the raw exception message", () => {
  const error = new Error("private database text and bearer secret must not be persisted");
  error.stack = `Error: ${error.message}\n    at Object.resolve (G:\\Trading\\OIC\\apps\\oic-api\\src\\modules\\runtime-plane\\model-resolver.ts:101:4)`;
  const diagnostic = safeWorkerDiagnostic(error, "MODEL_RESOLUTION");
  assert.equal(diagnostic.stackFrame, "oic-api/src/modules/runtime-plane/model-resolver.ts:101:4");
  assert.equal(diagnostic.message.includes("private database text"), false);
  assert.equal(diagnostic.message.includes("bearer secret"), false);
});

void test("evaluation worker remains dormant unless its independent worker flag is enabled", async () => {
  let claimed = false;
  const config = { get: () => "false" };
  const queue = { claimNext: () => { claimed = true; return Promise.resolve(null); } };
  const worker = new EvaluationWorker(config as never, {} as never, queue as never, {} as never, {} as never);
  assert.equal(await worker.processOne(), "DISABLED");
  assert.equal(claimed, false);
});

void test("worker leaves durable work pending when artifact encryption is unavailable", async () => {
  let claimed = false;
  const queue = { claimNext: () => { claimed = true; return Promise.resolve(null); } };
  const artifacts = { assertConfigured: () => { throw new Error("artifact key unavailable"); } };
  const worker = new EvaluationWorker({ get: () => "true" } as never, {} as never, queue as never, {} as never, artifacts as never);
  await assert.rejects(worker.processOne(), /artifact key unavailable/);
  assert.equal(claimed, false);
});

void test("worker refuses unsupported agent targets before touching target runtime or artifact contents", async () => {
  let dispatched = false;
  let failedAs = "";
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : undefined };
  const db = {
    oicEvaluationRun: { findUnique: () => Promise.resolve({
      id: lease.runId,
      status: "QUEUED",
      applicationId: "c8b49b66-a9a9-4edf-b955-ef5084ea46a5",
      tenantId: null,
      targetClass: "AGENT_SYSTEM",
      targetIdentity: {},
      targetFingerprint: "a".repeat(64),
      manifest: { targetClass: "AGENT_SYSTEM", release: { status: "PUBLISHED", compromisedAt: null }, payload: {} }
    }) }
  };
  const queue = {
    claimNext: () => Promise.resolve(lease),
    recordLifecycle: () => Promise.resolve(),
    failTerminal: (_lease: unknown, failureClass: string) => { failedAs = failureClass; return Promise.resolve(); }
  };
  const runtime = { invokeEvaluationAttempt: () => { dispatched = true; throw new Error("must not run"); } };
  const artifacts = { assertConfigured: () => undefined, read: () => { throw new Error("must not read artifacts"); }, store: () => { throw new Error("must not write artifacts"); } };
  const worker = new EvaluationWorker(config as never, db as never, queue as never, runtime as never, artifacts as never);
  assert.equal(await worker.processOne("worker-1"), "FAILED");
  assert.equal(failedAs, "TARGET_CLASS_UNSUPPORTED");
  assert.equal(dispatched, false);
});

void test("worker links admission before provider execution and seals output before fenced completion", async () => {
  const events: string[] = [];
  const stages: string[] = [];
  let activeLease: typeof lease = lease;
  let activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b6";
  let failOutputPersistence = false;
  let forcedVaultError: Error | null = null;
  let forcedFinalizationError: Error | null = null;
  let terminalFailureClass = "";
  const traceIds: string[] = [];
  const source = Buffer.from("public evaluation input", "utf8");
  const sourceDigest = createHash("sha256").update(source).digest("hex");
  let output = Buffer.from("provider response", "utf8");
  const storedOutput = () => output.length === 0 ? encodeEmptyVisibleOutput(activeLease.attemptId) : output;
  const outputDigest = () => createHash("sha256").update(storedOutput()).digest("hex");
  const applicationId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b1";
  const principalId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b2";
  const caseRevisionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b3";
  const environmentId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b7";
  const inputArtifactId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b4";
  const outputArtifactId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b5";
  const campaignId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b8";
  const budgetRevisionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46b9";
  const resolvedTarget = {
    modelId: "oi-evaluation", resolverVersion: "oic-model-resolver-v1", runtimeVersion: "1",
    revisionId: "revision-1", variantId: "variant-1", bindingId: "binding-1",
    profileId: "profile-1", profileRevision: 1, providerConnectionId: "connection-1",
    providerDefinitionId: "definition-1", providerKey: "fixture", upstreamModelRef: "model-1",
    transportProfile: "HTTP_JSON"
  };
  const targetIdentity = { modelId: "oi-evaluation", runtimePrincipalId: principalId, resolvedTarget };
  const protocolPayload = { releaseDigest: "d".repeat(64), environment: { revisionId: environmentId, digest: "e".repeat(64) }, sandboxEnvironment: "NONE", caseSchedule: [caseRevisionId], targetIdentity, targetFingerprint: sha256(targetIdentity), requiredCapabilities: ["TEXT_GENERATION", "OIC6_ADMISSION"], retryPolicy: { maxAttempts: 2 }, budgetPolicy: { maxOutputUnits: 128, maxExecutionMs: 10_000, budgetRevisionId, budgetRevisionDigest: "7".repeat(64), reservationUpperBoundOiu: "10" } };
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : key === "OIC_ADMISSION_MODE" ? "ENFORCE" : key === "OIC_RUNTIME_MAX_EXECUTION_MS" ? 60_000 : undefined };
  const db = {
    oicEvaluationRun: { findUnique: () => Promise.resolve({
      id: lease.runId, status: "QUEUED", applicationId, tenantId: null, campaignId, budgetReservationOiu: new Prisma.Decimal(20), budgetReleasedOiu: new Prisma.Decimal(0),
      targetClass: "MODEL_WITH_OIC_RUNTIME", targetIdentity, targetFingerprint: sha256(targetIdentity),
      manifest: { targetClass: "MODEL_WITH_OIC_RUNTIME", canonicalDigest: sha256(protocolPayload), release: { status: "PUBLISHED", compromisedAt: null, manifestDigest: "d".repeat(64), caseManifest: [{ caseRevisionId, contentHash: sourceDigest, oracleHash: "c".repeat(64), exposureTier: "INTERNAL" }], environment: { id: environmentId, definitionDigest: "e".repeat(64), definition: { kind: "DETERMINISTIC_REFERENCE" } } },
        payload: protocolPayload }
    }) },
    oicEvaluationCampaign: { findFirst: () => Promise.resolve({ status: "ACTIVE", budgetLimitOiu: new Prisma.Decimal(20), budgetRevisionId, budgetPolicyDigest: "7".repeat(64), reservationPerAttemptOiu: new Prisma.Decimal(10), reservedOiu: new Prisma.Decimal(20), budgetRevision: { status: "PUBLISHED", sourceDigest: "7".repeat(64), applicationId, tenantId: null, planRevisionId: "plan-revision-1", unit: "OIU", enforcement: "HARD", amount: new Prisma.Decimal(20), unknownLiabilityRule: "DENY", effectiveFrom: new Date(0), effectiveTo: null, reservationUpperBound: new Prisma.Decimal(10) } }) },
    oicEvaluationWorkItem: { findUnique: () => Promise.resolve({ maxAttempts: 2 }) },
    oicEvaluationCaseExecution: { findUnique: () => Promise.resolve({ runId: lease.runId, caseRevisionId }) },
    oicEvaluationCaseRevision: { findFirst: ({ where }: { where: { status: string } }) => {
      assert.equal(where.status, "PUBLISHED");
      return Promise.resolve({ sourceDigest, oracleDigest: "c".repeat(64), exposureTier: "INTERNAL", inputArtifact: { artifactId: inputArtifactId, digest: sourceDigest } });
    } },
    oicServicePrincipal: { findFirst: () => Promise.resolve({ id: principalId, applicationId, scopes: [{ scope: "oic:runtime:invoke" }], tenantGrants: [] }) }
  };
  const queue = {
    claimNext: () => Promise.resolve(activeLease),
    recordLifecycle: (_lease: unknown, stage: string) => { stages.push(stage); return Promise.resolve(); },
    recordAdmission: (_lease: unknown, id: string) => { assert.equal(id, activeAdmissionId); stages.push("ADMISSION_GRANTED"); events.push("admission"); return Promise.resolve(); },
    completeTargetInvocation: (_lease: unknown, artifact: { artifactId: string; digest: string }) => {
      assert.deepEqual(artifact, { artifactId: outputArtifactId, digest: outputDigest(), exposureTier: "INTERNAL", ...(output.length === 0 ? { encoding: EMPTY_VISIBLE_OUTPUT_ENCODING } : {}) });
      if (forcedFinalizationError) throw forcedFinalizationError;
      events.push("completed"); return Promise.resolve();
    },
    failTerminal: (_lease: unknown, failureClass: string) => { terminalFailureClass = failureClass; events.push("failed"); return Promise.resolve(); }
  };
  const artifacts = {
    assertConfigured: () => { events.push("vault-ready"); },
    read: (id: string, scope: { purpose: string }) => { assert.equal(id, inputArtifactId); assert.equal(scope.purpose, "INPUT"); events.push("input-read"); return Promise.resolve(source); },
    store: (body: Buffer, scope: { purpose: string }) => {
      assert.deepEqual(body, storedOutput()); assert.equal(scope.purpose, "OUTPUT"); events.push("output-sealed");
      assert.equal(body.toString("utf8").includes("SECRET_HIDDEN_REASONING_TEXT"), false);
      if (forcedVaultError) throw forcedVaultError;
      if (failOutputPersistence) throw new Error("synthetic encrypted artifact persistence failure");
      return Promise.resolve({ id: outputArtifactId, digest: outputDigest(), exposureTier: "INTERNAL" });
    }
  };
  const runtime = { invokeEvaluationAttempt: async (
    _actor: unknown, _request: unknown, identity: { requestId: string; traceId: string }, attemptId: string,
    onAdmitted: (id: string, target: typeof resolvedTarget) => Promise<void>, _signal: AbortSignal | undefined,
    progress: (stage: "PROVIDER_ATTEMPT_CREATED" | "PROVIDER_DISPATCH_STARTED", providerAttemptId: string) => Promise<void>
  ) => {
    assert.equal(attemptId, activeLease.attemptId);
    assert.equal(identity.requestId, `evaluation-${attemptId}`);
    assert.equal(identity.traceId, `evaluation-run-${activeLease.runId}-attempt-${attemptId}`);
    traceIds.push(identity.traceId);
    await onAdmitted(activeAdmissionId, resolvedTarget);
    await progress("PROVIDER_ATTEMPT_CREATED", activeLease.attemptId);
    await progress("PROVIDER_DISPATCH_STARTED", activeLease.attemptId);
    events.push("provider-executed");
    return { response: { output: [{ content: [{ type: "text", text: output.toString("utf8") }] }], usage: { outputTokens: 8, reasoningTokens: 8 }, reasoning_content: "SECRET_HIDDEN_REASONING_TEXT" }, target: resolvedTarget };
  } };
  const worker = new EvaluationWorker(config as never, db as never, queue as never, runtime as never, artifacts as never);
  assert.equal(await worker.processOne("worker-1"), "SUCCEEDED");
  assert.deepEqual(events, ["vault-ready", "input-read", "admission", "provider-executed", "output-sealed", "completed"]);
  assert.deepEqual(stages, ["PREFLIGHT", "PREFLIGHT_PROTOCOL", "PREFLIGHT_CASE", "PREFLIGHT_ARTIFACT", "PREFLIGHT_PRINCIPAL", "PREFLIGHT_ADMISSION", "ADMISSION_REQUESTED", "ADMISSION_GRANTED", "PROVIDER_ATTEMPT_CREATED", "PROVIDER_DISPATCH_STARTED", "PROVIDER_RESPONSE_RECEIVED", "EVIDENCE_PERSISTING", "REPORTING"]);
  assert.equal(new Set(traceIds).size, traceIds.length);
  events.length = 0;
  stages.length = 0;
  output = Buffer.alloc(0);
  activeLease = { ...lease, attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46ac", attemptOrdinal: 2, generation: 2 };
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46ad";
  assert.equal(await worker.processOne("worker-1"), "SUCCEEDED");
  assert.deepEqual(events, ["vault-ready", "input-read", "admission", "provider-executed", "output-sealed", "completed"]);
  events.length = 0;
  output = Buffer.from("provider response", "utf8");
  activeLease = { ...lease, attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46aa", attemptOrdinal: 2, generation: 2 };
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46ab";
  failOutputPersistence = true;
  assert.equal(await worker.processOne("worker-1"), "FAILED");
  assert.equal(terminalFailureClass, "VAULT_OUTPUT_WRITE_FAILED");
  assert.deepEqual(events, ["vault-ready", "input-read", "admission", "provider-executed", "output-sealed", "failed"]);
  events.length = 0;
  failOutputPersistence = false;
  forcedVaultError = new EvaluationArtifactError("ENCRYPTION_CONFIG_INVALID");
  activeLease = { ...lease, attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46ae", attemptOrdinal: 3, generation: 3 };
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46af";
  assert.equal(await worker.processOne("worker-1"), "FAILED");
  assert.equal(terminalFailureClass, "VAULT_OUTPUT_ENCRYPTION_CONFIG_INVALID");
  assert.deepEqual(events, ["vault-ready", "input-read", "admission", "provider-executed", "output-sealed", "failed"]);
  events.length = 0;
  forcedVaultError = null;
  forcedFinalizationError = new ConflictException("EVALUATION_CASE_FENCE_MISMATCH");
  activeLease = { ...lease, attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46ba", attemptOrdinal: 4, generation: 4 };
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46bb";
  assert.equal(await worker.processOne("worker-1"), "FAILED");
  assert.equal(terminalFailureClass, "FINALIZE_CASE_FENCE_MISMATCH");
  assert.deepEqual(events, ["vault-ready", "input-read", "admission", "provider-executed", "output-sealed", "failed"]);
});

void test("executable worker sends generated script only through the pinned sandbox", async () => {
  const applicationId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f1";
  const principalId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f2";
  const caseRevisionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f3";
  const environmentId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f4";
  const candidateArtifactId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f5";
  const outputArtifactId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f6";
  const image = "alpine@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6";
  const prompt = Buffer.from("Print four", "utf8");
  const script = Buffer.from("#!/bin/sh\nprintf 4", "utf8");
  const resultOutput = Buffer.from("4", "utf8");
  const campaignId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f9";
  const budgetRevisionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46fa";
  const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
  let activeLease: typeof lease = lease;
  let activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f8";
  let failPostProviderSandbox = false;
  let terminalFailureClass = "";
  const sandboxIdentity = {
    backend: "DOCKER_LINUX", image, environmentDigest: "1".repeat(64),
    dockerEngineVersion: "fixture", architecture: "amd64", resourcePolicyRevision: "policy-v1", networkPolicy: "DENY"
  };
  const target = {
    modelId: "oi-coder", resolverVersion: "oic-model-resolver-v1", runtimeVersion: "1",
    revisionId: "revision", variantId: "variant", bindingId: "binding", profileId: "profile",
    profileRevision: 1, providerConnectionId: "connection", providerDefinitionId: "definition",
    providerKey: "fixture", upstreamModelRef: "model", transportProfile: "HTTP_JSON"
  };
  const targetIdentity = { modelId: "oi-coder", runtimePrincipalId: principalId, resolvedTarget: target };
  const protocolPayload = {
    releaseDigest: "d".repeat(64), environment: { revisionId: environmentId, digest: "e".repeat(64) },
    sandboxEnvironment: sandboxIdentity, caseSchedule: [caseRevisionId], targetIdentity,
    targetFingerprint: sha256(targetIdentity), requiredCapabilities: ["TEXT_GENERATION", "OIC6_ADMISSION", "EXECUTABLE_SANDBOX", "SHELL_SCRIPT_V1"],
    retryPolicy: { maxAttempts: 1 }, budgetPolicy: { maxInputUnits: 128, maxOutputUnits: 128, maxExecutionMs: 10_000, budgetRevisionId, budgetRevisionDigest: "7".repeat(64), reservationUpperBoundOiu: "10" }
  };
  const calls: string[] = [];
  const db = {
    oicEvaluationRun: { findUnique: () => Promise.resolve({
      id: lease.runId, status: "QUEUED", applicationId, tenantId: null, campaignId, budgetReservationOiu: new Prisma.Decimal(10), budgetReleasedOiu: new Prisma.Decimal(0),
      targetClass: "MODEL_WITH_OIC_RUNTIME", targetIdentity, targetFingerprint: sha256(targetIdentity),
      manifest: { targetClass: "MODEL_WITH_OIC_RUNTIME", canonicalDigest: sha256(protocolPayload), payload: protocolPayload,
        release: { status: "PUBLISHED", compromisedAt: null, manifestDigest: "d".repeat(64),
          caseManifest: [{ caseRevisionId, contentHash: digest(prompt), oracleHash: "c".repeat(64), exposureTier: "INTERNAL" }],
          environment: { id: environmentId, definitionDigest: "e".repeat(64), definition: { kind: "EXECUTABLE_SHELL_V1", imageDigest: image, timeoutMs: 5_000 } } } }
    }) },
    oicEvaluationCampaign: { findFirst: () => Promise.resolve({ status: "ACTIVE", budgetLimitOiu: new Prisma.Decimal(10), budgetRevisionId, budgetPolicyDigest: "7".repeat(64), reservationPerAttemptOiu: new Prisma.Decimal(10), reservedOiu: new Prisma.Decimal(10), budgetRevision: { status: "PUBLISHED", sourceDigest: "7".repeat(64), applicationId, tenantId: null, planRevisionId: "plan-revision-1", unit: "OIU", enforcement: "HARD", amount: new Prisma.Decimal(10), unknownLiabilityRule: "DENY", effectiveFrom: new Date(0), effectiveTo: null, reservationUpperBound: new Prisma.Decimal(10) } }) },
    oicEvaluationWorkItem: { findUnique: () => Promise.resolve({ maxAttempts: 1 }) },
    oicEvaluationCaseExecution: { findUnique: () => Promise.resolve({ runId: lease.runId, caseRevisionId }) },
    oicEvaluationCaseRevision: { findFirst: () => Promise.resolve({ sourceDigest: digest(prompt), oracleDigest: "c".repeat(64), exposureTier: "INTERNAL", inputArtifact: { artifactId: "c8b49b66-a9a9-4edf-b955-ef5084ea46f7", digest: digest(prompt) } }) },
    oicServicePrincipal: { findFirst: () => Promise.resolve({ id: principalId, applicationId, scopes: [{ scope: "oic:runtime:invoke" }], tenantGrants: [] }) }
  };
  const artifacts = {
    assertConfigured: () => undefined,
    read: () => Promise.resolve(prompt),
    store: (body: Buffer, scope: { purpose: string }) => {
      calls.push(scope.purpose);
      if (scope.purpose === "EVIDENCE") { assert.deepEqual(body, script); return Promise.resolve({ id: candidateArtifactId, digest: digest(script), exposureTier: "INTERNAL" }); }
      assert.equal(scope.purpose, "OUTPUT"); assert.deepEqual(body, resultOutput);
      return Promise.resolve({ id: outputArtifactId, digest: digest(resultOutput), exposureTier: "INTERNAL" });
    }
  };
  const sandbox = {
    preflight: () => Promise.resolve(sandboxIdentity),
    run: (request: { image: string; command: string[]; files: Record<string, Buffer>; signal: AbortSignal }) => {
      calls.push("SANDBOX");
      assert.equal(request.image, image);
      assert.deepEqual(request.command, ["/bin/sh", "/workspace/candidate.sh"]);
      assert.deepEqual(request.files["candidate.sh"], script);
      assert.deepEqual(request.files["input.txt"], prompt);
      assert.equal(request.signal.aborted, false);
      if (failPostProviderSandbox) return Promise.reject(new Error("synthetic sandbox loss after provider response"));
      return Promise.resolve({ ...sandboxIdentity, status: "SUCCEEDED", exitCode: 0, signal: null, stdout: "4", stderr: "", outputTruncated: false, resourceLimit: null, durationMs: 10 });
    }
  };
  const runtime = { invokeEvaluationAttempt: async (_actor: unknown, _request: unknown, _identity: unknown, attemptId: string, admitted: (id: string, actual: typeof target) => Promise<void>) => {
    assert.equal(attemptId, activeLease.attemptId);
    await admitted(activeAdmissionId, target);
    calls.push("PROVIDER");
    return { response: { output: [{ content: [{ type: "text", text: script.toString("utf8") }] }] }, target };
  } };
  const queue = {
    claimNext: () => Promise.resolve(activeLease),
    recordLifecycle: () => Promise.resolve(),
    recordAdmission: (_lease: unknown, id: string) => { assert.equal(id, activeAdmissionId); calls.push("ADMISSION"); return Promise.resolve(); },
    completeTargetInvocation: (_lease: unknown, output: { artifactId: string }, _target: unknown, evidence: { status: string; candidateArtifactId: string }) => {
      calls.push("COMPLETE"); assert.equal(output.artifactId, outputArtifactId);
      assert.equal(evidence.status, "SUCCEEDED"); assert.equal(evidence.candidateArtifactId, candidateArtifactId);
      return Promise.resolve();
    },
    failTerminal: (_lease: unknown, failureClass: string) => { terminalFailureClass = failureClass; calls.push(failureClass); return Promise.resolve(); }
  };
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : key === "OIC_ADMISSION_MODE" ? "ENFORCE" : 60_000 };
  const worker = new EvaluationWorker(config as never, db as never, queue as never, runtime as never, artifacts as never, sandbox as never);
  assert.equal(await worker.processOne("worker-1"), "SUCCEEDED");
  assert.deepEqual(calls, ["ADMISSION", "PROVIDER", "EVIDENCE", "SANDBOX", "OUTPUT", "COMPLETE"]);
  calls.length = 0;
  activeLease = { ...lease, attemptId: "c8b49b66-a9a9-4edf-b955-ef5084ea46ac", attemptOrdinal: 2, generation: 2 };
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46ad";
  failPostProviderSandbox = true;
  assert.equal(await worker.processOne("worker-post-provider-failure"), "FAILED");
  assert.equal(terminalFailureClass, "POST_PROVIDER_SANDBOX_FAILURE");
  assert.deepEqual(calls, ["ADMISSION", "PROVIDER", "EVIDENCE", "SANDBOX", "POST_PROVIDER_SANDBOX_FAILURE"]);
  activeLease = lease;
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f8";
  failPostProviderSandbox = false;
  terminalFailureClass = "";
  protocolPayload.budgetPolicy.maxInputUnits = 1;
  calls.length = 0;
  assert.equal(await worker.processOne("worker-input-bound"), "FAILED");
  assert.equal(terminalFailureClass, "INPUT_BUDGET_EXCEEDED");
  assert.deepEqual(calls, ["INPUT_BUDGET_EXCEEDED"]);
  protocolPayload.budgetPolicy.maxInputUnits = 128;
  activeLease = lease;
  activeAdmissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46f8";
  failPostProviderSandbox = false;
  terminalFailureClass = "";
  calls.length = 0;
  if (process.env.OIC_EVALUATOR_SECURITY_ACCEPTANCE === "true") {
    const values: Record<string, string | number> = {
      OIC_EVALUATOR_ENABLED: "true", OIC_EVALUATOR_IMAGE_ALLOWLIST: image,
      OIC_EVALUATOR_DISPOSABLE_ROOT: "R:\\OIC-Infrastructure\\Evaluator", OIC_EVALUATOR_MIN_FREE_BYTES: 1024 * 1024 * 1024,
      OIC_EVALUATOR_WORKSPACE_BYTES: 8 * 1024 * 1024, OIC_EVALUATOR_TMP_BYTES: 16 * 1024 * 1024,
      OIC_EVALUATOR_SHM_BYTES: 16 * 1024 * 1024, OIC_EVALUATOR_MEMORY_BYTES: 96 * 1024 * 1024,
      OIC_EVALUATOR_CPU_CORES: 0.5, OIC_EVALUATOR_PID_LIMIT: 12,
      OIC_EVALUATOR_TIMEOUT_MS: 20_000, OIC_EVALUATOR_OUTPUT_BYTES: 4_096
    };
    const liveSandbox = new EvaluationSandboxAdapter({ get: (key: string) => values[key] } as never);
    protocolPayload.sandboxEnvironment = await liveSandbox.preflight(image);
    calls.length = 0;
    const liveWorker = new EvaluationWorker(config as never, db as never, queue as never, runtime as never, artifacts as never, liveSandbox);
    assert.equal(await liveWorker.processOne("worker-live"), "SUCCEEDED", `Execution stages: ${calls.join(",")}`);
    assert.deepEqual(calls, ["ADMISSION", "PROVIDER", "EVIDENCE", "OUTPUT", "COMPLETE"]);
  }
});
