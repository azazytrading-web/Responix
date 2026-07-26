import type {
  ProviderExecutionCredential,
  ProviderExecutionRequest,
  ProviderExecutionResult
} from "../contracts";

export interface AiProviderAdapter {
  readonly providerName: string;
  invoke(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential
  ): Promise<ProviderExecutionResult>;
}
