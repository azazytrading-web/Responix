import assert from "node:assert/strict";
import test from "node:test";
import { buildOverviewActivity, type OverviewExecutionRow } from "./overview-activity";

const row = (overrides: Partial<OverviewExecutionRow> = {}): OverviewExecutionRow => ({
  modelId: "oi-model", status: "SUCCEEDED", stageCount: 3, providerCallCount: 1,
  retrievalQueryCount: 0, memoryLookupCount: 0, contextTokens: 40, inputTokens: 12,
  outputTokens: 8, verificationStatus: "NOT_REQUIRED", startedAt: new Date("2026-10-17T10:00:00Z"),
  completedAt: new Date("2026-10-17T10:00:01Z"),
  summary: { toolCalls: 0, verificationPasses: 0, revisions: 0, cognitiveKernel: { budget: { used: { backtracks: 0 } } } },
  ...overrides
});

void test("overview activity is a bounded count-only projection and preserves explicit zeroes", () => {
  const result = buildOverviewActivity([row()]);
  const metrics = result.metrics as Record<string, { value: number | null; state: string }>;
  const metric = (key: string) => metrics[key]!;
  assert.equal(result.state, "LIVE");
  assert.equal(result.sampleSize, 1);
  assert.equal(metric("stages").value, 3);
  assert.equal(metric("providerCalls").value, 1);
  assert.equal(metric("retrievalQueries").value, 0);
  assert.equal(metric("memoryLookups").value, 0);
  assert.equal(metric("toolCalls").value, 0);
  assert.equal(metric("verificationRounds").value, 0);
  assert.equal(metric("repairRounds").value, 0);
  assert.equal(metric("backtracks").value, 0);
  assert.equal("summary" in result, false);
  const history = result.history as Array<Record<string, unknown>>;
  assert.equal("inputTokens" in history[0]!, false);
  assert.equal(history[0]!.contextTokens, 40);
  assert.equal("summary" in history[0]!, false);
});

void test("missing persisted summary counters stay unavailable instead of becoming zero", () => {
  const result = buildOverviewActivity([row({ summary: {} })]);
  const metrics = result.metrics as Record<string, { value: number | null; state: string }>;
  const metric = (key: string) => metrics[key]!;
  assert.equal(metric("toolCalls").value, null);
  assert.equal(metric("toolCalls").state, "UNAVAILABLE");
  assert.equal(metric("verificationRounds").value, null);
  assert.equal(metric("repairRounds").value, null);
  assert.equal(metric("backtracks").value, null);
});

void test("empty execution source is explicit and the result exposes no execution content", () => {
  const result = buildOverviewActivity([]);
  const metrics = result.metrics as Record<string, { value: number | null; state: string }>;
  const metric = (key: string) => metrics[key]!;
  assert.equal(result.state, "NO_DATA_YET");
  assert.equal(metric("executions").value, 0);
  assert.equal(metric("executions").state, "NO_DATA_YET");
  assert.deepEqual(result.history, []);
});

void test("overview activity is bounded to the latest fifty rows", () => {
  const rows = Array.from({ length: 55 }, (_, index) => row({ stageCount: index }));
  const result = buildOverviewActivity(rows);
  const metrics = result.metrics as Record<string, { value: number | null; state: string; sampleSize: number }>;
  const metric = (key: string) => metrics[key]!;
  assert.equal(result.sampleSize, 50);
  assert.equal(metric("stages").value, rows.slice(0, 50).reduce((total, item) => total + item.stageCount, 0));
  assert.equal((result.history as unknown[]).length, 50);
});
