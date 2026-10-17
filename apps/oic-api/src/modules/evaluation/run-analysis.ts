import { pairedStratifiedBootstrap, type TrialValue } from "./statistics";
import { Prisma } from "@oic/database";

export function accountingEvidence(value: unknown): string | number | null {
  if (value instanceof Prisma.Decimal) return value.isFinite() ? value.toString() : null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) return value;
  return null;
}

export type AnalysisMeasurement = {
  caseId: string;
  trial: number;
  metricKey: string;
  metricRevision: number;
  type: string;
  unit: string;
  availability: string;
  value: unknown;
  evidenceDigest: string | null;
};

export type ExpectedMetric = { metricKey: string; revision: number; type: string; unit: string; polarity: string; minimumEffectiveN: number };

const finiteNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

/** Builds a bounded report projection; raw artifacts, prompts, oracle bytes and arbitrary JSON are excluded. */
export function buildRunAnalysis(input: {
  plannedCases: number;
  terminalCases: number;
  expectedMetrics: readonly ExpectedMetric[];
  measurements: readonly AnalysisMeasurement[];
  failures: readonly string[];
}) {
  const groups = new Map<string, AnalysisMeasurement[]>();
  for (const measurement of input.measurements) {
    const key = `${measurement.metricKey}@${measurement.metricRevision}`;
    const group = groups.get(key) ?? [];
    group.push(measurement);
    groups.set(key, group);
  }
  const metrics = input.expectedMetrics.map((expected) => {
    const key = `${expected.metricKey}@${expected.revision}`;
    const rows = groups.get(key) ?? [];
    const available = rows.filter((row) => row.availability === "MEASURED");
    const missingByReason: Record<string, number> = {};
    for (const row of rows) if (row.availability !== "MEASURED") missingByReason[row.availability] = (missingByReason[row.availability] ?? 0) + 1;
    const unrecorded = Math.max(0, input.plannedCases - rows.length);
    if (unrecorded) missingByReason.NOT_RECORDED = unrecorded;
    const numericValues = available.flatMap((row) => {
      const value = row.type === "BOOLEAN" && typeof row.value === "boolean" ? Number(row.value) : finiteNumber(row.value);
      return value === null ? [] : [{ caseId: row.caseId, trial: row.trial, value }];
    });
    const categoricalCounts: Record<string, number> = {};
    if (expected.type === "CATEGORY") for (const row of available) {
      if (typeof row.value === "string" && row.value.length <= 128) categoricalCounts[row.value] = (categoricalCounts[row.value] ?? 0) + 1;
    }
    const measuredN = expected.type === "CATEGORY" ? Object.values(categoricalCounts).reduce((sum, count) => sum + count, 0) : numericValues.length;
    const plannedN = input.plannedCases;
    const values = numericValues.map((row) => row.value);
    return {
      metricKey: expected.metricKey,
      revision: expected.revision,
      type: expected.type,
      unit: expected.unit,
      polarity: expected.polarity,
      minimumEffectiveN: expected.minimumEffectiveN,
      availability: measuredN >= Math.max(1, expected.minimumEffectiveN) ? "MEASURED" : "INSUFFICIENT",
      measuredN,
      missingN: Math.max(0, plannedN - measuredN),
      coverage: plannedN === 0 ? null : measuredN / plannedN,
      ...(values.length ? { descriptive: { mean: values.reduce((sum, value) => sum + value, 0) / values.length, minimum: Math.min(...values), maximum: Math.max(...values) } } : {}),
      ...(Object.keys(categoricalCounts).length ? { categoryCounts: categoricalCounts } : {}),
      missingByReason,
      trials: rows.map((row) => ({ caseId: row.caseId, trial: row.trial, availability: row.availability, ...(row.availability === "MEASURED" ? { value: row.value } : {}), evidenceDigestPresent: typeof row.evidenceDigest === "string" && /^[a-f0-9]{64}$/i.test(row.evidenceDigest) }))
    };
  });
  const noExpectedMetrics = input.expectedMetrics.length === 0;
  const coverageComplete = input.plannedCases > 0 && input.terminalCases === input.plannedCases;
  const measurementsComplete = !noExpectedMetrics && metrics.every((metric) => metric.availability === "MEASURED" && metric.measuredN >= input.plannedCases);
  const complete = coverageComplete && measurementsComplete && input.failures.length === 0;
  return {
    status: complete ? "COMPLETE" : "INCOMPLETE",
    decisionEligible: false,
    completeness: { plannedCases: input.plannedCases, terminalCases: input.terminalCases, expectedMetricCount: input.expectedMetrics.length, measuredMetricCount: metrics.filter((metric) => metric.measuredN > 0).length, failureCodes: [...new Set(input.failures)].sort() },
    metrics,
    limitations: noExpectedMetrics ? ["NO_PREREGISTERED_METRICS"] : complete ? [] : ["INCOMPLETE_EVIDENCE"]
  };
}

export function estimatePairedMetric(input: {
  baseline: readonly { caseId: string; trial: number; value: unknown; availability: string }[];
  candidate: readonly { caseId: string; trial: number; value: unknown; availability: string }[];
  valueType: string;
  plannedPairs: number;
  minimumCases: number;
  seed: number;
}) {
  const rows = (items: typeof input.baseline): TrialValue[] => items.flatMap((item) => {
    // Boolean-to-0/1 conversion is valid only for a metric whose pinned type
    // is BOOLEAN. Never coerce truthy/falsy values or other metric types.
    const value = input.valueType === "BOOLEAN" && typeof item.value === "boolean"
      ? Number(item.value)
      : finiteNumber(item.value);
    return item.availability === "MEASURED" && value !== null ? [{ caseId: item.caseId, trial: item.trial, value }] : [];
  });
  return pairedStratifiedBootstrap(rows(input.baseline), rows(input.candidate), { plannedPairs: input.plannedPairs, minimumCases: input.minimumCases, seed: input.seed });
}
