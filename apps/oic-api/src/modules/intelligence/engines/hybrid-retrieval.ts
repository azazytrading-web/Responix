import { createHash } from "node:crypto";
import type { OicEvidence } from "./types";
import { queryTerms } from "./query-planner";

export type IndexedText = OicEvidence & { embedding?: number[]; entityKey?: string | null };
export type RankedEvidence = OicEvidence & { lexicalScore: number; semanticScore: number; fusedScore: number; duplicateEvidence?: Array<OicEvidence & { lexicalScore: number; semanticScore: number; fusedScore: number }> };

export interface OicEmbeddingProvider {
  readonly providerKey: string;
  readonly modelKey: string;
  readonly dimensions: number;
  embed(text: string): number[];
}

/** Local provider-independent sparse feature vectors. This is a deterministic similarity signal, not a claim of learned semantic understanding. */
export class LocalFeatureEmbeddingProvider implements OicEmbeddingProvider {
  readonly providerKey = "oic-local";
  readonly modelKey = "hashed-token-ngram-v1";
  readonly dimensions = 384;
  embed(text: string): number[] {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_'-]*/gu) ?? [];
    const features = [...tokens, ...tokens.slice(1).map((token, index) => `${tokens[index]}_${token}`)];
    for (const feature of features) {
      const digest = createHash("sha256").update(feature).digest();
      const index = digest.readUInt32BE(0) % this.dimensions;
      vector[index] = (vector[index] ?? 0) + ((digest[4]! & 1) === 0 ? 1 : -1);
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / magnitude);
  }
}

function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || !left.length) return 0;
  let dot = 0;
  for (let index = 0; index < left.length; index++) dot += left[index]! * right[index]!;
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}
function lexical(query: string[], content: string): number {
  if (!query.length) return 0;
  const normalized = content.toLocaleLowerCase();
  const terms = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}_'-]*/gu) ?? [];
  const frequencies = new Map<string, number>();
  for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  let total = 0;
  for (const term of query) {
    const tf = frequencies.get(term) ?? 0;
    if (tf) total += Math.min(1, tf / 2) / (1 + Math.log1p(terms.length / 40));
  }
  const phrase = query.length > 1 && normalized.includes(query.join(" ")) ? 0.25 : 0;
  return Math.min(1, total / query.length + phrase);
}
const reciprocalRank = (rank: number) => 1 / (60 + rank + 1);

/** Hybrid query/document relevance with lexical, hashed token-ngram similarity, authority, freshness, and rank fusion. */
export function rankEvidence(queryList: string[], candidates: IndexedText[], limit: number, embedder: OicEmbeddingProvider, now = Date.now()): RankedEvidence[] {
  if (!queryList.length || !candidates.length || limit <= 0) return [];
  const queryFeatures = queryList.map((query) => ({ terms: queryTerms(query), vector: embedder.embed(query) }));
  const eligible = candidates.filter((item) => item.content.trim().length > 0);
  const lexicalRankings = queryFeatures.map(({ terms }) => eligible.map((item) => ({ id: item.id, value: lexical(terms, `${item.title} ${item.content}`) })).sort((a, b) => b.value - a.value));
  const semanticRankings = queryFeatures.map(({ vector }) => eligible.map((item) => ({ id: item.id, value: cosine(vector, item.embedding?.length === embedder.dimensions ? item.embedding : embedder.embed(`${item.title} ${item.content}`)) })).sort((a, b) => b.value - a.value));
  const results = eligible.map((item) => {
    const lex = Math.max(...queryFeatures.map(({ terms }) => lexical(terms, `${item.title} ${item.content}`)));
    const semantic = Math.max(...queryFeatures.map(({ vector }) => cosine(vector, item.embedding?.length === embedder.dimensions ? item.embedding : embedder.embed(`${item.title} ${item.content}`))));
    const rankFusion = lexicalRankings.reduce((sum, list) => sum + reciprocalRank(list.findIndex((row) => row.id === item.id)), 0) + semanticRankings.reduce((sum, list) => sum + reciprocalRank(list.findIndex((row) => row.id === item.id)), 0);
    const daysOld = Math.max(0, (now - item.freshness) / 86_400_000);
    const freshness = 1 / (1 + daysOld / 180);
    const authority = Math.max(0, Math.min(1, item.authority / 100));
    const fusedScore = lex * 0.48 + semantic * 0.24 + rankFusion * 8 + authority * 0.16 + freshness * 0.12;
    return { ...item, relevance: Math.max(lex, semantic), lexicalScore: lex, semanticScore: semantic, fusedScore };
  }).filter((item) => item.lexicalScore > 0 || item.semanticScore >= 0.68).sort((a, b) => b.fusedScore - a.fusedScore || a.id.localeCompare(b.id));

  const selected: RankedEvidence[] = [];
  const seenContent = new Map<string, string>();
  for (const item of results) {
    const fingerprint = item.content.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 320);
    const duplicate = seenContent.get(fingerprint);
    if (duplicate) {
      const original = selected.find((entry) => entry.id === duplicate);
      if (original) {
        original.relationship = "DUPLICATES";
        original.duplicateEvidence ??= [];
        original.duplicateEvidence.push({ ...item, relationship: "DUPLICATES" });
      }
      continue;
    }
    seenContent.set(fingerprint, item.id);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  const negation = /\b(no|not|never|false|cannot|can't|without)\b/i;
  for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
    const a = selected[i]!, b = selected[j]!;
    const shared = queryTerms(`${a.title} ${a.content}`).filter((term) => queryTerms(`${b.title} ${b.content}`).includes(term)).length;
    if (shared >= 2 && negation.test(a.content) !== negation.test(b.content)) { a.relationship = "CONTRADICTS"; b.relationship = "CONTRADICTS"; }
  }
  return selected;
}
