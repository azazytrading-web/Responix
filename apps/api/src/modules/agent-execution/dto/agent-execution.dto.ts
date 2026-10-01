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
  @ApiPropertyOptional({ format: "uuid", description: "Required for LEGACY Agents; optional for explicitly assigned OIC Agents" })
  @IsOptional() @IsUUID()
  providerRuntimeSnapshotId?: string;
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

export class AgentConversationMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsString()
  role!: "user" | "assistant";

  @ApiProperty({ maxLength: 250000 })
  @IsString()
  @MaxLength(250000)
  content!: string;

  /**
   * Optional provenance for `assistant` turns. When present, the runtime
   * enables the Agent Context Boundary and renders any turn not produced by
   * the current agent as attributed historical data (never as the current
   * agent's own `assistant` output). Absent for single-agent history, which
   * keeps the legacy role-mapping behavior.
   */
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  agentName?: string;
}

export class AgentIdentityDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  agentName?: string;
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
  @ApiPropertyOptional({ type: [AgentConversationMessageDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true })
  @Type(() => AgentConversationMessageDto)
  conversationHistory?: AgentConversationMessageDto[];
  /**
   * Identity of the Responix executing this request. Used to authoritatively
   * declare the current agent at the context-assembly boundary and to
   * distinguish the current agent's own history from other agents' history.
   * Optional: single-agent callers may omit it (legacy behavior is preserved).
   */
  @ApiPropertyOptional({ type: AgentIdentityDto })
  @IsOptional() @ValidateNested()
  @Type(() => AgentIdentityDto)
  agentIdentity?: AgentIdentityDto;
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
