import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { OicDatabaseService, type Prisma } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { EvaluationArtifactVault } from "./artifact-vault";
import { ReviewerService } from "./reviewer.service";

const qualificationKey = "OIC7_PACKET_7_5_ARABIC_NATIVE_CONTENT_REVIEW";
const domainReviewScopeKey = "OIC7_PACKET_7_5_ARABIC_DOMAIN_REVIEW";
const conflictDeclarationKeys = ["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"] as const;
const requiredArabicSlices = [
  "msa_understanding", "msa_generation", "egyptian_understanding", "egyptian_generation",
  "arabic_english_mixed", "translation", "localization", "business_communication", "sales_support_dialogue"
] as const;
const sensitiveText = /(?:bearer\s+oic_v1\.|sk-[A-Za-z0-9]{12,}|api[_ -]?key\s*[:=]|password\s*[:=]|-----BEGIN)/i;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};
const digest = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");
const knownConflictIdentityKeys = new Set(["reviewedBy", "authoredByHumanIdentityId", "authorHumanIdentityId", "ownerHumanIdentityId", "operatorHumanIdentityId", "protectedOracleAccessByHumanIdentityId", "publisherHumanIdentityId", "approvedByHumanIdentityId"]);
const hasKnownConflict = (value: unknown, humanIdentityId: string): boolean => {
  if (Array.isArray(value)) return value.some((item) => hasKnownConflict(item, humanIdentityId));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => knownConflictIdentityKeys.has(key) && (item === humanIdentityId || (Array.isArray(item) && item.includes(humanIdentityId))) || hasKnownConflict(item, humanIdentityId));
};
const assertManage = (actor: AuthenticatedPrincipal) => {
  if (!actor.scopes.includes("oic:evaluation:manage") && !actor.scopes.includes("oic:foundation:admin")) throw new ForbiddenException();
};

@Injectable()
export class DomainReviewService {
  constructor(private readonly db: OicDatabaseService, private readonly artifacts: EvaluationArtifactVault, private readonly reviewers: ReviewerService) {}

  async attestArabicQualifications(actor: AuthenticatedPrincipal, reviewerIds: string[]) {
    assertManage(actor);
    if (reviewerIds.length !== 2 || new Set(reviewerIds).size !== 2 || reviewerIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new BadRequestException("Exactly two distinct human reviewer identities are required");
    const results = [];
    for (const humanIdentityId of reviewerIds) {
      const human = await this.db.oicHumanIdentity.findFirst({
        where: { id: humanIdentityId, status: "ACTIVE", memberships: { some: { applicationId: actor.applicationId, status: "ACTIVE", revokedAt: null, tenantId: null } }, authSubjects: { some: { kind: "LOCAL", status: "ACTIVE", revokedAt: null } } },
        select: { id: true }
      });
      if (!human) throw new ConflictException("ACTIVE_LOCAL_APPLICATION_REVIEWER_REQUIRED");
      const claim = { humanIdentityId, applicationId: actor.applicationId, qualificationKey, language: "ar", proficiency: "NATIVE", isPrimaryLanguage: true, attestationSource: "OWNER_ATTESTATION" };
      const attestationDigest = digest(claim);
      const prior = await this.db.oicReviewerQualificationAttestation.findUnique({ where: { humanIdentityId_applicationId_qualificationKey: { humanIdentityId, applicationId: actor.applicationId, qualificationKey } } });
      if (prior && prior.attestationDigest !== attestationDigest) throw new ConflictException("QUALIFICATION_ATTESTATION_IMMUTABILITY_CONFLICT");
      const row = prior ?? await this.db.$transaction(async (tx) => {
        const created = await tx.oicReviewerQualificationAttestation.create({ data: { ...claim, attestationDigest, attestedByPrincipalId: actor.id } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: actor.applicationId, action: "reviewer.qualification.owner_attested", targetType: "reviewer-qualification", targetId: created.id, metadata: { humanIdentityId, qualificationKey, language: "ar", proficiency: "NATIVE", isPrimaryLanguage: true, attestationSource: "OWNER_ATTESTATION", attestationDigest } } });
        return created;
      });
      results.push({ id: row.id, humanIdentityId, qualificationKey: row.qualificationKey, language: row.language, proficiency: row.proficiency, isPrimaryLanguage: row.isPrimaryLanguage, attestedAt: row.attestedAt, attestationDigest: row.attestationDigest });
    }
    return { applicationId: actor.applicationId, qualifications: results };
  }

  async listArabicQualifications(actor: AuthenticatedPrincipal) {
    assertManage(actor);
    const rows = await this.db.oicReviewerQualificationAttestation.findMany({ where: { applicationId: actor.applicationId, qualificationKey }, orderBy: [{ attestedAt: "asc" }, { id: "asc" }] });
    return { applicationId: actor.applicationId, qualificationKey, qualifications: rows.map(({ id, humanIdentityId, language, proficiency, isPrimaryLanguage, attestationSource, attestationDigest, attestedAt }) => ({ id, humanIdentityId, language, proficiency, isPrimaryLanguage, attestationSource, attestationDigest, attestedAt })) };
  }

