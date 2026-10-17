import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { OicDatabaseService, Prisma } from "@oic/database";
import { verifyCredential } from "../identity/credential.crypto";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { EvaluationArtifactVault, sealEvaluationArtifact } from "./artifact-vault";

const LOGIN_LIMIT = 8;
const loginWindows = new Map<string, { start: number; count: number }>();
const IDLE_MS = 30 * 60_000;
const ABSOLUTE_MS = 8 * 60 * 60_000;
const capabilities = new Set(["oic:evaluation:review:read", "oic:evaluation:review:submit", "oic:evaluation:review:calibrate", "oic:evaluation:review:adjudicate"]);
const allowedProjectionKeys = new Set(["prompt", "instructions", "rubric", "candidates", "itemLabel", "language", "taskType"]);
const sensitiveTextPattern = /(?:bearer\s+oic_v1\.|sk-[A-Za-z0-9]{12,}|api[_ -]?key\s*[:=]|password\s*[:=]|-----BEGIN)/i;
const conflictDeclarationKeys = ["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"] as const;

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, value) => error ? reject(error) : resolve(value)));
}

export async function createHumanPasswordVerifier(password: string): Promise<string> {
  if (password.length < 14 || Buffer.byteLength(password) > 1024) throw new BadRequestException("Password does not meet the local reviewer policy");
  const salt = randomBytes(16).toString("base64url");
  const digest = await scrypt(password, salt);
  return `scrypt$1$${salt}$${digest.toString("hex")}`;
}

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
function requestIds(request: { requestId?: string; traceId?: string }) {
  const safe = (value?: string) => value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : undefined;
  return { requestId: safe(request.requestId), traceId: safe(request.traceId) };
}
export function isSafeBlindProjection(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !allowedProjectionKeys.has(key)) || Object.keys(row).length === 0) return false;
  for (const key of ["prompt", "instructions", "rubric", "itemLabel", "language", "taskType"]) if (row[key] !== undefined && (typeof row[key] !== "string" || row[key].length > 4000 || sensitiveTextPattern.test(row[key]))) return false;
  const candidates: unknown[] = Array.isArray(row.candidates) ? row.candidates : [];
  if (candidates.length !== 2) return false;
  const labels: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || (item.label !== "A" && item.label !== "B") || typeof item.content !== "string" || item.content.length > 8000 || sensitiveTextPattern.test(item.content)) return false;
    labels.push(item.label);
  }
  if (new Set(labels).size !== 2) return false;
  return true;
}
export type HumanReviewMode = "PAIRWISE" | "SINGLE_BOOLEAN";
export function deriveHumanReviewMode(metricDefinition: unknown): HumanReviewMode | null {
  if (!metricDefinition || typeof metricDefinition !== "object" || Array.isArray(metricDefinition)) return null;
  const type = (metricDefinition as Record<string, unknown>).type;
  if (type === "BOOLEAN") return "SINGLE_BOOLEAN";
  if (type === "PAIRWISE") return "PAIRWISE";
  return null;
}
export function deriveBooleanInterRaterOutcome(submissions: Array<{ value?: unknown; abstained: boolean }>): { outcome: "INCOMPLETE" | "ABSTAINED" | "AGREEMENT" | "DISAGREEMENT"; agreement: boolean | null; abstentionCount: number } {
  if (submissions.length !== 2 || submissions.some((submission) => typeof submission.abstained !== "boolean")) return { outcome: "INCOMPLETE", agreement: null, abstentionCount: submissions.filter((submission) => submission.abstained === true).length };
  const abstentionCount = submissions.filter((submission) => submission.abstained).length;
  if (abstentionCount) return { outcome: "ABSTAINED", agreement: null, abstentionCount };
  if (submissions.some((submission) => typeof submission.value !== "boolean")) throw new ConflictException("BOOLEAN_REVIEW_SUBMISSION_INVALID");
  const agreement = submissions[0]!.value === submissions[1]!.value;
  return { outcome: agreement ? "AGREEMENT" : "DISAGREEMENT", agreement, abstentionCount: 0 };
}
export function isSafeReviewProjection(value: unknown, mode: HumanReviewMode): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (mode === "PAIRWISE") return isSafeBlindProjection(value);
  if (Object.keys(row).some((key) => !allowedProjectionKeys.has(key)) || Object.keys(row).length === 0) return false;
  for (const key of ["prompt", "instructions", "rubric", "itemLabel", "language", "taskType"]) if (row[key] !== undefined && (typeof row[key] !== "string" || row[key].length > 4000 || sensitiveTextPattern.test(row[key]))) return false;
  if (!Array.isArray(row.candidates) || row.candidates.length !== 1) return false;
  const candidate: unknown = row.candidates[0];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const item = candidate as Record<string, unknown>;
  return Object.keys(item).length === 2 && item.label === "CANDIDATE" && typeof item.content === "string" && item.content.length <= 8000 && !sensitiveTextPattern.test(item.content);
}
const localFixtureBatches = {
  "oic7-human-review-local-demo": [
  { itemKey: "instruction-format", prompt: "Provide two short bullet points describing two ways to save water.", candidateResponse: "- Turn off the tap while brushing.\n- Repair leaking faucets." },
  { itemKey: "instruction-count", prompt: "Name three colors, using a comma-separated list and no extra words.", candidateResponse: "Red, blue." },
  { itemKey: "instruction-boundary", prompt: "Reply with exactly one of these words: READY or WAITING.", candidateResponse: "READY." }
  ],
  "oic7-human-review-local-demo-b2": [
    { itemKey: "boundary-two-reasons", prompt: "Briefly give two reasons to save water.", candidateResponse: "It supports people and nature." },
    { itemKey: "boundary-one-reason", prompt: "Give one brief reason to save water.", candidateResponse: "It helps people and protects ecosystems." },
    { itemKey: "boundary-two-ways", prompt: "In a short sentence, name two ways to reduce household energy use.", candidateResponse: "Switch off unused lights, and unplug chargers." }
  ]
} as const;
type LocalFixtureBatchKey = keyof typeof localFixtureBatches;
function getLocalFixtureItems(batchKey: string): readonly { itemKey: string; prompt: string; candidateResponse: string }[] {
  return Object.hasOwn(localFixtureBatches, batchKey) ? localFixtureBatches[batchKey as LocalFixtureBatchKey] : [];
}
const localHumanRubric = "Judge only the visible instruction and candidate response. Select Meets the criterion only when the response satisfies every explicit content and format requirement. Select Does not meet the criterion when any explicit requirement is visibly missed. Do not infer hidden intent or consult an expected answer. If the visible evidence is insufficient, abstain only if this protocol permits abstention.";
function validMetricValue(value: unknown, definition: unknown): boolean {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return false;
  const row = definition as Record<string, unknown>;
  const range = row.rangeOrCategories && typeof row.rangeOrCategories === "object" && !Array.isArray(row.rangeOrCategories) ? row.rangeOrCategories as Record<string, unknown> : {};
  if (row.type === "BOOLEAN") return typeof value === "boolean";
  if (row.type === "COUNT" || row.type === "DECIMAL") return typeof value === "number" && Number.isFinite(value) && value >= Number(range.minimum) && value <= Number(range.maximum) && (row.type !== "COUNT" || Number.isInteger(value));
  if (row.type === "CATEGORY" || row.type === "PAIRWISE") return typeof value === "string" && Array.isArray(range.categories) && range.categories.includes(value);
  return false;
}
function isCalibrationAnchor(value: unknown): value is { id: string; prompt: string; rubric?: string; language?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).every((key) => ["id", "prompt", "rubric", "language"].includes(key)) &&
    typeof row.id === "string" && /^[A-Za-z0-9._:-]{1,96}$/.test(row.id) &&
    typeof row.prompt === "string" && row.prompt.length <= 4000 &&
    (row.rubric === undefined || typeof row.rubric === "string" && row.rubric.length <= 2000) &&
    (row.language === undefined || typeof row.language === "string" && row.language.length <= 32);
}
function protocolConflictTargets(manifestId: string, payload: unknown): string[] {
  const row = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const targets = new Set<string>([manifestId]);
  if (typeof row.releaseId === "string" && /^[0-9a-f-]{36}$/i.test(row.releaseId)) targets.add(row.releaseId);
  if (Array.isArray(row.caseSchedule)) for (const id of row.caseSchedule) if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) targets.add(id);
  if (typeof row.targetIdentity === "string" && /^[0-9a-f-]{36}$/i.test(row.targetIdentity)) targets.add(row.targetIdentity);
  if (row.targetIdentity && typeof row.targetIdentity === "object" && !Array.isArray(row.targetIdentity)) {
    const id = (row.targetIdentity as Record<string, unknown>).id;
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) targets.add(id);
  }
  return [...targets];
}
function protocolContainsRevision(payload: Record<string, unknown>, field: "judgeRevisions" | "metricRevisions", revisionId: string): boolean {
  const revisions = Array.isArray(payload[field]) ? payload[field] as unknown[] : [];
  return revisions.some((item) => item === revisionId || Boolean(item && typeof item === "object" && !Array.isArray(item) && ((item as Record<string, unknown>).id === revisionId || (item as Record<string, unknown>).revisionId === revisionId || (item as Record<string, unknown>).judgeRevisionId === revisionId)));
}
function hasKnownHumanRoleConflict(value: unknown, humanIdentityId: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKnownHumanRoleConflict(item, humanIdentityId));
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const roleKeys = ["reviewedBy", "authoredByHumanIdentityId", "ownerHumanIdentityId", "operatorHumanIdentityId", "protectedOracleAccessByHumanIdentityId"];
  if (roleKeys.some((key) => row[key] === humanIdentityId)) return true;
  return Object.values(row).some((item) => hasKnownHumanRoleConflict(item, humanIdentityId));
}

@Injectable()
export class ReviewerService {
  constructor(private readonly db: OicDatabaseService, private readonly vault: EvaluationArtifactVault) {}

