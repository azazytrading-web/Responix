import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  Version
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath
} from "@nestjs/swagger";
import { Public } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { IssuedCredentials } from "./auth.service";
import type { AuthClaims } from "./auth.types";
import {
  AuthErrorResponseDto,
  AuthSuccessResponseDto,
  LoginDto,
  LogoutResponseDto,
  SwitchWorkspaceDto,
  WorkspaceSelectionDto,
  WorkspaceSelectionRequiredResponseDto
} from "./dto/auth.dto";

export const REFRESH_COOKIE_NAME = "responix_refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface RefreshCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge?: number;
}

interface CookieResponse {
  cookie(name: string, value: string, options: RefreshCookieOptions): void;
  clearCookie(name: string, options: RefreshCookieOptions): void;
}

function refreshCookieOptions(includeLifetime = true): RefreshCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    ...(includeLifetime ? { maxAge: REFRESH_COOKIE_MAX_AGE_MS } : {})
  };
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function exposeCredentials(credentials: IssuedCredentials) {
  const { refreshToken: _refreshToken, ...response } = credentials;
  void _refreshToken;
  return response;
}

@ApiTags("Authentication")
@ApiExtraModels(AuthSuccessResponseDto, WorkspaceSelectionRequiredResponseDto)
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @Version("1")
  @ApiOperation({ summary: "Authenticate credentials or return a secure workspace-selection challenge" })
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthSuccessResponseDto) },
        { $ref: getSchemaPath(WorkspaceSelectionRequiredResponseDto) }
      ]
    }
  })
  @ApiUnauthorizedResponse({ type: AuthErrorResponseDto })
  @ApiBadRequestResponse({ type: AuthErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("user-agent") userAgent?: string
  ) {
    const result = await this.auth.login(dto.email, dto.password, { ipAddress: ip, userAgent });
    if ("requiresWorkspaceSelection" in result) return result;
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    return exposeCredentials(result);
  }

  @Public()
  @Post("select-workspace")
  @Version("1")
  @ApiOperation({ summary: "Complete login using a short-lived credential-verified workspace challenge" })
  @ApiCreatedResponse({ type: AuthSuccessResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorResponseDto })
  @ApiBadRequestResponse({ type: AuthErrorResponseDto })
  async selectWorkspace(
    @Body() dto: WorkspaceSelectionDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("user-agent") userAgent?: string
  ) {
    const result = await this.auth.selectWorkspace(dto.selectionToken, dto.workspaceId, {
      ipAddress: ip,
      userAgent
    });
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    return exposeCredentials(result);
  }

  @Public()
  @Post("refresh")
  @Version("1")
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiHeader({ name: "X-Requested-With", required: true, example: "XMLHttpRequest" })
  @ApiOperation({ summary: "Rotate the HttpOnly refresh session and return a new access token" })
  @ApiOkResponse({ type: AuthSuccessResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorResponseDto })
  @ApiForbiddenResponse({ type: AuthErrorResponseDto, description: "Missing CSRF request header" })
  async refresh(
    @Req() request: { headers: { cookie?: string } },
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-requested-with") requestedWith?: string
  ) {
    if (requestedWith !== "XMLHttpRequest") {
      throw new ForbiddenException("X-Requested-With is required");
    }
    const refreshToken = cookieValue(request.headers.cookie, REFRESH_COOKIE_NAME);
    if (!refreshToken) throw new UnauthorizedException("Refresh session is required");
    const result = await this.auth.refresh(refreshToken);
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    return exposeCredentials(result);
  }

  @Post("switch-workspace")
  @Version("1")
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Rotate the current session into another active workspace membership" })
  @ApiOkResponse({ type: AuthSuccessResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorResponseDto })
  @ApiBadRequestResponse({ type: AuthErrorResponseDto })
  async switchWorkspace(
    @Req() request: { user?: AuthClaims },
    @Body() dto: SwitchWorkspaceDto,
    @Res({ passthrough: true }) response: CookieResponse
  ) {
    if (!request.user) throw new UnauthorizedException();
    const result = await this.auth.switchWorkspace(request.user, dto.workspaceId);
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    return exposeCredentials(result);
  }

  @Post("logout")
  @Version("1")
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke the active workspace session and clear its refresh cookie" })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ type: AuthErrorResponseDto })
  async logout(
    @Req() request: { user?: AuthClaims },
    @Res({ passthrough: true }) response: CookieResponse
  ) {
    if (!request.user?.sessionId || !request.user.sub || !request.user.workspaceId) {
      throw new UnauthorizedException();
    }
    await this.auth.logout(request.user.sessionId, request.user.sub, request.user.workspaceId);
    response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(false));
    return { status: "ok" as const };
  }
}
