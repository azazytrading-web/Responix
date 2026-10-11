import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { OicDatabaseService } from "@oic/database";
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
