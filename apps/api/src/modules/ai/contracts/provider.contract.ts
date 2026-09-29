export interface AiModelCapabilityContract {
  modelId: string;
  providerId: string;
  version?: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  supportsJson: boolean;
  supportsFunctionCalling: boolean;
  supportsVideo: boolean;
  supportsMcp: boolean;
  categories: string[];
  maxOutputTokens?: number;
}
