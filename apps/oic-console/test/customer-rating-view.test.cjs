/* global __dirname */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const source = (path) => readFileSync(resolve(__dirname, "..", path), "utf8");

test("OIC-6.4 customer rating stays dark, scoped, revisioned, and separate from invoicing", () => {
  const view = source("app/features/operations/customer-rating-view.tsx");
  const bff = source("app/api/console/route.ts");
  const action = source("app/api/action/route.ts");
  const i18n = source("app/i18n.ts");

  assert.match(view, /DARK CUSTOMER RATING/);
  assert.match(view, /This is evidence, not billing/);
  assert.match(view, /OIU_RATE|RESOURCE_RATE/);
  assert.match(action, /INCLUDED_PLUS_OVERAGE/);
  assert.match(view, /FREE_PLAN|TRIAL_CREDIT|UNKNOWN_CONVERSION/);
  assert.match(view, /ratingTrace/);
  assert.match(view, /dir=\{direction\}/);
  assert.match(view, /DiscreteStepSelector/);
  for (const strategy of ["OIU_RATE", "RESOURCE_RATE", "REQUEST", "TASK", "FEATURE", "TIERED", "INCLUDED_PLUS_OVERAGE", "FIXED_PLUS_VARIABLE"]) assert.ok(view.includes(strategy), strategy);
  assert.match(view, /Reverse remaining amount/);
  assert.match(bff, /view === "rating"/);
  assert.match(bff, /customer-price-books/);
  assert.match(bff, /economics\/rated\?limit=50/);
  assert.match(bff, /economics\/fx-evidence\?limit=100/);
  assert.match(bff, /hasConsoleSession\(\)/);
  assert.match(bff, /Cache-Control.*no-store/);
  for (const actionName of ["rating.price-book.draft", "rating.price-book.publish", "rating.usage.rate", "rating.adjustment.create", "rating.fx.create"]) assert.ok(action.includes(actionName), actionName);
  assert.match(action, /sameOrigin\(request\)/);
  assert.match(action, /hasConsoleSession\(\)/);
  assert.match(i18n, /rating: "Customer Rating Studio"/);
  assert.match(i18n, /rating: "استوديو تسعير العميل"/);
  assert.doesNotMatch(view, /\b(fetch\(|axios\.)[^\n]*127\.0\.0\.1:4100/);
});
