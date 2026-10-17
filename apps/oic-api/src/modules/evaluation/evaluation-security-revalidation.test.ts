import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationService, sha256 } from "./evaluation.service";

const appId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const authorId = "c73fcd8d-670c-4ca1-9f42-7a152418bd87";
const publisherId = "863bc769-2a72-443e-9ad8-15618759059b";
const releaseId = "3c9448dd-26b4-4543-bfa1-5b540b03b4fa";
const actor = (id = publisherId) => ({ id, applicationId: appId, tenantIds: [], scopes: ["oic:evaluation:manage"] });

void test("protected release publication requires version-2 input and oracle artifacts", async () => {
  const caseRevision = {
    id: "035d2a34-2f8d-42b4-868e-2473cd086c11", status: "VALIDATED", exposureTier: "PRIVATE_HOLDOUT",
    sourceDigest: "a".repeat(64), oracleDigest: "b".repeat(64),
    inputArtifact: { encryptedArtifactId: "66b76389-6143-4ed7-bf05-094be86cd591", digest: "a".repeat(64) },
    oracle: { encryptedArtifactId: "99e30e45-fdfa-4e92-85fc-b6a98a15e58f", digest: "b".repeat(64) },
    rights: { sourceType: "FIRST_PARTY_SYNTHETIC", rightsBasis: "OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", commercialEvaluation: "PERMITTED", derivativeUse: "PERMITTED_FOR_INTERNAL_OIC_EVALUATION", thirdPartyRedistribution: "NONE", confirmed: true, reviewedBy: publisherId }
  };
  const pack = {
    id: "e7af26b2-abf8-494e-92bd-8841f811991a", applicationId: appId, tenantId: null, status: "VALIDATED", createdBy: authorId, securityTier: "PRIVATE_HOLDOUT",
    manifestDigest: "c".repeat(64), cases: [caseRevision],
    datasets: [{ id: "dataset-id", status: "VALIDATED", caseManifest: [{ caseRevisionId: caseRevision.id }] }],
    environments: [{ id: "environment-id", status: "VALIDATED", definitionDigest: "d".repeat(64) }],
    suites: [{ id: "suite-id", status: "VALIDATED", datasetId: "dataset-id", environmentId: "environment-id", planDigest: "e".repeat(64), plan: {} }]
  };
  const db = { oicEvaluationPackRevision: { findFirst: () => Promise.resolve(pack) } };
  let requiredVersion: number | undefined;
  const artifacts = { verifyReference: (_id: string, _digest: string, _scope: unknown, version?: number) => { requiredVersion = version; return Promise.reject(new Error("key version mismatch")); } };
  const service = new EvaluationService(db as never, artifacts as never, undefined, undefined, undefined, {} as never);
  await assert.rejects(service.publishRelease(actor(), { packId: pack.id, idempotencyKey: "release-version2-test", changelog: "key version gate", releaseTier: "PRIVATE_HOLDOUT" }), /PROTECTED_ARTIFACT_KEY_VERSION_INVALID/);
  assert.equal(requiredVersion, 2);
});

void test("private holdout EPM publication requires the independent publisher contamination audit", async () => {
  const environment = { id: "environment-id", definitionDigest: "f".repeat(64), definition: { kind: "DETERMINISTIC_REFERENCE" } };
  const db = {
    oicEvaluationRelease: { findFirst: () => Promise.resolve({
      id: releaseId, applicationId: appId, tenantId: null, status: "PUBLISHED", compromisedAt: null, releaseTier: "PRIVATE_HOLDOUT",
      createdBy: publisherId, pack: { createdBy: authorId }, suite: { plan: { plannedRepetitions: 1 } }, environment,
      protocol: { requiredTargetClasses: ["MODEL_WITH_OIC_RUNTIME"] }, caseManifest: []
    }) },
    oicAuditEvent: { findFirst: () => Promise.resolve(null) }
  };
  const service = new EvaluationService(db as never, {} as never);
  await assert.rejects(service.createManifest(actor(), { releaseId, targetClass: "MODEL_WITH_OIC_RUNTIME", modelId: "oi-deepseek-flash", runtimePrincipalId: "92842122-822f-4ddc-a3af-7a162f8a35f1", protocol: {} }), /HOLDOUT_INDEPENDENT_REVIEW_REQUIRED/);
});

void test("compromised protected release cannot start a new run", async () => {
  const payload = { protocolVersion: "test" };
  let transactions = 0;
  const db = {
    oicEvaluationProtocolManifest: { findFirst: () => Promise.resolve({
      id: "d7c84c7e-7612-4e89-89d4-05e606d9dff4", targetClass: "MODEL_WITH_OIC_RUNTIME", canonicalDigest: sha256(payload), payload,
      release: { id: releaseId, applicationId: appId, tenantId: null, status: "COMPROMISED", compromisedAt: new Date(), suite: {}, environment: {}, releaseTier: "PRIVATE_HOLDOUT", pack: { createdBy: authorId }, createdBy: publisherId }
    }) },
    $transaction: () => { transactions++; throw new Error("must not transact"); }
  };
  const config = { get: (key: string) => key === "OIC_EVALUATION_WORKER_ENABLED" ? "true" : "ENFORCE" };
  const readyQueue = { workerReadiness: () => Promise.resolve({ state: "READY", fresh: true, capabilities: {
    database: true, durableQueue: true, claimFencing: true, claimLoopAlive: true, compatibilityIdentity: "oic-evaluation-worker-readiness-v1",
    artifactWriteKeyVersion: 2, legacyWriteDisabled: true, artifactEvidence: true, artifactFinalization: true,
    sealedOracle: true, admission: true, outboxFinalization: true, textGeneration: true, supportedTargetClasses: ["MODEL_WITH_OIC_RUNTIME"]
  } }) };
  const service = new EvaluationService(db as never, { assertConfigured: () => undefined } as never, {} as never, config as never, undefined, undefined, readyQueue as never);
  await assert.rejects(service.startRun(actor(), {
    manifestId: "d7c84c7e-7612-4e89-89d4-05e606d9dff4", modelId: "oi-deepseek-flash",
    runtimePrincipalId: "92842122-822f-4ddc-a3af-7a162f8a35f1", campaignId: "2c365da3-505f-4437-b564-e1e56449a8ac", idempotencyKey: "blocked-compromised-release"
  }), /RUN_PROTOCOL_INVALID/);
  assert.equal(transactions, 0);
});
