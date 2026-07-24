import {
  Body,
  Controller,
  Headers,
  Ip,
  Post,
  Req,
  UnauthorizedException,
  Version
} from "@nestjs/common";
import { IsEmail, IsOptional, IsString, IsUUID } from "class-validator";
import { Public } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { AuthClaims } from "./auth.types";
class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
  @IsOptional() @IsUUID() workspaceId?: string;
}
class RefreshDto {
  @IsString() refreshToken!: string;
}
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post("login")
  @Version("1")
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers("user-agent") userAgent?: string) {
    return this.auth.login(dto.email, dto.password, {
      ipAddress: ip,
      userAgent,
      ...(dto.workspaceId ? { workspaceId: dto.workspaceId } : {})
    });
  }
  @Public()
  @Post("refresh")
  @Version("1")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Post("logout") @Version("1") async logout(@Req() request: { user?: AuthClaims }) {
    if (!request.user?.sessionId || !request.user.sub || !request.user.workspaceId) {
      throw new UnauthorizedException();
    }
    await this.auth.logout(request.user.sessionId, request.user.sub, request.user.workspaceId);
    return { status: "ok" };
  }
}
