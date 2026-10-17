import test from "node:test";
import assert from "node:assert/strict";
import { DomainReviewService } from "./domain-review.service";
import { ConflictException } from "@nestjs/common";

const appId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const primaryId = "46e2af4c-b87d-4ed2-85ae-a1c5010bc2ac";
const independentId = "3fa33bbf-5911-46df-833a-2cb267b36f9e";
const actor = { id: "c73fcd8d-670c-4ca1-9f42-7a152418bd87", applicationId: appId, tenantIds: [], scopes: ["oic:evaluation:manage"] };

void test("owner qualification attestation records only the explicit Arabic native-review claims", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const tx = {
    oicReviewerQualificationAttestation: { create: ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return Promise.resolve({ id: `qualification-${writes.length}`, ...data, attestedAt: new Date("2026-10-15T00:00:00Z") }); } },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return Promise.resolve(); } }
  };
  const db = {
    oicHumanIdentity: { findFirst: () => Promise.resolve({ id: primaryId }) },
    oicReviewerQualificationAttestation: { findUnique: () => Promise.resolve(null) },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
  };
  const service = new DomainReviewService(db as never, {} as never, {} as never);
  const result = await service.attestArabicQualifications(actor, [primaryId, independentId]);
  assert.equal(result.qualifications.length, 2);
  assert.ok(writes.every((item) => item.language === "ar" && item.proficiency === "NATIVE" && item.isPrimaryLanguage === true && item.attestationSource === "OWNER_ATTESTATION"));
  assert.ok(writes.every((item) => item.qualificationKey === "OIC7_PACKET_7_5_ARABIC_NATIVE_CONTENT_REVIEW"));
  assert.equal(audits.length, 2);
  assert.ok(audits.every((item) => item.action === "reviewer.qualification.owner_attested"));
});

void test("Arabic content batch assigns the same nine blinded slices and withholds the second reviewer", async () => {
  const slices = ["msa_understanding", "msa_generation", "egyptian_understanding", "egyptian_generation", "arabic_english_mixed", "translation", "localization", "business_communication", "sales_support_dialogue"];
  const cases = slices.map((slice, index) => ({
    id: `case-${index}`,
    caseKey: slice,
    language: slice.startsWith("egyptian") ? "ar-EG" : "ar",
    taskType: "language_review",
    slices: [slice],
    sourceDigest: "a".repeat(64),
    exposureTier: "PRIVATE_HOLDOUT",
    inputArtifact: { encryptedArtifactId: `input-${index}`, digest: "a".repeat(64) }
  }));
  const pack = { id: "pack-id", applicationId: appId, tenantId: null, status: "VALIDATED", domain: "Arabic", manifestDigest: "f".repeat(64), cases };
  let assignmentRows: Array<Record<string, unknown>> = [];
  const tx = {
    oicDomainReviewBatch: { create: () => Promise.resolve({ id: "batch-id" }) },
    oicDomainReviewAssignment: { createMany: ({ data }: { data: Array<Record<string, unknown>> }) => { assignmentRows = data; return Promise.resolve({ count: data.length }); } },
    oicAuditEvent: { create: () => Promise.resolve(undefined) }
  };
  const db = {
    oicEvaluationPackRevision: { findFirst: () => Promise.resolve(pack) },
    oicReviewerQualificationAttestation: { findMany: () => Promise.resolve([
      { id: "q1", humanIdentityId: primaryId, attestationDigest: "1".repeat(64) },
      { id: "q2", humanIdentityId: independentId, attestationDigest: "2".repeat(64) }
    ]) },
    oicHumanIdentity: { findFirst: () => Promise.resolve({ id: primaryId }) },
    oicReviewerAuthorization: { findFirst: () => Promise.resolve({ id: "authorization" }) },
    oicDomainReviewBatch: {
      findUnique: ({ where }: { where: Record<string, unknown> }) => {
        if ("id" in where) return Promise.resolve({ id: "batch-id", packId: "pack-id", manifestDigest: "f".repeat(64), status: "PREPARED", assignments: assignmentRows.map((item, index) => ({ id: `assignment-${index}`, caseRevisionId: item.caseRevisionId, humanIdentityId: item.humanIdentityId, reviewerRole: item.reviewerRole, status: item.status })) });
        return Promise.resolve(null);
      }
    },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
  };
  const vault = { read: () => Promise.resolve(Buffer.from(JSON.stringify({ prompt: "محتوى عربي للمراجعة", rubric: "راجع الوضوح وسلامة اللغة" }))) };
  const service = new DomainReviewService(db as never, vault as never, {} as never);
  service.ensureConflictScope = () => Promise.resolve({ id: "test-scope", scopeKey: "OIC7_PACKET_7_5_ARABIC_DOMAIN_REVIEW", revision: 1, reviewPurpose: "test", domain: "Arabic", scopeDigest: "a".repeat(64), status: "PUBLISHED", publishedAt: new Date() });
  const result = await service.prepareArabicBatch(actor, { packId: "pack-id", primaryReviewerId: primaryId, independentReviewerId: independentId });
  assert.equal(result.assignmentCount, 18);
  assert.equal(result.primaryAssignmentCount, 9);
  assert.equal(result.independentHeldCount, 9);
  assert.equal(assignmentRows.filter((item) => item.reviewerRole === "PRIMARY" && item.status === "ASSIGNED").length, 9);
  assert.equal(assignmentRows.filter((item) => item.reviewerRole === "INDEPENDENT" && item.status === "HELD").length, 9);
  assert.ok(assignmentRows.every((item) => !JSON.stringify(item.blindProjection).includes("answer") && !JSON.stringify(item.blindProjection).includes("modelIdentity")));
  assert.ok(slices.every((slice) => assignmentRows.filter((item) => item.blindedItemId === `oic7-ar-${slice}`).length === 2));
});

