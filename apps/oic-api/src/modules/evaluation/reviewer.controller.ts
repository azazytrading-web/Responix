import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard, RequireScopes } from "../identity/auth.guard";
import { ReviewerService } from "./reviewer.service";
import { DomainReviewService } from "./domain-review.service";

type RequestContext = { requestId?: string; ip?: string; headers: Record<string, string | string[] | undefined> };
const uuid = z.string().uuid();
const record = (value: unknown): Record<string, unknown> => {
  const result = z.record(z.unknown()).safeParse(value);
  if (!result.success) throw new BadRequestException("Invalid request body");
  return result.data;
};
const context = (request: RequestContext) => ({ requestId: request.requestId, traceId: Array.isArray(request.headers["x-trace-id"]) ? request.headers["x-trace-id"][0] : request.headers["x-trace-id"] });
@ApiTags("OIC Evaluation Human Review")
@Controller("reviewer")
export class ReviewerController {
  constructor(private readonly reviewers: ReviewerService, private readonly domainReviews: DomainReviewService) {}

  @Version("1") @Post("auth/login") login(@Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (typeof body.loginHandle !== "string" || typeof body.password !== "string" || !uuid.safeParse(body.applicationId).success) throw new BadRequestException("Invalid sign-in request");
    return this.reviewers.login(body.loginHandle, body.password, body.applicationId as string, request.ip ?? "unknown", context(request));
  }

  @Version("1") @Get("auth/me") async me(@Headers("x-oic-reviewer-session") token: string) {
    const read = await this.reviewers.resolveSession(token, "oic:evaluation:review:read");
    return { human: { id: read.id, displayLabel: read.displayLabel }, applicationId: read.applicationId, tenantId: read.tenantId, sessionId: read.sessionId };
  }

  @Version("1") @Delete("auth/session") logout(@Headers("x-oic-reviewer-session") token: string, @Req() request: RequestContext) {
    return this.reviewers.logout(token, context(request));
  }

