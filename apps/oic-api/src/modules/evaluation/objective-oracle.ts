import { timingSafeEqual } from "node:crypto";

export const OBJECTIVE_ORACLE_METHOD = "REFERENCE_EXACT_BYTES_V1" as const;
export const OBJECTIVE_ORACLE_IMPLEMENTATION_DIGEST = "d9e97ca62cf20f446b4c69a80f8d6eb71040e673a2bd34dbc7c9b145dff1b232" as const;

export type ObjectiveOracleResult = {
  method: typeof OBJECTIVE_ORACLE_METHOD;
  availability: "MEASURED" | "INSUFFICIENT" | "INVALID";
  success: boolean | null;
  reason: "MATCH" | "MISMATCH" | "OUTPUT_MISSING" | "OUTPUT_INVALID" | "ORACLE_INVALID" | "EXECUTION_FAILED";
};

export function evaluateObjectiveOracle(output: Buffer | null, reference: Buffer): ObjectiveOracleResult {
  if (!Buffer.isBuffer(reference) || reference.length === 0 || reference.length > 1024 * 1024) return { method: OBJECTIVE_ORACLE_METHOD, availability: "INVALID", success: null, reason: "ORACLE_INVALID" };
  if (output === null) return { method: OBJECTIVE_ORACLE_METHOD, availability: "INSUFFICIENT", success: null, reason: "OUTPUT_MISSING" };
  if (!Buffer.isBuffer(output) || output.length > 1024 * 1024) return { method: OBJECTIVE_ORACLE_METHOD, availability: "INVALID", success: null, reason: "OUTPUT_INVALID" };
  const same = output.length === reference.length && timingSafeEqual(output, reference);
  return { method: OBJECTIVE_ORACLE_METHOD, availability: "MEASURED", success: same, reason: same ? "MATCH" : "MISMATCH" };
}
