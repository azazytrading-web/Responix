import type { TaskAnalysis, PlannedStep } from "./types";

/** Produces a bounded dependency graph; nodes describe approved OIC operations, never executable code. */
export function createExecutionPlan(analysis: TaskAnalysis, options: { maxStages: number; retrieval: boolean; verify: boolean; decompose: boolean }): PlannedStep[] {
  const steps: PlannedStep[] = [];
  if (options.retrieval) steps.push({ id: "retrieve-1", kind: "RETRIEVE", goal: "Select scoped, relevant evidence", dependsOn: [], state: "READY" });
  const prior = steps.map((step) => step.id);
  if (options.decompose && analysis.subtaskCount > 1) {
    const count = Math.min(analysis.subtaskCount, Math.max(1, options.maxStages - prior.length - Number(options.verify) - 1));
    for (let index = 0; index < count; index++) steps.push({ id: `model-${index + 1}`, kind: "MODEL", goal: `Address bounded request part ${index + 1}`, dependsOn: prior, state: prior.length ? "BLOCKED" : "READY" });
  } else {
    steps.push({ id: "model-1", kind: "MODEL", goal: "Execute selected reasoning strategy", dependsOn: prior, state: prior.length ? "BLOCKED" : "READY" });
  }
  if (options.verify && steps.length < options.maxStages) steps.push({ id: "verify-1", kind: "VERIFY", goal: "Check output constraints and evidence use", dependsOn: steps.filter((step) => step.kind === "MODEL").map((step) => step.id), state: "BLOCKED" });
  if (steps.length < options.maxStages && steps.filter((step) => step.kind === "MODEL").length > 1) steps.push({ id: "synthesize-1", kind: "SYNTHESIZE", goal: "Combine completed subtask results", dependsOn: steps.filter((step) => step.kind === "MODEL").map((step) => step.id), state: "BLOCKED" });
  return steps.slice(0, Math.max(1, Math.min(32, options.maxStages)));
}

export function markReadySteps(plan: PlannedStep[]): PlannedStep[] {
  const completed = new Set(plan.filter((step) => step.state === "COMPLETE").map((step) => step.id));
  return plan.map((step) => step.state === "BLOCKED" && step.dependsOn.every((id) => completed.has(id)) ? { ...step, state: "READY" } : step);
}
