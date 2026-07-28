import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsDefined,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RetrievalRuntimeStatus } from "@prisma/client";

export enum RetrievalFilterOperator {
  EQUALS = "EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  IN = "IN",
  NOT_IN = "NOT_IN",
  EXISTS = "EXISTS"
}

export enum RetrievalVariableType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  JSON = "JSON",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
  NULL = "NULL"
}

export class RetrievalSourceDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  documentId!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  versionId!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RetrievalCollectionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  collectionId!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RetrievalFilterDto {
  @ApiProperty({ maxLength: 160 })
  @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  key!: string;

  @ApiProperty({ enum: RetrievalFilterOperator })
  @IsEnum(RetrievalFilterOperator)
  operator!: RetrievalFilterOperator;

  @ApiProperty({ nullable: true })
  @IsDefined()
  value!: unknown;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RetrievalVariableDto {
  @ApiProperty({ maxLength: 160 })
  @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: RetrievalVariableType })
  @IsEnum(RetrievalVariableType)
  type!: RetrievalVariableType;

  @ApiProperty({ nullable: true })
  @IsDefined()
  value!: unknown;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class PrepareRetrievalRuntimeDto {
  @ApiProperty({ maxLength: 160 })
  @IsString() @MaxLength(160)
  name!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  knowledgeBaseId!: string;

  @ApiPropertyOptional({ maxLength: 35, pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$" })
  @IsOptional() @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/) @MaxLength(35)
  language?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @IsString({ each: true }) @MaxLength(255, { each: true })
  allowedMimeTypes?: string[];

  @ApiPropertyOptional({ type: [RetrievalSourceDto], maxItems: 10000 })
  @IsOptional() @IsArray() @ArrayMaxSize(10000)
  @ValidateNested({ each: true }) @Type(() => RetrievalSourceDto)
  sources?: RetrievalSourceDto[];

  @ApiPropertyOptional({ type: [RetrievalCollectionDto], maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000)
  @ValidateNested({ each: true }) @Type(() => RetrievalCollectionDto)
  collections?: RetrievalCollectionDto[];

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID("4", { each: true })
  folderIds?: string[];

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID("4", { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: [RetrievalFilterDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => RetrievalFilterDto)
  filters?: RetrievalFilterDto[];

  @ApiPropertyOptional({ type: [RetrievalVariableDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => RetrievalVariableDto)
  variables?: RetrievalVariableDto[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RetrievalRuntimeListQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: RetrievalRuntimeStatus })
  @IsOptional() @IsEnum(RetrievalRuntimeStatus)
  status?: RetrievalRuntimeStatus;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  knowledgeBaseId?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160)
  search?: string;
}

export class RetrievalSnapshotListQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  runtimeId?: string;
}

export class CompareRetrievalSnapshotsDto {
  @ApiProperty({ format: "uuid" }) @IsUUID()
  leftId!: string;

  @ApiProperty({ format: "uuid" }) @IsUUID()
  rightId!: string;
}
