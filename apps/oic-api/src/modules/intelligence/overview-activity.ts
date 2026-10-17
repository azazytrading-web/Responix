export type OverviewExecutionRow = {
  modelId: string;
  status: string;
  stageCount: number;
  providerCallCount: number;
  retrievalQueryCount: number;
  memoryLookupCount: number;
  contextTokens: number;
  inputTokens: number | null;
  outputTokens: number | null;
  verificationStatus: string;
  startedAt: Date;
  completedAt: Date | null;
  summary: unknown;
};

type JsonRow = Record<string, unknown>;
const object = (value: unknown): JsonRow =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRow : {};
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const sum = (values: Array<number | null>): { value: number | null; state: "LIVE" | "UNAVAILABLE" } => {
  if (values.some((value) => value === null)) return { value: null, state: "UNAVAILABLE" };
  return { value: values.reduce<number>((total, value) => total + (value ?? 0), 0), state: "LIVE" };
};
function summaryCounter(row: OverviewExecutionRow, key: "toolCalls" | "verificationPasses" | "revisions" | "backtracks"): number | null {
  const summary = object(row.summary);
  const kernel = object(summary.cognitiveKernel);
  const budget = object(kernel.budget);
  const used = object(budget.used);
  return count(summary[key]) ?? count(used[key]);
}

/** A bounded, application-scoped, content-free activity projection over canonical execution rows. */
export function buildOverviewActivity(rows: readonly OverviewExecutionRow[], observedAt = new Date()): JsonRow {
  const recent = rows.slice(0, 50);
  const statusCounts = Object.fromEntries([...new Set(recent.map((row) => row.status))].sort().map((status) => [status, recent.filter((row) => row.status === status).length]));
  const metric = (values: Array<number | null>, unit: string) => ({ ...sum(values), unit, sampleSize: recent.length, scope: "OIC_PLATFORM · latest 50 recorded OIC runtime executions" });
  const grouped = new Map<string, OverviewExecutionRow[]>();
  for (const row of recent) grouped.set(row.modelId, [...(grouped.get(row.modelId) ?? []), row]);
  const modelActivity = [...grouped.entries()].slice(0, 3).map(([modelId, items]) => ({
    modelId,
    executionCount: items.length,
    latestStatus: items[0]?.status ?? null,
    latestStartedAt: items[0]?.startedAt.toISOString() ?? null,
    latestCompletedAt: items[0]?.completedAt?.toISOString() ?? null,
    providerCalls: sum(items.map((row) => count(row.providerCallCount))).value,
    retrievalQueries: sum(items.map((row) => count(row.retrievalQueryCount))).value,
    memoryLookups: sum(items.map((row) => count(row.memoryLookupCount))).value,
    inputTokens: sum(items.map((row) => count(row.inputTokens))).value,
    outputTokens: sum(items.map((row) => count(row.outputTokens))).value
  }));
  const history = recent.map((row) => ({
    modelId: row.modelId,
    status: row.status,
    contextTokens: row.contextTokens,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    verificationStatus: row.verificationStatus
  }));
  const first = recent.at(-1);
  const latest = recent[0];
  return {
    state: recent.length ? "LIVE" : "NO_DATA_YET",
    observedAt: observedAt.toISOString(),
    source: "OIC canonical intelligence executions and persisted execution summaries",
    scope: "OIC_PLATFORM · latest 50 recorded OIC runtime executions",
    sampleSize: recent.length,
    window: { from: first?.startedAt.toISOString() ?? null, to: latest?.startedAt.toISOString() ?? null },
    statusCounts,
    metrics: {
      executions: { value: recent.length, state: recent.length ? "LIVE" : "NO_DATA_YET", unit: "runs" },
      stages: metric(recent.map((row) => count(row.stageCount)), "stages"),
      providerCalls: metric(recent.map((row) => count(row.providerCallCount)), "calls"),
      retrievalQueries: metric(recent.map((row) => count(row.retrievalQueryCount)), "queries"),
      memoryLookups: metric(recent.map((row) => count(row.memoryLookupCount)), "lookups"),
      toolCalls: metric(recent.map((row) => summaryCounter(row, "toolCalls")), "calls"),
      verificationRounds: metric(recent.map((row) => summaryCounter(row, "verificationPasses")), "rounds"),
      repairRounds: metric(recent.map((row) => summaryCounter(row, "revisions")), "rounds"),
      backtracks: metric(recent.map((row) => summaryCounter(row, "backtracks")), "events"),
      contextTokens: metric(recent.map((row) => count(row.contextTokens)), "tokens"),
      inputTokens: metric(recent.map((row) => count(row.inputTokens)), "tokens"),
      outputTokens: metric(recent.map((row) => count(row.outputTokens)), "tokens")
    },
    modelActivity,
    history
  };
}
