export type MemoryUtilitySignal = "USED_IN_CONTEXT" | "SUPPORTED_VERIFIED_CLAIM" | "RESOLVED_CONSTRAINT" | "RESOLVED_UNCERTAINTY" | "CONFLICTED_WITH_EVIDENCE" | "DISCARDED" | "CAUSED_REPAIR" | "NO_OBSERVED_UTILITY";
export type MemoryUtilityRecord = { memoryId: string; signals: MemoryUtilitySignal[]; evidenceRefs: string[]; reason: string };

/** Records observed, trace-safe memory effects without changing memory rank or policy. */
export function assessMemoryUtility(input: { selected: Array<{ id: string }>; contextMemoryIds: string[]; supportedClaimEvidenceIds: string[]; conflicts: Array<{ memoryId: string; otherEvidenceId: string }>; verificationStatus: string; revisions: number }): MemoryUtilityRecord[] {
  const contextIds = new Set(input.contextMemoryIds);
  const supportedIds = new Set(input.supportedClaimEvidenceIds);
  const conflictsByMemory = new Map<string, string[]>();
  for (const conflict of input.conflicts) conflictsByMemory.set(conflict.memoryId, [...(conflictsByMemory.get(conflict.memoryId) ?? []), conflict.otherEvidenceId]);
  return input.selected.map(({ id }) => {
    const signals: MemoryUtilitySignal[] = [];
    const evidenceRefs: string[] = [];
    if (conflictsByMemory.has(id)) { signals.push("CONFLICTED_WITH_EVIDENCE"); evidenceRefs.push(...conflictsByMemory.get(id)!); }
    if (supportedIds.has(id) && ["PASS", "PASS_WITH_WARNINGS"].includes(input.verificationStatus)) signals.push("SUPPORTED_VERIFIED_CLAIM");
    if (contextIds.has(id)) signals.push("USED_IN_CONTEXT"); else signals.push("DISCARDED");
    if (!signals.includes("SUPPORTED_VERIFIED_CLAIM") && !signals.includes("CONFLICTED_WITH_EVIDENCE")) signals.push("NO_OBSERVED_UTILITY");
    return { memoryId: id, signals, evidenceRefs: [...new Set(evidenceRefs)].slice(0, 8), reason: signals.includes("CONFLICTED_WITH_EVIDENCE") ? "selected memory conflicts with retrieved evidence" : signals.includes("SUPPORTED_VERIFIED_CLAIM") ? "selected memory is referenced by a supported verified claim" : contextIds.has(id) ? "memory reached provider context; no stronger utility signal was observed" : "selected memory was omitted from compiled provider context" };
  });
}
