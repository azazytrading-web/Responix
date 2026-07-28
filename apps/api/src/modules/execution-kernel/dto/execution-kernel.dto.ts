import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ExecutionKernelStatus,
  ExecutionLogLevel,
  ExecutionSourceType,
  ExecutionStepStatus
} from "@prisma/client";

const codePattern = /^[A-Za-z][A-Za-z0-9._:-]*$/;

export class CreateExecutionRequestDto {
  @ApiProperty({ enum: ExecutionSourceType }) @IsEnum(ExecutionSourceType)
  sourceType!: ExecutionSourceType;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  sourceReferenceId?: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  correlationId!: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  idempotencyKey!: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: 0 })
  @IsOptional() @IsInt() @Min(0) @Max(1000)
  priority?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateExecutionRunDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  parentRunId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  runtimeMetadata?: Record<string, unknown>;
}

export class TransitionExecutionDto {
  @ApiProperty({ enum: ExecutionKernelStatus }) @IsEnum(ExecutionKernelStatus)
  status!: ExecutionKernelStatus;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  expectedStateVersion?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  message?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class CancelExecutionDto {
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  expectedStateVersion?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  reason?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordExecutionFailureDto {
  @ApiProperty() @Matches(codePattern) @MaxLength(160)
  code!: string;
  @ApiProperty() @IsString() @MaxLength(4000)
  message!: string;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  expectedStateVersion?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordExecutionStepDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  sequence!: number;
  @ApiProperty() @Matches(codePattern) @MaxLength(160)
  stepType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240)
  name?: string;
  @ApiProperty({ enum: ExecutionStepStatus }) @IsEnum(ExecutionStepStatus)
  status!: ExecutionStepStatus;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  inputMetadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  outputMetadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  errorMetadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: String, format: "date-time" }) @Type(() => Date) @IsOptional() @IsDate()
  startedAt?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" }) @Type(() => Date) @IsOptional() @IsDate()
  endedAt?: Date;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class AppendExecutionEventDto {
  @ApiProperty() @Matches(codePattern) @MaxLength(160)
  eventType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000)
  message?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class AppendExecutionLogDto {
  @ApiProperty({ enum: ExecutionLogLevel }) @IsEnum(ExecutionLogLevel)
  level!: ExecutionLogLevel;
  @ApiProperty() @IsString() @MaxLength(10000)
  message!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  stepId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionRequestListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional({ enum: ExecutionSourceType }) @IsOptional() @IsEnum(ExecutionSourceType)
  sourceType?: ExecutionSourceType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  correlationId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  requestedById?: string;
}

export class ExecutionRunListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional({ enum: ExecutionKernelStatus }) @IsOptional() @IsEnum(ExecutionKernelStatus)
  status?: ExecutionKernelStatus;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  requestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  correlationId?: string;
}
