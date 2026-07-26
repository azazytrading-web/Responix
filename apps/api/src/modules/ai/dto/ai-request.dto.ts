import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
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
