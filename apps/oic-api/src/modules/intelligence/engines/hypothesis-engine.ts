import { createHash } from "node:crypto";
import type { EvidenceGraph } from "./evidence-graph";
import type { OicEvidence } from "./types";

export type HypothesisStatus = "SUPPORTED" | "WEAKLY_SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT_EVIDENCE";
export type Hypothesis = { id: string; statement: string; fingerprint: string; requiredEvidenceTypes: string[] };
export type HypothesisAssessment = {
  id: string;
  fingerprint: string;
  assessment: HypothesisStatus;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  unresolvedGaps: string[];
};
export type HypothesisLimits = { maxHypotheses: number; maxEvidenceQueriesPerHypothesis: number; maxCounterEvidenceQueries: number; maxHypothesisRounds: number };
export const DEFAULT_HYPOTHESIS_LIMITS: HypothesisLimits = { maxHypotheses: 3, maxEvidenceQueriesPerHypothesis: 2, maxCounterEvidenceQueries: 2, maxHypothesisRounds: 1 };
export type HypothesisEvidenceQuery = { query: string; type: "HYPOTHESIS_SUPPORT" | "HYPOTHESIS_COUNTER" | "DISCRIMINATING_EVIDENCE" | "INFORMATION_GAIN"; hypothesisIds: string[]; reason: string; intentFingerprint: string };

const stop = new Set(["whether", "could", "would", "should", "there", "their", "about", "which", "with", "from", "that", "this", "into", "what", "when", "where", "were", "will", "have", "has", "and", "the", "for", "are"]);
const terms = (text: string) => [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((term) => !stop.has(term)))];
const digest = (text: string) => createHash("sha256").update(text.toLocaleLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 24);
const normalizeLimits = (limits?: Partial<HypothesisLimits>): HypothesisLimits => ({
  maxHypotheses: Math.max(0, Math.min(8, Math.floor(limits?.maxHypotheses ?? DEFAULT_HYPOTHESIS_LIMITS.maxHypotheses))),
  maxEvidenceQueriesPerHypothesis: Math.max(0, Math.min(8, Math.floor(limits?.maxEvidenceQueriesPerHypothesis ?? DEFAULT_HYPOTHESIS_LIMITS.maxEvidenceQueriesPerHypothesis))),
  maxCounterEvidenceQueries: Math.max(0, Math.min(8, Math.floor(limits?.maxCounterEvidenceQueries ?? DEFAULT_HYPOTHESIS_LIMITS.maxCounterEvidenceQueries))),
  maxHypothesisRounds: Math.max(0, Math.min(3, Math.floor(limits?.maxHypothesisRounds ?? DEFAULT_HYPOTHESIS_LIMITS.maxHypothesisRounds)))
});
const makeHypothesis = (id: string, statement: string, evidenceTypes: string[]): Hypothesis => ({ id, statement, fingerprint: digest(statement), requiredEvidenceTypes: evidenceTypes });

/** Creates a small set of competing explanations from clear diagnostic task signals. */
export function extractHypotheses(requestText: string, limits?: Partial<HypothesisLimits>): Hypothesis[] {
  const max = normalizeLimits(limits).maxHypotheses;
  if (!max) return [];
  const match = requestText.match(/\bwhether\s+(.{4,160}?)\s+or\s+(.{4,160}?)(?=[?.!,;]|$)/i);
  if (match) return [match[1], match[2]].filter((statement): statement is string => typeof statement === "string").slice(0, max).map((statement, index) => makeHypothesis(`H${index + 1}`, statement.trim(), ["directly relevant source", "contradicting source"]));

  const diagnostic = /\b(why|cause|causes|caused|root[- ]cause|diagnos|troubleshoot|failed|failure|outage|incident|broke|problem)\b/i.test(requestText);
  const compare = /\b(compare|versus|\bvs\.?\b|difference|differ|contrast)\b/i.test(requestText);
  const uncertain = /\b(ambiguous|uncertain|unclear|interpret|plan|planning|risk|might|could)\b/i.test(requestText);
  const alternatives: Array<{ statement: string; evidence: string[] }> = [];
  if (diagnostic) alternatives.push(
    { statement: "A configuration or deployment setting mismatch caused the reported failure.", evidence: ["deployment configuration", "environment settings", "change record"] },
    { statement: "A dependency or upstream service failure caused the reported failure.", evidence: ["dependency health", "upstream status", "service logs"] },
    { statement: "Resource exhaustion or capacity pressure caused the reported failure.", evidence: ["resource metrics", "capacity limits", "runtime logs"] },
    { statement: "A code regression or incompatible change caused the reported failure.", evidence: ["change diff", "build result", "regression test"] }
  );
  else if (compare) alternatives.push(
    { statement: "The observed difference is explained by different operating conditions.", evidence: ["conditions", "measurement context"] },
    { statement: "The observed difference is explained by different capabilities or inputs.", evidence: ["capabilities", "inputs", "configuration"] },
    { statement: "The apparent difference is explained by measurement or source quality.", evidence: ["measurement method", "source provenance"] }
  );
  else if (uncertain) alternatives.push(
    { statement: "The interpretation is supported by the most direct available context.", evidence: ["primary context", "source provenance"] },
    { statement: "An alternative interpretation is supported by omitted or conflicting context.", evidence: ["counter-context", "conflicting source"] },
    { statement: "The available information is insufficient to distinguish interpretations.", evidence: ["missing context", "independent confirmation"] }
  );
  return alternatives.slice(0, max).map((item, index) => makeHypothesis(`H${index + 1}`, item.statement, item.evidence));
}