  async prepareArabicBatch(actor: AuthenticatedPrincipal, input: { packId: string; primaryReviewerId: string; independentReviewerId: string }) {
    assertManage(actor);
    if (input.primaryReviewerId === input.independentReviewerId) throw new BadRequestException("Reviewers must be distinct human identities");
    const pack = await this.db.oicEvaluationPackRevision.findFirst({ where: { id: input.packId, applicationId: actor.applicationId, tenantId: null, status: "VALIDATED", domain: "Arabic" }, include: { cases: { orderBy: { caseKey: "asc" } } } });
    if (!pack || pack.cases.length !== requiredArabicSlices.length) throw new ConflictException("VALIDATED_ARABIC_PACK_WITH_REQUIRED_SLICES_REQUIRED");
    const casesBySlice = new Map<string, typeof pack.cases[number]>();
    for (const item of pack.cases) {
      const slices = Array.isArray(item.slices) ? item.slices.filter((slice): slice is string => typeof slice === "string") : [];
      const slice = slices.find((candidate) => (requiredArabicSlices as readonly string[]).includes(candidate));
      if (!slice || casesBySlice.has(slice)) throw new ConflictException("ARABIC_SLICE_COVERAGE_INVALID");
      casesBySlice.set(slice, item);
    }
    if (requiredArabicSlices.some((slice) => !casesBySlice.has(slice))) throw new ConflictException("ARABIC_SLICE_COVERAGE_INCOMPLETE");
    const reviewerIds = [input.primaryReviewerId, input.independentReviewerId];
    const qualifications = await this.db.oicReviewerQualificationAttestation.findMany({ where: { applicationId: actor.applicationId, humanIdentityId: { in: reviewerIds }, qualificationKey, language: "ar", proficiency: "NATIVE", isPrimaryLanguage: true } });
    if (qualifications.length !== 2) throw new ConflictException("ARABIC_NATIVE_REVIEW_QUALIFICATION_REQUIRED");
    for (const humanIdentityId of reviewerIds) {
      const reviewer = await this.db.oicHumanIdentity.findFirst({ where: { id: humanIdentityId, status: "ACTIVE", memberships: { some: { applicationId: actor.applicationId, tenantId: null, status: "ACTIVE", revokedAt: null } }, authorizations: { some: { applicationId: actor.applicationId, tenantId: null, capability: "oic:evaluation:review:read", status: "ACTIVE", revokedAt: null, effectiveAt: { lte: new Date() } } }, authSubjects: { some: { kind: "LOCAL", status: "ACTIVE", revokedAt: null } } }, select: { id: true } });
      const canSubmit = await this.db.oicReviewerAuthorization.findFirst({ where: { humanIdentityId, applicationId: actor.applicationId, tenantId: null, capability: "oic:evaluation:review:submit", status: "ACTIVE", revokedAt: null, effectiveAt: { lte: new Date() } }, select: { id: true } });
      if (!reviewer || !canSubmit) throw new ConflictException("ACTIVE_REVIEWER_READ_AND_SUBMIT_AUTHORIZATION_REQUIRED");
    }
    const prepared: Array<{ caseRevisionId: string; slice: string; projection: Prisma.InputJsonValue }> = [];
    for (const slice of requiredArabicSlices) {
      const item = casesBySlice.get(slice)!;
      const inputRef = record(item.inputArtifact);
      const artifactId = item.exposureTier === "PRIVATE_HOLDOUT" || item.exposureTier === "PROTECTED_CERTIFICATION" ? inputRef.encryptedArtifactId : inputRef.artifactId;
      if (typeof artifactId !== "string" || inputRef.digest !== item.sourceDigest) throw new ConflictException("REVIEW_INPUT_ARTIFACT_INVALID");
      const bytes = await this.artifacts.read(artifactId, { applicationId: actor.applicationId, tenantId: null, purpose: "INPUT", exposureTier: item.exposureTier });
      let source: Record<string, unknown>;
      try {
        source = record(JSON.parse(bytes.toString("utf8")));
      } catch {
        bytes.fill(0);
        throw new ConflictException("REVIEW_INPUT_DOCUMENT_INVALID");
      }
      bytes.fill(0);
      const allowed = new Set(["prompt", "rubric", "language", "taskType", "itemLabel", "criteria"]);
      if (Object.keys(source).some((key) => !allowed.has(key)) || typeof source.prompt !== "string" || typeof source.rubric !== "string" || source.prompt.length > 4000 || source.rubric.length > 4000 || sensitiveText.test(source.prompt) || sensitiveText.test(source.rubric)) throw new ConflictException("REVIEW_PROJECTION_UNSAFE");
      const projection = { domainFamily: "Arabic", slice, prompt: source.prompt, rubric: source.rubric, language: item.language, taskType: item.taskType };
      prepared.push({ caseRevisionId: item.id, slice, projection });
    }
    const existing = await this.db.oicDomainReviewBatch.findUnique({ where: { packId_manifestDigest: { packId: pack.id, manifestDigest: pack.manifestDigest } }, include: { assignments: { select: { id: true, caseRevisionId: true, humanIdentityId: true, reviewerRole: true, status: true } } } });
    if (existing) {
      const reviewerForRole = (role: string) => existing.assignments.find((assignment) => assignment.reviewerRole === role)?.humanIdentityId;
      if (reviewerForRole("PRIMARY") !== input.primaryReviewerId || reviewerForRole("INDEPENDENT") !== input.independentReviewerId) throw new ConflictException("DOMAIN_REVIEW_BATCH_REVIEWER_IMMUTABILITY_CONFLICT");
      const summary = this.batchSummary(existing);
      await this.ensureConflictScope(actor, existing.id);
      return summary;
    }
    const qualificationByHuman = new Map<string, { id: string; digest: string }>();
    for (const item of qualifications) {
      if (typeof item.humanIdentityId !== "string" || typeof item.id !== "string" || typeof item.attestationDigest !== "string") throw new ConflictException("ARABIC_NATIVE_REVIEW_QUALIFICATION_INVALID");
      qualificationByHuman.set(item.humanIdentityId, { id: item.id, digest: item.attestationDigest });
    }
    const primaryQualification = qualificationByHuman.get(input.primaryReviewerId);
    const independentQualification = qualificationByHuman.get(input.independentReviewerId);
    if (!primaryQualification || !independentQualification) throw new ConflictException("ARABIC_NATIVE_REVIEW_QUALIFICATION_INVALID");
    const batch = await this.db.$transaction(async (tx) => {
      const created = await tx.oicDomainReviewBatch.create({ data: { applicationId: actor.applicationId, packId: pack.id, manifestDigest: pack.manifestDigest, createdByPrincipalId: actor.id } });
      const rows = prepared.flatMap((item) => [
        { batchId: created.id, applicationId: actor.applicationId, packId: pack.id, caseRevisionId: item.caseRevisionId, humanIdentityId: input.primaryReviewerId, reviewerRole: "PRIMARY", blindedItemId: `oic7-ar-${item.slice}`, blindProjection: item.projection, eligibilitySnapshot: { qualificationId: primaryQualification.id, qualificationDigest: primaryQualification.digest }, status: "ASSIGNED" },
        { batchId: created.id, applicationId: actor.applicationId, packId: pack.id, caseRevisionId: item.caseRevisionId, humanIdentityId: input.independentReviewerId, reviewerRole: "INDEPENDENT", blindedItemId: `oic7-ar-${item.slice}`, blindProjection: item.projection, eligibilitySnapshot: { qualificationId: independentQualification.id, qualificationDigest: independentQualification.digest }, status: "HELD" }
      ]);
      await tx.oicDomainReviewAssignment.createMany({ data: rows });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: actor.applicationId, action: "evaluation.domain_review.batch_prepared", targetType: "domain-review-batch", targetId: created.id, metadata: { packId: pack.id, packManifestDigest: pack.manifestDigest, itemCount: prepared.length, primaryReviewerId: input.primaryReviewerId, independentReviewerId: input.independentReviewerId, independentAssignmentsHeldUntilPrimaryCompletion: true } } });
      return created;
    });
    const full = await this.db.oicDomainReviewBatch.findUnique({ where: { id: batch.id }, include: { assignments: { select: { id: true, caseRevisionId: true, humanIdentityId: true, reviewerRole: true, status: true } } } });
    if (!full) throw new ConflictException("DOMAIN_REVIEW_BATCH_READBACK_FAILED");
    const summary = this.batchSummary(full);
    await this.ensureConflictScope(actor, full.id);
    return summary;
  }

  async ensureConflictScope(actor: AuthenticatedPrincipal, batchId: string) {
    assertManage(actor);
    const batch = await this.db.oicDomainReviewBatch.findFirst({ where: { id: batchId, applicationId: actor.applicationId }, include: { pack: { include: { cases: { orderBy: [{ caseKey: "asc" }, { revision: "asc" }] } } }, assignments: { select: { humanIdentityId: true, reviewerRole: true } }, conflictScope: true } });
    if (!batch || batch.pack.domain !== "Arabic" || batch.pack.status !== "VALIDATED" || batch.assignments.length !== 18) throw new ConflictException("VALID_ARABIC_DOMAIN_REVIEW_BATCH_REQUIRED");
    const roles = [...batch.assignments].map((row) => ({ role: row.reviewerRole, humanIdentityId: row.humanIdentityId })).sort((a, b) => a.role.localeCompare(b.role) || a.humanIdentityId.localeCompare(b.humanIdentityId));
    if (new Set(roles.filter((row) => row.role === "PRIMARY").map((row) => row.humanIdentityId)).size !== 1 || new Set(roles.filter((row) => row.role === "INDEPENDENT").map((row) => row.humanIdentityId)).size !== 1) throw new ConflictException("DOMAIN_REVIEW_ROLE_PROVENANCE_INVALID");
    const provenance = batch.pack.cases.map((item) => ({ caseRevisionId: item.id, caseKey: item.caseKey, revision: item.revision, slices: item.slices, language: item.language, taskType: item.taskType, sourceDigest: item.sourceDigest, oracleDigest: item.oracleDigest, rightsDigest: digest(item.rights), exposureTier: item.exposureTier })).sort((a, b) => a.caseKey.localeCompare(b.caseKey));
    const sourceProvenanceDigest = digest(provenance);
    const scopeFields = { applicationId: batch.applicationId, scopeKey: domainReviewScopeKey, revision: 1, reviewPurpose: "OIC-7 Packet 7.5 Arabic domain review", domain: "Arabic", batchId: batch.id, packId: batch.packId, packManifestDigest: batch.pack.manifestDigest, batchManifestDigest: batch.manifestDigest, sourceProvenanceDigest, reviewerRoles: roles };
    const scopeDigest = digest(scopeFields);
    if (batch.conflictScope) {
      if (batch.conflictScope.scopeDigest !== scopeDigest || batch.conflictScope.status !== "PUBLISHED") throw new ConflictException("DOMAIN_REVIEW_CONFLICT_SCOPE_IMMUTABILITY_CONFLICT");
      return { id: batch.conflictScope.id, scopeKey: batch.conflictScope.scopeKey, revision: batch.conflictScope.revision, reviewPurpose: batch.conflictScope.reviewPurpose, domain: batch.conflictScope.domain, scopeDigest: batch.conflictScope.scopeDigest, status: batch.conflictScope.status, publishedAt: batch.conflictScope.publishedAt };
    }
    const now = new Date();
    let scope;
    try {
      scope = await this.db.$transaction(async (tx) => {
        const created = await tx.oicDomainReviewConflictScope.create({ data: { applicationId: batch.applicationId, batchId: batch.id, packId: batch.packId, scopeKey: domainReviewScopeKey, revision: 1, reviewPurpose: "OIC-7 Packet 7.5 Arabic domain review", domain: "Arabic", packManifestDigest: batch.pack.manifestDigest, batchManifestDigest: batch.manifestDigest, sourceProvenanceDigest, scopeDigest, status: "PUBLISHED", createdByPrincipalId: actor.id, createdAt: now, publishedAt: now } });
        await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: actor.applicationId, action: "evaluation.domain_review.conflict_scope.published", targetType: "domain-review-conflict-scope", targetId: created.id, metadata: { scopeKey: domainReviewScopeKey, revision: 1, batchId: batch.id, packId: batch.packId, scopeDigest, sourceProvenanceDigest, reviewerRoles: roles } } });
        return created;
      });
    } catch (error) {
      const prismaCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (prismaCode !== "P2002") throw error;
      const committed = await this.db.oicDomainReviewConflictScope.findUnique({ where: { batchId: batch.id } });
      if (!committed || committed.scopeDigest !== scopeDigest || committed.status !== "PUBLISHED") throw new ConflictException("DOMAIN_REVIEW_CONFLICT_SCOPE_IMMUTABILITY_CONFLICT");
      scope = committed;
    }
    return { id: scope.id, scopeKey: scope.scopeKey, revision: scope.revision, reviewPurpose: scope.reviewPurpose, domain: scope.domain, scopeDigest: scope.scopeDigest, status: scope.status, publishedAt: scope.publishedAt };
  }

  async getConflictState(token: string) {
    const reviewer = await this.reviewers.resolveSession(token, "oic:evaluation:review:calibrate");
    const assignment = await this.db.oicDomainReviewAssignment.findFirst({ where: { applicationId: reviewer.applicationId, humanIdentityId: reviewer.id, pack: { domain: "Arabic" }, batch: { conflictScope: { isNot: null } } }, orderBy: { assignedAt: "asc" }, select: { reviewerRole: true, pack: { select: { manifest: true, cases: { select: { rights: true, oracle: true } } } }, batch: { select: { id: true, conflictScope: true } } } });
    if (!assignment?.batch.conflictScope) return { state: "UNKNOWN", scope: null };
    const scope = assignment.batch.conflictScope;
    if (hasKnownConflict(assignment.pack.manifest, reviewer.id) || assignment.pack.cases.some((item) => hasKnownConflict(item.rights, reviewer.id) || hasKnownConflict(item.oracle, reviewer.id))) return { state: "CONFLICTED", role: assignment.reviewerRole, scope: this.publicConflictScope(scope) };
    const audit = await this.db.oicAuditEvent.findFirst({ where: { applicationId: reviewer.applicationId, actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, action: "review.conflict.attested", targetType: "domain-review-conflict-attestation", targetId: scope.id }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }] });
    if (!audit) return { state: scope.status === "PUBLISHED" ? "REQUIRES_ATTESTATION" : "UNKNOWN", role: assignment.reviewerRole, scope: this.publicConflictScope(scope) };
    const metadata = record(audit.metadata);
    const declarations = record(metadata.declarations);
    const expectedEvidenceDigest = digest({ applicationId: reviewer.applicationId, humanIdentityId: reviewer.id, role: assignment.reviewerRole, batchId: assignment.batch.id, scopeId: scope.id, scopeDigest: scope.scopeDigest, declarations, outcome: "CLEARED" });
    const valid = audit.applicationId === reviewer.applicationId && audit.actorType === "HUMAN_IDENTITY" && audit.actorHumanIdentityId === reviewer.id && audit.action === "review.conflict.attested" && audit.targetType === "domain-review-conflict-attestation" && audit.targetId === scope.id && metadata.scopeDigest === scope.scopeDigest && metadata.batchId === assignment.batch.id && metadata.reviewerRole === assignment.reviewerRole && metadata.knownHumanConflictCheck === "NO_MATCH" && conflictDeclarationKeys.every((key) => declarations[key] === true) && metadata.outcome === "CLEARED" && metadata.evidenceDigest === expectedEvidenceDigest;
    return { state: valid ? "CLEARED" : metadata.outcome === "CONFLICTED" ? "CONFLICTED" : "UNKNOWN", role: assignment.reviewerRole, scope: this.publicConflictScope(scope) };
  }

  async attestConflict(token: string, declarations: Record<string, unknown>, request: { requestId?: string; traceId?: string }) {
    const reviewer = await this.reviewers.resolveSession(token, "oic:evaluation:review:calibrate");
    if (Object.keys(declarations).sort().join(",") !== [...conflictDeclarationKeys].sort().join(",") || conflictDeclarationKeys.some((key) => typeof declarations[key] !== "boolean")) throw new BadRequestException("Invalid conflict declaration");
    const assignment = await this.db.oicDomainReviewAssignment.findFirst({ where: { applicationId: reviewer.applicationId, humanIdentityId: reviewer.id, pack: { domain: "Arabic" }, batch: { conflictScope: { isNot: null } } }, orderBy: { assignedAt: "asc" }, select: { reviewerRole: true, pack: { select: { manifest: true, cases: { select: { rights: true, oracle: true } } } }, batch: { select: { id: true, conflictScope: true, assignments: { where: { humanIdentityId: reviewer.id }, select: { submissions: { select: { id: true, submittedAt: true, evidenceDigest: true } } } } } } } });
    if (!assignment?.batch.conflictScope) throw new ConflictException("DOMAIN_REVIEW_CONFLICT_SCOPE_UNKNOWN");
    const scope = assignment.batch.conflictScope;
    if (scope.status !== "PUBLISHED") throw new ConflictException("DOMAIN_REVIEW_CONFLICT_SCOPE_NOT_ACTIVE");
    const systemConflict = hasKnownConflict(assignment.pack.manifest, reviewer.id) || assignment.pack.cases.some((item) => hasKnownConflict(item.rights, reviewer.id) || hasKnownConflict(item.oracle, reviewer.id));
    const knownConflict = systemConflict || conflictDeclarationKeys.some((key) => declarations[key] !== true);
    const outcome = knownConflict ? "CONFLICTED" : "CLEARED";
    const evidenceDigest = digest({ applicationId: reviewer.applicationId, humanIdentityId: reviewer.id, role: assignment.reviewerRole, batchId: assignment.batch.id, scopeId: scope.id, scopeDigest: scope.scopeDigest, declarations, outcome });
    const evidence = await this.db.$transaction(async (tx) => {
      const audit = await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, applicationId: reviewer.applicationId, action: "review.conflict.attested", targetType: "domain-review-conflict-attestation", targetId: scope.id, requestId: request.requestId, traceId: request.traceId, metadata: { scopeType: "DOMAIN_REVIEW_BATCH", scopeId: scope.id, scopeDigest: scope.scopeDigest, batchId: assignment.batch.id, reviewerRole: assignment.reviewerRole, declarations: declarations as Prisma.InputJsonObject, knownHumanConflictCheck: systemConflict ? "MATCH" : "NO_MATCH", outcome, evidenceDigest } } });
      const priorSubmissions = assignment.batch.assignments.flatMap((item) => item.submissions);
      if (outcome === "CLEARED" && priorSubmissions.length > 0) await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, applicationId: reviewer.applicationId, action: "evaluation.domain_review.conflict_reconciled", targetType: "domain-review-batch", targetId: assignment.batch.id, requestId: request.requestId, traceId: request.traceId, metadata: { scopeId: scope.id, scopeDigest: scope.scopeDigest, attestationEventId: audit.id, attestedAt: audit.occurredAt, reconciliationAt: new Date(), priorSubmissionCount: priorSubmissions.length, priorSubmissions: priorSubmissions.map((item) => ({ id: item.id, submittedAt: item.submittedAt, evidenceDigest: item.evidenceDigest })), lineage: "SUBMISSIONS_PRECEDED_DISCOVERY_AND_SCOPED_ATTESTATION; ELIGIBILITY_RECONCILED_AFTER_ATTESTATION" } } });
      return audit;
    });
    return { state: outcome, scopeDigest: scope.scopeDigest, recordedAt: evidence.occurredAt, reconciledPriorSubmissions: outcome === "CLEARED" ? assignment.batch.assignments.flatMap((item) => item.submissions).length : 0 };
  }

  private publicConflictScope(scope: { id: string; scopeKey: string; revision: number; reviewPurpose: string; domain: string; scopeDigest: string; status: string; publishedAt: Date }) {
    return { id: scope.id, scopeKey: scope.scopeKey, revision: scope.revision, reviewPurpose: scope.reviewPurpose, domain: scope.domain, scopeDigest: scope.scopeDigest, status: scope.status, publishedAt: scope.publishedAt };
  }

  async listAssignments(token: string) {
    const reviewer = await this.reviewers.resolveSession(token, "oic:evaluation:review:read");
    const conflict = await this.getConflictState(token).catch(() => ({ state: "UNKNOWN" as const }));
    const rows = await this.db.oicDomainReviewAssignment.findMany({ where: { humanIdentityId: reviewer.id, applicationId: reviewer.applicationId, status: { in: ["ASSIGNED", "OPENED", "SUBMITTED"] }, batch: { status: { in: ["PREPARED", "SECOND_REVIEW_OPEN", "COMPLETED"] } } }, orderBy: [{ assignedAt: "asc" }, { id: "asc" }], select: { id: true, reviewerRole: true, blindedItemId: true, blindProjection: true, status: true, assignedAt: true, submissions: { select: { submittedAt: true, evidenceDigest: true } } } });
    return { conflictState: conflict.state, assignments: rows.map(({ submissions, ...assignment }) => ({ ...assignment, blindProjection: conflict.state === "CLEARED" ? assignment.blindProjection : { slice: assignment.blindedItemId.replace(/^oic7-ar-/, "") }, actualStatus: assignment.status, status: assignment.status !== "SUBMITTED" && conflict.state !== "CLEARED" ? "BLOCKED_CONFLICT" : assignment.status, actionable: assignment.status !== "SUBMITTED" && conflict.state === "CLEARED", submission: submissions[0] ? { submittedAt: submissions[0].submittedAt, evidenceDigest: submissions[0].evidenceDigest } : null })) };
  }

  async openAssignment(token: string, id: string, request: { requestId?: string; traceId?: string }) {
    const reviewer = await this.reviewers.resolveSession(token, "oic:evaluation:review:read");
    const row = await this.db.oicDomainReviewAssignment.findFirst({ where: { id, humanIdentityId: reviewer.id, applicationId: reviewer.applicationId, status: { in: ["ASSIGNED", "OPENED"] } }, include: { batch: { select: { id: true, status: true, conflictScope: true } } } });
    if (!row || (row.reviewerRole === "INDEPENDENT" && row.batch.status !== "SECOND_REVIEW_OPEN")) throw new NotFoundException();
    await this.assertActionEligible(token, reviewer, row.eligibilitySnapshot, row.batch.conflictScope, row.batch.id);
    if (row.status === "ASSIGNED") {
      await this.db.$transaction(async (tx) => {
        const updated = await tx.oicDomainReviewAssignment.updateMany({ where: { id, status: "ASSIGNED" }, data: { status: "OPENED", openedAt: new Date() } });
        if (updated.count === 1) await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, applicationId: reviewer.applicationId, action: "evaluation.domain_review.opened", targetType: "domain-review-assignment", targetId: id, requestId: request.requestId, traceId: request.traceId, metadata: { reviewerRole: row.reviewerRole, blindedItemId: row.blindedItemId } } });
      });
    }
    return { id: row.id, reviewerRole: row.reviewerRole, blindedItemId: row.blindedItemId, projection: row.blindProjection, status: row.status === "ASSIGNED" ? "OPENED" : row.status };
  }

  async submit(token: string, id: string, input: { decision: string; notes?: string }, request: { requestId?: string; traceId?: string }) {
    const reviewer = await this.reviewers.resolveSession(token, "oic:evaluation:review:submit");
    if (!["APPROVE", "REJECT", "FLAG"].includes(input.decision) || (input.notes?.length ?? 0) > 1000 || sensitiveText.test(input.notes ?? "")) throw new BadRequestException("Invalid domain content review submission");
    const row = await this.db.oicDomainReviewAssignment.findFirst({ where: { id, humanIdentityId: reviewer.id, applicationId: reviewer.applicationId }, include: { batch: { select: { id: true, status: true, conflictScope: true } }, submissions: { select: { id: true, humanIdentityId: true, submittedAt: true, evidenceDigest: true } } } });
    if (!row) throw new NotFoundException("ASSIGNMENT_NOT_FOUND");
    const already = row.submissions[0];
    if (already) {
      if (already.humanIdentityId !== reviewer.id || row.status !== "SUBMITTED" || !/^[a-f0-9]{64}$/i.test(already.evidenceDigest)) throw new ConflictException("ASSIGNMENT_STATE_CHANGED");
      return { id: already.id, submittedAt: already.submittedAt, evidenceDigest: already.evidenceDigest, status: "ALREADY_RECORDED" };
    }
    await this.assertActionEligible(token, reviewer, row.eligibilitySnapshot, row.batch.conflictScope, row.batch.id);
    if (row.status !== "OPENED" || !["PREPARED", "SECOND_REVIEW_OPEN"].includes(row.batch.status) || (row.reviewerRole === "INDEPENDENT" && row.batch.status !== "SECOND_REVIEW_OPEN")) throw new ConflictException("ASSIGNMENT_STATE_CHANGED");
    const submittedAt = new Date();
    const evidenceDigest = digest({ assignmentId: row.id, humanIdentityId: reviewer.id, reviewerSessionId: reviewer.sessionId, decision: input.decision, notes: input.notes?.trim() || null, submittedAt: submittedAt.toISOString() });
    try {
    const result = await this.db.$transaction(async (tx) => {
      const claimed = await tx.oicDomainReviewAssignment.updateMany({ where: { id: row.id, humanIdentityId: reviewer.id, applicationId: reviewer.applicationId, status: "OPENED" }, data: { status: "SUBMITTED" } });
      if (claimed.count !== 1) throw new ConflictException("ASSIGNMENT_STATE_CHANGED");
      const submission = await tx.oicDomainReviewSubmission.create({ data: { assignmentId: row.id, humanIdentityId: reviewer.id, reviewerSessionId: reviewer.sessionId, decision: input.decision, notes: input.notes?.trim() || null, evidenceDigest, submittedAt } });
      await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, applicationId: reviewer.applicationId, action: "evaluation.domain_review.submitted", targetType: "domain-review-submission", targetId: submission.id, requestId: request.requestId, traceId: request.traceId, metadata: { assignmentId: row.id, reviewerRole: row.reviewerRole, decision: input.decision, evidenceDigest } } });
      if (row.reviewerRole === "PRIMARY") {
        const remaining = await tx.oicDomainReviewAssignment.count({ where: { batchId: row.batch.id, reviewerRole: "PRIMARY", status: { not: "SUBMITTED" } } });
        if (remaining === 0) {
          await tx.oicDomainReviewBatch.update({ where: { id: row.batch.id }, data: { status: "SECOND_REVIEW_OPEN" } });
          await tx.oicDomainReviewAssignment.updateMany({ where: { batchId: row.batch.id, reviewerRole: "INDEPENDENT", status: "HELD" }, data: { status: "ASSIGNED" } });
          await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, applicationId: reviewer.applicationId, action: "evaluation.domain_review.independent_released", targetType: "domain-review-batch", targetId: row.batch.id, metadata: { primarySubmissionCount: await tx.oicDomainReviewSubmission.count({ where: { assignment: { batchId: row.batch.id, reviewerRole: "PRIMARY" } } }) } } });
        }
      } else {
        const remainingPrimary = await tx.oicDomainReviewAssignment.count({ where: { batchId: row.batch.id, reviewerRole: "PRIMARY", status: { not: "SUBMITTED" } } });
        const remainingIndependent = await tx.oicDomainReviewAssignment.count({ where: { batchId: row.batch.id, reviewerRole: "INDEPENDENT", status: { not: "SUBMITTED" } } });
        if (remainingPrimary === 0 && remainingIndependent === 0) {
          await tx.oicDomainReviewBatch.update({ where: { id: row.batch.id }, data: { status: "COMPLETED" } });
          await tx.oicAuditEvent.create({ data: { actorType: "HUMAN_IDENTITY", actorHumanIdentityId: reviewer.id, applicationId: reviewer.applicationId, action: "evaluation.domain_review.batch_completed", targetType: "domain-review-batch", targetId: row.batch.id, requestId: request.requestId, traceId: request.traceId, metadata: { primarySubmissionCount: await tx.oicDomainReviewSubmission.count({ where: { assignment: { batchId: row.batch.id, reviewerRole: "PRIMARY" } } }), independentSubmissionCount: await tx.oicDomainReviewSubmission.count({ where: { assignment: { batchId: row.batch.id, reviewerRole: "INDEPENDENT" } } }) } } });
        }
      }
      return submission;
    });
    return { id: result.id, submittedAt: result.submittedAt, evidenceDigest: result.evidenceDigest, status: "SUBMITTED" };
    } catch (error) {
      const prismaCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
      const errorResponse = error instanceof ConflictException ? error.getResponse() : undefined;
      const stateChanged = errorResponse === "ASSIGNMENT_STATE_CHANGED" || (errorResponse !== null && typeof errorResponse === "object" && "message" in errorResponse && (errorResponse as { message?: unknown }).message === "ASSIGNMENT_STATE_CHANGED");
      if (prismaCode === "P2002" || stateChanged) {
        const committed = await this.db.oicDomainReviewSubmission.findUnique({ where: { assignmentId: row.id }, select: { id: true, humanIdentityId: true, submittedAt: true, evidenceDigest: true } });
        if (committed?.humanIdentityId === reviewer.id && /^[a-f0-9]{64}$/i.test(committed.evidenceDigest)) return { id: committed.id, submittedAt: committed.submittedAt, evidenceDigest: committed.evidenceDigest, status: "ALREADY_RECORDED" };
      }
      const exceptionClass = error instanceof Error ? error.constructor.name : "UnknownError";
      process.stderr.write(`${JSON.stringify({ event: "reviewer.domain_review.submission_transaction_failed", requestId: request.requestId, stage: "submission_transaction", exceptionClass, databaseCode: typeof prismaCode === "string" ? prismaCode : undefined })}\n`);
      throw error;
    }
  }

  async assertActionEligible(token: string, reviewer: { id: string; applicationId: string }, eligibilitySnapshot: unknown, conflictScope: { id: string; status: string } | null, batchId: string) {
    if (!conflictScope) throw new ConflictException("DOMAIN_REVIEW_CONFLICT_STATE_UNKNOWN");
    const conflict = await this.getConflictState(token);
    if (conflict.state !== "CLEARED") throw new ConflictException(conflict.state === "CONFLICTED" ? "DOMAIN_REVIEW_CONFLICTED" : "DOMAIN_REVIEW_CONFLICT_ATTESTATION_REQUIRED");
    const snapshot = record(eligibilitySnapshot);
    if (typeof snapshot.qualificationId !== "string" || typeof snapshot.qualificationDigest !== "string") throw new ConflictException("ARABIC_REVIEW_QUALIFICATION_UNKNOWN");
    const qualification = await this.db.oicReviewerQualificationAttestation.findFirst({ where: { id: snapshot.qualificationId, applicationId: reviewer.applicationId, humanIdentityId: reviewer.id, qualificationKey, language: "ar", proficiency: "NATIVE", isPrimaryLanguage: true }, select: { id: true, attestationDigest: true } });
    if (!qualification || qualification.attestationDigest !== snapshot.qualificationDigest || conflict.scope === null || conflict.scope.status !== "PUBLISHED" || conflict.scope.id !== conflictScope.id) throw new ConflictException("DOMAIN_REVIEW_ELIGIBILITY_CHANGED");
    const participant = await this.db.oicDomainReviewAssignment.count({ where: { batchId, applicationId: reviewer.applicationId, humanIdentityId: reviewer.id } });
    if (participant < 1) throw new ForbiddenException();
  }

  async getBatch(actor: AuthenticatedPrincipal, id: string) {
    assertManage(actor);
    const batch = await this.db.oicDomainReviewBatch.findFirst({ where: { id, applicationId: actor.applicationId }, include: { assignments: { orderBy: [{ blindedItemId: "asc" }, { reviewerRole: "asc" }], include: { submissions: { select: { id: true, decision: true, evidenceDigest: true, submittedAt: true } } } } } });
    if (!batch) throw new NotFoundException();
    const byItem = new Map<string, typeof batch.assignments>();
    for (const assignment of batch.assignments) byItem.set(assignment.blindedItemId, [...(byItem.get(assignment.blindedItemId) ?? []), assignment]);
    const outcomes = [...byItem.entries()].map(([blindedItemId, assignments]) => {
      const submissions = assignments.flatMap((assignment) => assignment.submissions.map((submission) => ({ ...submission, reviewerId: assignment.humanIdentityId })));
      const complete = submissions.length === 2 && new Set(submissions.map((submission) => submission.reviewerId)).size === 2;
      return { blindedItemId, outcome: !complete ? "INCOMPLETE" : submissions[0]!.decision === submissions[1]!.decision ? "AGREEMENT" : "DISAGREEMENT", submissionCount: submissions.length };
    });
    return { id: batch.id, packId: batch.packId, manifestDigest: batch.manifestDigest, status: batch.status, itemCount: outcomes.length, submittedCount: batch.assignments.filter((assignment) => assignment.status === "SUBMITTED").length, outcomes, reconciliationDigest: batch.reconciliationDigest, reconciledAt: batch.reconciledAt };
  }

  async reconcileBatch(actor: AuthenticatedPrincipal, id: string) {
    assertManage(actor);
    const batch = await this.db.oicDomainReviewBatch.findFirst({ where: { id, applicationId: actor.applicationId }, include: { assignments: { include: { submissions: { select: { id: true, decision: true, evidenceDigest: true, submittedAt: true } } } } } });
    if (!batch) throw new NotFoundException();
    const byCase = new Map<string, typeof batch.assignments>();
    for (const assignment of batch.assignments) byCase.set(assignment.caseRevisionId, [...(byCase.get(assignment.caseRevisionId) ?? []), assignment]);
    if (byCase.size === 0 || [...byCase.values()].some((rows) => rows.length !== 2 || rows.some((row) => row.submissions.length !== 1) || new Set(rows.map((row) => row.humanIdentityId)).size !== 2)) throw new ConflictException("BOTH_REAL_REVIEWER_SUBMISSIONS_REQUIRED");
    const evidence = [...byCase.entries()].map(([caseRevisionId, rows]) => {
      const sources = rows.map((row) => ({ assignmentId: row.id, reviewerId: row.humanIdentityId, submissionId: row.submissions[0]!.id, submissionDigest: row.submissions[0]!.evidenceDigest, decision: row.submissions[0]!.decision })).sort((a, b) => a.reviewerId.localeCompare(b.reviewerId));
      return { caseRevisionId, outcome: sources[0]!.decision === sources[1]!.decision ? "AGREEMENT" : "DISAGREEMENT", sources };
    }).sort((a, b) => a.caseRevisionId.localeCompare(b.caseRevisionId));
    const reconciliationDigest = digest({ batchId: batch.id, manifestDigest: batch.manifestDigest, source: "TWO_IMMUTABLE_HUMAN_DOMAIN_REVIEW_SUBMISSIONS_V1", evidence });
    if (batch.reconciliationDigest && batch.reconciliationDigest !== reconciliationDigest) throw new ConflictException("DOMAIN_REVIEW_RECONCILIATION_IMMUTABILITY_CONFLICT");
    const counts = { agreementCount: evidence.filter((item) => item.outcome === "AGREEMENT").length, disagreementCount: evidence.filter((item) => item.outcome === "DISAGREEMENT").length };
    const status = evidence.every((item) => item.outcome === "AGREEMENT" && item.sources.every((source) => source.decision === "APPROVE")) ? "RECONCILED_PASS" : "RECONCILED_REVIEW_REQUIRED";
    if (!batch.reconciliationDigest) await this.db.$transaction(async (tx) => {
      await tx.oicDomainReviewBatch.update({ where: { id: batch.id }, data: { status, reconciliationDigest, reconciliationEvidence: { source: "TWO_IMMUTABLE_HUMAN_DOMAIN_REVIEW_SUBMISSIONS_V1", evidence, ...counts }, reconciledAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, actorType: "SERVICE_PRINCIPAL", applicationId: actor.applicationId, action: "evaluation.domain_review.interrater_reconciled", targetType: "domain-review-batch", targetId: batch.id, metadata: { reconciliationDigest, source: "TWO_IMMUTABLE_HUMAN_DOMAIN_REVIEW_SUBMISSIONS_V1", ...counts, itemCount: evidence.length, status } } });
    });
    return { id: batch.id, status, ...counts, itemCount: evidence.length, reconciliationDigest };
  }

  private batchSummary(batch: { id: string; packId: string; manifestDigest: string; status: string; assignments: Array<{ id: string; reviewerRole: string; status: string }> }) {
    return { id: batch.id, packId: batch.packId, manifestDigest: batch.manifestDigest, status: batch.status, assignmentCount: batch.assignments.length, primaryAssignmentCount: batch.assignments.filter((item) => item.reviewerRole === "PRIMARY").length, independentHeldCount: batch.assignments.filter((item) => item.reviewerRole === "INDEPENDENT" && item.status === "HELD").length };
  }
}
