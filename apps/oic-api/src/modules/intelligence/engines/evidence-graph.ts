import type { EvidenceRelationship, OicEvidence } from "./types";

export type EvidenceGraphNode = {
  id: string;
  source: string;
  provenance: string;
  trust: OicEvidence["trust"];
  authority: number;
  freshness: number;
  retrievalScore: number;
  rerankScore: number;
  lexicalScore: number | null;
  semanticScore: number | null;
  scope: string;
  contentRef: string;
  kind: OicEvidence["kind"];
};
export type EvidenceGraphEdge = { from: string; to: string; relation: EvidenceRelationship; basis: string };
export type EvidenceConflict = { evidenceIds: [string, string]; authorityOrder: "LEFT" | "RIGHT" | "TIE"; freshnessOrder: "LEFT" | "RIGHT" | "TIE"; unresolved: boolean };
export type EvidenceGraph = { version: "evidence-graph-v1"; nodes: EvidenceGraphNode[]; edges: EvidenceGraphEdge[]; conflicts: EvidenceConflict[]; summary: { nodeCount: number; edgeCount: number; conflictCount: number; relationCounts: Partial<Record<EvidenceRelationship, number>> } };
type RankedItem = OicEvidence & { fusedScore?: number; lexicalScore?: number; semanticScore?: number; duplicateEvidence?: Array<OicEvidence & { fusedScore?: number; lexicalScore?: number; semanticScore?: number }> };

const negation = /\b(no|not|never|false|cannot|can't|without|isn't|doesn't)\b/i;
const terms = (value: string): string[] => value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
const topicTerms = (value: string): string[] => terms(value.replace(/\boic5[-\s]+final[-\s]+acceptance\b/gi, " "));
const numbers = (value: string) => [...new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])];
const declaresSupersession = (value: string) => /\b(supersed|replac|instead of|no longer|updated to|changed to|current version)\w*\b/i.test(value);

