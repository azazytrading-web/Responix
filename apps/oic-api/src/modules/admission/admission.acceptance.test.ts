import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
import { Prisma } from "@oic/database";
import { AdmissionService } from "./admission.service";

function useDedicatedDatabase(): boolean {
  const file = resolve(__dirname, "../../../../../.env.oic.local");
  try {
    const values = new Map<string, string>();
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const entry = /^([^#=]+)=(.*)$/.exec(line);
      if (entry) values.set(entry[1]!, entry[2]!);
    }
    const url = process.env.OIC_TEST_DATABASE_URL ?? values.get("OIC_MIGRATION_DATABASE_URL");
    if (!url) return false;
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    if (parsed.hostname !== "127.0.0.1" || !/^oic[-_]migration[_-]test$/i.test(database)) throw new Error("Admission acceptance requires the dedicated local test database");
    process.env.OIC_DATABASE_URL = url;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

const hasDedicatedDatabase = useDedicatedDatabase();
const past = new Date(Date.now() - 60_000);
const future = new Date(Date.now() + 86_400_000);

void test("Packet 7.6 supplemental OIU capacity is hidden from ordinary admissions and bounded to its trusted run", async () => {
  const priorMode = process.env.OIC_ADMISSION_MODE;
  process.env.OIC_ADMISSION_MODE = "ENFORCE";
  const applicationId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
  const runId = "72959ad6-8a2a-42da-abd1-0b671c5d05a9";
  const extensionId = "2faeb177-bb35-41b3-9ceb-3f8fa97dfcbe";
  const budgetId = "6a3f137a-a191-4a3a-ad6c-e271e5dbe50a";
  const otherExtensionBudgetId = "7a3f137a-a191-4a3a-ad6c-e271e5dbe50a";
  const planId = "f8ff6494-80b2-4a55-8b8c-aef1d917f7fb";
  const principalId = "e8ff6494-80b2-4a55-8b8c-aef1d917f7fb";
  const seenLegs: Array<{ admissionId: string; budgetRevisionId: string | null; amount: string }> = [];
  const createdAdmissions: Array<{ id: string; data: Record<string, unknown> }> = [];
  const extensionBucket = { consumed: new Prisma.Decimal(0), held: new Prisma.Decimal(0), uncertain: new Prisma.Decimal(0), limitValue: new Prisma.Decimal(1536), sequence: 0 };
  let nextAdmission = 0;
  let extensionAvailable = true;
  const tx = {
    oicAdmission: {
      findUnique: () => Promise.resolve(null), count: () => Promise.resolve(0),
      create: ({ data }: { data: Record<string, unknown> }) => { const id = `admission-${++nextAdmission}`; createdAdmissions.push({ id, data }); return Promise.resolve({ id, status: data.status, planRevisionId: data.planRevisionId, denialCode: data.denialCode }); },
      update: () => Promise.resolve({})
    },
    oicPlanAssignment: { findMany: () => Promise.resolve([{ tenantId: null, priority: 1, planRevisionId: planId, planRevision: { status: "PUBLISHED", effectiveFrom: past, effectiveTo: future, maxOutputUnits: 128, maxConcurrency: 1, entitlements: { models: ["oi-1.7"] } } }]) },
    oicQuotaPolicyRevision: { findMany: () => Promise.resolve([]) },
    oicBudgetRevision: { findMany: () => Promise.resolve([
      { id: budgetId, applicationId, tenantId: null, unit: "OIU", enforcement: "HARD", unknownLiabilityRule: "DENY", reservationUpperBound: new Prisma.Decimal(256), amount: new Prisma.Decimal(1536), safetyMargin: new Prisma.Decimal(0), currency: null, effectiveFrom: past, effectiveTo: future },
      { id: otherExtensionBudgetId, applicationId, tenantId: null, unit: "OIU", enforcement: "HARD", unknownLiabilityRule: "DENY", reservationUpperBound: new Prisma.Decimal(256), amount: new Prisma.Decimal(1536), safetyMargin: new Prisma.Decimal(0), currency: null, effectiveFrom: past, effectiveTo: future }
    ]) },
    oicEvaluationCapacityExtension: {
      findMany: () => Promise.resolve([{ id: extensionId, budgetRevisionId: budgetId }, { id: "other-extension", budgetRevisionId: otherExtensionBudgetId }]),
      findFirst: ({ where }: { where: Record<string, unknown> }) => Promise.resolve(extensionAvailable && where.id === extensionId && where.applicationId === applicationId && where.runId === runId && where.status === "ACTIVE" ? { id: extensionId, budgetRevisionId: budgetId, perAdmissionLimitOiu: new Prisma.Decimal(256) } : null)
    },
    oicQuotaBucket: {
      upsert: ({ create }: { create: { budgetRevisionId?: string } }) => Promise.resolve({ id: create.budgetRevisionId === budgetId ? "supplemental-bucket" : `bucket-${create.budgetRevisionId}` }),
      findUniqueOrThrow: ({ where }: { where: { id: string } }) => Promise.resolve(where.id === "supplemental-bucket" ? extensionBucket : { consumed: new Prisma.Decimal(0), held: new Prisma.Decimal(0), uncertain: new Prisma.Decimal(0), limitValue: new Prisma.Decimal(10000), sequence: 0 }),
      update: ({ where, data }: { where: { id: string }; data: { held?: { increment: string }; sequence?: { increment: number } } }) => {
        if (where.id === "supplemental-bucket" && data.held?.increment) extensionBucket.held = extensionBucket.held.plus(data.held.increment);
        if (where.id === "supplemental-bucket" && data.sequence) extensionBucket.sequence += data.sequence.increment;
        return Promise.resolve({ ...extensionBucket });
      }
    },
    oicReservationLeg: { create: ({ data }: { data: { admissionId: string; budgetRevisionId: string | null; amount: string } }) => { seenLegs.push(data); return Promise.resolve({}); } },
    oicUsagePosting: { create: () => Promise.resolve({}) },
    oicAuditEvent: { create: () => Promise.resolve({}) },
    $queryRaw: () => Promise.resolve([])
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const service = new AdmissionService(db as never);
  const request = { model: "oi-1.7" as const, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "bounded" }] }], maxOutputUnits: 128 };
  try {
    const ordinary = await service.admit({ applicationId, tenantId: null, principalId, requestId: "ordinary", traceId: "ordinary-trace" }, request, "text.generate", "ordinary-request-0001", { requestUnits: "1", inputTokens: "16", outputTokens: "128" });
    assert.equal(ordinary.status, "ADMITTED");
    assert.equal(createdAdmissions[0]?.data.capacityExtensionId, undefined);
    assert.equal(seenLegs.some((leg) => leg.budgetRevisionId === budgetId || leg.budgetRevisionId === otherExtensionBudgetId), false);

    const scoped = { applicationId, tenantId: null, principalId, requestId: "evaluation", traceId: "evaluation-trace", evaluationRunId: runId, capacityExtensionId: extensionId };
    const wrongApplication = await service.admit({ ...scoped, applicationId: "83ed3add-7056-4915-b5d9-8c7a98a958bb" }, request, "text.generate", "p76-wrong-app-0001", { requestUnits: "1", inputTokens: "16", outputTokens: "128" });
    assert.equal(wrongApplication.status, "DENIED");
    assert.equal(wrongApplication.denialCode, "UNKNOWN_BOUND");
    extensionAvailable = false;
    const expired = await service.admit(scoped, request, "text.generate", "p76-expired-0001", { requestUnits: "1", inputTokens: "16", outputTokens: "128" });
    assert.equal(expired.status, "DENIED");
    assert.equal(expired.denialCode, "UNKNOWN_BOUND");
    extensionAvailable = true;
    const admissions = [];
    for (let index = 0; index < 7; index += 1) admissions.push(await service.admit(scoped, request, "text.generate", `p76-request-${String(index).padStart(4, "0")}`, { requestUnits: "1", inputTokens: "16", outputTokens: "128" }));
    assert.deepEqual(admissions.slice(0, 6).map((item) => [item.status, item.denialCode]), Array(6).fill(["ADMITTED", null]));
    assert.equal(admissions[6]?.status, "DENIED");
    assert.equal(admissions[6]?.denialCode, "EXHAUSTED");
    assert.equal(createdAdmissions.filter((item) => item.data.capacityExtensionId === extensionId).length, 7);
    assert.equal(seenLegs.filter((leg) => leg.budgetRevisionId === budgetId).length, 6);
    assert.ok(seenLegs.filter((leg) => leg.budgetRevisionId === budgetId).every((leg) => leg.amount === "256"));
    assert.equal(extensionBucket.held.toString(), "1536");

    const wrongRun = await service.admit({ ...scoped, requestId: "wrong-run", evaluationRunId: "83ed3add-7056-4915-b5d9-8c7a98a958bb" }, request, "text.generate", "p76-wrong-run-0001", { requestUnits: "1", inputTokens: "16", outputTokens: "128" });
    assert.equal(wrongRun.status, "DENIED");
    assert.equal(wrongRun.denialCode, "UNKNOWN_BOUND");
  } finally {
    if (priorMode === undefined) delete process.env.OIC_ADMISSION_MODE; else process.env.OIC_ADMISSION_MODE = priorMode;
  }
});

