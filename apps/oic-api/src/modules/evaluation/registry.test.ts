import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EvaluationService, sha256 } from "./evaluation.service";

void test("pack creation pins ordered cases, dataset, environment and suite in one transaction", async () => {
  const actorId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a3";
  const applicationId = "c8792436-4157-40dd-bad5-a99e3543ea88";
  const inputId = "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a";
  const oracleId = "59191683-1402-4165-96a1-56e0cae19a55";
  const sourceDigest = "a".repeat(64);
  const oracleDigest = "b".repeat(64);
  const writes: Record<string, unknown> = {};
  const tx = {
    oicEvaluationPackRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.pack = data; return { id: "pack-id", revision: 1, status: "DRAFT" }; } },
    oicEvaluationCaseRevision: { createMany: ({ data }: { data: unknown }) => { writes.cases = data; return { count: 1 }; } },
    oicEvaluationDatasetRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.dataset = data; return { id: "dataset-id" }; } },
    oicEvaluationEnvironmentRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.environment = data; return { id: "environment-id" }; } },
    oicEvaluationSuiteRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.suite = data; return { id: "suite-id" }; } },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { writes.audit = data; return data; } }
  };
  const db = { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) };
  const service = new EvaluationService(db as never, {} as never);
  const result = await service.createPack({ id: actorId, applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] }, {
    packKey: "deterministic-fixture", revision: 1, domain: "reasoning", license: "internal-reviewed", targetClasses: ["BASE_MODEL"],
    environment: { kind: "DETERMINISTIC_REFERENCE", methodDigest: "c".repeat(64), networkPolicy: "DENY", timeoutMs: 1000 },
    suitePlan: { plannedRepetitions: 1, stoppingRule: "FIXED", samplingRevision: "fixed-v1", minimumEffectiveN: 1, requiredSlices: ["basic"] },
    cases: [{ caseKey: "one", taskType: "reasoning", language: "en", slices: ["basic"], oracleMethod: "REFERENCE_EXACT_BYTES_V1", inputArtifact: { artifactId: inputId, digest: sourceDigest }, oracle: { artifactId: oracleId, digest: oracleDigest }, sourceDigest, oracleDigest, rights: { confirmed: true, license: "Oi-authored-internal-evaluation-fixture", sourceRef: "fixture:oic7-first-party-synthetic", permittedUses: ["internal-evaluation", "commercial-evaluation", "derivative-internal-evaluation"], sourceType: "FIRST_PARTY_SYNTHETIC", rightsBasis: "OIC_AUTHORED_INTERNAL_EVALUATION_FIXTURE", commercialEvaluation: "PERMITTED", derivativeUse: "PERMITTED_FOR_INTERNAL_OIC_EVALUATION", thirdPartyRedistribution: "NONE", reviewedBy: actorId, reviewedAt: "2026-10-12T00:00:00Z" } }]
  });
  assert.equal(result.datasetId, "dataset-id");
  assert.equal(result.environmentId, "environment-id");
  assert.equal(result.suiteId, "suite-id");
  const caseRow = (writes.cases as Array<{ id: string }>)[0];
  const dataset = writes.dataset as { caseManifest: Array<{ caseRevisionId: string; contentHash: string }> };
  assert.equal(dataset.caseManifest[0]?.caseRevisionId, caseRow?.id);
  assert.equal(dataset.caseManifest[0]?.contentHash, sourceDigest);
  assert.equal((writes.suite as { datasetId: string }).datasetId, "dataset-id");
  assert.equal((writes.suite as { environmentId: string }).environmentId, "environment-id");
  assert.equal(((writes.cases as Array<{ rights: Record<string, unknown> }>)[0]?.rights.sourceType), "FIRST_PARTY_SYNTHETIC");
  assert.equal(((writes.cases as Array<{ rights: Record<string, unknown> }>)[0]?.rights.commercialEvaluation), "PERMITTED");
  assert.equal(((writes.cases as Array<{ rights: Record<string, unknown> }>)[0]?.rights.derivativeUse), "PERMITTED_FOR_INTERNAL_OIC_EVALUATION");
  assert.equal(((writes.cases as Array<{ rights: Record<string, unknown> }>)[0]?.rights.thirdPartyRedistribution), "NONE");
  assert.equal(((writes.cases as Array<{ rights: Record<string, unknown> }>)[0]?.rights.rightsBasis), "OIC_AUTHORED_INTERNAL_EVALUATION_FIXTURE");
});

