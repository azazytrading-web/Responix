import {
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { AuthClaims } from "../auth/auth.types";
import { type ActiveMembership, TenantRepository } from "./tenant.repository";

export interface ResolvedTenantContext {
  user: ActiveMembership["user"];
  workspace: ActiveMembership["workspace"];
  membership: Omit<ActiveMembership, "user" | "workspace" | "role">;
  role: NonNullable<ActiveMembership["role"]>;
  permissions: string[];
}

export interface TenantRequest {
  user?: AuthClaims;
  tenantContext?: ResolvedTenantContext;
}

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly repository: TenantRepository
  ) {}

  async resolve(
    options: { allowInactiveWorkspace?: boolean } = {}
  ): Promise<ResolvedTenantContext> {
    if (this.request.tenantContext) return this.request.tenantContext;

    const claims = this.request.user;
    if (!claims?.sub || !claims.workspaceId || !claims.membershipId) {
      throw new UnauthorizedException("Tenant claims are required");
    }

    const membership = await this.repository.findActiveMembership(
      claims.workspaceId,
      claims.sub,
      claims.membershipId,
      options.allowInactiveWorkspace
    );
    if (!membership || !membership.role) {
      throw new ForbiddenException("An active workspace membership is required");
    }

    const context: ResolvedTenantContext = {
      user: membership.user,
      workspace: membership.workspace,
      membership: {
        id: membership.id,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        roleId: membership.roleId,
        status: membership.status,
        invitedAt: membership.invitedAt,
        acceptedAt: membership.acceptedAt,
        suspendedAt: membership.suspendedAt,
        removedAt: membership.removedAt,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt
      },
      role: membership.role,
      permissions: membership.role.rolePermissions.map(({ permission }) => permission.code)
    };
    this.request.tenantContext = context;
    return context;
  }

  get resolved(): ResolvedTenantContext {
    if (!this.request.tenantContext) {
      throw new UnauthorizedException("Tenant context has not been resolved");
    }
    return this.request.tenantContext;
  }
}
