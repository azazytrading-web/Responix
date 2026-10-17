import test from "node:test";
import assert from "node:assert/strict";
import { evaluateObjectiveOracle, OBJECTIVE_ORACLE_METHOD } from "./objective-oracle";

void test("exact byte oracle preserves missing, invalid and measured failure states", () => {
  const reference = Buffer.from("4");
  assert.deepEqual(evaluateObjectiveOracle(Buffer.from("4"), reference), { method: OBJECTIVE_ORACLE_METHOD, availability: "MEASURED", success: true, reason: "MATCH" });
  assert.deepEqual(evaluateObjectiveOracle(Buffer.from("5"), reference), { method: OBJECTIVE_ORACLE_METHOD, availability: "MEASURED", success: false, reason: "MISMATCH" });
  assert.deepEqual(evaluateObjectiveOracle(null, reference), { method: OBJECTIVE_ORACLE_METHOD, availability: "INSUFFICIENT", success: null, reason: "OUTPUT_MISSING" });
  assert.deepEqual(evaluateObjectiveOracle(Buffer.from("4"), Buffer.alloc(0)), { method: OBJECTIVE_ORACLE_METHOD, availability: "INVALID", success: null, reason: "ORACLE_INVALID" });
});
