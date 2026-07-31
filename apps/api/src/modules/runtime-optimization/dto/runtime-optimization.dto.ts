import { Type } from "class-transformer";
import {
  IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RuntimeOptimizationPackageStatus, RuntimeOptimizationPackageType } from "@prisma/client";
import { IsEnum } from "class-validator";

export class CacheCompiledPromptDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  compiledPromptId!: string;
}
export class CacheRenderedPromptDto extends CacheCompiledPromptDto {
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  staticVariables!: Record<string, unknown>;
}
export class CreateRuntimeContextSnapshotDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  compiledPromptId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  providerRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  conversationRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  retrievalRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionPipelineSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionProfileVersionId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  immutableMetadata?: Record<string, unknown>;
}
export class CacheRetrievalRuntimeDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  retrievalRuntimeSnapshotId!: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray()
  @IsString({ each: true })
  languages?: string[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  searchConfiguration?: Record<string, unknown>;
}
export class CacheMemoryRuntimeDto {
  @ApiProperty({ type: [String], format: "uuid" }) @IsArray() @IsUUID("4", { each: true })
  memoryRuntimeSnapshotIds!: string[];
}
export class RuntimeOptimizationListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number)
  @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number)
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional({ enum: RuntimeOptimizationPackageType })
  @IsOptional() @IsEnum(RuntimeOptimizationPackageType)
  type?: RuntimeOptimizationPackageType;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[a-f0-9]{64}$/)
  sourceHash?: string;
  @ApiPropertyOptional({ maxLength: 300 }) @IsOptional() @IsString() @MaxLength(300)
  scopeKey?: string;
  @ApiPropertyOptional({ enum: RuntimeOptimizationPackageStatus }) @IsOptional()
  @IsEnum(RuntimeOptimizationPackageStatus)
  status?: RuntimeOptimizationPackageStatus;
}

export class CacheImmutablePackageDto {
  @ApiProperty({ enum: RuntimeOptimizationPackageType }) @IsEnum(RuntimeOptimizationPackageType)
  type!: RuntimeOptimizationPackageType;
  @ApiProperty({ maxLength: 300 }) @IsString() @MaxLength(300)
  scopeKey!: string;
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) @Matches(/^[a-f0-9]{64}$/)
  sourceHash!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  payload!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "string" } })
  @IsOptional() @IsObject() references?: Record<string, string>;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1)
  revision?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  savedTokens?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  compileTimeMs?: number;
}

export class InvalidateOptimizationPackageDto {
  @ApiProperty({ maxLength: 1000 }) @IsString() @MaxLength(1000)
  reason!: string;
}
