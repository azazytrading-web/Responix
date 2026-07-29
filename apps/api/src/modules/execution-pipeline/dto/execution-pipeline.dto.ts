import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsEnum, IsInt, IsObject, IsOptional,
  IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ExecutionPipelineStatus } from "@prisma/client";

export enum PipelineAssetType {
  EXECUTION_REQUEST = "EXECUTION_REQUEST",
  AGENT_RUNTIME = "AGENT_RUNTIME",
  COMPILED_PROMPT = "COMPILED_PROMPT",
  PROVIDER_RUNTIME = "PROVIDER_RUNTIME",
  RETRIEVAL_RUNTIME = "RETRIEVAL_RUNTIME",
  CONVERSATION_RUNTIME = "CONVERSATION_RUNTIME",
  WORKFLOW = "WORKFLOW",
  EXECUTION_PROFILE = "EXECUTION_PROFILE"
}
export enum PipelineVariableType {
  STRING = "STRING", NUMBER = "NUMBER", BOOLEAN = "BOOLEAN", JSON = "JSON",
  ARRAY = "ARRAY", OBJECT = "OBJECT", NULL = "NULL"
}

export class PipelineNodeDto {
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120) nodeKey!: string;
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120) stage!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) ordinal!: number;
  @ApiPropertyOptional({ enum: PipelineAssetType }) @IsOptional() @IsEnum(PipelineAssetType)
  assetType?: PipelineAssetType;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() assetId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
export class PipelineDependencyDto {
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120) dependencyKey!: string;
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120) fromNodeKey!: string;
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120) toNodeKey!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
export class PipelineVariableDto {
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160) name!: string;
  @ApiProperty({ enum: PipelineVariableType }) @IsEnum(PipelineVariableType) type!: PipelineVariableType;
  @ApiProperty({ nullable: true }) @IsDefined() value!: unknown;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() required?: boolean;
}
export class PipelineValueDto {
  @ApiProperty() @IsString() @MaxLength(160) value!: string;
}
export class PipelineMetadataDto {
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160) key!: string;
  @ApiProperty({ nullable: true }) @IsDefined() value!: unknown;
}
export class CreateExecutionPipelineDto {
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiProperty({ example: "1.0.0" }) @Matches(/^\d+\.\d+\.\d+$/) compatibilityVersion!: string;
  @ApiProperty({ type: [PipelineNodeDto] }) @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => PipelineNodeDto) nodes!: PipelineNodeDto[];
  @ApiPropertyOptional({ type: [PipelineDependencyDto] }) @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => PipelineDependencyDto) dependencies?: PipelineDependencyDto[];
  @ApiPropertyOptional({ type: [PipelineVariableDto] }) @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => PipelineVariableDto) variables?: PipelineVariableDto[];
  @ApiPropertyOptional({ type: [PipelineMetadataDto] }) @IsOptional() @IsArray() @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => PipelineMetadataDto) metadataItems?: PipelineMetadataDto[];
  @ApiPropertyOptional({ type: [PipelineValueDto] }) @IsOptional() @IsArray() @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => PipelineValueDto) labels?: PipelineValueDto[];
  @ApiPropertyOptional({ type: [PipelineValueDto] }) @IsOptional() @IsArray() @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => PipelineValueDto) tags?: PipelineValueDto[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
export class UpdateExecutionPipelineDto extends CreateExecutionPipelineDto {}
export class CloneExecutionPipelineDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) name?: string;
}
export class RollbackExecutionPipelineDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() revisionId!: string;
}
export class ExecutionPipelineListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsEnum(ExecutionPipelineStatus) status?: ExecutionPipelineStatus;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
}
export class ExecutionPipelineSnapshotQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsUUID() pipelineId?: string;
}
export class CompareExecutionPipelineSnapshotsDto {
  @IsUUID() leftId!: string;
  @IsUUID() rightId!: string;
}
