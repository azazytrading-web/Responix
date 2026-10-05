export type MetricState = "LIVE" | "IDLE" | "UNAVAILABLE" | "DEGRADED" | "FAULT";
export type MetricMaturity = "LIVE_NOW" | "DERIVED_NOW" | "PLANNED" | "EXTENSIBLE";
export type MetricDomain = "system" | "fleet" | "providers" | "factory" | "lab" | "cognitive" | "operations";
export type InstrumentFamily = string;
export type MetricValue = number | string | MetricDistribution | null;

export type MetricDistribution = {
  sampleSize: number;
  categories: { key: string; count: number; state?: MetricState }[];
};

export type MetricDefinition = {
  key: string;
  version: number;
  domain: MetricDomain;
  entityType: string;
  labelKey: string;
  descriptionKey: string;
  unit: string;
  valueType: "number" | "state" | "distribution";
  valueSemantics: string;
  normalRange?: readonly [number, number];
  thresholdSemantics?: string;
  historySupport: "NONE" | "SOURCE_RETAINED";
  visualizationHints: readonly InstrumentFamily[];
  sourceOwnership: string;
  drilldown: string | null;
  maturity: MetricMaturity;
  priority: number;
};

export type MetricInstance = {
  metricKey: string;
  definitionVersion: number | null;
  domain: MetricDomain;
  entityType: string;
  entityId?: string;
  value: MetricValue;
  unit: string;
  state: MetricState;
  maturity: MetricMaturity;
  source: { service: string; endpoint: string; scope: string };
  freshness: { state: "UNKNOWN" | "FRESH" | "AGING" | "STALE"; observedAt: string | null; agingAfterMs: number | null; staleAfterMs: number | null };
  sampleSize?: number;
  timeWindow?: string;
  reason?: string;
  supported: boolean;
};

export type MetricInput = {
  metricKey: string;
  domain?: MetricDomain;
  entityType: string;
  entityId?: string;
  value: MetricValue;
  unit?: string;
  state?: MetricState;
  maturity?: MetricMaturity;
  source: { service: string; endpoint: string; scope: string };
  observedAt?: string | null;
  agingAfterMs?: number | null;
  staleAfterMs?: number | null;
  sampleSize?: number;
  timeWindow?: string;
  reason?: string;
};

