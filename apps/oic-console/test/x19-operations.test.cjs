/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const app = path.resolve(__dirname, "../app");
const route = fs.readFileSync(path.join(app, "api/console/route.ts"), "utf8");
const health = fs.readFileSync(path.join(app, "features/operations/health-view.tsx"), "utf8");
const audit = fs.readFileSync(path.join(app, "features/operations/audit-view.tsx"), "utf8");
const shell = fs.readFileSync(path.join(app, "console-app.tsx"), "utf8");
const i18n = fs.readFileSync(path.join(app, "i18n.ts"), "utf8");
const connectionStateSource = fs.readFileSync(path.join(app, "api-connection-state.ts"), "utf8");
const connectionStateModule = { exports: {} };
new Function("exports", ts.transpile(connectionStateSource, { module: ts.ModuleKind.CommonJS }))(connectionStateModule.exports);
const { getApiConnectionState } = connectionStateModule.exports;

test("Global shell connection state follows API liveness without collapsing readiness", () => {
  const live = { sourceState: "AVAILABLE", httpStatus: 200, body: { status: "ok" } };
  assert.equal(getApiConnectionState({ live, ready: { sourceState: "AVAILABLE", httpStatus: 503, body: { status: "error" } } }, "available"), "connected");
  assert.equal(getApiConnectionState({ live }, "loading"), "checking");
  assert.equal(getApiConnectionState({ live }, "failed"), "unavailable");
  assert.equal(getApiConnectionState({ live: { sourceState: "UNAVAILABLE" } }, "available"), "unavailable");
  assert.equal(getApiConnectionState({ ready: live }, "available"), "unknown");
  assert.equal(getApiConnectionState({ live: { ...live, httpStatus: 503 } }, "available"), "unavailable");

  assert.match(shell, /getApiConnectionState\(health, healthState\)/);
  assert.doesNotMatch(shell, /health\?\.status === "ok"/);
  assert.match(shell, /apiConnectionLabel/);
  assert.match(shell, /title=\{t\.apiConnectionMeaning\}/);
  assert.match(i18n, /apiConnectionMeaning: "API process liveness only/);
  assert.match(i18n, /apiConnectionMeaning: "حيوية عملية API فقط/);
});

test("Health keeps process liveness separate from database dependency readiness", () => {
  assert.match(route, /health\/live/);
  assert.match(route, /health\/ready/);
  assert.match(route, /Promise\.all\(\[readHealth\("\/api\/v1\/health\/live"\), readHealth\("\/api\/v1\/health\/ready"\)\]\)/);
  assert.match(health, /PROCESS \/ LIVE/);
  assert.match(health, /DEPENDENCIES \/ READY/);
  assert.match(health, /checks\.database === "ok"/);
  assert.match(health, /checks\.database === "unavailable"/);
  assert.match(i18n, /healthSourceBoundary: "Manually fetched source responses/);
  assert.doesNotMatch(health, /setInterval|polling/i);
});

test("Audit BFF is session and machine-credential protected, bounded and allowlisted", () => {
  assert.match(route, /if \(!\(await hasConsoleSession\(\)\)\)/);
  assert.match(route, /apiUrl\(`\/api\/v1\/admin\/audit\?\$\{query\.toString\(\)\}`\)/);
  assert.match(route, /Authorization: `Bearer \$\{controlPlaneCredential\(\)\}`/);
  assert.match(route, /new URLSearchParams\(\{ limit: "100"/);
  const auditBranch = route.slice(route.indexOf('if (view === "audit")'), route.indexOf("  const path =", route.indexOf('if (view === "audit")')));
  assert.match(auditBranch, /actorPrincipalId.*applicationId.*tenantId.*action.*targetType.*targetId.*requestId.*traceId.*occurredAt/);
  assert.doesNotMatch(auditBranch, /metadata|secret|payload/i);
  const runtimeBranch = route.slice(route.indexOf('if (view === "runtime-models")'), route.indexOf('if (view === "health")'));
  assert.match(runtimeBranch, /NextResponse\.json\(body/);
  assert.doesNotMatch(runtimeBranch, /actorPrincipalId/);
});

test("Operations surfaces distinguish denied, failed, empty and bounded-sample states", () => {
  assert.match(shell, /response\.status === 403 \|\| response\.status === 404/);
  assert.match(audit, /state === "denied"/);
  assert.match(audit, /state === "failed"/);
  assert.match(audit, /events\.length === 0/);
  assert.match(audit, /visible\.length === 0/);
  assert.match(i18n, /auditSampleNotice: "Newest bounded sample.*Search and action filters apply only to this returned sample/);
});

test("Audit detail uses canonical controls, safe fields, relationships and no lifecycle commands", () => {
  for (const item of ["ActionButton", "EntityPicker", "Inspector", "SearchableSelect", "TextInput", "StateBeacon"]) assert.match(audit, new RegExp(`\\b${item}\\b`));
  assert.match(audit, /noMetadata/);
  assert.match(audit, /navigate\(destination, exactIdentity \|\| undefined\)/);
  assert.match(audit, /targetId, selected\.requestId, selected\.traceId/);
  assert.doesNotMatch(audit, /\bmetadata\b|<button|<select|archive|restore|acknowledge|recover\(/i);
  assert.doesNotMatch(audit, /components\/(?:gallery|dev)|dev\/(?:instruments|interface-system)/);
});

test("Health and Audit operational copy has English and Arabic source boundaries", () => {
  for (const key of ["healthSourceBoundary", "healthFault", "auditIntro", "auditSampleNotice", "auditDenied", "auditUnavailable", "auditReadOnly", "noMetadata", "relatedWorkspace"]) {
    assert.match(i18n, new RegExp(`\\b${key}:`), `missing EN/AR message key ${key}`);
  }
  const english = i18n.slice(i18n.indexOf("  en: {"), i18n.indexOf("  ar: {"));
  const arabic = i18n.slice(i18n.indexOf("  ar: {"), i18n.indexOf("export const navigation"));
  for (const key of ["healthSourceBoundary", "healthFault", "auditIntro", "auditSampleNotice", "auditDenied", "auditUnavailable", "auditReadOnly", "noMetadata", "relatedWorkspace"]) {
    assert.match(english, new RegExp(`\\b${key}:`));
    assert.match(arabic, new RegExp(`\\b${key}:`));
  }
  assert.match(audit, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);
});