void test("first-party synthetic rights require the complete owner-approved provenance tuple", async () => {
  const service = new EvaluationService({} as never, {} as never);
  await assert.rejects(service.createPack({ id: "c8b49b66-7144-4671-a9c8-0cc517ce4d9a", applicationId: "c8792436-4157-40dd-bad5-a99e3543ea88", tenantIds: [], scopes: ["oic:evaluation:manage"] }, {
    packKey: "first-party-canary", revision: 1, domain: "reasoning", license: "owner-authored", targetClasses: ["MODEL_WITH_OIC_RUNTIME"],
    environment: { kind: "DETERMINISTIC_REFERENCE", methodDigest: "c".repeat(64), networkPolicy: "DENY", timeoutMs: 1000 },
    suitePlan: { plannedRepetitions: 1, stoppingRule: "FIXED", samplingRevision: "fixed-v1", minimumEffectiveN: 1, requiredSlices: ["basic"] },
    cases: [{ caseKey: "one", taskType: "reasoning", language: "en", slices: ["basic"], oracleMethod: "REFERENCE_EXACT_BYTES_V1", inputArtifact: { artifactId: "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a", digest: "a".repeat(64) }, oracle: { artifactId: "59191683-1402-4165-96a1-56e0cae19a55", digest: "b".repeat(64) }, sourceDigest: "a".repeat(64), oracleDigest: "b".repeat(64), rights: { confirmed: true, license: "owner-authored", sourceRef: "fixture:oic7-first-party-synthetic", permittedUses: ["evaluation"], sourceType: "FIRST_PARTY_SYNTHETIC", rightsBasis: "OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", commercialEvaluation: "PERMITTED", derivativeUse: "PERMITTED", thirdPartyRedistribution: "NONE", reviewedBy: "c8b49b66-7144-4671-a9c8-0cc517ce4d9a", reviewedAt: "2026-10-12T00:00:00Z" } }]
  }), /Case rights review is incomplete/);
});

