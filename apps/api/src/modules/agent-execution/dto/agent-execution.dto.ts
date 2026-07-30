import { Type } from "class-transformer";
import {
  IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AgentExecutionOrchestrationStatus } from "@prisma/client";
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
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  staticVariables?: Record<string, unknown>;
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