/** Builds small, bounded evidence requests before retrieval so each branch is tested on the shared corpus. */
export function planHypothesisEvidenceQueries(requestText: string, hypotheses: Hypothesis[], limits?: Partial<HypothesisLimits>): HypothesisEvidenceQuery[] {
  const bounded = normalizeLimits(limits);
  const subject = requestText.replace(/\s+/g, " ").trim().slice(0, 180);
  const queries: HypothesisEvidenceQuery[] = [];
  for (const hypothesis of hypotheses.slice(0, bounded.maxHypotheses)) {
    const evidenceType = hypothesis.requiredEvidenceTypes[0] ?? "directly relevant evidence";
    const supports = `${subject} ${hypothesis.statement} ${evidenceType}`.slice(0, 500);
    queries.push({ query: supports, type: "HYPOTHESIS_SUPPORT", hypothesisIds: [hypothesis.id], reason: "retrieve evidence that could distinguish support for this explanation", intentFingerprint: digest(`support:${hypothesis.fingerprint}:${evidenceType}`) });
  }
  if (hypotheses.length > 1 && bounded.maxHypothesisRounds > 1) {
    const pair = hypotheses.slice(0, bounded.maxHypotheses);
    const evidenceDimensions = [...new Set(pair.flatMap((hypothesis) => hypothesis.requiredEvidenceTypes))].slice(0, 6);
    const query = `${subject} highest information gain evidence that distinguishes ${pair.map((hypothesis) => hypothesis.statement).join(" versus ")} using ${evidenceDimensions.join(", ")}`.slice(0, 500);
    queries.push({ query, type: "INFORMATION_GAIN", hypothesisIds: pair.map((hypothesis) => hypothesis.id), reason: "select evidence that most reduces uncertainty across competing explanations", intentFingerprint: digest(`information-gain:${pair.map((hypothesis) => hypothesis.fingerprint).join(":")}:${evidenceDimensions.join(":")}`) });
  }
  if (hypotheses.length > 1 && bounded.maxHypothesisRounds > 0) {
    const left = hypotheses[0]!; const right = hypotheses[1]!;
    const leftNeeds = new Set(left.requiredEvidenceTypes);
    const discriminators = right.requiredEvidenceTypes.filter((item) => !leftNeeds.has(item));
    const focus = (discriminators.length ? discriminators : [...left.requiredEvidenceTypes, ...right.requiredEvidenceTypes].slice(0, 2)).join(" ");
    const query = `${subject} distinguish ${left.statement} from ${right.statement} using ${focus || "independent discriminating evidence"}`.slice(0, 500);
    queries.push({ query, type: "DISCRIMINATING_EVIDENCE", hypothesisIds: [left.id, right.id], reason: "target the evidence need that most separates the leading explanations", intentFingerprint: digest(`discriminate:${left.fingerprint}:${right.fingerprint}:${focus}`) });
  }
  const counterLimit = Math.min(bounded.maxCounterEvidenceQueries, hypotheses.length, bounded.maxHypotheses * bounded.maxEvidenceQueriesPerHypothesis);
  for (const hypothesis of hypotheses.slice(0, counterLimit)) {
    const evidenceType = hypothesis.requiredEvidenceTypes[1] ?? "contradicting or falsifying evidence";
    const counter = `${subject} ${hypothesis.statement} ${evidenceType} contrary evidence`.slice(0, 500);
    queries.push({ query: counter, type: "HYPOTHESIS_COUNTER", hypothesisIds: [hypothesis.id], reason: "actively seek counter-evidence for a competing explanation", intentFingerprint: digest(`counter:${hypothesis.fingerprint}:${evidenceType}`) });
  }
  const seen = new Set<string>();
  return queries.filter((item) => { const key = item.query.toLocaleLowerCase().replace(/\s+/g, " "); if (seen.has(key)) return false; seen.add(key); return true; });
}

