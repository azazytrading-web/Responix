import type { Row, Snapshot } from "../../types";
import { discoverEntityMetricGroups, MetricRegistry, metricDefinitions, normalizeMetric } from "./metric-registry";
import type { MetricInstance, MetricValue } from "./metric-registry";

export type DeckEntity = Row & { id: string; title: string; subtitle?: string; group?: string; lifecycle?: string; dna?: MetricInstance[]; metrics?: MetricInstance[]; connections?: Row[]; models?: Row[]; connectionCount?: number; distribution?: unknown };
export type DeckData = { instances: MetricInstance[]; fleet: DeckEntity[]; providers: DeckEntity[]; core: MetricInstance[]; dnaDefinitions: typeof metricDefinitions; executions: Row[]; snapshotAt: string | null; executionSampleSize: number; audit: Row[] };
const registry = new MetricRegistry();
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((row): row is Row => !!row && typeof row === "object" && !Array.isArray(row)) : [];
const text = (row: Row, key: string, fallback = ""): string => typeof row[key] === "string" || typeof row[key] === "number" ? String(row[key]) : fallback;
const countRows = (value: unknown) => rows(value).length;
const sourceSnapshot = { service: "OIC API", endpoint: "/api/v1/admin/console/snapshot", scope: "authenticated Console snapshot" };
const sourceHealth = { service: "OIC API", endpoint: "/api/v1/health/ready", scope: "shared readiness response" };
const sourceExecutions = { service: "OIC API", endpoint: "/api/v1/admin/intelligence/executions?limit=50", scope: "latest bounded sample (up to 50)" };

export function canonicalHealthStates(health: Row | null): { api: "LIVE" | "UNAVAILABLE"; database: "LIVE" | "UNAVAILABLE" } {
  if (!health) return { api: "UNAVAILABLE", database: "UNAVAILABLE" };
  const ready = health.ready && typeof health.ready === "object" && !Array.isArray(health.ready) ? health.ready as Row : health;
  const body = ready.body && typeof ready.body === "object" && !Array.isArray(ready.body) ? ready.body as Row : ready;
  const sourceAvailable = ready.sourceState === "AVAILABLE" ? ready.httpStatus === 200 : true;
  const api = sourceAvailable && body.status === "ok" ? "LIVE" : "UNAVAILABLE";
  const checks = body.checks && typeof body.checks === "object" && !Array.isArray(body.checks) ? body.checks as Row : null;
  const database = sourceAvailable && checks?.database === "ok" ? "LIVE" : checks ? "UNAVAILABLE" : health.status === "ok" ? "LIVE" : "UNAVAILABLE";
  return { api, database };
}

