/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const { aggregatePacket76Accounting, canonicalProviderLabel } = require("../app/lib/packet76-accounting.cjs");

function loadComponent(relative, exportName, mocks = {}) {
  const filename = path.resolve(__dirname, "../app", relative);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const baseRequire = loaded.require.bind(loaded);
  loaded.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : baseRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports[exportName];
}

test("the live Console OIC-7 navigation renders first-class destinations in English and Arabic", () => {
  const Navigation = loadComponent("components/oic7-navigation.tsx", "Oic7Navigation");
  for (const locale of ["en", "ar"]) {
    const navigated = [];
    const element = Navigation({ locale, view: "overview", onNavigate: (destination) => navigated.push(destination) });
    const buttons = React.Children.toArray(element.props.children).slice(1);
    buttons.forEach((button) => button.props.onClick());
    assert.deepEqual(navigated, ["evaluation", "economics", "admission"]);
    const markup = renderToStaticMarkup(element);
    assert.match(markup, /data-navigation-group="oic7"/);
    assert.match(markup, /aria-label="OIC-7 workspaces"/);
    assert.match(markup, /type="button"/);
    for (const label of locale === "en" ? ["Evaluation", "Economics", "Admission &amp; budget"] : ["التقييم", "الاقتصاديات", "القبول والميزانية"])
      assert.ok(markup.includes(label), `visible ${locale} destination missing: ${label}`);
  }
});

test("Packet 7.6 read model aggregates canonical run truth and preserves exact decimals", () => {
  const campaigns = [
    { id: "parent-campaign", campaignKey: "oic7-packet76-paired-cohort-20261016-v1", budgetLimitOiu: "1280" },
    { id: "candidate-campaign", campaignKey: "oic7-packet76-candidate-cohort-20261017-v1", budgetLimitOiu: "1280" },
    { id: "other-campaign", campaignKey: "another-packet", budgetLimitOiu: "9999" }
  ];
  const runs = [
    { id: "parent-run", campaignId: "parent-campaign", status: "EXECUTED", targetClass: "MODEL_WITH_OIC_RUNTIME" },
    { id: "candidate-run", campaignId: "candidate-campaign", status: "EXECUTED", targetClass: "MODEL_WITH_OIC_RUNTIME" },
    { id: "other-run", campaignId: "other-campaign" }
  ];
  const detail = (id, dispatchCount, inputTokens, outputTokens, cost, reserved, consumed, released) => ({
    id,
    accounting: {
      state: "LIVE", dispatchCount, inputTokens, outputTokens,
      providerCosts: { USD: { amount: cost, state: "ASSESSED" } },
      oiu: { reserved, consumed, released, state: "SETTLED" },
      attempts: [{ providerAttempts: [{ provider: "DeepSeek", model: "deepseek-flash", providerKey: "openai-compatible" }] }]
    }
  });
  const result = aggregatePacket76Accounting(campaigns, runs, [
    detail("parent-run", 2, 200, 170, "0.00015000", "1024", "343", "681"),
    detail("candidate-run", 2, 176, 140, "0.00015945", "1024", "343", "681")
  ]);
  assert.equal(result.state, "LIVE");
  assert.equal(result.dispatchCount, 4);
  assert.equal(result.inputTokens, 376);
  assert.equal(result.outputTokens, 310);
  assert.equal(result.providerCosts.USD.amount, "0.00030945");
  assert.deepEqual(result.oiu, { authorized: "2560", reserved: "2048", consumed: "686", released: "1362", remaining: null, state: "SETTLED" });
  assert.deepEqual(result.provider, ["DeepSeek"]);
  assert.equal(canonicalProviderLabel("OpenAI-compatible API", "deepseek-flash"), "DeepSeek");
  assert.deepEqual(result.model, ["deepseek-flash"]);
  assert.deepEqual(result.adapter, ["openai-compatible"]);
  assert.equal(result.runs.length, 2);
});

test("partial/missing readback stays UNKNOWN rather than becoming a fake zero", () => {
  const result = aggregatePacket76Accounting(
    [{ id: "c", campaignKey: "oic7-packet76-paired-cohort-v1", budgetLimitOiu: "1280" }],
    [{ id: "r", campaignId: "c" }],
    [{ id: "r", accounting: { state: "PARTIAL", dispatchCount: 1, inputTokens: null, outputTokens: null, providerCosts: {}, oiu: { reserved: null, consumed: null, released: null, state: "UNKNOWN" }, attempts: [] } }]
  );
  assert.equal(result.state, "PARTIAL");
  assert.equal(result.dispatchCount, 1);
  assert.equal(result.inputTokens, null);
  assert.equal(result.outputTokens, null);
  assert.equal(result.providerCosts.USD, undefined);
  assert.equal(result.oiu.reserved, null);
  assert.equal(result.oiu.consumed, null);
  assert.equal(result.oiu.released, null);
  assert.equal(result.oiu.remaining, null);
});

