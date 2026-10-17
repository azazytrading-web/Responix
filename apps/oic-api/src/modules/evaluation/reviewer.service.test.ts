/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-floating-promises */
import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Prisma, type OicDatabaseService } from "@oic/database";
import { verifyCredential } from "../identity/credential.crypto";
import { createHumanPasswordVerifier, deriveBooleanInterRaterOutcome, deriveHumanReviewMode, isSafeBlindProjection, isSafeReviewProjection, ReviewerService } from "./reviewer.service";

const appId = "8b0a5c13-89ce-450b-b0eb-4ddb617cf2b9";
const principalId = "5c3f0065-160c-4ec0-8cb1-8ecbcae92fc4";
const humanId = "b1b27c2a-0e12-4cbc-b837-ffab0fdcf317";
const executionId = "11b27c2a-0e12-4cbc-b837-ffab0fdcf317";
const manifestId = "21b27c2a-0e12-4cbc-b837-ffab0fdcf317";
const judgeId = "31b27c2a-0e12-4cbc-b837-ffab0fdcf317";
const metricId = "41b27c2a-0e12-4cbc-b837-ffab0fdcf317";
const password = "private-reviewer-passphrase-2026";
const capabilities = ["oic:evaluation:review:read", "oic:evaluation:review:submit", "oic:evaluation:review:calibrate"];

test("local human verifier uses scrypt and does not return the password", async () => {
  const verifier = await createHumanPasswordVerifier(password);
  assert.match(verifier, /^scrypt\$1\$/);
  assert.equal(verifier.includes(password), false);
  assert.equal(await verifyCredential(password, verifier), true);
  assert.equal(await verifyCredential("wrong-reviewer-password", verifier), false);
  await assert.rejects(createHumanPasswordVerifier("too-short"));
});

test("review mode follows the published metric type and single Boolean projection cannot fabricate response B", () => {
  assert.equal(deriveHumanReviewMode({ type: "BOOLEAN" }), "SINGLE_BOOLEAN");
  assert.equal(deriveHumanReviewMode({ type: "PAIRWISE" }), "PAIRWISE");
  assert.equal(deriveHumanReviewMode({ type: "CATEGORY" }), null);
  assert.equal(isSafeReviewProjection({ prompt: "Assess instruction adherence.", rubric: "Check only the visible instruction and response.", candidates: [{ label: "CANDIDATE", content: "A concise response." }] }, "SINGLE_BOOLEAN"), true);
  assert.equal(isSafeReviewProjection({ prompt: "Assess instruction adherence.", candidates: [{ label: "CANDIDATE", content: "A" }, { label: "B", content: "B" }] }, "SINGLE_BOOLEAN"), false);
  assert.equal(isSafeReviewProjection({ candidates: [{ label: "A", content: "A" }, { label: "B", content: "B" }] }, "PAIRWISE"), true);
  assert.equal(isSafeReviewProjection({ candidates: [{ label: "CANDIDATE", content: "A" }] }, "PAIRWISE"), false);
  assert.equal(isSafeReviewProjection({ candidates: [{ label: "CANDIDATE", content: "A" }], oracle: "hidden" }, "SINGLE_BOOLEAN"), false);
});

test("inter-rater evidence derives from two actual Boolean submissions and preserves abstention as missing", () => {
  assert.deepEqual(deriveBooleanInterRaterOutcome([{ value: true, abstained: false }, { value: true, abstained: false }]), { outcome: "AGREEMENT", agreement: true, abstentionCount: 0 });
  assert.deepEqual(deriveBooleanInterRaterOutcome([{ value: false, abstained: false }, { value: false, abstained: false }]), { outcome: "AGREEMENT", agreement: true, abstentionCount: 0 });
  assert.deepEqual(deriveBooleanInterRaterOutcome([{ value: true, abstained: false }, { value: false, abstained: false }]), { outcome: "DISAGREEMENT", agreement: false, abstentionCount: 0 });
  assert.deepEqual(deriveBooleanInterRaterOutcome([{ value: true, abstained: false }, { abstained: true }]), { outcome: "ABSTAINED", agreement: null, abstentionCount: 1 });
  assert.deepEqual(deriveBooleanInterRaterOutcome([{ value: true, abstained: false }]), { outcome: "INCOMPLETE", agreement: null, abstentionCount: 0 });
  assert.deepEqual(deriveBooleanInterRaterOutcome([{ value: false, abstained: false }, { value: true, abstained: false }]), { outcome: "DISAGREEMENT", agreement: false, abstentionCount: 0 });
  assert.throws(() => deriveBooleanInterRaterOutcome([{ value: undefined, abstained: false }, { value: false, abstained: false }]), ConflictException);
  assert.throws(() => deriveBooleanInterRaterOutcome([{ value: "unknown", abstained: false }, { value: false, abstained: false }]), ConflictException);
});

test("disagreement evidence preserves both synthetic submissions, attribution, projection and audit in either reviewer order", async (t) => {
  for (const [name, values] of [["TRUE/FALSE", [true, false]], ["FALSE/TRUE", [false, true]]] as const) {
    await t.test(name, async () => {
      const reviewerA = randomUUID();
      const reviewerB = randomUUID();
      const submissionA = { id: randomUUID(), humanIdentityId: reviewerA, value: values[0], abstained: false, evidenceDigest: "a".repeat(64) };
      const submissionB = { id: randomUUID(), humanIdentityId: reviewerB, value: values[1], abstained: false, evidenceDigest: "b".repeat(64) };
      const originalSubmissions = structuredClone([submissionA, submissionB]);
      const createdEvidence: Array<Record<string, unknown>> = [];
      const auditEvents: Array<Record<string, unknown>> = [];
      let submissionUpdateCalls = 0;
      const execution = { id: randomUUID(), itemKey: "synthetic-test-item", ordinal: 1 };
      const protocol = { id: manifestId, applicationId: appId, tenantId: null, status: "PUBLISHED", executions: [execution] };
      const db = {
        oicReviewFixtureProtocol: { findFirst: async () => protocol },
        oicReviewAssignment: { findMany: async () => [
          { id: randomUUID(), humanIdentityId: reviewerA, submissions: [submissionA] },
          { id: randomUUID(), humanIdentityId: reviewerB, submissions: [submissionB] }
        ] },
        oicReviewInterRaterEvidence: { findUnique: async () => null },
        oicReviewSubmission: { update: async () => { submissionUpdateCalls += 1; } },
        $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({
          oicReviewInterRaterEvidence: { create: async ({ data }: { data: Record<string, unknown> }) => { const row = { id: randomUUID(), ...data }; createdEvidence.push(row); return row; } },
          oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { auditEvents.push(data); return data; } }
        })
      } as unknown as OicDatabaseService;
      const service = new ReviewerService(db, {} as never);
      const result = await service.computeLocalFixtureInterRater({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, manifestId, {});
      assert.equal(result.complete, true);
      assert.equal(result.genuineDisagreementCount, 1);
      assert.equal(result.evidence[0]?.outcome, "DISAGREEMENT");
      assert.equal(result.evidence[0]?.agreement, false);
      assert.equal(/^[a-f0-9]{64}$/.test(result.evidence[0]?.evidenceDigest ?? ""), true);
      assert.deepEqual(createdEvidence[0]?.submissionIds, [submissionA.id, submissionB.id].sort());
      assert.equal(createdEvidence[0]?.outcome, "DISAGREEMENT");
      assert.equal(auditEvents.length, 1);
      assert.deepEqual((auditEvents[0]?.metadata as Record<string, unknown>).submissionIds, [submissionA.id, submissionB.id].sort());
      assert.equal((auditEvents[0]?.metadata as Record<string, unknown>).outcome, "DISAGREEMENT");
      assert.deepEqual([submissionA, submissionB], originalSubmissions);
      assert.equal(submissionUpdateCalls, 0);
      assert.equal("value" in (result.evidence[0] ?? {}), false);
    });
  }
});

