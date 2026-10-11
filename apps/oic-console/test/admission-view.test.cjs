const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { cwd } = require("node:process");

const source = (file) => fs.readFileSync(path.join(cwd(), file), "utf8");

test("OIC-6.3 admission workspace keeps revisioned policy, ledger evidence, and Arabic/RTL controls", () => {
  const view = source("app/features/operations/admission-view.tsx");
  const bff = source("app/api/console/route.ts");
  const action = source("app/api/action/route.ts");
  const i18n = source("app/i18n.ts");
  assert.match(view, /Admission Control Studio/);
  assert.match(view, /استوديو ضبط القبول/);
  assert.match(view, /dir=\{direction\}/);
  assert.match(view, /DiscreteStepSelector/);
  assert.match(view, /<MultiSelect label=\{tr\("Entitled Oi models"/);
  assert.match(view, /models: showAdvancedIds \? models\.split/);
  assert.match(view, /edition\.visibility/);
  assert.doesNotMatch(view, /Entitled Oi model IDs, comma separated/);
  assert.match(view, /not interpreted as zero/);
  assert.match(view, /held/);
  assert.match(view, /uncertain/);
  assert.match(bff, /view === "admission"/);
  assert.match(bff, /admin\/admission\/balances\?limit=50/);
  assert.match(bff, /Cache-Control.*no-store/);
  for (const operation of ["admission.plan.create", "admission.plan.publish", "admission.assignment.create", "admission.quota.create", "admission.quota.publish", "admission.budget.create", "admission.budget.publish"]) assert.ok(action.includes(operation), operation);
  assert.match(action, /sameOrigin\(request\)/);
  assert.match(action, /hasConsoleSession\(\)/);
  assert.match(i18n, /admission: "Admission Control Studio"/);
  assert.match(i18n, /admission: "استوديو ضبط القبول"/);
});
