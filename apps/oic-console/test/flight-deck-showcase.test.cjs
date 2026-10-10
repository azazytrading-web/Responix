/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadFixture() {
  return loadTypeScript(path.resolve(__dirname, "../app/dev/flight-deck/demo-data.ts")).createShowcaseFixture;
}

function loadTypeScript(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (request) => {
    const tsCandidate = path.resolve(path.dirname(filename), request + ".ts");
    const resolved = fs.existsSync(tsCandidate) ? tsCandidate : Module._resolveFilename(request, loaded);
    return resolved.endsWith(".ts") ? loadTypeScript(resolved) : originalRequire(request);
  };
  loaded._compile(compiled, filename);
  return loaded.exports;
}

test("showcase fixtures cover each scenario without using live or production data paths", () => {
  const create = loadFixture();
  const nominal = create("NOMINAL");
  assert.equal(nominal.snapshot.modelFamilies.length, 3);
  assert.equal(nominal.snapshot.providers.length, 3);
  assert.equal(nominal.snapshot.connections.length, 5);
  assert.equal(nominal.executions.length, 3);
  assert.equal(nominal.health.status, "ok");
  assert.equal(nominal.snapshot.providers[2].status, "UNKNOWN");
  assert.equal(nominal.overview.models["demo-edition-1"].state, "HEALTHY");
  assert.equal(nominal.overview.models["demo-edition-2"].state, "DEGRADED");
  assert.equal(nominal.overview.models["demo-edition-3"].state, "DEGRADED");
  assert.equal(nominal.overview.models["demo-edition-1"].dna.filter((dimension) => dimension.state === "MEASURED").length, 13);
  assert.ok(nominal.overview.models["demo-edition-2"].dna.some((dimension) => dimension.state === "INSUFFICIENT_DATA"));
  assert.ok(nominal.overview.system.some((signal) => signal.scale?.polarity === "HIGH_IS_BAD"));
  assert.ok(nominal.overview.system.some((signal) => signal.scale?.polarity === "HIGH_IS_GOOD"));
  assert.ok(nominal.overview.system.some((signal) => signal.scale?.polarity === "TARGET_RANGE"));
  assert.ok(nominal.overview.system.some((signal) => signal.kind === "pressure"));
  assert.ok(nominal.overview.system.some((signal) => signal.kind === "rail"));
  assert.deepEqual(nominal.overview.system.filter((signal) => signal.kind === "rail").map((signal) => [signal.value, signal.min, signal.max]), [[38, 0, 100], [46, 0, 100]], "bounded demo rails expose numeric values with their explicit scale");
  assert.ok(nominal.overview.system.some((signal) => signal.kind === "distribution"));
  assert.equal(nominal.overview.cognitive.length, 8);
  assert.equal(nominal.overview.operations.length, 5);
  assert.equal(nominal.overview.vitals.length, 15, "the full core vital registry is installed in the demo rack");
  assert.ok(nominal.overview.vitals.every((signal) => signal.value !== null && signal.state !== "UNMEASURED"), "nominal core vitals are powered by isolated showcase values");
  assert.ok(nominal.overview.system.every((signal) => signal.value !== null && signal.value !== undefined && signal.state !== "UNMEASURED"), "nominal core instruments are powered");
  assert.ok(nominal.overview.cognitive.every((signal) => signal.value !== null && signal.value !== undefined && signal.state !== "UNMEASURED"), "nominal cognitive rack is powered");
  assert.ok(nominal.overview.operations.every((signal) => signal.value !== null && signal.value !== undefined && signal.state !== "UNMEASURED"), "nominal operations rack is powered");

  const degraded = create("DEGRADED");
  assert.ok(degraded.snapshot.connections.some((connection) => connection.healthStatus === "DEGRADED"));
  assert.ok(degraded.executions.some((run) => run.status === "FAILED"));
  assert.equal(degraded.overview.factory.warningStage, "runtime-bindings");
  assert.ok(degraded.overview.providers["demo-provider-compatible"].load > nominal.overview.providers["demo-provider-compatible"].load);
  const critical = create("CRITICAL");
  assert.equal(critical.health.status, "unavailable");
  assert.ok(critical.snapshot.connections.every((connection) => ["UNHEALTHY", "UNKNOWN"].includes(connection.healthStatus)));
  assert.equal(critical.overview.models["demo-edition-1"].state, "FAULT");
  assert.equal(critical.overview.lab.verification, 29);
  const mixed = create("MIXED");
  assert.ok(mixed.snapshot.connections.some((connection) => connection.healthStatus === "HEALTHY"));
  assert.ok(mixed.snapshot.connections.some((connection) => connection.healthStatus === "UNHEALTHY"));
  const dormant = create("DORMANT");
  assert.equal(dormant.health.status, "ok", "readiness remains available in the dormant telemetry scenario");
  assert.equal(dormant.snapshot.modelFamilies.length, 0);
  assert.equal(dormant.snapshot.providers.length, 3, "provider definitions remain mounted without connections");
  assert.equal(dormant.snapshot.connections.length, 0);
  assert.equal(dormant.executions.length, 0);
  assert.equal(Object.keys(dormant.overview.models).length, 0);
  assert.ok(dormant.overview.system.every((signal) => signal.value === null && signal.state === "UNMEASURED"));
  assert.equal(dormant.overview.vitals.length, 15, "dormancy retains every core vital slot");
  assert.ok(dormant.overview.vitals.every((signal) => signal.value === null && signal.state === "UNMEASURED"), "dormant vitals contain no demo readings");
  assert.ok(dormant.overview.cognitive.every((signal) => signal.value === null && signal.state === "UNMEASURED"));
  assert.deepEqual(dormant.overview.operations.map((signal) => signal.state), ["LIVE", "LIVE", "UNMEASURED", "LIVE", "UNMEASURED"], "dormant Operations retains a partial readiness and audit feed");
  assert.equal(dormant.overview.cognitive.length, nominal.overview.cognitive.length, "dormant state retains all eight cognitive slots");
  assert.equal(dormant.overview.operations.length, nominal.overview.operations.length, "dormant state retains all five operations slots");
  assert.equal(dormant.overview.lab.samples.length, 0, "dormant lab has no synthetic history samples");
  assert.equal(dormant.snapshot.providers.length, 3, "dormant provider definitions remain visible without connection rows");
});