/** Assesses every explanation against the same graph; lexical overlap is a heuristic, not a probability. */
export function assessHypotheses(hypotheses: Array<{ id: string; statement: string }>, evidence: OicEvidence[], graph: EvidenceGraph, limits?: Partial<HypothesisLimits>): HypothesisAssessment[] {
  const bounded = normalizeLimits(limits);
  const unresolvedConflictIds = new Set(graph.conflicts.filter((conflict) => conflict.unresolved !== false).flatMap((conflict) => conflict.evidenceIds));
  const supersededEvidenceIds = new Set(graph.edges.filter((edge) => edge.relation === "SUPERSEDES").map((edge) => edge.to));
  const edges = graph.edges.filter((edge) => edge.relation === "CONTRADICTS" && unresolvedConflictIds.has(edge.from) && unresolvedConflictIds.has(edge.to));
  return hypotheses.slice(0, bounded.maxHypotheses).map(({ id, statement }) => {
    const hypothesisTerms = terms(statement);
    const matching = evidence.map((item) => {
      const itemTerms = terms(`${item.title} ${item.content}`);
      const overlap = hypothesisTerms.length ? hypothesisTerms.filter((term) => itemTerms.includes(term)).length / hypothesisTerms.length : 0;
      const explicitlyReplacedTerm = /\b(?:replac(?:e|es|ed|ing)|supersed(?:e|es|ed|ing))\s+(?:the\s+)?([\p{L}\p{N}_-]+)/iu.exec(item.content)?.[1]?.toLocaleLowerCase();
      const hypothesisTokens: string[] = statement.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
      const hypothesisAssertsReplacedTerm = Boolean(explicitlyReplacedTerm && hypothesisTokens.includes(explicitlyReplacedTerm));
      const samePolarity = !hypothesisAssertsReplacedTerm && (/\b(no|not|never|without|cannot|isn't|doesn't)\b/i.test(statement) === /\b(no|not|never|without|cannot|isn't|doesn't)\b/i.test(item.content));
      return { id: item.id, overlap, samePolarity };
    }).filter((item) => item.overlap >= 0.4 && !supersededEvidenceIds.has(item.id));
    const matchedById = new Map(matching.map((item) => [item.id, item]));
    const graphCounterEvidence = edges.flatMap((edge) => {
      const left = matchedById.get(edge.from); const right = matchedById.get(edge.to);
      return left && right && left.samePolarity !== right.samePolarity ? [left.samePolarity ? right.id : left.id] : [];
    }).slice(0, bounded.maxCounterEvidenceQueries);
    const contradictingEvidenceIds = [...new Set([...matching.filter((item) => !item.samePolarity).map((item) => item.id), ...graphCounterEvidence])];
    const supportingEvidenceIds = matching.filter((item) => item.samePolarity && !contradictingEvidenceIds.includes(item.id)).map((item) => item.id);
    const assessment = contradictingEvidenceIds.length && !supportingEvidenceIds.length
      ? "CONTRADICTED" as const
      : contradictingEvidenceIds.length
        ? "WEAKLY_SUPPORTED" as const
        : supportingEvidenceIds.length ? "SUPPORTED" as const : "INSUFFICIENT_EVIDENCE" as const;
    const unresolvedGaps = assessment === "SUPPORTED" ? [] : [assessment === "CONTRADICTED" ? "available evidence contradicts this explanation" : "no unconflicted evidence directly distinguishes this explanation"];
    return { id, fingerprint: digest(statement), assessment, supportingEvidenceIds, contradictingEvidenceIds, unresolvedGaps };
  });
}
