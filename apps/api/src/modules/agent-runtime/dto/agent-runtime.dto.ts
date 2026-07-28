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
import { AgentRuntimeStatus } from "@prisma/client";

export enum RuntimeVariableSource {
  EXECUTION_REQUEST = "EXECUTION_REQUEST",
  AGENT = "AGENT",
  CONVERSATION = "CONVERSATION",
  WORKSPACE = "WORKSPACE",
  EXECUTION = "EXECUTION",
  ENVIRONMENT = "ENVIRONMENT"
}

export enum RuntimeVariableType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  OBJECT = "OBJECT",
  ARRAY = "ARRAY",
  ANY = "ANY"
}

export class RuntimeVariableDto {
  @ApiProperty({ maxLength: 160, pattern: "^[A-Za-z][A-Za-z0-9_.-]*$" })
  @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: RuntimeVariableType })
  @IsEnum(RuntimeVariableType)
  type!: RuntimeVariableType;

  @ApiProperty({ enum: RuntimeVariableSource })
  @IsEnum(RuntimeVariableSource)
  source!: RuntimeVariableSource;

  @ApiProperty({ description: "JSON-compatible runtime value" })
  @IsDefined()
  value!: unknown;
}

export class RuntimeConversationContextDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  parentExecutionRunId?: string;

  @ApiPropertyOptional({ type: "array", items: { type: "object" }, maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsObject({ each: true })
  historyReferences?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: "array", items: { type: "object" }, maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsObject({ each: true })
  memoryReferences?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  participantMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  tokenAccountingMetadata?: Record<string, unknown>;
}

export class RuntimePromptContextDto {
  @ApiPropertyOptional({ type: "array", items: { type: "object" }, maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsObject({ each: true })
  assistantHistory?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: "array", items: { type: "object" }, maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsObject({ each: true })
  metadataBlocks?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: "array", items: { type: "object" }, maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsObject({ each: true })
  attachments?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: "array", items: { type: "object" }, maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsObject({ each: true })
  templateReferences?: Record<string, unknown>[];
}

export class AgentRuntimeContextDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  traceId!: string;

  @ApiPropertyOptional({ maxLength: 35, example: "en-US" })
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/) @MaxLength(35)
  locale?: string;

  @ApiPropertyOptional({ maxLength: 100, example: "Africa/Cairo" })
  @IsOptional() @IsString() @Matches(/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)*$/) @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  requestMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  executionMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  environmentMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  tenantMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  runtimeMetadata?: Record<string, unknown>;
}

export class PrepareAgentRuntimeDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  agentId!: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentVersionId?: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  executionProfileId!: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionProfileVersionId?: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  executionRequestId!: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRunId?: string;

  @ApiProperty({ type: AgentRuntimeContextDto })
  @ValidateNested() @Type(() => AgentRuntimeContextDto)
  context!: AgentRuntimeContextDto;

  @ApiPropertyOptional({ type: [RuntimeVariableDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => RuntimeVariableDto)
  variables?: RuntimeVariableDto[];

  @ApiPropertyOptional({ type: RuntimeConversationContextDto })
  @IsOptional() @ValidateNested() @Type(() => RuntimeConversationContextDto)
  conversation?: RuntimeConversationContextDto;

  @ApiPropertyOptional({ type: RuntimePromptContextDto })
  @IsOptional() @ValidateNested() @Type(() => RuntimePromptContextDto)
  prompt?: RuntimePromptContextDto;
}

export class AgentRuntimeListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: AgentRuntimeStatus })
  @IsOptional() @IsEnum(AgentRuntimeStatus)
  status?: AgentRuntimeStatus;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  conversationId?: string;
}

