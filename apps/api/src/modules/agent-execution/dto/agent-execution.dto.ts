import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min, ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AgentExecutionOrchestrationStatus } from "@prisma/client";
import { RetrievalExecutionMode } from "@prisma/client";
import { IsEnum } from "class-validator";

export class PrepareAgentExecutionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  agentRuntimeSnapshotId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID()
  promptExecutionPayloadId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID()
  providerRuntimeSnapshotId!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  conversationRuntimeSnapshotId?: string;
  @ApiProperty({ format: "uuid" }) @IsUUID()
  executionPipelineSnapshotId!: string;
  @ApiPropertyOptional({ format: "uuid", description: "Parent Execution Kernel run for nested orchestration" })
  @IsOptional() @IsUUID()
  parentExecutionRunId?: string;
  @ApiProperty({ maxLength: 200 }) @IsString()
  @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  correlationId!: string;
  @ApiProperty({ maxLength: 200 }) @IsString()
  @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  idempotencyKey!: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional() @IsInt() @Min(0) @Max(1000)
  priority?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID("4", { each: true })
  memoryRuntimeSnapshotIds?: string[];
  @ApiPropertyOptional({ maxLength: 32 }) @IsOptional() @Matches(/^\d+\.\d+$/)
  memoryCompatibilityVersion?: string;
}

export class AgentMemoryWriteDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() runtimeId!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  content!: Record<string, unknown>;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedStateVersion!: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class AgentToolCallDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() toolVersionId!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  input!: Record<string, unknown>;
  @ApiPropertyOptional({ minimum: 1, maximum: 3600000 }) @IsOptional() @IsInt() @Min(1) @Max(3600000)
  timeoutMs?: number;
}

export class CancelAgentExecutionDto {
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  reason?: string;
}

export class ExecuteAgentExecutionDto extends PrepareAgentExecutionDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @MaxLength(100)
  taskType!: string;
  @ApiPropertyOptional({ maxLength: 250000 }) @IsOptional() @IsString() @MaxLength(250000)
  userMessage?: string;
  @ApiPropertyOptional({ maxLength: 12 }) @IsOptional() @IsString() @MaxLength(12)
  language?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  retrievalRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ enum: RetrievalExecutionMode }) @IsOptional() @IsEnum(RetrievalExecutionMode)
  retrievalMode?: RetrievalExecutionMode;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100)
  retrievalTopK?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100000 }) @IsOptional() @IsInt() @Min(1) @Max(100000)
  retrievalTokenBudget?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  staticVariables?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [AgentMemoryWriteDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true })
  @Type(() => AgentMemoryWriteDto)
  memoryWrites?: AgentMemoryWriteDto[];
  @ApiPropertyOptional({ type: [AgentToolCallDto], maxItems: 50 })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true })
  @Type(() => AgentToolCallDto)
  toolCalls?: AgentToolCallDto[];
  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID("4", { each: true })
  availableToolVersionIds?: string[];
}

export class StreamAgentExecutionDto extends ExecuteAgentExecutionDto {
  @ApiPropertyOptional({ minimum: 1000, maximum: 300000 })
  @IsOptional() @IsInt() @Min(1000) @Max(300000)
  timeoutMs?: number;
}

export class AgentExecutionListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number)
  @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number)
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional({ enum: AgentExecutionOrchestrationStatus })
  @IsOptional() @IsEnum(AgentExecutionOrchestrationStatus)
  status?: AgentExecutionOrchestrationStatus;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  correlationId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRequestId?: string;
}