test("adjudication accepts genuine disagreement without modifying its immutable source submissions", async () => {
  const reviewerA = randomUUID();
  const reviewerB = randomUUID();
  const submissionA = { id: randomUUID(), humanIdentityId: reviewerA, value: true, abstained: false, evidenceDigest: "c".repeat(64), assignment: { caseExecutionId: executionId, blindedItemId: "blind-item", protocolRevisionId: manifestId, judgeRevisionId: judgeId, metricRevisionId: metricId } };
  const submissionB = { id: randomUUID(), humanIdentityId: reviewerB, value: false, abstained: false, evidenceDigest: "d".repeat(64), assignment: { ...submissionA.assignment } };
  const originalSubmissions = structuredClone([submissionA, submissionB]);
  let createdAdjudication: Record<string, unknown> | undefined;
  let audit: Record<string, unknown> | undefined;
  let submissionUpdateCalls = 0;
  const session = { applicationId: appId, revokedAt: null, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), lastSeenAt: new Date(), humanIdentityId: principalId, humanIdentity: { status: "ACTIVE", displayLabel: "Synthetic adjudicator" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const db = {
    oicReviewerSession: { findUnique: async () => session },
    oicReviewerAuthorization: { findFirst: async () => ({ capability: "oic:evaluation:review:adjudicate" }) },
    oicReviewSubmission: { findMany: async () => [submissionA, submissionB], update: async () => { submissionUpdateCalls += 1; } },
    oicEvaluationMetricRevision: { findFirst: async () => ({ definition: { type: "BOOLEAN" } }) },
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({
      oicReviewAdjudication: { create: async ({ data }: { data: Record<string, unknown> }) => { createdAdjudication = { id: randomUUID(), ...data }; return createdAdjudication; } },
      oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { audit = data; return data; } }
    })
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const result = await service.adjudicate("synthetic-session-token-long-enough-for-tests", { submissionIds: [submissionA.id, submissionB.id], decision: true }, {});
  assert.equal(result.decisionEligible, false);
  assert.deepEqual(createdAdjudication?.sourceSubmissionIds, [submissionA.id, submissionB.id]);
  assert.equal(audit?.action, "review.adjudication.completed");
  assert.equal((audit?.metadata as Record<string, unknown>).evidenceDigest, createdAdjudication?.evidenceDigest);
  assert.deepEqual([submissionA, submissionB], originalSubmissions);
  assert.equal(submissionUpdateCalls, 0);
  submissionB.value = true;
  await assert.rejects(service.adjudicate("synthetic-session-token-long-enough-for-tests", { submissionIds: [submissionA.id, submissionB.id], decision: true }, {}), /Adjudication requires disagreement or abstention evidence/);
  await assert.rejects(service.adjudicate("synthetic-session-token-long-enough-for-tests", { submissionIds: [submissionA.id, submissionA.id], decision: true }, {}), BadRequestException);
});

test("reviewer identity setup requires the existing application-scoped principal administration authority", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  await assert.rejects(service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, { applicationId: appId, displayLabel: "Reviewer", loginHandle: "reviewer.one", password, capabilities }, {}), ForbiddenException);
});

