import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AiCostContract, AiUsageContract } from "../contracts";
import { PrismaService } from "../../../database/prisma.service";
import type { RoutingDecision } from "../router/routing.types";
import type { ModelPricing } from "./cost-normalizer.service";
import type { NormalizedInvocationError } from "./error-normalizer.service";

export interface InvocationRecord {
  id: string;
  requestId: string;
  workspaceId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "BLOCKED";
}

@Injectable()
export class InvocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findModelPricing(
    workspaceId: string,
    providerId: string,
    modelId: string
  ): Promise<ModelPricing | null> {
    const model = await this.prisma.aiModel.findFirst({
      where: {
        id: modelId,
        providerId,
        status: "ACTIVE",
        provider: {
          status: "ACTIVE",
          configurations: {
            some: { workspaceId, enabled: true, deletedAt: null }
          },
          credentials: {
            some: { workspaceId, status: "ACTIVE", deletedAt: null }
          }
        }
      },
      select: { inputCost: true, outputCost: true }
    });
    return model
      ? {
          inputCostPerMillion: model.inputCost.toFixed(6),
          outputCostPerMillion: model.outputCost.toFixed(6),
          currency: "USD"
        }
      : null;
  }

  async start(input: {
    requestId: string;
    workspaceId: string;
    providerId: string;
    modelId: string;
    taskType: string;
    messageCount: number;
  }): Promise<InvocationRecord> {
    const record = await this.prisma.aiInvocationLog.create({
      data: {
        requestId: input.requestId,
        workspaceId: input.workspaceId,
        providerId: input.providerId,
        modelId: input.modelId,
        taskType: input.taskType,
        inputMetadata: { messageCount: input.messageCount }
      },
      select: {
        id: true,
        requestId: true,
        workspaceId: true,
        status: true
      }
    });
    return { ...record };
  }

  async complete(input: {
    invocationId: string;
    workspaceId: string;
    providerId: string;
    modelId: string;
    routing: RoutingDecision;
    usage: AiUsageContract;
    cost: AiCostContract;
    finishReason?: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.aiInvocationLog.updateMany({
        where: {
          id: input.invocationId,
          workspaceId: input.workspaceId,
          status: "PENDING"
        },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          outputMetadata: {
            ...(input.finishReason ? { finishReason: input.finishReason } : {})
          }
        }
      });
      if (updated.count !== 1) throw new Error("Invocation finalization conflict");
      await transaction.aiUsageRecord.create({
        data: {
          workspaceId: input.workspaceId,
          invocationId: input.invocationId,
          providerId: input.providerId,
          modelId: input.modelId,
          ...input.usage
        }
      });
      await transaction.aiCostRecord.create({
        data: {
          workspaceId: input.workspaceId,
          invocationId: input.invocationId,
          providerId: input.providerId,
          modelId: input.modelId,
          ...input.cost
        }
      });
      await transaction.aiRoutingMetadata.create({
        data: {
          workspaceId: input.workspaceId,
          invocationId: input.invocationId,
          selectedProviderId: input.providerId,
          selectedModelId: input.modelId,
          decisionFactors: input.routing.decisionFactors as Prisma.InputJsonObject,
          candidateMetadata: input.routing.candidateMetadata as Prisma.InputJsonArray | undefined
        }
      });
    });
  }

  async fail(
    invocationId: string,
    workspaceId: string,
    error: NormalizedInvocationError
  ): Promise<void> {
    await this.prisma.aiInvocationLog.updateMany({
      where: { id: invocationId, workspaceId, status: "PENDING" },
      data: {
        status: error.status,
        errorCode: error.code,
        errorMessage: error.message,
        completedAt: new Date()
      }
    });
  }
}
