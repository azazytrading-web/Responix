import { createHash } from "node:crypto";
import type { OicEvidence } from "./types";

export type ClaimEvidenceStatus = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "NOT_REQUIRING_EXTERNAL_EVIDENCE";
export type ClaimEvidenceMap = { claims: Array<{ claimId: string; fingerprint: string; status: ClaimEvidenceStatus; evidenceIds: string[]; overlap: number }>; summary: { supported: number; partiallySupported: number; unsupported: number; notRequiringEvidence: number } };
const stopWords = new Set(["about", "after", "again", "also", "among", "based", "before", "being", "between", "could", "does", "from", "have", "into", "more", "most", "only", "other", "over", "same", "some", "such", "than", "that", "their", "them", "then", "there", "these", "they", "this", "those", "through", "under", "very", "were", "what", "when", "where", "which", "while", "with", "would", "your"]);
const terms = (value: string) => [...new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((item) => !stopWords.has(item)))];
const citationIds = (value: string) => [...value.matchAll(/\[(?:EVIDENCE|MEMORY)\s+([0-9a-f-]{8,})\b/gi)].map((match) => match[1]!);

/** Provides a deterministic lexical audit trail; claim text itself is never returned or persisted. */
export function mapClaimsToEvidence(output: string, evidence: OicEvidence[], evidenceRequired: boolean): ClaimEvidenceMap {
  const sentences = output.split(/(?:\n+|(?<=[.!?])\s+|;\s*)/).map((item) => item.trim()).filter((item) => terms(item.replace(/\[(?:EVIDENCE|MEMORY)\s+[^\]]+\]/gi, "")).length >= 3).slice(0, 32);
  const claims = sentences.map((claim, index) => {
    const claimTerms = terms(claim.replace(/\[(?:EVIDENCE|MEMORY)\s+[^\]]+\]/gi, ""));
    const citations = citationIds(claim).filter((id) => evidence.some((item) => item.id.startsWith(id)));
    const matches = evidence.map((item) => ({ item, overlap: claimTerms.filter((term) => terms(`${item.title} ${item.content}`).includes(term)).length / Math.max(1, claimTerms.length) })).filter(({ overlap }) => overlap > 0).sort((left, right) => right.overlap - left.overlap);
    const evidenceIds = [...new Set([...citations, ...matches.filter(({ overlap }) => overlap >= 0.2).map(({ item }) => item.id)])];
    const overlap = Math.max(...matches.map((item) => item.overlap), citations.length ? 1 : 0);
    const status: ClaimEvidenceStatus = !evidenceRequired ? "NOT_REQUIRING_EXTERNAL_EVIDENCE" : citations.length || overlap >= 0.5 ? "SUPPORTED" : overlap >= 0.2 ? "PARTIALLY_SUPPORTED" : "UNSUPPORTED";
    return { claimId: `claim-${index + 1}`, fingerprint: createHash("sha256").update(claim.toLocaleLowerCase()).digest("hex").slice(0, 16), status, evidenceIds, overlap: Number(overlap.toFixed(3)) };
  });
  const count = (status: ClaimEvidenceStatus) => claims.filter((item) => item.status === status).length;
  return { claims, summary: { supported: count("SUPPORTED"), partiallySupported: count("PARTIALLY_SUPPORTED"), unsupported: count("UNSUPPORTED"), notRequiringEvidence: count("NOT_REQUIRING_EXTERNAL_EVIDENCE") } };
}
