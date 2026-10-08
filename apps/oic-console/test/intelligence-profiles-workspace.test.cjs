/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relative) => fs.readFileSync(path.resolve(__dirname, relative), "utf8");

test("profile workspace uses the current immutable profile contract and verifies persisted changes", () => {
  const workspace = read("../app/features/intelligence/intelligence-profiles-workspace.tsx");
  const service = read("../../oic-api/src/modules/intelligence/intelligence-profile.service.ts");
  assert.match(workspace, /useConfigurationDraft/);
  assert.match(workspace, /PresetSelector/);
  assert.match(workspace, /IntensitySlider/);
  assert.match(workspace, /BudgetSlider/);
  assert.match(workspace, /ConfigurationDiff/);
  assert.match(workspace, /IMMUTABLE REVISION/);
  assert.match(workspace, /VERIFIED FROM PROFILE READBACK/);
  assert.match(workspace, /profile-detail&profileId=/);
  assert.match(service, /profile\.source === "BUILTIN"/);
  assert.match(service, /profile\.lifecycle !== "ACTIVE"/);
  assert.match(service, /Archived intelligence profiles cannot be restored/);
  assert.match(service, /async createRevision/);
});

test("DNA registry is sourced from the OIC metric definitions and stays unmeasured", () => {
  const workspace = read("../app/features/intelligence/intelligence-profiles-workspace.tsx");
  const registry = read("../app/features/overview/metric-registry.ts");
  assert.match(workspace, /metricDefinitions\.filter\(\(definition\) => definition\.key\.startsWith\("dna\."\)\)/);
  assert.match(workspace, /availability: "UNMEASURED"/);
  assert.match(workspace, /dependency: "OIC-7"/);
  assert.match(workspace, /<DNARadar dimensions=\{selectedDNA\}/);
  assert.doesNotMatch(workspace, /state:\s*"MEASURED"|value:\s*0\.\d+/);
  assert.match(registry, /sourceOwnership: "OIC-7 evaluation engine \(not configured\)"/);
  assert.match(registry, /maturity: "PLANNED"/);
});

test("profile detail BFF route remains session and machine credential gated", () => {
  const bff = read("../app/api/console/route.ts");
  assert.match(bff, /hasConsoleSession\(\)/);
  assert.match(bff, /controlPlaneCredential\(\)/);
  assert.match(bff, /view === "profile-detail"/);
  assert.match(bff, /\^\[0-9a-f-\]\{36\}\$\/i\.test\(profileId\)/);
  assert.match(bff, /Authorization: `Bearer \$\{controlPlaneCredential\(\)\}`/);
});

test("workspace includes translated layout direction, archived filtering, bounded relationships and configuration-only comparison", () => {
  const workspace = read("../app/features/intelligence/intelligence-profiles-workspace.tsx");
  assert.match(workspace, /const dir = ar \? "rtl" : "ltr"/);
  assert.match(workspace, /showArchived/);
  assert.match(workspace, /profileRevisionId/);
  assert.match(workspace, /modelRevisionUses/);
  assert.match(workspace, /function linkedModelRevisions\(snapshot: Snapshot \| null, profileRevisionId: string\)/);
  assert.match(workspace, /revision\.intelligenceProfileRevisionId/);
  assert.match(workspace, /=== profileRevisionId/);
  assert.match(workspace, /profile r\$\{text\(profileRevision\.revision\)\}/);
  assert.match(workspace, /higher is not better/);
  assert.match(workspace, /disabled profiles cannot be restored|Archived profiles cannot be restored/);
});

test("profile workspace English and Arabic message keys stay aligned with native Arabic copy", () => {
  const workspace = read("../app/features/intelligence/intelligence-profiles-workspace.tsx");
  const dictionary = (name) => workspace.match(new RegExp(`const ${name}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`))[1];
  const keys = (source) => [...source.matchAll(/(?:^|, )([A-Za-z][A-Za-z0-9]+):/g)].map((match) => match[1]);
  const english = keys(dictionary("english"));
  const arabic = keys(dictionary("arabic"));
  assert.deepEqual(arabic.sort(), english.sort());
  assert.match(dictionary("arabic"), /[\u0600-\u06ff]/);
  assert.match(dictionary("english"), /maxProviderCalls: "Provider call ceiling"/);
  assert.match(dictionary("arabic"), /maxProviderCalls: "\\u/);
  assert.match(workspace, /configured: 0/);
  assert.match(workspace, /measuredDimensions/);
  assert.match(workspace, /unmeasuredDimensions/);
  assert.match(workspace, /ActionMenu label=\{t\("moreActions"\)\}/);
});

test("compare and source revision selection use canonical pickers and shared accessible inspectors", () => {
  const workspace = read("../app/features/intelligence/intelligence-profiles-workspace.tsx");
  assert.match(workspace, /ProfilePicker label=\{t\("compareProfile"\)\}/);
  assert.match(workspace, /RevisionPicker label=\{t\("selectedRevision"\)\}/);
  assert.match(workspace, /<Inspector open=\{createOpen\}/);
  assert.match(workspace, /<Inspector open=\{!!confirmLifecycle\}/);
  assert.match(workspace, /type: t\("revision"\)/);
  assert.match(workspace, /secondary: String\(revision\.id\)/);
});

test("profile DNA labels are native Arabic and workspace text has no mojibake", () => {
  const workspace = read("../app/features/intelligence/intelligence-profiles-workspace.tsx");
  const dnaCopy = workspace.slice(workspace.indexOf("const arabicDna"), workspace.indexOf("function Summary"));
  assert.match(dnaCopy, /[\u0600-\u06ff]/);
  assert.doesNotMatch(workspace, /[ÃÂØÙ�]/);
});