export const metricDefinitions: readonly MetricDefinition[] = [
  { key: "system.api.live", version: 1, domain: "system", entityType: "service", labelKey: "apiLive", descriptionKey: "apiLiveHelp", unit: "state", valueType: "state", valueSemantics: "API reachability shown by the successful OIC readiness response; this is a snapshot observation, not a sustained liveness probe.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC health readiness endpoint via authenticated Console BFF", drilldown: "health", maturity: "LIVE_NOW", priority: 10 },
  { key: "system.database.ready", version: 1, domain: "system", entityType: "service", labelKey: "databaseReady", descriptionKey: "databaseReadyHelp", unit: "state", valueType: "state", valueSemantics: "Database readiness check returned by the OIC API.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC health readiness endpoint", drilldown: "health", maturity: "LIVE_NOW", priority: 20 },
  { key: "system.applications.count", version: 1, domain: "system", entityType: "identity", labelKey: "applications", descriptionKey: "applicationsHelp", unit: "records", valueType: "number", valueSemantics: "Application records returned in the current authorized Console snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "applications", maturity: "DERIVED_NOW", priority: 30 },
  { key: "system.tenants.count", version: 1, domain: "system", entityType: "identity", labelKey: "tenants", descriptionKey: "tenantsHelp", unit: "records", valueType: "number", valueSemantics: "Tenant records returned in the current authorized Console snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "tenants", maturity: "DERIVED_NOW", priority: 40 },
  { key: "system.principals.count", version: 1, domain: "system", entityType: "identity", labelKey: "principals", descriptionKey: "principalsHelp", unit: "records", valueType: "number", valueSemantics: "Service principal records returned in the current authorized Console snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "principals", maturity: "DERIVED_NOW", priority: 50 },
  { key: "system.connections.count", version: 1, domain: "system", entityType: "provider-network", labelKey: "connections", descriptionKey: "connectionsHelp", unit: "records", valueType: "number", valueSemantics: "Provider connections returned in the current authorized Console snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "providers", maturity: "DERIVED_NOW", priority: 60 },
  { key: "system.upstream-models.count", version: 1, domain: "system", entityType: "provider-network", labelKey: "upstreamModels", descriptionKey: "upstreamModelsHelp", unit: "records", valueType: "number", valueSemantics: "Upstream catalog models returned in the current authorized Console snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "catalog", maturity: "DERIVED_NOW", priority: 70 },
  { key: "system.model-families.count", version: 1, domain: "system", entityType: "model-factory", labelKey: "modelFamilies", descriptionKey: "modelFamiliesHelp", unit: "families", valueType: "number", valueSemantics: "Model families returned in the current authorized Console snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 80 },
  { key: "system.model-editions.count", version: 1, domain: "system", entityType: "model-factory", labelKey: "modelEditions", descriptionKey: "modelEditionsHelp", unit: "editions", valueType: "number", valueSemantics: "Nested model editions returned in the current snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 90 },
  { key: "system.model-revisions.count", version: 1, domain: "system", entityType: "model-factory", labelKey: "modelRevisions", descriptionKey: "modelRevisionsHelp", unit: "revisions", valueType: "number", valueSemantics: "Nested model revisions returned in the current snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 100 },
  { key: "system.model-variants.count", version: 1, domain: "system", entityType: "model-factory", labelKey: "modelVariants", descriptionKey: "modelVariantsHelp", unit: "variants", valueType: "number", valueSemantics: "Nested model variants returned in the current snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 110 },
  { key: "system.runtime-bindings.count", version: 1, domain: "system", entityType: "model-factory", labelKey: "runtimeBindings", descriptionKey: "runtimeBindingsHelp", unit: "bindings", valueType: "number", valueSemantics: "Nested runtime binding records returned in the current snapshot; not proof of successful resolution.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 120 },
  { key: "system.model-visibility.count", version: 1, domain: "system", entityType: "model-factory", labelKey: "modelVisibility", descriptionKey: "modelVisibilityHelp", unit: "relationships", valueType: "number", valueSemantics: "Persisted application visibility relationships in the current snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 130 },
  { key: "system.audit.sample-count", version: 1, domain: "system", entityType: "operations", labelKey: "auditSample", descriptionKey: "auditSampleHelp", unit: "events", valueType: "number", valueSemantics: "Audit rows in the bounded snapshot response, capped by the API; not a total or alert count.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot (up to 60 audit records)", drilldown: "audit", maturity: "DERIVED_NOW", priority: 140 },
  { key: "system.execution-sample-count", version: 1, domain: "system", entityType: "lab", labelKey: "executionSample", descriptionKey: "executionSampleHelp", unit: "runs", valueType: "number", valueSemantics: "Execution rows returned by the bounded recent execution query, capped at 50.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence executions query (up to 50 records)", drilldown: "traces", maturity: "DERIVED_NOW", priority: 150 },
  { key: "providers.connection.health", version: 1, domain: "providers", entityType: "provider-connection", labelKey: "connectionHealth", descriptionKey: "connectionHealthHelp", unit: "state", valueType: "state", valueSemantics: "Persisted connection health enum from the Console snapshot; UNKNOWN remains unknown.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC provider connection snapshot", drilldown: "providers", maturity: "LIVE_NOW", priority: 10 },
  { key: "providers.connection.lifecycle", version: 1, domain: "providers", entityType: "provider-connection", labelKey: "connectionLifecycle", descriptionKey: "connectionLifecycleHelp", unit: "state", valueType: "state", valueSemantics: "Persisted provider connection lifecycle enum.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC provider connection snapshot", drilldown: "providers", maturity: "LIVE_NOW", priority: 20 },
  { key: "providers.connection.catalog-count", version: 1, domain: "providers", entityType: "provider-connection", labelKey: "connectionCatalog", descriptionKey: "connectionCatalogHelp", unit: "models", valueType: "number", valueSemantics: "Upstream model rows returned for this connection in the same snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "catalog", maturity: "DERIVED_NOW", priority: 30 },
  { key: "providers.connection.last-validated", version: 1, domain: "providers", entityType: "provider-connection", labelKey: "lastValidated", descriptionKey: "lastValidatedHelp", unit: "timestamp", valueType: "state", valueSemantics: "Persisted last validation timestamp, when present; not continuous availability or latency.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC provider connection snapshot", drilldown: "providers", maturity: "LIVE_NOW", priority: 40 },
  { key: "fleet.model.lifecycle", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "modelLifecycle", descriptionKey: "modelLifecycleHelp", unit: "state", valueType: "state", valueSemantics: "Persisted model edition lifecycle; only PRODUCTION and CANARY editions are in the current Fleet.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC model family snapshot", drilldown: "models", maturity: "LIVE_NOW", priority: 10 },
  { key: "fleet.model.revision", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "latestRevision", descriptionKey: "latestRevisionHelp", unit: "revision", valueType: "number", valueSemantics: "Highest revision returned for the active model edition; snapshot data, not deployment health.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC model family snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 20 },
  { key: "fleet.model.active-bindings", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "activeBindings", descriptionKey: "activeBindingsHelp", unit: "bindings", valueType: "number", valueSemantics: "Persisted bindings whose status is ACTIVE; not a runtime resolution check.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC model family snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 30 },
  { key: "fleet.model.visibility", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "visibleApplications", descriptionKey: "visibleApplicationsHelp", unit: "applications", valueType: "number", valueSemantics: "Persisted application visibility relationships for the model edition.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC model family snapshot", drilldown: "models", maturity: "DERIVED_NOW", priority: 40 },
  { key: "fleet.model.latest-execution", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "latestExecution", descriptionKey: "latestExecutionHelp", unit: "state", valueType: "state", valueSemantics: "Latest returned persisted execution whose modelId exactly matches this edition publicId; absence means no matching sample.", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "OIC bounded execution query", drilldown: "traces", maturity: "LIVE_NOW", priority: 50 },
  { key: "providers.definition.connection-count", version: 1, domain: "providers", entityType: "provider-definition", labelKey: "connectionCount", descriptionKey: "connectionCountHelp", unit: "connections", valueType: "number", valueSemantics: "Connections returned for this provider definition in the current snapshot.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC Console snapshot", drilldown: "providers", maturity: "DERIVED_NOW", priority: 5 },
  { key: "providers.definition.health-distribution", version: 1, domain: "providers", entityType: "provider-definition", labelKey: "healthDistribution", descriptionKey: "healthDistributionHelp", unit: "connections", valueType: "distribution", valueSemantics: "Counts grouped by persisted provider health enum, including UNKNOWN.", historySupport: "NONE", visualizationHints: ["DISTRIBUTION"], sourceOwnership: "OIC provider connection snapshot", drilldown: "providers", maturity: "DERIVED_NOW", priority: 15 },
  { key: "lab.execution.status-distribution", version: 1, domain: "lab", entityType: "execution-sample", labelKey: "executionOutcomes", descriptionKey: "executionOutcomesHelp", unit: "runs", valueType: "distribution", valueSemantics: "Status counts within the latest bounded execution response only.", historySupport: "NONE", visualizationHints: ["DISTRIBUTION"], sourceOwnership: "OIC intelligence executions query (up to 50 records)", drilldown: "traces", maturity: "DERIVED_NOW", priority: 10 },
  { key: "cognitive.execution.provider-calls", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "providerCalls", descriptionKey: "providerCallsHelp", unit: "calls", valueType: "number", valueSemantics: "Sum of persisted providerCallCount over the bounded execution sample; not a rate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence executions query", drilldown: "traces", maturity: "DERIVED_NOW", priority: 10 },
  { key: "cognitive.execution.retrieval-queries", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "retrievalQueries", descriptionKey: "retrievalQueriesHelp", unit: "queries", valueType: "number", valueSemantics: "Sum of persisted retrievalQueryCount over the bounded execution sample; not a rate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence executions query", drilldown: "traces", maturity: "DERIVED_NOW", priority: 20 },
  { key: "cognitive.execution.memory-lookups", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "memoryLookups", descriptionKey: "memoryLookupsHelp", unit: "lookups", valueType: "number", valueSemantics: "Sum of persisted memoryLookupCount over the bounded execution sample; not a rate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence executions query", drilldown: "traces", maturity: "DERIVED_NOW", priority: 30 },
  { key: "cognitive.execution.tools", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "toolsActivity", descriptionKey: "toolsActivityHelp", unit: "calls", valueType: "number", valueSemantics: "A bounded artifact for tool-call totals; the current execution API does not expose this aggregate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence execution schema (not exposed)", drilldown: "traces", maturity: "EXTENSIBLE", priority: 50 },
  { key: "cognitive.execution.verification", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "verificationActivity", descriptionKey: "verificationActivityHelp", unit: "events", valueType: "number", valueSemantics: "A bounded artifact for verification totals; the current execution API does not expose this aggregate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence execution schema (not exposed)", drilldown: "traces", maturity: "EXTENSIBLE", priority: 60 },
  { key: "cognitive.execution.repair", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "repairActivity", descriptionKey: "repairActivityHelp", unit: "events", valueType: "number", valueSemantics: "A bounded artifact for repair totals; the current execution API does not expose this aggregate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence execution schema (not exposed)", drilldown: "traces", maturity: "EXTENSIBLE", priority: 70 },
  { key: "cognitive.execution.backtracking", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "backtrackingActivity", descriptionKey: "backtrackingActivityHelp", unit: "events", valueType: "number", valueSemantics: "A bounded artifact for backtracking totals; the current execution API does not expose this aggregate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence execution schema (not exposed)", drilldown: "traces", maturity: "EXTENSIBLE", priority: 80 },
  { key: "cognitive.execution.stage-count", version: 1, domain: "cognitive", entityType: "execution-sample", labelKey: "executionStages", descriptionKey: "executionStagesHelp", unit: "stages", valueType: "number", valueSemantics: "Sum of persisted stageCount over the bounded execution sample.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC intelligence executions query", drilldown: "traces", maturity: "DERIVED_NOW", priority: 40 },
  { key: "operations.provider-unhealthy", version: 1, domain: "operations", entityType: "operations", labelKey: "unhealthyConnections", descriptionKey: "unhealthyConnectionsHelp", unit: "connections", valueType: "number", valueSemantics: "Count of connections explicitly marked UNHEALTHY by their provider health source; UNKNOWN is separate.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC provider connection snapshot", drilldown: "providers", maturity: "DERIVED_NOW", priority: 10 },
  { key: "operations.provider-unknown", version: 1, domain: "operations", entityType: "operations", labelKey: "unknownConnections", descriptionKey: "unknownConnectionsHelp", unit: "connections", valueType: "number", valueSemantics: "Count of connections with health status UNKNOWN; not treated as healthy or as an alert.", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC provider connection snapshot", drilldown: "providers", maturity: "DERIVED_NOW", priority: 20 },
  { key: "dna.reasoning", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaReasoning", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 10 },
  { key: "dna.retrieval", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaRetrieval", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 20 },
  { key: "dna.evidence", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaEvidence", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 30 },
  { key: "dna.memory", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaMemory", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 40 },
  { key: "dna.verification", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaVerification", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 50 },
  { key: "dna.tools", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaTools", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 60 },
  { key: "dna.search", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaSearch", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 70 },
  { key: "dna.repair", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaRepair", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 80 },
  { key: "dna.reliability", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaReliability", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 90 },
  { key: "dna.efficiency", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaEfficiency", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 100 },
  { key: "dna.latency", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaLatency", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 110 },
  { key: "dna.cost", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaCost", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 120 },
  { key: "dna.stability", version: 1, domain: "fleet", entityType: "model-dna", labelKey: "dnaStability", descriptionKey: "dnaPlannedHelp", unit: "evaluation result", valueType: "number", valueSemantics: "OIC-7 evaluator result with method, cohort and sample; no current value is available.", historySupport: "NONE", visualizationHints: ["DNA", "NUMERIC"], sourceOwnership: "OIC-7 evaluation engine (not configured)", drilldown: null, maturity: "PLANNED", priority: 130 }
];

export class MetricRegistry {
  private readonly definitions = new Map<string, MetricDefinition>();
  constructor(initial: readonly MetricDefinition[] = metricDefinitions) { for (const definition of initial) this.register(definition); }
  register(definition: MetricDefinition) {
    if (!definition.key.trim() || definition.version < 1 || !definition.entityType || !definition.unit || !definition.visualizationHints.length) throw new Error("Invalid metric definition.");
    const current = this.definitions.get(definition.key);
    if (current && current.version >= definition.version) throw new Error(`Metric ${definition.key} requires a newer definition version.`);
    this.definitions.set(definition.key, Object.freeze({ ...definition, visualizationHints: Object.freeze([...definition.visualizationHints]) }));
  }
  get(key: string) { return this.definitions.get(key); }
  list() { return [...this.definitions.values()].sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key)); }
}

const metricStates = new Set<MetricState>(["LIVE", "IDLE", "UNAVAILABLE", "DEGRADED", "FAULT"]);
function validValue(definition: MetricDefinition, value: MetricValue) {
  if (value === null) return true;
  if (definition.valueType === "number") return typeof value === "number" && Number.isFinite(value) && (!definition.normalRange || (value >= definition.normalRange[0] && value <= definition.normalRange[1]));
  if (definition.valueType === "state") return typeof value === "string" && value.length <= 160;
  if (typeof value !== "object" || !Number.isInteger(value.sampleSize) || value.sampleSize < 0 || !Array.isArray(value.categories)) return false;
  return value.categories.every((category) => typeof category.key === "string" && Number.isInteger(category.count) && category.count >= 0 && (!category.state || metricStates.has(category.state)));
}

function baseInstance(input: MetricInput, value: MetricValue, state: MetricState, maturity: MetricMaturity, version: number | null, reason: string | undefined, supported: boolean, observedAt: string | null, freshnessState: MetricInstance["freshness"]["state"], staleAfterMs: number | null): MetricInstance {
  return { metricKey: input.metricKey, definitionVersion: version, domain: input.domain ?? "operations", entityType: input.entityType, ...(input.entityId ? { entityId: input.entityId } : {}), value, unit: input.unit ?? "unknown", state, maturity, source: input.source, freshness: { state: freshnessState, observedAt, agingAfterMs: input.agingAfterMs ?? null, staleAfterMs }, ...(input.sampleSize === undefined ? {} : { sampleSize: input.sampleSize }), ...(input.timeWindow ? { timeWindow: input.timeWindow } : {}), ...(reason ? { reason } : {}), supported };
}

export function normalizeMetric(registry: MetricRegistry, input: MetricInput): MetricInstance {
  const definition = registry.get(input.metricKey);
  if (!definition) return baseInstance(input, null, "UNAVAILABLE", "EXTENSIBLE", null, "METRIC_NOT_REGISTERED", false, null, "UNKNOWN", null);
  const observedAt = input.observedAt ?? null;
  let freshnessState: MetricInstance["freshness"]["state"] = "UNKNOWN";
  if (definition.maturity !== "PLANNED" && (input.staleAfterMs !== undefined || input.agingAfterMs !== undefined) && observedAt) {
    const time = Date.parse(observedAt);
    if (!Number.isFinite(time)) return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "INVALID_SOURCE_TIMESTAMP", true, null, "UNKNOWN", null);
    if ((input.staleAfterMs === undefined || input.staleAfterMs === null || input.staleAfterMs >= 0) && (input.agingAfterMs === undefined || input.agingAfterMs === null || input.agingAfterMs >= 0) && !(input.staleAfterMs != null && input.agingAfterMs != null && input.agingAfterMs >= input.staleAfterMs)) {
      const ageMs = Date.now() - time;
      freshnessState = input.staleAfterMs != null && ageMs > input.staleAfterMs ? "STALE" : input.agingAfterMs != null && ageMs > input.agingAfterMs ? "AGING" : "FRESH";
    }
    else return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "INVALID_FRESHNESS_THRESHOLD", true, observedAt, "UNKNOWN", null);
  }
  if (definition.maturity === "PLANNED") return baseInstance(input, null, "UNAVAILABLE", "PLANNED", definition.version, input.reason ?? "AWAITING_SOURCE", true, null, "UNKNOWN", null);
  if (definition.entityType !== input.entityType) return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "ENTITY_TYPE_MISMATCH", true, observedAt, "UNKNOWN", input.staleAfterMs ?? null);
  if (input.unit && input.unit !== definition.unit) return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "UNIT_MISMATCH", true, observedAt, freshnessState, input.staleAfterMs ?? null);
  if (!input.source.service || !input.source.endpoint || !input.source.scope) return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "SOURCE_PROVENANCE_MISSING", true, observedAt, freshnessState, input.staleAfterMs ?? null);
  if (!validValue(definition, input.value)) return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "INVALID_VALUE", true, observedAt, freshnessState, input.staleAfterMs ?? null);
  const state = freshnessState === "STALE" || freshnessState === "AGING" ? "DEGRADED" : input.state ?? (input.value === null ? "UNAVAILABLE" : "LIVE");
  if (!metricStates.has(state)) return baseInstance(input, null, "FAULT", definition.maturity, definition.version, "INVALID_STATE", true, observedAt, freshnessState, input.staleAfterMs ?? null);
  return baseInstance(input, input.value, state, definition.maturity, definition.version, input.reason, true, observedAt, freshnessState, input.staleAfterMs ?? null);
}

export type EntityLike = { id: string };
export type EntityMetricGroup<T extends EntityLike> = { entity: T; definition: MetricDefinition; instance: MetricInstance; instrumentHint: string };

export function discoverEntityMetricGroups<T extends EntityLike>(entityType: string, entities: readonly T[], registry: MetricRegistry, instances: readonly MetricInstance[]): EntityMetricGroup<T>[] {
  const definitions = registry.list().filter((definition) => definition.entityType === entityType);
  const indexed = new Map(instances.filter((instance) => instance.entityType === entityType && instance.entityId).map((instance) => [`${instance.entityId}\u0000${instance.metricKey}`, instance]));
  return entities.flatMap((entity) => definitions.map((definition) => {
    const instance = indexed.get(`${entity.id}\u0000${definition.key}`) ?? normalizeMetric(registry, { metricKey: definition.key, domain: definition.domain, entityType, entityId: entity.id, value: null, unit: definition.unit, state: "UNAVAILABLE", source: { service: "OIC metric registry", endpoint: "registered metric", scope: "entity" }, reason: "NO_INSTANCE_RETURNED" });
    return { entity, definition, instance, instrumentHint: definition.visualizationHints[0] ?? "UNSUPPORTED" };
  }));
}

export function groupMetricInstances(instances: readonly MetricInstance[], registry: MetricRegistry) {
  return instances.map((instance) => ({ instance, definition: registry.get(instance.metricKey) ?? null, supported: !!registry.get(instance.metricKey) && instance.supported }));
}
