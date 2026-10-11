import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createHash } from "node:crypto";
import { Prisma, OicDatabaseService } from "@oic/database";
import { z } from "zod";
import { AuthenticatedPrincipal, CurrentPrincipal, OicAuthenticationGuard, OicScopeGuard } from "../identity/auth.guard";
import { hasOicConsoleManage, hasOicConsoleRead } from "../identity/foundation-policy";
import { AdmissionService } from "./admission.service";

type RequestWithIds = { requestId?: string; headers: Record<string, string | string[] | undefined> };
const decimal = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/).max(60);
const range = { effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().optional() };
const planSchema = z.object({ applicationId: z.string().uuid(), planKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/), displayName: z.string().trim().min(1).max(160), entitlements: z.record(z.string(), z.unknown()), maxOutputUnits: z.number().int().min(1).max(65536).optional(), maxConcurrency: z.number().int().min(1).max(100000).optional(), ...range }).strict();
const planRevisionSchema = z.object({ entitlements: z.record(z.string(), z.unknown()), maxOutputUnits: z.number().int().min(1).max(65536).optional(), maxConcurrency: z.number().int().min(1).max(100000).optional(), ...range }).strict();
const assignmentSchema = z.object({ applicationId: z.string().uuid(), tenantId: z.string().uuid().nullable().optional(), subjectKey: z.string().min(1).max(128), planRevisionId: z.string().uuid(), priority: z.number().int().min(0).max(1000).default(0), ...range }).strict();
const quotaSchema = z.object({ applicationId: z.string().uuid().nullable().optional(), tenantId: z.string().uuid().nullable().optional(), planRevisionId: z.string().uuid().optional(), quotaKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/), subject: z.enum(["APPLICATION", "TENANT", "PRINCIPAL", "MODEL", "TIER", "CAPABILITY"]), dimension: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{1,63}$/), unit: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), window: z.enum(["LIFETIME", "UTC_DAY", "UTC_MONTH", "ROLLING", "CONTRACT_PERIOD"]), windowSeconds: z.number().int().positive().optional(), enforcement: z.enum(["HARD", "SOFT"]), limitValue: decimal, reservationUpperBound: decimal.optional(), safetyMargin: decimal.default("0"), unknownLiabilityRule: z.enum(["DENY", "HOLD_MAXIMUM"]).default("DENY"), ...range }).strict();
const budgetSchema = z.object({ applicationId: z.string().uuid().nullable().optional(), tenantId: z.string().uuid().nullable().optional(), planRevisionId: z.string().uuid().optional(), budgetKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/), unit: z.enum(["OIU", "CURRENCY"]), currency: z.string().regex(/^[A-Z]{3}$/).optional(), enforcement: z.enum(["HARD", "SOFT"]), amount: decimal, reservationUpperBound: decimal.optional(), safetyMargin: decimal.default("0"), purpose: z.string().trim().min(1).max(128), deadline: z.coerce.date().optional(), unknownLiabilityRule: z.enum(["DENY", "HOLD_MAXIMUM"]).default("DENY"), ...range }).strict();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

