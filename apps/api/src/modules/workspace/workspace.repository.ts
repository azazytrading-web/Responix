import { Injectable } from "@nestjs/common";
import { type WorkspaceStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { SafeInvitation, SafeMembership, SafeRole, SafeUser } from "./workspace.types";

const safeUserSelect = {
  id: true,
  workspaceId: true,
  firstName: true,
  lastName: true,
  fullName: true,
  email: true,
  phone: true,
  avatar: true,
  roleId: true,
  departmentId: true,
  status: true,
  language: true,
  timezone: true,
  lastLoginAt: true,
  emailVerified: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true
} as const;

const safeRoleSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  priority: true,
  systemRole: true,
  createdAt: true,
  updatedAt: true
} as const;

const safeMembershipScalarsSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  roleId: true,
  status: true,
  invitedAt: true,
  acceptedAt: true,
  suspendedAt: true,
  removedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

const safeMembershipSelect = {
  ...safeMembershipScalarsSelect,
  user: { select: safeUserSelect },
  role: { select: safeRoleSelect }
} as const;

const safeInvitationScalarsSelect = {
  id: true,
  workspaceId: true,
  membershipId: true,
  targetUserId: true,
  invitedByUserId: true,
  expiresAt: true,
  acceptedAt: true,
  rejectedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

type AuditEntry = {
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, string | null>;
  newValues?: Record<string, string | null>;
};

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(id: string, includeDeleted = false) {
    return this.prisma.workspace.findFirst({
      where: includeDeleted ? { id } : { id, deletedAt: null }
    });
  }

  findDefaultPlan() {
    return this.prisma.plan.findFirst({
      where: { name: "Starter", active: true, deletedAt: null }
    });
  }

  findRole(workspaceId: string, roleId: string): Promise<SafeRole | null> {
    return this.prisma.role.findFirst({
      where: {
        id: roleId,
        deletedAt: null,
        OR: [{ workspaceId }, { workspaceId: null }]
      },
      select: safeRoleSelect
    });
  }

  findOwnerRole(): Promise<SafeRole | null> {
    return this.prisma.role.findFirst({
      where: { workspaceId: null, name: "Owner", deletedAt: null },
      select: safeRoleSelect
    });
  }

  findUser(userId: string): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: "ACTIVE" },
      select: safeUserSelect
    });
  }

  async createWorkspace(data: {
    ownerId: string;
    ownerRoleId: string;
    plan: {
      id: string;
      maxUsers: number;
      maxAgents: number;
      maxMessages: number;
      maxStorage: bigint;
      maxTokens: number;
    };
    name: string;
    slug: string;
    companyName?: string;
    country?: string;
    language?: string;
    timezone?: string;
    currency?: string;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
          companyName: data.companyName,
          country: data.country,
          language: data.language,
          timezone: data.timezone,
          currency: data.currency,
          ownerId: data.ownerId,
          planId: data.plan.id,
          maxUsers: data.plan.maxUsers,
          maxAgents: data.plan.maxAgents,
          maxMessages: data.plan.maxMessages,
          maxStorage: data.plan.maxStorage,
          maxTokens: data.plan.maxTokens
        }
      });
      const subscription = await transaction.subscription.create({
        data: {
          workspaceId: workspace.id,
          planId: data.plan.id,
          billingCycle: "MONTHLY",
          status: "TRIAL",
          startedAt: new Date()
        }
      });
      await transaction.workspace.update({
        where: { id: workspace.id },
        data: { subscriptionId: subscription.id }
      });
      const membership = await transaction.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: data.ownerId,
          roleId: data.ownerRoleId,
          status: "ACTIVE",
          acceptedAt: new Date()
        }
      });
      await transaction.auditLog.create({
        data: {
          workspaceId: workspace.id,
          userId: data.ownerId,
          action: "workspace.created",
          entityType: "workspace",
          entityId: workspace.id,
          newValues: { name: workspace.name, slug: workspace.slug, planId: data.plan.id }
        }
      });
      return { workspace, membership, subscription };
    });
  }

  updateWorkspace(
    workspaceId: string,
    data: {
      name?: string;
      companyName?: string;
      country?: string;
      timezone?: string;
      language?: string;
      currency?: string;
    },
    audit: AuditEntry
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.update({ where: { id: workspaceId }, data });
      await transaction.auditLog.create({ data: audit });
      return workspace;
    });
  }

  updateWorkspaceState(
    workspaceId: string,
    status: WorkspaceStatus,
    deletedAt: Date | null | undefined,
    audit: AuditEntry
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.update({
        where: { id: workspaceId },
        data: { status, deletedAt }
      });
      await transaction.auditLog.create({ data: audit });
      return workspace;
    });
  }

  async members(
    workspaceId: string,
    page: number,
    limit: number
  ): Promise<{ data: SafeMembership[]; total: number }> {
    const where = { workspaceId, status: { not: "REMOVED" } as const };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workspaceMembership.findMany({
        where,
        select: safeMembershipSelect,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.workspaceMembership.count({ where })
    ]);
    return { data, total };
  }

  createMembershipWithInvitation(data: {
    workspaceId: string;
    userId: string;
    roleId: string;
    invitedByUserId: string;
    tokenHash: string;
    expiresAt: Date;
    audit: AuditEntry;
  }): Promise<SafeMembership> {
    return this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.workspaceMembership.create({
        data: {
          workspaceId: data.workspaceId,
          userId: data.userId,
          roleId: data.roleId,
          status: "INVITED"
        },
        select: safeMembershipSelect
      });
      await transaction.workspaceInvitation.create({
        data: {
          workspaceId: data.workspaceId,
          membershipId: membership.id,
          targetUserId: data.userId,
          invitedByUserId: data.invitedByUserId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt
        }
      });
      await transaction.auditLog.create({ data: { ...data.audit, entityId: membership.id } });
      return membership;
    });
  }

  membership(workspaceId: string, userId: string): Promise<SafeMembership | null> {
    return this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId, status: "ACTIVE" },
      select: {
        ...safeMembershipScalarsSelect,
        role: { select: safeRoleSelect }
      }
    });
  }

  membershipByUser(workspaceId: string, userId: string): Promise<SafeMembership | null> {
    return this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId },
      select: {
        ...safeMembershipScalarsSelect,
        role: { select: safeRoleSelect }
      }
    });
  }

  memberById(workspaceId: string, id: string): Promise<SafeMembership | null> {
    return this.prisma.workspaceMembership.findFirst({
      where: { id, workspaceId },
      select: safeMembershipSelect
    });
  }

  countOccupiedMemberships(workspaceId: string) {
    return this.prisma.workspaceMembership.count({
      where: { workspaceId, status: { in: ["INVITED", "ACTIVE", "SUSPENDED"] } }
    });
  }

  countActiveOwners(workspaceId: string) {
    return this.prisma.workspaceMembership.count({
      where: {
        workspaceId,
        status: "ACTIVE",
        role: { is: { name: "Owner", deletedAt: null } }
      }
    });
  }

  createMembership(
    workspaceId: string,
    userId: string,
    roleId: string
  ): Promise<SafeMembership> {
    return this.prisma.workspaceMembership.create({
      data: { workspaceId, userId, roleId, status: "INVITED" },
      select: safeMembershipSelect
    });
  }

  updateMembership(
    workspaceId: string,
    id: string,
    data: {
      roleId?: string;
      status?: "ACTIVE" | "SUSPENDED" | "REMOVED";
      acceptedAt?: Date | null;
      suspendedAt?: Date | null;
      removedAt?: Date | null;
    },
    options: { revokeSessions?: boolean; audit: AuditEntry }
  ): Promise<SafeMembership> {
    return this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.workspaceMembership.update({
        where: { id_workspaceId: { id, workspaceId } },
        data,
        select: safeMembershipSelect
      });
      if (options.revokeSessions) {
        await transaction.session.updateMany({
          where: { workspaceId, userId: membership.userId, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
      await transaction.auditLog.create({ data: options.audit });
      return membership;
    });
  }

  findPendingInvitation(membershipId: string): Promise<SafeInvitation | null> {
    return this.prisma.workspaceInvitation.findFirst({
      where: {
        membershipId,
        expiresAt: { gt: new Date() },
        acceptedAt: null,
        rejectedAt: null,
        revokedAt: null
      },
      select: safeInvitationScalarsSelect
    });
  }

  createInvitation(data: {
    workspaceId: string;
    membershipId: string;
    targetUserId: string;
    invitedByUserId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<SafeInvitation> {
    return this.prisma.workspaceInvitation.create({
      data,
      select: safeInvitationScalarsSelect
    });
  }

  async findInvitation(tokenHash: string): Promise<SafeInvitation | null> {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      select: {
        ...safeInvitationScalarsSelect,
        membership: {
          select: {
            ...safeMembershipScalarsSelect,
            role: { select: safeRoleSelect }
          }
        },
        workspace: { select: { status: true, deletedAt: true } }
      }
    });
    return invitation
      ? {
          id: invitation.id,
          workspaceId: invitation.workspaceId,
          membershipId: invitation.membershipId,
          targetUserId: invitation.targetUserId,
          invitedByUserId: invitation.invitedByUserId,
          expiresAt: invitation.expiresAt,
          acceptedAt: invitation.acceptedAt,
          rejectedAt: invitation.rejectedAt,
          revokedAt: invitation.revokedAt,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
          membership: invitation.membership,
          workspace: {
            status: invitation.workspace.status,
            isDeleted: invitation.workspace.deletedAt !== null
          }
        }
      : null;
  }

  acceptInvitation(
    invitationId: string,
    workspaceId: string,
    membershipId: string,
    audit: AuditEntry
  ): Promise<{ invitation: SafeInvitation; membership: SafeMembership }> {
    return this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.workspaceInvitation.update({
        where: { id: invitationId },
        data: { acceptedAt: new Date() },
        select: safeInvitationScalarsSelect
      });
      const membership = await transaction.workspaceMembership.update({
        where: { id_workspaceId: { id: membershipId, workspaceId } },
        data: { status: "ACTIVE", acceptedAt: new Date(), suspendedAt: null, removedAt: null },
        select: safeMembershipSelect
      });
      await transaction.auditLog.create({ data: audit });
      return { invitation, membership };
    });
  }

  rejectInvitation(
    invitationId: string,
    workspaceId: string,
    membershipId: string,
    audit: AuditEntry
  ): Promise<{ invitation: SafeInvitation; membership: SafeMembership }> {
    return this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.workspaceInvitation.update({
        where: { id: invitationId },
        data: { rejectedAt: new Date() },
        select: safeInvitationScalarsSelect
      });
      const membership = await transaction.workspaceMembership.update({
        where: { id_workspaceId: { id: membershipId, workspaceId } },
        data: { status: "REMOVED", removedAt: new Date() },
        select: safeMembershipSelect
      });
      await transaction.auditLog.create({ data: audit });
      return { invitation, membership };
    });
  }

  revokeInvitation(
    invitationId: string,
    workspaceId: string,
    membershipId: string,
    audit: AuditEntry
  ): Promise<{ invitation: SafeInvitation; membership: SafeMembership }> {
    return this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.workspaceInvitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
        select: safeInvitationScalarsSelect
      });
      const membership = await transaction.workspaceMembership.update({
        where: { id_workspaceId: { id: membershipId, workspaceId } },
        data: { status: "REMOVED", removedAt: new Date() },
        select: safeMembershipSelect
      });
      await transaction.auditLog.create({ data: audit });
      return { invitation, membership };
    });
  }

  revokeSessions(workspaceId: string, userId: string) {
    return this.prisma.session.updateMany({
      where: { workspaceId, userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  audit(data: {
    workspaceId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: Record<string, string | null>;
    newValues?: Record<string, string | null>;
  }) {
    return this.prisma.auditLog.create({ data });
  }

}
