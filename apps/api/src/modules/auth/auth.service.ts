import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { AuthRepository } from "./auth.repository";
import type { AuthClaims } from "./auth.types";
import { type ActiveMembership, TenantRepository } from "../tenant/tenant.repository";

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenantRepository: TenantRepository
  ) {}
  private get accessSecret() {
    return this.config.getOrThrow<string>("JWT_ACCESS_SECRET");
  }
  private get refreshSecret() {
    return this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
  }
  private async issue(
    membership: ActiveMembership,
    meta: { ipAddress?: string; userAgent?: string },
    previousSessionId?: string
  ) {
    const permissions = membership.role.rolePermissions.map(({ permission }) => permission.code);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionId = randomUUID();
    const claims: AuthClaims = {
      sub: membership.userId,
      workspaceId: membership.workspaceId,
      membershipId: membership.id,
      sessionId
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.accessSecret,
      expiresIn: "15m"
    });
    const refreshToken = await this.jwt.signAsync(claims, {
      secret: this.refreshSecret,
      expiresIn: "30d"
    });
    const session = {
      id: sessionId,
      userId: membership.userId,
      workspaceId: membership.workspaceId,
      refreshTokenHash: await hash(refreshToken),
      expiresAt
    };
    if (previousSessionId) {
      const rotated = await this.repository.rotateRefreshSession(previousSessionId, session);
      if (!rotated) throw new UnauthorizedException("Invalid refresh token");
    } else {
      await this.repository.createSession({ ...session, ...meta });
    }
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: { id: membership.userId, workspaceId: membership.workspaceId, permissions }
    };
  }
  async login(
    email: string,
    password: string,
    meta: { ipAddress?: string; userAgent?: string; workspaceId?: string }
  ) {
    const candidates = await this.repository.findUsersForLogin(email.toLowerCase());
    const memberships: ActiveMembership[] = [];

    for (const user of candidates) {
      if (user.status !== "ACTIVE" || !(await verify(user.passwordHash, password))) continue;
      for (const membership of user.memberships) {
        if (membership.role && (!meta.workspaceId || membership.workspaceId === meta.workspaceId)) {
          memberships.push(membership);
        }
      }
    }

    const membership = memberships[0];
    if (memberships.length !== 1 || !membership) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issue(membership, { ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  }
  async refresh(token: string) {
    let claims: AuthClaims;
    try {
      claims = await this.jwt.verifyAsync<AuthClaims>(token, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const session = await this.repository.findSession(
      claims.sessionId,
      claims.sub,
      claims.workspaceId
    );
    if (
      !session ||
      session.userId !== claims.sub ||
      session.workspaceId !== claims.workspaceId ||
      !(await verify(session.refreshTokenHash, token))
    )
      throw new UnauthorizedException("Invalid refresh token");
    const membership = await this.tenantRepository.findActiveMembership(
      claims.workspaceId,
      claims.sub,
      claims.membershipId
    );
    if (!membership) throw new UnauthorizedException("Invalid refresh token");
    return this.issue(membership, {}, session.id);
  }
  async logout(sessionId: string, userId: string, workspaceId: string) {
    await this.repository.revokeSession(sessionId, userId, workspaceId);
  }
  async hashPassword(password: string) {
    return hash(password);
  }
}