void test("deterministic pack validation persists a scoped compiler job and safe report", async () => {
  const actorId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a3";
  const applicationId = "c8792436-4157-40dd-bad5-a99e3543ea88";
  const inputId = "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a";
  const oracleId = "59191683-1402-4165-96a1-56e0cae19a55";
  const caseManifest = [{ caseRevisionId: "case-id", caseKey: "one", weight: 1, slices: ["basic"], contentHash: "a".repeat(64), oracleHash: "b".repeat(64), oracleMethod: "REFERENCE_EXACT_BYTES_V1", exposureTier: "INTERNAL" }];
  const environmentDefinition = { kind: "DETERMINISTIC_REFERENCE", methodDigest: "c".repeat(64), networkPolicy: "DENY", timeoutMs: 1000, revision: 1 };
  const plan = { plannedRepetitions: 1, stoppingRule: "FIXED", samplingRevision: "fixed-v1", minimumEffectiveN: 1, requiredSlices: ["basic"], revision: 1, caseOrderDigest: sha256(caseManifest), environmentDigest: sha256(environmentDefinition) };
  const pack = {
    id: "pack-id", applicationId, tenantId: null, status: "DRAFT", manifestDigest: "d".repeat(64),
    cases: [{ id: "case-id", caseKey: "one", sourceDigest: "a".repeat(64), oracleDigest: "b".repeat(64), oracleMethod: "REFERENCE_EXACT_BYTES_V1", rights: { confirmed: true }, exposureTier: "INTERNAL", inputArtifact: { artifactId: inputId, digest: "a".repeat(64) }, oracle: { artifactId: oracleId, digest: "b".repeat(64) } }],
    datasets: [{ id: "dataset-id", caseManifest, manifestDigest: sha256(caseManifest) }],
    environments: [{ id: "environment-id", definition: environmentDefinition, definitionDigest: sha256(environmentDefinition) }],
    suites: [{ id: "suite-id", datasetId: "dataset-id", environmentId: "environment-id", plan, planDigest: sha256(plan) }]
  };
  const writes: Record<string, unknown> = {};
  const tx = {
    oicEvaluationPackRevision: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationCaseRevision: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationDatasetRevision: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationEnvironmentRevision: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationSuiteRevision: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicEvaluationValidationJob: { create: ({ data }: { data: Record<string, unknown> }) => { writes.job = data; return Promise.resolve({ id: "validation-job-id", ...data, createdAt: new Date("2026-10-13T00:00:00Z") }); } },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { writes.audit = data; return Promise.resolve(data); } }
  };
  const db = {
    oicEvaluationPackRevision: { findFirst: () => Promise.resolve(pack) },
    oicEvaluationCaseRevision: { findMany: () => Promise.resolve([]) },
    oicEvaluationValidationJob: { findUnique: () => Promise.resolve(null) },
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
  };
  let verified = 0;
  const service = new EvaluationService(db as never, { verifyReference: () => { verified++; return Promise.resolve(); } } as never);
  const actor = { id: actorId, applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const result = await service.validatePack(actor, pack.id);
  const job = writes.job as { status: string; report: Record<string, unknown>; applicationId: string; tenantId: null; packId: string };
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.validationJob?.status, "SUCCEEDED");
  assert.equal(job.status, "SUCCEEDED");
  assert.equal(job.applicationId, applicationId);
  assert.equal(job.tenantId, null);
  assert.equal(job.packId, pack.id);
  assert.equal(job.report.artifactReferencesChecked, 2);
  assert.deepEqual(job.report.contaminationScan, {
    method: "EXACT_SOURCE_DIGEST_V1",
    checkedCaseCount: 1,
    intraPackDuplicateCount: 0,
    crossPackOverlapCount: 0
  });
  assert.equal(verified, 2);
  assert.equal((writes.audit as { action: string }).action, "evaluation.pack.validated");
});

void test("rejected pack compilation is durably reported and replay returns the same job", async () => {
  const actor = { id: "c8b49b66-a9a9-4edf-b955-ef5084ea46a3", applicationId: "c8792436-4157-40dd-bad5-a99e3543ea88", tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const pack = { id: "pack-id", applicationId: actor.applicationId, tenantId: null, status: "DRAFT", manifestDigest: "f".repeat(64), cases: [], datasets: [], environments: [], suites: [] };
  let existing: Record<string, unknown> | null = null;
  let createCount = 0;
  const tx = {
    oicEvaluationValidationJob: { create: ({ data }: { data: Record<string, unknown> }) => { createCount++; existing = { id: "validation-job-id", ...data, createdAt: new Date("2026-10-13T00:00:00Z") }; return Promise.resolve(existing); } },
    oicAuditEvent: { create: () => Promise.resolve({}) }
  };
  const db = {
    oicEvaluationPackRevision: { findFirst: () => Promise.resolve(pack) },
    oicEvaluationValidationJob: { findUnique: () => Promise.resolve(existing) },
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
  };
  const service = new EvaluationService(db as never, {} as never);
  await assert.rejects(service.validatePack(actor, pack.id), /Pack validation failed/);
  assert.equal(createCount, 1);
  assert.ok(existing);
  const failed = existing as { status: string; report: Record<string, unknown> };
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.report.failureCode, "PACK_VALIDATION_REJECTED");
  assert.deepEqual(failed.report.reasons, ["NO_CASES", "REGISTRY_REVISION_MISSING"]);
  const replay = await service.validatePack(actor, pack.id);
  assert.equal(replay.validationJob?.id, "validation-job-id");
  assert.equal(replay.validationJob?.status, "FAILED");
  assert.equal(createCount, 1);
});

