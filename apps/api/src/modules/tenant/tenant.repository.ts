import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

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

}

export type ActiveMembership = NonNullable<
  Awaited<ReturnType<TenantRepository["findActiveMembership"]>>
>;
