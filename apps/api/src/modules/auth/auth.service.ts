import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { AuthRepository } from "./auth.repository";
import type { AuthClaims, WorkspaceSelectionClaims } from "./auth.types";
import { type ActiveMembership, TenantRepository } from "../tenant/tenant.repository";

export interface IssuedCredentials {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; fullName: string; workspaceId: string; permissions: string[] };
  workspace: { id: string; name: string; slug: string; status: string };
}

export interface WorkspaceSelectionChallenge {
  requiresWorkspaceSelection: true;
  selectionToken: string;
  expiresIn: number;
  workspaces: Array<{ id: string; name: string; slug: string; status: string }>;
}

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
    previousSession?: { id: string; userId: string; workspaceId: string }
  ): Promise<IssuedCredentials> {
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
    if (previousSession) {
      const rotated = await this.repository.rotateRefreshSession(previousSession, session);
      if (!rotated) throw new UnauthorizedException("Invalid refresh token");
    } else {
      await this.repository.createSession({ ...session, ...meta });
    }
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: membership.userId,
        email: membership.user.email,
        fullName: membership.user.fullName,
        workspaceId: membership.workspaceId,
        permissions
      },
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        status: membership.workspace.status
      }
    };
  }
  async login(
    email: string,
    password: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<IssuedCredentials | WorkspaceSelectionChallenge> {
    const candidates = await this.repository.findUsersForLogin(email.toLowerCase());
    const memberships: ActiveMembership[] = [];

    for (const user of candidates) {
      if (user.status !== "ACTIVE" || !(await verify(user.passwordHash, password))) continue;
      for (const membership of user.memberships) {
        if (membership.role) {
          memberships.push(membership);
        }
      }
    }

    if (memberships.length === 0) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const membership = memberships[0]!;
    if (memberships.length === 1) {
      return this.issue(membership, meta);
    }

    const selectionToken = await this.jwt.signAsync(
      {
        sub: membership.userId,
        purpose: "workspace-selection",
        membershipIds: memberships.map((candidate) => candidate.id)
      } satisfies WorkspaceSelectionClaims,
      { secret: this.refreshSecret, expiresIn: "5m" }
    );
    return {
      requiresWorkspaceSelection: true as const,
      selectionToken,
      expiresIn: 300,
      workspaces: memberships.map((candidate) => ({
        id: candidate.workspace.id,
        name: candidate.workspace.name,
        slug: candidate.workspace.slug,
        status: candidate.workspace.status
      }))
    };
  }
  async selectWorkspace(
    selectionToken: string,
    workspaceId: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<IssuedCredentials> {
    let claims: WorkspaceSelectionClaims;
    try {
      claims = await this.jwt.verifyAsync<WorkspaceSelectionClaims>(selectionToken, {
        secret: this.refreshSecret
      });
    } catch {
      throw new UnauthorizedException("Invalid workspace selection");
    }
    if (claims.purpose !== "workspace-selection" || !Array.isArray(claims.membershipIds)) {
      throw new UnauthorizedException("Invalid workspace selection");
    }
    const candidates = await Promise.all(
      claims.membershipIds.map((membershipId) =>
        this.repository.findActiveMembershipByIdForUser(membershipId, claims.sub)
      )
    );
    const membership = candidates.find((candidate) => candidate?.workspaceId === workspaceId);
    if (!membership) throw new UnauthorizedException("Invalid workspace selection");
    return this.issue(membership, meta);
  }
  async refresh(token: string): Promise<IssuedCredentials> {
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
    return this.issue(membership, {}, {
      id: session.id,
      userId: session.userId,
      workspaceId: session.workspaceId
    });
  }
  async switchWorkspace(claims: AuthClaims, workspaceId: string): Promise<IssuedCredentials> {
    const currentSession = await this.repository.findSession(
      claims.sessionId,
      claims.sub,
      claims.workspaceId
    );
    if (!currentSession) throw new UnauthorizedException("Invalid session");
    const membership = await this.repository.findActiveMembershipForUserWorkspace(
      claims.sub,
      workspaceId
    );
    if (!membership) throw new UnauthorizedException("Invalid workspace selection");
    return this.issue(membership, {}, {
      id: currentSession.id,
      userId: currentSession.userId,
      workspaceId: currentSession.workspaceId
    });
  }
  async logout(sessionId: string, userId: string, workspaceId: string) {
    await this.repository.revokeSession(sessionId, userId, workspaceId);
  }
  async hashPassword(password: string) {
    return hash(password);
  }
}