test("reviewer registry is application-scoped and returns only safe identity and eligibility fields", async () => {
  const createdAt = new Date("2026-10-14T08:00:00.000Z");
  const expiresAt = new Date("2026-11-14T08:00:00.000Z");
  let query: Record<string, unknown> | undefined;
  const db = {
    oicHumanIdentity: {
      findMany: async (input: Record<string, unknown>) => {
        query = input;
        return [{
          id: humanId, displayLabel: "Reviewer A", status: "ACTIVE", createdAt, disabledAt: null,
          memberships: [{ status: "ACTIVE", tenantId: null, createdAt }],
          authSubjects: [{ loginHandle: "reviewer.a", status: "ACTIVE", createdAt, verifier: "must-not-be-selected" }],
          authorizations: [{ capability: "oic:evaluation:review:submit", status: "ACTIVE", effectiveAt: createdAt, revokedAt: null }],
          calibrations: [{ eligibility: "ELIGIBLE", expiresAt, completedAt: createdAt, answers: "must-not-be-selected" }]
        }];
      }
    }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const result = await service.listIdentities({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, appId);
  assert.deepEqual((query?.where as Record<string, unknown>).memberships, { some: { applicationId: appId } });
  assert.deepEqual((query?.select as Record<string, unknown>).authSubjects, { where: { kind: "LOCAL" }, select: { loginHandle: true, status: true, createdAt: true } });
  assert.equal(result[0]?.id, humanId);
  assert.equal(result[0]?.calibration?.eligibility, "ELIGIBLE");
  assert.equal(JSON.stringify(result).includes("must-not-be-selected"), false);
  assert.equal(JSON.stringify(result).includes("verifier"), false);
  await assert.rejects(service.listIdentities({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, appId), ForbiddenException);
  await assert.rejects(service.listIdentities({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, randomUUID()), ForbiddenException);
});

test("calibration readback verifies durable audit evidence, reports expiry and omits answer material", async () => {
  const reviewerA = humanId;
  const reviewerB = randomUUID();
  const reviewerC = randomUUID();
  const calibrationA = randomUUID();
  const calibrationB = randomUUID();
  let calibrationSelect: Record<string, unknown> | undefined;
  const db = {
    oicHumanIdentity: { findMany: async () => [{ id: reviewerA }, { id: reviewerB }, { id: reviewerC }] },
    oicReviewerCalibration: { findMany: async (query: Record<string, unknown>) => { calibrationSelect = query.select as Record<string, unknown>; return [
      { id: calibrationA, humanIdentityId: reviewerA, policyId: "policy-a", eligibility: "ELIGIBLE", agreement: 1, anchorCount: 3, abstentions: [], completedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), evidenceDigest: "a".repeat(64), answers: { private: "must-not-leave" }, supersededBy: [], policy: { revision: 1, applicationId: appId } },
      { id: calibrationB, humanIdentityId: reviewerB, policyId: "policy-b", eligibility: "ELIGIBLE", agreement: 1, anchorCount: 3, abstentions: ["one"], completedAt: new Date(), expiresAt: new Date(Date.now() - 1000), evidenceDigest: "b".repeat(64), answers: { private: "must-not-leave" }, supersededBy: [], policy: { revision: 2, applicationId: appId } }
    ]; } },
    oicAuditEvent: { findMany: async () => [{ id: randomUUID(), actorHumanIdentityId: reviewerA, targetId: calibrationA, action: "review.calibration.completed", occurredAt: new Date(), metadata: { policyId: "policy-a", eligibility: "ELIGIBLE", anchorCount: 3, agreement: 1 } }] }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const rows = await service.listCalibrationReadback({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, appId);
  assert.deepEqual(rows.map((row) => [row.humanIdentityId, row.eligibility, row.audit.status]), [[reviewerA, "ELIGIBLE", "VERIFIED"], [reviewerB, "EXPIRED", "MISSING"], [reviewerC, "NOT_CALIBRATED", "MISSING"]]);
  assert.equal(rows[0]?.agreement, 1);
  assert.equal(rows[0]?.anchorCount, 3);
  assert.equal(rows[0]?.abstentionCount, 0);
  assert.equal(rows[0]?.evidenceDigestPresent, true);
  assert.equal(JSON.stringify(rows).includes("must-not-leave"), false);
  assert.equal("answers" in (calibrationSelect ?? {}), false);
  await assert.rejects(service.listCalibrationReadback({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, appId), ForbiddenException);
  await assert.rejects(service.listCalibrationReadback({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, randomUUID()), ForbiddenException);
});

test("conflict readback verifies immutable human audit evidence without returning declarations", async () => {
  const policyId = randomUUID();
  const occurredAt = new Date();
  const declarations = { didNotAuthor: true, didNotPublish: true, didNotOperate: true, didNotOwn: true, didNotAccessOracle: true, noOtherProtocolConflict: true };
  const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value) ?? "null";
  const metadata = { policyId, protocolRevisionId: manifestId, declarations, knownHumanConflictCheck: "NO_MATCH", outcome: "CLEARED" };
  const evidenceDigest = createHash("sha256").update(canonical({ humanIdentityId: humanId, applicationId: appId, ...metadata })).digest("hex");
  let eventMetadata: Record<string, unknown> = { ...metadata, evidenceDigest };
  const db = {
    oicHumanIdentity: { findMany: async () => [{ id: humanId }] },
    oicReviewCalibrationPolicy: { findMany: async () => [{ id: policyId, revision: 2, judgeRevisionId: judgeId }] },
    oicEvaluationProtocolManifest: { findMany: async () => [{ id: manifestId, protocolVersion: 1, payload: { judgeRevisions: [{ id: judgeId }] } }] },
    oicReviewFixtureProtocol: { findMany: async () => [] },
    oicAuditEvent: { findMany: async () => [{ id: randomUUID(), actorType: "HUMAN_IDENTITY", actorHumanIdentityId: humanId, applicationId: appId, targetType: "review-conflict-attestation", targetId: randomUUID(), action: "review.conflict.attested", occurredAt, metadata: eventMetadata }] }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const actor = { id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] };
  const rows = await service.listConflictReadback(actor, appId);
  assert.equal(rows[0]?.state, "CLEARED");
  assert.equal(rows[0]?.evidenceDigestPresent, true);
  assert.deepEqual(rows[0]?.audit, { status: "VERIFIED", action: "review.conflict.attested", occurredAt });
  assert.equal(JSON.stringify(rows).includes("didNotAccessOracle"), false);
  assert.equal(JSON.stringify(rows).includes("NO_MATCH"), false);
  eventMetadata = { ...eventMetadata, evidenceDigest: "0".repeat(64) };
  const tampered = await service.listConflictReadback(actor, appId);
  assert.equal(tampered[0]?.state, "UNKNOWN");
  assert.equal((tampered[0]?.audit as Record<string, unknown>)?.status, "MISMATCH");
  await assert.rejects(service.listConflictReadback({ ...actor, scopes: ["oic:evaluation:manage"] }, appId), ForbiddenException);
  await assert.rejects(service.listConflictReadback(actor, randomUUID()), ForbiddenException);
});

test("conflict readback keeps absent declarations in an explicit non-cleared state", async () => {
  const db = {
    oicHumanIdentity: { findMany: async () => [{ id: humanId }] },
    oicReviewCalibrationPolicy: { findMany: async () => [{ id: randomUUID(), revision: 1, judgeRevisionId: judgeId }] },
    oicEvaluationProtocolManifest: { findMany: async () => [{ id: manifestId, protocolVersion: 1, payload: { judgeRevisions: [judgeId] } }] },
    oicReviewFixtureProtocol: { findMany: async () => [] },
    oicAuditEvent: { findMany: async () => [] }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const rows = await service.listConflictReadback({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, appId);
  assert.equal(rows[0]?.state, "REQUIRES_ATTESTATION");
  assert.deepEqual(rows[0]?.audit, { status: "MISSING" });
});

test("conflict readback reports unknown when a published calibration policy has no matching protocol", async () => {
  const policyId = randomUUID();
  const db = {
    oicHumanIdentity: { findMany: async () => [{ id: humanId }] },
    oicReviewCalibrationPolicy: { findMany: async () => [{ id: policyId, revision: 1, judgeRevisionId: judgeId }] },
    oicEvaluationProtocolManifest: { findMany: async () => [{ id: manifestId, protocolVersion: 1, payload: { judgeRevisions: [randomUUID()] } }] },
    oicReviewFixtureProtocol: { findMany: async () => [] },
    oicAuditEvent: { findMany: async () => [] }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const rows = await service.listConflictReadback({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, appId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.state, "UNKNOWN");
  assert.equal(rows[0]?.reason, "NO_MATCHING_PUBLISHED_PROTOCOL");
  assert.deepEqual(rows[0]?.audit, { status: "MISSING" });
});

test("machine administrator cannot submit a human conflict declaration without that reviewer's session", async () => {
  const db = { oicReviewerSession: { findUnique: async () => null } } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.attestConflict("machine-credential-is-not-a-reviewer-session", { policyId: randomUUID(), protocolRevisionId: randomUUID(), declarations: {} }, {}), UnauthorizedException);
});

test("conflict declarations require the human session and produce immutable audit lineage", async () => {
  const token = "r".repeat(48);
  const sessionId = randomUUID();
  const policyId = randomUUID();
  const now = new Date();
  const session = { id: sessionId, tokenHash: createHash("sha256").update(token).digest("hex"), applicationId: appId, humanIdentityId: humanId, revokedAt: null, expiresAt: new Date(now.getTime() + 60_000), idleExpiresAt: new Date(now.getTime() + 60_000), lastSeenAt: now, humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const events: Record<string, unknown>[] = [];
  let writes = 0;
  let knownConflict = false;
  const db = {
    oicReviewerSession: { findUnique: async () => session },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) },
    oicReviewerSessionUpdate: { update: async () => ({}) },
    oicReviewCalibrationPolicy: { findFirst: async () => ({ id: policyId, judgeRevisionId: judgeId }) },
    oicEvaluationProtocolManifest: { findFirst: async () => ({ id: manifestId, payload: { judgeRevisions: [{ id: judgeId }], releaseId: randomUUID() } }) },
    oicReviewFixtureProtocol: { findFirst: async () => null },
    oicEvaluationRelease: { findFirst: async () => null },
    oicReviewerCalibration: { findFirst: async () => ({ id: randomUUID() }) },
    oicAuditEvent: {
      findMany: async () => [...events].reverse(),
      findFirst: async () => knownConflict ? { id: randomUUID() } : null
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { writes++; const row = { id: randomUUID(), occurredAt: new Date(), ...data }; events.push(row); return row; } } })
  } as unknown as OicDatabaseService;
  const declarations = { didNotAuthor: true, didNotPublish: true, didNotOperate: true, didNotOwn: true, didNotAccessOracle: true, noOtherProtocolConflict: true };
  const service = new ReviewerService(db, {} as never);
  const first = await service.attestConflict(token, { policyId, protocolRevisionId: manifestId, declarations }, {});
  assert.equal(first.state, "CLEARED");
  assert.equal(writes, 1);
  const persisted = events[0] as Record<string, unknown>;
  assert.equal(persisted.actorType, "HUMAN_IDENTITY");
  assert.equal(persisted.actorHumanIdentityId, humanId);
  assert.equal(persisted.action, "review.conflict.attested");
  const metadata = persisted.metadata as Record<string, unknown>;
  assert.equal(metadata.outcome, "CLEARED");
  assert.equal(metadata.supersedesAuditEventId, null);
  assert.match(String(metadata.evidenceDigest), /^[a-f0-9]{64}$/);
  const duplicate = await service.attestConflict(token, { policyId, protocolRevisionId: manifestId, declarations }, {});
  assert.equal(duplicate.idempotent, true);
  assert.equal(writes, 1);
  const revised = await service.attestConflict(token, { policyId, protocolRevisionId: manifestId, declarations: { ...declarations, didNotOwn: false } }, {});
  assert.equal(revised.state, "CONFLICTED");
  assert.equal(writes, 2);
  assert.equal((events[1]?.metadata as Record<string, unknown>).supersedesAuditEventId, persisted.id);
  knownConflict = true;
  const known = await service.attestConflict(token, { policyId, protocolRevisionId: manifestId, declarations }, {});
  assert.equal(known.state, "CONFLICTED");
  assert.equal((events[2]?.metadata as Record<string, unknown>).supersedesAuditEventId, events[1]?.id);
});

test("reviewer onboarding stores only a verifier and writes a machine-attributed audit event", async () => {
  const writes: Record<string, unknown> = {};
  const tx = {
    oicHumanIdentity: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.human = data; return { id: randomUUID(), displayLabel: data.displayLabel, status: "ACTIVE", createdAt: new Date() }; } },
    oicHumanAuthSubject: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.subject = data; return { id: randomUUID() }; } },
    oicHumanApplicationMembership: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.membership = data; return { id: randomUUID() }; } },
    oicReviewerAuthorization: { createMany: async ({ data }: { data: unknown[] }) => { writes.grants = data; return { count: data.length }; } },
    oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.audit = data; return data; } }
  };
  const db = { oicApplication: { findFirst: async () => ({ id: appId }) }, oicTenant: { findFirst: async () => null }, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const result = await service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, { applicationId: appId, displayLabel: "Reviewer One", loginHandle: "reviewer.one", password, capabilities }, { requestId: "reviewer-onboard-1" });
  const subject = writes.subject as Record<string, unknown>;
  const audit = writes.audit as Record<string, unknown>;
  assert.equal("password" in result, false);
  assert.equal("token" in result, false);
  assert.equal(subject.verifier?.toString().includes(password), false);
  assert.equal(subject.loginHandle, "reviewer.one");
  assert.equal((writes.grants as { capability: string }[]).length, 3);
  assert.equal(audit.actorPrincipalId, principalId);
  assert.equal(audit.actorType, "SERVICE_PRINCIPAL");
  assert.equal(audit.action, "reviewer.identity.created");
});

