import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional,
  IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemoryReferenceKind, MemoryRuntimeStatus, MemoryRuntimeType } from "@prisma/client";

export class MemoryReferenceDto {
  @ApiProperty({ maxLength: 120 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120)
  referenceKey!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID()
  targetRuntimeId!: string;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1)
  targetRevision?: number;
  @ApiProperty({ enum: MemoryReferenceKind }) @IsEnum(MemoryReferenceKind)
  kind!: MemoryReferenceKind;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  required?: boolean;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateMemoryRuntimeDto {
  @ApiProperty({ maxLength: 120 }) @Matches(/^[a-z][a-z0-9._-]*$/) @MaxLength(120)
  identifier!: string;
  @ApiProperty({ maxLength: 160 }) @IsString() @MaxLength(160)
  name!: string;
  @ApiProperty({ enum: MemoryRuntimeType }) @IsEnum(MemoryRuntimeType)
  type!: MemoryRuntimeType;
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/) @MaxLength(200)
  scopeKey!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  content!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiProperty({ maxLength: 32 }) @Matches(/^\d+\.\d+$/) @MaxLength(32)
  compatibilityVersion!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRunId?: string;
  @ApiPropertyOptional({ type: [MemoryReferenceDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => MemoryReferenceDto)
  references?: MemoryReferenceDto[];
}

export class UpdateMemoryRuntimeDto {
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  content!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0)
  expectedStateVersion!: number;
  @ApiPropertyOptional({ type: [MemoryReferenceDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => MemoryReferenceDto)
  references?: MemoryReferenceDto[];
}

export class ResolveMemoryRuntimeDto {
  @ApiProperty({ type: [String], format: "uuid", maxItems: 100 })
  @IsArray() @ArrayMaxSize(100) @IsUUID("4", { each: true })
  snapshotIds!: string[];
  @ApiProperty({ maxLength: 32 }) @Matches(/^\d+\.\d+$/)
  compatibilityVersion!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRunId?: string;
}

export class CommitMemoryWritesDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  runtimeId!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  content!: Record<string, unknown>;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0)
  expectedStateVersion!: number;
  @ApiProperty({ format: "uuid" }) @IsUUID()
  executionRunId!: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class MemoryRuntimeListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional({ enum: MemoryRuntimeType }) @IsOptional() @IsEnum(MemoryRuntimeType)
  type?: MemoryRuntimeType;
  @ApiPropertyOptional({ enum: MemoryRuntimeStatus }) @IsOptional() @IsEnum(MemoryRuntimeStatus)
  status?: MemoryRuntimeStatus;
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  scopeKey?: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MaxLength(160)
  search?: string;
}

export class MemorySnapshotListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  runtimeId?: string;
}

export class CompareMemorySnapshotsDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() leftId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() rightId!: string;
}

export class RollbackMemoryRuntimeDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() versionId!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedStateVersion!: number;
}
