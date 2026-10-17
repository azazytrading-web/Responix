import { NextResponse } from "next/server";
import { apiUrl, controlPlaneCredential, hasConsoleSession, runtimeCredential } from "@/lib/server-auth";
import { aggregatePacket76Accounting } from "../../lib/packet76-accounting.cjs";

export const dynamic = "force-dynamic";
const OIC_PLATFORM_APPLICATION_ID = "7f25c69e-bdbb-4949-ad7b-ef6412119850";

export async function GET(request: Request) {
  if (!(await hasConsoleSession()))
    return NextResponse.json({ error: "Operator session required." }, { status: 401 });
  const view = new URL(request.url).searchParams.get("view");
  const profileId = new URL(request.url).searchParams.get("profileId");
  const runtimeTenantId = new URL(request.url).searchParams.get("tenantId");
  if (view === "runtime-models") {
    if (runtimeTenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runtimeTenantId))
      return NextResponse.json({ error: "Invalid runtime scope." }, { status: 400 });
    const query = runtimeTenantId ? `?tenant_id=${encodeURIComponent(runtimeTenantId)}` : "";
    try {
      const response = await fetch(apiUrl(`/v1/models${query}`), {
        headers: { Authorization: `Bearer ${runtimeCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Runtime model discovery is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "health") {
    const readHealth = async (path: "/api/v1/health/live" | "/api/v1/health/ready") => {
      const observedAt = new Date().toISOString();
      try {
        const response = await fetch(apiUrl(path), { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const body: unknown = await response.json().catch(() => null);
        return { sourceState: "AVAILABLE", endpoint: path, httpStatus: response.status, observedAt, body };
      } catch {
        return { sourceState: "UNAVAILABLE", endpoint: path, httpStatus: null, observedAt, body: null };
      }
    };
    const [live, ready] = await Promise.all([readHealth("/api/v1/health/live"), readHealth("/api/v1/health/ready")]);
    return NextResponse.json({ live, ready }, { headers: { "Cache-Control": "no-store" } });
  }
  if (view === "overview-readiness") {
    try {
      const headers = { Authorization: `Bearer ${controlPlaneCredential()}` };
      const scope = `?applicationId=${encodeURIComponent(OIC_PLATFORM_APPLICATION_ID)}`;
      const [health, overview] = await Promise.all([
        fetch(apiUrl(`/api/v1/admin/evaluations/health${scope}`), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl(`/api/v1/admin/evaluations/overview${scope}`), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
      ]);
      const healthBody: unknown = await health.json().catch(() => null);
      const overviewBody: unknown = await overview.json().catch(() => null);
      if (!health.ok || !overview.ok || !healthBody || typeof healthBody !== "object" || !overviewBody || typeof overviewBody !== "object")
        return NextResponse.json({ state: "UNAVAILABLE", reason: "EVALUATION_READINESS_SOURCE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
      const worker = healthBody as Record<string, unknown>;
      const registry = overviewBody as Record<string, unknown>;
      const attestation = worker.workerAttestation && typeof worker.workerAttestation === "object" ? worker.workerAttestation as Record<string, unknown> : {};
      const queueSource = registry.queue && typeof registry.queue === "object" ? registry.queue as Record<string, unknown> : {};
      const counts = Object.fromEntries(["packs", "releases", "campaigns", "runs", "reports", "candidates"].map((key) => [key, typeof registry[key] === "number" ? registry[key] : null]));
      return NextResponse.json({
        state: "LIVE",
        qualityScore: null,
        qualityState: "UNMEASURED",
        note: typeof registry.note === "string" ? registry.note : "No approved universal quality score is defined.",
        counts,
        readiness: {
          scheduler: typeof worker.scheduler === "string" ? worker.scheduler : "UNKNOWN",
          worker: typeof worker.worker === "string" ? worker.worker : "UNKNOWN",
          workerFresh: typeof worker.workerFresh === "boolean" ? worker.workerFresh : null,
          workerReasonCode: typeof worker.workerReasonCode === "string" ? worker.workerReasonCode : null,
          runExecution: typeof worker.runExecution === "string" ? worker.runExecution : "UNKNOWN",
          configuredConcurrency: typeof attestation.configuredConcurrency === "number" ? attestation.configuredConcurrency : null,
          activeExecutionSlots: typeof attestation.activeExecutionSlots === "number" ? attestation.activeExecutionSlots : null,
          availableExecutionSlots: typeof attestation.availableExecutionSlots === "number" ? attestation.availableExecutionSlots : null
        },
        queue: {
          queuedWorkItems: typeof queueSource.queuedWorkItems === "number" ? queueSource.queuedWorkItems : null,
          leasedWorkItems: typeof queueSource.leasedWorkItems === "number" ? queueSource.leasedWorkItems : null,
          activeRuns: typeof queueSource.activeRuns === "number" ? queueSource.activeRuns : null,
          observedAt: typeof queueSource.observedAt === "string" ? queueSource.observedAt : null,
          scope: typeof queueSource.scope === "string" ? queueSource.scope : null
        }
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ state: "UNAVAILABLE", reason: "EVALUATION_READINESS_SOURCE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "overview-activity") {
    try {
      const response = await fetch(apiUrl("/api/v1/admin/intelligence/overview-activity"), {
        headers: { Authorization: `Bearer ${controlPlaneCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || Array.isArray(body))
        return NextResponse.json({ state: "UNAVAILABLE", reason: "OVERVIEW_ACTIVITY_SOURCE_UNAVAILABLE" }, { status: response.status || 503, headers: { "Cache-Control": "no-store" } });
      const source = body as Record<string, unknown>;
      const metricsSource = source.metrics && typeof source.metrics === "object" ? source.metrics as Record<string, unknown> : {};
      const metricKeys = ["executions", "stages", "providerCalls", "retrievalQueries", "memoryLookups", "toolCalls", "verificationRounds", "repairRounds", "backtracks", "contextTokens", "inputTokens", "outputTokens"];
      const metrics = Object.fromEntries(metricKeys.map((key) => {
        const item = metricsSource[key] && typeof metricsSource[key] === "object" ? metricsSource[key] as Record<string, unknown> : {};
        return [key, { value: typeof item.value === "number" ? item.value : null, state: typeof item.state === "string" ? item.state : "UNAVAILABLE", unit: typeof item.unit === "string" ? item.unit : null, sampleSize: typeof item.sampleSize === "number" ? item.sampleSize : null, scope: typeof item.scope === "string" ? item.scope : null }];
      }));
      const modelActivity = Array.isArray(source.modelActivity) ? source.modelActivity.slice(0, 3).map((entry) => {
        const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
        return Object.fromEntries(["modelId", "executionCount", "latestStatus", "latestStartedAt", "latestCompletedAt", "providerCalls", "retrievalQueries", "memoryLookups", "inputTokens", "outputTokens"].map((key) => [key, item[key] ?? null]));
      }) : [];
      const history = Array.isArray(source.history) ? source.history.slice(0, 50).map((entry) => {
        const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
        return Object.fromEntries(["modelId", "status", "contextTokens", "startedAt", "completedAt", "verificationStatus"].map((key) => [key, item[key] ?? null]));
      }) : [];
      return NextResponse.json({
        state: typeof source.state === "string" ? source.state : "UNAVAILABLE",
        observedAt: typeof source.observedAt === "string" ? source.observedAt : null,
        scope: typeof source.scope === "string" ? source.scope : null,
        sampleSize: typeof source.sampleSize === "number" ? source.sampleSize : null,
        window: source.window && typeof source.window === "object" ? source.window : null,
        statusCounts: source.statusCounts && typeof source.statusCounts === "object" ? source.statusCounts : {},
        metrics, modelActivity, history
      }, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ state: "UNAVAILABLE", reason: "OVERVIEW_ACTIVITY_SOURCE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "evaluation-pack") {
    const packId = new URL(request.url).searchParams.get("packId");
    if (!packId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packId))
      return NextResponse.json({ error: "Invalid evaluation pack identity." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/evaluations/packs/${packId}`), {
        headers: { Authorization: `Bearer ${controlPlaneCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Evaluation pack review is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "evaluation-report") {
    const reportId = new URL(request.url).searchParams.get("reportId");
    if (!reportId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reportId))
      return NextResponse.json({ error: "Invalid evaluation report identity." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/evaluations/reports/${reportId}`), {
        headers: { Authorization: `Bearer ${controlPlaneCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Evaluation report is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "evaluation-run") {
    const runId = new URL(request.url).searchParams.get("runId");
    if (!runId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId))
      return NextResponse.json({ error: "Invalid evaluation run identity." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/evaluations/runs/${runId}`), {
        headers: { Authorization: `Bearer ${controlPlaneCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Evaluation run accounting is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "packet76-accounting") {
    try {
      const headers = { Authorization: `Bearer ${controlPlaneCredential()}` };
      const applicationQuery = `?applicationId=${encodeURIComponent(OIC_PLATFORM_APPLICATION_ID)}`;
      const [campaignResponse, runResponse] = await Promise.all([
        fetch(apiUrl(`/api/v1/admin/evaluations/campaigns${applicationQuery}`), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl(`/api/v1/admin/evaluations/runs${applicationQuery}`), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
      ]);
      if (!campaignResponse.ok || !runResponse.ok) throw new Error("Packet accounting index unavailable.");
      const campaignBody: unknown = await campaignResponse.json().catch(() => null);
      const runBody: unknown = await runResponse.json().catch(() => null);
      const campaigns = Array.isArray(campaignBody) ? campaignBody : [];
      const runs = Array.isArray(runBody) ? runBody : [];
      const cohortIds = new Set(campaigns.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        return typeof row.campaignKey === "string" && /^oic7-packet76-(?:paired|candidate)-cohort-/.test(row.campaignKey) && typeof row.id === "string" ? [row.id] : [];
      }));
      const cohortRuns = runs.filter((item) => item && typeof item === "object" && !Array.isArray(item) && cohortIds.has((item as Record<string, unknown>).campaignId as string));
      const detailResponses = await Promise.all(cohortRuns.map((item) => {
        const id = (item as Record<string, unknown>).id;
        return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
          ? fetch(apiUrl(`/api/v1/admin/evaluations/runs/${id}`), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
          : Promise.resolve(null);
      }));
      if (detailResponses.some((response) => !response?.ok)) throw new Error("Packet accounting detail unavailable.");
      const details = await Promise.all(detailResponses.map((response) => response!.json().catch(() => null)));
      return NextResponse.json(aggregatePacket76Accounting(campaigns, runs, details), { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ state: "UNAVAILABLE", error: "Packet 7.6 accounting is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "evaluation") {
    try {
      const headers = { Authorization: `Bearer ${controlPlaneCredential()}` };
      const [overview, packs, releases, metrics, judges, campaigns, runs, reports, comparisons, work, outbox, state] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/evaluations/overview"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/packs"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/releases"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/metrics"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/judges"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/campaigns"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/runs"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/reports"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/comparisons"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/work"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/outbox"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/evaluations/health"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
      ]);
      const bodies: unknown[] = await Promise.all([overview, packs, releases, metrics, judges, campaigns, runs, reports, comparisons, work, outbox, state].map((response) => response.json().then((body: unknown) => body).catch(() => null)));
      const failed = [overview, packs, releases, metrics, judges, campaigns, runs, reports, comparisons, work, outbox, state].find((response) => !response.ok);
      return NextResponse.json({ overview: bodies[0], packs: bodies[1], releases: bodies[2], metrics: bodies[3], judges: bodies[4], campaigns: bodies[5], runs: bodies[6], reports: bodies[7], comparisons: bodies[8], work: bodies[9], outbox: bodies[10], state: bodies[11] }, { status: failed?.status ?? 200, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Evaluation evidence is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "audit") {
    const applicationId = new URL(request.url).searchParams.get("applicationId");
    if (applicationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId))
      return NextResponse.json({ error: "Invalid audit scope." }, { status: 400 });
    const query = new URLSearchParams({ limit: "100", ...(applicationId ? { applicationId } : {}) });
    try {
      const response = await fetch(apiUrl(`/api/v1/admin/audit?${query.toString()}`), {
        headers: { Authorization: `Bearer ${controlPlaneCredential()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      const body: unknown = await response.json().catch(() => ({ error: "OIC API returned an unreadable response." }));
      const events = Array.isArray(body) ? body.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const source = item as Record<string, unknown>;
        const projected: Record<string, string | number> = {};
        for (const key of ["id", "actorPrincipalId", "applicationId", "tenantId", "action", "targetType", "targetId", "requestId", "traceId", "occurredAt"]) {
          const value = source[key];
          if (typeof value === "string" || typeof value === "number") projected[key] = value;
        }
        return [projected];
      }) : body;
      return NextResponse.json(events, { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Audit source is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "economics") {
    try {
      const headers = { Authorization: `Bearer ${controlPlaneCredential()}` };
      const [costs, oiu, rateBooks, policies] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/economics/costs?limit=50"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/economics/oiu?limit=50"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/economics/rate-books"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/economics/policies"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
      ]);
      const readJson = async (response: Response): Promise<unknown> => response.json().catch(() => null);
      const [costBody, oiuBody, rateBody, policyBody] = await Promise.all([costs, oiu, rateBooks, policies].map(readJson));
      const response = [costs, oiu, rateBooks, policies].find((item) => !item.ok);
      return NextResponse.json({ costs: costBody, oiu: oiuBody, rateBooks: rateBody, policies: policyBody }, { status: response?.status ?? 200, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Economics evidence is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "admission") {
    try {
      const headers = { Authorization: `Bearer ${controlPlaneCredential()}` };
      const [plans, assignments, quotas, budgets, balances] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/admission/plans"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/admission/assignments"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/admission/quotas"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/admission/budgets"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/admission/balances?limit=50"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
      ]);
      const readJson = async (response: Response): Promise<unknown> => response.json().catch(() => null);
      const [planBody, assignmentBody, quotaBody, budgetBody, balanceBody] = await Promise.all([plans, assignments, quotas, budgets, balances].map(readJson));
      const failed = [plans, assignments, quotas, budgets, balances].find((response) => !response.ok);
      return NextResponse.json({ plans: planBody, assignments: assignmentBody, quotas: quotaBody, budgets: budgetBody, balances: balanceBody }, { status: failed?.status ?? 200, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Plan and quota evidence is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (view === "rating") {
    try {
      const headers = { Authorization: `Bearer ${controlPlaneCredential()}` };
      const [priceBooks, rated, fxEvidence] = await Promise.all([
        fetch(apiUrl("/api/v1/admin/economics/customer-price-books"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/economics/rated?limit=50"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
        fetch(apiUrl("/api/v1/admin/economics/fx-evidence?limit=100"), { headers, cache: "no-store", signal: AbortSignal.timeout(8000) })
      ]);
      const readJson = async (response: Response): Promise<unknown> => response.json().catch(() => null);
      const [bookBody, ratedBody, fxBody] = await Promise.all([priceBooks, rated, fxEvidence].map(readJson));
      const failed = [priceBooks, rated, fxEvidence].find((response) => !response.ok);
      return NextResponse.json({ priceBooks: bookBody, rated: ratedBody, fxEvidence: fxBody }, { status: failed?.status ?? 200, headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Customer rating evidence is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  const path = view === "snapshot" ? "/api/v1/admin/console/snapshot" : view === "profiles" ? "/api/v1/admin/intelligence/profiles" : view === "profile-detail" && profileId && /^[0-9a-f-]{36}$/i.test(profileId) ? `/api/v1/admin/intelligence/profiles/${profileId}` : view === "engines" ? "/api/v1/admin/intelligence/engines" : null;
  const params = new URL(request.url).searchParams;
  const resource = view === "memory" ? "memory" : view === "knowledge" ? "knowledge" : view === "executions" || view === "traces" ? "executions" : null;
  const safeQuery = (name: string, max: number) => { const value = params.get(name); return value && value.length <= max ? value : null; };
  const tenantId = safeQuery("tenantId", 36); const q = safeQuery("q", 120); const lifecycle = safeQuery("lifecycle", 16); const kind = safeQuery("kind", 32);
  const listPath = resource ? `/api/v1/admin/intelligence/${resource}${resource === "executions" ? "?limit=50" : `?${new URLSearchParams({ ...(tenantId ? { tenantId } : {}), ...(q ? { q } : {}), ...(lifecycle ? { lifecycle } : {}), ...(kind && resource === "memory" ? { kind } : {}) }).toString()}`}` : null;
  const traceId = new URL(request.url).searchParams.get("traceId");
  const executionPath = (view === "executions" || view === "traces") && traceId && /^[A-Za-z0-9._:-]{1,128}$/.test(traceId) ? `/api/v1/admin/intelligence/executions/${encodeURIComponent(traceId)}` : null;
  const usageId = (name: string) => { const value = params.get(name); return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; };
  const usagePath = view === "usage-events" || view === "usage-attempts" ? (() => {
    const query = new URLSearchParams();
    const limit = params.get("limit");
    if (limit && /^[1-9][0-9]?$|^100$/.test(limit)) query.set("limit", limit);
    const cursor = usageId("cursor"); const applicationId = usageId("applicationId"); const tenantId = usageId("tenantId"); const attemptId = usageId("attemptId");
    if (cursor) query.set("cursor", cursor);
    if (applicationId) query.set("applicationId", applicationId);
    if (tenantId) query.set("tenantId", tenantId);
    if (attemptId && view === "usage-events") query.set("attemptId", attemptId);
    return `/api/v1/admin/usage/${view === "usage-events" ? "events" : "attempts"}${query.size ? `?${query.toString()}` : ""}`;
  })() : null;
  const itemPath = resource === "memory" && params.get("id") && /^[0-9a-f-]{36}$/i.test(params.get("id")!) ? `/api/v1/admin/intelligence/memory/${params.get("id")}` : null;
  const knowledgeItemPath = resource === "knowledge" && params.get("id") && /^[0-9a-f-]{36}$/i.test(params.get("id")!) ? `/api/v1/admin/intelligence/knowledge/${params.get("id")}` : null;
  const resolvedPath = path ?? executionPath ?? itemPath ?? knowledgeItemPath ?? usagePath ?? listPath;
  if (!resolvedPath) return NextResponse.json({ error: "Unknown console view." }, { status: 404 });
  try {
    const headers: HeadersInit = { Authorization: `Bearer ${controlPlaneCredential()}` };
    const response = await fetch(apiUrl(resolvedPath), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    let body: unknown = await response
      .json()
      .catch(() => ({ error: "OIC API returned an unreadable response." }));
    if (view === "snapshot" && body && typeof body === "object" && !Array.isArray(body)) {
      const snapshot = body as Record<string, unknown>;
      const principals = Array.isArray(snapshot.principals) ? snapshot.principals : [];
      const applications = Array.isArray(snapshot.applications) ? snapshot.applications : [];
      const tenants = Array.isArray(snapshot.tenants) ? snapshot.tenants : [];
      const runtimePrincipalId = process.env.OIC_CONSOLE_RUNTIME_PRINCIPAL_ID;
      const principal = principals.find(
        (item) => !!item && typeof item === "object" && (item as Record<string, unknown>).id === runtimePrincipalId
      ) as Record<string, unknown> | undefined;
      const applicationId = principal?.applicationId;
      const application = applications.find(
        (item) => !!item && typeof item === "object" && (item as Record<string, unknown>).id === applicationId
      ) as Record<string, unknown> | undefined;
      const grants = Array.isArray(principal?.tenantGrants) ? principal.tenantGrants : [];
      const tenantIds = grants.map((grant) => grant && typeof grant === "object" ? (grant as Record<string, unknown>).tenantId : null);
      body = {
        ...snapshot,
        runtimeContext: principal && application
          ? {
              application: { id: application.id, key: application.key, displayName: application.displayName },
              tenants: tenants.filter((item) => !!item && typeof item === "object" && tenantIds.includes((item as Record<string, unknown>).id) && (item as Record<string, unknown>).applicationId === applicationId)
            }
          : null
      };
    }
    return NextResponse.json(body, {
      status: response.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "OIC API is unavailable or the console connection is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
