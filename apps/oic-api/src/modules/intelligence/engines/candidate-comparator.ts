import type { VerificationResult } from "./types";
import { createHash } from "node:crypto";

export type CandidateForComparison = { id: string; text: string; verification: VerificationResult; resourceCost: number; strategy?: string };
export type CandidateAssessment = { id: string; constraintCoverage: number; evidenceStatus: string; toolStatus: string; verificationStatus: string; resourceCost: number; score: number };
export type CandidateComparison = { decision: "SELECT" | "MERGE" | "REVISE" | "UNRESOLVED"; controllerAction: "SELECT" | "MERGE" | "REPAIR_BEST" | "GATHER_MORE_EVIDENCE" | "EXPLORE_ALTERNATIVE" | "UNRESOLVED"; selectedIds: string[]; assessments: CandidateAssessment[]; disagreement: boolean; diversity: { inputCount: number; uniqueCount: number; nearDuplicatePairs: Array<[string, string]>; structuralFingerprints: Array<{ id: string; fingerprint: string }> } };

function structure(text: string): { fingerprint: string; features: Set<string> } {
  const normalized = text.toLocaleLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  const filtered = normalized.filter((token) => !["the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "have", "has", "will"].includes(token));
  const numbers = filtered.filter((token) => /^\d/.test(token));
  const negation = /\b(no|not|never|cannot|without|isn't|doesn't)\b/i.test(text) ? "NEG" : "POS";
  const features = new Set([...filtered, `POLARITY:${negation}`, ...numbers.map((item) => `NUMBER:${item}`)]);
  const fingerprint = createHash("sha256").update([...features].sort().join("|")).digest("hex").slice(0, 20);
  return { fingerprint, features };
}

/** Removes wording-only duplicates while preserving the first candidate's assigned strategy. */
export function deduplicateCandidates<T extends { id: string; text: string }>(candidates: T[], threshold = 0.9): { unique: T[]; fingerprints: Array<{ id: string; fingerprint: string }>; nearDuplicatePairs: Array<[string, string]> } {
  const unique: T[] = [];
  const fingerprints: Array<{ id: string; fingerprint: string }> = [];
  const nearDuplicatePairs: Array<[string, string]> = [];
  const features: Array<{ id: string; values: Set<string> }> = [];
  for (const candidate of candidates) {
    const current = structure(candidate.text);
    const duplicate = features.find((prior) => {
      const intersection = [...current.features].filter((item) => prior.values.has(item)).length;
      const union = new Set([...current.features, ...prior.values]).size;
      return union > 0 && intersection / union >= threshold;
    });
    fingerprints.push({ id: candidate.id, fingerprint: current.fingerprint });
    if (duplicate) { nearDuplicatePairs.push([duplicate.id, candidate.id]); continue; }
    unique.push(candidate);
    features.push({ id: candidate.id, values: current.features });
  }
  return { unique, fingerprints, nearDuplicatePairs };
}

/** Bounded deterministic comparator. Verifier dimensions dominate answer length; resource cost breaks otherwise equal choices. */
export function compareCandidates(candidates: CandidateForComparison[], allowSynthesis: boolean): CandidateComparison {
  const diversity = deduplicateCandidates(candidates);
  const distinctCandidates = diversity.unique;
  const assessments = candidates.map((candidate) => {
    const findings = candidate.verification.findings;
    const constraintFindings = findings.filter((item) => ["STRUCTURE", "COMPLETENESS", "TASK_COMPLETION", "INSTRUCTION_COMPLIANCE"].includes(item.dimension));
    const constraintCoverage = constraintFindings.filter((item) => item.status === "PASS").length;
    const failures = findings.filter((item) => item.status === "FAIL").length;
    const warnings = findings.filter((item) => item.status === "WARNING").length;
    const evidenceStatus = findings.find((item) => item.dimension === "EVIDENCE_GROUNDING")?.status ?? "NOT_REQUIRED";
    const toolStatus = findings.find((item) => item.dimension === "TOOL_CONSISTENCY")?.status ?? "NOT_REQUIRED";
    const verificationStatus = candidate.verification.status;
    const score = constraintCoverage * 20 + (evidenceStatus === "PASS" ? 12 : evidenceStatus === "WARNING" ? 0 : 4) + (toolStatus === "PASS" ? 8 : toolStatus === "FAIL" ? -20 : 2) - failures * 30 - warnings * 5 - candidate.resourceCost;
    return { id: candidate.id, constraintCoverage, evidenceStatus, toolStatus, verificationStatus, resourceCost: candidate.resourceCost, score };
  }).sort((left, right) => right.score - left.score || left.resourceCost - right.resourceCost || left.id.localeCompare(right.id));
  const normalized = new Set(distinctCandidates.map((item) => item.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()));
  const disagreement = normalized.size > 1;
  const best = assessments[0];
  if (!best) return { decision: "UNRESOLVED", controllerAction: "UNRESOLVED", selectedIds: [], assessments, disagreement, diversity: { inputCount: candidates.length, uniqueCount: diversity.unique.length, nearDuplicatePairs: diversity.nearDuplicatePairs, structuralFingerprints: diversity.fingerprints } };
  const bestCandidate = candidates.find((item) => item.id === best.id)!;
  if (bestCandidate.verification.status === "FAIL" || bestCandidate.verification.status === "REVISE") return { decision: "REVISE", controllerAction: "REPAIR_BEST", selectedIds: [best.id], assessments, disagreement, diversity: { inputCount: candidates.length, uniqueCount: diversity.unique.length, nearDuplicatePairs: diversity.nearDuplicatePairs, structuralFingerprints: diversity.fingerprints } };
  if (disagreement && allowSynthesis && diversity.unique.length > 1) return { decision: "MERGE", controllerAction: "MERGE", selectedIds: diversity.unique.map((item) => item.id), assessments, disagreement, diversity: { inputCount: candidates.length, uniqueCount: diversity.unique.length, nearDuplicatePairs: diversity.nearDuplicatePairs, structuralFingerprints: diversity.fingerprints } };
  if (disagreement && diversity.unique.length > 1 && Math.abs(best.score - assessments[1]!.score) < 10) return { decision: "UNRESOLVED", controllerAction: "GATHER_MORE_EVIDENCE", selectedIds: diversity.unique.map((item) => item.id), assessments, disagreement, diversity: { inputCount: candidates.length, uniqueCount: diversity.unique.length, nearDuplicatePairs: diversity.nearDuplicatePairs, structuralFingerprints: diversity.fingerprints } };
  return { decision: "SELECT", controllerAction: disagreement ? "EXPLORE_ALTERNATIVE" : "SELECT", selectedIds: [best.id], assessments, disagreement, diversity: { inputCount: candidates.length, uniqueCount: diversity.unique.length, nearDuplicatePairs: diversity.nearDuplicatePairs, structuralFingerprints: diversity.fingerprints } };
}
