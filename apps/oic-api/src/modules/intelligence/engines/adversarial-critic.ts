import type { CandidateComparison } from "./candidate-comparator";
import type { EvidenceGraph } from "./evidence-graph";
import type { VerificationResult } from "./types";

export type CriticFinding = { code: "REQUIREMENT_GAP" | "UNSUPPORTED_CLAIMS" | "EVIDENCE_CONFLICT" | "CANDIDATE_DISAGREEMENT" | "TOOL_INCONSISTENCY"; severity: "WARNING" | "BLOCKING"; references: string[] };
export type CriticResult = { decision: "CONTINUE" | "QUALIFY" | "REVISE"; findings: CriticFinding[] };

/** One deterministic critic pass over typed evidence and verifier state; it does not generate or persist hidden reasoning. */
export function runAdversarialCritic(input: { verification?: VerificationResult; evidenceGraph?: EvidenceGraph | null; candidates?: CandidateComparison | null; toolFailed?: boolean }): CriticResult {
  const findings: CriticFinding[] = [];
  const add = (code: CriticFinding["code"], severity: CriticFinding["severity"], references: string[] = []) => findings.push({ code, severity, references: [...new Set(references)] });
  const verification = input.verification;
  const missing = verification?.findings.filter((item) => item.dimension === "COMPLETENESS" && item.status !== "PASS") ?? [];
  if (missing.length) add("REQUIREMENT_GAP", "BLOCKING", missing.map((item) => item.code));
  const unsupported = verification?.claimEvidence?.claims.filter((item) => item.status === "UNSUPPORTED") ?? [];
  if (unsupported.length) add("UNSUPPORTED_CLAIMS", "BLOCKING", unsupported.map((item) => item.claimId));
  const conflicts = input.evidenceGraph?.conflicts.filter((item) => item.unresolved !== false) ?? [];
  if (conflicts.length) add("EVIDENCE_CONFLICT", "WARNING", conflicts.flatMap((item) => item.evidenceIds));
  if (input.candidates?.decision === "UNRESOLVED") add("CANDIDATE_DISAGREEMENT", "WARNING", input.candidates.selectedIds);
  if (input.toolFailed || verification?.findings.some((item) => item.dimension === "TOOL_CONSISTENCY" && item.status === "FAIL")) add("TOOL_INCONSISTENCY", "BLOCKING");
  return { decision: findings.some((item) => item.severity === "BLOCKING") ? "REVISE" : findings.length ? "QUALIFY" : "CONTINUE", findings };
}
