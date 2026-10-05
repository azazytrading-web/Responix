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

test("bounded execution aggregates disclose sample size and preserve missing data", () => {
  const deck = buildFlightDeckData(snapshot([], [], []), { status: "ok", checks: { database: "ok" } }, [{ traceId: "t-1", status: "COMPLETED", providerCallCount: 2, retrievalQueryCount: 1, memoryLookupCount: 3, stageCount: 4 }]);
  const metric = (key) => deck.instances.find((item) => item.metricKey === key);
  assert.equal(metric("cognitive.execution.provider-calls").value, 2);
  assert.equal(metric("cognitive.execution.provider-calls").sampleSize, 1);
  assert.equal(metric("cognitive.execution.retrieval-queries").value, 1);
  assert.equal(metric("cognitive.execution.memory-lookups").value, 3);
  assert.equal(metric("cognitive.execution.stage-count").value, 4);
  for (const key of ["tools", "verification", "repair", "backtracking"]) {
    const dormant = metric(`cognitive.execution.${key}`);
    assert.equal(dormant.value, null);
    assert.equal(dormant.reason, "NO_SOURCE_ADAPTER");
  }

  const empty = buildFlightDeckData(snapshot([], [], []), null, []);
  assert.equal(empty.instances.find((item) => item.metricKey === "cognitive.execution.provider-calls").value, null);
  assert.equal(empty.instances.find((item) => item.metricKey === "system.applications.count").value, 0);
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
