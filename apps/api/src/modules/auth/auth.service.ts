import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { AuthRepository } from "./auth.repository";

type Claims = { sub: string; workspaceId: string; sessionId: string; permissions: string[] };
@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}
  private get accessSecret() {
    return this.config.getOrThrow<string>("JWT_ACCESS_SECRET");
  }
  private get refreshSecret() {
    return this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
  }
  private async issue(
    user: {
      id: string;
      workspaceId: string;
      role: { rolePermissions: { permission: { code: string } }[] } | null;
    },
    meta: { ipAddress?: string; userAgent?: string }
  ) {
    const permissions = user.role?.rolePermissions.map(({ permission }) => permission.code) ?? [];
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.repository.createSession({
      userId: user.id,
      workspaceId: user.workspaceId,
      refreshTokenHash: "pending",
      expiresAt,
      ...meta
    });
    const claims: Claims = {
      sub: user.id,
      workspaceId: user.workspaceId,
      sessionId: session.id,
      permissions
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.accessSecret,
      expiresIn: "15m"
    });
    const refreshToken = await this.jwt.signAsync(claims, {
      secret: this.refreshSecret,
      expiresIn: "30d"
    });
    await this.repository.rotateSession(session.id, await hash(refreshToken));
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: { id: user.id, workspaceId: user.workspaceId, permissions }
    };
  }
  async login(email: string, password: string, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.repository.findUser(email.toLowerCase());
    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.workspace.status !== "ACTIVE" ||
      !(await verify(user.passwordHash, password))
    )
      throw new UnauthorizedException("Invalid credentials");
    return this.issue(user, meta);
  }
  async refresh(token: string) {
    let claims: Claims;
    try {
      claims = await this.jwt.verifyAsync<Claims>(token, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const session = await this.repository.findSession(claims.sessionId);
    if (
      !session ||
      session.userId !== claims.sub ||
      !(await verify(session.refreshTokenHash, token))
    )
      throw new UnauthorizedException("Invalid refresh token");
    const user = session.user;
    await this.repository.revokeSession(session.id);
    return this.issue(user, {});
  }
  async logout(sessionId: string) {
    await this.repository.revokeSession(sessionId);
  }
  async hashPassword(password: string) {
    return hash(password);
  }
}
