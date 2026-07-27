import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";
export class CreateStudioProjectDto { @ApiProperty() @IsString() @MaxLength(160) name!: string; @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string; @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string; @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() draft?: Record<string, unknown>; }
export class UpdateStudioProjectDraftDto { @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) name?: string; @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string; @ApiProperty({ type: "object", additionalProperties: true }) @IsObject() draft!: Record<string, unknown>; }
export class PublishStudioProjectDto { @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) changeSummary?: string; }
export class RollbackStudioProjectDto extends PublishStudioProjectDto { @ApiProperty() @IsInt() @Min(1) revision!: number; }
