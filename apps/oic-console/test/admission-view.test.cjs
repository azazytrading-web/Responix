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
  assert.match(view, /Plans, quotas & admission/);
  assert.match(view, /الخطط والحصص والقبول/);
  assert.match(view, /dir=\{direction\}/);
  assert.match(view, /DiscreteStepSelector/);
  assert.match(view, /Unknown liability remains reserved/);
  assert.match(view, /held/);
  assert.match(view, /uncertain/);
  assert.match(bff, /view === "admission"/);
  assert.match(bff, /admin\/admission\/balances\?limit=50/);
  assert.match(bff, /Cache-Control.*no-store/);
  for (const operation of ["admission.plan.create", "admission.plan.publish", "admission.assignment.create", "admission.quota.create", "admission.quota.publish", "admission.budget.create", "admission.budget.publish"]) assert.ok(action.includes(operation), operation);
  assert.match(action, /sameOrigin\(request\)/);
  assert.match(action, /hasConsoleSession\(\)/);
  assert.match(i18n, /admission: "Plans & quotas"/);
  assert.match(i18n, /admission: "الخطط والحصص"/);
});
