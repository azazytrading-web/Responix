/* global __dirname */
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

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

const { MetricRegistry, discoverEntityMetricGroups, metricDefinitions, normalizeMetric } = loadTs("metric-registry.ts");
const { InstrumentRegistry, resolveInstrument } = loadTs("instrument-registry.ts");
const source = { service: "OIC API", endpoint: "/api/v1/admin/console/snapshot", scope: "authorized console snapshot" };
const definition = (overrides = {}) => ({ key: "test.dynamic.value", version: 1, domain: "fleet", entityType: "model-edition", labelKey: "test", descriptionKey: "testHelp", unit: "records", valueType: "number", valueSemantics: "A source count", historySupport: "NONE", visualizationHints: ["NUMERIC"], sourceOwnership: "OIC test source", drilldown: "models", maturity: "DERIVED_NOW", priority: 1, ...overrides });

test("Metric Registry accepts new versioned definitions and dynamic entity groups", () => {
  const registry = new MetricRegistry([]);
  registry.register(definition());
  assert.throws(() => registry.register(definition()), /newer definition version/);
  registry.register(definition({ version: 2, labelKey: "testV2" }));
  const entities = Array.from({ length: 50 }, (_, index) => ({ id: `edition-${index}` }));
  const instances = entities.map((entity) => normalizeMetric(registry, { metricKey: "test.dynamic.value", entityType: "model-edition", entityId: entity.id, value: 0, unit: "records", source }));
  const groups = discoverEntityMetricGroups("model-edition", entities, registry, instances);
  assert.equal(groups.length, 50);
  assert.deepEqual(groups.slice(0, 2).map((group) => group.entity.id), ["edition-0", "edition-1"]);
  assert.equal(groups[0].instance.value, 0);
  assert.equal(groups[0].definition.version, 2);
});

test("zero, unavailable, stale, invalid and planned observations keep distinct meanings", () => {
  const registry = new MetricRegistry([definition()]);
  const zero = normalizeMetric(registry, { metricKey: "test.dynamic.value", entityType: "model-edition", value: 0, unit: "records", source, observedAt: new Date().toISOString() });
  const absent = normalizeMetric(registry, { metricKey: "test.dynamic.value", entityType: "model-edition", value: null, unit: "records", source });
  const stale = normalizeMetric(registry, { metricKey: "test.dynamic.value", entityType: "model-edition", value: 4, unit: "records", source, observedAt: "2020-01-01T00:00:00.000Z", staleAfterMs: 1000 });
  const aging = normalizeMetric(registry, { metricKey: "test.dynamic.value", entityType: "model-edition", value: 4, unit: "records", source, observedAt: new Date(Date.now() - 5 * 86400000).toISOString(), agingAfterMs: 86400000, staleAfterMs: 10 * 86400000 });
  const mismatch = normalizeMetric(registry, { metricKey: "test.dynamic.value", entityType: "model-edition", value: 4, unit: "other", source });
  const plannedRegistry = new MetricRegistry([definition({ key: "test.planned", maturity: "PLANNED" })]);
  const planned = normalizeMetric(plannedRegistry, { metricKey: "test.planned", entityType: "model-edition", value: 99, unit: "records", source });
  assert.equal(zero.state, "LIVE");
  assert.equal(zero.value, 0);
  assert.equal(absent.state, "UNAVAILABLE");
  assert.equal(absent.value, null);
  assert.equal(stale.state, "DEGRADED");
  assert.equal(stale.freshness.state, "STALE");
  assert.equal(aging.freshness.state, "AGING");
  assert.equal(aging.state, "DEGRADED");
  assert.equal(mismatch.state, "FAULT");
  assert.equal(mismatch.value, null);
  assert.equal(planned.maturity, "PLANNED");
  assert.equal(planned.state, "UNAVAILABLE");
  assert.equal(planned.value, null);
});

test("unregistered metrics fail safe without inventing values", () => {
  const result = normalizeMetric(new MetricRegistry([]), { metricKey: "future.unknown", domain: "lab", entityType: "execution", entityId: "trace-safe-id", value: 17, source });
  assert.equal(result.supported, false);
  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(result.value, null);
  assert.equal(result.reason, "METRIC_NOT_REGISTERED");
});

test("Instrument Registry resolves renderer families and falls back for unknown hints", () => {
  const registry = new InstrumentRegistry();
  const numeric = definition({ visualizationHints: ["NUMERIC"] });
  const unsupported = definition({ visualizationHints: ["FUTURE_WAVE"] });
  assert.equal(resolveInstrument(numeric, registry, "number").renderer.key, "NUMERIC");
  assert.equal(resolveInstrument(unsupported, registry, "number").fallback, "UNSUPPORTED_INSTRUMENT");
  registry.register({ key: "FUTURE_WAVE", family: "future-wave", accessibleFallback: "TEXT_VALUE", accepts: ["number"], description: "Future renderer registered by feature owner." });
  assert.equal(resolveInstrument(unsupported, registry, "number").renderer.key, "FUTURE_WAVE");
  assert.equal(resolveInstrument(numeric, registry, "state").fallback, "VALUE_TYPE_MISMATCH");
});

test("DNA catalog stays unmeasured and its controls can never become quality scores", () => {
  const registry = new MetricRegistry(metricDefinitions.filter((entry) => entry.key.startsWith("dna.")));
  const dimensions = registry.list().map((entry) => normalizeMetric(registry, { metricKey: entry.key, entityType: "model-dna", entityId: "model-rev-1", value: 100, unit: entry.unit, source }));
  assert.ok(dimensions.length >= 10);
  assert.ok(dimensions.every((entry) => entry.maturity === "PLANNED" && entry.state === "UNAVAILABLE" && entry.value === null));
});

test("unknown future metric remains grouped under its registered owner domain", () => {
  const registry = new MetricRegistry([]);
  registry.register(definition({ key: "lab.future.duration", domain: "lab", entityType: "execution", unit: "ms", valueSemantics: "Persisted elapsed duration", priority: 900 }));
  const trace = { id: "trace-new" };
  const instance = normalizeMetric(registry, { metricKey: "lab.future.duration", entityType: "execution", entityId: trace.id, value: 120, unit: "ms", source });
  const groups = discoverEntityMetricGroups("execution", [trace], registry, [instance]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].definition.domain, "lab");
  assert.equal(groups[0].instance.value, 120);
});
