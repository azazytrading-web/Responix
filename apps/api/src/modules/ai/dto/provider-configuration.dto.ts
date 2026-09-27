import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsISO8601, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateNested } from "class-validator";

export class ProviderSettingsDto {
  @ApiPropertyOptional({ description: "Workspace-specific HTTPS provider endpoint" })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true })
  @MaxLength(2048)
  apiBaseUrl?: string;
}

export class ProviderCredentialInputDto {
  @ApiPropertyOptional({ default: "default" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ writeOnly: true, minLength: 8, maxLength: 4096 })
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  secret!: string;
}

export class ConfigureProviderDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ type: ProviderSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProviderSettingsDto)
  settings?: ProviderSettingsDto;

  @ApiPropertyOptional({ type: ProviderCredentialInputDto, writeOnly: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderCredentialInputDto)
  credential?: ProviderCredentialInputDto;

  @ApiPropertyOptional({ description: "Current configuration updatedAt value for optimistic concurrency" })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class ProviderConfigurationResponseDto {
  @ApiProperty() providerId!: string;
  @ApiProperty() providerName!: string;
  @ApiProperty() configured!: boolean;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() credentialConfigured!: boolean;
  @ApiProperty({ type: "object", additionalProperties: true }) settings!: Record<string, unknown>;
  @ApiPropertyOptional() updatedAt?: string;
  @ApiPropertyOptional() lastValidatedAt?: string;
  @ApiPropertyOptional() available?: boolean;
  @ApiPropertyOptional() errorCode?: string;
}

export class ProviderValidationResponseDto {
  @ApiProperty() providerId!: string;
  @ApiProperty() available!: boolean;
  @ApiProperty() checkedAt!: string;
  @ApiPropertyOptional() latencyMs?: number;
  @ApiPropertyOptional() errorCode?: string;
}
