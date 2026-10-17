import { createHash } from "node:crypto";

export const EMPTY_VISIBLE_OUTPUT_ENCODING = "OIC_EMPTY_VISIBLE_OUTPUT_V1";

/** A non-empty vault artifact for a successful provider response with no visible text. */
export function encodeEmptyVisibleOutput(attemptId: string, finishReason: "completed" | "output-limit" | "unknown" = "unknown"): Buffer {
  return Buffer.from(JSON.stringify({
    schema: EMPTY_VISIBLE_OUTPUT_ENCODING,
    attemptId,
    finishReason,
    visibleOutput: "",
    visibleOutputByteLength: 0,
    visibleOutputDigest: createHash("sha256").update("").digest("hex")
  }), "utf8");
}

export function decodeVisibleOutput(artifact: Buffer, encoding: unknown, attemptId: string): Buffer {
  if (encoding === undefined) return artifact;
  if (encoding !== EMPTY_VISIBLE_OUTPUT_ENCODING) throw new Error("VISIBLE_OUTPUT_ENCODING_INVALID");
  let envelope: unknown;
  try { envelope = JSON.parse(artifact.toString("utf8")); }
  catch { throw new Error("VISIBLE_OUTPUT_ENVELOPE_INVALID"); }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("VISIBLE_OUTPUT_ENVELOPE_INVALID");
  const row = envelope as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "attemptId,finishReason,schema,visibleOutput,visibleOutputByteLength,visibleOutputDigest" ||
      row.schema !== EMPTY_VISIBLE_OUTPUT_ENCODING || row.attemptId !== attemptId ||
      !["completed", "output-limit", "unknown"].includes(String(row.finishReason)) ||
      row.visibleOutput !== "" || row.visibleOutputByteLength !== 0 ||
      row.visibleOutputDigest !== createHash("sha256").update("").digest("hex")) {
    throw new Error("VISIBLE_OUTPUT_ENVELOPE_INVALID");
  }
  return Buffer.alloc(0);
}