test("Core Vital registry defines all 15 stable production contracts without synthetic readings", () => {
  const app = path.resolve(__dirname, "../app");
  const { coreVitalRegistry, productionCoreVitalSignals } = loadTypeScript(path.join(app, "features/overview/core-vital-registry.ts"));
  const registry = coreVitalRegistry;
  assert.equal(registry.length, 15);
  assert.equal(new Set(registry.map((item) => item.id)).size, 15);
  for (const field of ["label", "shortLabel", "labelAr", "description", "descriptionAr", "category", "instrument", "unit", "polarity", "thresholdContract", "sourceAdapter", "sourceState", "freshness", "maturity", "futureCapability"]) {
    assert.ok(registry.every((item) => item[field] !== undefined && item[field] !== ""), `registry covers ${field}`);
  }
  const production = productionCoreVitalSignals();
  assert.equal(production.length, 15);
  assert.ok(production.every((signal) => signal.value === null && signal.state === "UNMEASURED"), "production signals stay dormant instead of getting inferred or demo values");
  assert.ok(production.some((signal) => signal.stateLabel === "PLANNED"), "future metrics expose their planned source maturity");
  assert.ok(registry.some((item) => item.polarity === "HIGH_IS_BAD"));
  assert.ok(registry.some((item) => item.polarity === "HIGH_IS_GOOD"));
  assert.ok(registry.some((item) => item.instrument === "pressure"));
  assert.ok(registry.some((item) => item.instrument === "radial"));
  assert.ok(registry.some((item) => item.instrument === "arc"));
  assert.ok(registry.some((item) => item.instrument === "rail"));
  assert.ok(registry.filter((item) => item.phase === "PRIMARY").length >= 3);
  assert.equal(registry.filter((item) => item.phase === "THROUGHPUT").length, 4, "cache/reuse is a fourth throughput activity signal");
  assert.ok(registry.every((item) => /[\u0600-\u06ff]/u.test(item.labelAr)), "new operator facing metric labels use native Arabic");
});

