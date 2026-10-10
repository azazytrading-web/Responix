/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.resolve(__dirname, "../app");
const source = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");

test("Runtime model and tenant selection use canonical pickers and preserve form payloads", () => {
  const runtime = source("features/runtime/runtime-view.tsx");
  assert.match(runtime, /import \{ ModelPicker, TenantPicker \} from "\.\.\/\.\.\/components\/interface"/);
  assert.doesNotMatch(runtime, /import \{[^}]*EntityPicker[^}]*\} from "\.\.\/\.\.\/components\/oic-primitives"/);
  assert.match(runtime, /<ModelPicker[^>]+options=\{visibleModels\}[^>]+value=\{model\}/);
  assert.match(runtime, /<TenantPicker[^>]+options=\{tenants\}[^>]+value=\{tenantId\}/);
  assert.match(runtime, /<input type="hidden" name="model" value=\{model\} disabled=\{!data\?\.runtimeContext\}/);
  assert.match(runtime, /<input type="hidden" name="tenantId" value=\{tenantId\}/);
});

test("Overview model comparison uses canonical pickers without changing DNA semantics", () => {
  const overview = source("features/overview/overview-view.tsx");
  const dnaBay = overview.slice(overview.indexOf("function FleetDnaBay"), overview.indexOf("function FactoryReadout"));
  assert.match(overview, /import \{ Inspector, ModelPicker \} from "\.\.\/\.\.\/components\/interface"/);
  assert.equal((dnaBay.match(/<ModelPicker\b/g) ?? []).length, 2);
  assert.doesNotMatch(dnaBay, /<select\b/);
  assert.match(dnaBay, /disabled=\{!models\.length\}/);
  assert.match(dnaBay, /disabled=\{models\.length < 2\}/);
  assert.match(overview, /state: "UNMEASURED" as const/);
});

test("Catalog connection selection is canonical and preserves bounded connection behavior", () => {
  const controls = source("features/model-fabric/model-fabric-controls.tsx");
  assert.match(controls, /import \{ EntityPicker \} from "\.\.\/\.\.\/components\/interface"/);
  assert.match(controls, /connections\.filter\(\(connection\) => connection\.status !== "ARCHIVED"\)/);
  assert.match(controls, /<EntityPicker[\s\S]*?options=\{readyConnections\.map/);
  assert.match(controls, /setConnectionId\(value\); setPreview\(null\); setSyncResult\(null\)/);
  assert.doesNotMatch(controls, /<select\b/);
});

test("Factory form choices use canonical selection with required key submission", () => {
  const controls = source("components/oic-controls.tsx");
  const picker = source("components/interface/selection/pickers.tsx");
  assert.match(controls, /import \{ EntityPicker \} from "\.\/interface"/);
  assert.match(controls, /<EntityPicker name=\{field\.name\} required=\{field\.required !== false\}/);
  assert.match(controls, /missingRequiredOption/);
  assert.match(controls, /new FormData\(event\.currentTarget\)/);
  assert.match(picker, /formValue="key"/);
  assert.doesNotMatch(controls, /<select\b/);
});

test("Profiles archive filter uses the canonical toggle and remains opt-in", () => {
  const profiles = source("features/intelligence/intelligence-profiles-workspace.tsx");
  assert.match(profiles, /const \[showArchived, setShowArchived\] = useState\(false\)/);
  assert.match(profiles, /if \(!showArchived && profile\.lifecycle === "ARCHIVED"\) return false/);
  assert.match(profiles, /<ToggleControl label=\{t\("showArchived"\)\} value=\{showArchived\} onChange=\{setShowArchived\} dir=\{dir\}/);
  assert.doesNotMatch(profiles, /type="checkbox"/);
});

test("Flight Deck detail and entity inspectors use the shared canonical Inspector", () => {
  const overview = source("features/overview/overview-view.tsx");
  const renderers = source("features/overview/instrument-renderers.tsx");
  assert.match(overview, /<Inspector open onClose=\{close\}/);
  assert.match(overview, /dir=\{dir\}/);
  assert.match(renderers, /import \{ Inspector \} from "\.\.\/\.\.\/components\/interface"/);
  assert.match(renderers, /<Inspector open onClose=\{onClose\}/);
  assert.doesNotMatch(overview + renderers, /fd-drawer-backdrop|role="dialog"|aria-modal="true"/);
  assert.doesNotMatch(overview, /addEventListener\("keydown"/);
});

test("production Model Factory imports canonical components through the public barrel", () => {
  const factory = source("features/model-fabric/factory-workspaces.tsx");
  assert.match(factory, /from "\.\.\/\.\.\/components\/interface"/);
  assert.doesNotMatch(factory, /from "\.\.\/\.\.\/components\/interface\//);
});
