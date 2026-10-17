import test from "node:test";
import assert from "node:assert/strict";
import { EvaluationService, sha256 } from "./evaluation.service";
import { candidateInstructionFromProtocol } from "./evaluation-worker";

const app = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const actor = { id: "c73fcd8d-670c-4ca1-9f42-7a152418bd87", applicationId: app, tenantIds: [], scopes: ["oic:evaluation:manage"] };
const reportId = "a4e165c1-2376-4f7c-8e77-b003070e2e87";

void test("candidate revision pins one bounded instruction change to a same-scope parent report", async () => {
  let candidateData: Record<string, unknown> | undefined;
  let auditData: Record<string, unknown> | undefined;
  const db = {
    oicEvaluationReport: { findFirst: () => Promise.resolve({ id: reportId, run: { applicationId: app, tenantId: null, targetClass: "MODEL_WITH_OIC_RUNTIME", targetFingerprint: "f".repeat(64), status: "EXECUTED", manifest: { release: { status: "PUBLISHED", compromisedAt: null } } } }) },
    $transaction: async (work: (tx: never) => Promise<unknown>) => work({
      oicEvaluationCandidate: { create: ({ data }: { data: Record<string, unknown> }) => { candidateData = data; return Promise.resolve({ id: "candidate-id", status: "DRAFT" }); } },
      oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { auditData = data; return Promise.resolve({}); } }
    } as never)
  };
  const service = new EvaluationService(db as never, {} as never);
  const instruction = "Follow the stated output format exactly and do not add commentary.";
  const result = await service.createCandidate(actor, { candidateKey: "strict-output-v1", parentReportId: reportId, changeSet: { type: "SYSTEM_INSTRUCTION", instruction } });
  assert.equal(result.status, "DRAFT");
  assert.deepEqual(candidateData?.parentIds, [reportId]);
  assert.equal(candidateData?.changeDigest, sha256({ type: "SYSTEM_INSTRUCTION", instruction }));
  assert.equal(auditData?.action, "evaluation.candidate.created");
  await assert.rejects(service.createCandidate(actor, { candidateKey: "multi-change", parentReportId: reportId, changeSet: { type: "SYSTEM_INSTRUCTION", instruction, extra: "opaque" } }));
});

void test("candidate revision can preregister against a published parent protocol before any output exists", async () => {
  const parentManifestId = "d72bec3e-0ab6-4dab-a910-9f0486a566f2";
  const parentProtocol = { evaluationPurpose: "TARGET_EXECUTION", targetFingerprint: "f".repeat(64) };
  let candidateData: Record<string, unknown> | undefined;
  let auditData: Record<string, unknown> | undefined;
  const db = {
    oicEvaluationProtocolManifest: { findFirst: () => Promise.resolve({ id: parentManifestId, applicationId: app, tenantId: null, targetClass: "MODEL_WITH_OIC_RUNTIME", payload: parentProtocol, canonicalDigest: sha256(parentProtocol), release: { status: "PUBLISHED", compromisedAt: null } }) },
    $transaction: async (work: (tx: never) => Promise<unknown>) => work({
      oicEvaluationCandidate: { create: ({ data }: { data: Record<string, unknown> }) => { candidateData = data; return Promise.resolve({ id: "candidate-id", status: "DRAFT" }); } },
      oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { auditData = data; return Promise.resolve({}); } }
    } as never)
  };
  const service = new EvaluationService(db as never, {} as never);
  const instruction = "Follow the requested response format and include only the requested content.";
  const result = await service.createCandidate(actor, { candidateKey: "packet76-candidate-v1", parentManifestId, changeSet: { type: "SYSTEM_INSTRUCTION", instruction } });
  assert.equal(result.status, "DRAFT");
  assert.deepEqual(candidateData?.parentIds, [parentManifestId]);
  assert.equal(auditData?.action, "evaluation.candidate.created");
  assert.equal((auditData?.metadata as Record<string, unknown>).parentManifestId, parentManifestId);
});

void test("candidate treatment is digest-pinned and legacy protocols carry no treatment", () => {
  const instruction = "Follow the requested output format exactly; add no commentary.";
  const changeDigest = sha256({ type: "SYSTEM_INSTRUCTION", instruction });
  const pinned = { candidateRevision: { id: "c73fcd8d-670c-4ca1-9f42-7a152418bd87", changeSet: { type: "SYSTEM_INSTRUCTION", instruction }, changeDigest }, candidateTreatmentFingerprint: "a".repeat(64) };
  assert.equal(candidateInstructionFromProtocol(pinned), instruction);
  assert.equal(candidateInstructionFromProtocol({}), null);
  assert.throws(() => candidateInstructionFromProtocol({ ...pinned, candidateTreatmentFingerprint: undefined }));
  assert.throws(() => candidateInstructionFromProtocol({ ...pinned, candidateRevision: { ...pinned.candidateRevision, changeDigest: "b".repeat(64) } }));
});

void test("DNA projection records evidence gaps as insufficient and never as a zero score", async () => {
  const created: Array<Record<string, unknown>> = [];
  const db = {
    oicEvaluationReport: { findFirst: () => Promise.resolve({ id: reportId, resultDigest: "d".repeat(64), run: { applicationId: app, tenantId: null, targetClass: "MODEL_WITH_OIC_RUNTIME", targetFingerprint: "f".repeat(64), manifest: { releaseId: "release-id" } } }) },
    $transaction: async (work: (tx: never) => Promise<unknown>) => work({
      oicEvaluationDnaMeasurement: { findFirst: () => Promise.resolve(null), create: ({ data }: { data: Record<string, unknown> }) => { created.push(data); return Promise.resolve(data); } },
      oicAuditEvent: { create: () => Promise.resolve({}) }
    } as never)
  };
  const service = new EvaluationService(db as never, {} as never);
  const result = await service.projectDna(actor, reportId);
  assert.equal(result.measuredCount, 0);
  assert.equal(result.insufficientCount, 13);
  assert.ok(created.every((row) => row.availability === "INSUFFICIENT" && row.value === undefined && row.evidenceStrength === "WEAK"));
});
