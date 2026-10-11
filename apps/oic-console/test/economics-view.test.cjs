/* global __dirname */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const source = (path) => readFileSync(resolve(__dirname, "..", path), "utf8");

test("economics workspace keeps provider expense, OIU, unknown values and source provenance distinct", () => {
  const view = source("app/features/operations/economics-view.tsx");
  const bff = source("app/api/console/route.ts");
  const action = source("app/api/action/route.ts");

  assert.match(view, /Provider expense assessments/);
  assert.match(view, /economics-dual-path/);
  assert.match(view, /Provider rate book/);
  assert.match(view, /OIU policy/);
  assert.match(view, /NumericInstrument/);
  assert.match(view, /OIU assessments & postings/);
  assert.match(view, /UNKNOWN or PARTIAL/);
  assert.match(view, /No customer rating or invoice/);
  assert.match(view, /sourceDigest/);
  assert.match(view, /\u0627\u0642\u062a\u0635\u0627\u062f\u064a\u0627\u062a/);
  assert.doesNotMatch(view, /[\u00d8\u00d9][\u0080-\u00ff]/);
  assert.match(bff, /view === "economics"/);
  assert.match(bff, /cache: "no-store"/);
  assert.match(action, /oic:economics:read/);
  assert.match(action, /oic:economics:manage/);
});
