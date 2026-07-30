import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { AiInvocationStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AiMessageRequestDto {
  @ApiProperty({ enum: ["system", "user", "assistant"] })
  @IsIn(["system", "user", "assistant"])
  role!: "system" | "user" | "assistant";

  @ApiProperty({ maxLength: 100_000 })
  @IsString()
  @MaxLength(100_000)
  content!: string;
}

export class AiInvocationRequestDto {
  @ApiProperty({ example: "completion", maxLength: 100 })
  @IsString()
  @MaxLength(100)
  taskType!: string;

  @ApiProperty({ type: [AiMessageRequestDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AiMessageRequestDto)
  messages!: AiMessageRequestDto[];

  @ApiProperty({ enum: ["sync"], default: "sync" })
  @IsIn(["sync"])
  mode = "sync" as const;

  @ApiPropertyOptional({ maxLength: 12 })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  language?: string;
}

export class AiInvocationHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: AiInvocationStatus })
  @IsOptional() @IsEnum(AiInvocationStatus)
  status?: AiInvocationStatus;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional() @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional() @IsUUID()
  modelId?: string;
}

export class AiRoutingRequestDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minimumContextWindow?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minimumOutputTokens?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vision?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  audio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tools?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reasoning?: boolean;

  @ApiPropertyOptional({ description: "Requires a model with streaming capability only" })
  @IsOptional()
  @IsBoolean()
  streaming?: boolean;
}
