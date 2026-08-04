import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}
  findUsersForLogin(email: string) {
    return this.prisma.user.findMany({
      where: { email, deletedAt: null },
      include: {
        memberships: {
          where: {
            status: "ACTIVE",
            workspace: { is: { status: "ACTIVE", deletedAt: null } },
            role: { is: { deletedAt: null } }
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                status: true
              }
            },
            workspace: true,
            role: { include: { rolePermissions: { include: { permission: true } } } }
          }
        }
      }
    });
  }
  createSession(data: {
    id: string;
    userId: string;
    workspaceId: string;
    refreshTokenHash: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return this.prisma.session.create({ data });
  }
  findSession(id: string, userId: string, workspaceId: string) {
    return this.prisma.session.findFirst({
      where: { id, userId, workspaceId, revokedAt: null, expiresAt: { gt: new Date() } }
    });
  }
  findActiveMembershipByIdForUser(id: string, userId: string) {
    return this.prisma.workspaceMembership.findFirst({
      where: {
        id,
        userId,
        status: "ACTIVE",
        workspace: { is: { status: "ACTIVE", deletedAt: null } },
        user: { is: { status: "ACTIVE", deletedAt: null } },
        role: { is: { deletedAt: null } }
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, status: true } },
        workspace: { select: { id: true, name: true, slug: true, status: true } },
        role: { include: { rolePermissions: { include: { permission: true } } } }
      }
    });
  }
  findActiveMembershipForUserWorkspace(userId: string, workspaceId: string) {
    return this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        status: "ACTIVE",
        workspace: { is: { status: "ACTIVE", deletedAt: null } },
        user: { is: { status: "ACTIVE", deletedAt: null } },
        role: { is: { deletedAt: null } }
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, status: true } },
        workspace: { select: { id: true, name: true, slug: true, status: true } },
        role: { include: { rolePermissions: { include: { permission: true } } } }
      }
    });
  }
  async rotateRefreshSession(
    previous: { id: string; userId: string; workspaceId: string },
    data: {
      id: string;
      userId: string;
      workspaceId: string;
      refreshTokenHash: string;
      expiresAt: Date;
    }
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.session.updateMany({
        where: {
          id: previous.id,
          userId: previous.userId,
          workspaceId: previous.workspaceId,
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
      if (revoked.count !== 1) return false;
      await transaction.session.create({ data });
      return true;
    });
  }
  revokeSession(id: string, userId: string, workspaceId: string) {
    return this.prisma.session.updateMany({
      where: { id, userId, workspaceId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
}