void test("Packet 7.6 resolves only the active extension's immutable OIU revision after a plan revision refresh", async () => {
  const priorMode = process.env.OIC_ADMISSION_MODE;
  process.env.OIC_ADMISSION_MODE = "ENFORCE";
  const applicationId = "7f25c69e-bdbb-4949-ad7b-ef6412119850";
  const runId = "72959ad6-8a2a-42da-abd1-0b671c5d05a9";
  const extensionId = "2faeb177-bb35-41b3-9ceb-3f8fa97dfcbe";
  const extensionBudgetId = "6a3f137a-a191-4a3a-ad6c-e271e5dbe50a";
  const planRevisionId = "f8ff6494-80b2-4a55-8b8c-aef1d917f7fb";
  const principalId = "e8ff6494-80b2-4a55-8b8c-aef1d917f7fb";
  const budget = {
    id: extensionBudgetId, applicationId, tenantId: null, unit: "OIU", enforcement: "HARD",
    unknownLiabilityRule: "DENY", reservationUpperBound: new Prisma.Decimal(256),
    amount: new Prisma.Decimal(1536), safetyMargin: new Prisma.Decimal(0), currency: null,
    effectiveFrom: past, effectiveTo: future
  };
  const legs: Array<{ budgetRevisionId: string | null; amount: string }> = [];
  let held = new Prisma.Decimal(0);
  const tx = {
    oicAdmission: {
      findUnique: () => Promise.resolve(null), count: () => Promise.resolve(0),
      create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "admission-refreshed-plan", status: data.status, planRevisionId: data.planRevisionId, denialCode: data.denialCode }),
      update: () => Promise.resolve({})
    },
    oicPlanAssignment: { findMany: () => Promise.resolve([{ tenantId: null, priority: 1, planRevisionId, planRevision: { status: "PUBLISHED", effectiveFrom: past, effectiveTo: future, maxOutputUnits: 128, maxConcurrency: 1, entitlements: { models: ["oi-1.7"] } } }]) },
    oicQuotaPolicyRevision: { findMany: () => Promise.resolve([]) },
    // The refreshed plan does not inherit the old revision's plan-linked budget.
    oicBudgetRevision: { findMany: () => Promise.resolve([]), findFirst: ({ where }: { where: Record<string, unknown> }) => Promise.resolve(where.id === extensionBudgetId ? budget : null) },
    oicEvaluationCapacityExtension: {
      findMany: () => Promise.resolve([{ id: extensionId, budgetRevisionId: extensionBudgetId }]),
      findFirst: ({ where }: { where: Record<string, unknown> }) => Promise.resolve(
        where.id === extensionId && where.applicationId === applicationId && where.runId === runId && where.status === "ACTIVE"
          ? { id: extensionId, budgetRevisionId: extensionBudgetId, perAdmissionLimitOiu: new Prisma.Decimal(256) }
          : null
      )
    },
    oicQuotaBucket: {
      upsert: () => Promise.resolve({ id: "extension-bucket" }),
      findUniqueOrThrow: () => Promise.resolve({ consumed: new Prisma.Decimal(0), held, uncertain: new Prisma.Decimal(0), limitValue: new Prisma.Decimal(1536), sequence: 0 }),
      update: ({ data }: { data: { held?: { increment: string } } }) => { if (data.held?.increment) held = held.plus(data.held.increment); return Promise.resolve({ sequence: 1 }); }
    },
    oicReservationLeg: { create: ({ data }: { data: { budgetRevisionId: string | null; amount: string } }) => { legs.push(data); return Promise.resolve({}); } },
    oicUsagePosting: { create: () => Promise.resolve({}) },
    oicAuditEvent: { create: () => Promise.resolve({}) },
    $queryRaw: () => Promise.resolve([])
  };
  const db = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
  const service = new AdmissionService(db as never);
  const request = { model: "oi-1.7" as const, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "bounded" }] }], maxOutputUnits: 128 };
  try {
    const result = await service.admit({ applicationId, tenantId: null, principalId, requestId: "refreshed-plan", traceId: "refreshed-plan-trace", evaluationRunId: runId, capacityExtensionId: extensionId }, request, "native.invoke.v1", "p76-refreshed-plan-0001", { requestUnits: "1", inputTokens: "16", outputTokens: "128" });
    assert.equal(result.status, "ADMITTED");
    assert.equal(result.denialCode, null);
    assert.deepEqual(legs.map((leg) => [leg.budgetRevisionId, leg.amount]), [[extensionBudgetId, "256"]]);
    assert.equal(held.toString(), "256");
  } finally {
    if (priorMode === undefined) delete process.env.OIC_ADMISSION_MODE; else process.env.OIC_ADMISSION_MODE = priorMode;
  }
});