test("duplicate reviewer login handles return a safe conflict after transaction rollback", async () => {
  let transactionStarted = false;
  const duplicate = new Prisma.PrismaClientKnownRequestError("Unique constraint failed for loginHandle", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["loginHandle"] }
  });
  const db = {
    oicApplication: { findFirst: async () => ({ id: appId }) },
    oicTenant: { findFirst: async () => null },
    $transaction: async () => { transactionStarted = true; throw duplicate; }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(
    service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, { applicationId: appId, displayLabel: "Reviewer One", loginHandle: "reviewer.one", password, capabilities }, {}),
    (error: unknown) => error instanceof ConflictException && JSON.stringify(error.getResponse()) === JSON.stringify({ code: "REVIEWER_LOGIN_HANDLE_EXISTS", message: "Reviewer login handle already exists" }) && !JSON.stringify(error.getResponse()).includes("Unique constraint")
  );
  assert.equal(transactionStarted, true);
});

test("review login returns a one-time opaque session while only a token digest is persisted", async () => {
  const humanId = randomUUID();
  const subjectId = randomUUID();
  const sessionId = randomUUID();
  const verifier = await createHumanPasswordVerifier(password);
  let persisted: Record<string, unknown> | undefined;
  const tx = {
    oicReviewerSession: { create: async ({ data }: { data: Record<string, unknown> }) => { persisted = data; return { id: sessionId, ...data }; } },
    oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data }
  };
  const db = {
    oicHumanAuthSubject: { findUnique: async () => ({ id: subjectId, humanIdentityId: humanId, kind: "LOCAL", status: "ACTIVE", revokedAt: null, verifier, humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer One" } }) },
    oicHumanApplicationMembership: { findFirst: async () => ({ id: randomUUID(), tenantId: null, status: "ACTIVE", revokedAt: null }) },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx)
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const result = await service.login("reviewer.one", password, appId, "127.0.0.1", {});
  assert.equal(result.human.id, humanId);
  assert.equal(result.token.length >= 40, true);
  assert.equal(typeof persisted?.tokenHash, "string");
  assert.equal((persisted?.tokenHash as string).length, 64);
  assert.notEqual(persisted?.tokenHash, result.token);
});

test("blind projection accepts only opaque pair labels and rejects identity, scores, or oracle fields", () => {
  assert.equal(isSafeBlindProjection({ prompt: "Evaluate the responses", candidates: [{ label: "A", content: "First response" }, { label: "B", content: "Second response" }] }), true);
  assert.equal(isSafeBlindProjection({ candidates: [{ label: "A", content: "x", provider: "DeepSeek" }, { label: "B", content: "y" }] }), false);
  assert.equal(isSafeBlindProjection({ candidates: [{ label: "A", content: "x" }, { label: "B", content: "y" }], previousScores: [1, 2] }), false);
  assert.equal(isSafeBlindProjection({ candidates: [{ label: "A", content: "x" }, { label: "A", content: "y" }] }), false);
});

test("reviewer session rechecks active identity, authorization, and application scope", async () => {
  const now = new Date();
  const token = "r".repeat(48);
  const tokenHash = (await import("node:crypto")).createHash("sha256").update(token).digest("hex");
  const row = { id: randomUUID(), tokenHash, applicationId: appId, humanIdentityId: randomUUID(), revokedAt: null, expiresAt: new Date(now.getTime() + 60_000), idleExpiresAt: new Date(now.getTime() + 60_000), lastSeenAt: now, humanIdentity: { id: randomUUID(), status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const db = {
    oicReviewerSession: { findUnique: async () => row, update: async () => row },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const result = await service.resolveSession(token, "oic:evaluation:review:read", appId);
  assert.equal(result.applicationId, appId);
  await assert.rejects(service.resolveSession(token, "oic:evaluation:review:read", randomUUID()));
});

test("calibration compares against the protected reference artifact and never returns the reference answers", async () => {
  const token = "c".repeat(48);
  const tokenHash = (await import("node:crypto")).createHash("sha256").update(token).digest("hex");
  const humanId = randomUUID();
  const sessionId = randomUUID();
  const policyId = randomUUID();
  const referenceAnswers = { anchor1: "A", anchor2: "B" };
  const policy = { id: policyId, applicationId: appId, tenantId: null, status: "PUBLISHED", judgeRevisionId: randomUUID(), referenceArtifactId: randomUUID(), minimumAnchors: 2, minimumAgreement: 1, expiresAfterDays: 30 };
  const session = { id: sessionId, tokenHash, applicationId: appId, humanIdentityId: humanId, revokedAt: null, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), lastSeenAt: new Date(), humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const tx = {
    oicReviewerCalibration: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: randomUUID(), ...data, completedAt: new Date() }) },
    oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data }
  };
  const db = {
    oicReviewCalibrationPolicy: { findUnique: async () => policy },
    oicReviewerSession: { findUnique: async () => session, update: async () => session },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) },
    oicReviewerCalibration: { findFirst: async () => null },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx)
  } as unknown as OicDatabaseService;
  const vault = { read: async () => Buffer.from(JSON.stringify({ anchors: [{ id: "anchor1", prompt: "Choose A or B" }, { id: "anchor2", prompt: "Choose A or B" }], expectedAnswers: referenceAnswers })) };
  const service = new ReviewerService(db, vault as never);
  const result = await service.calibrate(token, { policyId, answers: referenceAnswers, abstentions: [] });
  assert.equal(result.eligibility, "ELIGIBLE");
  assert.equal(result.agreement, 1);
  assert.equal(JSON.stringify(result).includes("expectedAnswers"), false);
  assert.equal(JSON.stringify(result).includes('"anchor1":"A"'), false);
});