@ApiTags("OIC Admission and Plans")
@ApiBearerAuth()
@Controller("admin/admission")
@UseGuards(OicAuthenticationGuard, OicScopeGuard)
export class AdmissionController {
  constructor(private readonly db: OicDatabaseService, private readonly admissions: AdmissionService) {}
  private read(actor: AuthenticatedPrincipal) { if (!hasOicConsoleRead(actor.scopes) && !actor.scopes.includes("oic:admission:read")) throw new ForbiddenException(); }
  private manage(actor: AuthenticatedPrincipal) { if (!hasOicConsoleManage(actor.scopes) && !actor.scopes.includes("oic:admission:manage")) throw new ForbiddenException(); }
  private appScope(actor: AuthenticatedPrincipal, applicationId: string | null | undefined, tenantId?: string | null) {
    if (!applicationId || (!hasOicConsoleManage(actor.scopes) && applicationId !== actor.applicationId) ||
      (tenantId && !hasOicConsoleManage(actor.scopes) && !actor.tenantIds.includes(tenantId))) throw new ForbiddenException();
  }
  private async audit(actor: AuthenticatedPrincipal, request: RequestWithIds, action: string, targetType: string, targetId: string, applicationId: string | null, tenantId: string | null, metadata: Record<string, unknown>) {
    const traceId = request.headers["x-trace-id"];
    await this.db.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId, tenantId, action, targetType, targetId, requestId: request.requestId, traceId: Array.isArray(traceId) ? traceId[0] : traceId, metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonObject } });
  }

  @Version("1") @Get("plans") async plans(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string) {
    this.read(actor);
    if (applicationId && !hasOicConsoleRead(actor.scopes) && applicationId !== actor.applicationId) return [];
    return this.db.oicPlan.findMany({ where: hasOicConsoleRead(actor.scopes) ? (applicationId ? { applicationId } : {}) : { applicationId: actor.applicationId }, include: { revisions: { orderBy: { revision: "desc" }, take: 10 } }, orderBy: [{ applicationId: "asc" }, { planKey: "asc" }], take: 100 });
  }
  @Version("1") @Get("quotas") async quotas(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string) {
    this.read(actor);
    if (applicationId && !hasOicConsoleRead(actor.scopes) && applicationId !== actor.applicationId) return [];
    return this.db.oicQuotaPolicyRevision.findMany({ where: hasOicConsoleRead(actor.scopes) ? (applicationId ? { applicationId } : {}) : { applicationId: actor.applicationId }, orderBy: [{ quotaKey: "asc" }, { revision: "desc" }], take: 100 });
  }
  @Version("1") @Get("budgets") async budgets(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string) {
    this.read(actor);
    if (applicationId && !hasOicConsoleRead(actor.scopes) && applicationId !== actor.applicationId) return [];
    return this.db.oicBudgetRevision.findMany({ where: hasOicConsoleRead(actor.scopes) ? (applicationId ? { applicationId } : {}) : { applicationId: actor.applicationId }, orderBy: [{ budgetKey: "asc" }, { revision: "desc" }], take: 100 });
  }
  @Version("1") @Get("assignments") async assignments(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("applicationId") applicationId?: string, @Query("tenantId") tenantId?: string) {
    this.read(actor);
    if (applicationId && !hasOicConsoleRead(actor.scopes) && applicationId !== actor.applicationId) return [];
    if (tenantId && !hasOicConsoleRead(actor.scopes) && !actor.tenantIds.includes(tenantId)) return [];
    return this.db.oicPlanAssignment.findMany({ where: {
      ...(hasOicConsoleRead(actor.scopes) ? (applicationId ? { applicationId } : {}) : { applicationId: actor.applicationId }),
      ...(tenantId ? { tenantId } : hasOicConsoleRead(actor.scopes) ? {} : { OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] })
    }, include: { planRevision: { include: { plan: { select: { planKey: true, displayName: true } } } }, tenant: { select: { key: true, displayName: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  }
  @Version("1") @Get("balances") async balances(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query("limit") rawLimit?: string, @Query("cursor") cursor?: string) {
    this.read(actor);
    const limit = rawLimit === undefined ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (cursor && !z.string().uuid().safeParse(cursor).success)) throw new BadRequestException("Invalid balance query");
    const rows = await this.db.oicQuotaBucket.findMany({ where: hasOicConsoleRead(actor.scopes) ? {} : { applicationId: actor.applicationId, OR: [{ tenantId: null }, { tenantId: { in: actor.tenantIds } }] }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: limit + 1, include: { quotaPolicy: true, budgetPolicy: true } });
    const items = rows.length > limit ? rows.slice(0, limit) : rows;
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  }
  @Version("1") @Post("reconcile-expired") async reconcileExpired(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown) {
    this.manage(actor);
    const parsed = z.object({ limit: z.number().int().min(1).max(100).default(100) }).strict().safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException("Invalid reconciliation limit");
    return this.admissions.reconcileExpired(parsed.data.limit);
  }

  @Version("1") @Post("plans") async createPlan(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    this.manage(actor); const input = planSchema.parse(body); this.appScope(actor, input.applicationId);
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new BadRequestException("Invalid plan interval");
    const row = await this.db.$transaction(async (tx) => {
      const plan = await tx.oicPlan.create({ data: { applicationId: input.applicationId, planKey: input.planKey, displayName: input.displayName } });
      const revision = await tx.oicPlanRevision.create({ data: { planId: plan.id, revision: 1, entitlements: input.entitlements as Prisma.InputJsonValue, maxOutputUnits: input.maxOutputUnits, maxConcurrency: input.maxConcurrency, sourceDigest: digest(input), effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: input.applicationId, action: "admission.plan.drafted", targetType: "plan-revision", targetId: revision.id, requestId: request.requestId, metadata: { planKey: input.planKey, revision: 1, sourceDigest: revision.sourceDigest } } });
      return { plan, revision };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return row;
  }
  @Version("1") @Post("plans/:planId/revisions") async createPlanRevision(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("planId", ParseUUIDPipe) planId: string, @Body() body: unknown, @Req() request: RequestWithIds) {
    this.manage(actor); const input = planRevisionSchema.parse(body);
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new BadRequestException("Invalid plan interval");
    const plan = await this.db.oicPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException("Plan not found"); this.appScope(actor, plan.applicationId);
    return this.db.$transaction(async (tx) => {
      const prior = await tx.oicPlanRevision.aggregate({ where: { planId }, _max: { revision: true } });
      const revision = await tx.oicPlanRevision.create({ data: { planId, revision: (prior._max.revision ?? 0) + 1, entitlements: input.entitlements as Prisma.InputJsonValue, maxOutputUnits: input.maxOutputUnits, maxConcurrency: input.maxConcurrency, sourceDigest: digest(input), effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: plan.applicationId, action: "admission.plan.revision.drafted", targetType: "plan-revision", targetId: revision.id, requestId: request.requestId, metadata: { planKey: plan.planKey, revision: revision.revision, sourceDigest: revision.sourceDigest } } });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  @Version("1") @Post("plans/revisions/:id/publish") async publishPlan(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    this.manage(actor);
    const row = await this.db.oicPlanRevision.findUnique({ where: { id }, include: { plan: true } });
    if (!row) throw new BadRequestException("Plan revision not found"); this.appScope(actor, row.plan.applicationId);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.oicPlanRevision.update({ where: { id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: row.plan.applicationId, action: "admission.plan.published", targetType: "plan-revision", targetId: id, requestId: request.requestId, metadata: { revision: row.revision, sourceDigest: row.sourceDigest } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  @Version("1") @Post("assignments") async assign(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    this.manage(actor); const input = assignmentSchema.parse(body); this.appScope(actor, input.applicationId, input.tenantId);
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new BadRequestException("Invalid assignment interval");
    const plan = await this.db.oicPlanRevision.findUnique({ where: { id: input.planRevisionId }, include: { plan: true } });
    if (!plan || plan.status !== "PUBLISHED" || plan.plan.applicationId !== input.applicationId) throw new BadRequestException("Assignment requires a published same-application plan revision");
    const row = await this.db.$transaction(async (tx) => {
      const existing = await tx.oicPlanAssignment.findMany({ where: { applicationId: input.applicationId, tenantId: input.tenantId ?? null, subjectKey: input.subjectKey, priority: input.priority, status: "ACTIVE" } });
      if (existing.some((item) => (!item.effectiveTo || input.effectiveFrom < item.effectiveTo) && (!input.effectiveTo || item.effectiveFrom < input.effectiveTo))) throw new BadRequestException("Plan assignment intervals overlap");
      const assignment = await tx.oicPlanAssignment.create({ data: input });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: input.applicationId, tenantId: input.tenantId, action: "admission.plan.assigned", targetType: "plan-assignment", targetId: assignment.id, requestId: request.requestId, metadata: { planRevisionId: input.planRevisionId, subjectKey: input.subjectKey } } });
      return assignment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return row;
  }

  @Version("1") @Post("quotas") async createQuota(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    this.manage(actor); const input = quotaSchema.parse(body); this.appScope(actor, input.applicationId, input.tenantId);
    if (input.tenantId && !input.applicationId) throw new BadRequestException("Tenant quota requires application scope");
    if (input.unit === "" || (input.window === "ROLLING" && !input.windowSeconds) || (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)) throw new BadRequestException("Invalid quota policy");
    const scoped = input.applicationId ?? "global"; const scopeKey = `${scoped}:${input.tenantId ?? "application"}`;
    const row = await this.db.$transaction(async (tx) => {
      const prior = await tx.oicQuotaPolicyRevision.aggregate({ where: { scopeKey, quotaKey: input.quotaKey }, _max: { revision: true } });
      const revision = await tx.oicQuotaPolicyRevision.create({ data: { ...input, scopeKey, revision: (prior._max.revision ?? 0) + 1, sourceDigest: digest(input) } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: input.applicationId, tenantId: input.tenantId, action: "admission.quota.drafted", targetType: "quota-policy", targetId: revision.id, requestId: request.requestId, metadata: { revision: revision.revision, sourceDigest: revision.sourceDigest } } });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return row;
  }
  @Version("1") @Post("quotas/revisions/:id/publish") async publishQuota(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    this.manage(actor); const row = await this.db.oicQuotaPolicyRevision.findUnique({ where: { id } });
    if (!row) throw new BadRequestException("Quota revision not found"); this.appScope(actor, row.applicationId);
    return this.db.$transaction(async (tx) => {
      const overlaps = await tx.oicQuotaPolicyRevision.findMany({ where: { scopeKey: row.scopeKey, quotaKey: row.quotaKey, status: "PUBLISHED", NOT: { id } } });
      if (overlaps.some((item) => (!item.effectiveTo || row.effectiveFrom < item.effectiveTo) && (!row.effectiveTo || item.effectiveFrom < row.effectiveTo))) throw new BadRequestException("Published quota intervals overlap");
      const updated = await tx.oicQuotaPolicyRevision.update({ where: { id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: "admission.quota.published", targetType: "quota-policy", targetId: id, requestId: request.requestId, metadata: { revision: row.revision, sourceDigest: row.sourceDigest } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  @Version("1") @Post("budgets") async createBudget(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: unknown, @Req() request: RequestWithIds) {
    this.manage(actor); const input = budgetSchema.parse(body); this.appScope(actor, input.applicationId, input.tenantId);
    if ((input.unit === "CURRENCY") !== Boolean(input.currency) || (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)) throw new BadRequestException("Invalid budget policy");
    const scoped = input.applicationId ?? "global"; const scopeKey = `${scoped}:${input.tenantId ?? "application"}`;
    return this.db.$transaction(async (tx) => {
      const prior = await tx.oicBudgetRevision.aggregate({ where: { scopeKey, budgetKey: input.budgetKey }, _max: { revision: true } });
      const revision = await tx.oicBudgetRevision.create({ data: { ...input, scopeKey, revision: (prior._max.revision ?? 0) + 1, sourceDigest: digest(input) } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: input.applicationId, tenantId: input.tenantId, action: "admission.budget.drafted", targetType: "budget-policy", targetId: revision.id, requestId: request.requestId, metadata: { revision: revision.revision, sourceDigest: revision.sourceDigest } } });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  @Version("1") @Post("budgets/revisions/:id/publish") async publishBudget(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Req() request: RequestWithIds) {
    this.manage(actor); const row = await this.db.oicBudgetRevision.findUnique({ where: { id } });
    if (!row) throw new BadRequestException("Budget revision not found"); this.appScope(actor, row.applicationId);
    return this.db.$transaction(async (tx) => {
      const overlaps = await tx.oicBudgetRevision.findMany({ where: { scopeKey: row.scopeKey, budgetKey: row.budgetKey, status: "PUBLISHED", NOT: { id } } });
      if (overlaps.some((item) => (!item.effectiveTo || row.effectiveFrom < item.effectiveTo) && (!row.effectiveTo || item.effectiveFrom < row.effectiveTo))) throw new BadRequestException("Published budget intervals overlap");
      const updated = await tx.oicBudgetRevision.update({ where: { id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.oicAuditEvent.create({ data: { actorPrincipalId: actor.id, applicationId: row.applicationId, tenantId: row.tenantId, action: "admission.budget.published", targetType: "budget-policy", targetId: id, requestId: request.requestId, metadata: { revision: row.revision, sourceDigest: row.sourceDigest } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