  @Version("1") @Get("assignments") assignments(@Headers("x-oic-reviewer-session") token: string) { return this.reviewers.listAssignments(token); }
  @Version("1") @Get("domain-content-assignments") domainContentAssignments(@Headers("x-oic-reviewer-session") token: string) { return this.domainReviews.listAssignments(token); }
  @Version("1") @Get("domain-review/conflict") domainReviewConflict(@Headers("x-oic-reviewer-session") token: string) { return this.domainReviews.getConflictState(token); }
  @Version("1") @Post("domain-review/conflict") domainReviewConflictAttestation(@Headers("x-oic-reviewer-session") token: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!body.declarations || typeof body.declarations !== "object" || Array.isArray(body.declarations)) throw new BadRequestException("Invalid domain review conflict declaration");
    return this.domainReviews.attestConflict(token, body.declarations as Record<string, unknown>, context(request));
  }
  @Version("1") @Get("domain-content-assignments/:id") openDomainContentAssignment(@Headers("x-oic-reviewer-session") token: string, @Param("id") id: string, @Req() request: RequestContext) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid domain content review assignment ID");
    return this.domainReviews.openAssignment(token, id, context(request));
  }
  @Version("1") @Post("domain-content-assignments/:id/submission") submitDomainContentAssignment(@Headers("x-oic-reviewer-session") token: string, @Param("id") id: string, @Body() raw: unknown, @Req() request: RequestContext) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid domain content review assignment ID");
    const body = record(raw);
    return this.domainReviews.submit(token, id, { decision: typeof body.decision === "string" ? body.decision : "", notes: typeof body.notes === "string" ? body.notes : undefined }, context(request));
  }
  @Version("1") @Get("assignments/:id") openAssignment(@Headers("x-oic-reviewer-session") token: string, @Param("id") id: string) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid assignment ID");
    return this.reviewers.openAssignment(token, id);
  }
  @Version("1") @Post("assignments/:id/submission") submit(@Headers("x-oic-reviewer-session") token: string, @Param("id") id: string, @Body() raw: unknown, @Req() request: RequestContext) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid assignment ID");
    const body = record(raw);
    return this.reviewers.submit(token, id, { value: body.value, abstained: body.abstained === true, rationale: typeof body.rationale === "string" ? body.rationale : undefined }, context(request));
  }
  @Version("1") @Post("calibrations") calibrate(@Headers("x-oic-reviewer-session") token: string, @Body() raw: unknown) {
    const body = record(raw);
    if (!uuid.safeParse(body.policyId).success) throw new BadRequestException("Invalid calibration policy ID");
    return this.reviewers.calibrate(token, { policyId: body.policyId as string, answers: body.answers, abstentions: body.abstentions });
  }
  @Version("1") @Get("calibrations") calibrationPolicies(@Headers("x-oic-reviewer-session") token: string) { return this.reviewers.listCalibrationPolicies(token); }
  @Version("1") @Get("conflict-scopes") conflictScopes(@Headers("x-oic-reviewer-session") token: string) { return this.reviewers.listConflictScopes(token); }
  @Version("1") @Post("conflict-attestations") conflictAttestation(@Headers("x-oic-reviewer-session") token: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(body.policyId).success || !uuid.safeParse(body.protocolRevisionId).success || !body.declarations || typeof body.declarations !== "object" || Array.isArray(body.declarations)) throw new BadRequestException("Invalid conflict declaration");
    return this.reviewers.attestConflict(token, { policyId: body.policyId as string, protocolRevisionId: body.protocolRevisionId as string, declarations: body.declarations as Record<string, unknown> }, context(request));
  }
  @Version("1") @Post("adjudications") adjudicate(@Headers("x-oic-reviewer-session") token: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!Array.isArray(body.submissionIds) || body.submissionIds.some((id) => typeof id !== "string") || !body.submissionIds.every((id) => uuid.safeParse(id).success)) throw new BadRequestException("Invalid adjudication sources");
    return this.reviewers.adjudicate(token, { submissionIds: body.submissionIds as string[], decision: body.decision, rationale: typeof body.rationale === "string" ? body.rationale : undefined }, context(request));
  }

  @Version("1") @Post("admin/identities") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  createIdentity(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(body.applicationId).success || typeof body.displayLabel !== "string" || typeof body.loginHandle !== "string" || typeof body.password !== "string" || !Array.isArray(body.capabilities) || body.capabilities.some((item) => typeof item !== "string") || (body.tenantId !== undefined && body.tenantId !== null && !uuid.safeParse(body.tenantId).success)) throw new BadRequestException("Invalid reviewer setup");
    return this.reviewers.createIdentity(actor, { applicationId: body.applicationId as string, displayLabel: body.displayLabel, loginHandle: body.loginHandle, password: body.password, capabilities: body.capabilities as string[], tenantId: body.tenantId as string | null | undefined }, context(request));
  }

  @Version("1") @Get("admin/identities") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  listIdentities(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId: string) {
    if (!uuid.safeParse(applicationId).success) throw new BadRequestException("Invalid reviewer application");
    return this.reviewers.listIdentities(actor, applicationId);
  }

  @Version("1") @Get("admin/calibrations") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  calibrationReadback(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId: string) {
    if (!uuid.safeParse(applicationId).success) throw new BadRequestException("Invalid reviewer application");
    return this.reviewers.listCalibrationReadback(actor, applicationId);
  }

  @Version("1") @Get("admin/conflicts") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  conflictReadback(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId: string) {
    if (!uuid.safeParse(applicationId).success) throw new BadRequestException("Invalid reviewer application");
    return this.reviewers.listConflictReadback(actor, applicationId);
  }

  @Version("1") @Post("admin/authorizations") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  setAuthorization(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(body.applicationId).success || !uuid.safeParse(body.humanIdentityId).success || typeof body.capability !== "string" || typeof body.revoke !== "boolean") throw new BadRequestException("Invalid reviewer authorization");
    return this.reviewers.setAuthorization(actor, { applicationId: body.applicationId as string, humanIdentityId: body.humanIdentityId as string, tenantId: body.tenantId as string | null | undefined, capability: body.capability, revoke: body.revoke }, context(request));
  }

  @Version("1") @Post("admin/identities/:id/disable") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  disableIdentity(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Query("applicationId") applicationId: string, @Req() request: RequestContext) {
    if (!uuid.safeParse(id).success || !uuid.safeParse(applicationId).success) throw new BadRequestException("Invalid reviewer identity");
    return this.reviewers.disableIdentity(actor, applicationId, id, context(request));
  }

  @Version("1") @Post("admin/identities/:id/reset-credential") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  resetCredential(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(id).success || !uuid.safeParse(body.applicationId).success || typeof body.password !== "string") throw new BadRequestException("Invalid credential reset");
    return this.reviewers.resetCredential(actor, body.applicationId as string, id, body.password, context(request));
  }

  @Version("1") @Post("admin/identities/:id/revoke-credential") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:principals:manage")
  revokeCredential(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(id).success || !uuid.safeParse(body.applicationId).success) throw new BadRequestException("Invalid credential revocation");
    return this.reviewers.revokeCredential(actor, body.applicationId as string, id, context(request));
  }

  @Version("1") @Post("admin/calibration-policies") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  createCalibrationPolicy(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(body.applicationId).success || !uuid.safeParse(body.judgeRevisionId).success) throw new BadRequestException("Invalid calibration policy");
    return this.reviewers.createCalibrationPolicy(actor, { applicationId: body.applicationId as string, tenantId: body.tenantId as string | null | undefined, judgeRevisionId: body.judgeRevisionId as string, revision: Number(body.revision), calibrationSetDigest: String(body.calibrationSetDigest), referenceAnswers: body.referenceAnswers, minimumAgreement: Number(body.minimumAgreement), expiresAfterDays: Number(body.expiresAfterDays) }, context(request));
  }

  @Version("1") @Post("admin/assignments") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  createAssignment(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    const ids = ["humanIdentityId", "applicationId", "caseExecutionId", "protocolRevisionId", "judgeRevisionId", "metricRevisionId"];
    if (ids.some((key) => !uuid.safeParse(body[key]).success) || typeof body.blindedItemId !== "string") throw new BadRequestException("Invalid review assignment");
    return this.reviewers.createAssignment(actor, { humanIdentityId: body.humanIdentityId as string, applicationId: body.applicationId as string, tenantId: body.tenantId as string | null | undefined, caseExecutionId: body.caseExecutionId as string, protocolRevisionId: body.protocolRevisionId as string, judgeRevisionId: body.judgeRevisionId as string, metricRevisionId: body.metricRevisionId as string, blindedItemId: body.blindedItemId, blindProjection: body.blindProjection, blindMapping: body.blindMapping, deadlineAt: typeof body.deadlineAt === "string" ? body.deadlineAt : undefined }, context(request));
  }

  @Version("1") @Post("admin/local-fixture") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  createLocalFixture(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(body.applicationId).success || !uuid.safeParse(body.judgeRevisionId).success) throw new BadRequestException("Invalid local review fixture request");
    const batchKey = body.batchKey;
    if (batchKey !== undefined && batchKey !== "oic7-human-review-local-demo" && batchKey !== "oic7-human-review-local-demo-b2") throw new BadRequestException("Invalid local review fixture batch");
    return this.reviewers.createLocalFixtureProtocol(actor, { applicationId: body.applicationId as string, tenantId: body.tenantId as string | null | undefined, judgeRevisionId: body.judgeRevisionId as string, batchKey }, context(request));
  }

  @Version("1") @Post("admin/local-fixture/:id/publish") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  publishLocalFixture(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Req() request: RequestContext) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid local review protocol ID");
    return this.reviewers.publishLocalFixtureProtocol(actor, id, context(request));
  }

  @Version("1") @Post("admin/local-fixture/:id/assignments") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  createLocalFixtureAssignments(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(id).success || !Array.isArray(body.reviewerIds) || body.reviewerIds.length < 1 || body.reviewerIds.length > 2 || body.reviewerIds.some((reviewerId) => !uuid.safeParse(reviewerId).success)) throw new BadRequestException("Invalid local reviewer assignment request");
    return this.reviewers.createLocalFixtureAssignments(actor, { protocolRevisionId: id, reviewerIds: body.reviewerIds as string[] }, context(request));
  }

  @Version("1") @Post("admin/local-fixture/:id/inter-rater") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  localFixtureInterRater(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Req() request: RequestContext) {
    if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid local review protocol ID");
    return this.reviewers.computeLocalFixtureInterRater(actor, id, context(request));
  }

  @Version("1") @Post("admin/assignments/:id/reassign") @UseGuards(OicAuthenticationGuard, OicScopeGuard) @RequireScopes("oic:evaluation:manage")
  reassignAssignment(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") assignmentId: string, @Body() raw: unknown, @Req() request: RequestContext) {
    const body = record(raw);
    if (!uuid.safeParse(assignmentId).success || !uuid.safeParse(body.applicationId).success || !uuid.safeParse(body.humanIdentityId).success) throw new BadRequestException("Invalid reviewer reassignment");
    return this.reviewers.reassignAssignment(actor, { assignmentId, applicationId: body.applicationId as string, humanIdentityId: body.humanIdentityId as string }, context(request));
  }
}