test("login failures are generic for unknown identities and never issue a reviewer session", async () => {
  let sessionCreates = 0;
  const db = {
    oicHumanAuthSubject: { findUnique: async () => null },
    oicHumanApplicationMembership: { findFirst: async () => null },
    $transaction: async () => { sessionCreates += 1; }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.login("missing.reviewer", "wrong-reviewer-password", appId, "127.0.0.2", {}), (error: unknown) => error instanceof UnauthorizedException && error.message === "Access could not be verified");
  assert.equal(sessionCreates, 0);
});

test("expired sessions and missing capabilities cannot be used for reviewer actions", async () => {
  const token = "e".repeat(48);
  const tokenHash = (await import("node:crypto")).createHash("sha256").update(token).digest("hex");
  const db = {
    oicReviewerSession: { findUnique: async () => ({ id: randomUUID(), tokenHash, applicationId: appId, humanIdentityId: humanId, revokedAt: null, expiresAt: new Date(Date.now() - 1000), idleExpiresAt: new Date(Date.now() + 60_000), lastSeenAt: new Date(), humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } }) },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.resolveSession(token, "oic:evaluation:review:read", appId), UnauthorizedException);
});

test("calibration publication rejects a digest that does not pin the supplied protected anchors", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  await assert.rejects(service.createCalibrationPolicy(
    { id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] },
    { applicationId: appId, judgeRevisionId: judgeId, revision: 1, calibrationSetDigest: "a".repeat(64), referenceAnswers: { anchors: [{ id: "anchor-1", prompt: "Choose A or B" }], expectedAnswers: { "anchor-1": "A" } }, minimumAgreement: 1, expiresAfterDays: 30 },
    {}
  ), /does not match the supplied anchor set/);
});

