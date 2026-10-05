/* global __dirname */
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const instrumentSource = require("node:fs").readFileSync(path.resolve(__dirname, "../app/components/instruments/index.tsx"), "utf8");

function loadTsx(relativePath, base = "../app/components/instruments", stubs = {}) {
  const filename = path.resolve(__dirname, base, relativePath);
  const source = require("node:fs").readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => id === "./scales" ? stubs.scales : originalRequire(id);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const scales = loadTsx("scales.ts", "../app/components/instruments");
const { instrumentTone, normalizeInstrumentValue, resolveInstrumentRatio, measuredDnaPolygon, measuredDnaRuns } = loadTsx("index.tsx", "../app/components/instruments", { scales });
const { ARC_SWEEPS, arcSweepDegrees, tickPlan, resolveThresholdZone, semanticTone, semanticGradientStops } = scales;

test("ArcMeter sweep variants and density plans keep stable geometry", () => {
  assert.deepEqual(ARC_SWEEPS, { SEMI: 180, EXTENDED_SEMI: 220, THREE_QUARTER: 270 });
  assert.equal(arcSweepDegrees(), 220);
  assert.equal(arcSweepDegrees("SEMI"), 180);
  assert.equal(arcSweepDegrees("THREE_QUARTER"), 270);
  assert.deepEqual(["XS", "SM", "MD", "LG"].map((size) => tickPlan(size).count), [8, 14, 24, 36]);
});

test("circular readouts and captions occupy separate reserved zones", () => {
  assert.match(instrumentSource, /<span className="oii-gauge-readout"><b>\{ratio === null \? stateLabel \?\? current : numberText\(value, formattedValue\)\}<\/b>/);
  assert.match(instrumentSource, /<span className="oii-gauge-caption">\{label && <span>\{label\}<\/span>\}\{semantics/);
  assert.match(instrumentSource, /<div className="oii-arc-graphic"><svg/);
  assert.match(instrumentSource, /<div className="oii-gauge-readout"><b>\{ratio === null \? stateLabel \?\? current : numberText\(value, formattedValue\)\}<\/b>/);
  assert.match(instrumentSource, /<div className="oii-gauge-caption">\{label && <span>\{label\}<\/span>\}\{semantics/);
  assert.match(instrumentSource, /<span className="oii-ring-core"><b>\{value\}<\/b><\/span>\{label && <span className="oii-gauge-caption">\{label\}<\/span>/);
  assert.match(instrumentSource, /className="oii-capacity-label"[^>]*>\{label\}<\/span><div className="oii-capacity-head">/);
  assert.match(instrumentSource, /oii-capacity-head[\s\S]*?oii-capacity-segments[\s\S]*?oii-capacity-state/);
  const styles = require("node:fs").readFileSync(path.resolve(__dirname, "../app/styles.css"), "utf8");
  assert.match(styles, /\.oii-radial>svg,\.oii-radial>\.oii-gauge-readout\{[^}]*width:90%;height:90%\}/);
  assert.match(styles, /\.oii-arc-graphic\{position:relative;[^}]*aspect-ratio:5\/4\}/);
  assert.match(styles, /\.oii-arc-graphic>\.oii-gauge-readout\{position:absolute;top:54%;left:50%/);
});

test("SVG polar coordinates are quantized for stable server and browser hydration", () => {
  assert.match(instrumentSource, /const stableCoordinate = \(value: number\) => Number\(value\.toFixed\(3\)\)/);
  assert.match(instrumentSource, /const polar = \(cx: number, cy: number, r: number, degrees: number\) => \[stableCoordinate/);
});

test("semantic thresholds require explicit bands and polarity", () => {
  const highBad = { polarity: "HIGH_IS_BAD", zones: [{ from: 0, to: 40, state: "NORMAL" }, { from: 40, to: 70, state: "WARNING" }, { from: 70, to: 100, state: "CRITICAL" }] };
  const highGood = { polarity: "HIGH_IS_GOOD", zones: [{ from: 0, to: 50, state: "CRITICAL" }, { from: 50, to: 80, state: "WARNING" }, { from: 80, to: 100, state: "NORMAL" }] };
  const lowBad = { polarity: "LOW_IS_BAD", zones: [{ from: 0, to: 20, state: "CRITICAL" }, { from: 20, to: 50, state: "WARNING" }, { from: 50, to: 100, state: "NORMAL" }] };
  const lowGood = { polarity: "LOW_IS_GOOD", zones: [{ from: 0, to: 50, state: "NORMAL" }, { from: 50, to: 80, state: "WARNING" }, { from: 80, to: 100, state: "CRITICAL" }] };
  const target = { polarity: "TARGET_RANGE", targetRange: [30, 70] };
  assert.equal(semanticTone(85, highBad), "fault");
  assert.equal(semanticTone(90, highGood), "good");
  assert.equal(semanticTone(10, lowBad), "fault");
  assert.equal(semanticTone(90, lowGood), "fault");
  assert.equal(semanticGradientStops(0, 100, lowBad).length, 6);
  assert.equal(semanticGradientStops(0, 100, lowGood).length, 6);
  assert.equal(semanticTone(45, target), "good");
  assert.equal(semanticTone(45, { polarity: "NEUTRAL" }), "amber");
  assert.equal(resolveThresholdZone(41, { polarity: "HIGH_IS_BAD", zones: [{ from: 0, to: 40, state: "NORMAL" }, { from: 45, to: 100, state: "CRITICAL" }] }), null);
  assert.equal(semanticGradientStops(0, 100, highBad).length, 6);
  assert.equal(semanticGradientStops(0, 100, { polarity: "HIGH_IS_BAD", zones: [{ from: 10, to: 100, state: "CRITICAL" }] }), null);
  assert.equal(semanticGradientStops(0, 100, { polarity: "NEUTRAL", zones: highBad.zones }), null);
  assert.equal(semanticGradientStops(0, 100, { polarity: "HIGH_IS_BAD", zones: [...highBad.zones].reverse() }).length, 6);
});

test("explicit threshold gaps and incomplete ranges never imply a risk score", () => {
  const incomplete = { polarity: "HIGH_IS_BAD", zones: [{ from: 10, to: 40, state: "NORMAL" }, { from: 40, to: 70, state: "WARNING" }] };
  assert.equal(resolveThresholdZone(80, incomplete), null);
  assert.equal(semanticGradientStops(0, 100, incomplete), null);
  assert.equal(semanticTone(80, incomplete), "amber");
});

test("instrument states resolve to semantic tones and unknown states fail neutral", () => {
  assert.equal(instrumentTone("HEALTHY"), "good");
  assert.equal(instrumentTone("DEGRADED"), "warn");
  assert.equal(instrumentTone("FAULT"), "fault");
  assert.equal(instrumentTone("UNAVAILABLE"), "off");
  assert.equal(instrumentTone("FUTURE_STATE"), "off");
});

test("bounded instruments require a valid range and clamp source values", () => {
  assert.equal(normalizeInstrumentValue(25, 0, 100), 0.25);
  assert.equal(normalizeInstrumentValue(-10, 0, 100), 0);
  assert.equal(normalizeInstrumentValue(120, 0, 100), 1);
  assert.equal(normalizeInstrumentValue(5, 2, 2), null);
  assert.equal(normalizeInstrumentValue(Number.NaN, 0, 1), null);
  assert.equal(normalizeInstrumentValue(undefined, 0, 1), null);
});

test("idle, unavailable and unmeasured states keep instrument geometry unpowered", () => {
  assert.equal(resolveInstrumentRatio(75, 0, 100, "LIVE"), 0.75);
  assert.equal(resolveInstrumentRatio(75, 0, 100, "DEGRADED"), 0.75);
  assert.equal(resolveInstrumentRatio(75, 0, 100, "FAULT"), 0.75);
  for (const state of ["IDLE", "UNAVAILABLE", "OFFLINE", "NOT_CONFIGURED", "INSUFFICIENT_DATA", "UNMEASURED"]) assert.equal(resolveInstrumentRatio(75, 0, 100, state), null);
});

test("DNA radar includes only valid measured dimensions and avoids partial fake polygons", () => {
  const dimensions = [
    { id: "a", label: "A", state: "MEASURED", value: 0.5 },
    { id: "b", label: "B", state: "PLANNED" },
    { id: "c", label: "C", state: "MEASURED", value: 0.75 },
    { id: "d", label: "D", state: "INSUFFICIENT_DATA" },
    { id: "e", label: "E", state: "MEASURED", value: 1.4 },
    { id: "f", label: "F", state: "MEASURED", value: 0.25 }
  ];
  const polygon = measuredDnaPolygon(dimensions);
  assert.equal(polygon.split(" ").length, 3);
  assert.equal(measuredDnaPolygon(dimensions.slice(0, 4)), null);
  assert.equal(measuredDnaPolygon(dimensions.map((d) => ({ ...d, state: "PLANNED", value: undefined }))), null);
  assert.deepEqual(measuredDnaRuns(dimensions), []);
  const adjacent = dimensions.map((dimension) => dimension.id === "b" ? { ...dimension, state: "MEASURED", value: 0.4 } : dimension);
  assert.deepEqual(measuredDnaRuns(adjacent).map((run) => run.length), [3]);
});
