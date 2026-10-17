/* global __dirname */
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  module._compile(compiled, filename);
};

function loadTs(relativePath) {
  const filename = path.resolve(__dirname, "../app/features/overview", relativePath);
  const source = require("node:fs").readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const { buildFlightDeckData, flightDeckMetricRegistry } = loadTs("flight-deck-data.ts");
const model = (id, lifecycle = "PRODUCTION") => ({ id, publicId: id, editionKey: id, displayName: id, lifecycle, revisions: [{ id: `rev-${id}`, revision: 1, variants: [{ variantKey: "primary", providerDefinitionId: "provider-a", bindings: [{ id: `binding-${id}`, status: "ACTIVE" }] }] }], visibility: [] });
const snapshot = (families, providers, connections) => ({ generatedAt: "2026-10-03T12:00:00.000Z", applications: [], tenants: [], principals: [], providers, connections, upstreamModels: [], modelFamilies: families, audit: [] });
const activity = (values = {}) => ({ scope: "OIC_PLATFORM latest bounded execution sample", metrics: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, state: value === null ? "UNAVAILABLE" : "LIVE", sampleSize: 2 }])) });

test("model fleet and provider clusters are discovered from source entities", () => {
  const first = buildFlightDeckData(snapshot([{ id: "family-a", familyKey: "alpha", displayName: "Alpha", lifecycle: "PRODUCTION", editions: [model("alpha-1")] }], [{ id: "provider-a", key: "pa", displayName: "Provider A" }], [{ id: "connection-a", providerDefinitionId: "provider-a", status: "ACTIVE", healthStatus: "UNKNOWN" }]), { status: "ok", checks: { database: "ok" } }, []);
  assert.equal(first.fleet.length, 1);
  assert.equal(first.fleet[0].id, "alpha-1");
  assert.equal(first.providers.length, 1);
  assert.equal(first.providers[0].connections.length, 1);
  assert.equal(first.providers[0].connectionCount, 1);
  const changed = buildFlightDeckData(snapshot([{ id: "family-b", familyKey: "beta", displayName: "Beta", lifecycle: "PRODUCTION", editions: [model("beta-1"), model("beta-2", "CANARY"), model("beta-draft", "DRAFT")] }], [{ id: "provider-b", key: "pb", displayName: "Provider B" }, { id: "provider-c", key: "pc", displayName: "Provider C" }], []), { status: "ok", checks: { database: "ok" } }, []);
  assert.deepEqual(changed.fleet.map((entry) => entry.id), ["beta-1", "beta-2"]);
  assert.deepEqual(changed.providers.map((entry) => entry.id), ["provider-b", "provider-c"]);
  assert.equal(changed.providers[1].connectionCount, 0);
});

test("runtime-eligible edition is shown even when its non-authoritative family container is draft", () => {
  const edition = { id: "edition-deepseek", publicId: "oi-deepseek-flash", editionKey: "default", displayName: "Default", lifecycle: "PRODUCTION", revisions: [{ id: "revision-1", revision: 1, variants: [{ variantKey: "deepseek-primary", providerDefinitionId: "provider-openai-compatible", upstreamModelId: "upstream-deepseek", bindings: [{ id: "binding-1", status: "ACTIVE" }] }] }], visibility: [] };
  const data = snapshot([{ id: "family-deepseek", familyKey: "deepseek-live-canary", displayName: "DeepSeek Live Canary", lifecycle: "DRAFT", editions: [edition] }], [{ id: "provider-openai-compatible", key: "openai-compatible", displayName: "OpenAI-compatible API" }], []);
  data.upstreamModels = [{ id: "upstream-deepseek", upstreamModelId: "deepseek-flash", displayName: "DeepSeek-V4.1-Flash" }];
  const deck = buildFlightDeckData(data, { status: "ok" }, []);
  assert.equal(deck.fleet.length, 1);
  assert.equal(deck.fleet[0].lifecycle, "PRODUCTION");
  assert.equal(deck.fleet[0].variants[0].providerKey, "DeepSeek");
  assert.equal(deck.fleet[0].variants[0].upstreamModelName, "deepseek-flash");
  assert.equal(deck.fleet[0].variants[0].bindings[0].status, "ACTIVE");
  assert.equal(deck.fleet[0].runtimeState, "DEGRADED");
});

