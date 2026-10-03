import type { OicRuntimeRequest } from "@oic/contracts";
import type { TaskAnalysis } from "./types";

export type QueryCandidate = { query: string; type: "ORIGINAL_QUERY" | "NORMALIZED_QUERY" | "DECOMPOSED_QUERY" | "MULTI_QUERY" | "ENTITY_QUERY" | "FOLLOWUP_QUERY" };
const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "what", "when", "where", "which", "into", "about", "please", "based", "using"]);
const clean = (value: string) => [...value].filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }).join("").replace(/\s+/g, " ").trim().slice(0, 1200);
const userText = (request: OicRuntimeRequest) => request.input.filter((message) => message.speaker === "user").flatMap((message) => message.content.map((part) => part.text)).join("\n");

/** Builds a small typed query plan from request clauses. It never invents new entities or facts. */
export function planQueries(request: OicRuntimeRequest, analysis: TaskAnalysis, intensity: number, maxQueries: number): QueryCandidate[] {
  if (intensity <= 0 || maxQueries <= 0) return [];
  const original = clean(userText(request));
  if (!original) return [];
  if (intensity < 25) return ([{ query: original, type: "ORIGINAL_QUERY" }] satisfies QueryCandidate[]).slice(0, maxQueries);
  const normalized = original.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim();
  const candidates: QueryCandidate[] = [{ query: normalized, type: "NORMALIZED_QUERY" }];
  const parts = original.split(/(?:\n+|[.!?;]+|\b(?:and|also|compare|versus|while|because|then)\b)/i).map(clean).filter((part) => part.length >= 12);
  const cap = intensity >= 75 ? Math.min(maxQueries, 8) : Math.min(maxQueries, 4);
  const planningCap = intensity >= 90 ? Math.max(1, cap - 1) : cap;
  if (intensity >= 50) {
    for (const part of parts) {
      if (candidates.length >= planningCap) break;
      candidates.push({ query: part, type: analysis.subtaskCount > 1 ? "DECOMPOSED_QUERY" : "MULTI_QUERY" });
    }
  }
  const entities = [...new Set(original.match(/\b[A-Z][\p{L}\p{N}._-]{2,}\b/gu) ?? [])].slice(0, 4);
  if (intensity >= 75) for (const entity of entities) {
    if (candidates.length >= planningCap) break;
    candidates.push({ query: clean(`${entity} ${normalized}`), type: "ENTITY_QUERY" });
  }
  // MAX adds a bounded counter-evidence pass so superseding or conflicting
  // records can be discovered instead of only comparing the top direct hits.
  if (intensity >= 90) {
    if (candidates.length < cap) candidates.push({ query: clean(`${normalized} superseded revised conflicting evidence`), type: "FOLLOWUP_QUERY" });
  }
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.query.toLocaleLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, cap);
}

export function queryTerms(query: string): string[] {
  return [...new Set((query.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_'-]*/gu) ?? []).filter((token) => token.length > 1 && !STOP.has(token)))];
}