void test("pack review read model reports rights and slice coverage without protected artifact references", async () => {
  const actorId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a3";
  const heldInput = { encryptedArtifactId: "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a", digest: "a".repeat(64) };
  const heldOracle = { encryptedArtifactId: "59191683-1402-4165-96a1-56e0cae19a55", digest: "b".repeat(64) };
  const packRow = {
    id: "pack-id", applicationId: "c8792436-4157-40dd-bad5-a99e3543ea88", tenantId: null,
    packKey: "review-fixture", revision: 1, domain: "language_multilingual", taskTypes: ["translation"],
    targetClasses: ["BASE_MODEL"], license: "internal", securityTier: "PRIVATE_HOLDOUT",
    manifestDigest: "c".repeat(64), status: "DRAFT", createdAt: new Date("2026-10-12T00:00:00Z"), publishedAt: null,
    manifest: { importProvenance: { origin: "EXTERNAL_BENCHMARK", adapterKey: "oic.normalized-benchmark-json", adapterRevision: 1, sourceArtifactId: "private-artifact-id", sourceChecksum: "d".repeat(64), transformMapDigest: "e".repeat(64), upstreamLicense: "Internal review", sourceRef: "https://example.test/source?token=hidden", permittedUses: ["evaluation"], revocationRef: "rights-review:17" } },
    validationJobs: [{ id: "validation-job-id", status: "SUCCEEDED", report: { compilerKey: "oic.benchmark-compiler", compilerRevision: 1, manifestDigest: "c".repeat(64), caseCount: 2, artifactReferencesChecked: 4, privateArtifact: "must-not-return" }, createdAt: new Date("2026-10-13T00:00:00Z"), completedAt: new Date("2026-10-13T00:00:01Z") }],
    cases: [
      { id: "case-1", caseKey: "arabic", revision: 1, taskType: "translation", language: "ar-EG", slices: ["basic", "arabic"], rights: { confirmed: true, license: "Internal review", sourceRef: "https://example.test/source?token=private#part", permittedUses: ["evaluation"], sourceType: "FIRST_PARTY_SYNTHETIC", rightsBasis: "OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE", commercialEvaluation: "PERMITTED", derivativeUse: "PERMITTED_FOR_INTERNAL_OIC_EVALUATION", thirdPartyRedistribution: "NONE", reviewedBy: actorId, reviewedAt: "2026-10-12T00:00:00Z" }, oracleMethod: "REFERENCE_EXACT_BYTES_V1", exposureTier: "PRIVATE_HOLDOUT", status: "DRAFT", inputArtifact: heldInput, oracle: heldOracle },
      { id: "case-2", caseKey: "empty-rights", revision: 1, taskType: "translation", language: "en", slices: ["basic"], rights: {}, oracleMethod: "REFERENCE_EXACT_BYTES_V1", exposureTier: "INTERNAL", status: "DRAFT", inputArtifact: { artifactId: "input" }, oracle: { artifactId: "oracle" } }
    ],
    datasets: [], environments: [], suites: [{ id: "suite-1", plan: { requiredSlices: ["basic", "missing"] } }], releases: []
  };
  const db = { oicEvaluationPackRevision: { findFirst: () => Promise.resolve(packRow) } };
  const service = new EvaluationService(db as never, {} as never);
  const result = await service.pack({ id: actorId, applicationId: packRow.applicationId, tenantIds: [], scopes: ["oic:evaluation:read"] }, packRow.id);

  assert.deepEqual(result.coverage, {
    caseCount: 2,
    taskTypes: { translation: 2 },
    languages: { "ar-EG": 1, en: 1 },
    exposureTiers: { INTERNAL: 1, PRIVATE_HOLDOUT: 1 },
    slices: { arabic: 1, basic: 2 },
    requiredSlices: ["basic", "missing"],
    missingRequiredSlices: ["missing"],
    rightsReviewed: 1
  });
  assert.equal(result.cases[0]?.rights.sourceRef, "https://example.test/source");
  assert.deepEqual({
    sourceType: result.cases[0]?.rights.sourceType,
    rightsBasis: result.cases[0]?.rights.rightsBasis,
    commercialEvaluation: result.cases[0]?.rights.commercialEvaluation,
    derivativeUse: result.cases[0]?.rights.derivativeUse,
    thirdPartyRedistribution: result.cases[0]?.rights.thirdPartyRedistribution
  }, {
    sourceType: "FIRST_PARTY_SYNTHETIC",
    rightsBasis: "OWNER_AUTHORED_INTERNAL_EVALUATION_FIXTURE",
    commercialEvaluation: "PERMITTED",
    derivativeUse: "PERMITTED_FOR_INTERNAL_OIC_EVALUATION",
    thirdPartyRedistribution: "NONE"
  });
  assert.equal(JSON.stringify(result).includes("token="), false);
  assert.equal("manifest" in result, false);
  assert.equal(result.importedFrom?.sourceRef, "https://example.test/source");
  assert.equal(result.validationJob?.report.artifactReferencesChecked, 4);
  assert.equal(JSON.stringify(result).includes("privateArtifact"), false);
  assert.equal(JSON.stringify(result).includes("private-artifact-id"), false);
  assert.equal("inputArtifact" in (result.cases[0] as object), false);
  assert.equal("oracle" in (result.cases[0] as object), false);
});

