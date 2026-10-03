import { createHash } from "node:crypto";
import type { OicEvidence, TaskAnalysis, VerificationResult } from "./types";

export type WorkingMemorySubproblem = { id: string; state: "READY" | "BLOCKED" | "RUNNING" | "COMPLETE" | "FAILED" | "SKIPPED"; dependsOn: string[]; resultRef?: string };
export type WorkingMemorySnapshot = {
  scope: "EXECUTION_ONLY";
  task: { type: string; complexity: number; evidenceRequired: boolean; structuredOutput: boolean };
  constraints: string[];
  unresolved: string[];
  evidenceRefs: string[];
  hypotheses: Array<{ id: string; assessment: string; evidenceRefs: string[] }>;
  subproblems: WorkingMemorySubproblem[];
  toolResultRefs: string[];
  verifierFindings: string[];
  revisionTargets: string[];
};

/** Ephemeral structured execution state. It stores references and decision codes, never prompt or answer text. */
export class OicWorkingMemory {
  private readonly evidenceRefs = new Set<string>();
  private readonly toolResultRefs = new Set<string>();
  private readonly verifierFindings = new Set<string>();
  private readonly revisionTargets = new Set<string>();
  private readonly unresolved = new Set<string>();
  private hypotheses: WorkingMemorySnapshot["hypotheses"] = [];
  private subproblems: WorkingMemorySubproblem[] = [];

  constructor(private readonly task: TaskAnalysis) {
    if (task.evidenceRequired) this.unresolved.add("evidence-coverage");
    if (task.structuredOutput) this.unresolved.add("structured-output-validation");
  }

  recordEvidence(evidence: OicEvidence[]) {
    evidence.forEach((item) => this.evidenceRefs.add(item.id));
    if (evidence.length) this.unresolved.delete("evidence-coverage");
  }

  recordHypotheses(items: Array<{ id: string; assessment: string; evidenceRefs: string[] }>) {
    this.hypotheses = items.map((item) => ({ id: item.id, assessment: item.assessment, evidenceRefs: [...item.evidenceRefs] }));
    if (items.some((item) => item.assessment === "INSUFFICIENT_EVIDENCE")) this.unresolved.add("hypothesis-evidence-gap");
    else this.unresolved.delete("hypothesis-evidence-gap");
  }

  recordSubproblems(items: WorkingMemorySubproblem[]) {
    this.subproblems = items.map((item) => ({ ...item, dependsOn: [...item.dependsOn] }));
  }

  completeSubproblem(id: string, result: string) {
    const item = this.subproblems.find((candidate) => candidate.id === id);
    if (item) { item.state = "COMPLETE"; item.resultRef = createHash("sha256").update(result).digest("hex").slice(0, 16); }
  }

  recordToolResult(toolKey: string, reference: string) { this.toolResultRefs.add(`${toolKey}:${reference}`); }

  recordVerification(result: VerificationResult) {
    this.verifierFindings.clear(); this.revisionTargets.clear();
    for (const finding of result.findings) {
      this.verifierFindings.add(`${finding.dimension}:${finding.status}:${finding.code}`);
      if (finding.status !== "PASS") this.revisionTargets.add(finding.code);
    }
    if (result.findings.some((finding) => finding.status === "FAIL" || finding.status === "WARNING")) this.unresolved.add("verification-findings");
    else this.unresolved.delete("verification-findings");
    if (result.findings.some((finding) => finding.dimension === "STRUCTURE" && finding.status === "FAIL")) this.unresolved.add("structured-output-validation");
    else this.unresolved.delete("structured-output-validation");
  }

  snapshot(): WorkingMemorySnapshot {
    return {
      scope: "EXECUTION_ONLY",
      task: { type: this.task.taskType, complexity: this.task.complexity, evidenceRequired: this.task.evidenceRequired, structuredOutput: this.task.structuredOutput },
      constraints: [...(this.task.evidenceRequired ? ["evidence-required"] : []), ...(this.task.structuredOutput ? ["structured-output"] : [])],
      unresolved: [...this.unresolved], evidenceRefs: [...this.evidenceRefs], hypotheses: this.hypotheses.map((item) => ({ ...item, evidenceRefs: [...item.evidenceRefs] })),
      subproblems: this.subproblems.map((item) => ({ ...item, dependsOn: [...item.dependsOn] })), toolResultRefs: [...this.toolResultRefs],
      verifierFindings: [...this.verifierFindings], revisionTargets: [...this.revisionTargets]
    };
  }
}
