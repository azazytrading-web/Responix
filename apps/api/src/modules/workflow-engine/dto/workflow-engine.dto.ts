import { Type } from "class-transformer";
import {
  ArrayMaxSize,
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
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  WorkflowNodeType,
  WorkflowStatus,
  WorkflowVisibility
} from "@prisma/client";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const keyPattern = /^[A-Za-z][A-Za-z0-9._:-]*$/;

export class WorkflowTaxonomyDto {
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

export class UpdateWorkflowTaxonomyDto extends PartialType(WorkflowTaxonomyDto) {}

export class WorkflowNamedSchemaDto {
  @ApiProperty()
  @Matches(keyPattern)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  schema!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

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

export class WorkflowVariableDto extends WorkflowNamedSchemaDto {
  @ApiPropertyOptional({ description: "JSON-compatible default value" })
  @IsOptional()
  defaultValue?: unknown;
}

export class WorkflowNodeDto {
  @ApiProperty()
  @Matches(keyPattern)
  @MaxLength(160)
  id!: string;

  @ApiProperty({ enum: WorkflowNodeType })
  @IsEnum(WorkflowNodeType)
  type!: WorkflowNodeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  name?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Workspace-scoped Agent, Prompt, Knowledge, Tool, or Subflow reference" })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  position?: Record<string, unknown>;

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

export class WorkflowEdgeDto {
  @ApiProperty()
  @Matches(keyPattern)
  @MaxLength(160)
  id!: string;

  @ApiProperty()
  @Matches(keyPattern)
  sourceNodeId!: string;

  @ApiProperty()
  @Matches(keyPattern)
  targetNodeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  label?: string;

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

export class WorkflowConditionDto {
  @ApiProperty()
  @Matches(keyPattern)
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(keyPattern)
  nodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(keyPattern)
  edgeId?: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  expression!: Record<string, unknown>;

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

export class WorkflowBranchDto {
  @ApiProperty()
  @Matches(keyPattern)
  nodeId!: string;

  @ApiProperty()
  @Matches(keyPattern)
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  label?: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  condition!: Record<string, unknown>;

  @ApiProperty()
  @Matches(keyPattern)
  targetNodeId!: string;

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

export class WorkflowLabelDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "#3366FF" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class WorkflowNoteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  content!: string;

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

export class WorkflowPermissionDto {
  @ApiProperty()
  @Matches(keyPattern)
  @MaxLength(160)
  permissionCode!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateWorkflowDto {
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
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: WorkflowVisibility, default: WorkflowVisibility.WORKSPACE })
  @IsOptional()
  @IsEnum(WorkflowVisibility)
  visibility?: WorkflowVisibility;

  @ApiPropertyOptional({ default: "MANUAL" })
  @IsOptional()
  @Matches(keyPattern)
  triggerType?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [WorkflowVariableDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => WorkflowVariableDto)
  variables?: WorkflowVariableDto[];

  @ApiPropertyOptional({ type: [WorkflowNamedSchemaDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => WorkflowNamedSchemaDto)
  parameters?: WorkflowNamedSchemaDto[];

  @ApiPropertyOptional({ type: [WorkflowNamedSchemaDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => WorkflowNamedSchemaDto)
  inputs?: WorkflowNamedSchemaDto[];

  @ApiPropertyOptional({ type: [WorkflowNamedSchemaDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => WorkflowNamedSchemaDto)
  outputs?: WorkflowNamedSchemaDto[];

  @ApiPropertyOptional({ type: [WorkflowNodeDto], maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => WorkflowNodeDto)
  nodes?: WorkflowNodeDto[];

  @ApiPropertyOptional({ type: [WorkflowEdgeDto], maxItems: 5000 })
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @ValidateNested({ each: true }) @Type(() => WorkflowEdgeDto)
  edges?: WorkflowEdgeDto[];

  @ApiPropertyOptional({ type: [WorkflowConditionDto], maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => WorkflowConditionDto)
  conditions?: WorkflowConditionDto[];

  @ApiPropertyOptional({ type: [WorkflowBranchDto], maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => WorkflowBranchDto)
  branches?: WorkflowBranchDto[];

  @ApiPropertyOptional({ type: [WorkflowLabelDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => WorkflowLabelDto)
  labels?: WorkflowLabelDto[];

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: [WorkflowNoteDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => WorkflowNoteDto)
  notes?: WorkflowNoteDto[];

  @ApiPropertyOptional({ type: [WorkflowPermissionDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => WorkflowPermissionDto)
  permissions?: WorkflowPermissionDto[];
}

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}

export class PublishWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeSummary?: string;
}

export class RollbackWorkflowDto extends PublishWorkflowDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class CloneWorkflowDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @Matches(slugPattern)
  @MaxLength(160)
  slug!: string;
}

export class WorkflowListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: WorkflowStatus })
  @IsOptional() @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @ApiPropertyOptional({ enum: WorkflowVisibility })
  @IsOptional() @IsEnum(WorkflowVisibility)
  visibility?: WorkflowVisibility;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional() @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional() @IsUUID()
  tagId?: string;

  @ApiPropertyOptional({ enum: ["name", "createdAt", "updatedAt", "publishedAt"] })
  @IsOptional() @IsIn(["name", "createdAt", "updatedAt", "publishedAt"])
  sortBy?: "name" | "createdAt" | "updatedAt" | "publishedAt";

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional() @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}
