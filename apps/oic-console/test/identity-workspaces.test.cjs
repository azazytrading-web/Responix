/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.resolve(__dirname, "../app");
const identity = fs.readFileSync(path.join(appRoot, "features/identity/identity-views.tsx"), "utf8");
const shell = fs.readFileSync(path.join(appRoot, "console-app.tsx"), "utf8");
const actionRoute = fs.readFileSync(path.join(appRoot, "api/action/route.ts"), "utf8");
const apiRoot = path.resolve(__dirname, "../../oic-api/src");
const snapshot = fs.readFileSync(path.join(apiRoot, "modules/control-plane/console-snapshot.controller.ts"), "utf8");

function scopesFrom(source) {
  const match = source.match(/(?:const scopes =|const supportedScope = \(value: unknown\) =>)\s*\[([\s\S]*?)\](?:;|\.includes)/);
  assert.ok(match, "scope allowlist exists");
  return [...match[1].matchAll(/"(oic:[a-z:]+)"/g)].map((entry) => entry[1]).sort();
}

test("Applications, Tenants and Access are isolated production workspaces using the canonical Interface System", () => {
  assert.match(identity, /from "\.\.\/\.\.\/components\/interface"/);
  for (const view of ["applications", "tenants", "principals"]) assert.match(identity, new RegExp(`view === "${view}"`));
  assert.match(shell, /\["applications", "tenants", "principals"\]\.includes\(view\) && <IdentityViews/);
  for (const component of ["ApplicationPicker", "TenantPicker", "SearchableSelect", "WorkspaceTabs", "Inspector", "ArmThenExecute", "DangerAction", "TextInput"]) {
    assert.match(identity, new RegExp(`\\b${component}\\b`));
  }
  assert.doesNotMatch(identity, /<select\b|type=["']checkbox["']/i);
  assert.match(identity, /oic:navigate-identity/);
  assert.match(identity, /URLSearchParams\(window\.location\.search\)/);
  assert.match(identity, /filter\.trim\(\)\.toLocaleLowerCase/);
  assert.match(identity, /isApps \|\| !applicationFilter \|\| row\.applicationId === applicationFilter/);
  assert.match(identity, /lifecycle === "ALL"/);
  assert.match(identity, /shown\.length === 0/);
  assert.match(identity, /open=\{inspectorOpen && Boolean\(selected\)\}/);
  assert.match(identity, /createStep === 0\) continueCreate\(\); else void submit\(\)/);
  assert.match(identity, /createStep === 1 && <div className="x14-form-summary"/);
  assert.match(identity, /added: proposed\.filter/);
  assert.match(identity, /removed: current\.filter/);
  assert.match(identity, /x14-command-diff/);
  assert.match(shell, /URLSearchParams\(window\.location\.search\)/);
  assert.match(shell, /verifyIdentityReadback/);
  assert.match(shell, /className="locale-button"[\s\S]{0,180}onPress=\{\(\) => setLanguage/);
});

test("scope picker exactly matches BFF allowlist and never offers console-only scopes", () => {
  assert.deepEqual(scopesFrom(identity), scopesFrom(actionRoute));
  assert.doesNotMatch(identity, /oic:console:(?:read|admin)/);
});

test("credential handling is one-time, rotation-aware and secret-safe in snapshots", () => {
  assert.match(actionRoute, /body\.replacesId === undefined[\s\S]{0,140}uuid\(body\.replacesId\)/);
  assert.match(actionRoute, /replacesId: body\.replacesId/);
  assert.match(shell, /setIssuedCredential\(result\.credential\)/);
  assert.match(shell, /setIssuedCredential\(""\)/);
  assert.match(shell, /current === result\.credential \? "" : current/);
  assert.match(identity, /credential\.id/);
  assert.match(snapshot, /credentials:\s*\{[\s\S]*?select:\s*\{[\s\S]*?revokedAt:\s*true/);
  const principalCredentialSelect = snapshot.match(/credentials:\s*\{\s*select:\s*\{([\s\S]*?)\}\s*,/);
  assert.ok(principalCredentialSelect, "principal credential metadata is explicitly selected");
  assert.doesNotMatch(principalCredentialSelect[1], /secret|verifier|ciphertext|hash/i);
  assert.match(snapshot, /revokedAt:\s*credential\.revokedAt/);
});

test("external-reference remap requires revoked source, active same-application destination, and active source", () => {
  assert.match(identity, /candidate\.applicationId === tenant\.applicationId && candidate\.id !== tenant\.id && candidate\.status === "ACTIVE"/);
  assert.match(identity, /const sourceTenantIsActive = tenant\.status === "ACTIVE"/);
  assert.match(identity, /disabled=\{!sourceTenantIsActive \|\| !remapTargets/);
  assert.match(identity, /revoked \? <div className="x14-remap-control"/);
  assert.match(actionRoute, /action === "externalReference\.remap"[\s\S]*?path = `\/api\/v1\/admin\/applications\/\$\{applicationId\}\/external-references/);
});

test("production workspaces do not persist or log credentials and do not alter auth boundary", () => {
  assert.doesNotMatch(identity, /localStorage|sessionStorage|console\.(?:log|info|debug)\s*\(/);
  assert.match(shell, /credentialIntent/);
  assert.match(shell, /oneTimeSecret/);
  assert.match(actionRoute, /if \(!sameOrigin\(request\)\)/);
  assert.match(actionRoute, /if \(!\(await hasConsoleSession\(\)\)\)/);
  assert.match(actionRoute, /controlPlaneCredential\(\)/);
  assert.match(actionRoute, /runtimeCredential\(\)/);
});

test("X1.4 Arabic workspace copy is native Unicode rather than mojibake", () => {
  assert.match(identity, /search: "[^"]*[\u0600-\u06ff]/u);
  assert.doesNotMatch(identity, /(?:Ø.|Ù.|Ã.|â€)/);
});
