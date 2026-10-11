/* global __dirname */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const source = (path) => readFileSync(resolve(__dirname, "..", path), "utf8");

test("OIC-6 reconstruction keeps scope, dual economics paths, admission effects, and rating evidence source-backed", () => {
  const usage = source("app/features/operations/usage-evidence-view.tsx");
  const economics = source("app/features/operations/economics-view.tsx");
  const admission = source("app/features/operations/admission-view.tsx");
  const rating = source("app/features/operations/customer-rating-view.tsx");
  const styles = source("app/styles.css");

  assert.match(usage, /ApplicationPicker/);
  assert.match(usage, /TenantPicker/);
  assert.match(usage, /scope\.set\("applicationId"/);
  assert.match(usage, /usage-attempts&\$\{scope\.toString\(\)\}/);
  assert.match(usage, /usage-receipts-panel/);
  assert.match(usage, /DORMANT \u00b7 no source evidence/);
  assert.match(usage, /usage-scope-toolbar/);
  assert.match(usage, /usage-summary/);
  assert.match(usage, /usage-summary-empty/);
  assert.match(usage, /usage-evidence-pipeline/);
  assert.match(usage, /usage-investigation-workspace/);
  assert.match(usage, /row\.providerAttemptId !== selected\.id/);
  assert.doesNotMatch(usage, /usage-investigation-tools/);
  for (const copy of [usage, economics, admission, rating]) {
    assert.doesNotMatch(copy, /[\u00c3\u00e2\u00d8\u00d9\ufffd]/, 'changed OIC-6 copy must not contain mojibake');
  }
  assert.match(economics, /economics-dual-path/);
  assert.match(economics, /economics-dormant-derivation/);
  assert.match(economics, /economics-empty-summary/);
  assert.match(economics, /economics-empty-path/);
  assert.match(economics, /economics-derivation-line/);
  assert.match(economics, /economics-path-expense/);
  assert.match(economics, /economics-path-oiu/);
  assert.match(economics, /NumericInstrument/);
  assert.match(admission, /data-active-editor=\{activeEditor\}/);
  assert.match(admission, /data-active-history=\{activeHistory\}/);
  assert.match(admission, /admission-empty-overview/);
  assert.match(admission, /History view/);
  assert.match(admission, /admission-policy-tree/);
  assert.match(admission, /admission-effect-summary/);
  assert.match(admission, /not an admission simulation/);
  assert.match(admission, /CURRENT PERSISTED STATE/);
  assert.match(admission, /BALANCE EVIDENCE UNAVAILABLE/);
  assert.match(admission, /admission-entitlement-readout/);
  assert.match(admission, /row\.available \?\? row\.remaining/);
  assert.match(rating, /customer-rating-view/);
  assert.match(rating, /rating-empty-summary/);
  assert.match(rating, /NOT_RATED/);
  assert.match(rating, /UNKNOWN_CONVERSION/);
  assert.match(rating, /rating-control-workspace/);
  assert.match(rating, /data-rating-surface=\{activeSurface\}/);
  assert.match(rating, /data-active-surface=\{activeSurface\}/);
  assert.match(rating, /data-active-history=\{activeHistory\}/);
  assert.match(rating, /rating-correction-controls/);
  assert.match(rating, /Rated event to correct/);
  assert.doesNotMatch(rating, /Rated event ID/);
  assert.doesNotMatch(rating, /Adjustment idempotency key/);
  assert.match(rating, /randomUUID/);
  assert.match(rating, /rating-fx-workflow/);
  assert.match(styles, /data-active-editor="quota"/);
  assert.match(styles, /rating-source-records/);
  assert.match(styles, /rating-control-workspace/);
  assert.match(styles, /\.usage-investigation-workspace\{display:grid/);
  assert.match(styles, /data-active-history=plans/);
  assert.match(styles, /overflow:visible/);
});
