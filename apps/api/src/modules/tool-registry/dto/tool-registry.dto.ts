import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ToolAuthenticationType,
  ToolDefinitionType,
  ToolParameterLocation,
  ToolRegistryStatus,
  ToolSchemaKind,
  ToolVisibility
} from "@prisma/client";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const codePattern = /^[A-Za-z][A-Za-z0-9._:-]*$/;

export class ToolTaxonomyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateToolTaxonomyDto extends PartialType(ToolTaxonomyDto) {}

export class CreateToolGroupDto extends ToolTaxonomyDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateToolGroupDto extends PartialType(CreateToolGroupDto) {}

export class ToolParameterDto {
  @ApiProperty()
  @Matches(/^[A-Za-z_][A-Za-z0-9_.-]*$/)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ToolParameterLocation })
  @IsEnum(ToolParameterLocation)
  location!: ToolParameterLocation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  schema!: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ToolSchemaDto {
  @ApiProperty({ enum: ToolSchemaKind })
  @IsEnum(ToolSchemaKind)
  kind!: ToolSchemaKind;

  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  schema!: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ToolCapabilityDto {
  @ApiProperty()
  @Matches(codePattern)
  @MaxLength(160)
  code!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ToolPermissionDto {
  @ApiProperty()
  @Matches(codePattern)
  @MaxLength(160)
  permissionCode!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ToolDefinitionMetadataDto {
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  provider?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  authentication?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  rateLimit?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  executionPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  timeout?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  retryPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  cost?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  compatibility?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  health?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  mcp?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  custom?: Record<string, unknown>;
}

export class CreateToolDefinitionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty({ enum: ToolDefinitionType })
  @IsEnum(ToolDefinitionType)
  type!: ToolDefinitionType;

  @ApiPropertyOptional({ enum: ToolVisibility, default: ToolVisibility.WORKSPACE })
  @IsOptional()
  @IsEnum(ToolVisibility)
  visibility?: ToolVisibility;

  @ApiPropertyOptional({ enum: ToolAuthenticationType, default: ToolAuthenticationType.NONE })
  @IsOptional()
  @IsEnum(ToolAuthenticationType)
  authenticationType?: ToolAuthenticationType;

  @ApiPropertyOptional({ type: ToolDefinitionMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ToolDefinitionMetadataDto)
  metadata?: ToolDefinitionMetadataDto;

  @ApiPropertyOptional({ type: [ToolParameterDto], maxItems: 200 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ToolParameterDto)
  parameters?: ToolParameterDto[];

  @ApiPropertyOptional({ type: [ToolSchemaDto], maxItems: 2 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ToolSchemaDto)
  schemas?: ToolSchemaDto[];

  @ApiPropertyOptional({ type: [ToolCapabilityDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ToolCapabilityDto)
  capabilities?: ToolCapabilityDto[];

  @ApiPropertyOptional({ type: [ToolPermissionDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ToolPermissionDto)
  permissions?: ToolPermissionDto[];
}

export class UpdateToolDefinitionDto extends PartialType(CreateToolDefinitionDto) {}

export class PublishToolDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeSummary?: string;
}

export class RollbackToolDefinitionDto extends PublishToolDefinitionDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  revision!: number;
}

export class CloneToolDefinitionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;
}

export class ToolDefinitionListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ToolRegistryStatus })
  @IsOptional()
  @IsEnum(ToolRegistryStatus)
  status?: ToolRegistryStatus;

  @ApiPropertyOptional({ enum: ToolDefinitionType })
  @IsOptional()
  @IsEnum(ToolDefinitionType)
  type?: ToolDefinitionType;

  @ApiPropertyOptional({ enum: ToolVisibility })
  @IsOptional()
  @IsEnum(ToolVisibility)
  visibility?: ToolVisibility;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
