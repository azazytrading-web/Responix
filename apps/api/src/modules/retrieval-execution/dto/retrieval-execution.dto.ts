import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNumber, IsObject, IsOptional,
  IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RetrievalExecutionMode, RetrievalExecutionStatus } from "@prisma/client";

export class RetrievalExecutionFilterDto {
  @ApiProperty({ maxLength: 160 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  key!: string;
  @ApiProperty({ enum: ["EQUALS", "NOT_EQUALS", "IN", "NOT_IN", "EXISTS"] })
  @IsEnum({ EQUALS: "EQUALS", NOT_EQUALS: "NOT_EQUALS", IN: "IN", NOT_IN: "NOT_IN", EXISTS: "EXISTS" })
  operator!: "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN" | "EXISTS";
  @ApiProperty() value!: unknown;
}

export class ExecuteRetrievalDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() retrievalRuntimeSnapshotId!: string;
  @ApiProperty({ maxLength: 250000 }) @IsString() @MaxLength(250000) query!: string;
  @ApiPropertyOptional({ enum: RetrievalExecutionMode, default: RetrievalExecutionMode.HYBRID })
  @IsOptional() @IsEnum(RetrievalExecutionMode) mode?: RetrievalExecutionMode;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional() @IsInt() @Min(1) @Max(100) topK?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 0 })
  @IsOptional() @IsNumber() @Min(0) @Max(1) minScore?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100000, default: 4000 })
  @IsOptional() @IsInt() @Min(1) @Max(100000) maxTokens?: number;
  @ApiPropertyOptional({ default: "1.0" }) @IsOptional() @Matches(/^\d+\.\d+$/)
  compatibilityVersion?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRunId?: string;
  @ApiPropertyOptional({ type: [RetrievalExecutionFilterDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true })
  @Type(() => RetrievalExecutionFilterDto) filters?: RetrievalExecutionFilterDto[];
  @ApiPropertyOptional({ type: [String], maxItems: 100 }) @IsOptional() @IsArray()
  @ArrayMaxSize(100) @IsString({ each: true }) providerCapabilities?: string[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RetrievalExecutionListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @ApiPropertyOptional({ enum: RetrievalExecutionStatus }) @IsOptional() @IsEnum(RetrievalExecutionStatus) status?: RetrievalExecutionStatus;
  @ApiPropertyOptional({ enum: RetrievalExecutionMode }) @IsOptional() @IsEnum(RetrievalExecutionMode) mode?: RetrievalExecutionMode;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() retrievalRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ maxLength: 250 }) @IsOptional() @IsString() @MaxLength(250) search?: string;
}
