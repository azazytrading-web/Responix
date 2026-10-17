import test from "node:test";
import assert from "node:assert/strict";
import { safeWorkerDiagnostic } from "./evaluation-worker";

void test("unknown pre-provider exceptions retain a deterministic bounded fingerprint without their message", () => {
  const secretLike = "Authorization: Bearer top-secret-value; database_url=postgres://private";
  const first = safeWorkerDiagnostic(new TypeError(secretLike), "RUNTIME_CONTEXT");
  const second = safeWorkerDiagnostic(new TypeError("different private detail"), "RUNTIME_CONTEXT");
  assert.equal(first.code, "UNKNOWN_EXCEPTION");
  assert.equal(first.type, "TypeError");
  assert.equal(first.stage, "RUNTIME_CONTEXT");
  assert.equal(first.component, "RUNTIME_CONTEXT");
  assert.equal(first.message, "Pre-provider RUNTIME_CONTEXT failed: UNKNOWN_EXCEPTION");
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.fingerprint.length, 64);
  assert.equal(first.stackFrame === null || first.stackFrame === undefined || /^oic-api\/(src|dist)\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*:\d+:\d+$/.test(first.stackFrame), true);
  assert.doesNotMatch(JSON.stringify(first), /top-secret-value|private|postgres|Bearer/i);
});

void test("untrusted stage and exception type text are normalized before persistence", () => {
  const diagnostic = safeWorkerDiagnostic({ name: "Authorization: Bearer exposed", message: "secret" }, "RUNTIME_CONTEXT;token=exposed");
  assert.equal(diagnostic.stage, "UNKNOWN_STAGE");
  assert.equal(diagnostic.code, "UNKNOWN_EXCEPTION");
  assert.equal(diagnostic.type, "UnknownError");
  assert.doesNotMatch(JSON.stringify(diagnostic), /exposed|secret|Authorization|Bearer/i);
});
