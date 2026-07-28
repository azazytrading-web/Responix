import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
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
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum CompilerVariableType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  JSON = "JSON",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
  NULL = "NULL"
}

export enum CompilerVariableSource {
  EXECUTION_RUNTIME = "EXECUTION_RUNTIME",
  AGENT_RUNTIME = "AGENT_RUNTIME",
  WORKSPACE = "WORKSPACE",
  CONVERSATION = "CONVERSATION",
  EXECUTION_METADATA = "EXECUTION_METADATA",
  ENVIRONMENT = "ENVIRONMENT",
  STATIC_DEFAULT = "STATIC_DEFAULT",
  PROMPT_DEFAULT = "PROMPT_DEFAULT"
}

export class CompilerVariableDto {
  @ApiProperty({ pattern: "^[A-Za-z][A-Za-z0-9_.-]*$", maxLength: 160 })
  @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: CompilerVariableType })
  @IsEnum(CompilerVariableType)
  type!: CompilerVariableType;

  @ApiProperty({ enum: CompilerVariableSource })
  @IsEnum(CompilerVariableSource)
  source!: CompilerVariableSource;

  @ApiProperty({ nullable: true, description: "JSON-compatible variable value" })
  @IsDefined()
  value!: unknown;
}

export class PromptSectionsDto {
  @ApiPropertyOptional({ maxLength: 250000 })
  @IsOptional() @IsString() @MaxLength(250000)
  systemPrompt?: string;

  @ApiPropertyOptional({ maxLength: 250000 })
  @IsOptional() @IsString() @MaxLength(250000)
  developerPrompt?: string;

  @ApiPropertyOptional({ maxLength: 250000 })
  @IsOptional() @IsString() @MaxLength(250000)
  userPrompt?: string;
}

export class AssistantHistoryDto {
  @ApiProperty({ maxLength: 250000 })
  @IsString() @MaxLength(250000)
  content!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class PromptMetadataBlockDto {
  @ApiProperty({ maxLength: 120 })
  @IsString() @MaxLength(120)
  type!: string;

  @ApiProperty({ description: "JSON-compatible metadata block content" })
  @IsDefined()
  content!: unknown;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class PromptConditionDto {
  @ApiProperty({ maxLength: 160 })
  @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  variable!: string;

  @ApiProperty({ enum: ["EXISTS", "EQUALS", "NOT_EQUALS"] })
  @IsEnum({ EXISTS: "EXISTS", EQUALS: "EQUALS", NOT_EQUALS: "NOT_EQUALS" })
  operator!: "EXISTS" | "EQUALS" | "NOT_EQUALS";

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160)
  target?: string;
}

export class CompilePromptDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  promptId!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  promptVersionId!: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentVersionId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentRuntimeSnapshotId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRequestId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ type: PromptSectionsDto })
  @IsOptional() @ValidateNested() @Type(() => PromptSectionsDto)
  sections?: PromptSectionsDto;

  @ApiPropertyOptional({ type: [AssistantHistoryDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => AssistantHistoryDto)
  assistantHistory?: AssistantHistoryDto[];

  @ApiPropertyOptional({ type: [PromptMetadataBlockDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => PromptMetadataBlockDto)
  metadataBlocks?: PromptMetadataBlockDto[];

  @ApiPropertyOptional({ type: [PromptConditionDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => PromptConditionDto)
  conditions?: PromptConditionDto[];

  @ApiPropertyOptional({ type: [CompilerVariableDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => CompilerVariableDto)
  variables?: CompilerVariableDto[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  conversationMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  runtimeMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  executionMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  environmentMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  workspaceMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000000, default: 100000 })
  @IsOptional() @IsInt() @Min(1) @Max(1000000)
  maxPromptSizeBytes?: number;
}

export class CompiledPromptListQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  promptId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  promptVersionId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentVersionId?: string;
}

export class CompareCompiledPromptsDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  leftId!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  rightId!: string;
}