void test("domain review submit is immutable and repeated submit returns safe durable readback", async () => {
  const submittedAt = new Date("2026-10-16T00:00:00.000Z");
  let submissionCreates = 0;
  const audits: Array<Record<string, unknown>> = [];
  const assignment: { id: string; status: string; reviewerRole: string; batch: { id: string; status: string }; submissions: Array<{ id: string; humanIdentityId: string; submittedAt: Date; evidenceDigest: string }> } = { id: "assignment-1", status: "OPENED", reviewerRole: "PRIMARY", batch: { id: "batch-1", status: "PREPARED" }, submissions: [] };
  let currentAssignment = assignment;
  const tx = {
    oicDomainReviewAssignment: { updateMany: () => Promise.resolve({ count: 1 }), count: () => Promise.resolve(0), updateManyHeld: () => Promise.resolve({ count: 0 }) },
    oicDomainReviewSubmission: { create: ({ data }: { data: Record<string, unknown> }) => { submissionCreates++; return Promise.resolve({ id: "submission-1", ...data }); }, count: () => Promise.resolve(9) },
    oicDomainReviewBatch: { update: () => Promise.resolve({}) },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return Promise.resolve({}); } }
  };
  const db = {
    oicDomainReviewAssignment: { findFirst: () => Promise.resolve(currentAssignment) },
    oicDomainReviewSubmission: { findUnique: () => Promise.resolve({ id: "submission-1", humanIdentityId: primaryId, submittedAt, evidenceDigest: "a".repeat(64) }) },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
  };
  const reviewer = { resolveSession: () => Promise.resolve({ id: primaryId, applicationId: appId, sessionId: "session-safe-test" }) };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  service.assertActionEligible = () => Promise.resolve();
  const first = await service.submit("private-session", "assignment-1", { decision: "APPROVE" }, { requestId: "request-1" });
  assert.equal(first.status, "SUBMITTED");
  assert.equal(submissionCreates, 1);
  assert.equal(audits[0]?.actorHumanIdentityId, primaryId);
  assert.equal(audits[0]?.action, "evaluation.domain_review.submitted");
  const auditCountAfterFirst = audits.length;
  const priorAssignment = { ...assignment, status: "SUBMITTED", submissions: [{ id: "submission-1", humanIdentityId: primaryId, submittedAt, evidenceDigest: "a".repeat(64) }] };
  currentAssignment = priorAssignment;
  const second = await service.submit("private-session", "assignment-1", { decision: "REJECT" }, {});
  assert.equal(second.status, "ALREADY_RECORDED");
  assert.equal(second.id, "submission-1");
  assert.equal("decision" in second, false);
  assert.equal(submissionCreates, 1);
  assert.equal(audits.length, auditCountAfterFirst);
});

