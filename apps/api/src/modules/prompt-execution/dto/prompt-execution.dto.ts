import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsDefined, IsEnum, IsInt, IsObject, IsOptional,
  IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompilerVariableType } from "../../prompt-compiler/dto/prompt-compiler.dto";

export class PromptExecutionVariableDto {
  @ApiProperty({ maxLength: 160 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160)
  name!: string;
  @ApiProperty({ enum: CompilerVariableType }) @IsEnum(CompilerVariableType)
  type!: CompilerVariableType;
  @ApiProperty({ nullable: true }) @IsDefined()
  value!: unknown;
}
export class PromptExecutionMessageDto {
  @ApiProperty({ enum: ["system", "user", "assistant"] })
  @IsEnum({ system: "system", user: "user", assistant: "assistant" })
  role!: "system" | "user" | "assistant";
  @ApiProperty({ maxLength: 250000 }) @IsString() @MaxLength(250000)
  content!: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
export class PromptAssistantHistoryDto {
  @ApiProperty({ maxLength: 250000 }) @IsString() @MaxLength(250000)
  content!: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
export class RenderPromptExecutionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() compiledPromptId!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  agentRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  conversationRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  providerRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionPipelineSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID()
  executionRunId?: string;
  @ApiPropertyOptional({ type: [PromptExecutionVariableDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => PromptExecutionVariableDto)
  variables?: PromptExecutionVariableDto[];
  @ApiPropertyOptional({ type: [PromptExecutionMessageDto], maxItems: 1000 })
  @IsOptional() @IsArray() @ArrayMaxSize(1000)
  @ValidateNested({ each: true }) @Type(() => PromptExecutionMessageDto)
  conversationMessages?: PromptExecutionMessageDto[];
  @ApiPropertyOptional({ type: [PromptAssistantHistoryDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => PromptAssistantHistoryDto)
  assistantHistory?: PromptAssistantHistoryDto[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  runtimeMetadata?: Record<string, unknown>;
}
export class PromptExecutionListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsUUID() compiledPromptId?: string;
  @IsOptional() @IsUUID() executionRequestId?: string;
}
