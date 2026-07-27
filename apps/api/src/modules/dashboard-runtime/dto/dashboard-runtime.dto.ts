import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DashboardRuntimeBootstrapDto {
  @ApiProperty() version!: string;
  @ApiProperty() compatibilityVersion!: string;
  @ApiProperty() revision!: number;
  @ApiProperty() generatedAt!: string;
  @ApiProperty() manifestHash!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) manifest!: Record<string, unknown>;
  @ApiProperty({ type: "object", additionalProperties: true }) navigation!: Record<string, unknown>;
  @ApiPropertyOptional({ type: "object", additionalProperties: true }) branding!: Record<string, unknown> | null;
  @ApiProperty({ type: [String] }) features!: string[];
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ type: [String] }) layouts!: string[];
  @ApiProperty({ type: [Object] }) widgets!: Array<{ kind: string; version: string }>;
}
