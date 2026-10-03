export type MemoryWriteRequest = {
  novelty: number;
  durability: number;
  usefulness: number;
  futureReuse: number;
  confidence: number;
  sourceQuality: number;
  contradictionRisk: number;
  sensitivity: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "RESTRICTED";
  duplicateSimilarity: number;
  kind: "EPISODIC" | "SEMANTIC" | "PROCEDURAL" | "SESSION" | "APPLICATION";
  applicationPolicyAllows: boolean;
  explicitlyApproved: boolean;
};
export type MemoryWriteDecision = { decision: "IGNORE" | "WORKING_ONLY" | "SESSION" | "EPISODIC" | "SEMANTIC" | "PROCEDURAL_CANDIDATE" | "DURABLE"; score: number; reasons: string[] };

/** Conservative write gate: sensitive and duplicate material is not persisted; procedural items always need review. */
export function decideMemoryWrite(input: MemoryWriteRequest): MemoryWriteDecision {
  if (!input.applicationPolicyAllows) return { decision: "IGNORE", score: 0, reasons: ["application memory policy denied writes"] };
  if (input.sensitivity === "SENSITIVE" || input.sensitivity === "RESTRICTED") return { decision: "WORKING_ONLY", score: 0, reasons: ["sensitive or restricted material is not eligible for persistence"] };
  if (input.duplicateSimilarity >= 0.9) return { decision: "IGNORE", score: 0, reasons: ["near-duplicate memory exists"] };
  const signals = [input.novelty, input.durability, input.usefulness, input.futureReuse, input.confidence, input.sourceQuality].map((value) => Math.max(0, Math.min(100, value)));
  const score = Math.round(signals.reduce((sum, value) => sum + value, 0) / signals.length - Math.max(0, Math.min(100, input.contradictionRisk)) * 0.35 - Math.max(0, input.duplicateSimilarity) * 20);
  if (score < 35) return { decision: input.kind === "SESSION" ? "SESSION" : "WORKING_ONLY", score, reasons: ["durability, confidence, or reuse signals were too low"] };
  if (input.kind === "PROCEDURAL") return { decision: "PROCEDURAL_CANDIDATE", score, reasons: ["procedural memory requires explicit operator approval"] };
  if (!input.explicitlyApproved) return { decision: input.kind === "SESSION" ? "SESSION" : "WORKING_ONLY", score, reasons: ["persistent memory requires explicit approval"] };
  if (input.kind === "EPISODIC" || input.kind === "SESSION") return { decision: input.kind, score, reasons: ["approved time-bound execution memory"] };
  return { decision: input.kind === "APPLICATION" ? "DURABLE" : "SEMANTIC", score, reasons: ["approved durable fact with acceptable evidence signals"] };
}

export function contradictionPairs<T extends { id: string; entityKey?: string | null; content: string }>(items: T[]): Array<{ leftId: string; rightId: string }> {
  const pairs: Array<{ leftId: string; rightId: string }> = [];
  const negative = /\b(no|not|never|false|cannot|can't|isn't|doesn't|without)\b/i;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const left = items[i]!, right = items[j]!;
    if (left.entityKey && left.entityKey === right.entityKey && negative.test(left.content) !== negative.test(right.content)) pairs.push({ leftId: left.id, rightId: right.id });
  }
  return pairs;
}
