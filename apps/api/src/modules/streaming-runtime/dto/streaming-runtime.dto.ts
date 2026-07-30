import { Type } from "class-transformer";
import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { StreamSessionStatus } from "@prisma/client";

export class CreateStreamSessionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() providerId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() modelId!: string;
  @ApiProperty({ maxLength: 64 }) @IsString() @Matches(/^[a-f0-9]{64}$/) requestHash!: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() conversationId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() agentRuntimeId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRequestId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRunId?: string;
  @ApiPropertyOptional({ minimum: 1000, maximum: 300000, default: 30000 }) @IsOptional() @IsInt() @Min(1000) @Max(300000) timeoutMs?: number;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) @IsOptional() @IsObject() providerMetadata?: Record<string, unknown>;
}
export class StreamSessionListQueryDto {
  @ApiPropertyOptional({ minimum: 1 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
  @ApiPropertyOptional({ enum: StreamSessionStatus }) @IsOptional() @IsEnum(StreamSessionStatus) status?: StreamSessionStatus;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() executionRunId?: string;
}
export class CancelStreamSessionDto { @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) reason?: string; }
export class CompareStreamSnapshotsDto { @ApiProperty({ format: "uuid" }) @IsUUID() leftId!: string; @ApiProperty({ format: "uuid" }) @IsUUID() rightId!: string; }
