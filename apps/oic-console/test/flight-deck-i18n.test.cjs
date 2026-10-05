/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadCopy() {
  const filename = path.resolve(__dirname, "../app/features/overview/flight-deck-copy.ts");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports.flightDeckCopy;
}

test("Flight Deck Arabic copy stays native UTF-8 and the live locale maps stay usable", () => {
  const copy = loadCopy();
  const en = copy("en");
  const ar = copy("ar");
  const required = ["heroLabel", "rangeLive", "systemCore", "evaluationRack", "modelDna", "providerNetwork", "modelFactoryProcess", "intelligenceLab", "cognitiveActivity", "liveOperations", "toolsActivity", "verificationActivity", "repairActivity", "backtrackingActivity", "toolsActivityHelp"];
  for (const key of required) {
    assert.equal(typeof en[key], "string", `English ${key}`);
    assert.equal(typeof ar[key], "string", `Arabic ${key}`);
    assert.match(ar[key], /[\u0600-\u06ff]/u, `native Arabic ${key}`);
    assert.doesNotMatch(ar[key], /[\u00c3\u00c2\u00d8\u00d9\ufffd]/u, `no mojibake ${key}`);
  }
  for (const [key, value] of Object.entries(ar)) assert.doesNotMatch(value, /[\u00c3\u00c2\u00d8\u00d9\ufffd]/u, `no mojibake ${key}`);
  assert.equal(en.rangeLive, "LIVE");
  assert.equal(ar.rangeLive, "مباشر");
});
