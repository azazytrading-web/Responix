/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = (relative) => fs.readFileSync(path.resolve(__dirname, "../", relative), "utf8");

test("canonical OIU amount treatment has a mark, tabular LTR digits, and truthful localized unknown state", () => {
  const component = source("app/components/oiu-value.tsx");
  const styles = source("app/styles.css");
  assert.match(component, /oiu-value-mark/);
  assert.match(component, /◈/);
  assert.match(component, /dir="ltr"/);
  assert.match(component, /غير معروف/);
  assert.match(component, /Unknown/);
  assert.match(styles, /\.oiu-value\{[^}]*font-variant-numeric:tabular-nums lining-nums/);
  assert.match(styles, /#ffc857/);
  assert.match(styles, /\.oiu-value-number:before\{content:"◈"/);
  assert.match(styles, /prefers-contrast:more/);
});

test("OIC economics and admission surfaces use the canonical identity for OIU amounts", () => {
  const economics = source("app/features/operations/economics-view.tsx");
  const admission = source("app/features/operations/admission-view.tsx");
  const instruments = source("app/components/instruments/index.tsx");
  assert.match(economics, /<OiuValue value=\{amount == null \? null : valueText\(amount\)\}/);
  assert.match(admission, /<OiuValue value=\{knownAmount\(row\.consumed\)\}/);
  assert.match(admission, /<OiuValue value=\{knownAmount\(row\.amount\)\}/);
  assert.match(admission, /const amountReadout = /);
  assert.match(admission, /amountReadout\(quotaBound, quotaUnit\)/);
  assert.match(admission, /amountReadout\(budgetAmount, selectedUnit === "CURRENCY" \? currency : "OIU"\)/);
  assert.match(admission, /amountReadout\(budgetBound, selectedUnit === "CURRENCY" \? currency : "OIU"\)/);
  assert.match(instruments, /unit === "OIU" \? <OiuValue/);
  assert.match(economics, /latest page/);
});

test("evaluation run inspector wires canonical dispatch, token, cost, binding, and OIC-6 settlement readback", () => {
  const workspace = source("app/features/evaluation/evaluation-workspace.tsx");
  const bff = source("app/api/console/route.ts");
  assert.match(workspace, /evaluation-run&runId=/);
  assert.match(workspace, /Provider dispatches/);
  assert.match(workspace, /Input tokens/);
  assert.match(workspace, /Output tokens/);
  assert.match(workspace, /Provider cost/);
  assert.match(workspace, /OIU reserved/);
  assert.match(workspace, /OIU consumed/);
  assert.match(workspace, /OIU released/);
  assert.match(workspace, /provider\.provider/);
  assert.match(workspace, /provider\.model/);
  assert.match(bff, /evaluations\/runs\/\$\{runId\}/);
  assert.match(workspace, /dir=\{ar \? "rtl" : "ltr"\}/);
});
