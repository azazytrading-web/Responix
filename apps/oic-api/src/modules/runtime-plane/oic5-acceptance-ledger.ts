export const OIC5_ACCEPTANCE_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"] as const;
export type Oic5AcceptanceId = typeof OIC5_ACCEPTANCE_IDS[number];
export type Oic5AcceptanceMetric = number | "UNKNOWN";
export type Oic5AcceptanceMetrics = {
  providerCalls: Oic5AcceptanceMetric;
  retrievalRounds: Oic5AcceptanceMetric;
  memoryReads: Oic5AcceptanceMetric;
  memoryWrites: Oic5AcceptanceMetric;
  toolCalls: Oic5AcceptanceMetric;
  candidateCount: Oic5AcceptanceMetric;
  searchNodes: Oic5AcceptanceMetric;
  verificationRounds: Oic5AcceptanceMetric;
  repairRounds: Oic5AcceptanceMetric;
  backtracks: Oic5AcceptanceMetric;
  cacheHits: Oic5AcceptanceMetric;
  cacheMisses: Oic5AcceptanceMetric;
  stopReason: string;
};
export type Oic5AcceptanceRecord = {
  id: Oic5AcceptanceId;
  status: "PASS" | "FAIL";
  purpose: string;
  providerModel: string;
  baseline: { executed: boolean; resultSummary: string; objectiveAssertions: Record<string, boolean>; metrics: Oic5AcceptanceMetrics };
  oic: { executed: boolean; profile: string; resultSummary: string; objectiveAssertions: Record<string, boolean>; metrics: Oic5AcceptanceMetrics };
  traceOrRequestReference: { baselineRequestId?: string; baselineTraceId?: string; oicTraceId?: string; oicRequestId?: string; additionalTraceIds?: string[]; strategyTransitions?: Array<{ from: string; to: string; action: string; reason: string }> };
};

/** Collects the authoritative records emitted by the existing runtime acceptance executions. */
export class Oic5AcceptanceLedger {
  private readonly recordsById = new Map<Oic5AcceptanceId, Oic5AcceptanceRecord>();

  add(record: Oic5AcceptanceRecord): void {
    if (this.recordsById.has(record.id)) throw new Error(`Duplicate OIC-5 acceptance record: ${record.id}`);
    if (!record.providerModel.trim() || !record.purpose.trim()) throw new Error(`OIC-5 acceptance record ${record.id} lacks its purpose or provider/model identity`);
    for (const side of [record.baseline, record.oic]) {
      for (const value of Object.values(side.metrics)) if (value === undefined || value === null || value === "") throw new Error(`OIC-5 acceptance record ${record.id} has an unreported metric`);
    }
    if (record.status === "PASS" && (!record.baseline.executed || !record.oic.executed || Object.values(record.oic.objectiveAssertions).some((passed) => !passed))) {
      throw new Error(`OIC-5 acceptance record ${record.id} cannot pass without paired execution and passing OIC assertions`);
    }
    this.recordsById.set(record.id, record);
  }

  records(): Oic5AcceptanceRecord[] {
    return OIC5_ACCEPTANCE_IDS.flatMap((id) => {
      const record = this.recordsById.get(id);
      return record ? [record] : [];
    });
  }

  assertComplete(): Oic5AcceptanceRecord[] {
    const missing = OIC5_ACCEPTANCE_IDS.filter((id) => !this.recordsById.has(id));
    const failed = [...this.recordsById.values()].filter((record) => record.status !== "PASS").map((record) => record.id);
    if (missing.length || failed.length) throw new Error(`OIC-5 A-P acceptance is incomplete. Missing: ${missing.join(",") || "none"}; failed: ${failed.join(",") || "none"}`);
    return this.records();
  }
}
