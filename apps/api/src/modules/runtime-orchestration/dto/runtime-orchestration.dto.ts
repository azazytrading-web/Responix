import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
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
  ExecutionBindingTarget,
  ExecutionProfileVisibility,
  RuntimeOrchestrationStatus
} from "@prisma/client";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const keyPattern = /^[A-Za-z][A-Za-z0-9._:-]*$/;

export class OrchestrationTaxonomyDto {
  @ApiProperty() @IsString() @MaxLength(160)
  name!: string;
  @ApiProperty() @Matches(slugPattern) @MaxLength(160)
  slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  description?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
export class UpdateOrchestrationTaxonomyDto extends PartialType(OrchestrationTaxonomyDto) {}

export class ExecutionPriorityLevelDto extends OrchestrationTaxonomyDto {
  @ApiProperty({ minimum: 0, maximum: 1000 })
  @IsInt() @Min(0) @Max(1000)
  value!: number;
}
export class UpdateExecutionPriorityLevelDto extends PartialType(ExecutionPriorityLevelDto) {}

export class ExecutionNamedSchemaDto {
  @ApiProperty() @Matches(keyPattern) @MaxLength(120)
  name!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  schema!: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  required?: boolean;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class ExecutionVariableDto extends ExecutionNamedSchemaDto {
  @ApiPropertyOptional({ description: "JSON-compatible default value" }) @IsOptional()
  defaultValue?: unknown;
}

export class ExecutionContextDto {
  @ApiProperty() @Matches(keyPattern) @MaxLength(120)
  name!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  schema!: Record<string, unknown>;
  @ApiPropertyOptional({ description: "JSON-compatible static context value" }) @IsOptional()
  value?: unknown;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class ExecutionBindingDto {
  @ApiProperty() @Matches(keyPattern) @MaxLength(160)
  key!: string;
  @ApiProperty({ enum: ExecutionBindingTarget }) @IsEnum(ExecutionBindingTarget)
  targetType!: ExecutionBindingTarget;
  @ApiProperty({ format: "uuid" }) @IsUUID()
  referenceId!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  required?: boolean;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  config?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class ExecutionDependencyDto {
  @ApiProperty() @Matches(keyPattern)
  bindingKey!: string;
  @ApiProperty() @Matches(keyPattern)
  dependsOnBindingKey!: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionPolicyDto {
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject()
  config!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionLimitDto {
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1)
  maxSteps?: number;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1)
  maxTokens?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  maxCostMinor?: number;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1)
  maxPayloadBytes?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionTimeoutDto {
  @ApiProperty({ minimum: 100, maximum: 86400000 }) @IsInt() @Min(100) @Max(86400000)
  totalMs!: number;
  @ApiPropertyOptional({ minimum: 100, maximum: 86400000 }) @IsOptional() @IsInt() @Min(100) @Max(86400000)
  stepMs?: number;
  @ApiPropertyOptional({ minimum: 100, maximum: 86400000 }) @IsOptional() @IsInt() @Min(100) @Max(86400000)
  idleMs?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionRetryPolicyDto {
  @ApiProperty({ minimum: 1, maximum: 20 }) @IsInt() @Min(1) @Max(20)
  maxAttempts!: number;
  @ApiProperty({ minimum: 0, maximum: 3600000 }) @IsInt() @Min(0) @Max(3600000)
  initialDelayMs!: number;
  @ApiProperty({ minimum: 0, maximum: 3600000 }) @IsInt() @Min(0) @Max(3600000)
  maxDelayMs!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) @IsNumber() @Min(1) @Max(100)
  multiplier!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  jitter?: boolean;
  @ApiPropertyOptional({ type: [String], maxItems: 50 }) @IsOptional() @IsArray() @ArrayMaxSize(50) @Matches(keyPattern, { each: true })
  retryOn?: string[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionStrategyPolicyDto {
  @ApiProperty() @Matches(keyPattern) @MaxLength(120)
  strategy!: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  config?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionFallbackPolicyDto extends ExecutionStrategyPolicyDto {
  @ApiPropertyOptional({ enum: ExecutionBindingTarget }) @IsOptional() @IsEnum(ExecutionBindingTarget)
  targetType?: ExecutionBindingTarget;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  targetReferenceId?: string;
}

export class ExecutionConcurrencyPolicyDto {
  @ApiProperty({ minimum: 1, maximum: 10000 }) @IsInt() @Min(1) @Max(10000)
  maxParallel!: number;
  @ApiProperty({ minimum: 0, maximum: 1000000 }) @IsInt() @Min(0) @Max(1000000)
  maxQueued!: number;
  @ApiProperty() @Matches(keyPattern) @MaxLength(120)
  strategy!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  keyTemplate?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionLabelDto {
  @ApiProperty() @IsString() @MaxLength(120)
  name!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecutionNoteDto {
  @ApiProperty() @IsString() @MaxLength(10000)
  content!: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class CreateExecutionProfileDto {
  @ApiProperty() @IsString() @MaxLength(160)
  name!: string;
  @ApiProperty() @Matches(slugPattern) @MaxLength(160)
  slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional({ enum: ExecutionProfileVisibility }) @IsOptional() @IsEnum(ExecutionProfileVisibility)
  visibility?: ExecutionProfileVisibility;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  queueDefinitionId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  priorityLevelId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: ExecutionPolicyDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionPolicyDto)
  policy?: ExecutionPolicyDto;
  @ApiPropertyOptional({ type: ExecutionLimitDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionLimitDto)
  limits?: ExecutionLimitDto;
  @ApiPropertyOptional({ type: ExecutionTimeoutDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionTimeoutDto)
  timeouts?: ExecutionTimeoutDto;
  @ApiPropertyOptional({ type: ExecutionRetryPolicyDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionRetryPolicyDto)
  retryPolicy?: ExecutionRetryPolicyDto;
  @ApiPropertyOptional({ type: ExecutionStrategyPolicyDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionStrategyPolicyDto)
  failurePolicy?: ExecutionStrategyPolicyDto;
  @ApiPropertyOptional({ type: ExecutionFallbackPolicyDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionFallbackPolicyDto)
  fallbackPolicy?: ExecutionFallbackPolicyDto;
  @ApiPropertyOptional({ type: ExecutionConcurrencyPolicyDto }) @IsOptional() @ValidateNested() @Type(() => ExecutionConcurrencyPolicyDto)
  concurrencyPolicy?: ExecutionConcurrencyPolicyDto;

  @ApiPropertyOptional({ type: [ExecutionContextDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ExecutionContextDto)
  contexts?: ExecutionContextDto[];
  @ApiPropertyOptional({ type: [ExecutionVariableDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ExecutionVariableDto)
  variables?: ExecutionVariableDto[];
  @ApiPropertyOptional({ type: [ExecutionNamedSchemaDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ExecutionNamedSchemaDto)
  inputs?: ExecutionNamedSchemaDto[];
  @ApiPropertyOptional({ type: [ExecutionNamedSchemaDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ExecutionNamedSchemaDto)
  outputs?: ExecutionNamedSchemaDto[];
  @ApiPropertyOptional({ type: [ExecutionBindingDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ExecutionBindingDto)
  bindings?: ExecutionBindingDto[];
  @ApiPropertyOptional({ type: [ExecutionDependencyDto], maxItems: 2000 })
  @IsOptional() @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => ExecutionDependencyDto)
  dependencies?: ExecutionDependencyDto[];
  @ApiPropertyOptional({ type: [ExecutionLabelDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ExecutionLabelDto)
  labels?: ExecutionLabelDto[];
  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID(undefined, { each: true })
  tagIds?: string[];
  @ApiPropertyOptional({ type: [ExecutionNoteDto], maxItems: 100 })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ExecutionNoteDto)
  notes?: ExecutionNoteDto[];
}

export class UpdateExecutionProfileDto extends PartialType(CreateExecutionProfileDto) {}

export class PublishExecutionProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  changeSummary?: string;
}
export class RollbackExecutionProfileDto extends PublishExecutionProfileDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  revision!: number;
}
export class CloneExecutionProfileDto {
  @ApiProperty() @IsString() @MaxLength(160)
  name!: string;
  @ApiProperty() @Matches(slugPattern) @MaxLength(160)
  slug!: string;
}

export class ExecutionProfileListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  search?: string;
  @ApiPropertyOptional({ enum: RuntimeOrchestrationStatus }) @IsOptional() @IsEnum(RuntimeOrchestrationStatus)
  status?: RuntimeOrchestrationStatus;
  @ApiPropertyOptional({ enum: ExecutionProfileVisibility }) @IsOptional() @IsEnum(ExecutionProfileVisibility)
  visibility?: ExecutionProfileVisibility;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  queueDefinitionId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  priorityLevelId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  tagId?: string;
  @ApiPropertyOptional({ enum: ["name", "createdAt", "updatedAt", "publishedAt"] })
  @IsOptional() @IsIn(["name", "createdAt", "updatedAt", "publishedAt"])
  sortBy?: "name" | "createdAt" | "updatedAt" | "publishedAt";
  @ApiPropertyOptional({ enum: ["asc", "desc"] }) @IsOptional() @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}