  async createLocalFixtureProtocol(actor: AuthenticatedPrincipal, input: { applicationId: string; tenantId?: string | null; judgeRevisionId: string; batchKey?: string }, request: { requestId?: string; traceId?: string }) {
    if (actor.applicationId !== input.applicationId || !actor.scopes.includes("oic:evaluation:manage")) throw new ForbiddenException();
    const batchKey = input.batchKey ?? "oic7-human-review-local-demo";
    const fixtureItems = getLocalFixtureItems(batchKey);
    if (fixtureItems.length !== 3) throw new BadRequestException("Unsupported local human-review fixture batch");
    const tenantId = input.tenantId ?? null;
    const judge = await this.db.oicEvaluationJudgeRevision.findFirst({ where: { id: input.judgeRevisionId, applicationId: input.applicationId, tenantId, judgeType: "HUMAN", status: "PUBLISHED" }, select: { id: true, revision: true } });
    if (!judge) throw new ConflictException("PUBLISHED_HUMAN_JUDGE_REQUIRED");
    const rubricBytes = Buffer.from(localHumanRubric, "utf8");
    const rubric = await this.vault.store(rubricBytes, { applicationId: input.applicationId, tenantId, purpose: "RUBRIC", exposureTier: "INTERNAL" }, actor.id);
    rubricBytes.fill(0);
    const definition = {
      type: "BOOLEAN", unit: "RATIO", polarity: "HIGH_IS_GOOD", applicableTargetClasses: ["STATIC_LOCAL_FIXTURE"], applicableDomains: ["instruction_adherence"],
      rangeOrCategories: { minimum: 0, maximum: 1 }, missingSemantics: "ABSTENTION_IS_MISSING", oracleOrJudgeRevisionId: judge.id,
      aggregationMethodRevision: "human-review-agreement-v1", uncertaintyMethodRevision: "not-applicable-single-review-fixture-v1", minimumEffectiveN: 1,
      criticality: "REQUIRED", normalizationRevisionOrNone: "NONE", sourceArtifactRequirement: "ATTEMPT_EVIDENCE", methodRevision: "human-visible-instruction-adherence-v1",
      humanRubricArtifactId: rubric.id, humanRubricDigest: rubric.digest
    };
    const metricKey = batchKey === "oic7-human-review-local-demo" ? "oic7-human-instruction-adherence" : "oic7-human-instruction-adherence-b2";
    const metricRevision = 1;
    const definitionDigest = digest(canonicalJson({ metricKey, revision: metricRevision, definition }));
    const metric = await this.db.oicEvaluationMetricRevision.create({ data: { applicationId: input.applicationId, tenantId, metricKey, revision: metricRevision, definition, definitionDigest, status: "DRAFT", createdBy: actor.id } });
    const projections = fixtureItems.map((item, ordinal) => ({ itemKey: item.itemKey, ordinal: ordinal + 1, projection: { prompt: item.prompt, rubric: localHumanRubric, language: "en", taskType: "instruction_adherence", candidates: [{ label: "CANDIDATE", content: item.candidateResponse }] } }));
    const fixtureDefinition = { protocolVersion: "oic-human-review-fixture-v1", protocolKey: batchKey, targetClass: "STATIC_LOCAL_FIXTURE", reviewMode: "SINGLE_BOOLEAN", abstentionAllowed: true, metricRevisionId: metric.id, judgeRevisionId: judge.id, rubricArtifactId: rubric.id, rubricDigest: rubric.digest, itemSetDigest: digest(canonicalJson(projections.map((item) => ({ itemKey: item.itemKey, ordinal: item.ordinal, projection: item.projection })))), providerDispatchesAllowed: false, providerDispatchCount: 0, items: projections.map(({ itemKey, ordinal }) => ({ itemKey, ordinal })) };
    const protocol = await this.db.$transaction(async (tx) => {
      const row = await tx.oicReviewFixtureProtocol.create({ data: { applicationId: input.applicationId, tenantId, protocolKey: batchKey, revision: 1, metricRevisionId: metric.id, judgeRevisionId: judge.id, rubricArtifactId: rubric.id, rubricDigest: rubric.digest, definition: fixtureDefinition, definitionDigest: digest(canonicalJson(fixtureDefinition)), createdByPrincipalId: actor.id } });
      await tx.oicReviewFixtureExecution.createMany({ data: projections.map(({ itemKey, ordinal, projection }) => ({ protocolRevisionId: row.id, applicationId: input.applicationId, tenantId, itemKey, ordinal, blindProjection: projection, createdByPrincipalId: actor.id })) });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: input.applicationId, tenantId, action: "review.fixture.protocol.created", targetType: "review-fixture-protocol", targetId: row.id, ...requestIds(request), metadata: { metricRevisionId: metric.id, judgeRevisionId: judge.id, rubricArtifactId: rubric.id, rubricDigest: rubric.digest, definitionDigest: row.definitionDigest, itemCount: projections.length, targetClass: "STATIC_LOCAL_FIXTURE" } } });
      return row;
    });
    return { protocolRevisionId: protocol.id, metricRevisionId: metric.id, judgeRevisionId: judge.id, rubricArtifactId: rubric.id, rubricDigest: rubric.digest, itemCount: projections.length, status: protocol.status };
  }

  async publishLocalFixtureProtocol(actor: AuthenticatedPrincipal, protocolRevisionId: string, request: { requestId?: string; traceId?: string }) {
    if (!actor.scopes.includes("oic:evaluation:manage")) throw new ForbiddenException();
    const protocol = await this.db.oicReviewFixtureProtocol.findFirst({ where: { id: protocolRevisionId, applicationId: actor.applicationId }, include: { executions: { orderBy: { ordinal: "asc" } } } });
    const fixtureItems = protocol ? getLocalFixtureItems(protocol.protocolKey) : [];
    if (!protocol || actor.applicationId !== protocol.applicationId || protocol.status !== "DRAFT" || protocol.createdByPrincipalId === actor.id || fixtureItems.length !== 3 || protocol.executions.length !== fixtureItems.length) throw new ForbiddenException("INDEPENDENT_REVIEWER_PUBLICATION_REQUIRED");
    await this.vault.verifyReference(protocol.rubricArtifactId, protocol.rubricDigest, { applicationId: protocol.applicationId, tenantId: protocol.tenantId, purpose: "RUBRIC", exposureTier: "INTERNAL" });
    const metric = await this.db.oicEvaluationMetricRevision.findFirst({ where: { id: protocol.metricRevisionId, applicationId: protocol.applicationId, tenantId: protocol.tenantId, status: "DRAFT" }, select: { id: true, definition: true, metricKey: true, revision: true, definitionDigest: true } });
    if (!metric || deriveHumanReviewMode(metric.definition) !== "SINGLE_BOOLEAN" || (metric.definition as Record<string, unknown>).humanRubricDigest !== protocol.rubricDigest || (metric.definition as Record<string, unknown>).humanRubricArtifactId !== protocol.rubricArtifactId) throw new ConflictException("HUMAN_RUBRIC_PIN_INVALID");
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const published = await tx.oicReviewFixtureProtocol.updateMany({ where: { id: protocol.id, status: "DRAFT", createdByPrincipalId: { not: actor.id } }, data: { status: "PUBLISHED", publishedByPrincipalId: actor.id, publishedAt: now } });
      if (published.count !== 1) throw new ConflictException("FIXTURE_PROTOCOL_STATE_CHANGED");
      const metricPublished = await tx.oicEvaluationMetricRevision.updateMany({ where: { id: metric.id, applicationId: protocol.applicationId, tenantId: protocol.tenantId, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: now } });
      if (metricPublished.count !== 1) throw new ConflictException("FIXTURE_METRIC_STATE_CHANGED");
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: protocol.applicationId, tenantId: protocol.tenantId, action: "evaluation.metric.published", targetType: "evaluation-metric", targetId: metric.id, ...requestIds(request), metadata: { definitionDigest: metric.definitionDigest, metricKey: metric.metricKey, revision: metric.revision, reviewProtocolRevisionId: protocol.id } } });
      for (const execution of protocol.executions) {
        const running = await tx.oicReviewFixtureExecution.updateMany({ where: { id: execution.id, status: "QUEUED", protocolRevisionId: protocol.id }, data: { status: "RUNNING" } });
        if (running.count !== 1) throw new ConflictException("FIXTURE_EXECUTION_STATE_CHANGED");
        const evidence = { targetClass: "STATIC_LOCAL_FIXTURE", executionRevision: "static-fixture-v1", providerDispatchCount: 0, cost: { status: "ZERO_BY_CONSTRUCTION", source: "NO_PROVIDER_TARGET" }, projectionDigest: digest(canonicalJson(execution.blindProjection)) };
        const evidenceDigest = digest(canonicalJson(evidence));
        const completed = await tx.oicReviewFixtureExecution.updateMany({ where: { id: execution.id, status: "RUNNING", providerDispatchCount: 0 }, data: { status: "EXECUTED", executionEvidence: evidence, evidenceDigest, completedAt: now } });
        if (completed.count !== 1) throw new ConflictException("FIXTURE_EXECUTION_STATE_CHANGED");
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: protocol.applicationId, tenantId: protocol.tenantId, action: "review.fixture.execution.completed", targetType: "review-fixture-execution", targetId: execution.id, ...requestIds(request), metadata: { protocolRevisionId: protocol.id, itemKey: execution.itemKey, targetClass: evidence.targetClass, providerDispatchCount: 0, evidenceDigest } } });
      }
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: protocol.applicationId, tenantId: protocol.tenantId, action: "review.fixture.protocol.published", targetType: "review-fixture-protocol", targetId: protocol.id, ...requestIds(request), metadata: { definitionDigest: protocol.definitionDigest, metricRevisionId: protocol.metricRevisionId, judgeRevisionId: protocol.judgeRevisionId, rubricDigest: protocol.rubricDigest, executionCount: protocol.executions.length, providerDispatchCount: 0 } } });
    });
    return { protocolRevisionId: protocol.id, status: "PUBLISHED", executionCount: protocol.executions.length, providerDispatchCount: 0 };
  }

  async createLocalFixtureAssignments(actor: AuthenticatedPrincipal, input: { protocolRevisionId: string; reviewerIds: string[] }, request: { requestId?: string; traceId?: string }) {
    if (!actor.scopes.includes("oic:evaluation:manage") || input.reviewerIds.length < 1 || input.reviewerIds.length > 2 || new Set(input.reviewerIds).size !== input.reviewerIds.length) throw new ForbiddenException();
    const protocol = await this.db.oicReviewFixtureProtocol.findFirst({ where: { id: input.protocolRevisionId, applicationId: actor.applicationId, status: "PUBLISHED" }, include: { executions: { where: { status: "EXECUTED", providerDispatchCount: 0 }, orderBy: { ordinal: "asc" } } } });
    if (!protocol || protocol.executions.length !== getLocalFixtureItems(protocol.protocolKey).length || protocol.executions.length !== 3) throw new ConflictException("PUBLISHED_LOCAL_FIXTURE_REQUIRED");
    const existing = await this.db.oicReviewAssignment.findMany({ where: { protocolRevisionId: protocol.id, humanIdentityId: { in: input.reviewerIds }, caseExecutionId: { in: protocol.executions.map((row) => row.id) } }, select: { id: true, humanIdentityId: true, caseExecutionId: true, blindedItemId: true }, orderBy: [{ humanIdentityId: "asc" }, { caseExecutionId: "asc" }] });
    const existingByKey = new Map(existing.map((row) => [`${row.humanIdentityId}:${row.caseExecutionId}`, row]));
    const created: Array<{ reviewerId: string; itemKey: string; assignmentId: string }> = [];
    for (const reviewerId of input.reviewerIds) for (const execution of protocol.executions) {
      const prior = existingByKey.get(`${reviewerId}:${execution.id}`);
      if (prior) {
        created.push({ reviewerId, itemKey: execution.itemKey, assignmentId: prior.id });
        continue;
      }
      const assignment = await this.createAssignment(actor, {
        humanIdentityId: reviewerId, applicationId: protocol.applicationId, tenantId: protocol.tenantId,
        caseExecutionId: execution.id, protocolRevisionId: protocol.id, judgeRevisionId: protocol.judgeRevisionId,
        metricRevisionId: protocol.metricRevisionId, blindedItemId: `${protocol.id}:${execution.itemKey}`,
        blindProjection: execution.blindProjection, blindMapping: { CANDIDATE: execution.id }
      }, request);
      created.push({ reviewerId, itemKey: execution.itemKey, assignmentId: assignment.id });
    }
    return { protocolRevisionId: protocol.id, reviewMode: "SINGLE_BOOLEAN", assignments: created, assignmentCount: created.length, idempotent: existing.length > 0 };
  }

  async computeLocalFixtureInterRater(actor: AuthenticatedPrincipal, protocolRevisionId: string, request: { requestId?: string; traceId?: string }) {
    if (actor.scopes.includes("oic:evaluation:manage") !== true) throw new ForbiddenException();
    const protocol = await this.db.oicReviewFixtureProtocol.findFirst({ where: { id: protocolRevisionId, applicationId: actor.applicationId, status: "PUBLISHED" }, include: { executions: { orderBy: { ordinal: "asc" } } } });
    if (!protocol) throw new ForbiddenException();
    const evidence: Array<{ executionId: string; itemKey: string; outcome: string; agreement: boolean | null; abstentionCount: number; evidenceDigest: string }> = [];
    let reviewerPair: string | null = null;
    for (const execution of protocol.executions) {
      const assignments = await this.db.oicReviewAssignment.findMany({ where: { protocolRevisionId: protocol.id, caseExecutionId: execution.id, applicationId: protocol.applicationId, tenantId: protocol.tenantId, reviewMode: "SINGLE_BOOLEAN", status: { in: ["SUBMITTED", "ABSTAINED"] } }, select: { id: true, humanIdentityId: true, submissions: { select: { id: true, value: true, abstained: true, evidenceDigest: true } } } });
      if (assignments.length !== 2 || new Set(assignments.map((item) => item.humanIdentityId)).size !== 2 || assignments.some((item) => item.submissions.length !== 1)) {
        evidence.push({ executionId: execution.id, itemKey: execution.itemKey, outcome: "INCOMPLETE", agreement: null, abstentionCount: 0, evidenceDigest: "" });
        continue;
      }
      const submissions = assignments.map((item) => item.submissions[0]!);
      const pairKey = assignments.map((item) => item.humanIdentityId).sort().join(":");
      if (reviewerPair !== null && pairKey !== reviewerPair) throw new ConflictException("INTERRATER_REVIEWER_PAIR_MISMATCH");
      reviewerPair = pairKey;
      const derived = deriveBooleanInterRaterOutcome(submissions);
      const { agreement, abstentionCount, outcome } = derived;
      const submissionIds = submissions.map((submission) => submission.id).sort();
      const evidenceDigest = digest(canonicalJson({ protocolRevisionId: protocol.id, caseExecutionId: execution.id, submissionIds, outcome, agreement, abstentionCount, source: "TWO_IMMUTABLE_HUMAN_SUBMISSIONS_V1" }));
      const prior = await this.db.oicReviewInterRaterEvidence.findUnique({ where: { protocolRevisionId_caseExecutionId: { protocolRevisionId: protocol.id, caseExecutionId: execution.id } } });
      if (prior && prior.evidenceDigest !== evidenceDigest) throw new ConflictException("INTERRATER_EVIDENCE_IMMUTABILITY_CONFLICT");
      const row = prior ?? await this.db.$transaction(async (tx) => {
        const created = await tx.oicReviewInterRaterEvidence.create({ data: { applicationId: protocol.applicationId, tenantId: protocol.tenantId, protocolRevisionId: protocol.id, caseExecutionId: execution.id, submissionIds, outcome, agreement, abstentionCount, evidenceDigest } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: protocol.applicationId, tenantId: protocol.tenantId, action: "review.inter-rater.computed", targetType: "review-inter-rater-evidence", targetId: created.id, ...requestIds(request), metadata: { protocolRevisionId: protocol.id, caseExecutionId: execution.id, submissionIds, outcome, agreement, abstentionCount, evidenceDigest } } });
        return created;
      });
      evidence.push({ executionId: execution.id, itemKey: execution.itemKey, outcome: row.outcome, agreement: row.agreement, abstentionCount: row.abstentionCount, evidenceDigest: row.evidenceDigest });
    }
    return { protocolRevisionId: protocol.id, itemCount: evidence.length, complete: evidence.every((item) => item.outcome !== "INCOMPLETE"), genuineDisagreementCount: evidence.filter((item) => item.outcome === "DISAGREEMENT").length, evidence };
  }

  private assertAdmin(actor: AuthenticatedPrincipal, applicationId: string): void {
    if (actor.applicationId !== applicationId || !actor.scopes.includes("oic:principals:manage")) throw new ForbiddenException();
  }

  async listIdentities(actor: AuthenticatedPrincipal, applicationId: string) {
    this.assertAdmin(actor, applicationId);
    const rows = await this.db.oicHumanIdentity.findMany({
      where: { memberships: { some: { applicationId } } },
      select: {
        id: true,
        displayLabel: true,
        status: true,
        createdAt: true,
        disabledAt: true,
        memberships: { where: { applicationId }, select: { status: true, tenantId: true, createdAt: true } },
        authSubjects: { where: { kind: "LOCAL" }, select: { loginHandle: true, status: true, createdAt: true } },
        authorizations: { where: { applicationId }, select: { capability: true, status: true, effectiveAt: true, revokedAt: true } },
        calibrations: { where: { applicationId }, orderBy: { completedAt: "desc" }, take: 1, select: { eligibility: true, expiresAt: true, completedAt: true } }
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 200
    });
    const now = new Date();
    return rows.map((row) => {
      const membership = row.memberships[0];
      const calibration = row.calibrations[0];
      return {
        id: row.id,
        displayLabel: row.displayLabel,
        status: row.status,
        createdAt: row.createdAt,
        disabledAt: row.disabledAt,
        applicationId,
        membershipStatus: membership?.status ?? "UNKNOWN",
        tenantId: membership?.tenantId ?? null,
        loginHandles: row.authSubjects.map((subject) => ({ handle: subject.loginHandle, status: subject.status, createdAt: subject.createdAt })),
        authorizations: row.authorizations.map((authorization) => ({ capability: authorization.capability, status: authorization.status, effectiveAt: authorization.effectiveAt, revokedAt: authorization.revokedAt })),
        calibration: calibration ? {
          eligibility: calibration.eligibility === "ELIGIBLE" && calibration.expiresAt && calibration.expiresAt <= now ? "EXPIRED" : calibration.eligibility,
          completedAt: calibration.completedAt,
          expiresAt: calibration.expiresAt
        } : null
      };
    });
  }

  async listCalibrationReadback(actor: AuthenticatedPrincipal, applicationId: string) {
    this.assertAdmin(actor, applicationId);
    const identities = await this.db.oicHumanIdentity.findMany({ where: { memberships: { some: { applicationId, status: "ACTIVE", revokedAt: null } } }, select: { id: true }, orderBy: { id: "asc" }, take: 200 });
    const ids = identities.map((row) => row.id);
    if (!ids.length) return [];
    const calibrations = await this.db.oicReviewerCalibration.findMany({
      where: { applicationId, humanIdentityId: { in: ids } },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      select: { id: true, humanIdentityId: true, policyId: true, eligibility: true, agreement: true, anchorCount: true, abstentions: true, completedAt: true, expiresAt: true, evidenceDigest: true, supersededBy: { select: { id: true } }, policy: { select: { revision: true, applicationId: true } } }
    });
    const events = await this.db.oicAuditEvent.findMany({ where: { applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: { in: ids }, action: "review.calibration.completed", targetType: "review-calibration", targetId: { in: calibrations.map((row) => row.id) } }, select: { id: true, actorHumanIdentityId: true, targetId: true, action: true, occurredAt: true, metadata: true }, orderBy: { occurredAt: "desc" }, take: 1000 });
    const byHuman = new Map<string, typeof calibrations[number]>();
    for (const row of calibrations) if (!row.supersededBy.length && !byHuman.has(row.humanIdentityId)) byHuman.set(row.humanIdentityId, row);
    return ids.map((humanIdentityId) => {
      const row = byHuman.get(humanIdentityId);
      if (!row || row.policy.applicationId !== applicationId) return { humanIdentityId, applicationId, status: "MISSING", eligibility: "NOT_CALIBRATED", calibrationRecordId: null, evidenceDigestPresent: false, audit: { status: "MISSING" } };
      const now = new Date();
      const eligibility = row.eligibility === "ELIGIBLE" && row.expiresAt && row.expiresAt <= now ? "EXPIRED" : row.eligibility;
      const audit = events.find((event) => event.targetId === row.id && event.actorHumanIdentityId === humanIdentityId);
      const metadata = audit?.metadata && typeof audit.metadata === "object" && !Array.isArray(audit.metadata) ? audit.metadata as Record<string, unknown> : {};
      const auditVerified = Boolean(audit && audit.action === "review.calibration.completed" && metadata.policyId === row.policyId && metadata.eligibility === row.eligibility && metadata.anchorCount === row.anchorCount && (row.agreement === null || metadata.agreement === Number(row.agreement)));
      const abstentions = Array.isArray(row.abstentions) ? row.abstentions.length : 0;
      return { humanIdentityId, applicationId, calibrationRecordId: row.id, policyId: row.policyId, policyRevision: row.policy.revision, status: "PRESENT", eligibility, agreement: row.agreement === null ? null : Number(row.agreement), anchorCount: row.anchorCount, abstentionCount: abstentions, completedAt: row.completedAt, expiresAt: row.expiresAt, evidenceDigestPresent: /^[a-f0-9]{64}$/.test(row.evidenceDigest), audit: auditVerified ? { status: "VERIFIED", action: audit!.action, occurredAt: audit!.occurredAt } : { status: audit ? "MISMATCH" : "MISSING" } };
    });
  }

  async listConflictReadback(actor: AuthenticatedPrincipal, applicationId: string) {
    this.assertAdmin(actor, applicationId);
    const identities = await this.db.oicHumanIdentity.findMany({
      where: { memberships: { some: { applicationId, status: "ACTIVE", revokedAt: null } } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 200
    });
    const ids = identities.map((row) => row.id);
    if (!ids.length) return [];
    const [policies, manifests, fixtureProtocols, events] = await Promise.all([
      this.db.oicReviewCalibrationPolicy.findMany({
        where: { applicationId, status: "PUBLISHED" },
        select: { id: true, revision: true, judgeRevisionId: true }
      }),
      this.db.oicEvaluationProtocolManifest.findMany({
        where: { applicationId },
        select: { id: true, protocolVersion: true, payload: true },
        orderBy: { publishedAt: "desc" },
        take: 100
      }),
      this.db.oicReviewFixtureProtocol.findMany({ where: { applicationId, status: "PUBLISHED" }, select: { id: true, protocolKey: true, revision: true, judgeRevisionId: true }, orderBy: { publishedAt: "desc" }, take: 100 }),
      this.db.oicAuditEvent.findMany({
        where: { applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: { in: ids }, action: "review.conflict.attested", targetType: "review-conflict-attestation" },
        select: { id: true, actorHumanIdentityId: true, applicationId: true, targetType: true, targetId: true, action: true, occurredAt: true, metadata: true },
        orderBy: { occurredAt: "desc" },
        take: 2000
      })
    ]);
    const results: Record<string, unknown>[] = [];
    for (const { id: humanIdentityId } of identities) for (const policy of policies) {
      const matchingManifests = manifests.filter((manifest) => {
        const payload = manifest.payload && typeof manifest.payload === "object" && !Array.isArray(manifest.payload) ? manifest.payload as Record<string, unknown> : {};
        return protocolContainsRevision(payload, "judgeRevisions", policy.judgeRevisionId);
      });
      if (!matchingManifests.length) {
        results.push({ humanIdentityId, applicationId, policyId: policy.id, policyRevision: policy.revision, state: "UNKNOWN", reason: "NO_MATCHING_PUBLISHED_PROTOCOL", recordedAt: null, evidenceDigestPresent: false, audit: { status: "MISSING" } });
        continue;
      }
      for (const manifest of matchingManifests) {
      const latest = events.find((event) => {
        const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {};
        return event.actorHumanIdentityId === humanIdentityId && metadata.policyId === policy.id && metadata.protocolRevisionId === manifest.id;
      });
      if (!latest) {
        results.push({ humanIdentityId, applicationId, policyId: policy.id, policyRevision: policy.revision, protocolRevisionId: manifest.id, protocolVersion: manifest.protocolVersion, state: "REQUIRES_ATTESTATION", recordedAt: null, evidenceDigestPresent: false, audit: { status: "MISSING" } });
        continue;
      }
      const metadata = latest.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata) ? latest.metadata as Record<string, unknown> : {};
      const declarations = metadata.declarations && typeof metadata.declarations === "object" && !Array.isArray(metadata.declarations) ? metadata.declarations as Record<string, unknown> : {};
      const declarationKeysValid = Object.keys(declarations).sort().join(",") === [...conflictDeclarationKeys].sort().join(",") && conflictDeclarationKeys.every((key) => typeof declarations[key] === "boolean");
      const allClear = declarationKeysValid && conflictDeclarationKeys.every((key) => declarations[key] === true);
      const knownHumanConflictCheck = metadata.knownHumanConflictCheck;
      const outcome = metadata.outcome;
      const semanticOutcomeValid = outcome === "CLEARED"
        ? allClear && knownHumanConflictCheck === "NO_MATCH"
        : outcome === "CONFLICTED"
          ? declarationKeysValid && (knownHumanConflictCheck === "MATCHED" || !allClear)
          : outcome === "REQUIRES_CALIBRATION" && allClear && knownHumanConflictCheck === "NO_MATCH";
      const expectedDigest = digest(canonicalJson({ humanIdentityId, applicationId, policyId: policy.id, protocolRevisionId: manifest.id, declarations, knownHumanConflictCheck, outcome }));
      const evidenceDigestValid = typeof metadata.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(metadata.evidenceDigest) && metadata.evidenceDigest === expectedDigest;
      const verified = latest.actorHumanIdentityId === humanIdentityId && latest.applicationId === applicationId && latest.action === "review.conflict.attested" && latest.targetType === "review-conflict-attestation" && declarationKeysValid && semanticOutcomeValid && evidenceDigestValid;
      results.push({
        humanIdentityId,
        applicationId,
        policyId: policy.id,
        policyRevision: policy.revision,
        protocolRevisionId: manifest.id,
        protocolVersion: manifest.protocolVersion,
        state: verified ? outcome : "UNKNOWN",
        recordedAt: latest.occurredAt,
        evidenceDigestPresent: typeof metadata.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(metadata.evidenceDigest),
        audit: { status: verified ? "VERIFIED" : "MISMATCH", action: latest.action, occurredAt: latest.occurredAt }
      });
      }
    }
    for (const { id: humanIdentityId } of identities) for (const policy of policies) for (const fixture of fixtureProtocols) {
      if (fixture.judgeRevisionId !== policy.judgeRevisionId) continue;
      const latest = events.find((event) => {
        const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {};
        return event.actorHumanIdentityId === humanIdentityId && metadata.policyId === policy.id && metadata.protocolRevisionId === fixture.id;
      });
      const metadata = latest?.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata) ? latest.metadata as Record<string, unknown> : {};
      const declarations = metadata.declarations && typeof metadata.declarations === "object" && !Array.isArray(metadata.declarations) ? metadata.declarations as Record<string, unknown> : {};
      const declarationsValid = Object.keys(declarations).sort().join(",") === [...conflictDeclarationKeys].sort().join(",") && conflictDeclarationKeys.every((key) => typeof declarations[key] === "boolean");
      const outcome = metadata.outcome;
      const expectedDigest = digest(canonicalJson({ humanIdentityId, applicationId, policyId: policy.id, protocolRevisionId: fixture.id, declarations, knownHumanConflictCheck: metadata.knownHumanConflictCheck, outcome }));
      const auditVerified = Boolean(latest && latest.applicationId === applicationId && latest.actorHumanIdentityId === humanIdentityId && latest.action === "review.conflict.attested" && declarationsValid && metadata.knownHumanConflictCheck === "NO_MATCH" && (outcome === "CLEARED" || outcome === "REQUIRES_CALIBRATION" || outcome === "CONFLICTED") && metadata.evidenceDigest === expectedDigest);
      results.push({ humanIdentityId, applicationId, policyId: policy.id, policyRevision: policy.revision, protocolRevisionId: fixture.id, protocolVersion: `${fixture.protocolKey}-v${fixture.revision}`, state: auditVerified ? outcome : latest ? "UNKNOWN" : "REQUIRES_ATTESTATION", recordedAt: latest?.occurredAt ?? null, evidenceDigestPresent: typeof metadata.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(metadata.evidenceDigest), audit: { status: auditVerified ? "VERIFIED" : latest ? "MISMATCH" : "MISSING", action: latest?.action ?? null, occurredAt: latest?.occurredAt ?? null } });
    }
    return results;
  }

  async listConflictScopes(token: string) {
    const actor = await this.resolveSession(token, "oic:evaluation:review:calibrate");
    const policies = await this.db.oicReviewCalibrationPolicy.findMany({ where: { applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { id: true, revision: true, judgeRevisionId: true } });
    const [manifests, fixtureProtocols] = await Promise.all([
      this.db.oicEvaluationProtocolManifest.findMany({ where: { applicationId: actor.applicationId, tenantId: actor.tenantId }, select: { id: true, protocolVersion: true, payload: true }, orderBy: { publishedAt: "desc" }, take: 100 }),
      this.db.oicReviewFixtureProtocol.findMany({ where: { applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { id: true, judgeRevisionId: true, protocolKey: true, revision: true } })
    ]);
    const events = await this.db.oicAuditEvent.findMany({ where: { applicationId: actor.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, action: "review.conflict.attested" }, select: { id: true, targetId: true, occurredAt: true, metadata: true }, orderBy: { occurredAt: "desc" }, take: 500 });
    const scopes: Record<string, unknown>[] = [];
    for (const policy of policies) for (const manifest of manifests) {
      const payload = manifest.payload && typeof manifest.payload === "object" && !Array.isArray(manifest.payload) ? manifest.payload as Record<string, unknown> : {};
      if (!protocolContainsRevision(payload, "judgeRevisions", policy.judgeRevisionId)) continue;
      const latest = events.find((event) => { const metadata = event.metadata as Record<string, unknown>; return metadata.policyId === policy.id && metadata.protocolRevisionId === manifest.id; });
      const metadata = latest?.metadata && typeof latest.metadata === "object" ? latest.metadata as Record<string, unknown> : {};
      scopes.push({ policyId: policy.id, policyRevision: policy.revision, protocolRevisionId: manifest.id, protocolVersion: manifest.protocolVersion, state: latest ? metadata.outcome : "REQUIRES_ATTESTATION", recordedAt: latest?.occurredAt ?? null, evidenceDigestPresent: typeof metadata.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(metadata.evidenceDigest) });
    }
    for (const policy of policies) for (const fixture of fixtureProtocols) {
      if (fixture.judgeRevisionId !== policy.judgeRevisionId) continue;
      const latest = events.find((event) => { const metadata = event.metadata as Record<string, unknown>; return metadata.policyId === policy.id && metadata.protocolRevisionId === fixture.id; });
      const metadata = latest?.metadata && typeof latest.metadata === "object" ? latest.metadata as Record<string, unknown> : {};
      scopes.push({ policyId: policy.id, policyRevision: policy.revision, protocolRevisionId: fixture.id, protocolVersion: `${fixture.protocolKey}-v${fixture.revision}`, state: latest ? metadata.outcome : "REQUIRES_ATTESTATION", recordedAt: latest?.occurredAt ?? null, evidenceDigestPresent: typeof metadata.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(metadata.evidenceDigest) });
    }
    return scopes;
  }

  async attestConflict(token: string, input: { policyId: string; protocolRevisionId: string; declarations: Record<string, unknown> }, request: { requestId?: string; traceId?: string }) {
    const actor = await this.resolveSession(token, "oic:evaluation:review:calibrate");
    if (Object.keys(input.declarations).sort().join(",") !== [...conflictDeclarationKeys].sort().join(",") || conflictDeclarationKeys.some((key) => typeof input.declarations[key] !== "boolean")) throw new BadRequestException("All protocol conflict declarations are required");
    const [policy, manifest, fixtureProtocol] = await Promise.all([
      this.db.oicReviewCalibrationPolicy.findFirst({ where: { id: input.policyId, applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { id: true, judgeRevisionId: true } }),
      this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: input.protocolRevisionId, applicationId: actor.applicationId, tenantId: actor.tenantId }, select: { id: true, releaseId: true, payload: true } }),
      this.db.oicReviewFixtureProtocol.findFirst({ where: { id: input.protocolRevisionId, applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { id: true, judgeRevisionId: true, protocolKey: true, revision: true } })
    ]);
    if (!policy || (!manifest && !fixtureProtocol)) throw new ForbiddenException();
    const payload = manifest?.payload && typeof manifest.payload === "object" && !Array.isArray(manifest.payload) ? manifest.payload as Record<string, unknown> : {};
    if (fixtureProtocol ? fixtureProtocol.judgeRevisionId !== policy.judgeRevisionId : !protocolContainsRevision(payload, "judgeRevisions", policy.judgeRevisionId)) throw new ForbiddenException();
    const prior = await this.db.oicAuditEvent.findMany({ where: { applicationId: actor.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, action: "review.conflict.attested" }, select: { id: true, metadata: true }, orderBy: { occurredAt: "desc" }, take: 500 });
    const same = prior.find((event) => { const metadata = event.metadata as Record<string, unknown>; return metadata.policyId === policy.id && metadata.protocolRevisionId === input.protocolRevisionId; });
    const sameMetadata = same?.metadata as Record<string, unknown> | undefined;
    const previousDeclarations = sameMetadata?.declarations as Record<string, boolean> | undefined;
    const calibration = await this.db.oicReviewerCalibration.findFirst({ where: { humanIdentityId: actor.id, applicationId: actor.applicationId, policyId: policy.id, eligibility: "ELIGIBLE", expiresAt: { gt: new Date() }, supersededBy: { none: {} } }, orderBy: { completedAt: "desc" }, select: { id: true } });
    const [knownAuditConflict, release] = await Promise.all([
      this.db.oicAuditEvent.findFirst({ where: { applicationId: actor.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, targetId: { in: protocolConflictTargets(input.protocolRevisionId, payload) }, action: { in: ["evaluation.fixture.authored", "evaluation.release.published", "review.oracle.accessed", "evaluation.candidate.operated", "evaluation.candidate.owned"] } }, select: { id: true } }),
      manifest ? this.db.oicEvaluationRelease.findFirst({ where: { id: manifest.releaseId, applicationId: actor.applicationId, tenantId: actor.tenantId }, select: { caseManifest: true } }) : Promise.resolve(null)
    ]);
    const knownConflict = Boolean(knownAuditConflict || (release && hasKnownHumanRoleConflict(release.caseManifest, actor.id)));
    const allClear = conflictDeclarationKeys.every((key) => input.declarations[key] === true);
    const outcome = knownConflict || !allClear ? "CONFLICTED" : calibration ? "CLEARED" : "REQUIRES_CALIBRATION";
    if (same && previousDeclarations && canonicalJson(previousDeclarations) === canonicalJson(input.declarations) && sameMetadata?.outcome === outcome) return { state: outcome, recordedAt: null, idempotent: true };
    const knownHumanConflictCheck = knownConflict ? "MATCHED" : "NO_MATCH";
    const evidenceDigest = digest(canonicalJson({ humanIdentityId: actor.id, applicationId: actor.applicationId, policyId: policy.id, protocolRevisionId: input.protocolRevisionId, declarations: input.declarations, knownHumanConflictCheck, outcome }));
    const created = await this.db.$transaction(async (tx) => tx.oicAuditEvent.create({ data: {
      actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, applicationId: actor.applicationId, tenantId: actor.tenantId,
      action: "review.conflict.attested", targetType: "review-conflict-attestation", targetId: randomUUID(), ...requestIds(request),
      metadata: { policyId: policy.id, protocolRevisionId: input.protocolRevisionId, declarations: input.declarations, knownHumanConflictCheck, outcome, supersedesAuditEventId: same?.id ?? null, evidenceDigest } as Prisma.InputJsonValue
    } }));
    return { state: outcome, recordedAt: created.occurredAt, idempotent: false };
  }

  async createIdentity(actor: AuthenticatedPrincipal, input: { applicationId: string; displayLabel: string; loginHandle: string; password: string; capabilities: string[]; tenantId?: string | null }, request: { requestId?: string; traceId?: string }) {
    this.assertAdmin(actor, input.applicationId);
    const label = input.displayLabel.trim();
    const loginHandle = input.loginHandle.trim().toLowerCase();
    if (label.length < 1 || label.length > 120 || !/^[a-z0-9][a-z0-9._-]{2,95}$/.test(loginHandle) || input.capabilities.length < 1 || input.capabilities.some((capability) => !capabilities.has(capability))) throw new BadRequestException("Invalid reviewer setup");
    const application = await this.db.oicApplication.findFirst({ where: { id: input.applicationId, status: "ACTIVE" }, select: { id: true } });
    if (!application) throw new ForbiddenException();
    if (input.tenantId) {
      const tenant = await this.db.oicTenant.findFirst({ where: { id: input.tenantId, applicationId: input.applicationId, status: "ACTIVE" }, select: { id: true } });
      if (!tenant) throw new ForbiddenException();
    }
    const verifier = await createHumanPasswordVerifier(input.password);
    const ids = requestIds(request);
    try {
      return await this.db.$transaction(async (tx) => {
        const human = await tx.oicHumanIdentity.create({ data: { displayLabel: label } });
        const subject = await tx.oicHumanAuthSubject.create({ data: { humanIdentityId: human.id, loginHandle, verifier, passwordChangedAt: new Date() } });
        await tx.oicHumanApplicationMembership.create({ data: { humanIdentityId: human.id, applicationId: input.applicationId, tenantId: input.tenantId ?? null } });
        await tx.oicReviewerAuthorization.createMany({ data: input.capabilities.map((capability) => ({ humanIdentityId: human.id, applicationId: input.applicationId, tenantId: input.tenantId ?? null, capability, grantedByPrincipalId: actor.id })) });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: input.applicationId, tenantId: input.tenantId ?? null, action: "reviewer.identity.created", targetType: "human-identity", targetId: human.id, ...ids, metadata: { authSubjectId: subject.id, capabilityCount: input.capabilities.length, authKind: "LOCAL" } } });
        return { id: human.id, displayLabel: human.displayLabel, status: human.status, loginHandle, capabilities: input.capabilities, createdAt: human.createdAt };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target.join(" ") : typeof target === "string" ? target : "";
        if (/loginHandle/i.test(fields)) throw new ConflictException({ code: "REVIEWER_LOGIN_HANDLE_EXISTS", message: "Reviewer login handle already exists" });
      }
      throw error;
    }
  }

  async setAuthorization(actor: AuthenticatedPrincipal, input: { applicationId: string; humanIdentityId: string; tenantId?: string | null; capability: string; revoke: boolean }, request: { requestId?: string; traceId?: string }) {
    this.assertAdmin(actor, input.applicationId);
    if (!capabilities.has(input.capability)) throw new BadRequestException("Unsupported reviewer capability");
    const human = await this.db.oicHumanIdentity.findFirst({ where: { id: input.humanIdentityId, status: "ACTIVE", memberships: { some: { applicationId: input.applicationId, tenantId: input.tenantId ?? null, status: "ACTIVE", revokedAt: null } } }, select: { id: true } });
    if (!human) throw new ForbiddenException();
    const existing = await this.db.oicReviewerAuthorization.findFirst({ where: { humanIdentityId: human.id, applicationId: input.applicationId, tenantId: input.tenantId ?? null, capability: input.capability } });
    if (!existing) throw new BadRequestException("Reviewer authorization does not exist");
    await this.db.$transaction(async (tx) => {
      await tx.oicReviewerAuthorization.update({ where: { id: existing.id }, data: input.revoke ? { status: "REVOKED", revokedAt: new Date() } : { status: "ACTIVE", revokedAt: null } });
      if (input.revoke) await tx.oicReviewerSession.updateMany({ where: { humanIdentityId: human.id, applicationId: input.applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: input.applicationId, tenantId: input.tenantId ?? null, action: input.revoke ? "reviewer.authorization.revoked" : "reviewer.authorization.granted", targetType: "human-identity", targetId: human.id, ...requestIds(request), metadata: { capability: input.capability } } });
    });
    return { updated: true };
  }

  async disableIdentity(actor: AuthenticatedPrincipal, applicationId: string, humanIdentityId: string, request: { requestId?: string; traceId?: string }) {
    this.assertAdmin(actor, applicationId);
    const human = await this.db.oicHumanIdentity.findFirst({ where: { id: humanIdentityId, memberships: { some: { applicationId, status: "ACTIVE", revokedAt: null } } }, select: { id: true, status: true } });
    if (!human) throw new ForbiddenException();
    await this.db.$transaction(async (tx) => {
      await tx.oicHumanIdentity.update({ where: { id: human.id }, data: { status: "DISABLED", disabledAt: new Date() } });
      await tx.oicReviewerSession.updateMany({ where: { humanIdentityId, applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId, action: "reviewer.identity.disabled", targetType: "human-identity", targetId: human.id, ...requestIds(request), metadata: {} } });
    });
    return { disabled: true };
  }

  async resetCredential(actor: AuthenticatedPrincipal, applicationId: string, humanIdentityId: string, password: string, request: { requestId?: string; traceId?: string }) {
    this.assertAdmin(actor, applicationId);
    const subject = await this.db.oicHumanAuthSubject.findFirst({ where: { humanIdentityId, kind: "LOCAL", humanIdentity: { memberships: { some: { applicationId, status: "ACTIVE", revokedAt: null } } } } });
    if (!subject) throw new ForbiddenException();
    const verifier = await createHumanPasswordVerifier(password);
    await this.db.$transaction(async (tx) => {
      await tx.oicHumanAuthSubject.update({ where: { id: subject.id }, data: { verifier, verifierVersion: { increment: 1 }, passwordChangedAt: new Date(), status: "ACTIVE", revokedAt: null } });
      await tx.oicReviewerSession.updateMany({ where: { humanIdentityId, applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId, action: "reviewer.credential.reset", targetType: "human-identity", targetId: humanIdentityId, ...requestIds(request), metadata: { authSubjectId: subject.id } } });
    });
    return { reset: true, activeSessionsRevoked: true };
  }

  async revokeCredential(actor: AuthenticatedPrincipal, applicationId: string, humanIdentityId: string, request: { requestId?: string; traceId?: string }) {
    this.assertAdmin(actor, applicationId);
    const subject = await this.db.oicHumanAuthSubject.findFirst({ where: { humanIdentityId, kind: "LOCAL", status: "ACTIVE", humanIdentity: { memberships: { some: { applicationId, status: "ACTIVE", revokedAt: null } } } }, select: { id: true } });
    if (!subject) throw new ForbiddenException();
    await this.db.$transaction(async (tx) => {
      await tx.oicHumanAuthSubject.update({ where: { id: subject.id }, data: { status: "REVOKED", revokedAt: new Date() } });
      await tx.oicReviewerSession.updateMany({ where: { humanIdentityId, applicationId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId, action: "reviewer.credential.revoked", targetType: "human-identity", targetId: humanIdentityId, ...requestIds(request), metadata: { authSubjectId: subject.id } } });
    });
    return { revoked: true, activeSessionsRevoked: true };
  }

  async login(loginHandle: string, password: string, applicationId: string, remoteKey: string, request: { requestId?: string; traceId?: string }) {
    const nowMs = Date.now();
    let window = loginWindows.get(remoteKey);
    if (!window || nowMs - window.start >= 60_000) { window = { start: nowMs, count: 0 }; loginWindows.set(remoteKey, window); }
    if (loginWindows.size > 10_000) for (const [key, value] of loginWindows) if (nowMs - value.start >= 60_000) loginWindows.delete(key);
    if (++window.count > LOGIN_LIMIT || password.length > 1024) throw new UnauthorizedException("Access could not be verified");
    const normalized = loginHandle.trim().toLowerCase();
    const subject = await this.db.oicHumanAuthSubject.findUnique({ where: { loginHandle: normalized }, include: { humanIdentity: true } });
    const membership = subject ? await this.db.oicHumanApplicationMembership.findFirst({ where: { humanIdentityId: subject.humanIdentityId, applicationId, status: "ACTIVE", revokedAt: null } }) : null;
    const verifier = subject?.verifier ?? "scrypt$1$AAAAAAAAAAAAAAAAAAAAAA$" + "0".repeat(64);
    const valid = await verifyCredential(password, verifier).catch(() => false);
    if (!subject || subject.kind !== "LOCAL" || subject.status !== "ACTIVE" || subject.revokedAt || subject.humanIdentity.status !== "ACTIVE" || !membership || !valid) throw new UnauthorizedException("Access could not be verified");
    const secret = randomBytes(32).toString("base64url");
    const tokenHash = digest(secret);
    const now = new Date();
    const session = await this.db.$transaction(async (tx) => {
      const created = await tx.oicReviewerSession.create({ data: { humanIdentityId: subject.humanIdentityId, authSubjectId: subject.id, membershipId: membership.id, applicationId, tokenHash, idleExpiresAt: new Date(now.getTime() + IDLE_MS), expiresAt: new Date(now.getTime() + ABSOLUTE_MS) } });
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: subject.humanIdentityId, applicationId, tenantId: membership.tenantId, action: "reviewer.session.established", targetType: "reviewer-session", targetId: created.id, ...requestIds(request), metadata: { authKind: "LOCAL", authSubjectId: subject.id } } });
      return created;
    });
    return { token: secret, sessionId: session.id, human: { id: subject.humanIdentityId, displayLabel: subject.humanIdentity.displayLabel }, applicationId, expiresAt: session.expiresAt };
  }

  async resolveSession(token: string, capability: string, applicationId?: string) {
    if (!token || token.length < 40 || token.length > 128) throw new UnauthorizedException();
    const row = await this.db.oicReviewerSession.findUnique({ where: { tokenHash: digest(token) }, include: { humanIdentity: true, authSubject: true, membership: true } });
    const now = new Date();
    if (!row || row.revokedAt || row.expiresAt <= now || row.idleExpiresAt <= now || row.humanIdentity.status !== "ACTIVE" || row.authSubject.status !== "ACTIVE" || row.authSubject.revokedAt || row.membership.status !== "ACTIVE" || row.membership.revokedAt || (applicationId && row.applicationId !== applicationId)) throw new UnauthorizedException();
    const authorization = await this.db.oicReviewerAuthorization.findFirst({ where: { humanIdentityId: row.humanIdentityId, applicationId: row.applicationId, tenantId: row.membership.tenantId, capability, status: "ACTIVE", revokedAt: null, effectiveAt: { lte: now } } });
    if (!authorization) throw new ForbiddenException();
    const stale = new Date(now.getTime() - 60_000);
    if (row.lastSeenAt < stale) await this.db.oicReviewerSession.update({ where: { id: row.id }, data: { lastSeenAt: now, idleExpiresAt: new Date(Math.min(now.getTime() + IDLE_MS, row.expiresAt.getTime())) } });
    return { id: row.humanIdentityId, displayLabel: row.humanIdentity.displayLabel, sessionId: row.id, applicationId: row.applicationId, tenantId: row.membership.tenantId, capability };
  }

  private async assertCurrentReviewEligibility(row: { id: string; humanIdentityId: string; applicationId: string; tenantId: string | null; caseExecutionId: string; protocolRevisionId: string; judgeRevisionId: string; metricRevisionId: string }, humanIdentityId: string) {
    const now = new Date();
    const [calibration, attestations, manifest, fixtureProtocol, evaluationExecution, fixtureExecution, metric] = await Promise.all([
      this.db.oicReviewerCalibration.findFirst({ where: { humanIdentityId, applicationId: row.applicationId, tenantId: row.tenantId, policy: { judgeRevisionId: row.judgeRevisionId, status: "PUBLISHED" }, eligibility: "ELIGIBLE", expiresAt: { gt: now }, supersededBy: { none: {} } }, select: { id: true, policyId: true, expiresAt: true }, orderBy: { completedAt: "desc" } }),
      this.db.oicAuditEvent.findMany({ where: { applicationId: row.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: humanIdentityId, action: "review.conflict.attested" }, select: { actorHumanIdentityId: true, applicationId: true, occurredAt: true, metadata: true }, orderBy: { occurredAt: "desc" }, take: 500 }),
      this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: row.protocolRevisionId, applicationId: row.applicationId, tenantId: row.tenantId }, select: { payload: true } }),
      this.db.oicReviewFixtureProtocol.findFirst({ where: { id: row.protocolRevisionId, applicationId: row.applicationId, tenantId: row.tenantId, status: "PUBLISHED" }, select: { metricRevisionId: true, judgeRevisionId: true } }),
      this.db.oicEvaluationCaseExecution.findFirst({ where: { id: row.caseExecutionId, status: "EXECUTED", run: { applicationId: row.applicationId, tenantId: row.tenantId, status: "EXECUTED", manifestId: row.protocolRevisionId } }, select: { id: true } }),
      this.db.oicReviewFixtureExecution.findFirst({ where: { id: row.caseExecutionId, applicationId: row.applicationId, tenantId: row.tenantId, protocolRevisionId: row.protocolRevisionId, status: "EXECUTED", providerDispatchCount: 0 }, select: { id: true } }),
      this.db.oicEvaluationMetricRevision.findFirst({ where: { id: row.metricRevisionId, applicationId: row.applicationId, tenantId: row.tenantId, status: "PUBLISHED" }, select: { definition: true } })
    ]);
    if (!calibration || !metric || (!evaluationExecution && !fixtureExecution)) throw new ForbiddenException("Reviewer eligibility or execution state is no longer valid");
    const payload = manifest?.payload && typeof manifest.payload === "object" && !Array.isArray(manifest.payload) ? manifest.payload as Record<string, unknown> : {};
    const protocolValid = fixtureProtocol
      ? fixtureProtocol.metricRevisionId === row.metricRevisionId && fixtureProtocol.judgeRevisionId === row.judgeRevisionId
      : Boolean(manifest && protocolContainsRevision(payload, "metricRevisions", row.metricRevisionId) && protocolContainsRevision(payload, "judgeRevisions", row.judgeRevisionId));
    if (!protocolValid || (fixtureExecution && !fixtureProtocol)) throw new ForbiddenException("Reviewer protocol pin is no longer valid");
    const event = attestations.find((item) => { const metadata = item.metadata as Record<string, unknown>; return metadata.policyId === calibration.policyId && metadata.protocolRevisionId === row.protocolRevisionId; });
    const metadata = event?.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {};
    const declarations = metadata.declarations && typeof metadata.declarations === "object" && !Array.isArray(metadata.declarations) ? metadata.declarations as Record<string, unknown> : {};
    const allClear = conflictDeclarationKeys.every((key) => declarations[key] === true) && Object.keys(declarations).length === conflictDeclarationKeys.length;
    const expectedDigest = digest(canonicalJson({ humanIdentityId, applicationId: row.applicationId, policyId: calibration.policyId, protocolRevisionId: row.protocolRevisionId, declarations, knownHumanConflictCheck: metadata.knownHumanConflictCheck, outcome: metadata.outcome }));
    if (!event || event.actorHumanIdentityId !== humanIdentityId || event.applicationId !== row.applicationId || metadata.outcome !== "CLEARED" || metadata.knownHumanConflictCheck !== "NO_MATCH" || !allClear || metadata.evidenceDigest !== expectedDigest) throw new ForbiddenException("Current protocol conflict clearance is not verified");
    return calibration;
  }

  async logout(token: string, request: { requestId?: string; traceId?: string }) {
    const row = await this.db.oicReviewerSession.findUnique({ where: { tokenHash: digest(token) }, select: { id: true, humanIdentityId: true, applicationId: true, membership: { select: { tenantId: true } }, revokedAt: true } });
    if (!row || row.revokedAt) return { loggedOut: true };
    await this.db.$transaction(async (tx) => {
      await tx.oicReviewerSession.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: row.humanIdentityId, applicationId: row.applicationId, tenantId: row.membership.tenantId, action: "reviewer.session.revoked", targetType: "reviewer-session", targetId: row.id, ...requestIds(request), metadata: { reason: "LOGOUT" } } });
    });
    return { loggedOut: true };
  }

  async createAssignment(actor: AuthenticatedPrincipal, input: { humanIdentityId: string; applicationId: string; tenantId?: string | null; caseExecutionId: string; protocolRevisionId: string; judgeRevisionId: string; metricRevisionId: string; blindedItemId: string; blindProjection: unknown; blindMapping: unknown; deadlineAt?: string }, request: { requestId?: string; traceId?: string }) {
    if (actor.applicationId !== input.applicationId || !actor.scopes.includes("oic:evaluation:manage")) throw new ForbiddenException();
    const mapping = input.blindMapping && typeof input.blindMapping === "object" && !Array.isArray(input.blindMapping) ? input.blindMapping as Record<string, unknown> : null;
    if (!mapping || input.blindedItemId.length > 128) throw new BadRequestException("Blind review projection is invalid");
    const assignmentNow = new Date();
    const human = await this.db.oicHumanIdentity.findFirst({ where: { id: input.humanIdentityId, status: "ACTIVE", memberships: { some: { applicationId: input.applicationId, tenantId: input.tenantId ?? null, status: "ACTIVE", revokedAt: null } }, authorizations: { some: { applicationId: input.applicationId, tenantId: input.tenantId ?? null, capability: "oic:evaluation:review:read", status: "ACTIVE", revokedAt: null, effectiveAt: { lte: assignmentNow } } } }, select: { id: true } });
    if (!human) throw new ForbiddenException();
    const [execution, fixtureExecution, manifest, fixtureProtocol, judge, metric, calibration, conflictEvents] = await Promise.all([
      this.db.oicEvaluationCaseExecution.findFirst({ where: { id: input.caseExecutionId, status: "EXECUTED", run: { applicationId: input.applicationId, tenantId: input.tenantId ?? null, status: "EXECUTED", manifestId: input.protocolRevisionId } }, select: { id: true } }),
      this.db.oicReviewFixtureExecution.findFirst({ where: { id: input.caseExecutionId, applicationId: input.applicationId, tenantId: input.tenantId ?? null, protocolRevisionId: input.protocolRevisionId, status: "EXECUTED", providerDispatchCount: 0 }, select: { id: true, blindProjection: true } }),
      this.db.oicEvaluationProtocolManifest.findFirst({ where: { id: input.protocolRevisionId, applicationId: input.applicationId, tenantId: input.tenantId ?? null }, select: { id: true, releaseId: true, payload: true } }),
      this.db.oicReviewFixtureProtocol.findFirst({ where: { id: input.protocolRevisionId, applicationId: input.applicationId, tenantId: input.tenantId ?? null, status: "PUBLISHED" }, select: { id: true, metricRevisionId: true, judgeRevisionId: true, rubricArtifactId: true, rubricDigest: true } }),
      this.db.oicEvaluationJudgeRevision.findFirst({ where: { id: input.judgeRevisionId, applicationId: input.applicationId, tenantId: input.tenantId ?? null, judgeType: "HUMAN", status: "PUBLISHED" }, select: { id: true } }),
      this.db.oicEvaluationMetricRevision.findFirst({ where: { id: input.metricRevisionId, applicationId: input.applicationId, tenantId: input.tenantId ?? null, status: "PUBLISHED" }, select: { id: true, definition: true } }),
      this.db.oicReviewerCalibration.findFirst({ where: { humanIdentityId: input.humanIdentityId, applicationId: input.applicationId, tenantId: input.tenantId ?? null, policy: { judgeRevisionId: input.judgeRevisionId, status: "PUBLISHED" }, eligibility: "ELIGIBLE", expiresAt: { gt: new Date() }, supersededBy: { none: {} } }, select: { id: true, policyId: true, expiresAt: true }, orderBy: { completedAt: "desc" } }),
      this.db.oicAuditEvent.findMany({ where: { applicationId: input.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: input.humanIdentityId, action: "review.conflict.attested" }, select: { id: true, occurredAt: true, metadata: true }, orderBy: { occurredAt: "desc" }, take: 500 })
    ]);
    if ((!execution && !fixtureExecution) || (!manifest && !fixtureProtocol) || !judge || !metric || (fixtureExecution && (!fixtureProtocol || fixtureProtocol.metricRevisionId !== metric.id || fixtureProtocol.judgeRevisionId !== judge.id))) throw new ForbiddenException();
    if (fixtureExecution && canonicalJson(fixtureExecution.blindProjection) !== canonicalJson(input.blindProjection)) throw new ForbiddenException("SERVER_CONTROLLED_FIXTURE_PROJECTION_REQUIRED");
    const reviewMode = deriveHumanReviewMode(metric.definition);
    const mappingKeys = reviewMode === "SINGLE_BOOLEAN" ? "CANDIDATE" : "A,B";
    if (!reviewMode || !isSafeReviewProjection(input.blindProjection, reviewMode) || Object.keys(mapping).sort().join(",") !== mappingKeys || Object.values(mapping).some((value) => typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))) throw new BadRequestException("Blind review projection does not match the published metric mode");
    if (!calibration) throw new ForbiddenException("Reviewer calibration is not currently eligible");
    const manifestPayload = manifest?.payload && typeof manifest.payload === "object" && !Array.isArray(manifest.payload) ? manifest.payload as Record<string, unknown> : {};
    const protocolPinsRevisions = fixtureProtocol
      ? fixtureProtocol.judgeRevisionId === input.judgeRevisionId && fixtureProtocol.metricRevisionId === input.metricRevisionId
      : protocolContainsRevision(manifestPayload, "judgeRevisions", input.judgeRevisionId) && protocolContainsRevision(manifestPayload, "metricRevisions", input.metricRevisionId);
    if (!protocolPinsRevisions) throw new ForbiddenException();
    const attestationEvent = conflictEvents.find((event) => { const metadata = event.metadata as Record<string, unknown>; return metadata.policyId === calibration.policyId && metadata.protocolRevisionId === input.protocolRevisionId && metadata.outcome === "CLEARED" && metadata.declarations && typeof metadata.declarations === "object" && conflictDeclarationKeys.every((key) => (metadata.declarations as Record<string, unknown>)[key] === true); });
    if (!attestationEvent) throw new ForbiddenException("Reviewer conflict clearance is not recorded for this protocol");
    const attestationMetadata = attestationEvent.metadata as Record<string, unknown>;
    if (typeof attestationMetadata.evidenceDigest !== "string" || !/^[a-f0-9]{64}$/.test(attestationMetadata.evidenceDigest)) throw new ForbiddenException("Reviewer conflict evidence is invalid");
    const matchingPolicy = await this.db.oicReviewCalibrationPolicy.findFirst({ where: { id: attestationMetadata.policyId as string, applicationId: input.applicationId, tenantId: input.tenantId ?? null, judgeRevisionId: input.judgeRevisionId, status: "PUBLISHED" }, select: { id: true } });
    const [knownAuditConflict, release] = await Promise.all([
      this.db.oicAuditEvent.findFirst({ where: { applicationId: input.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: human.id, targetId: { in: protocolConflictTargets(input.protocolRevisionId, manifestPayload) }, action: { in: ["evaluation.fixture.authored", "evaluation.release.published", "review.oracle.accessed", "evaluation.candidate.operated", "evaluation.candidate.owned"] } }, select: { id: true } }),
      manifest ? this.db.oicEvaluationRelease.findFirst({ where: { id: manifest.releaseId, applicationId: input.applicationId, tenantId: input.tenantId ?? null }, select: { caseManifest: true } }) : Promise.resolve(null)
    ]);
    const knownConflict = Boolean(knownAuditConflict || (release && hasKnownHumanRoleConflict(release.caseManifest, human.id)));
    if (!matchingPolicy || knownConflict) throw new ForbiddenException("Reviewer conflict clearance is not valid for this assignment");
    const conflictState = "CLEARED";
    const eligibilitySnapshot = { reviewerId: human.id, calibration: "ELIGIBLE", calibrationId: calibration.id, calibrationExpiresAt: calibration.expiresAt, conflict: conflictState, attestationEventId: attestationEvent.id, conflictEvidenceDigest: attestationMetadata.evidenceDigest, capturedAt: new Date().toISOString() };
    const projection = input.blindProjection as Record<string, unknown>;
    let orderedProjection = projection;
    let randomizedOrder: string[] | undefined;
    if (reviewMode === "PAIRWISE" && Array.isArray(projection.candidates) && projection.candidates.length === 2) {
      const candidates: unknown[] = Array.isArray(projection.candidates) ? projection.candidates : [];
      if (randomBytes(1)[0]! >= 128) candidates.reverse();
      orderedProjection = { ...projection, candidates };
      randomizedOrder = candidates.map((candidate) => candidate && typeof candidate === "object" && "label" in candidate ? String(candidate.label) : "OPAQUE");
    }
    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(input.blindedItemId) || (input.deadlineAt && (!Number.isFinite(Date.parse(input.deadlineAt)) || Date.parse(input.deadlineAt) <= Date.now()))) throw new BadRequestException("Invalid assignment identity or deadline");
    const row = await this.db.$transaction(async (tx) => {
      const assignment = await tx.oicReviewAssignment.create({ data: { humanIdentityId: human.id, applicationId: input.applicationId, tenantId: input.tenantId ?? null, caseExecutionId: input.caseExecutionId, protocolRevisionId: input.protocolRevisionId, judgeRevisionId: input.judgeRevisionId, metricRevisionId: input.metricRevisionId, reviewMode, blindedItemId: input.blindedItemId, blindProjection: orderedProjection as Prisma.InputJsonValue, blindMapping: input.blindMapping as Prisma.InputJsonValue, randomizedOrder, conflictState, conflictEvidence: { status: conflictState, attestationEventId: attestationEvent.id, evidenceDigest: attestationMetadata.evidenceDigest } as Prisma.InputJsonValue, eligibilitySnapshot, deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: input.applicationId, tenantId: input.tenantId ?? null, action: "review.assignment.created", targetType: "review-assignment", targetId: assignment.id, ...requestIds(request), metadata: { humanIdentityId: human.id, conflictState } } });
      return assignment;
    });
    return { id: row.id, status: row.status, conflictState, eligibleForDecision: true };
  }

  async reassignAssignment(actor: AuthenticatedPrincipal, input: { applicationId: string; assignmentId: string; humanIdentityId: string }, request: { requestId?: string; traceId?: string }) {
    if (actor.applicationId !== input.applicationId || !actor.scopes.includes("oic:evaluation:manage")) throw new ForbiddenException();
    const original = await this.db.oicReviewAssignment.findFirst({ where: { id: input.assignmentId, applicationId: input.applicationId, status: { in: ["ASSIGNED", "OPENED"] } } });
    if (!original) throw new BadRequestException("Only an unsubmitted review assignment can be reassigned");
    if (original.conflictState !== "CLEARED") throw new ForbiddenException("Uncleared assignments cannot be reassigned");
    const replacement = await this.db.oicHumanIdentity.findFirst({ where: { id: input.humanIdentityId, status: "ACTIVE", memberships: { some: { applicationId: original.applicationId, tenantId: original.tenantId, status: "ACTIVE", revokedAt: null } }, authorizations: { some: { applicationId: original.applicationId, tenantId: original.tenantId, capability: "oic:evaluation:review:read", status: "ACTIVE", revokedAt: null } } }, select: { id: true } });
    if (!replacement || replacement.id === original.humanIdentityId) throw new ForbiddenException();
    const replacementCalibration = await this.db.oicReviewerCalibration.findFirst({ where: { humanIdentityId: replacement.id, applicationId: original.applicationId, tenantId: original.tenantId, policy: { judgeRevisionId: original.judgeRevisionId, status: "PUBLISHED" }, eligibility: "ELIGIBLE", expiresAt: { gt: new Date() }, supersededBy: { none: {} } }, select: { id: true, policyId: true, expiresAt: true }, orderBy: { completedAt: "desc" } });
    const attestations = await this.db.oicAuditEvent.findMany({ where: { applicationId: original.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: replacement.id, action: "review.conflict.attested" }, select: { id: true, metadata: true }, orderBy: { occurredAt: "desc" }, take: 500 });
    const replacementAttestation = replacementCalibration && attestations.find((event) => { const metadata = event.metadata as Record<string, unknown>; return metadata.policyId === replacementCalibration.policyId && metadata.protocolRevisionId === original.protocolRevisionId && metadata.outcome === "CLEARED" && typeof metadata.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(metadata.evidenceDigest); });
    if (!replacementCalibration || !replacementAttestation) throw new ForbiddenException("Replacement reviewer is not eligible for this protocol");
    const rawReplacementMetadata = replacementAttestation.metadata;
    if (!rawReplacementMetadata || typeof rawReplacementMetadata !== "object" || Array.isArray(rawReplacementMetadata) || typeof rawReplacementMetadata.evidenceDigest !== "string" || !/^[a-f0-9]{64}$/.test(rawReplacementMetadata.evidenceDigest)) throw new ForbiddenException("Replacement conflict evidence is invalid");
    const replacementEvidenceDigest = rawReplacementMetadata.evidenceDigest;
    const created = await this.db.$transaction(async (tx) => {
      const updated = await tx.oicReviewAssignment.updateMany({ where: { id: original.id, applicationId: original.applicationId, status: { in: ["ASSIGNED", "OPENED"] } }, data: { status: "REASSIGNED", reassignedAt: new Date() } });
      if (updated.count !== 1) throw new BadRequestException("Review assignment is no longer reassignment eligible");
      const next = await tx.oicReviewAssignment.create({ data: { humanIdentityId: replacement.id, applicationId: original.applicationId, tenantId: original.tenantId, caseExecutionId: original.caseExecutionId, protocolRevisionId: original.protocolRevisionId, judgeRevisionId: original.judgeRevisionId, metricRevisionId: original.metricRevisionId, blindedItemId: original.blindedItemId, blindProjection: original.blindProjection as Prisma.InputJsonValue, blindMapping: original.blindMapping as Prisma.InputJsonValue, randomizedOrder: original.randomizedOrder ?? undefined, conflictState: "CLEARED", conflictEvidence: { status: "CLEARED", attestationEventId: replacementAttestation.id, evidenceDigest: replacementEvidenceDigest }, eligibilitySnapshot: { reviewerId: replacement.id, calibration: "ELIGIBLE", calibrationId: replacementCalibration.id, calibrationExpiresAt: replacementCalibration.expiresAt, conflict: "CLEARED", attestationEventId: replacementAttestation.id, reassignedFrom: original.id }, deadlineAt: original.deadlineAt } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: original.applicationId, tenantId: original.tenantId, action: "review.assignment.reassigned", targetType: "review-assignment", targetId: original.id, ...requestIds(request), metadata: { replacementAssignmentId: next.id, previousReviewerId: original.humanIdentityId, reviewerId: replacement.id } } });
      return next;
    });
    return { id: created.id, previousAssignmentId: original.id, status: created.status, conflictState: created.conflictState, eligibleForDecision: true };
  }

  async openAssignment(token: string, assignmentId: string) {
    const row = await this.db.oicReviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!row) throw new UnauthorizedException();
    const actor = await this.resolveSession(token, "oic:evaluation:review:read", row.applicationId);
    if (actor.id !== row.humanIdentityId || row.status !== "ASSIGNED" || row.conflictState !== "CLEARED" || (row.deadlineAt && row.deadlineAt <= new Date())) throw new ForbiddenException();
    await this.assertCurrentReviewEligibility(row, actor.id);
    const metric = await this.db.oicEvaluationMetricRevision.findFirst({ where: { id: row.metricRevisionId, applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { definition: true } });
    const rawDefinition = metric?.definition && typeof metric.definition === "object" && !Array.isArray(metric.definition) ? metric.definition as Record<string, unknown> : {};
    const rawRange = rawDefinition.rangeOrCategories && typeof rawDefinition.rangeOrCategories === "object" && !Array.isArray(rawDefinition.rangeOrCategories) ? rawDefinition.rangeOrCategories as Record<string, unknown> : {};
    const ratingType = ["BOOLEAN", "COUNT", "DECIMAL", "CATEGORY", "PAIRWISE"].includes(String(rawDefinition.type)) ? rawDefinition.type : undefined;
    const safeRange: Record<string, unknown> = {};
    if (Array.isArray(rawRange.categories) && rawRange.categories.every((value) => typeof value === "string" && value.length <= 128)) safeRange.categories = rawRange.categories;
    if (typeof rawRange.minimum === "number" && Number.isFinite(rawRange.minimum)) safeRange.minimum = rawRange.minimum;
    if (typeof rawRange.maximum === "number" && Number.isFinite(rawRange.maximum)) safeRange.maximum = rawRange.maximum;
    const ratingDefinition = { type: ratingType, rangeOrCategories: safeRange };
    const reviewMode = row.reviewMode === "SINGLE_BOOLEAN" && ratingType === "BOOLEAN" ? "SINGLE_BOOLEAN" : row.reviewMode === "PAIRWISE" && ratingType === "PAIRWISE" ? "PAIRWISE" : null;
    if (!reviewMode || !isSafeReviewProjection(row.blindProjection, reviewMode)) throw new ForbiddenException("Review assignment projection is invalid");
    let abstentionAllowed = row.reviewMode !== "SINGLE_BOOLEAN";
    const fixtureProtocol = row.reviewMode === "SINGLE_BOOLEAN" ? await this.db.oicReviewFixtureProtocol.findFirst({ where: { id: row.protocolRevisionId, applicationId: row.applicationId, tenantId: row.tenantId, status: "PUBLISHED" }, select: { definition: true, rubricArtifactId: true, rubricDigest: true } }) : null;
    if (row.reviewMode === "SINGLE_BOOLEAN") {
      if (!fixtureProtocol || (fixtureProtocol.definition as Record<string, unknown>)?.reviewMode !== "SINGLE_BOOLEAN") throw new ForbiddenException("Single-response review protocol is unavailable");
      await this.vault.verifyReference(fixtureProtocol.rubricArtifactId, fixtureProtocol.rubricDigest, { applicationId: row.applicationId, tenantId: row.tenantId, purpose: "RUBRIC", exposureTier: "INTERNAL" });
      abstentionAllowed = (fixtureProtocol.definition as Record<string, unknown>).abstentionAllowed === true;
    }
    await this.db.$transaction(async (tx) => {
      const changed = await tx.oicReviewAssignment.updateMany({ where: { id: row.id, status: "ASSIGNED", humanIdentityId: actor.id, applicationId: actor.applicationId }, data: { status: "OPENED", openedAt: new Date() } });
      if (changed.count !== 1) throw new ForbiddenException();
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: "review.assignment.opened", targetType: "review-assignment", targetId: row.id, metadata: {} } });
    });
    return { id: row.id, reviewMode, abstentionAllowed, projection: row.blindProjection, ratingDefinition, status: "OPENED" };
  }

  async submit(token: string, assignmentId: string, input: { value?: unknown; abstained: boolean; rationale?: string }, request: { requestId?: string; traceId?: string }) {
    if (typeof input.abstained !== "boolean" || input.abstained === (input.value !== undefined) || (input.rationale?.length ?? 0) > 1000 || sensitiveTextPattern.test(input.rationale ?? "")) throw new BadRequestException("Provide a bounded, non-sensitive measurement or abstention");
    const row = await this.db.oicReviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!row) throw new UnauthorizedException();
    const actor = await this.resolveSession(token, "oic:evaluation:review:submit", row.applicationId);
    if (actor.id !== row.humanIdentityId || row.status !== "OPENED" || row.conflictState !== "CLEARED") throw new ForbiddenException();
    const calibration = await this.assertCurrentReviewEligibility(row, actor.id);
    if (row.reviewMode === "SINGLE_BOOLEAN" && input.rationale?.trim()) throw new BadRequestException("Rationale is not part of this review protocol");
    if (input.abstained && row.reviewMode === "SINGLE_BOOLEAN") {
      const fixtureProtocol = await this.db.oicReviewFixtureProtocol.findFirst({ where: { id: row.protocolRevisionId, applicationId: row.applicationId, tenantId: row.tenantId, status: "PUBLISHED" }, select: { definition: true } });
      if ((fixtureProtocol?.definition as Record<string, unknown> | undefined)?.abstentionAllowed !== true) throw new BadRequestException("Abstention is not allowed by this protocol");
    }
    if (!input.abstained) {
      const metric = await this.db.oicEvaluationMetricRevision.findFirst({ where: { id: row.metricRevisionId, applicationId: row.applicationId, tenantId: row.tenantId, status: "PUBLISHED" }, select: { definition: true } });
      if (!metric || !validMetricValue(input.value, metric.definition)) throw new BadRequestException("Rating does not match the published metric revision");
    }
    const snapshot = { calibrationId: calibration?.id ?? null, eligibility: calibration ? "ELIGIBLE" : "NOT_VERIFIED", conflict: row.conflictState, decisionEligible: Boolean(calibration && row.conflictState === "CLEARED") };
    const evidenceDigest = createHash("sha256").update(JSON.stringify({ assignmentId: row.id, humanId: actor.id, value: input.value ?? null, abstained: input.abstained, at: new Date().toISOString() })).digest("hex");
    const submission = await this.db.$transaction(async (tx) => {
      const created = await tx.oicReviewSubmission.create({ data: { assignmentId: row.id, humanIdentityId: actor.id, reviewerSessionId: actor.sessionId, blindedItemId: row.blindedItemId, metricRevisionId: row.metricRevisionId, judgeRevisionId: row.judgeRevisionId, protocolRevisionId: row.protocolRevisionId, reviewMode: row.reviewMode, value: input.value === undefined ? undefined : input.value as Prisma.InputJsonValue, abstained: input.abstained, rationale: input.rationale?.trim() || null, calibrationSnapshot: snapshot, evidenceDigest } });
      await tx.oicReviewAssignment.update({ where: { id: row.id }, data: { status: input.abstained ? "ABSTAINED" : "SUBMITTED" } });
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: input.abstained ? "review.abstained" : "review.submitted", targetType: "review-submission", targetId: created.id, ...requestIds(request), metadata: { assignmentId: row.id, evidenceDigest, calibration: snapshot.eligibility } } });
      return created;
    });
    return { id: submission.id, submittedAt: submission.submittedAt, abstained: submission.abstained, evidenceDigest, decisionEligible: snapshot.decisionEligible };
  }

  async listAssignments(token: string) {
    const session = await this.db.oicReviewerSession.findUnique({ where: { tokenHash: digest(token) }, select: { applicationId: true } });
    if (!session) throw new UnauthorizedException();
    const actor = await this.resolveSession(token, "oic:evaluation:review:read", session.applicationId);
    return this.db.oicReviewAssignment.findMany({ where: { humanIdentityId: actor.id, applicationId: actor.applicationId, tenantId: actor.tenantId, conflictState: "CLEARED", status: { in: ["ASSIGNED", "OPENED"] } }, select: { id: true, status: true, assignedAt: true, deadlineAt: true }, orderBy: { assignedAt: "asc" }, take: 100 });
  }

  async createCalibrationPolicy(actor: AuthenticatedPrincipal, input: { applicationId: string; tenantId?: string | null; judgeRevisionId: string; revision: number; calibrationSetDigest: string; referenceAnswers: unknown; minimumAgreement: number; expiresAfterDays: number }, request: { requestId?: string; traceId?: string }) {
    if (actor.applicationId !== input.applicationId || !actor.scopes.includes("oic:evaluation:manage")) throw new ForbiddenException();
    const calibrationSet = input.referenceAnswers;
    if (!calibrationSet || typeof calibrationSet !== "object" || Array.isArray(calibrationSet) || !/^[a-f0-9]{64}$/.test(input.calibrationSetDigest) || !Number.isInteger(input.revision) || input.revision < 1 || input.minimumAgreement < 0 || input.minimumAgreement > 1 || !Number.isInteger(input.expiresAfterDays) || input.expiresAfterDays < 1 || input.expiresAfterDays > 365) throw new BadRequestException("Invalid calibration policy");
    const set = calibrationSet as Record<string, unknown>;
    const anchors = set.anchors;
    const expectedAnswers = set.expectedAnswers;
    if (Object.keys(set).some((key) => !["anchors", "expectedAnswers"].includes(key)) || !Array.isArray(anchors) || !anchors.length || anchors.length > 500 || !expectedAnswers || typeof expectedAnswers !== "object" || Array.isArray(expectedAnswers)) throw new BadRequestException("Invalid calibration anchor set");
    if (!anchors.every(isCalibrationAnchor)) throw new BadRequestException("Invalid calibration anchor set");
    const computedCalibrationSetDigest = digest(canonicalJson(calibrationSet));
    if (computedCalibrationSetDigest !== input.calibrationSetDigest) throw new BadRequestException("Calibration set digest does not match the supplied anchor set");
    const anchorIds = anchors.map((anchor) => (anchor as { id: string }).id);
    if (new Set(anchorIds).size !== anchorIds.length) throw new BadRequestException("Invalid calibration anchor set");
    const answerKeys = Object.keys(expectedAnswers);
    if (answerKeys.length !== anchorIds.length || anchorIds.some((id) => !answerKeys.includes(String(id)))) throw new BadRequestException("Calibration reference answers do not match anchors");
    const judge = await this.db.oicEvaluationJudgeRevision.findFirst({ where: { id: input.judgeRevisionId, applicationId: input.applicationId, tenantId: input.tenantId ?? null, judgeType: "HUMAN", status: "DRAFT" }, select: { id: true, definition: true } });
    if (!judge || !judge.definition || typeof judge.definition !== "object" || !("calibrationDigest" in judge.definition) || judge.definition.calibrationDigest !== input.calibrationSetDigest) throw new BadRequestException("Calibration set digest does not match the draft human judge revision");
    const artifact = sealEvaluationArtifact(Buffer.from(JSON.stringify(calibrationSet), "utf8"), { applicationId: input.applicationId, tenantId: input.tenantId ?? null, purpose: "RUBRIC", exposureTier: "PROTECTED_CERTIFICATION" });
    const policy = await this.db.$transaction(async (tx) => {
      await tx.oicEvaluationArtifact.create({ data: { ...artifact, ciphertext: Uint8Array.from(artifact.ciphertext), createdBy: actor.id } });
      const created = await tx.oicReviewCalibrationPolicy.create({ data: { applicationId: input.applicationId, tenantId: input.tenantId ?? null, judgeRevisionId: input.judgeRevisionId, revision: input.revision, calibrationSetDigest: input.calibrationSetDigest, referenceArtifactId: artifact.id, minimumAnchors: anchors.length, minimumAgreement: input.minimumAgreement, expiresAfterDays: input.expiresAfterDays, createdByPrincipalId: actor.id } });
      await tx.oicEvaluationJudgeRevision.update({ where: { id: judge.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: input.applicationId, tenantId: input.tenantId ?? null, action: "review.calibration-policy.published", targetType: "review-calibration-policy", targetId: created.id, ...requestIds(request), metadata: { judgeRevisionId: input.judgeRevisionId, revision: input.revision, calibrationSetDigest: input.calibrationSetDigest, referenceArtifactId: artifact.id, anchorCount: anchors.length } } });
      return created;
    });
    return { id: policy.id, judgeRevisionId: policy.judgeRevisionId, revision: policy.revision, calibrationSetDigest: policy.calibrationSetDigest, minimumAnchors: policy.minimumAnchors, minimumAgreement: Number(policy.minimumAgreement), expiresAfterDays: policy.expiresAfterDays, status: policy.status };
  }

  async listCalibrationPolicies(token: string) {
    const session = await this.db.oicReviewerSession.findUnique({ where: { tokenHash: digest(token) }, select: { applicationId: true } });
    if (!session) throw new UnauthorizedException();
    const actor = await this.resolveSession(token, "oic:evaluation:review:calibrate", session.applicationId);
    const policies = await this.db.oicReviewCalibrationPolicy.findMany({ where: { applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { id: true, judgeRevisionId: true, revision: true, calibrationSetDigest: true, referenceArtifactId: true, minimumAnchors: true, minimumAgreement: true, expiresAfterDays: true }, orderBy: [{ judgeRevisionId: "asc" }, { revision: "desc" }], take: 100 });
    const judges = policies.length ? await this.db.oicEvaluationJudgeRevision.findMany({ where: { id: { in: policies.map((policy) => policy.judgeRevisionId) }, applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED", judgeType: "HUMAN" }, select: { id: true } }) : [];
    const validJudges = new Set(judges.map((judge) => judge.id));
    const safe = [];
    for (const policy of policies) {
      if (!validJudges.has(policy.judgeRevisionId)) continue;
      const opened = await this.vault.read(policy.referenceArtifactId, { applicationId: actor.applicationId, tenantId: actor.tenantId, purpose: "RUBRIC", exposureTier: "PROTECTED_CERTIFICATION" });
      try {
        const set = JSON.parse(opened.toString("utf8")) as { anchors?: unknown };
        if (!Array.isArray(set.anchors)) continue;
      const priorCalibration = await this.db.oicReviewerCalibration.findFirst({ where: { humanIdentityId: actor.id, applicationId: actor.applicationId, tenantId: actor.tenantId, policyId: policy.id, supersededBy: { none: {} } }, orderBy: { completedAt: "desc" }, select: { eligibility: true, expiresAt: true, completedAt: true, agreement: true, anchorCount: true, abstentions: true, evidenceDigest: true } });
      const eligibility = priorCalibration?.eligibility === "ELIGIBLE" && priorCalibration.expiresAt && priorCalibration.expiresAt <= new Date() ? "EXPIRED" : priorCalibration?.eligibility ?? "REQUIRED";
      const abstentionCount = Array.isArray(priorCalibration?.abstentions) ? priorCalibration.abstentions.length : 0;
      safe.push({ id: policy.id, judgeRevisionId: policy.judgeRevisionId, revision: policy.revision, calibrationSetDigest: policy.calibrationSetDigest, minimumAnchors: policy.minimumAnchors, minimumAgreement: Number(policy.minimumAgreement), expiresAfterDays: policy.expiresAfterDays, anchors: set.anchors, reviewerCalibration: priorCalibration ? { eligibility, expiresAt: priorCalibration.expiresAt, completedAt: priorCalibration.completedAt, agreement: priorCalibration.agreement === null ? null : Number(priorCalibration.agreement), anchorCount: priorCalibration.anchorCount, abstentionCount, evidenceDigest: priorCalibration.evidenceDigest } : { eligibility } });
      } finally { opened.fill(0); }
    }
    return safe;
  }

  async calibrate(token: string, input: { policyId: string; answers: unknown; abstentions?: unknown }) {
    const policy = await this.db.oicReviewCalibrationPolicy.findUnique({ where: { id: input.policyId } });
    if (!policy || policy.status !== "PUBLISHED") throw new ForbiddenException();
    const actor = await this.resolveSession(token, "oic:evaluation:review:calibrate", policy.applicationId);
    if (!input.answers || typeof input.answers !== "object" || Array.isArray(input.answers)) throw new BadRequestException("Invalid calibration answers");
    const answers = input.answers as Record<string, unknown>;
    const opened = await this.vault.read(policy.referenceArtifactId, { applicationId: policy.applicationId, tenantId: policy.tenantId, purpose: "RUBRIC", exposureTier: "PROTECTED_CERTIFICATION" });
    let expected: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(opened.toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid protected calibration artifact");
      if (!("expectedAnswers" in parsed)) throw new Error("invalid protected calibration artifact");
      const expectedAnswers = parsed.expectedAnswers;
      if (!expectedAnswers || typeof expectedAnswers !== "object" || Array.isArray(expectedAnswers)) throw new Error("invalid protected calibration artifact");
      expected = expectedAnswers as Record<string, unknown>;
    } finally { opened.fill(0); }
    const abstentions = Array.isArray(input.abstentions) ? input.abstentions : [];
    const scalarAnswer = (value: unknown) => value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || typeof value === "string" && value.length <= 256 && !/(?:bearer\s+oic_v1\.|sk-[A-Za-z0-9]{12,}|api[_ -]?key\s*[:=]|password\s*[:=]|-----BEGIN)/i.test(value);
    if ((input.abstentions !== undefined && (!Array.isArray(input.abstentions) || abstentions.some((value) => typeof value !== "string"))) || Object.keys(expected).length !== policy.minimumAnchors || Object.keys(answers).some((key) => !(key in expected) || !scalarAnswer(answers[key])) || abstentions.some((key) => typeof key !== "string" || !(key in expected) || Object.hasOwn(answers, key)) || input.abstentions && new Set(abstentions).size !== abstentions.length || Object.keys(answers).length + abstentions.length > policy.minimumAnchors) throw new BadRequestException("Calibration anchor set mismatch");
    let correct = 0;
    for (const [key, value] of Object.entries(answers)) if (Object.hasOwn(expected, key) && JSON.stringify(value) === JSON.stringify(expected[key])) correct += 1;
    const agreement = Object.keys(answers).length ? correct / Object.keys(expected).length : 0;
    const eligibility = agreement >= Number(policy.minimumAgreement) && Object.keys(answers).length >= policy.minimumAnchors && abstentions.length === 0 ? "ELIGIBLE" : "INELIGIBLE";
    const evidenceDigest = createHash("sha256").update(JSON.stringify({ policyId: policy.id, answers, abstentions, agreement })).digest("hex");
    const previous = await this.db.oicReviewerCalibration.findFirst({ where: { humanIdentityId: actor.id, applicationId: policy.applicationId, policyId: policy.id, supersededBy: { none: {} } }, orderBy: { completedAt: "desc" } });
    const result = await this.db.$transaction(async (tx) => {
      const row = await tx.oicReviewerCalibration.create({ data: { humanIdentityId: actor.id, applicationId: policy.applicationId, tenantId: policy.tenantId, policyId: policy.id, answers: answers as Prisma.InputJsonValue, abstentions: abstentions as Prisma.InputJsonValue, agreement, anchorCount: Object.keys(answers).length, eligibility, expiresAt: eligibility === "ELIGIBLE" ? new Date(Date.now() + policy.expiresAfterDays * 86_400_000) : null, supersedesId: previous?.id ?? null, evidenceDigest } });
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, applicationId: policy.applicationId, tenantId: policy.tenantId, action: "review.calibration.completed", targetType: "review-calibration", targetId: row.id, metadata: { policyId: policy.id, eligibility, agreement, anchorCount: row.anchorCount } } });
      return row;
    });
    return { id: result.id, eligibility, agreement, anchorCount: result.anchorCount, expiresAt: result.expiresAt, evidenceDigest };
  }

  async adjudicate(token: string, input: { submissionIds: string[]; decision: unknown; rationale?: string }, request: { requestId?: string; traceId?: string }) {
    if (input.submissionIds.length < 2 || input.submissionIds.length > 10 || new Set(input.submissionIds).size !== input.submissionIds.length || input.submissionIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id)) || (input.rationale?.length ?? 0) > 1000 || /(?:bearer\s+oic_v1\.|sk-[A-Za-z0-9]{12,}|api[_ -]?key\s*[:=]|password\s*[:=]|-----BEGIN)/i.test(input.rationale ?? "")) throw new BadRequestException("Invalid adjudication request");
    const session = await this.db.oicReviewerSession.findUnique({ where: { tokenHash: digest(token) }, select: { applicationId: true } });
    if (!session) throw new UnauthorizedException();
    const actor = await this.resolveSession(token, "oic:evaluation:review:adjudicate", session.applicationId);
    const rows = await this.db.oicReviewSubmission.findMany({ where: { id: { in: input.submissionIds }, assignment: { applicationId: actor.applicationId, tenantId: actor.tenantId } }, include: { assignment: { select: { caseExecutionId: true, blindedItemId: true, protocolRevisionId: true, judgeRevisionId: true, metricRevisionId: true } } } });
    if (rows.length !== input.submissionIds.length || new Set(rows.map((row) => row.humanIdentityId)).size < 2 || rows.some((row) => row.assignment.caseExecutionId !== rows[0]?.assignment.caseExecutionId || row.assignment.blindedItemId !== rows[0]?.assignment.blindedItemId || row.assignment.protocolRevisionId !== rows[0]?.assignment.protocolRevisionId || row.assignment.judgeRevisionId !== rows[0]?.assignment.judgeRevisionId || row.assignment.metricRevisionId !== rows[0]?.assignment.metricRevisionId)) throw new BadRequestException("Adjudication sources must be independent ratings of the same blinded item and revision");
    const distinctValues = new Set(rows.map((row) => row.abstained ? "ABSTAIN" : JSON.stringify(row.value)));
    if (distinctValues.size < 2) throw new BadRequestException("Adjudication requires disagreement or abstention evidence");
    const metric = await this.db.oicEvaluationMetricRevision.findFirst({ where: { id: rows[0]!.assignment.metricRevisionId, applicationId: actor.applicationId, tenantId: actor.tenantId, status: "PUBLISHED" }, select: { definition: true } });
    if (!metric || !validMetricValue(input.decision, metric.definition)) throw new BadRequestException("Adjudication decision does not match the published metric revision");
    const sourceSubmissionIds = rows.map((row) => row.id);
    const evidenceDigest = createHash("sha256").update(JSON.stringify({ sourceSubmissionIds, decision: input.decision, actor: actor.id, at: new Date().toISOString() })).digest("hex");
    const adjudication = await this.db.$transaction(async (tx) => {
      const created = await tx.oicReviewAdjudication.create({ data: { humanIdentityId: actor.id, applicationId: actor.applicationId, tenantId: actor.tenantId, caseExecutionId: rows[0]!.assignment.caseExecutionId, blindedItemId: rows[0]!.assignment.blindedItemId, metricRevisionId: rows[0]!.assignment.metricRevisionId, judgeRevisionId: rows[0]!.assignment.judgeRevisionId, protocolRevisionId: rows[0]!.assignment.protocolRevisionId, sourceSubmissionIds, decision: input.decision as Prisma.InputJsonValue, rationale: input.rationale?.trim() || null, evidenceDigest } });
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: actor.id, applicationId: actor.applicationId, tenantId: actor.tenantId, action: "review.adjudication.completed", targetType: "review-adjudication", targetId: created.id, ...requestIds(request), metadata: { sourceSubmissionIds, evidenceDigest } } });
      return created;
    });
    return { id: adjudication.id, sourceSubmissionIds, evidenceDigest, decisionEligible: false, rationale: adjudication.rationale };
  }
}