void test("review submit rejects stale assignment state with a safe conflict", async () => {
  const assignment = { id: "assignment-1", status: "ASSIGNED", reviewerRole: "PRIMARY", batch: { id: "batch-1", status: "PREPARED" }, submissions: [] };
  const reviewer = { resolveSession: () => Promise.resolve({ id: primaryId, applicationId: appId, sessionId: "session-safe-test" }) };
  const db = { oicDomainReviewAssignment: { findFirst: () => Promise.resolve(assignment) } };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  service.assertActionEligible = () => Promise.resolve();
  await assert.rejects(service.submit("private-session", "assignment-1", { decision: "APPROVE" }, {}), (error: unknown) => error instanceof ConflictException && JSON.stringify(error.getResponse()).includes("ASSIGNMENT_STATE_CHANGED"));
});

void test("unique submission race reconciles the existing row without duplicating evidence", async () => {
  const assignment = { id: "assignment-1", status: "OPENED", reviewerRole: "PRIMARY", batch: { id: "batch-1", status: "PREPARED" }, submissions: [] };
  let auditCalls = 0;
  const tx = {
    oicDomainReviewAssignment: { updateMany: () => Promise.resolve({ count: 1 }) },
    oicDomainReviewSubmission: { create: () => { const error = new Error("unique"); Object.assign(error, { code: "P2002" }); throw error; } },
    oicAuditEvent: { create: () => { auditCalls++; return Promise.resolve({}); } }
  };
  const db = { oicDomainReviewAssignment: { findFirst: () => Promise.resolve(assignment) }, oicDomainReviewSubmission: { findUnique: () => Promise.resolve({ id: "durable-submission", humanIdentityId: primaryId, submittedAt: new Date(), evidenceDigest: "b".repeat(64) }) }, $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx) };
  const reviewer = { resolveSession: () => Promise.resolve({ id: primaryId, applicationId: appId, sessionId: "session-safe-test" }) };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  service.assertActionEligible = () => Promise.resolve();
  const result = await service.submit("private-session", "assignment-1", { decision: "APPROVE" }, {});
  assert.equal(result.status, "ALREADY_RECORDED");
  assert.equal(result.id, "durable-submission");
  assert.equal(auditCalls, 0);
});

void test("batch closes only when all primary and independent assignments are submitted", async () => {
  const check = async (remainingIndependent: number) => {
    let completed = false;
    const audits: Array<Record<string, unknown>> = [];
    const tx = {
      oicDomainReviewAssignment: { updateMany: () => Promise.resolve({ count: 1 }), count: () => Promise.resolve(0) },
      oicDomainReviewSubmission: { create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "submission-r2", ...data }), count: () => Promise.resolve(9) },
      oicDomainReviewBatch: { update: ({ data }: { data: { status: string } }) => { completed = data.status === "COMPLETED"; return Promise.resolve({}); } },
      oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return Promise.resolve({}); } }
    };
    const assignment = { id: "assignment-r2", status: "OPENED", reviewerRole: "INDEPENDENT", batch: { id: "batch-1", status: "SECOND_REVIEW_OPEN" }, submissions: [] };
    const db = { oicDomainReviewAssignment: { findFirst: () => Promise.resolve(assignment) }, $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx) };
    let count = 0;
    const countableTx = { ...tx, oicDomainReviewAssignment: { ...tx.oicDomainReviewAssignment, count: () => Promise.resolve(count++ === 0 ? 0 : remainingIndependent) } };
    db.$transaction = async (operation: (client: typeof tx) => Promise<unknown>) => operation(countableTx);
    const reviewer = { resolveSession: () => Promise.resolve({ id: independentId, applicationId: appId, sessionId: "session-r2" }) };
    const service = new DomainReviewService(db as never, {} as never, reviewer as never);
    service.assertActionEligible = () => Promise.resolve();
    await service.submit("private-session", "assignment-r2", { decision: "APPROVE" }, {});
    return { completed, audits };
  };
  const beforeLast = await check(1);
  assert.equal(beforeLast.completed, false);
  assert.equal(beforeLast.audits.some((event) => event.action === "evaluation.domain_review.batch_completed"), false);
  const final = await check(0);
  assert.equal(final.completed, true);
  assert.ok(final.audits.some((event) => event.action === "evaluation.domain_review.batch_completed" && event.actorHumanIdentityId === independentId));
});

