import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class CustomProviderValidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    workspaceId: string;
    actorId: string;
    customProviderId: string;
    protocolId: string;
    available: boolean;
    latencyMs: number;
    errorCode?: string;
    providerStatus?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.customAiProviderValidationRecord.create({
        data: {
          workspaceId: input.workspaceId,
          customProviderId: input.customProviderId,
          protocolId: input.protocolId,
          available: input.available,
          latencyMs: input.latencyMs,
          ...(input.errorCode ? { errorCode: input.errorCode } : {}),
          ...(input.providerStatus ? { providerStatus: input.providerStatus } : {})
        },
        select: { checkedAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.actorId,
          action: "ai.custom-provider.validated",
          entityType: "CustomAiProvider",
          entityId: input.customProviderId,
          oldValues: Prisma.JsonNull,
          newValues: {
            protocolId: input.protocolId,
            available: input.available,
            latencyMs: input.latencyMs,
            ...(input.errorCode ? { errorCode: input.errorCode } : {}),
            ...(input.providerStatus ? { providerStatus: input.providerStatus } : {})
          } satisfies Prisma.InputJsonValue
        }
      });
      return record;
    });
  }
}
