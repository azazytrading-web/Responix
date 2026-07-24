import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class AuthRepository implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();
  findUser(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        workspace: true
      }
    });
  }
  createSession(data: {
    userId: string;
    workspaceId: string;
    refreshTokenHash: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return this.prisma.session.create({ data });
  }
  findSession(id: string) {
    return this.prisma.session.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
      include: {
        user: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
        }
      }
    });
  }
  rotateSession(id: string, refreshTokenHash: string) {
    return this.prisma.session.update({
      where: { id },
      data: { refreshTokenHash, lastActivityAt: new Date() }
    });
  }
  revokeSession(id: string) {
    return this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
