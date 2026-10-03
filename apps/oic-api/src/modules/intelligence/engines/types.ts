import type { OicIntelligenceProfilePolicy, OicRuntimeMessage } from "@oic/contracts";

export type TaskType = "SIMPLE_FACTUAL" | "TRANSFORMATION" | "EXTRACTION" | "SUMMARY" | "REASONING" | "CODING" | "PLANNING" | "RETRIEVAL" | "TOOL_REQUIRED" | "STRUCTURED" | "CONVERSATION";
export type Uncertainty = "LOW_UNCERTAINTY" | "MEDIUM_UNCERTAINTY" | "HIGH_UNCERTAINTY";
export type ReasoningStrategy = "DIRECT" | "STRUCTURED_DECOMPOSITION" | "PLAN_THEN_EXECUTE" | "EVIDENCE_FIRST" | "HYPOTHESIS_TEST" | "MULTI_CANDIDATE" | "COMPARE_AND_SELECT" | "VERIFY_AND_REVISE" | "CONSTRAINT_SOLVE" | "ITERATIVE_REFINEMENT";
export type StopReason = "SUCCESS" | "ENOUGH_EVIDENCE" | "NO_USEFUL_PROGRESS" | "RESOURCE_LIMIT" | "TIME_LIMIT" | "UNRESOLVED_UNCERTAINTY" | "HARD_FAILURE";
export type TrustClass = "SYSTEM_TRUSTED" | "APPLICATION_TRUSTED" | "TOOL_TRUSTED" | "RETRIEVED_UNTRUSTED" | "MEMORY_UNTRUSTED" | "USER_UNTRUSTED";
export type EvidenceRelationship = "SUPPORTS" | "CONTRADICTS" | "SUPERSEDES" | "EXPANDS" | "DUPLICATES" | "DEPENDS_ON";

export type TaskAnalysis = {
  taskType: TaskType;
  complexity: number;
  uncertainty: Uncertainty;
  evidenceRequired: boolean;
  structuredOutput: boolean;
  subtaskCount: number;
  reasons: string[];
};

export type OicEvidence = {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceRef: string;
  trust: "RETRIEVED_UNTRUSTED" | "MEMORY_UNTRUSTED" | "TOOL_TRUSTED";
  authority: number;
  relevance: number;
  freshness: number;
  relationship?: EvidenceRelationship;
  /** Explicit IDs of evidence records required to interpret this item. IDs are linked only when in the shared scoped graph. */
  dependsOnEvidenceIds?: string[];
  kind: "KNOWLEDGE" | "MEMORY" | "TOOL";
  scope?: string;
  /** Internal ownership used to keep evidence nodes and edges inside the active runtime scope. */
  applicationId?: string;
  tenantId?: string | null;
};

export type PlannedStep = {
  id: string;
  kind: "RETRIEVE" | "MODEL" | "VERIFY" | "SYNTHESIZE";
  goal: string;
  dependsOn: string[];
  state: "READY" | "BLOCKED" | "COMPLETE" | "FAILED";
};

export type VerificationFinding = {
  dimension: "INSTRUCTION_COMPLIANCE" | "EVIDENCE_GROUNDING" | "CONTRADICTION" | "LOGICAL_CONSISTENCY" | "STRUCTURE" | "CALCULATION" | "TOOL_CONSISTENCY" | "COMPLETENESS" | "UNSUPPORTED_CLAIM" | "TASK_COMPLETION";
  status: "PASS" | "WARNING" | "FAIL";
  code: string;
  evidenceIds: string[];
};

export type VerificationResult = {
  status: "PASS" | "PASS_WITH_WARNINGS" | "REVISE" | "FAIL";
  findings: VerificationFinding[];
  uncertainty: Uncertainty;
  claimEvidence?: { claims: Array<{ claimId: string; fingerprint: string; status: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "NOT_REQUIRING_EXTERNAL_EVIDENCE"; evidenceIds: string[]; overlap: number }>; summary: { supported: number; partiallySupported: number; unsupported: number; notRequiringEvidence: number } };
};

export type CompiledContext = {
  input: OicRuntimeMessage[];
  tokenEstimate: number;
  originalTokenEstimate: number;
  categoryTokens: Record<"instructions" | "user" | "conversation" | "memory" | "retrieval" | "tool", number>;
  evidence: OicEvidence[];
  truncatedCategories: string[];
  compression: { whitespaceCharactersRemoved: number; duplicateEvidenceRemoved: number; budgetTruncatedItems: number; irrelevantEvidenceExcluded: number };
};

export type IntelligenceRunPolicy = OicIntelligenceProfilePolicy & { baseline?: boolean };