test("accounting summary keeps OIU identity and exposes run-level drill-down and navigation", () => {
  const view = fs.readFileSync(path.resolve(__dirname, "../app/features/operations/packet76-accounting-summary.tsx"), "utf8");
  assert.match(view, /<OiuValue value=\{oiuAmount\(key\)\}/);
  assert.match(view, /Open run accounting/);
  assert.match(view, /navigate\("economics"\)/);
  assert.match(view, /navigate\("admission"\)/);
  assert.match(view, /Not exposed by the canonical run-accounting read model/);
  const bff = fs.readFileSync(path.resolve(__dirname, "../app/api/console/route.ts"), "utf8");
  assert.match(bff, /evaluations\/runs\/\$\{id\}/);
  assert.match(bff, /aggregatePacket76Accounting\(campaigns, runs, details\)/);
  assert.match(bff, /controlPlaneCredential\(\)/);
});

test("the accounting summary renders the live backend values and reachable drill-down controls", () => {
  const Button = ({ children }) => React.createElement("button", null, children);
  const Instrument = ({ label, value, unit }) => React.createElement("span", { "data-counter": label }, `${value ?? "UNAVAILABLE"}${unit ? ` ${unit}` : ""}`);
  const Oiu = ({ value }) => React.createElement("span", { className: "oiu-value" }, `◈ OIU ${value ?? "Unknown"}`);
  const Summary = loadComponent("features/operations/packet76-accounting-summary.tsx", "Packet76AccountingSummary", {
    "../../components/interface": { ActionButton: Button },
    "../../components/instruments": { NumericInstrument: Instrument },
    "../../components/oiu-value": { OiuValue: Oiu }
  });
  const accounting = aggregatePacket76Accounting(
    [{ id: "c", campaignKey: "oic7-packet76-paired-cohort-v1", budgetLimitOiu: "1280" }],
    [{ id: "r", campaignId: "c", targetClass: "MODEL_WITH_OIC_RUNTIME", status: "EXECUTED" }],
    [{ id: "r", accounting: {
      state: "LIVE", dispatchCount: 4, inputTokens: 376, outputTokens: 310,
      providerCosts: { USD: { amount: "0.00030945", state: "ASSESSED" } },
      oiu: { reserved: "2048", consumed: "686", released: "1362", state: "SETTLED" },
      attempts: [{ providerAttempts: [{ provider: "DeepSeek", model: "deepseek-flash", providerKey: "openai-compatible" }] }]
    } }]
  );
  const markup = renderToStaticMarkup(React.createElement(Summary, { value: accounting, locale: "en", navigate() {}, openRun() {} }));
  for (const value of ["4", "376", "310", "0.00030945", "DeepSeek", "deepseek-flash", "openai-compatible", "2048", "686", "1362", "Open run accounting", "Admission &amp; budget"])
    assert.ok(markup.includes(value), `live owner-visible summary missing ${value}`);
  assert.match(markup, /Not exposed by the canonical run-accounting read model/);
});

test("accounting summary variants retain the same read model with context-specific density", () => {
  const Button = ({ children }) => React.createElement("button", null, children);
  const Instrument = ({ label, value, unit }) => React.createElement("span", { "data-counter": label }, `${value ?? "UNAVAILABLE"}${unit ? ` ${unit}` : ""}`);
  const Oiu = ({ value }) => React.createElement("span", { className: "oiu-value" }, `◈ OIU ${value ?? "Unknown"}`);
  const Summary = loadComponent("features/operations/packet76-accounting-summary.tsx", "Packet76AccountingSummary", {
    "../../components/interface": { ActionButton: Button },
    "../../components/instruments": { NumericInstrument: Instrument },
    "../../components/oiu-value": { OiuValue: Oiu }
  });
  const value = { state: "LIVE", dispatchCount: 4, inputTokens: 376, outputTokens: 310, providerCosts: { USD: { amount: "0.00030945", state: "ASSESSED" } }, oiu: { reserved: "2048", consumed: "686", released: "1362", state: "SETTLED" }, provider: ["DeepSeek"], model: ["deepseek-flash"], adapter: ["openai-compatible"], runs: [] };
  const evaluation = renderToStaticMarkup(React.createElement(Summary, { value, locale: "en", navigate() {}, variant: "evaluation" }));
  assert.match(evaluation, /Evaluation execution evidence/);
  assert.match(evaluation, /376/);
  assert.doesNotMatch(evaluation, /Assessed provider cost|packet76-oiu-grid/);
  assert.match(evaluation, /Economics detail/);
  const admission = renderToStaticMarkup(React.createElement(Summary, { value, locale: "en", navigate() {}, variant: "admission" }));
  assert.match(admission, /Packet 7.6 admission liability/);
  assert.match(admission, /2048/);
  assert.match(admission, /1362/);
  assert.doesNotMatch(admission, /deepseek-flash|Input tokens|Provider cost/);
});

