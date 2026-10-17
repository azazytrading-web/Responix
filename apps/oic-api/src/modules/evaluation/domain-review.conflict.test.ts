import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { DomainReviewService } from "./domain-review.service";

const appId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
const reviewerId = "46e2af4c-b87d-4ed2-85ae-a1c5010bc2ac";
const declarations = { didNotAuthor: true, didNotPublish: true, didNotOperate: true, didNotOwn: true, didNotAccessOracle: true, noOtherProtocolConflict: true };
const scope = { id: "scope-75", scopeKey: "OIC7_PACKET_7_5_ARABIC_DOMAIN_REVIEW", revision: 1, reviewPurpose: "OIC-7 Packet 7.5 Arabic domain review", domain: "Arabic", scopeDigest: "a".repeat(64), status: "PUBLISHED", publishedAt: new Date("2026-10-16T10:00:00Z") };
const reviewer = { resolveSession: () => Promise.resolve({ id: reviewerId, applicationId: appId, sessionId: "session-r1" }) };
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value) ?? "null";
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function serviceFor({ assignmentScope = scope, manifest = {}, rights = {}, oracle = {}, audit = null }: { assignmentScope?: typeof scope | null; manifest?: unknown; rights?: unknown; oracle?: unknown; audit?: Record<string, unknown> | null } = {}) {
  const db = {
    oicDomainReviewAssignment: { findFirst: () => Promise.resolve(assignmentScope ? { reviewerRole: "PRIMARY", pack: { manifest, cases: [{ rights, oracle }] }, batch: { id: "batch-75", conflictScope: assignmentScope, assignments: [] } } : null) },
    oicAuditEvent: { findFirst: () => Promise.resolve(audit) }
  };
  return new DomainReviewService(db as never, {} as never, reviewer as never);
}
const evidenceDigest = digest({ applicationId: appId, humanIdentityId: reviewerId, role: "PRIMARY", batchId: "batch-75", scopeId: scope.id, scopeDigest: scope.scopeDigest, declarations, outcome: "CLEARED" });
const attestationAudit = (overrides: Record<string, unknown> = {}) => ({ applicationId: appId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewerId, action: "review.conflict.attested", targetType: "domain-review-conflict-attestation", targetId: scope.id, metadata: { scopeDigest: scope.scopeDigest, batchId: "batch-75", reviewerRole: "PRIMARY", declarations, knownHumanConflictCheck: "NO_MATCH", outcome: "CLEARED", evidenceDigest, ...overrides } });

void test("a missing Packet 7.5 batch scope remains UNKNOWN", async () => {
  const result = await serviceFor({ assignmentScope: null }).getConflictState("session");
  assert.equal(result.state, "UNKNOWN");
});

void test("a published Packet 7.5 scope without its own declaration requires attestation", async () => {
  const result = await serviceFor().getConflictState("session");
  assert.equal(result.state, "REQUIRES_ATTESTATION");
  assert.equal(result.scope?.scopeKey, "OIC7_PACKET_7_5_ARABIC_DOMAIN_REVIEW");
});

void test("only the correctly actor-, application-, role-, batch-, and digest-scoped declaration clears", async () => {
  assert.equal((await serviceFor({ audit: attestationAudit() }).getConflictState("session")).state, "CLEARED");
  assert.equal((await serviceFor({ audit: { ...attestationAudit(), applicationId: "foreign-app" } }).getConflictState("session")).state, "UNKNOWN");
  assert.equal((await serviceFor({ audit: { ...attestationAudit(), actorHumanIdentityId: "foreign-human" } }).getConflictState("session")).state, "UNKNOWN");
  assert.equal((await serviceFor({ audit: attestationAudit({ batchId: "other-batch" }) }).getConflictState("session")).state, "UNKNOWN");
  assert.equal((await serviceFor({ audit: attestationAudit({ scopeDigest: "b".repeat(64) }) }).getConflictState("session")).state, "UNKNOWN");
});

void test("a known authorship or protected-reference relationship always blocks clearance", async () => {
  assert.equal((await serviceFor({ manifest: { authoredByHumanIdentityId: reviewerId }, audit: attestationAudit() }).getConflictState("session")).state, "CONFLICTED");
  assert.equal((await serviceFor({ oracle: { protectedOracleAccessByHumanIdentityId: reviewerId }, audit: attestationAudit() }).getConflictState("session")).state, "CONFLICTED");
});

void test("Packet 7.4 or canary declaration is not a domain batch declaration", async () => {
  const unrelated = attestationAudit({ scopeDigest: "c".repeat(64), batchId: "canary" });
  assert.equal((await serviceFor({ audit: unrelated }).getConflictState("session")).state, "UNKNOWN");
});

void test("assignment open is blocked while conflict evidence is unresolved", async () => {
  let reads = 0;
  const db = { oicDomainReviewAssignment: { findFirst: () => Promise.resolve(reads++ === 0 ? ({ id: "assignment-final", status: "OPENED", reviewerRole: "PRIMARY", eligibilitySnapshot: { qualificationId: "q", qualificationDigest: "d" }, batch: { id: "batch-75", status: "PREPARED", conflictScope: scope } }) : ({ reviewerRole: "PRIMARY", pack: { manifest: {}, cases: [] }, batch: { id: "batch-75", conflictScope: scope } })) }, oicAuditEvent: { findFirst: () => Promise.resolve(null) } };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  await assert.rejects(service.openAssignment("session", "assignment-final", {}), (error: unknown) => error instanceof ConflictException && JSON.stringify(error.getResponse()).includes("DOMAIN_REVIEW_CONFLICT_ATTESTATION_REQUIRED"));
});

