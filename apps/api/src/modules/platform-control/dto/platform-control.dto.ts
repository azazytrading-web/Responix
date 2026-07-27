import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateRoleDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) priority?: number;
  @ApiPropertyOptional({ type: [String], format: "uuid" }) @IsOptional() @IsArray() @IsUUID("4", { each: true }) parentRoleIds?: string[];
}
export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) priority?: number;
  @ApiPropertyOptional({ type: [String], format: "uuid" }) @IsOptional() @IsArray() @IsUUID("4", { each: true }) parentRoleIds?: string[];
}
export class TemporaryRoleDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() userId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() roleId!: string;
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}
export class TemporaryPermissionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() userId!: string;
  @ApiProperty() @IsString() @MaxLength(160) permissionCode!: string;
  @ApiProperty({ enum: ["GRANT", "REVOKE"] }) @IsIn(["GRANT", "REVOKE"]) effect!: "GRANT" | "REVOKE";
  @ApiProperty() @IsDateString() startAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateFeatureDto {
  @ApiProperty({ example: "crm" }) @IsString() @MaxLength(120) key!: string;
  @ApiProperty({ enum: ["ENABLED", "DISABLED", "HIDDEN"] })
  @IsIn(["ENABLED", "DISABLED", "HIDDEN"]) state!: "ENABLED" | "DISABLED" | "HIDDEN";
  @ApiPropertyOptional() @IsOptional() @IsBoolean() experimental?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) dependencies?: string[];
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdatePermissionOverrideDto {
  @ApiProperty() @IsString() @MaxLength(160) permissionCode!: string;
  @ApiProperty({ enum: ["GRANT", "REVOKE"] }) @IsIn(["GRANT", "REVOKE"]) effect!: "GRANT" | "REVOKE";
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() userId?: string;
}

export class UpdateBrandingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) appName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) accentColor?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() darkTheme?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() lightTheme?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() fonts?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() icons?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() faviconMetadata?: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() emailBranding?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2_000) loginBackground?: string;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() dashboardStyle?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) dateFormat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) timeFormat?: string;
  @ApiPropertyOptional({ enum: ["LTR", "RTL"] }) @IsOptional() @IsIn(["LTR", "RTL"]) direction?: string;
}

export class UpdateManifestDto {
  @ApiProperty({ example: "1.0" }) @IsString() @MaxLength(32) schemaVersion!: string;
  @ApiProperty({ example: "1.0" }) @IsString() @MaxLength(32) compatibilityVersion!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) @IsObject() manifest!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() migrationMetadata?: Record<string, unknown>;
}
