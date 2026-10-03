import type { ReasoningStrategy, VerificationResult } from "./types";

export type SubproblemNode = { id: string; goal: string; dependsOn: string[]; requiredEvidence: boolean; requiredTools: string[]; state: "READY" | "BLOCKED" };
export type CandidateRecord = { id: string; strategy: ReasoningStrategy; text: string; verification: VerificationResult; score: number };

/** Creates an ordered, bounded, declarative problem graph. Nodes contain goals only, never executable code. */
export function buildSubproblemGraph(requestText: string, maximum: number): SubproblemNode[] {
  const parts = requestText.split(/(?:\n+|[.!?;]+|\b(?:and then|also|while|because|then|after that|additionally)\b)/i).map((part) => part.trim()).filter((part) => part.length >= 12).slice(0, 8);
  const nodeLimit = Math.max(1, Math.min(8, maximum));
  if (parts.length > nodeLimit) parts.splice(nodeLimit - 1, parts.length - nodeLimit + 1, parts.slice(nodeLimit - 1).join("; "));
  const ordered = /\b(then|after that|using the result|once (?:that|this) is done|based on the previous)\b/i.test(requestText);
  return parts.map((goal, index) => ({ id: `problem-${index + 1}`, goal, dependsOn: ordered && index ? [`problem-${index}`] : [], requiredEvidence: /\b(source|evidence|according to|cite|verify|research|document)\b/i.test(goal), requiredTools: /\b(calculate|compute|solve)\b/i.test(goal) ? ["oic.calculator"] : [], state: !ordered || index === 0 ? "READY" : "BLOCKED" }));
}

/** Deterministic comparison emphasizes explicit constraints and verifier results; it does not equate majority with truth. */
export function scoreCandidate(candidate: Pick<CandidateRecord, "text" | "verification">): number {
  const status = candidate.verification.status === "PASS" ? 100 : candidate.verification.status === "PASS_WITH_WARNINGS" ? 70 : candidate.verification.status === "REVISE" ? 30 : 0;
  const findings = candidate.verification.findings.reduce((score, finding) => score + (finding.status === "FAIL" ? -20 : finding.status === "WARNING" ? -5 : 1), 0);
  return status + findings + Math.min(20, Math.floor(candidate.text.trim().length / 500));
}

export function candidateDisagreement(candidates: CandidateRecord[]): boolean {
  const normalized = new Set(candidates.map((candidate) => candidate.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()));
  return normalized.size > 1;
}