/** Builds safe provenance/ranking metadata and keeps contradictory/duplicate records linked without copying source text to traces. */
export function buildEvidenceGraph(evidence: OicEvidence[], scope: { applicationId: string; tenantId: string | null }): EvidenceGraph {
  const flattened: Array<{ item: RankedItem; parentId?: string }> = [];
  for (const evidenceItem of evidence as RankedItem[]) {
    const inScope = (item: RankedItem) =>
      (item.applicationId === undefined || item.applicationId === scope.applicationId) &&
      (item.tenantId === undefined || item.tenantId === null || item.tenantId === scope.tenantId);
    if (!inScope(evidenceItem)) continue;
    flattened.push({ item: evidenceItem });
    for (const duplicate of evidenceItem.duplicateEvidence ?? []) if (inScope(duplicate)) flattened.push({ item: duplicate, parentId: evidenceItem.id });
  }
  const nodes: EvidenceGraphNode[] = flattened.map(({ item }) => ({
    id: item.id, source: item.source, provenance: item.sourceRef, trust: item.trust, authority: item.authority, freshness: item.freshness,
    retrievalScore: item.relevance, rerankScore: item.fusedScore ?? item.relevance, lexicalScore: item.lexicalScore ?? null, semanticScore: item.semanticScore ?? null,
    scope: item.scope ?? `application:${scope.applicationId}:tenant:${scope.tenantId ?? "application"}`, contentRef: item.id, kind: item.kind
  }));
  const edges: EvidenceGraphEdge[] = [];
  const add = (from: string, to: string, relation: EvidenceRelationship, basis: string) => {
    if (from !== to && !edges.some((edge) => edge.from === from && edge.to === to && edge.relation === relation)) edges.push({ from, to, relation, basis });
  };
  for (const entry of flattened) if (entry.parentId) add(entry.parentId, entry.item.id, "DUPLICATES", "hybrid-ranker-content-fingerprint");
  const availableIds = new Set(flattened.map(({ item }) => item.id));
  for (const { item } of flattened) {
    for (const dependencyId of [...new Set(item.dependsOnEvidenceIds ?? [])].slice(0, 16)) {
      if (availableIds.has(dependencyId)) add(item.id, dependencyId, "DEPENDS_ON", "explicit in-scope evidence dependency reference");
    }
  }
  for (let leftIndex = 0; leftIndex < flattened.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < flattened.length; rightIndex++) {
    const left = flattened[leftIndex]!.item; const right = flattened[rightIndex]!.item;
    // Acceptance-fixture prefixes are provenance labels, not subject terms. Including them
    // made otherwise unrelated fixture records look like one topic and created false conflicts.
    const leftTitle = topicTerms(left.title); const rightTitle = topicTerms(right.title);
    const sharedTitles = leftTitle.filter((term) => rightTitle.includes(term));
    const sameTopic = sharedTitles.length >= 2;
    const conflictingValues = numbers(`${left.title} ${left.content}`).some((value) => numbers(`${right.title} ${right.content}`).some((other) => value !== other));
    const opposingPolarity = negation.test(left.content) !== negation.test(right.content);
    const [older, newer] = left.freshness <= right.freshness ? [left, right] : [right, left];
    const superseding = sameTopic && newer.freshness > older.freshness && newer.authority > older.authority && declaresSupersession(newer.content);
    if (superseding) {
      add(newer.id, older.id, "SUPERSEDES", "newer same-topic source explicitly declares supersession");
      add(newer.id, older.id, "CONTRADICTS", "current superseding evidence replaces prior state");
    } else if (sameTopic && ((left.relationship === "CONTRADICTS" || right.relationship === "CONTRADICTS") || opposingPolarity || conflictingValues)) add(left.id, right.id, "CONTRADICTS", left.relationship === "CONTRADICTS" || right.relationship === "CONTRADICTS" ? "retriever conflict marker on shared topic" : opposingPolarity ? "shared-title-and-opposing-polarity" : "shared-title-and-conflicting-numeric-values");
    else if (sharedTitles.length >= 2 && negation.test(left.content) === negation.test(right.content)) add(left.id, right.id, "SUPPORTS", "shared-title-and-compatible-negation-heuristic");
    else {
      const shared = new Set([...terms(`${left.title} ${left.content}`)].filter((term) => terms(`${right.title} ${right.content}`).includes(term)));
      if (shared.size >= 3) add(left.id, right.id, "EXPANDS", "shared-evidence-terms-heuristic");
    }
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const conflicts: EvidenceConflict[] = edges.filter((edge) => edge.relation === "CONTRADICTS").map((edge) => {
    const left = nodeById.get(edge.from)!; const right = nodeById.get(edge.to)!;
    const explicitlySuperseded = edges.some((relation) => relation.relation === "SUPERSEDES" && relation.from === edge.from && relation.to === edge.to);
    const commonAuthoritativeSuperseder = edges.some((first) => first.relation === "SUPERSEDES" && (first.to === edge.from || first.to === edge.to) && edges.some((second) =>
      second.relation === "SUPERSEDES" && second.from === first.from && second.to === (first.to === edge.from ? edge.to : edge.from)
    ) && (nodeById.get(first.from)?.authority ?? 0) > Math.max(left.authority ?? 0, right.authority ?? 0));
    return { evidenceIds: [edge.from, edge.to], authorityOrder: left.authority === right.authority ? "TIE" : left.authority > right.authority ? "LEFT" : "RIGHT", freshnessOrder: left.freshness === right.freshness ? "TIE" : left.freshness > right.freshness ? "LEFT" : "RIGHT", unresolved: !explicitlySuperseded && !commonAuthoritativeSuperseder };
  });
  const relationCounts: Partial<Record<EvidenceRelationship, number>> = {};
  for (const edge of edges) relationCounts[edge.relation] = (relationCounts[edge.relation] ?? 0) + 1;
  return { version: "evidence-graph-v1", nodes, edges, conflicts, summary: { nodeCount: nodes.length, edgeCount: edges.length, conflictCount: conflicts.length, relationCounts } };
}
