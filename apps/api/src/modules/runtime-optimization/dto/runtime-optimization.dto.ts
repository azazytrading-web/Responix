import { Type } from "class-transformer";
import {
  IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RuntimeOptimizationPackageType } from "@prisma/client";
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
}
