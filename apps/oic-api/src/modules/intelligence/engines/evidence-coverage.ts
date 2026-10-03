import { safeFingerprint } from "./cognitive-controller";
import type { EvidenceGraph } from "./evidence-graph";
import type { HypothesisAssessment } from "./hypothesis-engine";
import type { OicEvidence, TaskAnalysis } from "./types";

export type CoverageStatus = "NO_EVIDENCE" | "PARTIAL" | "SUPPORTED" | "CONFLICTED";
export type EvidenceCoverageItem = { id: string; kind: "GOAL" | "CONSTRAINT" | "HYPOTHESIS"; fingerprint: string; status: CoverageStatus; evidenceIds: string[]; gapFingerprint: string | null; priority: number };
export type EvidenceCoverageMatrix = { items: EvidenceCoverageItem[]; summary: { supported: number; partial: number; conflicted: number; missing: number; overall: "NONE" | "PARTIAL" | "ADEQUATE" | "CONFLICTED" }; nextGap: { itemId: string; queryFingerprint: string; reason: string } | null };

const words = (value: string) => [...new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((word) => !["the", "and", "for", "with", "that", "this", "from", "what", "when", "which", "into", "about"].includes(word)))];

/** Builds safe evidence coverage references; lexical overlap is coverage signal, not a truth probability. */
export function buildEvidenceCoverageMatrix(input: { goals: string[]; task: TaskAnalysis; evidence: OicEvidence[]; graph: EvidenceGraph; hypotheses?: HypothesisAssessment[] }): EvidenceCoverageMatrix {
  const items: EvidenceCoverageItem[] = [];
  const addTextItem = (kind: "GOAL" | "CONSTRAINT", index: number, text: string, priority: number) => {
    const expected = words(text);
    const matches = input.evidence.map((evidence) => {
      const evidenceWords = new Set(words(`${evidence.title} ${evidence.content}`));
      const overlap = expected.length ? expected.filter((word) => evidenceWords.has(word)).length / expected.length : 0;
      return { evidence, overlap };
    }).filter((item) => item.overlap >= 0.34);
    const ids = matches.map((item) => item.evidence.id);
    const conflicted = input.graph.conflicts.some((item) => item.unresolved !== false && item.evidenceIds.every((id) => ids.includes(id)));
    const supportedEdge = input.graph.edges.some((edge) => edge.relation === "SUPPORTS" && ids.includes(edge.from) && ids.includes(edge.to));
    const trustedToolMatch = matches.some((item) => item.evidence.trust === "TOOL_TRUSTED" && item.overlap >= 0.5);
    const status: CoverageStatus = conflicted ? "CONFLICTED" : !ids.length ? "NO_EVIDENCE" : supportedEdge || trustedToolMatch ? "SUPPORTED" : "PARTIAL";
    const fingerprint = safeFingerprint(text);
    items.push({ id: `${kind.toLocaleLowerCase()}-${index + 1}`, kind, fingerprint, status, evidenceIds: ids.slice(0, 8), gapFingerprint: status === "SUPPORTED" ? null : safeFingerprint(`gap:${kind}:${text}`), priority, });
  };
  input.goals.slice(0, 8).forEach((goal, index) => addTextItem("GOAL", index, goal, 100 - index));
  if (input.task.evidenceRequired) addTextItem("CONSTRAINT", 0, "required evidence source citation verification", 120);
  if (input.task.structuredOutput) addTextItem("CONSTRAINT", 1, "required structured output fields format", 110);
  for (const [index, hypothesis] of (input.hypotheses ?? []).entries()) {
    const status: CoverageStatus = hypothesis.assessment === "SUPPORTED" ? "SUPPORTED" : hypothesis.assessment === "CONTRADICTED" ? "CONFLICTED" : hypothesis.assessment === "INSUFFICIENT_EVIDENCE" ? "NO_EVIDENCE" : "PARTIAL";
    const ids = [...new Set([...hypothesis.supportingEvidenceIds, ...hypothesis.contradictingEvidenceIds])];
    items.push({ id: `hypothesis-${index + 1}`, kind: "HYPOTHESIS", fingerprint: hypothesis.fingerprint, status, evidenceIds: ids.slice(0, 8), gapFingerprint: status === "SUPPORTED" ? null : safeFingerprint(`gap:hypothesis:${hypothesis.fingerprint}`), priority: 90 - index });
  }
  const supported = items.filter((item) => item.status === "SUPPORTED").length;
  const partial = items.filter((item) => item.status === "PARTIAL").length;
  const conflicted = items.filter((item) => item.status === "CONFLICTED").length;
  const missing = items.filter((item) => item.status === "NO_EVIDENCE").length;
  const overall = conflicted ? "CONFLICTED" : !items.length || missing === items.length ? "NONE" : supported === items.length ? "ADEQUATE" : "PARTIAL";
  const gap = items.filter((item) => item.status !== "SUPPORTED").sort((left, right) => right.priority - left.priority)[0];
  return { items, summary: { supported, partial, conflicted, missing, overall }, nextGap: gap ? { itemId: gap.id, queryFingerprint: gap.gapFingerprint!, reason: `highest-priority unresolved ${gap.kind.toLocaleLowerCase()} coverage gap` } : null };
}