test("production model runtime state requires an active binding and healthy associated connection", () => {
  const edition = { ...model("m"), revisions: [{ revision: 1, variants: [{ providerDefinitionId: "provider-a", bindings: [{ status: "ACTIVE", connectionId: "connection-a" }] }] }] };
  const data = snapshot([{ familyKey: "model", editions: [edition] }], [{ id: "provider-a", key: "provider", displayName: "Provider" }], [{ id: "connection-a", status: "ACTIVE", healthStatus: "HEALTHY" }]);
  assert.equal(buildFlightDeckData(data, { status: "ok" }, []).fleet[0].runtimeState, "LIVE");
  data.connections[0].healthStatus = "UNHEALTHY";
  assert.equal(buildFlightDeckData(data, { status: "ok" }, []).fleet[0].runtimeState, "FAULT");
  data.connections = [];
  assert.equal(buildFlightDeckData(data, { status: "ok" }, []).fleet[0].runtimeState, "DEGRADED");
});

test("Overview provider fault and unknown counters ignore archived connection history", () => {
  const data = snapshot([], [{ id: "provider-a", key: "provider-a", displayName: "Provider A" }], [
    { id: "active", providerDefinitionId: "provider-a", status: "ACTIVE", healthStatus: "HEALTHY" },
    { id: "archived-unknown", providerDefinitionId: "provider-a", status: "ARCHIVED", healthStatus: "UNKNOWN" },
    { id: "archived-fault", providerDefinitionId: "provider-a", status: "ARCHIVED", healthStatus: "UNHEALTHY" }
  ]);
  const deck = buildFlightDeckData(data, { status: "ok" }, []);
  assert.equal(deck.instances.find((item) => item.metricKey === "operations.provider-unhealthy").value, 0);
  assert.equal(deck.instances.find((item) => item.metricKey === "operations.provider-unknown").value, 0);
});

test("Overview health maps the canonical BFF readiness envelope to API and database state", () => {
  const readyEnvelope = { ready: { sourceState: "AVAILABLE", httpStatus: 200, body: { status: "ok", checks: { database: "ok" } } } };
  const deck = buildFlightDeckData(snapshot([], [], []), readyEnvelope, []);
  const metric = (key) => deck.instances.find((item) => item.metricKey === key);
  assert.equal(metric("system.api.live").value, "LIVE");
  assert.equal(metric("system.api.live").state, "LIVE");
  assert.equal(metric("system.database.ready").value, "READY");
  assert.equal(metric("system.database.ready").state, "LIVE");

  const failedEnvelope = { ready: { sourceState: "AVAILABLE", httpStatus: 503, body: { status: "ok", checks: { database: "ok" } } } };
  const failed = buildFlightDeckData(snapshot([], [], []), failedEnvelope, []);
  assert.equal(failed.instances.find((item) => item.metricKey === "system.api.live").value, "UNAVAILABLE");
  assert.equal(failed.instances.find((item) => item.metricKey === "system.database.ready").value, "UNAVAILABLE");
});

test("bounded execution aggregates disclose sample size and preserve missing data", () => {
  const projection = activity({ providerCalls: 2, retrievalQueries: 1, memoryLookups: 3, stages: 4, toolCalls: 0, verificationRounds: 0, repairRounds: 0, backtracks: 0 });
  Object.values(projection.metrics).forEach((item) => { item.sampleSize = 1; });
  const deck = buildFlightDeckData(snapshot([], [], []), { status: "ok", checks: { database: "ok" } }, [{ traceId: "t-1", status: "COMPLETED" }], projection);
  const metric = (key) => deck.instances.find((item) => item.metricKey === key);
  assert.equal(metric("cognitive.execution.provider-calls").value, 2);
  assert.equal(metric("cognitive.execution.provider-calls").sampleSize, 1);
  assert.equal(metric("cognitive.execution.retrieval-queries").value, 1);
  assert.equal(metric("cognitive.execution.memory-lookups").value, 3);
  assert.equal(metric("cognitive.execution.stage-count").value, 4);
  for (const key of ["tools", "verification", "repair", "backtracking"]) {
    const dormant = metric(`cognitive.execution.${key}`);
    assert.equal(dormant.value, 0);
    assert.equal(dormant.reason, undefined);
  }

  const empty = buildFlightDeckData(snapshot([], [], []), null, []);
  assert.equal(empty.instances.find((item) => item.metricKey === "cognitive.execution.provider-calls").value, null);
  assert.equal(empty.instances.find((item) => item.metricKey === "system.applications.count").value, 0);
});