test("assignment creation is denied without current calibration and conflict clearance", async () => {
  let writes = 0;
  const db = {
    oicHumanIdentity: { findFirst: async () => ({ id: humanId }) },
    oicEvaluationCaseExecution: { findFirst: async () => ({ id: executionId }) },
    oicReviewFixtureExecution: { findFirst: async () => null },
    oicEvaluationProtocolManifest: { findFirst: async () => ({ id: manifestId, payload: { judgeRevisions: [judgeId] } }) },
    oicReviewFixtureProtocol: { findFirst: async () => null },
    oicEvaluationJudgeRevision: { findFirst: async () => ({ id: judgeId }) },
    oicEvaluationMetricRevision: { findFirst: async () => ({ id: metricId, definition: { type: "PAIRWISE" } }) },
    oicReviewerCalibration: { findFirst: async () => null },
    oicAuditEvent: { findMany: async () => [] },
    $transaction: async () => { writes++; }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.createAssignment({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, {
    humanIdentityId: humanId, applicationId: appId, caseExecutionId: executionId, protocolRevisionId: manifestId, judgeRevisionId: judgeId, metricRevisionId: metricId, blindedItemId: "blind-item-1",
    blindProjection: { prompt: "Compare the two responses", candidates: [{ label: "A", content: "First" }, { label: "B", content: "Second" }] },
    blindMapping: { A: "51b27c2a-0e12-4cbc-b837-ffab0fdcf317", B: "61b27c2a-0e12-4cbc-b837-ffab0fdcf317" }
  }, {}), ForbiddenException);
  assert.equal(writes, 0);
});

test("assignment creation records CLEARED only for the calibrated reviewer and exact attested protocol", async () => {
  const policyId = randomUUID();
  const calibrationId = randomUUID();
  const attestationId = randomUUID();
  let assignmentData: Record<string, unknown> | undefined;
  const declarations = { didNotAuthor: true, didNotPublish: true, didNotOperate: true, didNotOwn: true, didNotAccessOracle: true, noOtherProtocolConflict: true };
  const tx = { oicReviewAssignment: { create: async ({ data }: { data: Record<string, unknown> }) => { assignmentData = data; return { id: randomUUID(), status: "ASSIGNED" }; } }, oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data } };
  const db = {
    oicHumanIdentity: { findFirst: async () => ({ id: humanId }) },
    oicEvaluationCaseExecution: { findFirst: async () => ({ id: executionId }) },
    oicReviewFixtureExecution: { findFirst: async () => null },
    oicEvaluationProtocolManifest: { findFirst: async () => ({ id: manifestId, payload: { judgeRevisions: [{ id: judgeId }], metricRevisions: [{ id: metricId }], releaseId: randomUUID() } }) },
    oicReviewFixtureProtocol: { findFirst: async () => null },
    oicEvaluationRelease: { findFirst: async () => null },
    oicEvaluationJudgeRevision: { findFirst: async () => ({ id: judgeId }) },
    oicEvaluationMetricRevision: { findFirst: async () => ({ id: metricId, definition: { type: "PAIRWISE" } }) },
    oicReviewerCalibration: { findFirst: async () => ({ id: calibrationId, policyId, expiresAt: new Date(Date.now() + 60_000) }) },
    oicAuditEvent: { findMany: async () => [{ id: attestationId, occurredAt: new Date(), metadata: { policyId, protocolRevisionId: manifestId, outcome: "CLEARED", declarations, evidenceDigest: "c".repeat(64) } }], findFirst: async () => null },
    oicReviewCalibrationPolicy: { findFirst: async () => ({ id: policyId }) },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx)
  } as unknown as OicDatabaseService;
  const result = await new ReviewerService(db, {} as never).createAssignment({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, {
    humanIdentityId: humanId, applicationId: appId, caseExecutionId: executionId, protocolRevisionId: manifestId, judgeRevisionId: judgeId, metricRevisionId: metricId, blindedItemId: "same-blinded-item",
    blindProjection: { prompt: "Compare two responses", candidates: [{ label: "A", content: "First" }, { label: "B", content: "Second" }] },
    blindMapping: { A: randomUUID(), B: randomUUID() }
  }, {});
  assert.equal(result.conflictState, "CLEARED");
  assert.equal(result.eligibleForDecision, true);
  assert.equal(assignmentData?.conflictState, "CLEARED");
  assert.deepEqual(assignmentData?.eligibilitySnapshot && (assignmentData.eligibilitySnapshot as Record<string, unknown>).calibration, "ELIGIBLE");
  assert.equal(JSON.stringify(assignmentData).includes("provider"), false);
});

test("local fixture assignment preparation supports one cleared reviewer and is idempotent", async () => {
  const protocolId = randomUUID();
  const executionRows = [1, 2, 3].map((ordinal) => ({ id: randomUUID(), itemKey: `item-${ordinal}`, ordinal, blindProjection: { prompt: "Read the criterion", candidates: [{ label: "CANDIDATE", content: `Response ${ordinal}` }] } }));
  let existing: Array<{ id: string; humanIdentityId: string; caseExecutionId: string; blindedItemId: string }> = [];
  const db = {
    oicReviewFixtureProtocol: { findFirst: async () => ({ id: protocolId, applicationId: appId, tenantId: null, protocolKey: "oic7-human-review-local-demo", status: "PUBLISHED", judgeRevisionId: judgeId, metricRevisionId: metricId, executions: executionRows }) },
    oicReviewAssignment: { findMany: async () => existing }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  const createdCalls: string[] = [];
  service.createAssignment = async (_actor, input) => {
    createdCalls.push(`${input.humanIdentityId}:${input.caseExecutionId}`);
    return { id: randomUUID(), status: "ASSIGNED", conflictState: "CLEARED", eligibleForDecision: true };
  };
  const actor = { id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] };
  const first = await service.createLocalFixtureAssignments(actor, { protocolRevisionId: protocolId, reviewerIds: [humanId] }, {});
  assert.equal(first.assignmentCount, 3);
  assert.equal(first.idempotent, false);
  assert.equal(createdCalls.length, 3);
  assert.ok(executionRows.every((execution) => createdCalls.includes(`${humanId}:${execution.id}`)));
  existing = [{ id: randomUUID(), humanIdentityId: humanId, caseExecutionId: executionRows[0]!.id, blindedItemId: `${protocolId}:${executionRows[0]!.itemKey}` }];
  const second = await service.createLocalFixtureAssignments(actor, { protocolRevisionId: protocolId, reviewerIds: [humanId] }, {});
  assert.equal(second.assignmentCount, 3);
  assert.equal(second.idempotent, true);
  assert.equal(createdCalls.length, 5);
  existing = executionRows.map((execution) => ({ id: randomUUID(), humanIdentityId: humanId, caseExecutionId: execution.id, blindedItemId: `${protocolId}:${execution.itemKey}` }));
  const third = await service.createLocalFixtureAssignments(actor, { protocolRevisionId: protocolId, reviewerIds: [humanId] }, {});
  assert.equal(third.assignmentCount, 3);
  assert.equal(third.idempotent, true);
  assert.equal(createdCalls.length, 5);
});

test("additional Packet 7.4 fixture batch is predeclared, rubric-pinned, and non-provider", async () => {
  const protocolData: Record<string, unknown>[] = [];
  let metricData: Record<string, unknown> | undefined;
  let executionData: Record<string, unknown>[] = [];
  const rubricDigest = "b".repeat(64);
  const fixtureId = randomUUID();
  const db = {
    oicEvaluationJudgeRevision: { findFirst: async () => ({ id: judgeId, revision: 1 }) },
    oicEvaluationMetricRevision: { create: async ({ data }: { data: Record<string, unknown> }) => { metricData = data; return { id: metricId }; } },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({
      oicReviewFixtureProtocol: { create: async ({ data }: { data: Record<string, unknown> }) => { protocolData.push(data); return { id: fixtureId, status: "DRAFT", definitionDigest: data.definitionDigest }; } },
      oicReviewFixtureExecution: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => { executionData = data; return { count: data.length }; } },
      oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => data }
    })
  } as unknown as OicDatabaseService;
  const vault = { store: async (bytes: Buffer) => { assert.equal(bytes.toString().includes("Judge only the visible instruction"), true); return { id: randomUUID(), digest: rubricDigest }; } };
  const actor = { id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] };
  const result = await new ReviewerService(db, vault as never).createLocalFixtureProtocol(actor, { applicationId: appId, judgeRevisionId: judgeId, batchKey: "oic7-human-review-local-demo-b2" }, {});
  const definition = protocolData[0]?.definition as Record<string, unknown>;
  assert.equal(result.status, "DRAFT");
  assert.equal(result.itemCount, 3);
  assert.equal(protocolData[0]?.protocolKey, "oic7-human-review-local-demo-b2");
  assert.equal(metricData?.metricKey, "oic7-human-instruction-adherence-b2");
  assert.equal(definition.targetClass, "STATIC_LOCAL_FIXTURE");
  assert.equal(definition.reviewMode, "SINGLE_BOOLEAN");
  assert.equal(definition.providerDispatchesAllowed, false);
  assert.equal(definition.providerDispatchCount, 0);
  assert.equal(definition.rubricDigest, rubricDigest);
  assert.deepEqual((definition.items as Array<{ itemKey: string }>).map((item) => item.itemKey), ["boundary-two-reasons", "boundary-one-reason", "boundary-two-ways"]);
  assert.equal(executionData.length, 3);
  assert.ok(executionData.every((row) => typeof (row.blindProjection as Record<string, unknown>).rubric === "string"));
  assert.equal(JSON.stringify(executionData).toLowerCase().includes("oracle"), false);
  assert.equal(JSON.stringify(executionData).toLowerCase().includes("provider"), false);
});

