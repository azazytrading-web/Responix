import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WorkflowRuntimeStatus } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min } from "class-validator";

export class ExecuteWorkflowDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() workflowVersionId!: string;
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  correlationId!: string;
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  idempotencyKey!: string;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @Matches(/^[A-Za-z0-9._:-]+$/)
  @MaxLength(200) traceId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  input?: Record<string, unknown>;
  @ApiPropertyOptional({ minimum: 1000, maximum: 3600000, default: 300000 })
  @IsOptional() @IsInt() @Min(1000) @Max(3600000) timeoutMs?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional() @IsInt() @Min(1) @Max(50) maxDepth?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 10000, default: 1000 })
  @IsOptional() @IsInt() @Min(1) @Max(10000) maxNodeExecutions?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class CancelWorkflowExecutionDto {
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  reason?: string;
}

export class ResolveApprovalDto {
  @ApiProperty() @IsBoolean() approved!: boolean;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  reason?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  output?: Record<string, unknown>;
}

export class WorkflowExecutionListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @ApiPropertyOptional({ enum: WorkflowRuntimeStatus }) @IsOptional() @IsEnum(WorkflowRuntimeStatus)
  status?: WorkflowRuntimeStatus;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() workflowId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() workflowVersionId?: string;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  correlationId?: string;
}
