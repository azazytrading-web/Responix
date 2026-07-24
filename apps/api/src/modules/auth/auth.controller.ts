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
import { IsEmail, IsString } from "class-validator";
import { AuthService } from "./auth.service";
class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
class RefreshDto {
  @IsString() refreshToken!: string;
}
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("login") @Version("1") login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string
  ) {
    return this.auth.login(dto.email, dto.password, { ipAddress: ip, userAgent });
  }
  @Post("refresh") @Version("1") refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Post("logout") @Version("1") async logout(@Req() request: { user?: { sessionId?: string } }) {
    if (!request.user?.sessionId) throw new UnauthorizedException();
    await this.auth.logout(request.user.sessionId);
    return { status: "ok" };
  }
}
