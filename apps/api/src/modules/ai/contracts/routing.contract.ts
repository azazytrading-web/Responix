export interface AiRoutingDecisionContract {
  providerId: string;
  modelId: string;
  decisionFactors: Record<string, unknown>;
  candidateMetadata?: Record<string, unknown>[];
}
