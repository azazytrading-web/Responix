import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import {
  DuplicateMembershipException,
  DuplicateWorkspaceException,
  InvalidInvitationException,
  InvalidMembershipTransitionException,
  InvalidRoleException,
  LastOwnerException,
  MembershipInactiveException,
  PermissionDeniedException,
  WorkspaceInactiveException,
  WorkspaceNotFoundException,
  WorkspaceQuotaExceededException
} from "../../common/domain-errors";
import { WorkspaceRepository } from "./workspace.repository";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type WorkspaceUpdate = {
  name?: string;
  companyName?: string;
  country?: string;
  timezone?: string;
  language?: string;
  currency?: string;
};

@Injectable()
export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  async create(ownerId: string, data: WorkspaceUpdate & { name: string; slug: string }) {
    const [plan, ownerRole] = await Promise.all([
      this.repository.findDefaultPlan(),
      this.repository.findOwnerRole()
    ]);
    if (!plan || !ownerRole) {
      throw new ConflictException("Workspace provisioning is not configured");
    }

    try {
      return await this.repository.createWorkspace({
        ownerId,
        ownerRoleId: ownerRole.id,
        plan,
        ...data
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) throw new DuplicateWorkspaceException();
      throw error;
    }
  }

  async workspace(workspaceId: string, userId: string) {
    await this.requireActiveMembership(workspaceId, userId);
    const workspace = await this.repository.find(workspaceId);
    if (!workspace) throw new WorkspaceNotFoundException();
    return workspace;
  }

  async members(workspaceId: string, userId: string, pagination: { page: number; limit: number }) {
    await this.requireActiveMembership(workspaceId, userId);
    const result = await this.repository.members(workspaceId, pagination.page, pagination.limit);
    return {
      data: result.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    };
  }

  async update(workspaceId: string, userId: string, data: WorkspaceUpdate) {
    const workspace = await this.requireWorkspace(workspaceId);
    if (workspace.status !== "ACTIVE") {
      throw new WorkspaceInactiveException();
    }
    if (Object.values(data).every((value) => value === undefined)) {
      throw new BadRequestException("At least one editable field is required");
    }

    return this.repository.updateWorkspace(workspaceId, data, {
      workspaceId,
      userId,
      action: "workspace.updated",
      entityType: "workspace",
      entityId: workspaceId,
      oldValues: this.workspaceAuditValues(workspace),
      newValues: this.workspaceAuditValues({ ...workspace, ...data })
    });
  }

  async suspendWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.requireWorkspace(workspaceId);
    if (workspace.status !== "ACTIVE") {
      throw new WorkspaceInactiveException();
    }
    return this.repository.updateWorkspaceState(workspaceId, "SUSPENDED", undefined, {
      workspaceId,
      userId,
      action: "workspace.suspended",
      entityType: "workspace",
      entityId: workspaceId,
      oldValues: { status: workspace.status },
      newValues: { status: "SUSPENDED" }
    });
  }

  async archiveWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.requireWorkspace(workspaceId);
    if (workspace.status === "ARCHIVED") {
      throw new ConflictException("Workspace is already archived");
    }
    return this.repository.updateWorkspaceState(workspaceId, "ARCHIVED", undefined, {
      workspaceId,
      userId,
      action: "workspace.archived",
      entityType: "workspace",
      entityId: workspaceId,
      oldValues: { status: workspace.status },
      newValues: { status: "ARCHIVED" }
    });
  }

  async restoreWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.requireWorkspace(workspaceId, true);
    if (workspace.status === "ACTIVE" && !workspace.deletedAt) {
      throw new ConflictException("Workspace is already active");
    }
    return this.repository.updateWorkspaceState(workspaceId, "ACTIVE", null, {
      workspaceId,
      userId,
      action: "workspace.restored",
      entityType: "workspace",
      entityId: workspaceId,
      oldValues: { status: workspace.status, deletedAt: this.dateValue(workspace.deletedAt) },
      newValues: { status: "ACTIVE", deletedAt: null }
    });
  }

  async softDeleteWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.requireWorkspace(workspaceId);
    if (workspace.deletedAt) throw new ConflictException("Workspace is already deleted");
    const deletedAt = new Date();
    return this.repository.updateWorkspaceState(workspaceId, "ARCHIVED", deletedAt, {
      workspaceId,
      userId,
      action: "workspace.archived",
      entityType: "workspace",
      entityId: workspaceId,
      oldValues: { status: workspace.status, deletedAt: this.dateValue(workspace.deletedAt) },
      newValues: { status: "ARCHIVED", deletedAt: this.dateValue(deletedAt) }
    });
  }

  async invite(workspaceId: string, actorId: string, targetUserId: string, roleId: string) {
    const workspace = await this.requireWorkspace(workspaceId);
    if (workspace.status !== "ACTIVE") throw new WorkspaceInactiveException();
    const [actor, targetUser, role, existing] = await Promise.all([
      this.requireActiveMembership(workspaceId, actorId),
      this.repository.findUser(targetUserId),
      this.repository.findRole(workspaceId, roleId),
      this.repository.membershipByUser(workspaceId, targetUserId)
    ]);
    if (!targetUser) throw new NotFoundException("Target user not found");
    if (!role) throw new InvalidRoleException();
    if (existing) throw new DuplicateMembershipException();
    this.assertOwnerRoleAssignment(actor.role?.name, role.name);

    const occupied = await this.repository.countOccupiedMemberships(workspaceId);
    if (workspace.maxUsers > 0 && occupied >= workspace.maxUsers) {
      throw new WorkspaceQuotaExceededException();
    }

    const invitationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
    let membership;
    try {
      membership = await this.repository.createMembershipWithInvitation({
        workspaceId,
        userId: targetUserId,
        roleId: role.id,
        invitedByUserId: actorId,
        tokenHash: this.hashInvitationToken(invitationToken),
        expiresAt,
        audit: {
          workspaceId,
          userId: actorId,
          action: "member.invited",
          entityType: "workspace_membership",
          entityId: "pending",
          newValues: { userId: targetUserId, roleId: role.id, status: "INVITED" }
        }
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) {
        throw new DuplicateMembershipException();
      }
      throw error;
    }
    return { membership, invitationToken, expiresAt };
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.requireInvitation(token, userId);
    if (invitation.membership.status !== "INVITED") {
      throw new InvalidInvitationException();
    }
    const result = await this.repository.acceptInvitation(
      invitation.id,
      invitation.workspaceId,
      invitation.membershipId,
      {
        workspaceId: invitation.workspaceId,
        userId,
        action: "member.accepted",
        entityType: "workspace_membership",
        entityId: invitation.membershipId,
        oldValues: { status: "INVITED" },
        newValues: { status: "ACTIVE" }
      }
    );
    return result.membership;
  }

  async rejectInvitation(token: string, userId: string) {
    const invitation = await this.requireInvitation(token, userId);
    if (invitation.membership.status !== "INVITED") {
      throw new InvalidInvitationException();
    }
    const result = await this.repository.rejectInvitation(
      invitation.id,
      invitation.workspaceId,
      invitation.membershipId,
      {
        workspaceId: invitation.workspaceId,
        userId,
        action: "member.rejected",
        entityType: "workspace_membership",
        entityId: invitation.membershipId,
        oldValues: { status: "INVITED" },
        newValues: { status: "REMOVED" }
      }
    );
    return result.membership;
  }

  async revokeInvitation(workspaceId: string, actorId: string, membershipId: string) {
    await this.requireActiveMembership(workspaceId, actorId);
    const member = await this.repository.memberById(workspaceId, membershipId);
    if (!member || member.status !== "INVITED") {
      throw new ConflictException("Only pending invitations can be revoked");
    }
    const invitation = await this.repository.findPendingInvitation(membershipId);
    if (!invitation) throw new ConflictException("Invitation is no longer pending");
    const result = await this.repository.revokeInvitation(
      invitation.id,
      workspaceId,
      membershipId,
      {
        workspaceId,
        userId: actorId,
        action: "member.invitation_revoked",
        entityType: "workspace_membership",
        entityId: membershipId,
        oldValues: { status: "INVITED" },
        newValues: { status: "REMOVED" }
      }
    );
    return result.membership;
  }

  async removeMember(workspaceId: string, actorId: string, membershipId: string) {
    const member = await this.requireManageableMember(workspaceId, actorId, membershipId, "ACTIVE");
    await this.assertOwnerCanBeChanged(workspaceId, member.role.name);
    const updated = await this.repository.updateMembership(
      workspaceId,
      membershipId,
      {
        status: "REMOVED",
        removedAt: new Date()
      },
      {
        revokeSessions: true,
        audit: {
          workspaceId,
          userId: actorId,
          action: "member.removed",
          entityType: "workspace_membership",
          entityId: membershipId,
          oldValues: { status: member.status },
          newValues: { status: "REMOVED" }
        }
      }
    );
    return updated;
  }

  async suspendMember(workspaceId: string, actorId: string, membershipId: string) {
    const member = await this.requireManageableMember(workspaceId, actorId, membershipId, "ACTIVE");
    await this.assertOwnerCanBeChanged(workspaceId, member.role.name);
    const updated = await this.repository.updateMembership(
      workspaceId,
      membershipId,
      {
        status: "SUSPENDED",
        suspendedAt: new Date()
      },
      {
        revokeSessions: true,
        audit: {
          workspaceId,
          userId: actorId,
          action: "member.suspended",
          entityType: "workspace_membership",
          entityId: membershipId,
          oldValues: { status: member.status },
          newValues: { status: "SUSPENDED" }
        }
      }
    );
    return updated;
  }

  async restoreMember(workspaceId: string, actorId: string, membershipId: string) {
    const member = await this.requireManageableMember(
      workspaceId,
      actorId,
      membershipId,
      "SUSPENDED"
    );
    const updated = await this.repository.updateMembership(
      workspaceId,
      membershipId,
      {
        status: "ACTIVE",
        acceptedAt: new Date(),
        suspendedAt: null
      },
      {
        audit: {
          workspaceId,
          userId: actorId,
          action: "member.restored",
          entityType: "workspace_membership",
          entityId: membershipId,
          oldValues: { status: member.status },
          newValues: { status: "ACTIVE" }
        }
      }
    );
    return updated;
  }

  async updateMemberRole(
    workspaceId: string,
    actorId: string,
    membershipId: string,
    roleId: string
  ) {
    const [actor, member, role] = await Promise.all([
      this.requireActiveMembership(workspaceId, actorId),
      this.repository.memberById(workspaceId, membershipId),
      this.repository.findRole(workspaceId, roleId)
    ]);
    if (!member || !member.role) throw new MembershipInactiveException();
    if (!role) throw new InvalidRoleException();
    if (member.userId === actorId)
      throw new BadRequestException("Cannot change your own membership");
    if (member.status === "REMOVED" || member.status === "INVITED") {
      throw new InvalidMembershipTransitionException();
    }
    this.assertOwnerRoleAssignment(actor.role?.name, role.name);
    if (member.role.name === "Owner" && role.name !== "Owner") {
      await this.assertOwnerCanBeChanged(workspaceId, member.role.name);
    }
    const updated = await this.repository.updateMembership(
      workspaceId,
      membershipId,
      {
        roleId: role.id
      },
      {
        audit: {
          workspaceId,
          userId: actorId,
          action: "member.role_updated",
          entityType: "workspace_membership",
          entityId: membershipId,
          oldValues: { roleId: member.roleId },
          newValues: { roleId: role.id }
        }
      }
    );
    return updated;
  }

  private async requireWorkspace(workspaceId: string, includeDeleted = false) {
    const workspace = await this.repository.find(workspaceId, includeDeleted);
    if (!workspace) throw new WorkspaceNotFoundException();
    return workspace;
  }

  private async requireActiveMembership(workspaceId: string, userId: string) {
    const membership = await this.repository.membership(workspaceId, userId);
    if (!membership || !membership.role) {
      throw new MembershipInactiveException();
    }
    return membership;
  }

  private async requireManageableMember(
    workspaceId: string,
    actorId: string,
    membershipId: string,
    requiredStatus: "ACTIVE" | "SUSPENDED"
  ) {
    const [actor, member] = await Promise.all([
      this.requireActiveMembership(workspaceId, actorId),
      this.repository.memberById(workspaceId, membershipId)
    ]);
    if (!member || !member.role) throw new MembershipInactiveException();
    if (member.userId === actorId)
      throw new BadRequestException("Cannot change your own membership");
    if (member.status !== requiredStatus) {
      throw new InvalidMembershipTransitionException();
    }
    this.assertOwnerRoleAssignment(actor.role?.name, member.role.name);
    return member;
  }

  private async requireInvitation(token: string, userId: string) {
    const invitation = await this.repository.findInvitation(this.hashInvitationToken(token));
    if (
      !invitation ||
      invitation.targetUserId !== userId ||
      invitation.expiresAt <= new Date() ||
      invitation.acceptedAt ||
      invitation.rejectedAt ||
      invitation.revokedAt ||
      invitation.workspace.status !== "ACTIVE" ||
      invitation.workspace.deletedAt
    ) {
      throw new InvalidInvitationException();
    }
    return invitation;
  }

  private async assertOwnerCanBeChanged(workspaceId: string, roleName: string) {
    if (roleName === "Owner" && (await this.repository.countActiveOwners(workspaceId)) <= 1) {
      throw new LastOwnerException();
    }
  }

  private assertOwnerRoleAssignment(actorRoleName: string | undefined, targetRoleName: string) {
    if (targetRoleName === "Owner" && actorRoleName !== "Owner") {
      throw new PermissionDeniedException();
    }
  }

  private hashInvitationToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private workspaceAuditValues(workspace: {
    name: string;
    companyName: string | null;
    country: string | null;
    timezone: string;
    language: string;
    currency: string;
  }) {
    return {
      name: workspace.name,
      companyName: workspace.companyName,
      country: workspace.country,
      timezone: workspace.timezone,
      language: workspace.language,
      currency: workspace.currency
    };
  }

  private dateValue(value: Date | null) {
    return value?.toISOString() ?? null;
  }

  private isUniqueConstraint(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
