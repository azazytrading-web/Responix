import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class AuthRepository implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();
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
  async rotateRefreshSession(
    previousSessionId: string,
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
          id: previousSessionId,
          userId: data.userId,
          workspaceId: data.workspaceId,
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
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
