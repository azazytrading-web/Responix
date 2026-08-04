import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsUUID } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: "password" })
  @IsString()
  password!: string;
}

export class WorkspaceSelectionDto {
  @ApiProperty({ description: "Short-lived token returned after credential verification" })
  @IsString()
  selectionToken!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  workspaceId!: string;
}

export class SwitchWorkspaceDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  workspaceId!: string;
}

export class AuthUserDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: "uuid" }) workspaceId!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
}

export class AuthWorkspaceDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ["ACTIVE"] }) status!: string;
}

export class AuthSuccessResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: 900, description: "Access-token lifetime in seconds" })
  expiresIn!: number;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
  @ApiProperty({ type: AuthWorkspaceDto }) workspace!: AuthWorkspaceDto;
}

export class WorkspaceSelectionRequiredResponseDto {
  @ApiProperty({ enum: [true] }) requiresWorkspaceSelection!: true;
  @ApiProperty() selectionToken!: string;
  @ApiProperty({ example: 300 }) expiresIn!: number;
  @ApiProperty({ type: [AuthWorkspaceDto] }) workspaces!: AuthWorkspaceDto[];
}

export class LogoutResponseDto {
  @ApiProperty({ enum: ["ok"] }) status!: "ok";
}

export class AuthErrorResponseDto {
  @ApiProperty({ example: 401 }) statusCode!: number;
  @ApiProperty({
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    example: "Invalid credentials"
  })
  message!: string | string[];
  @ApiProperty({ required: false }) requestId?: string;
}
