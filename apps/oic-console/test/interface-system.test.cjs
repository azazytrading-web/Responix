/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const appRoot = path.resolve(__dirname, "../app");
const interfaceRoot = path.join(appRoot, "components/interface");
const galleryRoot = path.join(appRoot, "dev/interface-system");

function loadTypeScript(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (request) => {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    if (request.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), request);
      const candidate = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx")
      ].find((item) => fs.existsSync(item) && fs.statSync(item).isFile());
      if (candidate && /\.tsx?$/.test(candidate)) return loadTypeScript(candidate, mocks);
    }
    return originalRequire(request);
  };
  loaded._compile(compiled, filename);
  return loaded.exports;
}

function collectSource(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSource(filename));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(filename);
  }
  return files;
}

test("interface gallery is development-gated and composes its complete ordered surface", () => {
  const page = fs.readFileSync(path.join(galleryRoot, "page.tsx"), "utf8");
  const gallery = fs.readFileSync(path.join(galleryRoot, "gallery.tsx"), "utf8");
  const messages = fs.readFileSync(path.join(galleryRoot, "messages.ts"), "utf8");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /process\.env\.NODE_ENV !== "development"\) notFound\(\)/);
  const panelOrder = [...gallery.matchAll(/id="oi-interface-([a-z-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(panelOrder, [
    "controls",
    "commands",
    "selection",
    "configuration",
    "workspace",
    "feedback",
    "states",
    "composites"
  ]);
  assert.match(gallery, /setLocale\("ar"\)/);
  assert.match(gallery, /setDirection\("rtl"\)/);
  assert.match(gallery, /setPreview\("narrow"\)/);
  assert.match(gallery, /setReducedMotion/);
  assert.match(gallery, /setShowAnatomy/);
  assert.match(gallery, /setDensity\("precision"\)/);
  assert.match(gallery, /entity: "demo-provider-openai"/);
  assert.match(gallery, /setControlState/);
  assert.match(gallery, /setGalleryState/);
  assert.doesNotMatch(gallery, /fetch\s*\(|\/api\/v1\/|\/api\/action|DATABASE_URL|process\.env/);

  assert.match(messages, /DEVELOPMENT REFERENCE/);
  assert.match(messages, /Oi Interface Laboratory/);
  for (const panel of panelOrder) assert.match(gallery, new RegExp(`oi-interface-${panel}`));
});