void test("OIC-6.3 concurrent admission reserves hard quota once and settles immutable postings", { skip: !hasDedicatedDatabase }, async () => {
  const priorMode = process.env.OIC_ADMISSION_MODE;
  process.env.OIC_ADMISSION_MODE = "ENFORCE";
  const db = new OicDatabaseService();
  await db.$connect();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  let applicationId: string | undefined;
  let tenantId: string | undefined;
  let principalId: string | undefined;
  let planId: string | undefined;
  let planRevisionId: string | undefined;
  let assignmentId: string | undefined;
  let policyId: string | undefined;
  const admissionIds: string[] = [];
  const service = new AdmissionService(db);
  const context = { applicationId: "", tenantId: null as string | null, principalId: "", requestId: `admission-${suffix}`, traceId: `admission-trace-${suffix}` };
  const request = { model: "oi-1.7" as const, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "quota test" }] }] };
  try {
    const app = await db.oicApplication.create({ data: { key: `AD${suffix}`, displayName: "Admission acceptance" } }); applicationId = app.id; context.applicationId = app.id;
    const tenant = await db.oicTenant.create({ data: { applicationId: app.id, key: `t${suffix}`, displayName: "Admission tenant" } }); tenantId = tenant.id; context.tenantId = tenant.id;
    const principal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `p${suffix}`, displayName: "Admission principal" } }); principalId = principal.id; context.principalId = principal.id;
    const plan = await db.oicPlan.create({ data: { applicationId: app.id, planKey: `plan-${suffix}`, displayName: "Admission plan" } }); planId = plan.id;
    const revision = await db.oicPlanRevision.create({ data: { planId: plan.id, revision: 1, status: "PUBLISHED", entitlements: { models: [request.model] }, maxOutputUnits: 100, sourceDigest: "a".repeat(64), effectiveFrom: past } }); planRevisionId = revision.id;
    const assignment = await db.oicPlanAssignment.create({ data: { applicationId: app.id, tenantId: tenant.id, subjectKey: "*", planRevisionId: revision.id, effectiveFrom: past } }); assignmentId = assignment.id;
    const policy = await db.oicQuotaPolicyRevision.create({ data: {
      applicationId: app.id, tenantId: tenant.id, planRevisionId: revision.id, scopeKey: `${app.id}:${tenant.id}`, quotaKey: `tokens-${suffix}`, revision: 1, status: "PUBLISHED",
      subject: "TENANT", dimension: "inputTokens", unit: "TOKENS", window: "UTC_DAY", enforcement: "HARD", limitValue: "100", sourceDigest: "b".repeat(64), effectiveFrom: past, effectiveTo: future
    } }); policyId = policy.id;
    const candidates = await Promise.all([
      service.admit(context, request, "native.invoke.v1", `request-a-${suffix}`, { inputTokens: "80", outputTokens: "20", requestUnits: "1" }),
      service.admit(context, request, "native.invoke.v1", `request-b-${suffix}`, { inputTokens: "80", outputTokens: "20", requestUnits: "1" })
    ]);
    admissionIds.push(...candidates.map((item) => item.id));
    assert.equal(candidates.filter((item) => item.status === "ADMITTED").length, 1);
    assert.equal(candidates.filter((item) => item.status === "DENIED" && item.denialCode === "EXHAUSTED").length, 1);
    const admitted = candidates.find((item) => item.status === "ADMITTED")!;
    await service.markDispatched(admitted.id);
    await service.settle(admitted.id, { inputTokens: 40, outputTokens: 10 });
    const bucket = await db.oicQuotaBucket.findFirstOrThrow({ where: { quotaPolicyRevisionId: policy.id } });
    assert.equal(bucket.consumed.toString(), "40");
    assert.equal(bucket.held.toString(), "0");
    assert.equal(await db.oicUsagePosting.count({ where: { admissionId: admitted.id, kind: { in: ["RESERVE", "CONSUME", "RELEASE"] } } }), 3);
    assert.equal(await db.oicAdmission.findUniqueOrThrow({ where: { id: admitted.id } }).then((row) => row.status), "SETTLED");
    const admittedKey = candidates[0].status === "ADMITTED" ? `request-a-${suffix}` : `request-b-${suffix}`;
    const replay = await service.admit(context, request, "native.invoke.v1", admittedKey, { inputTokens: "80", outputTokens: "20", requestUnits: "1" });
    assert.equal(replay.id, candidates.find((item) => item.status === "ADMITTED")?.id);
  } finally {
    if (admissionIds.length) {
      await db.oicUsagePosting.deleteMany({ where: { admissionId: { in: admissionIds } } }).catch(() => undefined);
      await db.oicReservationLeg.deleteMany({ where: { admissionId: { in: admissionIds } } }).catch(() => undefined);
      await db.oicProviderAttempt.updateMany({ where: { admissionId: { in: admissionIds } }, data: { admissionId: null } }).catch(() => undefined);
      await db.oicAdmission.deleteMany({ where: { id: { in: admissionIds } } }).catch(() => undefined);
    }
    if (applicationId) await db.oicQuotaBucket.deleteMany({ where: { applicationId } }).catch(() => undefined);
    if (policyId) await db.oicQuotaPolicyRevision.deleteMany({ where: { id: policyId } }).catch(() => undefined);
    if (assignmentId) await db.oicPlanAssignment.deleteMany({ where: { id: assignmentId } }).catch(() => undefined);
    if (planRevisionId) await db.oicPlanRevision.deleteMany({ where: { id: planRevisionId } }).catch(() => undefined);
    if (planId) await db.oicPlan.deleteMany({ where: { id: planId } }).catch(() => undefined);
    if (principalId) await db.oicServicePrincipal.deleteMany({ where: { id: principalId } }).catch(() => undefined);
    if (tenantId) await db.oicTenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
    if (applicationId) await db.oicApplication.deleteMany({ where: { id: applicationId } }).catch(() => undefined);
    await db.$disconnect();
    if (priorMode === undefined) delete process.env.OIC_ADMISSION_MODE; else process.env.OIC_ADMISSION_MODE = priorMode;
  }
});