void test("the ninth primary submission durably opens second review only after all nine are submitted", async () => {
  const primaryStatuses = Array.from({ length: 9 }, (_, index) => index === 8 ? "OPENED" : "OPENED");
  const assignments = [
    ...primaryStatuses.map((status, index) => ({ id: `primary-${index + 1}`, status, reviewerRole: "PRIMARY", submissions: [] as Array<Record<string, unknown>> })),
    ...Array.from({ length: 9 }, (_, index) => ({ id: `independent-${index + 1}`, status: "HELD", reviewerRole: "INDEPENDENT", submissions: [] as Array<Record<string, unknown>> }))
  ];
  let batchStatus = "PREPARED";
  let nextSubmissionId = 0;
  const audits: Array<Record<string, unknown>> = [];
  const tx = {
    oicDomainReviewAssignment: {
      updateMany: ({ where, data }: { where: { id?: string; status?: string }; data: { status: string } }) => {
        const rows = assignments.filter((item) => (!where.id || item.id === where.id) && (!where.status || item.status === where.status));
        for (const row of rows) row.status = data.status;
        return Promise.resolve({ count: rows.length });
      },
      count: () => Promise.resolve(assignments.filter((item) => item.reviewerRole === "PRIMARY" && item.status !== "SUBMITTED").length)
    },
    oicDomainReviewSubmission: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const submission = { id: `submission-${++nextSubmissionId}`, ...data };
        const assignment = assignments.find((item) => item.id === data.assignmentId)!;
        assignment.submissions.push(submission);
        return Promise.resolve(submission);
      },
      count: () => Promise.resolve(assignments.reduce((sum, item) => sum + item.submissions.length, 0))
    },
    oicDomainReviewBatch: { update: ({ data }: { data: { status: string } }) => { batchStatus = data.status; return Promise.resolve({}); } },
    oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return Promise.resolve({}); } }
  };
  const db = {
    oicDomainReviewAssignment: {
      findFirst: ({ where }: { where: { id: string } }) => {
        const item = assignments.find((candidate) => candidate.id === where.id);
        if (!item) return Promise.resolve(null);
        return Promise.resolve({ ...item, humanIdentityId: primaryId, applicationId: appId, batch: { id: "batch-nine", status: batchStatus } });
      }
    },
    oicDomainReviewSubmission: { findUnique: ({ where }: { where: { assignmentId: string } }) => Promise.resolve(assignments.find((item) => item.id === where.assignmentId)?.submissions[0] ?? null) },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)
  };
  const reviewer = { resolveSession: () => Promise.resolve({ id: primaryId, applicationId: appId, sessionId: "session-r1" }) };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  service.assertActionEligible = () => Promise.resolve();

  for (let index = 0; index < 8; index++) {
    const result = await service.submit("private-session", `primary-${index + 1}`, { decision: "APPROVE" }, { requestId: `request-${index + 1}` });
    assert.equal(result.status, "SUBMITTED");
    assert.equal(batchStatus, "PREPARED");
  }
  assert.equal(assignments.filter((item) => item.reviewerRole === "PRIMARY" && item.status === "SUBMITTED").length, 8);
  assert.equal(assignments[8]?.status, "OPENED");
  assert.equal(assignments.filter((item) => item.reviewerRole === "INDEPENDENT" && item.status === "HELD").length, 9);

  const final = await service.submit("private-session", "primary-9", { decision: "APPROVE" }, { requestId: "request-9" });
  assert.equal(final.status, "SUBMITTED");
  assert.equal(assignments.filter((item) => item.reviewerRole === "PRIMARY" && item.status === "SUBMITTED").length, 9);
  assert.equal(batchStatus, "SECOND_REVIEW_OPEN");
  assert.ok("SECOND_REVIEW_OPEN".length <= 32);
  assert.equal(assignments.filter((item) => item.reviewerRole === "INDEPENDENT" && item.status === "ASSIGNED").length, 9);
  assert.ok(audits.some((event) => event.action === "evaluation.domain_review.independent_released"));

  const auditCount = audits.length;
  const replay = await service.submit("private-session", "primary-9", { decision: "REJECT" }, { requestId: "request-replay" });
  assert.equal(replay.status, "ALREADY_RECORDED");
  assert.equal(nextSubmissionId, 9);
  assert.equal(audits.length, auditCount);
  assert.ok(["PREPARED", "SECOND_REVIEW_OPEN", "COMPLETED", "RECONCILED_PASS", "RECONCILED_REVIEW_REQUIRED"].every((status) => status.length <= 32));
});
