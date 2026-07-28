import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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
import { StudioProjectStatus } from "@prisma/client";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PromptVariableDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ["string", "number", "boolean", "json"] })
  @IsIn(["string", "number", "boolean", "json"])
  type!: "string" | "number" | "boolean" | "json";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  defaultValue?: unknown;
}

export class CreatePromptDto {
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

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  draft?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [PromptVariableDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  variables?: PromptVariableDto[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdatePromptDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  draft?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [PromptVariableDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  variables?: PromptVariableDto[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdatePromptMetadataDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  metadata!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [PromptVariableDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  variables?: PromptVariableDto[];
}

export class PublishPromptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeSummary?: string;
}

export class RollbackPromptDto extends PublishPromptDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  revision!: number;
}

export class ClonePromptDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;
}

export class PromptNamedDto extends ClonePromptDto {}

export class UpdatePromptNamedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(slugPattern)
  @MaxLength(120)
  slug?: string;
}

export class FavoritePromptDto {
  @ApiProperty()
  @IsBoolean()
  favorite!: boolean;
}

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
};

export class PromptListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
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

  @ApiPropertyOptional({ enum: StudioProjectStatus })
  @IsOptional()
  @IsEnum(StudioProjectStatus)
  status?: StudioProjectStatus;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], format: "uuid" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value
  )
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  tagIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({ description: "Return archived prompts only" })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ enum: ["name", "createdAt", "updatedAt", "revision"] })
  @IsOptional()
  @IsIn(["name", "createdAt", "updatedAt", "revision"])
  sortBy?: "name" | "createdAt" | "updatedAt" | "revision";

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}
