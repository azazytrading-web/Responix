import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ToolExecutionMode, ToolRuntimeStatus } from "@prisma/client";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString,
  IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class ToolMemoryWriteDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() runtimeId!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  content!: Record<string, unknown>;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedStateVersion!: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ToolRetrievalRequestDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() retrievalRuntimeSnapshotId!: string;
  @ApiProperty() @IsString() @MaxLength(250000) query!: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100)
  topK?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100000 }) @IsOptional() @IsInt() @Min(1) @Max(100000)
  tokenBudget?: number;
}

export class ExecuteToolDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() toolVersionId!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  input!: Record<string, unknown>;
  @ApiPropertyOptional({ enum: ToolExecutionMode, default: ToolExecutionMode.SYNC })
  @IsOptional() @IsEnum(ToolExecutionMode) mode?: ToolExecutionMode;
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  correlationId!: string;
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  idempotencyKey!: string;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200)
  traceId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() parentExecutionId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() parentExecutionRunId?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 3600000 }) @IsOptional() @IsInt() @Min(1) @Max(3600000)
  timeoutMs?: number;
  @ApiPropertyOptional({ type: ToolRetrievalRequestDto }) @IsOptional() @ValidateNested()
  @Type(() => ToolRetrievalRequestDto) retrieval?: ToolRetrievalRequestDto;
  @ApiPropertyOptional({ type: [ToolMemoryWriteDto], maxItems: 100 }) @IsOptional() @IsArray()
  @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ToolMemoryWriteDto)
  memoryWrites?: ToolMemoryWriteDto[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  promptVariables?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class CancelToolExecutionDto {
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class ToolExecutionListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @ApiPropertyOptional({ enum: ToolRuntimeStatus }) @IsOptional() @IsEnum(ToolRuntimeStatus) status?: ToolRuntimeStatus;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() toolId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() toolVersionId?: string;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200) correlationId?: string;
}