test("Core Vitals use fixed registry slots and motion stays development-only and reduced-motion aware", () => {
  const app = path.resolve(__dirname, "../app");
  const overview = fs.readFileSync(path.join(app, "features/overview/overview-view.tsx"), "utf8");
  const registry = fs.readFileSync(path.join(app, "features/overview/core-vital-registry.ts"), "utf8");
  const fixture = fs.readFileSync(path.join(app, "dev/flight-deck/demo-data.ts"), "utf8");
  const production = fs.readFileSync(path.join(app, "console-app.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(app, "styles.css"), "utf8");
  assert.match(overview, /coreVitalRegistry\.filter\(\(item\) => item\.phase === "PRIMARY"\)/);
  assert.match(overview, /coreVitalRegistry\.filter\(\(item\) => item\.phase === "SECONDARY"\)/);
  assert.match(overview, /coreVitalRegistry\.filter\(\(item\) => item\.phase === "THROUGHPUT"\)/);
  assert.match(overview, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(overview, /window\.setInterval\([\s\S]{0,120}1000\)/);
  assert.match(overview, /Math\.sin\(time \/ 2\.7 \+ phase\)/);
  assert.doesNotMatch(production, /coreVitalRegistry|productionCoreVitalSignals|demo-data|showcase=/);
  assert.match(fixture, /vitals: coreVitalSignals\(scenario\)/);
  assert.match(registry, /sourceState: "PLANNED" \| "UNMEASURED"/);
  assert.match(styles, /\.fd-board\{grid-template-columns:repeat\(12,minmax\(0,1fr\)\);grid-template-rows:minmax\(360px,auto\)/);
  assert.match(styles, /\.fd-vitals-rack\{grid-template-rows:106px minmax\(132px,1fr\) 64px/);
  assert.match(styles, /\.fd-vitals-secondary\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-template-rows:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(styles, /body\s*\{[^}]*overflow-x\s*:\s*hidden/);
});

test("active and dormant overview values share fixed instrument hosts and bay structure", () => {
  const root = path.resolve(__dirname, "../app");
  const overview = fs.readFileSync(path.join(root, "features/overview/overview-view.tsx"), "utf8");
  const composition = fs.readFileSync(path.join(root, "features/overview/flight-deck-composition.tsx"), "utf8");
  const renderers = fs.readFileSync(path.join(root, "features/overview/instrument-renderers.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(composition, /export function StableInstrumentCell/);
  assert.match(composition, /fd-stable-instrument-label/);
  assert.match(composition, /fd-stable-instrument-geometry/);
  assert.match(composition, /fd-stable-instrument-state/);
  assert.match(composition, /signal\.state === "LIVE" \? fullStateLabel : "--"/);
  assert.match(renderers, /<StableInstrumentCell label=\{label\} state=\{stableState\}/);
  assert.match(renderers, /value === null \? "--" : t\(instance\.state, instance\.state\)/);
  assert.match(overview, /const cognitiveKeys = \[.*provider-calls.*retrieval-queries.*memory-lookups.*tools.*verification.*repair.*backtracking.*stage-count/s);
  assert.match(overview, /cognitiveMetrics\.map\(\(metric\) => showMetric/);
  assert.match(overview, /"FAMILIES", "EDITIONS", "REVISIONS", "VARIANTS", "BINDINGS", "VISIBILITY"/);
  assert.match(overview, /fd-standby-counts/);
  assert.match(overview, /<DNARadar/);
  const productionLab = overview.slice(overview.indexOf("function LabRack"), overview.indexOf("function EventList"));
  assert.equal((productionLab.match(/<RadialGauge value=\{undefined\}/g) || []).length, 2, "production Lab keeps dormant Evaluation and Verification gauges mounted");
  assert.match(productionLab, /Retained telemetry/);
  assert.match(styles, /\.fd-stable-instrument-cell\{display:grid;grid-template-rows:12px minmax\(0,1fr\) 10px/);
  assert.match(styles, /\.fd-core-rack\{height:auto;min-height:420px;max-height:none;overflow:visible\}/, "the real rack grows to contain dormant instrument geometry");
  assert.match(styles, /\.fd-vitals-secondary\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\);grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/, "eight subsystem pressures occupy a balanced 4-by-2 group");
  assert.match(styles, /\.fd-vitals-secondary\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-rows:repeat\(4,minmax\(0,1fr\)\)\}/, "narrow Core Vitals retain all eight subsystem slots");
  assert.match(overview, /state === "UNMEASURED" \|\| state === "UNAVAILABLE" \? "--" : signal\.stateLabel/, "dormant numeric instruments use a compact value placeholder and keep state in the slot label");
  assert.match(styles, /\.fd-model-pod-machine\{display:grid;grid-template-columns:minmax\(68px.*minmax\(54px.*minmax\(94px/s);
  assert.match(styles, /\.fd-factory \.oii-stage-control>span:last-child/);
  assert.match(styles, /\.fd-cognitive>\.fd-sensor-rack,.fd-cognitive>\.fd-cognitive-live\{display:grid;grid-template-columns:repeat\(8,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.fd-board\{[^}]*grid-template-rows:minmax\(228px,auto\) minmax\(238px,auto\) minmax\(190px,auto\) minmax\(176px,auto\)/, "dormant data cannot collapse the four stable board rows");
  assert.match(styles, /\.fd-operations\{grid-template-rows:24px minmax\(80px,auto\) minmax\(0,1fr\)\}/, "Operations reserves a full instrument row before its event list");
  assert.match(styles, /\.fd-operations-strip\{min-height:80px\}/, "Operations gauges retain enough space for their full radial geometry");
  assert.doesNotMatch(styles, /body\s*\{[^}]*overflow-x\s*:\s*hidden/);
});

test("showcase route is development-gated and its Arabic labels contain native text", () => {
  const root = path.resolve(__dirname, "../app/dev/flight-deck");
  const page = fs.readFileSync(path.join(root, "page.tsx"), "utf8");
  const showcase = fs.readFileSync(path.join(root, "showcase.tsx"), "utf8");
  const overview = fs.readFileSync(path.resolve(__dirname, "../app/features/overview/overview-view.tsx"), "utf8");
  const fixtures = fs.readFileSync(path.join(root, "demo-data.ts"), "utf8");
  const production = fs.readFileSync(path.resolve(__dirname, "../app/console-app.tsx"), "utf8");
  const styles = fs.readFileSync(path.resolve(__dirname, "../app/styles.css"), "utf8");
  assert.match(page, /process\.env\.NODE_ENV !== "development"\) notFound\(\)/);
  assert.doesNotMatch(showcase, /fetch\s*\(|\/api\/v1\/|DATABASE_URL|<iframe\b/);
  assert.match(showcase, /<OverviewView\b/);
  assert.match(showcase, /createShowcaseFixture\(scenario\)/);
  assert.match(overview, /showcase\?\.models/);
  assert.match(overview, /signals=\{showcase\?\.system\}/);
  const composition = fs.readFileSync(path.resolve(__dirname, "../app/features/overview/flight-deck-composition.tsx"), "utf8");
  assert.match(composition, /data-layout="12-column-responsive"/);
  assert.match(styles, /\.fd-board\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)[^}]*grid-template-areas:/);
  for (const [className, area] of [["system-state", "state"], ["intelligence", "intelligence"], ["resource", "resource"], ["fleet", "fleet"], ["fleet-dna", "dna"], ["provider", "provider"], ["factory", "factory"], ["lab", "lab"], ["cognitive", "cognitive"], ["operations", "operations"]]) {
    assert.ok(styles.includes(`.fd-${className}{grid-area:${area}}`), `12-column board assigns the ${area} bay`);
  }
  assert.match(styles, /@container flightdeck-preview \(max-width:640px\)/);
  const bays = ["fd-core-rack", "fd-core-zone fd-system-state", "fd-core-zone fd-intelligence", "fd-core-zone fd-resource", "fd-fleet", "fd-fleet-dna", "fd-provider", "fd-factory", "fd-lab", "fd-cognitive", "fd-operations"];
  let previousBay = -1;
  for (const bay of bays) {
    const index = overview.indexOf(`className="${bay}"`);
    assert.ok(index > previousBay, `direct Flight Deck bay order includes ${bay}`);
    previousBay = index;
  }
  assert.doesNotMatch(overview, /<SubsystemDeck\b|fd-model-pod-dna|fd-model-pod-facts/);
  assert.match(overview, /fd-dna-selectors/);
  assert.doesNotMatch(production, /dev\/flight-deck|demo-data|showcase=/);
  for (const caution of ["DEVELOPMENT REFERENCE", "DEMO VALUES ONLY", "NOT LIVE OIC TELEMETRY"]) assert.ok(showcase.includes(caution), `visible demo boundary: ${caution}`);
  assert.match(showcase, /[\u0600-\u06ff]/u);
  assert.match(fixtures, /[\u0600-\u06ff]/u);
  assert.doesNotMatch(showcase, /[\u00c3\u00c2\u00d8\u00d9\ufffd]/u);
  assert.doesNotMatch(fixtures, /[\u00c3\u00c2\u00d8\u00d9\ufffd]/u);
  assert.doesNotMatch(overview, /[\u00c3\u00c2\u00d8\u00d9\ufffd]/u);
});

test("Hero Core Load is truthful in production and weighted demo-only in the showcase", () => {
  const app = path.resolve(__dirname, "../app");
  const { buildDemoCoreLoad, buildProductionCoreLoad, coreLoadBand, energyDrawContract, coreLoadContributorRegistry } = loadTypeScript(path.join(app, "features/overview/core-load-registry.ts"));
  const create = loadFixture();
  const nominal = create("NOMINAL");
  const production = buildProductionCoreLoad();
  const demo = buildDemoCoreLoad(nominal.overview.vitals, nominal.overview.coreLoadEnergyDraw);
  const dormant = create("DORMANT");
  const dormantLoad = buildDemoCoreLoad(dormant.overview.vitals, dormant.overview.coreLoadEnergyDraw);
  assert.equal(coreLoadContributorRegistry.length, 12);
  assert.ok(coreLoadContributorRegistry.every((item) => /[\u0600-\u06ff]/u.test(item.labelAr)), "every contributor has native Arabic copy");
  assert.ok(coreLoadContributorRegistry.every((item) => item.productionWeight === undefined), "production has no invented weights");
  assert.deepEqual(energyDrawContract.supportedUnits, ["W", "kW", "Wh", "kWh"]);
  assert.equal(energyDrawContract.productionWeight, undefined);
  assert.match(energyDrawContract.thresholdContract, /Never infer from tokens or provider cost/);
  assert.deepEqual([coreLoadBand(19), coreLoadBand(20), coreLoadBand(54), coreLoadBand(55), coreLoadBand(69), coreLoadBand(70), coreLoadBand(84), coreLoadBand(85)], ["LOW", "NOMINAL", "NOMINAL", "ELEVATED", "ELEVATED", "HIGH", "HIGH", "CRITICAL"]);
  assert.equal(production.state, "UNMEASURED");
  assert.equal(production.value, null);
  assert.equal(production.measured, 0);
  assert.equal(production.total, 12);
  assert.ok(production.contributors.every((item) => item.value === null && item.state === "PLANNED"));
  assert.equal(demo.state, "DEMO");
  assert.equal(demo.measured, 12);
  assert.equal(demo.band, "NOMINAL");
  assert.ok(demo.value >= 0 && demo.value <= 100);
  assert.equal(demo.contributors.find((item) => item.id === "energy-draw").value, nominal.overview.coreLoadEnergyDraw);
  assert.equal(buildDemoCoreLoad(create("CRITICAL").overview.vitals, create("CRITICAL").overview.coreLoadEnergyDraw).band, "CRITICAL");
  assert.equal(dormantLoad.state, "UNMEASURED");
  assert.equal(dormantLoad.value, null);
  assert.equal(dormantLoad.measured, 0);
});

test("V9.1 keeps the premium hero outside the motherboard and restores operator inspection", () => {
  const overview = fs.readFileSync(path.resolve(__dirname, "../app/features/overview/overview-view.tsx"), "utf8");
  const composition = fs.readFileSync(path.resolve(__dirname, "../app/features/overview/flight-deck-composition.tsx"), "utf8");
  const styles = fs.readFileSync(path.resolve(__dirname, "../app/styles.css"), "utf8");
  const heroIndex = overview.indexOf('<section className="hero-panel"');
  const boardIndex = overview.indexOf("<FlightDeckBoard");
  assert.ok(heroIndex >= 0 && heroIndex < boardIndex, "premium hero precedes the shared board");
  assert.doesNotMatch(overview, /fd-core-ribbon/);
  for (const bay of ["System State", "Intelligence Core", "Resource / Activity", "Model Fleet", "Model DNA", "Provider Network", "Model Factory", "Intelligence Lab", "Cognitive Activity", "Live Operations"]) {
    assert.ok(overview.includes(`tr("inspect", "Inspect")`), `Inspect control is available for ${bay}`);
  }
  assert.match(overview, /className="fd-entity-hit" aria-label=\{`\$\{model\.title\}.*Inspect model details`\}/);
  assert.match(overview, /className="fd-entity-hit" aria-label=\{`\$\{provider\.title\}.*Inspect provider`\}/);
  assert.match(overview, /import \{ Inspector, ModelPicker \} from "\.\.\/\.\.\/components\/interface"/);
  assert.match(overview, /<Inspector open onClose=\{close\}/, "Overview details use the shared Inspector shell");
  assert.doesNotMatch(overview, /role="dialog"|event\.key !== "Tab"|event\.key === "Escape"/, "Inspector overlay and keyboard behavior stay canonical");
  assert.match(overview, /DEMO VALUE · DEVELOPMENT ONLY/);
  assert.match(composition, /onSelect\?: \(\) => void/);
  assert.match(composition, /<button type="button" className=\{className\}/);
  assert.match(styles, /\.fd-entity-hit\{position:absolute;z-index:2;inset:0/);
  assert.match(styles, /\.fd-board\{[^}]*grid-template-rows:minmax\(224px,auto\)/);
  assert.match(styles, /\.fd-showcase-control\{display:block;height:auto/);
});
