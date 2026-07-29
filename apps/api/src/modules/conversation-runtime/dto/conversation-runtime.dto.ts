import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsEnum, IsInt, IsObject,
  IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ConversationRuntimeAttachmentType,
  ConversationRuntimeMessageRole,
  ConversationRuntimeParticipantType,
  ConversationRuntimeStateType,
  ConversationRuntimeStatus
} from "@prisma/client";

export enum ConversationVariableType {
  STRING = "STRING", NUMBER = "NUMBER", BOOLEAN = "BOOLEAN", JSON = "JSON",
  ARRAY = "ARRAY", OBJECT = "OBJECT", NULL = "NULL"
}

class MetadataDto {
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ConversationContextDto extends MetadataDto {
  @ApiProperty({ maxLength: 120 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120)
  contextKey!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() agentRuntimeSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() retrievalSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() compiledPromptId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() providerSnapshotId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRunId?: string;
  @ApiPropertyOptional({ maxLength: 35 }) @IsOptional() @IsString() @MaxLength(35) locale?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100) timezone?: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MaxLength(160) correlationId?: string;
}

export class ConversationVariableDto extends MetadataDto {
  @ApiProperty({ maxLength: 160 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160) name!: string;
  @ApiProperty({ enum: ConversationVariableType }) @IsEnum(ConversationVariableType) type!: ConversationVariableType;
  @ApiProperty({ nullable: true }) @IsDefined() value!: unknown;
}

export class ConversationParticipantDto extends MetadataDto {
  @ApiProperty({ maxLength: 120 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(120)
  participantKey!: string;
  @ApiProperty({ enum: ConversationRuntimeParticipantType })
  @IsEnum(ConversationRuntimeParticipantType) type!: ConversationRuntimeParticipantType;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() referenceId?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject() displayMetadata?: Record<string, unknown>;
}

export class ConversationMessageDto extends MetadataDto {
  @ApiProperty({ maxLength: 160 }) @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/) @MaxLength(160)
  messageIdentifier!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) ordinal!: number;
  @ApiProperty({ enum: ConversationRuntimeMessageRole })
  @IsEnum(ConversationRuntimeMessageRole) role!: ConversationRuntimeMessageRole;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) participantKey?: string;
  @ApiPropertyOptional({ maxLength: 128 }) @IsOptional() @IsString() @MaxLength(128) contentHash?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject() tokenMetadata?: Record<string, unknown>;
}

export class ConversationAttachmentDto extends MetadataDto {
  @ApiProperty({ maxLength: 160 }) @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/) @MaxLength(160)
  attachmentIdentifier!: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MaxLength(160) messageIdentifier?: string;
  @ApiProperty({ enum: ConversationRuntimeAttachmentType })
  @IsEnum(ConversationRuntimeAttachmentType) type!: ConversationRuntimeAttachmentType;
  @ApiProperty({ maxLength: 255 }) @Matches(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i) @MaxLength(255)
  mimeType!: string;
  @ApiPropertyOptional({ maxLength: 255 }) @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) sizeBytes?: number;
  @ApiPropertyOptional({ maxLength: 256 }) @IsOptional() @IsString() @MaxLength(256) checksum?: string;
}

export class ConversationValueDto extends MetadataDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @MaxLength(160) value!: string;
}

export class ConversationNoteDto extends MetadataDto {
  @ApiProperty({ maxLength: 160 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]*$/) @MaxLength(160) noteKey!: string;
}

export class ConversationSettingsDto {
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() memoryEnabled?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() moderationEnabled?: boolean;
  @ApiPropertyOptional({ minimum: 1, maximum: 1000000 }) @IsOptional() @IsInt() @Min(1) @Max(1000000)
  maxHistoryMessages?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class PrepareConversationRuntimeDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @MaxLength(160) name!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() sourceConversationId?: string;
  @ApiProperty({ pattern: "^\\d+\\.\\d+\\.\\d+$", example: "1.0.0" })
  @Matches(/^\d+\.\d+\.\d+$/) compatibilityVersion!: string;
  @ApiPropertyOptional({ enum: ConversationRuntimeStateType, default: "READY" })
  @IsOptional() @IsEnum(ConversationRuntimeStateType) initialState?: ConversationRuntimeStateType;
  @ApiPropertyOptional({ type: [ConversationContextDto], maxItems: 50 })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ConversationContextDto)
  contexts?: ConversationContextDto[];
  @ApiPropertyOptional({ type: [ConversationVariableDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ConversationVariableDto)
  variables?: ConversationVariableDto[];
  @ApiPropertyOptional({ type: [ConversationParticipantDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ConversationParticipantDto)
  participants?: ConversationParticipantDto[];
  @ApiPropertyOptional({ type: [ConversationMessageDto], maxItems: 10000 })
  @IsOptional() @IsArray() @ArrayMaxSize(10000) @ValidateNested({ each: true }) @Type(() => ConversationMessageDto)
  messages?: ConversationMessageDto[];
  @ApiPropertyOptional({ type: [ConversationAttachmentDto], maxItems: 10000 })
  @IsOptional() @IsArray() @ArrayMaxSize(10000) @ValidateNested({ each: true }) @Type(() => ConversationAttachmentDto)
  attachments?: ConversationAttachmentDto[];
  @ApiPropertyOptional({ type: [ConversationValueDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ConversationValueDto)
  labels?: ConversationValueDto[];
  @ApiPropertyOptional({ type: [ConversationValueDto], maxItems: 200 })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ConversationValueDto)
  tags?: ConversationValueDto[];
  @ApiPropertyOptional({ type: [ConversationNoteDto], maxItems: 500 })
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ConversationNoteDto)
  notes?: ConversationNoteDto[];
  @ApiPropertyOptional({ type: ConversationSettingsDto })
  @IsOptional() @ValidateNested() @Type(() => ConversationSettingsDto) settings?: ConversationSettingsDto;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  stateMetadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  auditMetadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class TransitionConversationStateDto {
  @ApiProperty({ enum: ConversationRuntimeStateType })
  @IsEnum(ConversationRuntimeStateType) state!: ConversationRuntimeStateType;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class CloneConversationRuntimeDto {
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MaxLength(160) name?: string;
}

export class RollbackConversationRuntimeDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() versionId!: string;
}

export class ConversationRuntimeListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsEnum(ConversationRuntimeStatus) status?: ConversationRuntimeStatus;
  @IsOptional() @IsUUID() sourceConversationId?: string;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
}

export class ConversationSnapshotListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsUUID() runtimeId?: string;
}

export class CompareConversationSnapshotsDto {
  @IsUUID() leftId!: string;
  @IsUUID() rightId!: string;
}
