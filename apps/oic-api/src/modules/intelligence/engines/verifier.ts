import type { OicEvidence, TaskAnalysis, VerificationFinding, VerificationResult } from "./types";
import { contradictionPairs } from "./memory-policy";
import type { EvidenceGraph } from "./evidence-graph";
import { mapClaimsToEvidence } from "./claim-evidence";

function userRequest(input: Array<{ speaker: string; content: Array<{ text: string }> }>) { return input.filter((item) => item.speaker === "user").flatMap((item) => item.content.map((part) => part.text)).join("\n"); }

/** Deterministic checks for observable constraints; it does not claim to prove general factual correctness. */
export function verifyCandidate(input: { request: Array<{ speaker: string; content: Array<{ text: string }> }>; output: string; task: TaskAnalysis; evidence: OicEvidence[]; evidenceGraph?: EvidenceGraph | null; maxFindings?: number }): VerificationResult {
  const findings: VerificationFinding[] = [];
  const add = (dimension: VerificationFinding["dimension"], status: VerificationFinding["status"], code: string, evidenceIds: string[] = []) => {
    if (findings.length < (input.maxFindings ?? 24)) findings.push({ dimension, status, code, evidenceIds });
  };
  const request = userRequest(input.request);
  const candidate = input.output.trim();
  const claimEvidence = mapClaimsToEvidence(candidate, input.evidence, input.task.evidenceRequired);
  add("INSTRUCTION_COMPLIANCE", candidate ? "PASS" : "FAIL", candidate ? "non_empty_response" : "empty_response");
  if (input.task.structuredOutput && /\b(json|json object)\b/i.test(request)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const requiredText = /\brequired\s+fields?\s*:?\s*([^\n.!?]+)/i.exec(request)?.[1];
      const requiredFields = requiredText?.split(/,|\band\b|\bor\b/i).map((field) => field.trim().replace(/^(?:the\s+)?field\s+/i, "").replace(/[^A-Za-z0-9_]/g, "")).filter((field) => field && !["and", "or", "the", "a"].includes(field.toLocaleLowerCase())) ?? [];
      const missingFields = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? requiredFields.filter((field) => !(field in parsed)) : requiredFields;
      if (missingFields.length) add("STRUCTURE", "FAIL", `missing_required_json_fields:${missingFields.join(",")}`);
      else add("STRUCTURE", "PASS", "valid_json");
    }
    catch { add("STRUCTURE", "FAIL", "invalid_json"); }
  } else add("STRUCTURE", "PASS", "no_machine_readable_schema_declared");
  const subparts = request.split(/(?:\n+|[.!?;]+|\b(?:and then|also|while|because|then)\b)/i).map((part) => part.trim()).filter((part) => part.length >= 18);
  const missing = subparts.filter((part) => {
    const significant = part.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
    return significant.length > 0 && !significant.some((word) => candidate.toLocaleLowerCase().includes(word));
  });
  add("COMPLETENESS", missing.length ? "WARNING" : "PASS", missing.length ? `possible_missing_request_parts:${missing.length}` : "request_parts_represented");
  add("TASK_COMPLETION", candidate ? "PASS" : "FAIL", candidate ? "candidate_available" : "candidate_missing");
  const citationIds = [...candidate.matchAll(/\[(?:EVIDENCE|MEMORY)\s+([0-9a-f-]{16,})\b/gi)].map((match) => match[1]!);
  if (input.task.evidenceRequired && input.evidence.length) add("EVIDENCE_GROUNDING", citationIds.length ? "PASS" : "WARNING", citationIds.length ? "evidence_references_present" : "evidence_available_but_not_cited", citationIds);
  else if (input.task.evidenceRequired) add("EVIDENCE_GROUNDING", "WARNING", "no_retrieved_evidence_available");
  else add("EVIDENCE_GROUNDING", "PASS", "external_evidence_not_required");
  const dependencies = input.evidenceGraph?.edges.filter((edge) => edge.relation === "DEPENDS_ON" && citationIds.includes(edge.from)) ?? [];
  const unresolvedDependencies = dependencies.filter((edge) => !citationIds.includes(edge.to) || input.evidenceGraph?.conflicts.some((conflict) => conflict.unresolved !== false && conflict.evidenceIds.includes(edge.to)));
  if (unresolvedDependencies.length) add("EVIDENCE_GROUNDING", "WARNING", "cited_evidence_dependency_missing_or_conflicted", unresolvedDependencies.flatMap((edge) => [edge.from, edge.to]));
  if (input.task.evidenceRequired) add("UNSUPPORTED_CLAIM", claimEvidence.summary.unsupported ? "WARNING" : "PASS", claimEvidence.summary.unsupported ? `unsupported_claims:${claimEvidence.summary.unsupported}` : "claims_mapped_to_supplied_evidence", claimEvidence.claims.filter((claim) => claim.status === "UNSUPPORTED").flatMap((claim) => claim.evidenceIds));
  else add("UNSUPPORTED_CLAIM", "PASS", "external_evidence_not_required");
  const markedConflicts = input.evidence.filter((item) => item.relationship === "CONTRADICTS");
  const inferredConflicts = contradictionPairs(input.evidence.map((item) => ({ id: item.id, entityKey: item.title.toLocaleLowerCase().trim(), content: item.content })));
  const graphConflicts = input.evidenceGraph?.conflicts.filter((item) => item.unresolved !== false) ?? [];
  const contradictions = Math.max(graphConflicts.length, markedConflicts.length > 1 ? Math.floor(markedConflicts.length / 2) : markedConflicts.length, inferredConflicts.length);
  const conflictingIds = [...new Set([...graphConflicts.flatMap((item) => item.evidenceIds), ...markedConflicts.map((item) => item.id)])];
  add("CONTRADICTION", contradictions ? "WARNING" : "PASS", contradictions ? `retrieved_sources_conflict:${contradictions}` : "no_rule_detected_conflict", conflictingIds);
  add("LOGICAL_CONSISTENCY", contradictions ? "WARNING" : "PASS", contradictions ? "evidence_conflict_requires_qualification" : "no_detected_evidence_conflict");
  const toolResults = input.evidence.filter((item) => item.kind === "TOOL");
  const expectedToolValues = toolResults.map((item) => /(?:=|:)\s*(-?\d+(?:\.\d+)?)/.exec(item.content)?.[1]).filter((value): value is string => !!value);
  if (expectedToolValues.length) {
    const numericClaims: string[] = Array.from(candidate.matchAll(/-?\d+(?:\.\d+)?/g), (match) => match[0]);
    const present = expectedToolValues.every((value) => numericClaims.includes(value));
    add("CALCULATION", present ? "PASS" : "FAIL", present ? "deterministic_tool_result_present" : "deterministic_tool_result_missing_or_changed", toolResults.map((item) => item.id));
    add("TOOL_CONSISTENCY", present ? "PASS" : "FAIL", present ? "tool_result_consistent_with_candidate" : "tool_result_inconsistent_with_candidate", toolResults.map((item) => item.id));
  } else {
    add("CALCULATION", "PASS", "no_deterministic_calculation_requested");
    add("TOOL_CONSISTENCY", "PASS", "no_tool_result_requires_reconciliation");
  }
  const failures = findings.some((item) => item.status === "FAIL");
  const warnings = findings.some((item) => item.status === "WARNING");
  const mustRevise = findings.some((item) => item.code === "invalid_json" || item.code.startsWith("missing_required_json_fields:"));
  const status = mustRevise ? "REVISE" : failures ? "FAIL" : warnings ? "PASS_WITH_WARNINGS" : "PASS";
  return { status, findings, uncertainty: contradictions > 0 || claimEvidence.summary.unsupported > 0 || !candidate ? "HIGH_UNCERTAINTY" : warnings ? "MEDIUM_UNCERTAINTY" : input.task.uncertainty, claimEvidence };
}
