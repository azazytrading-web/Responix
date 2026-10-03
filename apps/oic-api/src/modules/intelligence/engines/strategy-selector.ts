import type { OicIntelligenceProfilePolicy, OicResolvedModel } from "@oic/contracts";
import type { AdaptiveExecutionPlan } from "./adaptive-depth";
import type { TaskAnalysis, ReasoningStrategy } from "./types";

export type StrategySelection = AdaptiveExecutionPlan & { toolDecision: "TOOL_NOT_NEEDED" | "TOOL_REQUIRED" | "TOOL_OPTIONAL"; toolKey?: "oic.calculator" | "oic.unit-converter"; candidateCount: number; decompositionGoals: string[] };
const clauses = (request: string) => request.split(/(?:\n+|[.!?;]+|\b(?:and then|also|while|because|then|additionally)\b)/i).map((item) => item.trim()).filter((item) => item.length >= 12).slice(0, 8);

/** Selects observable bounded execution behavior; no internal reasoning text is created or stored. */
export function selectReasoningStrategy(input: { task: TaskAnalysis; profile: OicIntelligenceProfilePolicy; base: AdaptiveExecutionPlan; requestText: string; hasEvidence: boolean; model: OicResolvedModel }): StrategySelection {
  const { task, profile, base } = input;
  const decompositionGoals = clauses(input.requestText);
  const canDecompose = profile.reasoningIntensity >= 45 && task.complexity >= 30 && decompositionGoals.length > 1;
  let strategy: ReasoningStrategy = base.strategy;
  if (base.retrieve && task.evidenceRequired) strategy = input.hasEvidence ? "EVIDENCE_FIRST" : "HYPOTHESIS_TEST";
  else if (task.structuredOutput) strategy = "CONSTRAINT_SOLVE";
  else if (canDecompose) strategy = "STRUCTURED_DECOMPOSITION";
  else if (base.verify) strategy = "VERIFY_AND_REVISE";
  else if (profile.reasoningIntensity >= 70 && task.complexity >= 55) strategy = "ITERATIVE_REFINEMENT";
  const candidateCount = Math.min(profile.maxCandidates, profile.maxProviderCalls, profile.reasoningIntensity >= 85 && task.complexity >= 60 ? Math.max(2, profile.maxCandidates) : 1);
  if (candidateCount > 1) strategy = "MULTI_CANDIDATE";
  const unitConversion = /\bconvert\s+-?\d+(?:\.\d+)?\s*(?:mm|cm|km|m|ft|mi)\s+to\s+(?:mm|cm|km|m|ft|mi)\b/i.test(input.requestText);
  const arithmetic = /\b(calculate|compute|what is|solve)\b[^\n]{0,80}(?:\d\s*[+*/()-]\s*\d)/i.test(input.requestText);
  const toolRequired = unitConversion || arithmetic;
  const toolDecision = toolRequired && profile.toolsIntensity > 0 && profile.maxToolCalls > 0 ? "TOOL_REQUIRED" : task.taskType === "TOOL_REQUIRED" ? "TOOL_OPTIONAL" : "TOOL_NOT_NEEDED";
  const toolKey = toolDecision === "TOOL_REQUIRED" ? unitConversion ? "oic.unit-converter" : "oic.calculator" : undefined;
  const verify = base.verify || toolDecision === "TOOL_REQUIRED" && profile.verificationIntensity >= 25;
  const revisionRounds = profile.allowRevision && verify ? Math.min(profile.maxVerificationRounds, Math.max(base.revisionRounds, 1)) : 0;
  const reasons = [...base.reasons, `strategy selector chose ${strategy} using task=${task.taskType}, complexity=${task.complexity}, uncertainty=${task.uncertainty}`, `candidate budget resolved to ${candidateCount}`, `tool decision=${toolDecision}${toolKey ? ` (${toolKey})` : ""}`];
  return { ...base, strategy, decompose: canDecompose && candidateCount === 1, verify, candidates: candidateCount, candidateCount, revisionRounds: Math.min(revisionRounds, profile.maxVerificationRounds), toolDecision, ...(toolKey ? { toolKey } : {}), decompositionGoals: canDecompose ? decompositionGoals : [], reasons };
}