void test("a cleared declaration still requires the assignment's current Arabic qualification snapshot", async () => {
  const db = { oicReviewerQualificationAttestation: { findFirst: () => Promise.resolve({ id: "q", attestationDigest: "wrong-digest" }) }, oicDomainReviewAssignment: { count: () => Promise.resolve(1) } };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  service.getConflictState = () => Promise.resolve({ state: "CLEARED", role: "PRIMARY", scope });
  await assert.rejects(service.assertActionEligible("session", { id: reviewerId, applicationId: appId }, { qualificationId: "q", qualificationDigest: "expected-digest" }, scope, "batch-75"), (error: unknown) => error instanceof ConflictException && JSON.stringify(error.getResponse()).includes("DOMAIN_REVIEW_ELIGIBILITY_CHANGED"));
});

void test("the final review item opens after a valid scoped clearance and matching Arabic qualification", async () => {
  const validQualification = { qualificationId: "q", qualificationDigest: "d".repeat(64) };
  const db = {
    oicDomainReviewAssignment: { findFirst: () => Promise.resolve({ id: "assignment-final", status: "ASSIGNED", reviewerRole: "PRIMARY", blindedItemId: "oic7-ar-sales_support_dialogue", blindProjection: { slice: "sales_support_dialogue", prompt: "review content", rubric: "review rubric" }, eligibilitySnapshot: validQualification, batch: { id: "batch-75", status: "PREPARED", conflictScope: scope } }), updateMany: undefined, count: () => Promise.resolve(1) },
    oicReviewerQualificationAttestation: { findFirst: () => Promise.resolve({ id: "q", attestationDigest: "d".repeat(64) }) },
    $transaction: async (fn: (tx: { oicDomainReviewAssignment: { updateMany: () => Promise<{ count: number }> }; oicAuditEvent: { create: () => Promise<void> } }) => Promise<unknown>) => fn({ oicDomainReviewAssignment: { updateMany: () => Promise.resolve({ count: 1 }) }, oicAuditEvent: { create: () => Promise.resolve() } })
  };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  service.getConflictState = () => Promise.resolve({ state: "CLEARED", role: "PRIMARY", scope });
  const result = await service.openAssignment("session", "assignment-final", {});
  assert.equal(result.status, "OPENED");
  assert.equal(JSON.stringify(result.projection).includes("sales_support_dialogue"), true);
});

void test("Reviewer 2 listing is actor-scoped and never returns Reviewer 1 submissions", async () => {
  let query: Record<string, unknown> | undefined;
  const r2 = "3fa33bbf-5911-46df-833a-2cb267b36f9e";
  const db = { oicDomainReviewAssignment: { findFirst: () => Promise.resolve(null), findMany: (input: { where: Record<string, unknown> }) => { query = input.where; return Promise.resolve([]); } } };
  const reviewer2 = { resolveSession: () => Promise.resolve({ id: r2, applicationId: appId, sessionId: "session-r2" }) };
  const service = new DomainReviewService(db as never, {} as never, reviewer2 as never);
  const result = await service.listAssignments("session-r2");
  const observedQuery = query;
  assert.equal(observedQuery?.humanIdentityId, r2);
  assert.deepEqual(result.assignments, []);
  assert.equal(JSON.stringify(result).includes(reviewerId), false);
});

void test("a service principal without the assigned human review session cannot attest", async () => {
  const noHumanSession = { resolveSession: () => Promise.reject(new ConflictException("REVIEWER_SESSION_EXPIRED")) };
  const service = new DomainReviewService({} as never, {} as never, noHumanSession as never);
  await assert.rejects(service.attestConflict("machine-token", declarations, {}), /REVIEWER_SESSION_EXPIRED/);
});

void test("historical submission reconciliation appends actual declaration time and preserves submission timestamps", async () => {
  const submittedAt = new Date("2026-10-16T08:30:00Z");
  const events: Array<Record<string, unknown>> = [];
  const tx = { oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { const event = { ...data, id: `audit-${events.length + 1}`, occurredAt: new Date("2026-10-16T11:00:00Z") }; events.push(event); return Promise.resolve(event); } } };
  const batchAssignments = [{ submissions: Array.from({ length: 8 }, (_, index) => ({ id: `submission-${index + 1}`, submittedAt, evidenceDigest: `${index}`.repeat(64) })) }];
  const db = {
    oicDomainReviewAssignment: { findFirst: () => Promise.resolve({ reviewerRole: "PRIMARY", pack: { manifest: {}, cases: [] }, batch: { id: "batch-75", conflictScope: scope, assignments: batchAssignments } }) },
    $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)
  };
  const service = new DomainReviewService(db as never, {} as never, reviewer as never);
  const result = await service.attestConflict("session", declarations, { requestId: "r" });
  assert.equal(result.state, "CLEARED");
  assert.equal(result.reconciledPriorSubmissions, 8);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.action, "review.conflict.attested");
  assert.equal(events[1]?.action, "evaluation.domain_review.conflict_reconciled");
  const metadata = events[1]?.metadata as Record<string, unknown>;
  assert.deepEqual((metadata.priorSubmissions as Array<{ submittedAt: Date }>).map((item) => item.submittedAt), Array(8).fill(submittedAt));
  assert.deepEqual((metadata.priorSubmissions as Array<{ evidenceDigest: string }>).map((item) => item.evidenceDigest), Array.from({ length: 8 }, (_, index) => `${index}`.repeat(64)));
  assert.equal(metadata.attestedAt instanceof Date, true);
  assert.equal(metadata.lineage, "SUBMISSIONS_PRECEDED_DISCOVERY_AND_SCOPED_ATTESTATION; ELIGIBILITY_RECONCILED_AFTER_ATTESTATION");
});
