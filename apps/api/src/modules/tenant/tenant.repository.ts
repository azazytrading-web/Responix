import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class TenantRepository implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  findActiveMembership(
    workspaceId: string,
    userId: string,
    membershipId: string,
    allowInactiveWorkspace = false
  ) {
    return this.prisma.workspaceMembership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
        userId,
        status: "ACTIVE",
        workspace: allowInactiveWorkspace
          ? { is: {} }
          : { is: { status: "ACTIVE", deletedAt: null } },
        user: { is: { status: "ACTIVE", deletedAt: null } },
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
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        },
        role: {
          include: {
            rolePermissions: {
              include: { permission: { select: { code: true } } }
            }
          }
        }
      }
    });
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}

export type ActiveMembership = NonNullable<
  Awaited<ReturnType<TenantRepository["findActiveMembership"]>>
>;
