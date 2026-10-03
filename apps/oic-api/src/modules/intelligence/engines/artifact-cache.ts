import { createHash } from "node:crypto";

export type CacheNamespace = {
  applicationId: string;
  tenantId: string | null;
  modelRevisionId: string | null;
  profileRevisionId: string;
  engineVersion: string;
  dependencyFingerprint: string;
};

type Entry<T> = { value: T; expiresAt: number };

/** Process-local, bounded artifact cache. Keys must include all authorization and revision dimensions. */
export class OicArtifactCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  constructor(private readonly maxEntries = 128, private readonly ttlMs = 30_000) {}

  key(namespace: CacheNamespace, artifact: unknown): string {
    const material = JSON.stringify({ namespace, artifact });
    return createHash("sha256").update(material).digest("hex");
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) { this.entries.delete(key); return undefined; }
    // Refresh insertion order for a small LRU policy.
    this.entries.delete(key); this.entries.set(key, entry);
    return structuredClone(entry.value);
  }

  set(key: string, value: T, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value: structuredClone(value), expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);
  }

  get size(): number { return this.entries.size; }
}

/** Semantic reuse remains an explicit, disabled-by-default verification hook. */
export interface OicSemanticCache<T> {
  findVerifiedCandidate(input: { namespace: CacheNamespace; queryVector: number[]; verify: (candidate: T) => boolean }): Promise<T | undefined>;
}