test("opening an assignment with UNKNOWN conflict is denied", async () => {
  const token = "o".repeat(48);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const assignment = { id: randomUUID(), humanIdentityId: humanId, applicationId: appId, tenantId: null, status: "ASSIGNED", conflictState: "UNKNOWN", deadlineAt: null, blindedItemId: "blind-item", protocolRevisionId: manifestId, judgeRevisionId: judgeId, metricRevisionId: metricId, blindProjection: { prompt: "Compare both answers.", rubric: "Choose the better answer.", candidates: [{ label: "A", content: "First answer" }, { label: "B", content: "Second answer" }] } };
  const now = new Date();
  const session = { id: randomUUID(), tokenHash, applicationId: appId, humanIdentityId: humanId, revokedAt: null, expiresAt: new Date(now.getTime() + 60_000), idleExpiresAt: new Date(now.getTime() + 60_000), lastSeenAt: now, humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const tx = { oicReviewAssignment: { updateMany: async () => ({ count: 1 }) }, oicAuditEvent: { create: async () => ({}) } };
  const db = {
    oicReviewAssignment: { findUnique: async () => assignment },
    oicReviewerSession: { findUnique: async () => session },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) },
    oicEvaluationMetricRevision: { findFirst: async () => ({ definition: { type: "PAIRWISE", rangeOrCategories: { categories: ["A", "B", "TIE"] }, hiddenReference: "must-not-leave-server" } }) },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx)
  } as unknown as OicDatabaseService;
  await assert.rejects(new ReviewerService(db, {} as never).openAssignment(token, assignment.id), ForbiddenException);
});

test("calibration policy read model returns presentation anchors and only the current reviewer's safe eligibility", async () => {
  const token = "c".repeat(48);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const policyId = randomUUID();
  const session = { id: randomUUID(), tokenHash, applicationId: appId, humanIdentityId: humanId, revokedAt: null, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), lastSeenAt: new Date(), humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const db = {
    oicReviewerSession: { findUnique: async () => session },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) },
    oicReviewCalibrationPolicy: { findMany: async () => [{ id: policyId, judgeRevisionId: judgeId, revision: 1, calibrationSetDigest: "a".repeat(64), referenceArtifactId: randomUUID(), minimumAnchors: 1, minimumAgreement: 1, expiresAfterDays: 90 }] },
    oicEvaluationJudgeRevision: { findMany: async () => [{ id: judgeId }] },
    oicReviewerCalibration: { findFirst: async () => ({ eligibility: "ELIGIBLE", expiresAt: new Date(Date.now() + 60_000), completedAt: new Date(), agreement: 1, anchorCount: 3, abstentions: ["private-anchor"], evidenceDigest: "d".repeat(64), answers: { private: "must-not-be-selected" } }) }
  } as unknown as OicDatabaseService;
  const vault = { read: async () => Buffer.from(JSON.stringify({ anchors: [{ id: "internal-anchor", language: "en", prompt: "Task: Choose. A: One. B: Two.", rubric: "Canonical rubric." }], expectedAnswers: { "internal-anchor": "A" } })) };
  const result = await new ReviewerService(db, vault as never).listCalibrationPolicies(token);
  assert.equal(result[0]?.reviewerCalibration?.eligibility, "ELIGIBLE");
  assert.equal(result[0]?.reviewerCalibration?.agreement, 1);
  assert.equal(result[0]?.reviewerCalibration?.anchorCount, 3);
  assert.equal(result[0]?.reviewerCalibration?.abstentionCount, 1);
  assert.equal(result[0]?.reviewerCalibration?.evidenceDigest, "d".repeat(64));
  assert.equal(JSON.stringify(result).includes("must-not-be-selected"), false);
  assert.equal(JSON.stringify(result).includes("private-anchor"), false);
  assert.equal((result[0]?.anchors[0] as { prompt?: string } | undefined)?.prompt, "Task: Choose. A: One. B: Two.");
  assert.equal(JSON.stringify(result).includes("expectedAnswers"), false);
  assert.equal(JSON.stringify(result).includes('"A"'), false);
});

