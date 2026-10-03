import type { StopReason, VerificationResult } from "./types";

export type ExecutionBudget = { maxStages: number; maxProviderCalls: number; maxQueries: number; deadlineAt: number; startedAt: number; priorEvidenceCount?: number };
export function chooseStop(input: { budget: ExecutionBudget; stageCount: number; providerCalls: number; queryCount: number; verification?: VerificationResult; evidenceCount: number; previousEvidenceCount?: number; now?: number }): StopReason | null {
  const now = input.now ?? Date.now();
  if (now >= input.budget.deadlineAt) return "TIME_LIMIT";
  if (input.verification?.status === "PASS") return "SUCCESS";
  if (input.verification?.status === "PASS_WITH_WARNINGS" && input.evidenceCount > 0) return "ENOUGH_EVIDENCE";
  if (input.stageCount >= input.budget.maxStages || input.providerCalls >= input.budget.maxProviderCalls || input.queryCount >= input.budget.maxQueries) return "RESOURCE_LIMIT";
  if (input.previousEvidenceCount !== undefined && input.evidenceCount <= input.previousEvidenceCount) return "NO_USEFUL_PROGRESS";
  return null;
}

export type EngineRegistryEntry = { key: string; version: string; status: "ACTIVE" | "DISABLED"; capabilities: string[]; configurationSchema: string };
export const OIC_INTELLIGENCE_ENGINES: readonly EngineRegistryEntry[] = Object.freeze([
  { key: "task-analyzer", version: "1.0.0", status: "ACTIVE", capabilities: ["task-type", "complexity-signals", "uncertainty-signals"], configurationSchema: "task-analysis-v1" },
  { key: "query-planner", version: "1.0.0", status: "ACTIVE", capabilities: ["normalized", "decomposed", "entity-query"], configurationSchema: "retrieval-policy-v1" },
  { key: "context-compiler", version: "1.0.0", status: "ACTIVE", capabilities: ["trust-labels", "deduplication", "budgeting", "provenance"], configurationSchema: "context-policy-v1" },
  { key: "memory-policy", version: "1.0.0", status: "ACTIVE", capabilities: ["typed-write-decision", "conflict-signals", "sensitivity-gate"], configurationSchema: "memory-policy-v1" },
  { key: "hybrid-retriever", version: "1.0.0", status: "ACTIVE", capabilities: ["lexical", "feature-vector", "authority", "freshness", "rank-fusion"], configurationSchema: "retrieval-policy-v1" },
  { key: "adaptive-reasoner", version: "1.0.0", status: "ACTIVE", capabilities: ["bounded-decomposition", "candidate-policy", "revision"], configurationSchema: "reasoning-policy-v1" },
  { key: "verifier", version: "1.0.0", status: "ACTIVE", capabilities: ["structure", "coverage", "evidence-reference", "uncertainty"], configurationSchema: "verification-policy-v1" }
]);
