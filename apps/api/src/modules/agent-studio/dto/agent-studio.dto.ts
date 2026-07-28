import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AgentPromptRole, AgentStatus, AgentVisibility } from "@prisma/client";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AgentPromptVariableDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/)
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  defaultValue?: unknown;
}

export class AgentPromptBindingDto {
  @ApiProperty({ enum: AgentPromptRole })
  @IsEnum(AgentPromptRole)
  role!: AgentPromptRole;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  promptId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  promptVersionId?: string;

  @ApiPropertyOptional({ type: [AgentPromptVariableDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AgentPromptVariableDto)
  variableMetadata?: AgentPromptVariableDto[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AgentCapabilitiesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  knowledgeEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  toolsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reasoningEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  voiceEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  imageEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  streamingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  moderationEnabled?: boolean;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AgentRetryPolicyDto {
  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts!: number;

  @ApiProperty({ minimum: 0, maximum: 60000 })
  @IsInt()
  @Min(0)
  @Max(60000)
  backoffMs!: number;

  @ApiPropertyOptional({ maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  backoffMultiplier?: number;
}

export class AgentConfigurationDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  providerId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  modelId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  providerConfigurationId?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  providerConfiguration?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  modelConfiguration?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  runtimeConfiguration?: Record<string, unknown>;

  @ApiProperty({ minimum: 0, maximum: 2, default: 0.7 })
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  maxTokens!: number;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  stopSequences?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  streaming?: boolean;

  @ApiPropertyOptional({ minimum: 100, maximum: 600000, default: 30000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(600000)
  timeoutMs?: number;

  @ApiPropertyOptional({ type: AgentRetryPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgentRetryPolicyDto)
  retryPolicy?: AgentRetryPolicyDto;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  fallbackStrategy?: Record<string, unknown>;
}

export class CreateAgentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  avatarMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  colorMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  iconMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: AgentVisibility, default: AgentVisibility.WORKSPACE })
  @IsOptional()
  @IsEnum(AgentVisibility)
  visibility?: AgentVisibility;

  @ApiProperty({ type: AgentConfigurationDto })
  @ValidateNested()
  @Type(() => AgentConfigurationDto)
  configuration!: AgentConfigurationDto;

  @ApiPropertyOptional({ type: AgentCapabilitiesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgentCapabilitiesDto)
  capabilities?: AgentCapabilitiesDto;

  @ApiPropertyOptional({ type: [AgentPromptBindingDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AgentPromptBindingDto)
  promptBindings?: AgentPromptBindingDto[];
}

export class UpdateAgentDraftDto extends PartialType(CreateAgentDto) {}

export class PublishAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeSummary?: string;
}

export class RollbackAgentDto extends PublishAgentDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  revision!: number;
}

export class CloneAgentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;
}

export class AgentListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: AgentStatus })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional({ enum: AgentVisibility })
  @IsOptional()
  @IsEnum(AgentVisibility)
  visibility?: AgentVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;
}
