/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.resolve(__dirname, "../app");
const source = fs.readFileSync(
  path.join(appRoot, "features/model-fabric/factory-workspaces.tsx"),
  "utf8"
);
const consoleApp = fs.readFileSync(path.join(appRoot, "console-app.tsx"), "utf8");
const styles = fs.readFileSync(path.join(appRoot, "styles.css"), "utf8");

test("factory workspaces use canonical controls and do not clone the interface system", () => {
  assert.ok(source.includes('from "../../components/interface"'), "missing public canonical import boundary");
  for (const modulePath of ["components/oic-primitives"])
    assert.ok(source.includes(modulePath), `missing canonical import ${modulePath}`);
  for (const component of [
    "WizardFrame",
    "EntityPicker",
    "Inspector",
    "RelationshipPanel",
    "ToggleControl",
    "ActionMenu",
    "EmptyState"
  ])
    assert.ok(source.includes(`<${component}`), `missing canonical ${component}`);
  assert.doesNotMatch(source, /type="checkbox"|<select\b/);
  assert.match(styles, /factory-catalog-toolbar/);
  assert.match(styles, /factory-model-card\.*/);
  assert.match(
    styles,
    /factory-workspace :where\(section,article,header,div,nav,dl,dt,dd,span,button,code,small\)\{min-width:0\}/
  );
  assert.doesNotMatch(source, /dev\/interface-system|dev\/instruments|dev\/flight-deck/);
});

test("provider definitions remain code-owned and credential handling stays bounded", () => {
  assert.match(source, /Provider definitions are code-owned/);
  assert.doesNotMatch(source, /provider\.definition\.(?:update|delete)/);
  for (const action of ["connection.credential", "provider.credential.revoke", "connection.test"])
    assert.ok(source.includes(action), `missing existing action ${action}`);
  assert.match(source, /authStrategy\s*!==\s*"NONE"/);
  assert.match(source, /never include credentials/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(consoleApp, /searchParams\.set\([^,]*(?:credential|secret)/i);
});

test("catalog uses truthful sync history, expert-only raw import and source handoff", () => {
  for (const phrase of [
    "Persisted catalog sync runs",
    "No history",
    "not a field-level before/after diff",
    "CURATED MODEL ENTRY",
    "Advanced import payload",
    "No provider discovery adapter is registered",
    'navigate("models", uniqueId(model.id))',
    "Mapped to variant",
    "Unmapped",
    "All capabilities",
    "All availability states",
    "No comparison baseline",
    "No source models found"
  ])
    assert.ok(source.includes(phrase), `missing catalog contract: ${phrase}`);
  assert.match(source, /catalog\.preview/);
  assert.match(source, /catalog\.sync/);
  assert.match(consoleApp, /navigate=\{navigateTo\}/);
});

test("model factory preserves immutable revisions and API-owned lifecycle semantics", () => {
  for (const phrase of [
    "IMMUTABLE REVISION",
    "Read-only after creation",
    "model.revision.create",
    "model.variant.create",
    "model.binding.create",
    "model.visibility.grant",
    "CANARY and PRODUCTION require an active binding",
    "Retire all editions before retiring this family",
    "CATALOG SOURCE SELECTED"
  ])
    assert.ok(source.includes(phrase), `missing model contract: ${phrase}`);
  assert.match(source, /Family.{0,8}edition.{0,8}revision.{0,8}variant.{0,8}binding/is);
  assert.match(source, /isRetiredRecord\(revision\)/);
  assert.match(source, /isRetiredRecord\(variant\)/);
  assert.match(source, /More family actions/);
  assert.match(source, /Binding actions/);
});

test("factory workspaces include native Arabic and RTL-aware surfaces", () => {
  assert.match(source, /[\u0600-\u06ff]/);
  assert.match(source, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);
  assert.match(source, /factory-source-handoff/);
});
