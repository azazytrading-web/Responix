import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, Validate, ValidatorConstraint, ValidatorConstraintInterface, IsEnum, IsIn, IsInt, IsISO8601, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from "class-validator";
import { ModelCapabilityKey, ModelCapabilityState, ModelEvidenceSource, ModelPriceState, ModelPriceUnit, ModelSource, ModelStatus } from "@prisma/client";

// Legacy MCP evidence is retained by migration, but is not a public execution declaration.
export const DECLARABLE_CAPABILITIES = Object.values(ModelCapabilityKey).filter(key => key !== "MCP");
export const MODEL_CATEGORIES = ["TEXT", "CHAT", "CODE", "REASONING", "VISION", "IMAGE", "AUDIO", "VIDEO", "EMBEDDING"] as const;
const optional = () => ValidateIf((_object: unknown, value: unknown) => value !== undefined);
@ValidatorConstraint({ name: "controlFreeText", async: false })
class ControlFreeText implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && Array.from(value).every(character => {
      const point = character.codePointAt(0)!;
      return point >= 32 && (point < 127 || point > 159);
    });
  }
}
const controlFree = () => Validate(ControlFreeText);
const nonBlankPattern = /^(?=.*\S).+$/u;
const ratePattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;

export class ModelCapabilityInputDto {
  @ApiProperty({ enum: DECLARABLE_CAPABILITIES }) @IsIn(DECLARABLE_CAPABILITIES) key!: ModelCapabilityKey;
  @ApiProperty({ enum: ModelCapabilityState }) @IsEnum(ModelCapabilityState) state!: ModelCapabilityState;
}
export class ModelPriceInputDto {
  @ApiProperty({ enum: ModelPriceState }) @IsEnum(ModelPriceState) state!: ModelPriceState;
  @ApiProperty({ enum: ["WORKSPACE_DECLARED"] }) @IsIn(["WORKSPACE_DECLARED"]) source!: "WORKSPACE_DECLARED";
  @ApiPropertyOptional({ type: String, pattern: ratePattern.source }) @optional() @IsString() @Matches(ratePattern) inputRate?: string;
  @ApiPropertyOptional({ type: String, pattern: ratePattern.source }) @optional() @IsString() @Matches(ratePattern) outputRate?: string;
  @ApiPropertyOptional({ type: String, pattern: ratePattern.source }) @optional() @IsString() @Matches(ratePattern) cachedInputRate?: string;
  @ApiProperty({ enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR"] }) @IsIn(["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR"]) currency!: string;
  @ApiProperty({ enum: ModelPriceUnit }) @IsEnum(ModelPriceUnit) unit!: ModelPriceUnit;
  @ApiProperty({ format: "date-time" }) @IsISO8601({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) effectiveFrom!: string;
  @ApiPropertyOptional({ format: "date-time" }) @optional() @IsISO8601({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) effectiveTo?: string;
}
export class ModelMetadataDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @MinLength(1) @MaxLength(200) @Matches(nonBlankPattern) @controlFree() displayName!: string;
  @ApiPropertyOptional({ maxLength: 100 }) @optional() @IsString() @MinLength(1) @MaxLength(100) @Matches(nonBlankPattern) @controlFree() family?: string;
  @ApiPropertyOptional({ maxLength: 100 }) @optional() @IsString() @MinLength(1) @MaxLength(100) @Matches(nonBlankPattern) @controlFree() version?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 2147483647 }) @optional() @IsInt() @Min(1) @Max(2147483647) contextWindow?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 2147483647 }) @optional() @IsInt() @Min(1) @Max(2147483647) maxOutputTokens?: number;
  @ApiPropertyOptional({ enum: MODEL_CATEGORIES, isArray: true }) @optional() @IsArray() @ArrayMaxSize(9) @ArrayUnique() @IsIn(MODEL_CATEGORIES, { each: true }) categories?: string[];
  @ApiPropertyOptional({ type: [ModelCapabilityInputDto] }) @optional() @IsArray() @ArrayMaxSize(13) @ArrayUnique((value: ModelCapabilityInputDto) => value.key) @ValidateNested({ each: true }) @Type(() => ModelCapabilityInputDto) capabilities?: ModelCapabilityInputDto[];
  @ApiPropertyOptional({ type: ModelPriceInputDto }) @optional() @ValidateNested() @Type(() => ModelPriceInputDto) pricing?: ModelPriceInputDto;
}
export class CreateCustomModelDto extends ModelMetadataDto {
  @ApiPropertyOptional({ format: "uuid" }) @optional() @IsUUID() providerId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @optional() @IsUUID() customProviderId?: string;
  @ApiProperty({ minLength: 1, maxLength: 200 }) @IsString() @MinLength(1) @MaxLength(200) @Matches(nonBlankPattern) @controlFree() providerModelId!: string;
}
export class UpdateCustomModelDto extends PartialType(ModelMetadataDto, { skipNullProperties: false }) {
  @ApiPropertyOptional({ enum: ["ACTIVE", "DISABLED", "DEPRECATED"] }) @optional() @IsIn(["ACTIVE", "DISABLED", "DEPRECATED"]) status?: "ACTIVE" | "DISABLED" | "DEPRECATED";
}
export class ModelCatalogQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100000, default: 1 }) @optional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 }) @optional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @ApiPropertyOptional({ enum: ModelSource }) @optional() @IsEnum(ModelSource) source?: ModelSource;
  @ApiPropertyOptional({ enum: ModelStatus }) @optional() @IsEnum(ModelStatus) status?: ModelStatus;
  @ApiPropertyOptional({ format: "uuid" }) @optional() @IsUUID() providerId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @optional() @IsUUID() customProviderId?: string;
  @ApiPropertyOptional({ enum: DECLARABLE_CAPABILITIES, description: "Require trusted upstream catalog SUPPORTED evidence; not a final runtime eligibility decision" }) @optional() @IsIn(DECLARABLE_CAPABILITIES) capability?: ModelCapabilityKey;
}
export class ModelCapabilityEvidenceDto {
  @ApiProperty({ enum: ModelEvidenceSource }) source!: ModelEvidenceSource;
  @ApiProperty({ enum: ModelCapabilityState }) state!: ModelCapabilityState;
  @ApiProperty({ format: "date-time" }) observedAt!: string;
}
export class ModelCapabilityResponseDto {
  @ApiProperty({ enum: ModelCapabilityKey }) key!: ModelCapabilityKey;
  @ApiProperty({ enum: ModelCapabilityState }) catalogState!: ModelCapabilityState;
  @ApiProperty({ type: [ModelCapabilityEvidenceDto] }) evidence!: ModelCapabilityEvidenceDto[];
}
export class ModelPriceResponseDto {
  @ApiProperty({ enum: ModelPriceState }) state!: ModelPriceState;
  @ApiPropertyOptional({ type: String }) inputRate?: string;
  @ApiPropertyOptional({ type: String }) outputRate?: string;
  @ApiPropertyOptional({ type: String }) cachedInputRate?: string;
  @ApiPropertyOptional() currency?: string;
  @ApiPropertyOptional({ enum: ModelPriceUnit }) unit?: ModelPriceUnit;
  @ApiPropertyOptional({ enum: ModelEvidenceSource }) source?: ModelEvidenceSource;
  @ApiPropertyOptional({ format: "date-time" }) effectiveFrom?: string;
  @ApiPropertyOptional({ format: "date-time" }) effectiveTo?: string;
  @ApiPropertyOptional({ format: "date-time" }) observedAt?: string;
}
export class CatalogModelResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() providerModelId!: string;
  @ApiProperty() modelName!: string;
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional() family?: string;
  @ApiPropertyOptional() version?: string;
  @ApiPropertyOptional() contextWindow?: number;
  @ApiPropertyOptional() maxOutputTokens?: number;
  @ApiProperty({ type: [String] }) categories!: string[];
  @ApiProperty({ enum: ModelSource }) source!: ModelSource;
  @ApiProperty({ enum: ModelStatus }) status!: ModelStatus;
  @ApiPropertyOptional({ format: "uuid" }) ownerWorkspaceId?: string;
  @ApiPropertyOptional({ format: "uuid" }) providerId?: string;
  @ApiPropertyOptional({ format: "uuid" }) customProviderId?: string;
  @ApiProperty({ enum: ["LEGACY_BUILT_IN_PATH", "SPRINT_C_REQUIRED", "LIFECYCLE_BLOCKED"], description: "Catalog boundary only; does not certify configured credentials or production eligibility" }) productionIntegration!: string;
  @ApiProperty({ type: [String] }) warnings!: string[];
  @ApiProperty({ type: [ModelCapabilityResponseDto] }) capabilities!: ModelCapabilityResponseDto[];
  @ApiProperty({ type: ModelPriceResponseDto }) pricing!: ModelPriceResponseDto;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiPropertyOptional({ format: "date-time" }) archivedAt?: string;
}
export class CatalogPageResponseDto {
  @ApiProperty({ type: [CatalogModelResponseDto] }) items!: CatalogModelResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