void test("release compromise records revocation evidence once and closes new use", async () => {
  const actorId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a3";
  const release = { id: "release-id", applicationId: "c8792436-4157-40dd-bad5-a99e3543ea88", tenantId: null, packId: "pack-id", status: "PUBLISHED", compromisedAt: null as Date | null };
  const writes: Record<string, unknown>[] = [];
  const tx = {
    oicEvaluationRelease: { updateMany: ({ data }: { data: Record<string, unknown> }) => { writes.push(data); release.status = String(data.status); release.compromisedAt = data.compromisedAt as Date; return { count: 1 }; } },
    oicEvaluationPackRevision: { updateMany: ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return { count: 1 }; } },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return data; } }
  };
  const db = { oicEvaluationRelease: { findFirst: () => Promise.resolve(release) }, $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) };
  const service = new EvaluationService(db as never, {} as never);
  const actor = { id: actorId, applicationId: release.applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const input = { reason: "Upstream license was revoked", idempotencyKey: "revoke-license-0001" };

  const first = await service.compromiseRelease(actor, release.id, input);
  const writeCount = writes.length;
  const repeated = await service.compromiseRelease(actor, release.id, input);
  assert.equal(first.status, "COMPROMISED");
  assert.equal(repeated.status, "COMPROMISED");
  assert.equal(writes.length, writeCount);
  assert.deepEqual(writes[0], { status: "COMPROMISED", compromisedAt: first.compromisedAt });
  const audit = writes[2] as { action: string; metadata: { reason: string } };
  assert.equal(audit.action, "evaluation.release.compromised");
  assert.equal(audit.metadata.reason, input.reason);
});

