import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ChannelConnectionState, ChannelMessageState, ChannelMessageType, ChannelState } from "@prisma/client";
import { ArrayMaxSize, IsArray, IsBase64, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class CreateChannelDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @MaxLength(120) name!: string;
  @ApiPropertyOptional({ default: "whatsapp", maxLength: 80 }) @IsOptional() @Matches(/^[a-z][a-z0-9_-]{1,79}$/) providerKey?: string;
  @ApiPropertyOptional({ default: "1.0" }) @IsOptional() @Matches(/^\d+\.\d+$/) compatibilityVersion?: string;
}

export class ChannelCredentialInputDto {
  @ApiProperty({ maxLength: 80 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/) name!: string;
  @ApiProperty({ writeOnly: true, maxLength: 8192 }) @IsString() @MaxLength(8192) secret!: string;
}

export class CreateProviderConnectionDto {
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject() configuration!: Record<string, unknown>;
  @ApiProperty({ type: [ChannelCredentialInputDto], maxItems: 20 }) @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => ChannelCredentialInputDto) credentials!: ChannelCredentialInputDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) displayAddress?: string;
}

export class RotateChannelCredentialDto {
  @ApiProperty({ maxLength: 80 }) @Matches(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/) name!: string;
  @ApiProperty({ writeOnly: true, maxLength: 8192 }) @IsString() @MaxLength(8192) secret!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedVersion!: number;
  @ApiPropertyOptional({ format: "date-time" }) @IsOptional() @IsString() expiresAt?: string;
}

export class CreateChannelBatchDto {
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200) batchKey!: string;
  @ApiProperty({ type: [String], format: "uuid", maxItems: 100 }) @IsArray() @ArrayMaxSize(100) @IsUUID("4", { each: true }) messageIds!: string[];
  @ApiProperty({ format: "date-time" }) @IsString() scheduledAt!: string;
}

export class CreateChannelConnectionDto {
  @ApiProperty({ maxLength: 128 }) @Matches(/^\d+$/) businessAccountId!: string;
  @ApiProperty({ maxLength: 128 }) @Matches(/^\d+$/) phoneNumberId!: string;
  @ApiPropertyOptional({ example: "+15551234567" }) @IsOptional() @IsString() @MaxLength(20) displayPhoneNumber?: string;
  @ApiProperty({ example: "v23.0" }) @IsString() @MaxLength(16) apiVersion!: string;
  @ApiProperty({ writeOnly: true }) @IsString() @MaxLength(4096) accessToken!: string;
  @ApiProperty({ writeOnly: true }) @IsString() @MaxLength(512) verifyToken!: string;
  @ApiProperty({ writeOnly: true }) @IsString() @MaxLength(512) appSecret!: string;
}

export class UpdateChannelConfigurationDto {
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject() configuration!: Record<string, unknown>;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedStateVersion!: number;
}

export class SendChannelMessageDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() connectionId!: string;
  @ApiProperty({ maxLength: 128 }) @IsString() @MaxLength(128) recipient!: string;
  @ApiProperty({ enum: ChannelMessageType }) @IsEnum(ChannelMessageType) type!: ChannelMessageType;
  @ApiPropertyOptional({ maxLength: 100000 }) @IsOptional() @IsString() @MaxLength(100000) text?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() content?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [String], format: "uuid", maxItems: 20 }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID("4", { each: true }) attachmentIds?: string[];
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() replyToMessageId?: string;
  @ApiProperty({ maxLength: 200 }) @Matches(/^[A-Za-z0-9._:-]+$/) @MaxLength(200) idempotencyKey!: string;
}

export class UploadChannelAttachmentDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() channelId!: string;
  @ApiPropertyOptional({ maxLength: 255 }) @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @ApiProperty({ maxLength: 255 }) @IsString() @MaxLength(255) mimeType!: string;
  @ApiProperty({ minimum: 1, maximum: 104857600 }) @IsInt() @Min(1) @Max(104857600) sizeBytes!: number;
  @ApiProperty() @IsBase64() dataBase64!: string;
}

export class ChannelListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsEnum(ChannelState) state?: ChannelState;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}

export class ChannelMessageListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsEnum(ChannelMessageState) state?: ChannelMessageState;
  @IsOptional() @IsEnum(ChannelMessageType) type?: ChannelMessageType;
  @IsOptional() @IsUUID() conversationId?: string;
}

export class WebhookVerificationDto {
  @ApiProperty({ name: "hub.mode" }) @IsString() @MaxLength(30) "hub.mode"!: string;
  @ApiProperty({ name: "hub.verify_token" }) @IsString() @MaxLength(512) "hub.verify_token"!: string;
  @ApiProperty({ name: "hub.challenge" }) @IsString() @MaxLength(512) "hub.challenge"!: string;
}

export class TransitionChannelMessageDto {
  @ApiProperty({ enum: ChannelMessageState }) @IsEnum(ChannelMessageState) state!: ChannelMessageState;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedStateVersion!: number;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class TransitionChannelConnectionDto {
  @ApiProperty({ enum: ChannelConnectionState }) @IsEnum(ChannelConnectionState)
  state!: ChannelConnectionState;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedStateVersion!: number;
}