test("reassignment of UNKNOWN assignments is denied", async () => {
  const previousId = randomUUID();
  const replacementId = randomUUID();
  const original = { id: previousId, humanIdentityId: humanId, applicationId: appId, tenantId: null, caseExecutionId: executionId, protocolRevisionId: manifestId, judgeRevisionId: judgeId, metricRevisionId: metricId, blindedItemId: "blind-item-1", blindProjection: { prompt: "Compare", candidates: [{ label: "A", content: "first" }, { label: "B", content: "second" }] }, blindMapping: { A: randomUUID(), B: randomUUID() }, randomizedOrder: ["A", "B"], conflictState: "UNKNOWN", conflictEvidence: {}, eligibilitySnapshot: {}, status: "OPENED", deadlineAt: null };
  let invalidated = false;
  const db = {
    oicReviewAssignment: { findFirst: async () => original },
    $transaction: async () => { invalidated = true; }
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.reassignAssignment({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, { applicationId: appId, assignmentId: previousId, humanIdentityId: replacementId }, {}), ForbiddenException);
  assert.equal(invalidated, false);
});

test("submission fails closed when current calibration is absent", async () => {
  const token = "s".repeat(48);
  const tokenHash = (await import("node:crypto")).createHash("sha256").update(token).digest("hex");
  const assignment = { id: randomUUID(), applicationId: appId, tenantId: null, humanIdentityId: humanId, status: "OPENED", conflictState: "CLEARED", metricRevisionId: metricId, judgeRevisionId: judgeId, protocolRevisionId: manifestId, blindedItemId: "blind-item-1" };
  let submissionData: Record<string, unknown> | undefined;
  const tx = {
    oicReviewSubmission: { create: async ({ data }: { data: Record<string, unknown> }) => { submissionData = data; return { id: randomUUID(), submittedAt: new Date(), abstained: true }; } },
    oicReviewAssignment: { update: async () => ({}) },
    oicAuditEvent: { create: async () => ({}) }
  };
  const session = { id: randomUUID(), tokenHash, applicationId: appId, humanIdentityId: humanId, revokedAt: null, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), lastSeenAt: new Date(), humanIdentity: { id: humanId, status: "ACTIVE", displayLabel: "Reviewer" }, authSubject: { status: "ACTIVE", revokedAt: null }, membership: { status: "ACTIVE", revokedAt: null, tenantId: null } };
  const db = {
    oicReviewAssignment: { findUnique: async () => assignment },
    oicReviewerSession: { findUnique: async () => session, update: async () => session },
    oicReviewerAuthorization: { findFirst: async () => ({ id: randomUUID() }) },
    oicReviewerCalibration: { findFirst: async () => null },
    oicReviewFixtureProtocol: { findFirst: async () => null },
    oicEvaluationProtocolManifest: { findFirst: async () => ({ id: manifestId, payload: { judgeRevisions: [judgeId], metricRevisions: [metricId] } }) },
    oicEvaluationCaseExecution: { findFirst: async () => ({ id: executionId }) },
    oicReviewFixtureExecution: { findFirst: async () => null },
    oicEvaluationMetricRevision: { findFirst: async () => ({ id: metricId, definition: { type: "PAIRWISE" } }) },
    oicReviewCalibrationPolicy: { findFirst: async () => ({ id: randomUUID() }) },
    oicAuditEvent: { findMany: async () => [] },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx)
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.submit(token, assignment.id, { abstained: true }, {}), ForbiddenException);
  assert.equal(submissionData?.value, undefined);
  assert.equal(submissionData, undefined);
});

test("logout revokes only the server-resolved session and records a human actor", async () => {
  const token = "l".repeat(48);
  const tokenHash = (await import("node:crypto")).createHash("sha256").update(token).digest("hex");
  const sessionId = randomUUID();
  let updateId = "";
  let queriedHash = "";
  let audit: Record<string, unknown> | undefined;
  const tx = {
    oicReviewerSession: { update: async ({ where }: { where: { id: string } }) => { updateId = where.id; return {}; } },
    oicAuditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { audit = data; return data; } }
  };
  const db = {
    oicReviewerSession: { findUnique: async ({ where }: { where: { tokenHash: string } }) => { queriedHash = where.tokenHash; return { id: sessionId, humanIdentityId: humanId, applicationId: appId, membership: { tenantId: null }, revokedAt: null }; } },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx)
  } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await service.logout(token, {});
  assert.equal(queriedHash, tokenHash);
  assert.notEqual(queriedHash, token);
  assert.equal(updateId, sessionId);
  assert.equal(audit?.actorType, "HUMAN_IDENTITY");
  assert.equal(audit?.actorHumanIdentityId, humanId);
});

const safeProjection = { prompt: "Compare the responses", candidates: [{ label: "A", content: "First" }, { label: "B", content: "Second" }] };
for (const field of ["modelIdentity", "providerIdentity", "trueCandidateIdentity", "competingTargetIdentity", "previousScores", "otherReviewer", "otherReviewerScores", "goldAnswer", "protectedOracle", "campaignResult"]) {
  void test(`blind projection rejects protected ${field} fields`, () => {
    assert.equal(isSafeBlindProjection({ ...safeProjection, [field]: "must stay hidden" }), false);
  });
}

test("blind projection enforces bounded text and rejects secret-like candidate content", () => {
  assert.equal(isSafeBlindProjection({ ...safeProjection, prompt: "x".repeat(4001) }), false);
  assert.equal(isSafeBlindProjection({ prompt: "Compare", candidates: [{ label: "A", content: "x".repeat(8001) }, { label: "B", content: "safe" }] }), false);
  assert.equal(isSafeBlindProjection({ prompt: "Compare", candidates: [{ label: "A", content: "Bearer oic_v1.secret-token" }, { label: "B", content: "safe" }] }), false);
});

test("reviewer administration cannot inherit evaluation or Foundation machine scopes", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  await assert.rejects(service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, { applicationId: appId, displayLabel: "Reviewer", loginHandle: "reviewer.two", password, capabilities }, {}), ForbiddenException);
  await assert.rejects(service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, { applicationId: randomUUID(), displayLabel: "Reviewer", loginHandle: "reviewer.two", password, capabilities }, {}), ForbiddenException);
  await assert.rejects(service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, { applicationId: appId, displayLabel: "Reviewer", loginHandle: "reviewer.two", password, capabilities: ["oic:evaluation:manage"] }, {}), /Invalid reviewer setup/);
});

test("review authorization administration requires principal management authority", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  await assert.rejects(service.setAuthorization({ id: principalId, applicationId: appId, scopes: ["oic:evaluation:manage"], tenantIds: [] }, { applicationId: appId, humanIdentityId: humanId, capability: "oic:evaluation:review:submit", revoke: true }, {}), ForbiddenException);
  await assert.rejects(service.setAuthorization({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, { applicationId: appId, humanIdentityId: humanId, capability: "oic:evaluation:manage", revoke: false }, {}), /Unsupported reviewer capability/);
});

test("reviewer onboarding refuses tenant membership outside the target application", async () => {
  const db = { oicApplication: { findFirst: async () => ({ id: appId }) }, oicTenant: { findFirst: async () => null } } as unknown as OicDatabaseService;
  const service = new ReviewerService(db, {} as never);
  await assert.rejects(service.createIdentity({ id: principalId, applicationId: appId, scopes: ["oic:principals:manage"], tenantIds: [] }, { applicationId: appId, tenantId: randomUUID(), displayLabel: "Reviewer", loginHandle: "reviewer.tenant", password, capabilities }, {}), ForbiddenException);
});

test("review submission rejects missing values and secret-bearing rationale before database access", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  await assert.rejects(service.submit("x".repeat(48), randomUUID(), { abstained: false }, {}), /bounded, non-sensitive/);
  await assert.rejects(service.submit("x".repeat(48), randomUUID(), { abstained: true, rationale: "api_key=private" }, {}), /bounded, non-sensitive/);
});

test("review session resolver rejects malformed browser tokens before database access", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  await assert.rejects(service.resolveSession("too-short", "oic:evaluation:review:read", appId), UnauthorizedException);
});

test("review login bounds repeated attempts per remote address without revealing identity existence", async () => {
  const service = new ReviewerService({} as OicDatabaseService, {} as never);
  for (let attempt = 0; attempt < 9; attempt += 1) {
    await assert.rejects(service.login("unknown", "x".repeat(1025), appId, "review-test-rate-limit", {}), (error: unknown) => error instanceof UnauthorizedException && error.message === "Access could not be verified");
  }
});