function instance(metricKey: string, entityType: string, value: MetricInstance["value"], source = sourceSnapshot, extras: Partial<Parameters<typeof normalizeMetric>[1]> = {}) {
  const definition = registry.get(metricKey);
  return normalizeMetric(registry, { metricKey, entityType, value, unit: definition?.unit, domain: definition?.domain, source, ...extras });
}
function modelRows(snapshot: Snapshot, deckExecutions: Row[]): DeckEntity[] {
  const providers = rows(snapshot.providers);
  const upstreamModels = rows(snapshot.upstreamModels);
  const providerConnections = rows(snapshot.connections);
  return rows(snapshot.modelFamilies).flatMap((family) => {
    const familyLifecycle = text(family, "lifecycle").toUpperCase();
    return rows(family.editions).filter((edition) => ["PRODUCTION", "CANARY"].includes(text(edition, "lifecycle").toUpperCase())).map((edition) => {
      const revisions = rows(edition.revisions);
      const revision = revisions[0];
      const variants: Row[] = rows(revision?.variants).map((variant): Row => {
        const provider = providers.find((item) => text(item, "id") === text(variant, "providerDefinitionId"));
        const upstreamModel = upstreamModels.find((item) => text(item, "id") === text(variant, "upstreamModelId"));
        const upstreamModelName = text(upstreamModel ?? {}, "upstreamModelId", text(upstreamModel ?? {}, "modelId", ""));
        const providerName = text(provider ?? {}, "displayName", text(provider ?? {}, "key", ""));
        const resolvedProviderName = /openai.compatible/i.test(providerName) && upstreamModelName.toLowerCase().startsWith("deepseek-") ? "DeepSeek" : providerName;
        const bindings = rows(variant.bindings).map((binding) => {
          const connection = providerConnections.find((item) => text(item, "id") === text(binding, "connectionId"));
          return { ...binding, connectionHealth: text(connection ?? {}, "healthStatus", "UNKNOWN"), connectionLifecycle: text(connection ?? {}, "status", "UNKNOWN") };
        });
        return { ...variant, providerKey: text(variant, "providerKey", resolvedProviderName), upstreamModelName, bindings };
      });
      const bindings = variants.flatMap((variant) => rows(variant.bindings));
      const activeBindings = bindings.filter((binding) => text(binding, "status").toUpperCase() === "ACTIVE");
      const activeHealth = activeBindings.map((binding) => text(binding, "connectionHealth").toUpperCase());
      const runtimeState = ["PRODUCTION", "CANARY"].includes(text(edition, "lifecycle").toUpperCase()) && activeBindings.length > 0 && activeHealth.every((health) => health === "HEALTHY")
        ? "LIVE"
        : activeHealth.includes("UNHEALTHY") ? "FAULT" : activeBindings.length ? "DEGRADED" : "UNAVAILABLE";
      const publicId = text(edition, "publicId", text(edition, "editionKey"));
      const modelExecutions = deckExecutions.filter((row) => text(row, "modelId") === publicId);
      const latest = modelExecutions[0];
      const id = text(edition, "id", publicId);
      const knownValues: Record<string, MetricValue> = {
        "fleet.model.lifecycle": text(edition, "lifecycle"),
        "fleet.model.revision": typeof revision?.revision === "number" ? revision.revision : null,
        "fleet.model.active-bindings": bindings.filter((binding) => text(binding, "status").toUpperCase() === "ACTIVE").length,
        "fleet.model.visibility": countRows(edition.visibility),
        "fleet.model.latest-execution": latest ? text(latest, "status", "UNKNOWN") : null
      };
      const metrics = registry.list().filter((definition) => definition.entityType === "model-edition").map((definition) => instance(definition.key, "model-edition", knownValues[definition.key] ?? null, definition.key === "fleet.model.latest-execution" ? sourceExecutions : sourceSnapshot, { entityId: id, reason: definition.key === "fleet.model.latest-execution" && !latest ? "NO_MATCHING_EXECUTION_IN_SAMPLE" : knownValues[definition.key] === undefined ? "NO_SOURCE_ADAPTER" : undefined }));
      return { ...edition, id, runtimeState, title: text(family, "displayName", text(family, "familyKey", "Oi model")) + " / " + text(edition, "displayName", text(edition, "editionKey", "Edition")), subtitle: `${text(edition, "lifecycle")} · ${publicId}`, group: text(family, "familyKey"), lifecycle: text(edition, "lifecycle"), revisions, variants, bindings, familyLifecycle, dna: metricDefinitions.filter((entry) => entry.key.startsWith("dna.")).map((definition) => instance(definition.key, "model-dna", null, { service: "OIC-7", endpoint: "evaluation registry", scope: "planned" }, { entityId: id })), metrics };
    });
  });
}
export function buildFlightDeckData(snapshot: Snapshot | null, health: Row | null, executionsValue: readonly Row[], activity: Row | null = null, evaluationQueue: Row | null = null): DeckData {
  const executions = [...executionsValue].slice(0, 50);
  const data = snapshot;
  const connections = rows(data?.connections);
  const providers = rows(data?.providers);
  const upstream = rows(data?.upstreamModels);
  const families = rows(data?.modelFamilies);
  const allEditions = families.flatMap((family) => rows(family.editions));
  const allRevisions = allEditions.flatMap((edition) => rows(edition.revisions));
  const allVariants = allRevisions.flatMap((revision) => rows(revision.variants));
  const allBindings = allVariants.flatMap((variant) => rows(variant.bindings));
  const healthStates = canonicalHealthStates(health);
  const activityByKey = Object.fromEntries(Object.entries(activity?.metrics && typeof activity.metrics === "object" ? activity.metrics as Row : {}).map(([key, value]) => [key, value && typeof value === "object" ? value as Row : {}]));
  const activityMetric = (key: string) => activityByKey[key] ?? {};
  const activityNumber = (key: string) => {
    const item = activityMetric(key);
    return item.state === "LIVE" && typeof item.value === "number" && Number.isFinite(item.value) ? item.value : null;
  };
  const activitySource = { service: "OIC API", endpoint: "/api/v1/admin/intelligence/overview-activity", scope: typeof activity?.scope === "string" ? activity.scope : "OIC_PLATFORM · latest 50 recorded OIC runtime executions" };
  const values: MetricInstance[] = [
    instance("system.api.live", "service", healthStates.api === "LIVE" ? "LIVE" : health ? "UNAVAILABLE" : null, sourceHealth, { state: healthStates.api, reason: healthStates.api === "LIVE" ? undefined : "HEALTH_NOT_AVAILABLE" }),
    instance("system.database.ready", "service", healthStates.database === "LIVE" ? "READY" : health ? "UNAVAILABLE" : null, sourceHealth, { state: healthStates.database, reason: healthStates.database === "LIVE" ? undefined : "DATABASE_READINESS_NOT_AVAILABLE" }),
    instance("system.applications.count", "identity", data ? countRows(data.applications) : null), instance("system.tenants.count", "identity", data ? countRows(data.tenants) : null), instance("system.principals.count", "identity", data ? countRows(data.principals) : null),
    instance("system.connections.count", "provider-network", data ? connections.length : null), instance("system.upstream-models.count", "provider-network", data ? upstream.length : null), instance("system.model-families.count", "model-factory", data ? families.length : null),
    instance("system.model-editions.count", "model-factory", data ? allEditions.length : null), instance("system.model-revisions.count", "model-factory", data ? allRevisions.length : null), instance("system.model-variants.count", "model-factory", data ? allVariants.length : null),
    instance("system.runtime-bindings.count", "model-factory", data ? allBindings.length : null), instance("system.model-visibility.count", "model-factory", data ? allEditions.reduce((n, edition) => n + countRows(edition.visibility), 0) : null),
    instance("system.audit.sample-count", "operations", data ? countRows(data.audit) : null), instance("system.execution-sample-count", "lab", executions.length, sourceExecutions, { state: executions.length ? "LIVE" : "IDLE", reason: executions.length ? undefined : "NO_EXECUTIONS_IN_SAMPLE", sampleSize: executions.length }),
    instance("lab.execution.status-distribution", "execution-sample", executions.length ? { sampleSize: executions.length, categories: [...new Set(executions.map((row) => text(row, "status", "UNKNOWN")))].map((key) => ({ key, count: executions.filter((row) => text(row, "status", "UNKNOWN") === key).length })) } : { sampleSize: 0, categories: [] }, sourceExecutions, { state: executions.length ? "LIVE" : "IDLE", sampleSize: executions.length }),
    ...([
      ["cognitive.execution.provider-calls", "providerCalls"],
      ["cognitive.execution.retrieval-queries", "retrievalQueries"],
      ["cognitive.execution.memory-lookups", "memoryLookups"],
      ["cognitive.execution.stage-count", "stages"],
      ["cognitive.execution.tools", "toolCalls"],
      ["cognitive.execution.verification", "verificationRounds"],
      ["cognitive.execution.repair", "repairRounds"],
      ["cognitive.execution.backtracking", "backtracks"]
    ] as const).map(([metricKey, activityKey]) => {
      const item = activityMetric(activityKey);
      return instance(metricKey, "execution-sample", activityNumber(activityKey), activitySource, {
        sampleSize: typeof item.sampleSize === "number" ? item.sampleSize : executions.length,
        reason: item.state === "LIVE" ? undefined : item.state === "UNAVAILABLE" ? "SOURCE_FIELD_MISSING_IN_BOUNDED_ACTIVITY_PROJECTION" : "OVERVIEW_ACTIVITY_SOURCE_UNAVAILABLE"
      });
    }),
    instance("operations.queue-pending", "evaluation-queue", typeof evaluationQueue?.queuedWorkItems === "number" ? evaluationQueue.queuedWorkItems : null,
      { service: "OIC API", endpoint: "/api/v1/admin/evaluations/overview", scope: typeof evaluationQueue?.scope === "string" ? evaluationQueue.scope : "OIC_PLATFORM" },
      { state: typeof evaluationQueue?.queuedWorkItems === "number" ? "LIVE" : "UNAVAILABLE", observedAt: typeof evaluationQueue?.observedAt === "string" ? evaluationQueue.observedAt : null, reason: typeof evaluationQueue?.queuedWorkItems === "number" ? undefined : "EVALUATION_QUEUE_READ_UNAVAILABLE" }),
    instance("operations.provider-unhealthy", "operations", connections.filter((connection) => text(connection, "status").toUpperCase() === "ACTIVE" && text(connection, "healthStatus").toUpperCase() === "UNHEALTHY").length),
    instance("operations.provider-unknown", "operations", connections.filter((connection) => text(connection, "status").toUpperCase() === "ACTIVE" && (!text(connection, "healthStatus") || text(connection, "healthStatus").toUpperCase() === "UNKNOWN")).length)
  ];
  const providerEntities: DeckEntity[] = providers.map((provider) => ({ ...provider, id: text(provider, "id", text(provider, "key")), title: text(provider, "displayName", text(provider, "key")), connections: connections.filter((connection) => text(connection, "providerDefinitionId") === text(provider, "id")), models: upstream.filter((model) => text(model, "providerKey") === text(provider, "key")) }));
  for (const provider of providerEntities) {
    const attached = provider.connections as Row[];
    provider.connectionCount = attached.length;
    provider.distribution = { sampleSize: attached.length, categories: ["HEALTHY", "UNHEALTHY", "UNKNOWN"].map((key) => ({ key, count: attached.filter((row) => (text(row, "healthStatus", "UNKNOWN").toUpperCase() || "UNKNOWN") === key).length })) };
    const providerValues: Record<string, MetricValue> = { "providers.definition.connection-count": attached.length, "providers.definition.health-distribution": provider.distribution as MetricValue };
    provider.metrics = registry.list().filter((definition) => definition.entityType === "provider-definition").map((definition) => instance(definition.key, "provider-definition", providerValues[definition.key] ?? null, sourceSnapshot, { entityId: provider.id, sampleSize: attached.length, reason: providerValues[definition.key] === undefined ? "NO_SOURCE_ADAPTER" : undefined }));
    values.push(...provider.metrics);
    for (const connection of attached) {
      const id = text(connection, "id");
      const associatedModels = upstream.filter((model) => text(model, "connectionId") === id);
      const connectionValues: Record<string, MetricValue> = { "providers.connection.health": text(connection, "healthStatus", "UNKNOWN"), "providers.connection.lifecycle": text(connection, "status", "UNKNOWN"), "providers.connection.catalog-count": associatedModels.length, "providers.connection.last-validated": typeof connection.lastValidatedAt === "string" ? connection.lastValidatedAt : null };
      const connectionMetrics = registry.list().filter((definition) => definition.entityType === "provider-connection").map((definition) => instance(definition.key, "provider-connection", connectionValues[definition.key] ?? null, sourceSnapshot, { entityId: id, state: definition.key === "providers.connection.health" && text(connection, "healthStatus").toUpperCase() === "UNHEALTHY" ? "DEGRADED" : undefined, reason: connectionValues[definition.key] === undefined ? "NO_SOURCE_ADAPTER" : undefined }));
      (connection as DeckEntity).metrics = connectionMetrics;
    }
  }
  const fleet = modelRows(data ?? ({ modelFamilies: [] } as unknown as Snapshot), executions);
  for (const definition of metricDefinitions.filter((entry) => entry.key.startsWith("dna."))) values.push(instance(definition.key, "model-dna", null, { service: "OIC-7", endpoint: "evaluation registry", scope: "planned" }));
  const core = values.filter((entry) => entry.domain === "system");
  return { instances: values, core, fleet, providers: providerEntities, dnaDefinitions: metricDefinitions.filter((entry) => entry.key.startsWith("dna.")), executions, snapshotAt: data?.generatedAt ?? null, executionSampleSize: executions.length, audit: rows(data?.audit) };
}

export { registry as flightDeckMetricRegistry, discoverEntityMetricGroups };
