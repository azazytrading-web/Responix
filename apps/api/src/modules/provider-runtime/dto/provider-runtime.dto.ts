import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProviderRuntimeStatus } from "@prisma/client";

export class ProviderRequestOptionsDto {
  @ApiProperty({ minimum: 0, maximum: 10000000 })
  @IsInt() @Min(0) @Max(10000000)
  estimatedInputTokens!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000000 })
  @IsOptional() @IsInt() @Min(1) @Max(10000000)
  maxOutputTokens?: number;

  @ApiPropertyOptional({ minimum: -100, maximum: 100 })
  @IsOptional() @IsNumber() @Min(-100) @Max(100)
  temperature?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @IsNumber() @Min(0) @Max(100)
  topP?: number;

  @ApiPropertyOptional({ minimum: -100, maximum: 100 })
  @IsOptional() @IsNumber() @Min(-100) @Max(100)
  presencePenalty?: number;

  @ApiPropertyOptional({ minimum: -100, maximum: 100 })
  @IsOptional() @IsNumber() @Min(-100) @Max(100)
  frequencyPenalty?: number;

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(1000, { each: true })
  stopSequences?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  structuredOutput?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  vision?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  image?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  tools?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  streaming?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  reasoning?: boolean;
}

export class PrepareProviderRequestDto extends ProviderRequestOptionsDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  compiledPromptId!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  agentRuntimeSnapshotId!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MaxLength(120)
  providerVersion?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional() @IsString() @MaxLength(120)
  modelVersion?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  conversationMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  requestMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  executionPolicies?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  safetyMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  traceMetadata?: Record<string, unknown>;
}

export class ProviderRequestListQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ProviderRuntimeStatus })
  @IsOptional() @IsEnum(ProviderRuntimeStatus)
  status?: ProviderRuntimeStatus;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  modelId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRequestId?: string;
}

export class ProviderSnapshotListQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  requestId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  modelId?: string;
}

export class CompareProviderSnapshotsDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  leftId!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  rightId!: string;
}
