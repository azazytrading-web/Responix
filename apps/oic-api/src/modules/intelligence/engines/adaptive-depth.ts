import type { OicIntelligenceProfilePolicy } from "@oic/contracts";
import type { ReasoningStrategy, TaskAnalysis } from "./types";

export type AdaptiveExecutionPlan = { strategy: ReasoningStrategy; decompose: boolean; retrieve: boolean; verify: boolean; candidates: number; revisionRounds: number; reasons: string[] };

/** Preset intensity changes actual query, memory, plan, verification, and call budgets. */
export function selectAdaptiveDepth(task: TaskAnalysis, profile: OicIntelligenceProfilePolicy, hasRetrievalSource: boolean, baseline = false): AdaptiveExecutionPlan {
  if (baseline) return { strategy: "DIRECT", decompose: false, retrieve: false, verify: false, candidates: 1, revisionRounds: 0, reasons: ["engineering baseline disables optional OIC augmentation"] };
  const reasons = [...task.reasons];
  const retrieve = hasRetrievalSource && profile.retrievalIntensity >= 25 && (task.evidenceRequired || task.complexity >= 40 || profile.retrievalIntensity >= 75);
  const verify = profile.verificationIntensity >= 25 && (task.structuredOutput || task.evidenceRequired || task.complexity >= 30 || task.taskType === "TOOL_REQUIRED");
  const decompose = profile.reasoningIntensity >= 50 && task.subtaskCount > 1 && task.complexity >= 28;
  const candidates = Math.min(profile.maxCandidates, profile.reasoningIntensity >= 90 && task.complexity >= 70 ? Math.max(1, profile.maxCandidates) : 1);
  const revisionRounds = profile.allowRevision && verify ? Math.min(profile.maxVerificationRounds, profile.reasoningIntensity >= 70 ? 2 : 1) : 0;
  let strategy: ReasoningStrategy = "DIRECT";
  if (retrieve && task.evidenceRequired) strategy = verify ? "EVIDENCE_FIRST" : "PLAN_THEN_EXECUTE";
  else if (decompose && verify) strategy = "VERIFY_AND_REVISE";
  else if (decompose) strategy = "STRUCTURED_DECOMPOSITION";
  else if (task.structuredOutput) strategy = "CONSTRAINT_SOLVE";
  else if (verify) strategy = "VERIFY_AND_REVISE";
  if (retrieve) reasons.push(`retrieval enabled at intensity ${profile.retrievalIntensity}`);
  if (decompose) reasons.push(`bounded decomposition selected for ${task.subtaskCount} request clauses`);
  if (verify) reasons.push(`verification enabled at intensity ${profile.verificationIntensity}`);
  if (candidates > 1) { strategy = "MULTI_CANDIDATE"; reasons.push(`${candidates} bounded candidates allowed by profile`); }
  if (profile.efficiencyIntensity >= 75 && task.complexity < 25) reasons.push("high efficiency policy skipped optional stages for a low-complexity task");
  return { strategy, decompose, retrieve, verify, candidates, revisionRounds, reasons };
}
