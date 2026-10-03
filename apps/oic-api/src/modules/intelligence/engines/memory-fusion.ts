export type MemoryRelationship = "SUPPORTS" | "CONTRADICTS" | "SUPERSEDES" | "DUPLICATES" | "DERIVED_FROM";
export type MemoryFusionRecord = { id: string; tenantId: string | null; actorPrincipalId: string | null; sessionId: string | null; kind: string; lifecycle: string; content: string; entityKey: string | null; confidence: number; salience: number; sourceType: string; sourceRef: string | null; createdAt: Date; updatedAt: Date; lastConfirmedAt: Date | null; validUntil: Date | null };
export type MemoryFusion = { selectedIds: string[]; supersededIds: string[]; relationships: Array<{ from: string; to: string; relation: MemoryRelationship; reason: string }>; decisions: Array<{ id: string; reason: string }> };

const negative = /\b(no|not|never|false|cannot|can't|isn't|doesn't|without)\b/i;
const explicitSupersession = /\b(supersedes?|replaces?|replaced by|now active|effective as of|current version)\b/i;
const normalize = (value: string) => value.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const scopeKey = (item: MemoryFusionRecord) => item.kind === "SESSION" ? `session:${item.tenantId ?? "app"}:${item.sessionId}:${item.actorPrincipalId}` : `${item.tenantId ?? "application"}:${item.kind}:actor:${item.actorPrincipalId ?? "shared"}`;

/** Fuses only same-scope records; time alone never supersedes an older memory. */
export function fuseMemoryRecords(records: MemoryFusionRecord[], now = Date.now()): MemoryFusion {
  const relationships: MemoryFusion["relationships"] = [];
  const superseded = new Set<string>();
  const decisions: MemoryFusion["decisions"] = [];
  const add = (from: string, to: string, relation: MemoryRelationship, reason: string) => relationships.push({ from, to, relation, reason });
  for (let leftIndex = 0; leftIndex < records.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex++) {
    const left = records[leftIndex]!; const right = records[rightIndex]!;
    if (!left.entityKey || left.entityKey !== right.entityKey || scopeKey(left) !== scopeKey(right)) continue;
    if (normalize(left.content) === normalize(right.content)) { add(left.id, right.id, "DUPLICATES", "same-scope entity and normalized content"); continue; }
    if (negative.test(left.content) !== negative.test(right.content)) add(left.id, right.id, "CONTRADICTS", "same-scope entity with incompatible polarity");
    else add(left.id, right.id, "SUPPORTS", "same-scope entity with compatible polarity");
    const [older, newer] = left.createdAt.getTime() <= right.createdAt.getTime() ? [left, right] : [right, left];
    if (newer.createdAt.getTime() > older.createdAt.getTime() && explicitSupersession.test(newer.content)) {
      superseded.add(older.id);
      add(newer.id, older.id, "SUPERSEDES", "newer record explicitly declares supersession");
    }
  }
  const eligible = records.filter((item) => !superseded.has(item.id) && (!item.validUntil || item.validUntil.getTime() > now));
  const selected = new Set<string>();
  for (const item of eligible) {
    const duplicate = relationships.find((edge) => edge.relation === "DUPLICATES" && (edge.from === item.id || edge.to === item.id));
    if (duplicate) {
      const peerId = duplicate.from === item.id ? duplicate.to : duplicate.from;
      const peer = eligible.find((candidate) => candidate.id === peerId);
      if (peer) {
        const score = (candidate: MemoryFusionRecord) => (candidate.confidence * 0.35) + (candidate.salience * 0.2) + ((candidate.lastConfirmedAt ?? candidate.updatedAt ?? candidate.createdAt).getTime() / Math.max(now, 1)) * 20 + (candidate.sourceRef ? 5 : 0);
        selected.add(score(item) >= score(peer) ? item.id : peer.id);
        continue;
      }
    }
    selected.add(item.id);
  }
  for (const id of superseded) decisions.push({ id, reason: "excluded because an explicitly superseding same-scope fact is available" });
  for (const item of records) if (item.validUntil && item.validUntil.getTime() <= now && !superseded.has(item.id)) decisions.push({ id: item.id, reason: "excluded because its declared validity window expired" });
  return { selectedIds: [...selected], supersededIds: [...superseded], relationships, decisions };
}
