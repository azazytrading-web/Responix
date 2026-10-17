import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { EvaluationService } from "./evaluation.service";
import { EvaluationWorker } from "./evaluation-worker";

type EvaluationRequest = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const traceId = (request: EvaluationRequest) => {
  const value = request.headers["x-trace-id"];
  return Array.isArray(value) ? value[0] : value;
};

const uuid = z.string().uuid();
function body(value: unknown): Record<string, unknown> {
  const parsed = z.record(z.unknown()).safeParse(value);
  if (!parsed.success) throw new BadRequestException("Invalid request body");
  return parsed.data;
}

@ApiTags("OIC Evaluation")
@ApiBearerAuth()
@Controller("admin/evaluations")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class EvaluationController {
  constructor(private readonly evaluations: EvaluationService, private readonly worker: EvaluationWorker) {}

  @Version("1") @Get("overview") overview(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.overview(actor, applicationId, tenantId); }
  @Version("1") @Get("packs") packs(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listPacks(actor, applicationId, tenantId); }
  @Version("1") @Get("packs/:id") pack(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid pack ID"); return this.evaluations.pack(actor, id); }
  @Version("1") @Get("releases") releases(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listReleases(actor, applicationId, tenantId); }
  @Version("1") @Get("metrics") metrics(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listMetrics(actor, applicationId, tenantId); }
  @Version("1") @Get("judges") judges(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listJudges(actor, applicationId, tenantId); }
  @Version("1") @Get("runs") runs(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listRuns(actor, applicationId, tenantId); }
  @Version("1") @Get("reports") reports(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listReports(actor, applicationId, tenantId); }
  @Version("1") @Get("reports/:id") report(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid report ID"); return this.evaluations.report(actor, id); }
  @Version("1") @Get("comparisons") comparisons(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listComparisons(actor, applicationId, tenantId); }
  @Version("1") @Get("basis-drafts/:id") basisDraft(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid basis draft ID"); return this.evaluations.basisDraft(actor, id); }
  @Version("1") @Get("work") work(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listWork(actor, applicationId, tenantId); }
  @Version("1") @Get("outbox") outbox(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listOutbox(actor, applicationId, tenantId); }
  @Version("1") @Get("campaigns") campaigns(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) { return this.evaluations.listCampaigns(actor, applicationId, tenantId); }
  @Version("1") @Get("runs/:id") run(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid run ID"); return this.evaluations.run(actor, id); }
  @Version("1") @Post("packet76/accounting/reconcile") reconcilePacket76RunBudgetAggregate(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.evaluations.reconcilePacket76RunBudgetAggregate(actor); }
  @Version("1") @Post("packet76/successor/accounting/reconcile") reconcilePacket76SuccessorCandidateAccounting(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.evaluations.reconcilePacket76SuccessorCandidateAccounting(actor); }
  @Version("1") @Get("health") health(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.evaluations.health(actor); }
  @Version("1") @Post("work-items/:id/preflight-diagnostic") packet76PreflightDiagnostic(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid work item ID"); return this.worker.runPacket76PreflightDiagnostic(actor, id); }
  @Version("1") @Post("target-preflight") preflightTarget(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown, @Req() request: EvaluationRequest) { return this.evaluations.preflightTarget(actor, body(input), request.requestId ?? "evaluation-target-preflight", traceId(request)); }
  @Version("1") @Post("packs") createPack(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createPack(actor, body(input)); }
  @Version("1") @Post("imports") importPack(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.importPack(actor, body(input)); }
  @Version("1") @Post("metrics") createMetric(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createMetric(actor, body(input)); }
  @Version("1") @Post("basis-drafts") createBasisDraft(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createBasisDraft(actor, body(input)); }
  @Version("1") @Post("basis-drafts/:id/publish") publishBasisDraft(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid basis draft ID"); return this.evaluations.publishBasisDraft(actor, id); }
  @Version("1") @Post("judges") createJudge(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createJudge(actor, body(input)); }
  @Version("1") @Post("packs/:id/validate") validatePack(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid pack ID"); return this.evaluations.validatePack(actor, id); }
  @Version("1") @Post("releases") publishRelease(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.publishRelease(actor, body(input)); }
  @Version("1") @Post("releases/:id/contamination-review") reviewReleaseContamination(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid release ID"); return this.evaluations.reviewReleaseContamination(actor, id); }
  @Version("1") @Post("releases/:id/retire") retireRelease(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() input: unknown) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid release ID"); return this.evaluations.retireRelease(actor, id, body(input)); }
  @Version("1") @Post("releases/:id/compromise") compromiseRelease(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() input: unknown) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid release ID"); return this.evaluations.compromiseRelease(actor, id, body(input)); }
  @Version("1") @Post("campaigns") createCampaign(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createCampaign(actor, body(input)); }
  @Version("1") @Post("runs/:id/capacity-extension") provisionPacket76CapacityExtension(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid run ID"); return this.evaluations.provisionPacket76CapacityExtension(actor, id); }
  @Version("1") @Post("candidates") createCandidate(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createCandidate(actor, body(input)); }
  @Version("1") @Get("candidates") candidates(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.evaluations.listCandidates(actor); }
  @Version("1") @Post("reports/:id/dna") projectDna(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid report ID"); return this.evaluations.projectDna(actor, id); }
  @Version("1") @Post("comparisons/:id/verdict") verdict(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid comparison ID"); return this.evaluations.recordComparisonVerdict(actor, id); }
  @Version("1") @Post("protocols") createManifest(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.createManifest(actor, body(input)); }
  @Version("1") @Post("runs") startRun(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.startRun(actor, body(input)); }
  @Version("1") @Post("runs/:id/analyze") analyzeRun(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid run ID"); return this.evaluations.analyzeRun(actor, id); }
  @Version("1") @Post("regrade") regrade(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.regradeRun(actor, body(input)); }
  @Version("1") @Post("budget-rebaseline") rebaselineBudgetBasis(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.rebaselinePacket76BudgetBasis(actor, body(input)); }
  @Version("1") @Post("comparisons") compareReports(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() input: unknown) { return this.evaluations.compareReports(actor, body(input)); }
  @Version("1") @Post("runs/:id/cancel") cancelRun(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() input: unknown) { const parsed = uuid.safeParse(id); if (!parsed.success) throw new BadRequestException("Invalid run ID"); return this.evaluations.cancelRun(actor, id, body(input)); }
  @Version("1") @Post("runs/:id/cases/:caseExecutionId/retry") retryCase(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Param("caseExecutionId") caseExecutionId: string, @Body() input: unknown) { if (!uuid.safeParse(id).success || !uuid.safeParse(caseExecutionId).success) throw new BadRequestException("Invalid evaluation identity"); return this.evaluations.retryCase(actor, id, caseExecutionId, body(input)); }
  @Version("1") @Post("runs/:id/cases/:caseExecutionId/contingency") replacePacket76Observation(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Param("caseExecutionId") caseExecutionId: string, @Body() input: unknown) { if (!uuid.safeParse(id).success || !uuid.safeParse(caseExecutionId).success) throw new BadRequestException("Invalid evaluation identity"); return this.evaluations.replacePacket76Observation(actor, id, caseExecutionId, body(input)); }
  @Version("1") @Post("runs/:id/cases/:caseExecutionId/contingency-infrastructure-recovery") retryPacket76ContingencyInfrastructure(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Param("caseExecutionId") caseExecutionId: string, @Body() input: unknown) { if (!uuid.safeParse(id).success || !uuid.safeParse(caseExecutionId).success) throw new BadRequestException("Invalid evaluation identity"); return this.evaluations.retryPacket76ContingencyInfrastructure(actor, id, caseExecutionId, body(input)); }
  @Version("1") @Post("runs/:id/cases/:caseExecutionId/recovery-generations/resume-pre-dispatch") resumePacket76RecoveryAfterPreDispatchFix(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Param("caseExecutionId") caseExecutionId: string, @Body() input: unknown) { if (!uuid.safeParse(id).success || !uuid.safeParse(caseExecutionId).success) throw new BadRequestException("Invalid evaluation identity"); return this.evaluations.resumePacket76RecoveryAfterPreDispatchFix(actor, id, caseExecutionId, body(input)); }
  @Version("1") @Post("runs/:id/cases/:caseExecutionId/resume-successor-pre-dispatch") resumePacket76SuccessorAfterPreDispatchFix(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Param("caseExecutionId") caseExecutionId: string, @Body() input: unknown) { if (!uuid.safeParse(id).success || !uuid.safeParse(caseExecutionId).success) throw new BadRequestException("Invalid evaluation identity"); return this.evaluations.resumePacket76SuccessorAfterPreDispatchFix(actor, id, caseExecutionId, body(input)); }
  @Version("1") @Post("outbox/:id/retry") retryOutbox(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id") id: string, @Body() input: unknown) { if (!uuid.safeParse(id).success) throw new BadRequestException("Invalid outbox event ID"); return this.evaluations.retryOutbox(actor, id, body(input)); }
}
