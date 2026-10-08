/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../app");
const workspaces = fs.readFileSync(path.join(root, "features/intelligence/lab-workspaces.tsx"), "utf8");
const consoleApp = fs.readFileSync(path.join(root, "console-app.tsx"), "utf8");
const consoleRoute = fs.readFileSync(path.join(root, "api/console/route.ts"), "utf8");
const actionRoute = fs.readFileSync(path.join(root, "api/action/route.ts"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

 test("Lab workflow reuses canonical controls, instruments, traces and comparison components", () => {
  for (const component of ["ActionButton", "NumericStepper", "SearchableSelect", "CompareSurface", "Inspector", "Timeline", "DeltaIndicator", "NodeTrack", "NumericInstrument", "StateBeacon"]) assert.match(workspaces, new RegExp(`\\b${component}\\b`));
  assert.match(workspaces, /lab-ribbon/);
  assert.match(workspaces, /current === item\.index/);
  assert.doesNotMatch(workspaces, /components\/(?:gallery|dev)|dev\/(?:instruments|interface-system)/);
  assert.doesNotMatch(workspaces, /<select\b|type=["']checkbox["']/i);
});

test("Workbench exposes held conditions and pre-run lanes while preserving real paired-call semantics", () => {
  assert.match(workspaces, /runWorkbench\(\{ model, profileRevisionId, tenantId, prompt, maxOutputUnits \}\)/);
  assert.match(workspaces, /Held constant across both executions/);
  assert.match(workspaces, /Shared task input/);
  assert.match(workspaces, /not stored in the URL or experiment history/);
  assert.match(workspaces, /FAST · built-in baseline/);
  assert.match(workspaces, /selected immutable profile revision/i);
  assert.match(workspaces, /EXPERIMENT READY/);
  assert.match(workspaces, /EXPERIMENT BLOCKED/);
  assert.match(workspaces, /Paired execution lanes/);
  assert.match(workspaces, /READY AFTER RUN/);
  assert.match(workspaces, /No score or winner/);
  assert.match(workspaces, /Measured differences only/);
  assert.match(workspaces, /Provider usage may apply/);
  assert.match(workspaces, /navigate\("runtime"\)/);
  assert.doesNotMatch(workspaces, /quality score|declared winner|winner badge|MODEL EVALUATION/i);
});

test("Runtime flow distinguishes readiness, real invocation failures and returned evidence", () => {
  assert.match(workspaces, /runRuntime\(\{ model, tenantId, prompt, maxOutputUnits \}\)/);
  assert.match(workspaces, /RESOLVED PROFILE/);
  assert.match(workspaces, /Determined by model binding/);
  assert.match(workspaces, /RUNTIME FLOW \/ SERVICE BOUNDARIES/);
  assert.match(workspaces, /INVOCATION READY/);
  assert.match(workspaces, /INVOCATION BLOCKED/);
  assert.match(workspaces, /Precondition blocked/);
  assert.match(workspaces, /Invocation returned an error/);
  assert.match(workspaces, /Safe API code/);
  assert.match(workspaces, /Output ceiling · configured/);
  assert.match(workspaces, /Output used · returned/);
  assert.match(workspaces, /navigate\("workbench"\)/);
  assert.match(workspaces, /navigate\("traces"\)/);
});

test("Runtime model discovery remains session and machine-credential protected", () => {
  assert.match(consoleRoute, /if \(!\(await hasConsoleSession\(\)\)\)/);
  assert.match(consoleRoute, /view === "runtime-models"/);
  assert.match(consoleRoute, /apiUrl\(`\/v1\/models\$\{query\}`\)/);
  assert.match(consoleRoute, /Authorization: `Bearer \$\{runtimeCredential\(\)\}`/);
  assert.match(consoleRoute, /AbortSignal\.timeout\(8000\)/);
  assert.match(actionRoute, /if \(!sameOrigin\(request\)\)/);
  assert.match(actionRoute, /if \(!\(await hasConsoleSession\(\)\)\)/);
  assert.match(actionRoute, /action === "runtime\.invoke"/);
  assert.match(actionRoute, /action === "intelligence\.workbench\.run"/);
  assert.doesNotMatch(actionRoute, /Authorization:\s*`Bearer \$\{body\./);
});

test("Trace view describes only the bounded returned sample and allowlisted detail", () => {
  for (const token of ["SAFE_SUMMARY_NUMBERS", "safeResource(resource: Row)", "stage.resourceUse", "Allowlisted structured evidence only", "No execution records returned", "No trace selected", "TRACE ANATOMY / ON SELECTION", "Refresh sample", "newest bounded sample"]) assert.ok(workspaces.includes(token), token);
  assert.match(workspaces, /returnedCounts = executions\.reduce/);
  assert.match(workspaces, /Searches the current returned sample only/);
  assert.match(workspaces, /Copy trace ID/);
  assert.match(workspaces, /Provider-call and retrieval detail rows are not returned/);
  assert.match(workspaces, /navigate\("workbench"\)/);
  assert.match(workspaces, /navigate\("runtime"\)/);
  assert.doesNotMatch(workspaces, /JSON\.stringify|stage\.metadata|providerPayload|chain.of.thought/i);
});

test("Selected trace refresh retains a record only while it remains in the bounded response", () => {
  assert.match(consoleApp, /selectedTraceId\.current/);
  assert.match(consoleApp, /searchParams\.set\("trace", entityId\)/);
  assert.match(consoleApp, /traceRequestSequence/);
});

test("Arabic direction and narrow layouts reflow without document-width locks", () => {
  assert.match(workspaces, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);
  assert.match(workspaces, /<bdi dir="ltr" className="lab-technical">/);
  assert.match(workspaces, /آثار التنفيذ/);
  assert.match(styles, /@media\(max-width:680px\)\{\.lab-workspace/);
  assert.match(styles, /\.lab-trace-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.doesNotMatch(styles, /\.lab-(?:workspace|trace-layout|runtime-layout)\{[^}]*min-width:\s*\d{4,}px/);
});