void test("OIC-6 hard OIU admission reserves Prisma Decimal bounds and leaves unknown OIU unsettled", { skip: !hasDedicatedDatabase }, async () => {
  const priorMode = process.env.OIC_ADMISSION_MODE;
  process.env.OIC_ADMISSION_MODE = "ENFORCE";
  const db = new OicDatabaseService();
  await db.$connect();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  let applicationId: string | undefined;
  let principalId: string | undefined;
  let planId: string | undefined;
  let planRevisionId: string | undefined;
  let assignmentId: string | undefined;
  let budgetId: string | undefined;
  let admissionId: string | undefined;
  const service = new AdmissionService(db);
  const context = { applicationId: "", tenantId: null as string | null, principalId: "", requestId: `budget-${suffix}`, traceId: `budget-trace-${suffix}` };
  const request = { model: "oi-1.7" as const, input: [{ speaker: "user" as const, content: [{ type: "text" as const, text: "bounded evaluation" }] }], maxOutputUnits: 8 };
  try {
    const app = await db.oicApplication.create({ data: { key: `OIUB${suffix}`, displayName: "OIC-6 hard OIU acceptance" } }); applicationId = app.id; context.applicationId = app.id;
    const principal = await db.oicServicePrincipal.create({ data: { applicationId: app.id, key: `p${suffix}`, displayName: "OIU admission principal" } }); principalId = principal.id; context.principalId = principal.id;
    const plan = await db.oicPlan.create({ data: { applicationId: app.id, planKey: `oiu-${suffix}`, displayName: "OIU admission plan" } }); planId = plan.id;
    const revision = await db.oicPlanRevision.create({ data: { planId: plan.id, revision: 1, status: "PUBLISHED", entitlements: { models: [request.model] }, maxOutputUnits: 8, maxConcurrency: 1, sourceDigest: "c".repeat(64), effectiveFrom: past } }); planRevisionId = revision.id;
    const assignment = await db.oicPlanAssignment.create({ data: { applicationId: app.id, subjectKey: principal.id, planRevisionId: revision.id, effectiveFrom: past } }); assignmentId = assignment.id;
    const budget = await db.oicBudgetRevision.create({ data: { applicationId: app.id, planRevisionId: revision.id, scopeKey: `${app.id}:application`, budgetKey: `oiu-${suffix}`, revision: 1, status: "PUBLISHED", unit: "OIU", enforcement: "HARD", amount: "136", reservationUpperBound: "136", purpose: "single protected evaluation attempt", sourceDigest: "d".repeat(64), unknownLiabilityRule: "DENY", effectiveFrom: past, effectiveTo: future } }); budgetId = budget.id;
    const admitted = await service.admit(context, request, "text.generate", `one-attempt-${suffix}`, { requestUnits: "1", inputTokens: "20", outputTokens: "8" }); admissionId = admitted.id;
    assert.equal(admitted.status, "ADMITTED");
    const legs = await db.oicReservationLeg.findMany({ where: { admissionId } });
    assert.equal(legs.length, 1);
    assert.equal(legs[0]?.budgetRevisionId, budget.id);
    assert.equal(legs[0]?.amount.toString(), "136");
    const bucket = await db.oicQuotaBucket.findUniqueOrThrow({ where: { id: legs[0].bucketId } });
    assert.equal(bucket.held.toString(), "136");
    await service.markDispatched(admitted.id);
    await service.uncertain(admitted.id);
    const unresolved = await db.oicAdmission.findUniqueOrThrow({ where: { id: admitted.id }, include: { legs: true } });
    assert.equal(unresolved.status, "UNCERTAIN");
    assert.equal(unresolved.legs[0]?.state, "UNCERTAIN");
    const held = await db.oicQuotaBucket.findUniqueOrThrow({ where: { id: legs[0].bucketId } });
    assert.equal(held.held.toString(), "0");
    assert.equal(held.uncertain.toString(), "136");
    assert.equal(held.consumed.toString(), "0");
    assert.equal(await db.oicProviderAttempt.count({ where: { admissionId: admitted.id } }), 0);
    await db.oicAdmission.update({ where: { id: admitted.id }, data: { dispatchDeadline: new Date(Date.now() - 1) } });
    const reconciliation = await service.reconcileExpired();
    assert.ok(reconciliation.released >= 1);
    const released = await db.oicAdmission.findUniqueOrThrow({ where: { id: admitted.id }, include: { legs: true } });
    assert.equal(released.status, "RELEASED");
    assert.equal(released.legs[0]?.state, "RELEASED");
    const settledBucket = await db.oicQuotaBucket.findUniqueOrThrow({ where: { id: legs[0].bucketId } });
    assert.equal(settledBucket.uncertain.toString(), "0");
    assert.equal(settledBucket.consumed.toString(), "0");
  } finally {
    if (admissionId) {
      await db.oicUsagePosting.deleteMany({ where: { admissionId } }).catch(() => undefined);
      await db.oicReservationLeg.deleteMany({ where: { admissionId } }).catch(() => undefined);
      await db.oicProviderAttempt.updateMany({ where: { admissionId }, data: { admissionId: null } }).catch(() => undefined);
      await db.oicAdmission.deleteMany({ where: { id: admissionId } }).catch(() => undefined);
    }
    if (applicationId) await db.oicQuotaBucket.deleteMany({ where: { applicationId } }).catch(() => undefined);
    if (budgetId) await db.oicBudgetRevision.deleteMany({ where: { id: budgetId } }).catch(() => undefined);
    if (assignmentId) await db.oicPlanAssignment.deleteMany({ where: { id: assignmentId } }).catch(() => undefined);
    if (planRevisionId) await db.oicPlanRevision.deleteMany({ where: { id: planRevisionId } }).catch(() => undefined);
    if (planId) await db.oicPlan.deleteMany({ where: { id: planId } }).catch(() => undefined);
    if (principalId) await db.oicServicePrincipal.deleteMany({ where: { id: principalId } }).catch(() => undefined);
    if (applicationId) await db.oicApplication.deleteMany({ where: { id: applicationId } }).catch(() => undefined);
    await db.$disconnect();
    if (priorMode === undefined) delete process.env.OIC_ADMISSION_MODE; else process.env.OIC_ADMISSION_MODE = priorMode;
  }
});