test("Evaluation, Economics and Admission keep distinct single-title compositions and accounting emphasis", () => {
  const evaluation = fs.readFileSync(path.resolve(__dirname, "../app/features/evaluation/evaluation-workspace.tsx"), "utf8");
  const economics = fs.readFileSync(path.resolve(__dirname, "../app/features/operations/economics-view.tsx"), "utf8");
  const admission = fs.readFileSync(path.resolve(__dirname, "../app/features/operations/admission-view.tsx"), "utf8");
  assert.equal((economics.match(/<h1>/g) ?? []).length, 1);
  assert.equal((economics.match(/Economics Observatory/g) ?? []).length, 1);
  assert.equal((admission.match(/<h1>/g) ?? []).length, 1);
  assert.equal((admission.match(/Admission Control Studio/g) ?? []).length, 1);
  assert.match(evaluation, /variant="evaluation"/);
  assert.match(economics, /variant="economics"/);
  assert.match(admission, /variant="admission"/);
  assert.match(evaluation, /Packet76AccountingSummary/);
  assert.match(economics, /Packet76AccountingSummary/);
  assert.match(admission, /Packet76AccountingSummary/);
});

test("the canonical OIU component groups exact integers and keeps unknown distinct in EN and AR", () => {
  const OiuValue = loadComponent("components/oiu-value.tsx", "OiuValue");
  const english = renderToStaticMarkup(React.createElement(OiuValue, { value: "2048", locale: "en" }));
  assert.match(english, /2,048/);
  assert.match(english, /◈<\/span> OIU/);
  assert.match(english, /oiu-value-inline/);
  const card = renderToStaticMarkup(React.createElement(OiuValue, { value: 0, locale: "en", variant: "CARD", label: "Reserved" }));
  assert.match(card, /oiu-value-card/);
  assert.match(card, /Reserved: 0 OIU/);
  const arabic = renderToStaticMarkup(React.createElement(OiuValue, { value: "2048", locale: "ar" }));
  assert.match(arabic, /2٬048/);
  const unknown = renderToStaticMarkup(React.createElement(OiuValue, { value: null, locale: "en" }));
  assert.match(unknown, /Unknown/);
  assert.match(unknown, /oiu-value-inline is-unknown/);
  const arabicTable = renderToStaticMarkup(React.createElement(OiuValue, { value: "2048", locale: "ar", variant: "TABLE" }));
  assert.match(arabicTable, /oiu-value-table/);
  assert.match(arabicTable, /2٬048/);
  const muted = renderToStaticMarkup(React.createElement(OiuValue, { value: "2000000", locale: "en", variant: "MUTED", label: "Settlement" }));
  assert.match(muted, /oiu-value-muted/);
  assert.match(muted, /2,000,000/);
  assert.match(muted, /Settlement: 2,000,000 OIU/);
  assert.doesNotMatch(unknown, />\s*0\s*</);
});

test("main Overview includes read-only evaluation readiness and bounded OIU accounting with drill-down", () => {
  const overview = fs.readFileSync(path.resolve(__dirname, "../app/features/overview/overview-view.tsx"), "utf8");
  const shell = fs.readFileSync(path.resolve(__dirname, "../app/console-app.tsx"), "utf8");
  const summary = fs.readFileSync(path.resolve(__dirname, "../app/features/overview/overview-operational-summary.tsx"), "utf8");
  const bff = fs.readFileSync(path.resolve(__dirname, "../app/api/console/route.ts"), "utf8");
  assert.match(overview, /<OverviewOperationalSummary locale=\{locale\} navigate=\{navigate\} onQueueRead=\{setEvaluationQueue\} onAccountingRead=\{setPacketAccounting\} onEvaluationRead=\{setEvaluationReadiness\} \/>/);
  assert.match(summary, /packet76-accounting/);
  assert.match(summary, /overview-readiness/);
  assert.match(summary, /<OiuValue value=\{amount\(oiu\[key\]\)\} locale=\{locale\} variant="COMPACT"/);
  assert.match(summary, /remaining.*not exposed/i);
  assert.match(summary, /navigate\("economics"\)/);
  assert.match(summary, /navigate\("admission"\)/);
  assert.match(summary, /navigate\("evaluation"\)/);
  assert.match(bff, /view === "overview-readiness"/);
  assert.match(bff, /applicationId=\$\{encodeURIComponent\(OIC_PLATFORM_APPLICATION_ID\)\}/);
  assert.match(bff, /workerReasonCode/);
  assert.match(bff, /qualityScore: null/);
  assert.match(bff, /activeRuns: typeof queueSource\.activeRuns === "number"/);
  assert.match(bff, /view === "overview-activity"/);
  assert.match(bff, /"modelId", "status", "contextTokens", "startedAt", "completedAt", "verificationStatus"/);
  assert.match(shell, /loadOverviewExecutions/);
  assert.match(shell, /view === "overview"\) void loadOverviewExecutions\(\)/);
  assert.match(bff, /controlPlaneCredential\(\)/);
});
