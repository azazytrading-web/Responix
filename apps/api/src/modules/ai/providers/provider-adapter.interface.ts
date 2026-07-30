import type {
  ProviderExecutionCredential,
  ProviderExecutionRequest,
  ProviderExecutionResult,
  ProviderStreamEvent
} from "../contracts";
import type { ProviderPromptCache } from "./provider-prompt-cache.interface";

export interface AiProviderAdapter {
  readonly providerName: string;
  readonly contractVersion?: string;
  readonly promptCache?: ProviderPromptCache;
  invoke(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential
  ): Promise<ProviderExecutionResult>;
  stream?(
    request: ProviderExecutionRequest,
    credential: ProviderExecutionCredential,
    emit: (event: ProviderStreamEvent) => Promise<void>
  ): Promise<void>;
}