test("development gallery consumes the canonical public system and owns no alternate controls", () => {
  const page = fs.readFileSync(path.join(galleryRoot, "page.tsx"), "utf8");
  const gallery = fs.readFileSync(path.join(galleryRoot, "gallery.tsx"), "utf8");
  const barrel = fs.readFileSync(path.join(interfaceRoot, "index.ts"), "utf8");
  const styles = path.join(interfaceRoot, "interface-system.css");
  const instrumentGallery = fs.readFileSync(path.join(appRoot, "dev/instruments/gallery.tsx"), "utf8");
  const overview = fs.readFileSync(path.join(appRoot, "features/overview/overview-view.tsx"), "utf8");
  const deckComposition = fs.readFileSync(path.join(appRoot, "features/overview/flight-deck-composition.tsx"), "utf8");
  assert.match(page, /components\/interface\/interface-system\.css/);
  assert.ok(fs.existsSync(styles), "canonical Interface stylesheet exists under the system implementation");
  assert.doesNotMatch(gallery, /from "\.\.\/\.\.\/components\/interface\//);
  assert.match(gallery, /from "\.\.\/\.\.\/components\/interface"/);
  assert.match(barrel, /from "\.\/controls"/);
  assert.match(barrel, /from "\.\/selection"/);
  assert.match(instrumentGallery, /from "\.\.\/\.\.\/components\/instruments"/);
  assert.match(overview, /from "\.\.\/\.\.\/components\/instruments"/);
  assert.match(deckComposition, /from "\.\.\/\.\.\/components\/instruments"/);
  assert.doesNotMatch(gallery, /type=["']range["']|<svg\b|<canvas\b/);
});

test("operator interaction palette is tokenized and separate from OIC identity and semantic states", () => {
  const tokens = fs.readFileSync(path.join(interfaceRoot, "foundation/tokens.css"), "utf8");
  const styles = fs.readFileSync(path.join(interfaceRoot, "interface-system.css"), "utf8");
  assert.match(tokens, /^\.oi-interface-system\s*\{/);
  for (const name of [
    "accent",
    "accent-bright",
    "accent-soft",
    "accent-muted",
    "accent-border",
    "accent-glow",
    "surface",
    "surface-active",
    "surface-hover",
    "track",
    "track-active",
    "thumb",
    "focus",
    "selection"
  ]) {
    assert.match(tokens, new RegExp(`--oi-control-${name}:`), `${name} is defined in the scoped token family`);
  }
  assert.match(tokens, /--oi-amber:\s*#e7b946/);
  assert.match(tokens, /--oi-focus:\s*var\(--oi-control-focus\)/);
  assert.doesNotMatch(styles, /rgb\((?:101 215 217|83 226 222|164 252 242)\s*\//);
  assert.match(styles, /\.oi-action\.is-primary\s*\{/);
  assert.match(styles, /\.oi-action\.is-danger[^{}]*\{[^}]*var\(--oi-red\)/s);
  assert.match(styles, /\.oi-action\.is-warning\s*\{[^}]*var\(--oi-orange\)/s);
  assert.match(styles, /\.oi-action\.is-success\s*\{[^}]*var\(--oi-green\)/s);
  assert.match(styles, /\.oi-segment\[data-selected\]/);
  assert.match(styles, /\.oi-switch\[data-selected\]/);
  assert.match(styles, /\.oi-interface-system\[dir="rtl"\] \.oi-switch\[data-selected\] \.oi-switch-track > span\s*\{[^}]*translateX\(-32px\)/s);
  assert.match(styles, /\.oi-interface-system \.oi-switch-track\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(styles, /\.oi-interface-system \.oi-switch-track > span\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(styles, /\.oi-interface-system \.oi-slider-thumb\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(styles, /\.oi-interface-system \.oi-slider-thumb\[data-dragging\]::after/);
  assert.match(tokens, /data-density="precision"/);
  assert.match(styles, /\.oi-anatomy-overlay/);
  assert.match(styles, /\.oi-interface-system \.oi-selected-chip\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(styles, /\.oi-picker-current-meta/);
  assert.match(styles, /\.oi-slider-fill\s*\{/);
  assert.match(styles, /\.oi-dial-face\s*\{/);
  assert.match(styles, /\.oi-interface-system \.oi-dial-value\s*\{[^}]*inset-block-start:\s*31%/s);
  assert.match(styles, /\.oi-provider-steps li\.is-current\s*\{[^}]*var\(--oi-control-accent-bright\)/s);
  assert.match(styles, /\.oi-picker-trigger\s*\{/);
  assert.match(styles, /\.oi-interface-system\s+:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test("development fixtures stay inside the dev gallery and never enter production surfaces", () => {
  const gallery = fs.readFileSync(path.join(galleryRoot, "gallery.tsx"), "utf8");
  const fixture = fs.readFileSync(path.join(galleryRoot, "demo-data.ts"), "utf8");
  const productionFiles = collectSource(appRoot).filter(
    (filename) => !filename.includes(`${path.sep}dev${path.sep}`)
  );
  const productionSource = productionFiles
    .map((filename) => fs.readFileSync(filename, "utf8"))
    .join("\n");
  assert.match(gallery, /from "\.\/demo-data"/);
  assert.match(fixture, /interfaceDemoProfileValues/);
  assert.match(fixture, /interfaceDemoWeightPresets/);
  assert.doesNotMatch(
    productionSource,
    /interfaceDemo(?:Entities|Presets|Weights|WeightPresets|Thresholds|Budgets|ProfileValues|ProfileRevisions|RelationshipLevels|Scopes)/
  );
  assert.doesNotMatch(productionSource, /dev\/interface-system\/demo-data/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(appRoot, "console-app.tsx"), "utf8"),
    /interface-system/
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(interfaceRoot, "composites/configuration.tsx"), "utf8"),
    /demo-r[0-9]|reasoning:\s*\d|retrieval:\s*\d|memory:\s*\d|verification:\s*\d/
  );
});

test("English and Arabic messages share keys, gallery copy is complete, and Arabic copy is native", () => {
  const { interfaceMessages } = loadTypeScript(path.join(galleryRoot, "messages.ts"));
  assert.deepEqual(
    Object.keys(interfaceMessages.en).sort(),
    Object.keys(interfaceMessages.ar).sort()
  );
  const gallery = fs.readFileSync(path.join(galleryRoot, "gallery.tsx"), "utf8");
  const composites = fs.readFileSync(
    path.join(interfaceRoot, "composites/configuration.tsx"),
    "utf8"
  );
  const keys = new Set(Object.keys(interfaceMessages.en));
  const used = new Set(
    [...`${gallery}\n${composites}`.matchAll(/\b(?:t|strings)\.([A-Za-z][A-Za-z0-9_]*)/g)].map(
      (match) => match[1]
    )
  );
  assert.deepEqual(
    [...used].filter((key) => !keys.has(key)).sort(),
    [],
    "every localized reference has a translated value"
  );
  for (const key of [
    "title",
    "demoOnly",
    "commands",
    "selection",
    "thresholds",
    "weights",
    "providerSetup",
    "paletteHint",
    "scopeMatrixNotice"
  ]) {
    const value = interfaceMessages.ar[key];
    assert.match(value, /[\u0600-\u06ff]/u, `${key} contains native Arabic text`);
  }
});

test("React Aria wrappers, component exports and responsive/reduced-motion contracts are present", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  assert.equal(packageJson.dependencies["react-aria-components"], "1.21.0");
  const barrel = fs.readFileSync(path.join(interfaceRoot, "index.ts"), "utf8");
  for (const family of [
    "foundation",
    "controls",
    "commands",
    "selection",
    "workspace",
    "feedback",
    "state",
    "composites"
  ]) {
    assert.match(barrel, new RegExp(`from \\"\\./${family}\\"`));
  }
  const controls = fs.readFileSync(path.join(interfaceRoot, "controls/sliders.tsx"), "utf8");
  const commands = fs.readFileSync(path.join(interfaceRoot, "commands/actions.tsx"), "utf8");
  const pickers = fs.readFileSync(path.join(interfaceRoot, "selection/pickers.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(interfaceRoot, "interface-system.css"), "utf8");
  assert.match(controls, /react-aria-components\/Slider/);
  assert.match(commands, /react-aria-components\/Button/);
  assert.match(commands, /event\.key === " "/);
  assert.match(pickers, /react-aria-components\/ComboBox/);
  assert.match(styles, /\.oi-interface-preview\.is-narrow/);
  assert.match(styles, /container-name:\s*interface-preview/);
  assert.match(styles, /@container interface-preview \(max-width:\s*480px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(styles, /body\s*\{[^}]*overflow-x\s*:\s*hidden/);
});

test("preset, threshold and weight-budget helpers preserve their semantic contracts", () => {
  const inert = new Proxy({}, { get: () => () => undefined });
  const mocks = Object.fromEntries(
    [
      "../../instruments",
      "../controls/sliders",
      "../controls/numeric",
      "../selection/pickers",
      "../commands/actions",
      "../state/configuration",
      "../feedback/feedback",
      "../workspace/surfaces",
      "../controls/choices",
      "react-aria-components/TextField"
    ].map((key) => [key, inert])
  );
  mocks["../foundation/format"] = loadTypeScript(path.join(interfaceRoot, "foundation/format.ts"));
  const { getPresetMatch, redistributeWeightDimensions, validateThresholdBands } = loadTypeScript(
    path.join(interfaceRoot, "composites/configuration.tsx"),
    mocks
  );
  const fixtures = loadTypeScript(path.join(galleryRoot, "demo-data.ts"));
  const balanced = fixtures.interfaceDemoWeightPresets.find((preset) => preset.id === "balanced");
  assert.equal(
    Object.values(balanced.values).reduce((sum, value) => sum + value, 0),
    100
  );
  assert.equal(
    getPresetMatch(balanced.values, fixtures.interfaceDemoWeightPresets, "CUSTOM").kind,
    "exact"
  );
  assert.equal(
    getPresetMatch(
      { ...balanced.values, reasoning: 30 },
      fixtures.interfaceDemoWeightPresets,
      "CUSTOM",
      "balanced",
      "MODIFIED"
    ).kind,
    "modified"
  );
  assert.equal(
    getPresetMatch(
      { ...balanced.values, reasoning: 30 },
      fixtures.interfaceDemoWeightPresets,
      "CUSTOM"
    ).kind,
    "custom"
  );

  const changed = fixtures.interfaceDemoWeights.map((item) =>
    item.id === "reasoning" ? { ...item, value: 40 } : { ...item }
  );
  const redistributed = redistributeWeightDimensions(changed, 100, "reasoning");
  assert.equal(
    redistributed.find((item) => item.id === "memory").value,
    18,
    "locked dimensions do not change"
  );
  assert.equal(
    redistributed.reduce((sum, item) => sum + item.value, 0),
    100,
    "unlocked dimensions absorb a valid edit"
  );

  assert.deepEqual(validateThresholdBands(fixtures.interfaceDemoThresholds, 0, 100), []);
  assert.ok(
    validateThresholdBands({ healthy: 30, elevated: 78, warning: 55, critical: 92 }, 0, 100).some(
      (issue) => issue.code === "THRESHOLD_ORDER"
    )
  );
  assert.ok(
    validateThresholdBands({ healthy: -1, elevated: 55, warning: 78, critical: 92 }, 0, 100).some(
      (issue) => issue.code === "THRESHOLD_BOUNDS"
    )
  );
});

test("command and reactive draft transitions retain work through failure, conflict and verification", () => {
  const command = loadTypeScript(path.join(interfaceRoot, "state/command-machine.ts"));
  assert.equal(command.transitionCommand("READY", "ARM"), "ARMED");
  assert.equal(command.transitionCommand("ARMED", "DISARM"), "READY");
  assert.equal(command.transitionCommand("EXECUTING", "AMBIGUOUS"), "UNKNOWN_RESULT");
  assert.equal(command.transitionCommand("UNKNOWN_RESULT", "RESET"), "IDLE");

  const draft = loadTypeScript(path.join(interfaceRoot, "state/configuration.tsx"));
  let state = draft.createDraft({ ceiling: 50 }, "revision-1");
  state = draft.reduceDraft(state, { type: "edit", value: { ceiling: 65 } });
  state = draft.reduceDraft(state, { type: "preview", label: "LOCAL PREVIEW" });
  assert.equal(state.preview.source.kind, "local-preview");
  state = draft.reduceDraft(state, { type: "apply-start" });
  state = draft.reduceDraft(state, {
    type: "apply-result",
    status: "FAILED",
    message: "Local failure fixture"
  });
  assert.equal(state.phase, "failed");
  assert.equal(state.current.ceiling, 50);
  assert.equal(state.proposed.ceiling, 65, "failed apply retains the repairable draft");
  state = draft.reduceDraft(state, {
    type: "refresh",
    value: { ceiling: 70 },
    revision: "revision-2"
  });
  assert.equal(state.phase, "conflict");
  assert.equal(state.proposed.ceiling, 65, "conflict retains local work for resolution");
  state = draft.reduceDraft(state, { type: "dismiss-conflict" });
  assert.equal(state.phase, "dirty");
  state = draft.reduceDraft(state, {
    type: "verified",
    value: { ceiling: 65 },
    revision: "revision-3",
    message: "Readback confirmed"
  });
  assert.equal(state.phase, "verified");
  assert.equal(state.current.ceiling, 65);
  assert.equal(state.revision, "revision-3");
});
