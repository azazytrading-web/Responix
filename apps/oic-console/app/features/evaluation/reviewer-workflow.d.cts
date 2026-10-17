type Anchor = { id: string; language: string; task: string; responseA: string; responseB: string; rubric: string };
type MetricControl = { kind: "choices"; values: string[] } | { kind: "boolean"; values: boolean[] } | { kind: "number"; minimum: number; maximum: number; step: number | "any" } | null;
declare const workflow: {
  parseCalibrationAnchor(value: unknown): Anchor | null;
  calibrationProgress(anchors: Anchor[], selections: Record<string, string>): { total: number; answered: number; abstentions: number; completed: number; complete: boolean };
  buildCalibrationPayload(policyId: string, anchors: Anchor[], selections: Record<string, string>): { policyId: string; answers: Record<string, string>; abstentions: string[] };
  safeBlindProjection(value: unknown): Record<string, unknown> & { candidates?: { label: "A" | "B" | "CANDIDATE"; content: string }[] };
  safeReviewProjection(value: unknown, mode: "PAIRWISE" | "SINGLE_BOOLEAN"): (Record<string, unknown> & { candidates?: { label: "A" | "B" | "CANDIDATE"; content: string }[] }) | null;
  metricControl(definition: unknown): MetricControl;
  assignmentState(assignments: unknown[], calibrationEligible: boolean): "NOT_READY" | "READY" | "IN_PROGRESS" | "SUBMITTED";
};
export = workflow;
