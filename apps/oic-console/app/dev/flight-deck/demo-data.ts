import type { Row, Snapshot } from "../../types";
import type { ShowcaseOverviewData, ShowcaseSignal } from "../../features/overview/flight-deck-composition";
import { coreVitalRegistry } from "../../features/overview/core-vital-registry";

export type ShowcaseScenario = "NOMINAL" | "DEGRADED" | "CRITICAL" | "MIXED" | "DORMANT";
export type ShowcaseFixture = { snapshot: Snapshot; health: Row | null; executions: Row[]; overview: ShowcaseOverviewData };

const snapshotTime = "2026-10-04T09:30:00.000Z";
const countRows = (prefix: string, count: number): Row[] => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}`, key: `${prefix}-${index + 1}` }));

const riskScale = { polarity: "HIGH_IS_BAD" as const, zones: [{ from: 0, to: 30, state: "NORMAL" as const }, { from: 30, to: 50, state: "ELEVATED" as const }, { from: 50, to: 70, state: "WARNING" as const }, { from: 70, to: 85, state: "SEVERE" as const }, { from: 85, to: 100, state: "CRITICAL" as const }] };
const qualityScale = { polarity: "HIGH_IS_GOOD" as const, zones: [{ from: 0, to: 35, state: "CRITICAL" as const }, { from: 35, to: 60, state: "WARNING" as const }, { from: 60, to: 80, state: "ELEVATED" as const }, { from: 80, to: 100, state: "NORMAL" as const }] };
const contextScale = { polarity: "TARGET_RANGE" as const, zones: [{ from: 0, to: 30, state: "WARNING" as const }, { from: 30, to: 70, state: "TARGET" as const }, { from: 70, to: 100, state: "WARNING" as const }], targetRange: [30, 70] as const };

function overviewSignals(scenario: ShowcaseScenario): ShowcaseSignal[] {
  const dormant = scenario === "DORMANT";
  const values = {
    NOMINAL: [92, 87, 84, 91, 89, 54, 38, 46, 67, 72, 18, 24],
    DEGRADED: [74, 61, 68, 73, 76, 82, 71, 78, 85, 92, 57, 61],
    CRITICAL: [28, 19, 24, 31, 27, 98, 96, 94, 100, 100, 94, 100],
    MIXED: [86, 82, 79, 88, 84, 49, 67, 53, 43, 75, 48, 63],
    DORMANT: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }[scenario];
  const healthState = dormant ? "UNMEASURED" : scenario === "CRITICAL" ? "FAULT" : scenario === "DEGRADED" ? "DEGRADED" : "LIVE";
  const healthLabel = healthState === "LIVE" ? "LIVE" : healthState;
  const signalList: Array<Omit<ShowcaseSignal, "state" | "stateLabel" | "stateLabelAr"> & Partial<Pick<ShowcaseSignal, "state" | "stateLabel" | "stateLabelAr">>> = [
    { id: "system-health", label: "API readiness", labelAr: "جاهزية الواجهة", kind: "status" as const, value: "LIVE", unit: "", scale: undefined },
    { id: "database-ready", label: "Database readiness", labelAr: "جاهزية قاعدة البيانات", kind: "status" as const, value: "READY", unit: "", scale: undefined },
    { id: "reasoning", label: "Reasoning", labelAr: "الاستدلال", kind: "radial" as const, value: values[0], unit: "%", scale: qualityScale },
    { id: "retrieval", label: "Retrieval", labelAr: "الاسترجاع", kind: "radial" as const, value: values[1], unit: "%", scale: qualityScale },
    { id: "verification", label: "Verification", labelAr: "التحقق", kind: "arc" as const, value: values[2], unit: "%", scale: qualityScale },
    { id: "memory", label: "Memory utility", labelAr: "منفعة الذاكرة", kind: "radial" as const, value: values[3], unit: "%", scale: qualityScale },
    { id: "reliability", label: "Reliability", labelAr: "الموثوقية", kind: "radial" as const, value: values[4], unit: "%", scale: qualityScale },
    { id: "latency-pressure", label: "Latency pressure", labelAr: "ضغط زمن الاستجابة", kind: "pressure" as const, value: values[5], unit: "%", scale: riskScale },
    { id: "compute-pressure", label: "Compute pressure", labelAr: "ضغط الحوسبة", kind: "rail" as const, value: values[6], min: 0, max: 100, unit: "%", scale: riskScale },
    { id: "provider-load", label: "Provider load", labelAr: "حمل المورّد", kind: "rail" as const, value: values[7], min: 0, max: 100, unit: "%", scale: riskScale },
    { id: "context-band", label: "Context efficiency", labelAr: "كفاءة السياق", kind: "arc" as const, value: values[8], unit: "%", scale: contextScale },
    { id: "execution-activity", label: "Execution activity", labelAr: "نشاط التنفيذ", kind: "numeric" as const, value: dormant ? null : scenario === "CRITICAL" ? 3 : 24, unit: "runs", scale: undefined, samples: dormant ? [] : scenario === "CRITICAL" ? [18, 27, 31, 46, 38, 62, 79, 96] : scenario === "DEGRADED" ? [26, 31, 34, 49, 54, 63, 70, 82] : [18, 24, 31, 38, 46, 58, 64, 72] },
    { id: "platform-scale", label: "Platform scale", labelAr: "حجم المنصة", kind: "numeric" as const, value: dormant ? null : 47, unit: "records", scale: undefined },
    { id: "request-distribution", label: "Request distribution", labelAr: "توزيع الطلبات", kind: "distribution" as const, value: dormant ? null : 0, unit: "", scale: undefined }
  ];
  return signalList.map((item) => {
    if (item.kind === "status") return { ...item, state: healthState, stateLabel: healthState === "LIVE" ? String(item.value) : healthLabel, stateLabelAr: healthState === "LIVE" ? "مباشر" : healthState === "DEGRADED" ? "متدهور" : healthState === "FAULT" ? "عطل" : "غير مقاس", value: dormant ? null : item.value };
    if (item.kind === "distribution") return { ...item, state: dormant ? "UNMEASURED" : healthState, stateLabel: healthLabel, stateLabelAr: healthState === "LIVE" ? "مباشر" : "غير متاح", sampleSize: dormant ? 0 : 36, categories: dormant ? [] : [
      { key: "healthy", label: "Healthy", labelAr: "سليم", count: scenario === "CRITICAL" ? 9 : scenario === "DEGRADED" ? 23 : 31, state: "LIVE" as const },
      { key: "degraded", label: "Degraded", labelAr: "متدهور", count: scenario === "CRITICAL" ? 9 : scenario === "DEGRADED" ? 10 : 4, state: "DEGRADED" as const },
      { key: "fault", label: "Fault", labelAr: "عطل", count: scenario === "CRITICAL" ? 18 : scenario === "DEGRADED" ? 3 : 1, state: "FAULT" as const }
    ] };
    return { ...item, state: dormant ? "UNMEASURED" : item.state ?? healthState, stateLabel: dormant ? "UNMEASURED" : item.stateLabel ?? healthLabel, stateLabelAr: dormant ? "UNMEASURED" : item.stateLabelAr ?? "LIVE", value: dormant ? null : item.value };
  });
}

function coreVitalSignals(scenario: ShowcaseScenario): ShowcaseSignal[] {
  const values: Record<ShowcaseScenario, number[]> = {
    NOMINAL: [42, 54, 38, 62, 47, 28, 41, 33, 46, 58, 18, 67, 126, 840, 3],
    DEGRADED: [68, 76, 71, 74, 72, 61, 69, 73, 77, 81, 57, 41, 94, 610, 7],
    CRITICAL: [96, 98, 93, 97, 91, 95, 97, 94, 99, 100, 94, 8, 18, 120, 1],
    MIXED: [56, 39, 82, 48, 67, 33, 74, 42, 63, 71, 48, 58, 151, 790, 4],
    DORMANT: []
  };
  const risk = { polarity: "HIGH_IS_BAD" as const, zones: [{ from: 0, to: 35, state: "NORMAL" as const }, { from: 35, to: 60, state: "ELEVATED" as const }, { from: 60, to: 80, state: "WARNING" as const }, { from: 80, to: 100, state: "CRITICAL" as const }] };
  const good = { polarity: "HIGH_IS_GOOD" as const, zones: [{ from: 0, to: 30, state: "CRITICAL" as const }, { from: 30, to: 55, state: "WARNING" as const }, { from: 55, to: 75, state: "ELEVATED" as const }, { from: 75, to: 100, state: "NORMAL" as const }] };
  const dormant = scenario === "DORMANT";
  return coreVitalRegistry.map((definition, index) => {
    const value = values[scenario][index];
    const state = dormant ? "UNMEASURED" as const : definition.id === "vital.fault-pressure" && scenario === "CRITICAL" ? "FAULT" as const : definition.id === "vital.cache-reuse" && scenario === "CRITICAL" ? "DEGRADED" as const : "LIVE" as const;
    return {
      id: definition.id, label: definition.label, labelAr: definition.labelAr, kind: definition.instrument,
      value: dormant ? null : value,
      ...(definition.bounds ? { min: definition.bounds[0], max: definition.bounds[1] } : {}),
      unit: definition.unit, state, stateLabel: dormant ? "UNMEASURED" : "DEMO LIVE", stateLabelAr: dormant ? "غير مقاس" : "عرض توضيحي",
      ...(definition.polarity === "HIGH_IS_GOOD" ? { scale: good } : definition.polarity === "HIGH_IS_BAD" ? { scale: risk } : {}),
      ...(definition.phase === "THROUGHPUT" && !dormant ? { samples: Array.from({ length: 10 }, (_, sample) => Math.max(0, value + Math.sin(sample * 0.8 + index) * Math.max(2, value * 0.035))) } : {})
    };
  });
}

function dnaFor(modelIndex: number, scenario: ShowcaseScenario) {
  const shape = [[.92, .84, .87, .81, .94, .78, .82, .74, .9, .79, .72, .83, .91], [.78, .96, .71, .91, .88, .95, .67, .63, .86, .59, .48, .69, .77], [.69, .73, .55, .61, .76, .49, .58, .81, .85, .93, .91, .96, .88]][modelIndex];
  return shape.map((value, index) => {
    const measured = scenario !== "DORMANT" && (modelIndex !== 1 || index < 8);
    return { id: `dna-${index}`, label: ["Reasoning", "Retrieval", "Evidence", "Memory", "Verification", "Tools", "Search", "Repair", "Reliability", "Efficiency", "Latency", "Cost", "Stability"][index], labelAr: ["الاستدلال", "الاسترجاع", "الأدلة", "الذاكرة", "التحقق", "الأدوات", "البحث", "الإصلاح", "الموثوقية", "الكفاءة", "الكمون", "التكلفة", "الاستقرار"][index], state: scenario === "DORMANT" ? "UNMEASURED" as const : modelIndex === 1 && index >= 8 ? "INSUFFICIENT_DATA" as const : "MEASURED" as const, ...(measured ? { value: value * (scenario === "CRITICAL" ? .72 : scenario === "DEGRADED" ? .88 : 1), confidence: modelIndex === 1 ? .68 : .93 } : {}) };
  });
}

function overviewData(scenario: ShowcaseScenario): ShowcaseOverviewData {
  const modelProfiles = [
    { id: "demo-edition-1", state: scenario === "CRITICAL" ? "FAULT" : "HEALTHY", profile: "balanced-prod", provider: "OpenAI", values: [91, 98, 54, 38, 62] },
    { id: "demo-edition-2", state: scenario === "DORMANT" ? "UNMEASURED" : scenario === "CRITICAL" ? "FAULT" : "DEGRADED", profile: "reasoning-canary", provider: "OpenAI-compatible", values: [95, 93, 82, 78, 81] },
    { id: "demo-edition-3", state: scenario === "DORMANT" ? "UNMEASURED" : "DEGRADED", profile: "low-resource", provider: "Local inference", values: [72, 96, 84, 31, 44] }
  ];
  const models = scenario === "DORMANT" ? {} : Object.fromEntries(modelProfiles.map((model, index) => [model.id, { state: model.state as ShowcaseOverviewData["models"][string]["state"], stateLabel: model.state, stateLabelAr: model.state === "HEALTHY" ? "سليم" : model.state === "DEGRADED" ? "متدهور" : "عطل", profile: model.profile, provider: model.provider, intelligence: model.values[0], reliability: model.values[1], utilization: model.values[2], latency: model.values[3], context: model.values[4], dna: dnaFor(index, scenario) }]));
  const scenarioScale = scenario === "DEGRADED" ? 1.2 : scenario === "CRITICAL" ? 1.5 : scenario === "DORMANT" ? 0 : 1;
  return {
    system: overviewSignals(scenario),
    vitals: coreVitalSignals(scenario),
    coreLoadEnergyDraw: scenario === "DORMANT" ? null : scenario === "NOMINAL" ? 62 : scenario === "DEGRADED" ? 84 : scenario === "CRITICAL" ? 112 : 71,
    models,
    providers: scenario === "DORMANT" ? {} : {
      "demo-provider-openai": { load: 42 * scenarioScale, latency: 36, throughput: 68 },
      "demo-provider-compatible": { load: 71 * scenarioScale, latency: scenario === "CRITICAL" ? 94 : 72, throughput: 51 }
    },
    factory: { throughput: scenario === "DORMANT" ? 0 : scenario === "CRITICAL" ? 12 : 74, completed: scenario === "DORMANT" ? 0 : scenario === "CRITICAL" ? 1 : 8, warningStage: scenario === "DORMANT" ? null : scenario === "NOMINAL" ? "model-visibility" : "runtime-bindings", dormant: scenario === "DORMANT" },
    lab: { runs: scenario === "DORMANT" ? 0 : scenario === "CRITICAL" ? 1 : 18, verification: scenario === "DORMANT" ? 0 : scenario === "CRITICAL" ? 29 : 94, evaluation: scenario === "DORMANT" ? 0 : scenario === "CRITICAL" ? 26 : 87, samples: scenario === "DORMANT" ? [] : [14, 22, 35, 31, 47, 58, 65, scenario === "CRITICAL" ? 96 : 77] },
    cognitive: [
      { id: "reasoning", label: "Reasoning", labelAr: "الاستدلال", kind: "radial", value: scenario === "DORMANT" ? null : 84, min: 0, max: 100, unit: "%", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر", scale: qualityScale },
      { id: "retrieval", label: "Retrieval", labelAr: "الاسترجاع", kind: "arc", value: scenario === "DORMANT" ? null : 43, min: 0, max: 100, unit: "queries", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" },
      { id: "memory", label: "Memory", labelAr: "الذاكرة", kind: "radial", value: scenario === "DORMANT" ? null : 28, min: 0, max: 100, unit: "%", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر", scale: qualityScale },
      { id: "tools", label: "Tools", labelAr: "الأدوات", kind: "rail", value: scenario === "DORMANT" ? null : 16, min: 0, max: 100, unit: "calls", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" },
      { id: "verification", label: "Verification", labelAr: "التحقق", kind: "radial", value: scenario === "DORMANT" ? null : scenario === "CRITICAL" ? 29 : 94, min: 0, max: 100, unit: "%", state: scenario === "DORMANT" ? "UNMEASURED" : scenario === "CRITICAL" ? "FAULT" : "LIVE", stateLabel: scenario === "CRITICAL" ? "FAULT" : "LIVE", stateLabelAr: scenario === "CRITICAL" ? "عطل" : "مباشر", scale: qualityScale },
      { id: "repair", label: "Repair", labelAr: "الإصلاح", kind: "numeric", value: scenario === "DORMANT" ? null : 2, unit: "events", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" },
      { id: "backtracking", label: "Backtracking", labelAr: "الرجوع", kind: "pressure", value: scenario === "DORMANT" ? null : 1, min: 0, max: 12, unit: "events", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" },
      { id: "stages", label: "Stage progression", labelAr: "تقدم المراحل", kind: "numeric", value: scenario === "DORMANT" ? null : 12, unit: "stages", state: scenario === "DORMANT" ? "UNMEASURED" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" }
    ],
    operations: [
      { id: "api", label: "API", labelAr: "الواجهة", kind: "status", value: scenario === "CRITICAL" ? null : "LIVE", unit: "", state: scenario === "CRITICAL" ? "FAULT" : "LIVE", stateLabel: scenario === "CRITICAL" ? "FAULT" : "LIVE", stateLabelAr: scenario === "CRITICAL" ? "عطل" : "مباشر" },
      { id: "database", label: "Database", labelAr: "قاعدة البيانات", kind: "status", value: scenario === "CRITICAL" ? null : "READY", unit: "", state: scenario === "CRITICAL" ? "FAULT" : "LIVE", stateLabel: scenario === "CRITICAL" ? "FAULT" : "READY", stateLabelAr: scenario === "CRITICAL" ? "عطل" : "جاهز" },
      { id: "queue", label: "Execution queue", labelAr: "قائمة التنفيذ", kind: "numeric", value: scenario === "DORMANT" ? null : scenario === "CRITICAL" ? 48 : 7, unit: "jobs", state: scenario === "DORMANT" ? "UNMEASURED" : scenario === "CRITICAL" ? "FAULT" : "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" },
      { id: "audit", label: "Audit activity", labelAr: "نشاط التدقيق", kind: "numeric", value: scenario === "DORMANT" ? 0 : 60, unit: "events", state: "LIVE", stateLabel: "LIVE", stateLabelAr: "مباشر" },
      { id: "faults", label: "Connection faults", labelAr: "أعطال الاتصال", kind: "numeric", value: scenario === "DORMANT" ? null : scenario === "CRITICAL" ? 3 : scenario === "DEGRADED" || scenario === "MIXED" ? 1 : 0, unit: "connections", state: scenario === "DORMANT" ? "UNMEASURED" : scenario === "CRITICAL" ? "FAULT" : scenario === "DEGRADED" || scenario === "MIXED" ? "DEGRADED" : "LIVE", stateLabel: scenario === "CRITICAL" ? "FAULT" : scenario === "DEGRADED" || scenario === "MIXED" ? "DEGRADED" : "LIVE", stateLabelAr: scenario === "CRITICAL" ? "عطل" : scenario === "DEGRADED" || scenario === "MIXED" ? "متدهور" : "مباشر" }
    ]
  };
}

function scenarioStatuses(scenario: ShowcaseScenario) {
  if (scenario === "CRITICAL") return { providers: ["UNHEALTHY", "UNHEALTHY", "UNKNOWN"], connections: ["UNHEALTHY", "UNHEALTHY", "UNKNOWN", "UNKNOWN", "UNHEALTHY"], executions: ["FAILED", "FAILED", "FAILED"] };
  if (scenario === "DEGRADED") return { providers: ["HEALTHY", "DEGRADED", "UNKNOWN"], connections: ["HEALTHY", "HEALTHY", "DEGRADED", "UNKNOWN", "UNHEALTHY"], executions: ["COMPLETED", "COMPLETED", "FAILED"] };
  if (scenario === "MIXED") return { providers: ["HEALTHY", "DEGRADED", "HEALTHY"], connections: ["HEALTHY", "DEGRADED", "HEALTHY", "UNHEALTHY", "UNKNOWN"], executions: ["COMPLETED", "FAILED", "RUNNING"] };
  return { providers: ["HEALTHY", "HEALTHY", "UNKNOWN"], connections: ["HEALTHY", "HEALTHY", "HEALTHY", "HEALTHY", "UNKNOWN"], executions: ["COMPLETED", "COMPLETED", "COMPLETED"] };
}

export function createShowcaseFixture(scenario: ShowcaseScenario): ShowcaseFixture {
  const dormant = scenario === "DORMANT";
  const statuses = scenarioStatuses(scenario);
  const providers: Row[] = [
    { id: "demo-provider-openai", key: "demo-openai", displayName: "OpenAI", status: statuses.providers[0] },
    { id: "demo-provider-compatible", key: "demo-compatible", displayName: "OpenAI-compatible", status: statuses.providers[1] },
    { id: "demo-provider-local", key: "demo-local", displayName: "Local inference", status: statuses.providers[2] }
  ];
  const connections: Row[] = dormant ? [] : Array.from({ length: 5 }, (_, index) => ({
    id: `demo-connection-${index + 1}`,
    providerDefinitionId: index < 2 ? providers[0].id : providers[1].id,
    displayName: ["Primary runtime", "Regional runtime", "Canary runtime", "Evaluation runtime", "Standby runtime"][index],
    status: index === 4 ? "INACTIVE" : "ACTIVE",
    healthStatus: statuses.connections[index],
    lastValidatedAt: snapshotTime
  }));
  const upstreamModels: Row[] = dormant ? [] : Array.from({ length: 19 }, (_, index) => ({
    id: `demo-catalog-${index + 1}`,
    displayName: ["oic-1.7", "oic-1.6", "oic-1.5", "oic-1.2"][index % 4],
    providerKey: index % 2 === 0 ? "demo-openai" : "demo-compatible",
    connectionId: `demo-connection-${index % 4 + 1}`
  }));
  const executions: Row[] = dormant ? [] : statuses.executions.map((status, index) => ({
    id: `demo-run-${index + 1}`,
    traceId: `DEMO-TRACE-${String(index + 1).padStart(3, "0")}`,
    modelId: `demo-edition-${index + 1}`,
    status,
    strategy: ["Context optimization", "Retrieval strategy", "Verification pass"][index],
    taskType: "DEMO",
    startedAt: new Date(Date.parse(snapshotTime) - index * 60_000).toISOString(),
    providerCallCount: [8, 5, 3][index],
    retrievalQueryCount: [3, 7, 1][index],
    memoryLookupCount: [4, 6, 2][index],
    stageCount: [5, 4, 3][index]
  }));
  const families: Row[] = dormant ? [] : [
    { id: "demo-family-1", familyKey: "oi-core", displayName: "Oi Core", lifecycle: "PRODUCTION", editions: [{ id: "demo-edition-1", publicId: "demo-edition-1", editionKey: "1.7", displayName: "1.7", lifecycle: "PRODUCTION", revisions: [{ id: "demo-revision-1", revision: 7, variants: [{ providerKey: "OpenAI", upstreamModelId: "oic-1.7", bindings: [{ id: "demo-binding-1", status: "ACTIVE", profileKey: "balanced-prod" }] }] }], visibility: [{ applicationKey: "operator-console" }] }] },
    { id: "demo-family-2", familyKey: "oi-reasoning", displayName: "Oi Reasoning", lifecycle: "CANARY", editions: [{ id: "demo-edition-2", publicId: "demo-edition-2", editionKey: "1.6-canary", displayName: "1.6 Canary", lifecycle: "CANARY", revisions: [{ id: "demo-revision-2", revision: 4, variants: [{ providerKey: "OpenAI-compatible", upstreamModelId: "oic-reasoning-canary", bindings: [{ id: "demo-binding-2", status: "ACTIVE", profileKey: "reasoning-canary" }] }] }], visibility: [{ applicationKey: "workbench" }] }] },
    { id: "demo-family-3", familyKey: "oi-compact", displayName: "Oi Compact", lifecycle: "PRODUCTION", editions: [{ id: "demo-edition-3", publicId: "demo-edition-3", editionKey: "1.2", displayName: "1.2 Constrained", lifecycle: "PRODUCTION", revisions: [{ id: "demo-revision-3", revision: 2, variants: [{ providerKey: "OpenAI-compatible", upstreamModelId: "oic-compact", bindings: [{ id: "demo-binding-3", status: "SUSPENDED", profileKey: "low-resource" }] }] }], visibility: [] }] }
  ];
  const audit = dormant ? [] : [
    { id: "demo-audit-1", action: "provider.connection.status.changed", occurredAt: snapshotTime },
    { id: "demo-audit-2", action: "model.edition.lifecycle.changed", occurredAt: new Date(Date.parse(snapshotTime) - 120_000).toISOString() },
    { id: "demo-audit-3", action: "principal.tenant.revoked", occurredAt: new Date(Date.parse(snapshotTime) - 300_000).toISOString() }
  ];
  return {
    snapshot: {
      generatedAt: snapshotTime,
      applications: dormant ? [] : countRows("demo-app", 15),
      tenants: dormant ? [] : countRows("demo-tenant", 19),
      principals: dormant ? [] : countRows("demo-principal", 13),
      providers,
      connections,
      upstreamModels,
      modelFamilies: families,
      audit
    },
    health: { status: scenario === "CRITICAL" ? "unavailable" : "ok", checks: { database: scenario === "CRITICAL" ? "error" : "ok" } },
    executions,
    overview: overviewData(scenario)
  };
}
