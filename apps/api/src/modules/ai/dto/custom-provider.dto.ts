import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const CUSTOM_PROVIDER_PROTOCOL = "openai-chat-completions-v1" as const;

export class CustomProviderCredentialMetadataDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "REVOKED"] }) status!: string;
  @ApiProperty() priority!: number;
  @ApiPropertyOptional({ format: "date-time" }) lastUsedAt?: string;
}

export class CustomProviderCredentialWriteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "REVOKED"] }) status!: string;
}

export class CustomProviderValidationResponseDto {
  @ApiProperty() providerId!: string;
  @ApiProperty() protocolId!: string;
  @ApiProperty() available!: boolean;
  @ApiProperty({ format: "date-time" }) checkedAt!: string;
  @ApiProperty() latencyMs!: number;
  @ApiPropertyOptional() errorCode?: string;
  @ApiPropertyOptional({ minimum: 100, maximum: 599 }) providerStatus?: number;
}

export class CustomProviderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: [CUSTOM_PROVIDER_PROTOCOL] }) protocolId!: string;
  @ApiProperty() baseUrl!: string;
  @ApiProperty() validationModelId!: string;
  @ApiProperty() supportsStreaming!: boolean;
  @ApiProperty() supportsTools!: boolean;
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "ARCHIVED"] }) status!: string;
  @ApiProperty() credentialConfigured!: boolean;
  @ApiProperty({ type: [CustomProviderCredentialMetadataDto] }) credentials!: CustomProviderCredentialMetadataDto[];
  @ApiPropertyOptional({ format: "date-time" }) archivedAt?: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class CreateCustomProviderDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  displayName!: string;

  @ApiProperty({ enum: [CUSTOM_PROVIDER_PROTOCOL] })
  @IsIn([CUSTOM_PROVIDER_PROTOCOL])
  protocolId!: typeof CUSTOM_PROVIDER_PROTOCOL;

  @ApiProperty({ maxLength: 2048 })
  @IsString() @MinLength(1) @MaxLength(2048)
  baseUrl!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  validationModelId!: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  supportsStreaming?: boolean;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  supportsTools?: boolean;
}

export class UpdateCustomProviderDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 2048 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(2048)
  baseUrl?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  validationModelId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  supportsStreaming?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  supportsTools?: boolean;
}

export class CustomProviderCredentialDto {
  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @ApiProperty({ minLength: 1, maxLength: 4096, writeOnly: true })
  @IsString() @MinLength(1) @MaxLength(4096)
  secret!: string;
}