void test("normalized external import verifies the source artifact and pins adapter, rights review and revocation provenance", async () => {
  const actorId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a3";
  const applicationId = "c8792436-4157-40dd-bad5-a99e3543ea88";
  const sourceArtifactId = "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a";
  const sourceBytes = Buffer.from(JSON.stringify({
    format: "OIC_NORMALIZED_BENCHMARK_JSON_V1",
    pack: {
      packKey: "import-fixture", revision: 1, domain: "reasoning", license: "internal-reviewed", targetClasses: ["BASE_MODEL"], taskTypes: ["reasoning"],
      environment: { kind: "DETERMINISTIC_REFERENCE", methodDigest: "c".repeat(64), networkPolicy: "DENY", timeoutMs: 1000 },
      suitePlan: { plannedRepetitions: 1, stoppingRule: "FIXED", samplingRevision: "fixed-v1", minimumEffectiveN: 1, requiredSlices: ["basic"] },
      cases: [{ caseKey: "one", taskType: "reasoning", language: "en", slices: ["basic"], oracleMethod: "REFERENCE_EXACT_BYTES_V1", inputArtifact: { artifactId: "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a", digest: "a".repeat(64) }, oracle: { artifactId: "59191683-1402-4165-96a1-56e0cae19a55", digest: "b".repeat(64) }, sourceDigest: "a".repeat(64), oracleDigest: "b".repeat(64), rights: { confirmed: false, license: "upstream", sourceRef: "https://example.test/case?token=hidden", permittedUses: ["evaluation"], reviewedBy: "00000000-0000-4000-8000-000000000000", reviewedAt: "2000-01-01T00:00:00Z" } }]
    }
  }));
  const writes: Record<string, unknown> = {};
  const tx = {
    oicEvaluationPackRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.pack = data; return { id: "pack-id", revision: 1, status: "DRAFT" }; } },
    oicEvaluationCaseRevision: { createMany: ({ data }: { data: unknown }) => { writes.cases = data; return { count: 1 }; } },
    oicEvaluationDatasetRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.dataset = data; return { id: "dataset-id" }; } },
    oicEvaluationEnvironmentRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.environment = data; return { id: "environment-id" }; } },
    oicEvaluationSuiteRevision: { create: ({ data }: { data: Record<string, unknown> }) => { writes.suite = data; return { id: "suite-id" }; } },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { writes.audit = data; return data; } }
  };
  const db = { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) };
  const scopeReads: Array<Record<string, unknown>> = [];
  const service = new EvaluationService(db as never, { read: (id: string, scope: Record<string, unknown>) => { assert.equal(id, sourceArtifactId); scopeReads.push(scope); return Promise.resolve(Buffer.from(sourceBytes)); } } as never);
  const actor = { id: actorId, applicationId, tenantIds: [], scopes: ["oic:evaluation:manage"] };
  const result = await service.importPack(actor, {
    import: { adapterKey: "oic.normalized-benchmark-json", adapterRevision: 1, sourceArtifactId, sourceChecksum: createHash("sha256").update(sourceBytes).digest("hex"), upstreamLicense: "internal-reviewed", sourceRef: "https://example.test/source?token=hidden", permittedUses: ["evaluation"], revocationRef: "https://example.test/revocations/17?token=hidden", rightsReviewed: true }
  });

  const pack = writes.pack as { manifest: Record<string, unknown> };
  const provenance = pack.manifest.importProvenance as Record<string, unknown>;
  const cases = writes.cases as Array<{ rights: Record<string, unknown> }>;
  const audit = writes.audit as { action: string; metadata: Record<string, unknown> };
  assert.equal(scopeReads[0]?.purpose, "EVIDENCE");
  assert.equal(scopeReads[0]?.exposureTier, "INTERNAL");
  assert.equal(provenance.sourceRef, "https://example.test/source");
  assert.equal(provenance.sourceChecksum, createHash("sha256").update(sourceBytes).digest("hex"));
  assert.equal(typeof provenance.transformMapDigest, "string");
  assert.equal(provenance.revocationRef, "https://example.test/revocations/17");
  assert.equal(cases[0]?.rights.confirmed, true);
  assert.equal(cases[0]?.rights.reviewedBy, actorId);
  assert.equal(cases[0]?.rights.license, "internal-reviewed");
  assert.equal(cases[0]?.rights.sourceRef, "https://example.test/case");
  assert.equal(JSON.stringify(writes).includes("token=hidden"), false);
  assert.equal(audit.action, "evaluation.pack.imported");
  assert.equal((result.import as Record<string, unknown>).adapterKey, "oic.normalized-benchmark-json");
  assert.equal(JSON.stringify(result).includes("oracleArtifactDigest"), false);
});

void test("normalized external import rejects an incorrect source checksum before registry writes", async () => {
  const sourceArtifactId = "f5a51ab9-7144-4671-a9c8-0cc517ce4d9a";
  const sourceBytes = Buffer.from("{}");
  let writes = 0;
  const service = new EvaluationService({ $transaction: () => { writes++; return Promise.resolve(); } } as never, { read: () => Promise.resolve(Buffer.from(sourceBytes)) } as never);
  const actor = { id: "c8b49b66-a9a9-4edf-b955-ef5084ea46a3", applicationId: "c8792436-4157-40dd-bad5-a99e3543ea88", tenantIds: [], scopes: ["oic:evaluation:manage"] };
  await assert.rejects(service.importPack(actor, { import: { adapterKey: "oic.normalized-benchmark-json", adapterRevision: 1, sourceArtifactId, sourceChecksum: "0".repeat(64), upstreamLicense: "internal", sourceRef: "fixture:source", permittedUses: ["evaluation"], revocationRef: "rights-review:case-17", rightsReviewed: true } }), /External benchmark source checksum or document is invalid/);
  assert.equal(writes, 0);
});
