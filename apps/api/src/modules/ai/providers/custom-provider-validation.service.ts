import { ForbiddenException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AiContractError } from "../contracts";
import type { CustomProviderValidationResponseDto } from "../dto/custom-provider.dto";
import { OPENAI_CHAT_COMPLETIONS_V1_PROTOCOL } from "./openai-chat-completions-v1.adapter";
import { ProviderRegistry } from "./provider.registry";
import { CustomProviderCredentialService } from "./custom-provider-credential.service";
import { CustomProviderRepository } from "./custom-provider.repository";
import { CustomProviderValidationRepository } from "./custom-provider-validation.repository";

const VALIDATION_MAX_OUTPUT_TOKENS = 8;
const VALIDATION_TIMEOUT_MS = 15_000;
const VALIDATION_MESSAGE = "Reply OK.";

@Injectable()
export class CustomProviderValidationService {
  constructor(
    private readonly providers: CustomProviderRepository,
    private readonly credentials: CustomProviderCredentialService,
    private readonly registry: ProviderRegistry,
    private readonly validations: CustomProviderValidationRepository
  ) {}

  async validate(
    workspaceId: string,
    actorId: string,
    providerId: string
  ): Promise<CustomProviderValidationResponseDto> {
    const provider = await this.providers.get(workspaceId, providerId);
    if (provider.status === "ARCHIVED") {
      throw new ForbiddenException("Archived Custom Providers cannot be tested");
    }

    const startedAt = Date.now();
    let available = false;
    let errorCode: string | undefined;
    let providerStatus: number | undefined;

    try {
      if (provider.status !== "ACTIVE" && provider.status !== "DISABLED") {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "Custom Provider state is invalid");
      }
      if (provider.protocolId !== OPENAI_CHAT_COMPLETIONS_V1_PROTOCOL) {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "Custom Provider protocol is unavailable");
      }

      const adapter = this.registry.get(provider.protocolId);
      await this.credentials.useCredentialForValidation(workspaceId, provider.id, (credential) =>
        adapter.invoke({
          requestId: `custom-provider-validation-${randomUUID()}`,
          modelId: provider.validationModelId,
          modelName: provider.validationModelId,
          apiBaseUrl: provider.baseUrl,
          messages: [{ role: "user", content: VALIDATION_MESSAGE }],
          maxOutputTokens: VALIDATION_MAX_OUTPUT_TOKENS,
          signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
          customProvider: {
            workspaceId,
            providerId: provider.id,
            supportsStreaming: provider.supportsStreaming,
            supportsTools: provider.supportsTools,
            allowDisabledForValidation: true
          }
        }, credential).then(() => undefined)
      );
      available = true;
    } catch (error) {
      errorCode = this.safeErrorCode(error);
      providerStatus = this.safeProviderStatus(error);
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    const record = await this.validations.record({
      workspaceId,
      actorId,
      customProviderId: provider.id,
      protocolId: provider.protocolId,
      available,
      latencyMs,
      ...(errorCode ? { errorCode } : {}),
      ...(providerStatus ? { providerStatus } : {})
    });

    return {
      providerId: provider.id,
      protocolId: provider.protocolId,
      available,
      checkedAt: record.checkedAt.toISOString(),
      latencyMs,
      ...(errorCode ? { errorCode } : {}),
      ...(providerStatus ? { providerStatus } : {})
    };
  }

  private safeErrorCode(error: unknown): string {
    if (error instanceof AiContractError) return error.code;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return "PROVIDER_UNAVAILABLE";
    }
    return "UNKNOWN";
  }

  private safeProviderStatus(error: unknown): number | undefined {
    if (!(error instanceof AiContractError)) return undefined;
    const status = error.metadata?.providerStatus;
    return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
      ? status
      : undefined;
  }
}
