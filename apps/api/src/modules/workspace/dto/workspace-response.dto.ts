import type { SafeMembership, SafeRole, SafeUser } from "../workspace.types";

type UnknownRecord = Record<string, unknown>;

export class SafeUserResponseDto {
  static from(user: SafeUser): UnknownRecord {
    return {
      id: user.id,
      workspaceId: user.workspaceId,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      roleId: user.roleId,
      departmentId: user.departmentId,
      status: user.status,
      language: user.language,
      timezone: user.timezone,
      lastLoginAt: user.lastLoginAt,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

export class SafeRoleResponseDto {
  static from(role: SafeRole): UnknownRecord {
    return {
      id: role.id,
      workspaceId: role.workspaceId,
      name: role.name,
      description: role.description,
      priority: role.priority,
      systemRole: role.systemRole,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }
}

export class SafeMembershipResponseDto {
  static from(membership: SafeMembership): UnknownRecord {
    return {
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
      updatedAt: membership.updatedAt,
      ...(membership.user ? { user: SafeUserResponseDto.from(membership.user) } : {}),
      ...(membership.role ? { role: SafeRoleResponseDto.from(membership.role) } : {})
    };
  }
}

export class WorkspaceResponseDto {
  static from(workspace: UnknownRecord): UnknownRecord {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      companyName: workspace.companyName,
      ownerId: workspace.ownerId,
      logoUrl: workspace.logoUrl,
      primaryColor: workspace.primaryColor,
      secondaryColor: workspace.secondaryColor,
      country: workspace.country,
      language: workspace.language,
      timezone: workspace.timezone,
      currency: workspace.currency,
      subscriptionId: workspace.subscriptionId,
      planId: workspace.planId,
      status: workspace.status,
      maxUsers: workspace.maxUsers,
      maxAgents: workspace.maxAgents,
      maxMessages: workspace.maxMessages,
      maxStorage: workspace.maxStorage,
      maxTokens: workspace.maxTokens,
      currentStorageUsage: workspace.currentStorageUsage,
      currentTokenUsage: workspace.currentTokenUsage,
      aiEnabled: workspace.aiEnabled,
      whatsappEnabled: workspace.whatsappEnabled,
      emailEnabled: workspace.emailEnabled,
      apiEnabled: workspace.apiEnabled,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    };
  }
}

export class SubscriptionResponseDto {
  static from(subscription: UnknownRecord): UnknownRecord {
    return {
      id: subscription.id,
      workspaceId: subscription.workspaceId,
      planId: subscription.planId,
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      autoRenew: subscription.autoRenew,
      nextPayment: subscription.nextPayment,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    };
  }
}

export class WorkspaceCreationResponseDto {
  static from(result: {
    workspace: UnknownRecord;
    membership: SafeMembership;
    subscription: UnknownRecord;
  }): UnknownRecord {
    return {
      workspace: WorkspaceResponseDto.from(result.workspace),
      membership: SafeMembershipResponseDto.from(result.membership),
      subscription: SubscriptionResponseDto.from(result.subscription)
    };
  }
}

export class MemberListResponseDto {
  static from(result: {
    data: SafeMembership[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }): UnknownRecord {
    return {
      data: result.data.map((membership) => SafeMembershipResponseDto.from(membership)),
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages
      }
    };
  }
}

export class InvitationResponseDto {
  static from(result: {
    membership: SafeMembership;
    invitationToken: string;
    expiresAt: Date;
  }): UnknownRecord {
    return {
      membership: SafeMembershipResponseDto.from(result.membership),
      invitationToken: result.invitationToken,
      expiresAt: result.expiresAt
    };
  }
}
