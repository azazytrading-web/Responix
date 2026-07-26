import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AiResponseContract } from "../contracts";
import type { WorkspaceProvider } from "../providers/provider.types";
import type { RoutingDecision } from "../router/routing.types";

export class AiModelResponseDto {
  @ApiProperty() modelId!: string;
  @ApiProperty() modelName!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "DEPRECATED"] }) status!:
    "ACTIVE" | "DISABLED" | "DEPRECATED";
  @ApiProperty() priority!: number;
  @ApiProperty() contextWindow!: number;
  @ApiPropertyOptional() maxOutputTokens?: number;
  @ApiProperty() supportsVision!: boolean;
  @ApiProperty() supportsAudio!: boolean;
  @ApiProperty() supportsTools!: boolean;
  @ApiProperty() supportsReasoning!: boolean;
  @ApiProperty() supportsStreaming!: boolean;

  static from(model: WorkspaceProvider["models"][number]): AiModelResponseDto {
    return Object.assign(new AiModelResponseDto(), {
      modelId: model.modelId,
      modelName: model.modelName,
      displayName: model.displayName,
      status: model.status,
      priority: model.priority,
      contextWindow: model.contextWindow,
      ...(model.maxOutputTokens === undefined ? {} : { maxOutputTokens: model.maxOutputTokens }),
      supportsVision: model.supportsVision,
      supportsAudio: model.supportsAudio,
      supportsTools: model.supportsTools,
      supportsReasoning: model.supportsReasoning,
      supportsStreaming: model.supportsStreaming
    });
  }
}

export class AiProviderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() providerName!: string;
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "UNHEALTHY"] }) status!:
    "ACTIVE" | "DISABLED" | "UNHEALTHY";
  @ApiProperty() priority!: number;
  @ApiProperty() configured!: boolean;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: [AiModelResponseDto] }) models!: AiModelResponseDto[];

  static from(provider: WorkspaceProvider): AiProviderResponseDto {
    return Object.assign(new AiProviderResponseDto(), {
      id: provider.id,
      providerName: provider.providerName,
      status: provider.status,
      priority: provider.priority,
      configured: provider.configuration !== null,
      enabled: provider.configuration?.enabled ?? false,
      models: provider.models.map((model) => AiModelResponseDto.from(model))
    });
  }
}

export class AiFallbackResponseDto {
  @ApiProperty() providerId!: string;
  @ApiProperty() modelId!: string;
}

export class AiRoutingSelectionResponseDto {
  @ApiProperty() providerId!: string;
  @ApiProperty() modelId!: string;
  @ApiProperty({ type: "object", additionalProperties: true })
  decisionFactors!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "array", items: { type: "object", additionalProperties: true } })
  candidateMetadata?: Record<string, unknown>[];
}

export class AiRoutingResponseDto extends AiRoutingSelectionResponseDto {
  @ApiProperty({ type: [AiFallbackResponseDto] }) fallbacks!: AiFallbackResponseDto[];

  static from(decision: RoutingDecision): AiRoutingResponseDto {
    return Object.assign(new AiRoutingResponseDto(), {
      providerId: decision.providerId,
      modelId: decision.modelId,
      decisionFactors: decision.decisionFactors,
      ...(decision.candidateMetadata
        ? { candidateMetadata: decision.candidateMetadata.map((candidate) => ({ ...candidate })) }
        : {}),
      fallbacks: decision.fallbacks.map((fallback) =>
        Object.assign(new AiFallbackResponseDto(), fallback)
      )
    });
  }
}

export class AiUsageResponseDto {
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;
  @ApiProperty() cachedTokens!: number;
  @ApiProperty() totalTokens!: number;
}

export class AiCostResponseDto {
  @ApiProperty() inputCost!: string;
  @ApiProperty() outputCost!: string;
  @ApiProperty() totalCost!: string;
  @ApiProperty() currency!: string;
}

export class AiInvocationResponseDto {
  @ApiProperty() requestId!: string;
  @ApiProperty() providerId!: string;
  @ApiProperty() modelId!: string;
  @ApiProperty() content!: string;
  @ApiPropertyOptional() finishReason?: string;
  @ApiProperty({ type: AiUsageResponseDto }) usage!: AiUsageResponseDto;
  @ApiProperty({ type: AiCostResponseDto }) cost!: AiCostResponseDto;
  @ApiProperty({ type: AiRoutingSelectionResponseDto })
  routing!: AiRoutingSelectionResponseDto;

  static from(response: AiResponseContract): AiInvocationResponseDto {
    return Object.assign(new AiInvocationResponseDto(), {
      requestId: response.requestId,
      providerId: response.providerId,
      modelId: response.modelId,
      content: response.content,
      ...(response.finishReason ? { finishReason: response.finishReason } : {}),
      usage: Object.assign(new AiUsageResponseDto(), response.usage),
      cost: Object.assign(new AiCostResponseDto(), response.cost),
      routing: Object.assign(new AiRoutingSelectionResponseDto(), {
        providerId: response.routing.providerId,
        modelId: response.routing.modelId,
        decisionFactors: response.routing.decisionFactors,
        ...(response.routing.candidateMetadata
          ? { candidateMetadata: response.routing.candidateMetadata.map((item) => ({ ...item })) }
          : {})
      })
    });
  }
}

export class AiErrorResponseDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
}