test("bounded aggregates never coerce absent per-run counters to zero", () => {
  const partial = buildFlightDeckData(snapshot([], [], []), { status: "ok" }, [{ traceId: "t-1", status: "COMPLETED" }, { traceId: "t-2", status: "COMPLETED" }], activity({ providerCalls: null, retrievalQueries: null, memoryLookups: null, stages: null }));
  const metric = (key) => partial.instances.find((item) => item.metricKey === key);
  assert.equal(metric("cognitive.execution.provider-calls").value, null);
  assert.equal(metric("cognitive.execution.provider-calls").reason, "SOURCE_FIELD_MISSING_IN_BOUNDED_ACTIVITY_PROJECTION");
  assert.equal(metric("cognitive.execution.retrieval-queries").value, null);
  assert.equal(metric("cognitive.execution.memory-lookups").value, null);
  assert.equal(metric("cognitive.execution.stage-count").value, null);

  const explicitZero = buildFlightDeckData(snapshot([], [], []), { status: "ok" }, [{ traceId: "t-1" }], activity({ providerCalls: 0, retrievalQueries: 0, memoryLookups: 0, stages: 0 }));
  assert.equal(explicitZero.instances.find((item) => item.metricKey === "cognitive.execution.provider-calls").value, 0);
});

test("Overview queue and active-run gauges use scoped canonical evaluation counts", () => {
  const queue = { queuedWorkItems: 0, leasedWorkItems: 2, activeRuns: 1, observedAt: "2026-10-17T10:00:00.000Z", scope: "OIC_PLATFORM" };
  const deck = buildFlightDeckData(snapshot([], [], []), { status: "ok" }, [], null, queue);
  const pending = deck.instances.find((item) => item.metricKey === "operations.queue-pending");
  assert.equal(pending.value, 0);
  assert.equal(pending.state, "LIVE");
  assert.equal(pending.freshness.observedAt, queue.observedAt);
  const activeRuns = require("../app/features/overview/core-vital-registry.ts").productionCoreVitalSignals(queue.activeRuns).find((item) => item.id === "vital.active-runs");
  assert.equal(activeRuns.value, 1);
  assert.equal(activeRuns.state, "LIVE");
  const zeroActiveRuns = require("../app/features/overview/core-vital-registry.ts").productionCoreVitalSignals(0, new Set(["vital.queue-pressure", "vital.provider-pressure", "vital.reasoning-pressure", "vital.context-saturation"]));
  assert.equal(zeroActiveRuns.find((item) => item.id === "vital.active-runs").value, 0);
  assert.equal(zeroActiveRuns.find((item) => item.id === "vital.active-runs").state, "LIVE", "zero current runs is a measured live value");
  assert.match(zeroActiveRuns.find((item) => item.id === "vital.queue-pressure").stateLabel, /RAW SOURCE LIVE/);
  assert.match(zeroActiveRuns.find((item) => item.id === "vital.provider-pressure").stateLabel, /PRESSURE UNMEASURED/);
  assert.match(zeroActiveRuns.find((item) => item.id === "vital.token-throughput").stateLabel, /RAW TOKENS AVAILABLE/);
  const unavailable = buildFlightDeckData(snapshot([], [], []), { status: "ok" }, [], null, null).instances.find((item) => item.metricKey === "operations.queue-pending");
  assert.equal(unavailable.value, null);
  assert.equal(unavailable.state, "UNAVAILABLE");
});

test("new registered edition and provider metrics join entity groups automatically", () => {
  for (const definition of [
    { key: "fleet.model.future-capacity", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "future", descriptionKey: "futureHelp", unit: "units", valueType: "number", valueSemantics: "Future source metric", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "future OIC source", drilldown: "models", maturity: "LIVE_NOW", priority: 999 },
    { key: "providers.definition.future-state", version: 1, domain: "providers", entityType: "provider-definition", labelKey: "future", descriptionKey: "futureHelp", unit: "state", valueType: "state", valueSemantics: "Future source state", historySupport: "NONE", visualizationHints: ["STATUS"], sourceOwnership: "future OIC source", drilldown: "providers", maturity: "LIVE_NOW", priority: 999 }
  ]) flightDeckMetricRegistry.register(definition);
  const deck = buildFlightDeckData(snapshot([{ id: "family", familyKey: "model", lifecycle: "PRODUCTION", editions: [model("edition")] }], [{ id: "provider", key: "provider", displayName: "Provider" }], []), { status: "ok" }, []);
  assert.equal(deck.fleet[0].metrics.find((item) => item.metricKey === "fleet.model.future-capacity").reason, "NO_SOURCE_ADAPTER");
  assert.equal(deck.providers[0].metrics.find((item) => item.metricKey === "providers.definition.future-state").reason, "NO_SOURCE_ADAPTER");
});
