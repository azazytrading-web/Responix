export interface AiModelCapabilityContract {
  modelId: string;
  providerId: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  supportsJson: boolean;
  maxOutputTokens?: number;
}
