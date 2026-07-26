import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AiCostContract, AiUsageContract } from "../contracts";
import { PrismaService } from "../../../database/prisma.service";
import type { RoutingDecision } from "../router/routing.types";
import type { ModelPricing } from "./cost-normalizer.service";
import type { NormalizedInvocationError } from "./error-normalizer.service";
import type {
  RuntimeFailureAccounting,
  RuntimeSuccessAccounting
} from "../runtime/runtime.types";

export interface InvocationRecord {
  id: string;
  requestId: string;
  workspaceId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "BLOCKED";
}

export interface InvocationCompletionInput {
  invocationId: string;
  workspaceId: string;
  providerId: string;
  modelId: string;
  routing: RoutingDecision;
  usage: AiUsageContract;
  cost: AiCostContract;
  runtime: RuntimeSuccessAccounting;
  finishReason?: string;
  recoveryId?: string;
}

export interface InvocationFailureInput {
  invocationId: string;
  workspaceId: string;
  error: NormalizedInvocationError;
  runtime: RuntimeFailureAccounting;
  recoveryId?: string;
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

  async complete(input: InvocationCompletionInput): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.workspaceId}, 0))`;
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
      if (updated.count !== 1) {
        const [invocation, accounting] = await Promise.all([
          transaction.aiInvocationLog.findFirst({
            where: {
              id: input.invocationId,
              workspaceId: input.workspaceId,
              status: "SUCCEEDED"
            },
            select: { id: true }
          }),
          transaction.aiRuntimeAccounting.findUnique({
            where: { requestId: input.runtime.reservation.requestId },
            select: { id: true }
          })
        ]);
        if (invocation && accounting) {
          await this.completeRecoveryRecord(transaction, input.recoveryId);
          return;
        }
        throw new Error("Invocation finalization conflict");
      }
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
      const released = await transaction.aiRuntimeReservation.updateMany({
        where: {
          id: input.runtime.reservation.id,
          workspaceId: input.workspaceId,
          ownerToken: input.runtime.reservation.ownerToken,
          status: "ACTIVE"
        },
        data: { status: "RELEASED", releasedAt: new Date() }
      });
      if (released.count !== 1) {
        throw new Error("Invocation reservation ownership conflict");
      }
      await transaction.aiRuntimeAccounting.create({
        data: {
          workspaceId: input.workspaceId,
          invocationId: input.invocationId,
          providerId: input.providerId,
          modelId: input.modelId,
          requestId: input.runtime.reservation.requestId,
          estimatedInputTokens: input.runtime.reservation.estimate.inputTokens,
          estimatedOutputTokens: input.runtime.reservation.estimate.outputTokens,
          estimatedTotalTokens: input.runtime.reservation.estimate.totalTokens,
          estimatedCost: input.runtime.reservation.estimate.estimatedCost,
          actualPromptTokens: input.usage.inputTokens,
          actualCompletionTokens: input.usage.outputTokens,
          actualCachedTokens: input.usage.cachedTokens,
          actualTotalTokens: input.usage.totalTokens,
          actualCost: input.cost.totalCost,
          retryCount: input.runtime.retryCount,
          queueWaitMs: input.runtime.reservation.queueWaitMs,
          reservationMs:
            Date.now() - input.runtime.reservation.reservedAt,
          executionDurationMs: input.runtime.executionDurationMs,
          providerDurationMs: input.runtime.providerDurationMs,
          status: "SUCCEEDED"
        }
      });
      await this.completeRecoveryRecord(transaction, input.recoveryId);
    }, { isolationLevel: "Serializable" });
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

  async failWithRuntime(input: InvocationFailureInput): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.workspaceId}, 0))`;
      const updated = await transaction.aiInvocationLog.updateMany({
        where: {
          id: input.invocationId,
          workspaceId: input.workspaceId,
          status: "PENDING"
        },
        data: {
          status: input.error.status,
          errorCode: input.error.code,
          errorMessage: input.error.message,
          completedAt: new Date()
        }
      });
      if (updated.count !== 1) {
        const accounting = await transaction.aiRuntimeAccounting.findUnique({
          where: { requestId: input.runtime.reservation.requestId },
          select: { id: true }
        });
        if (accounting) {
          await this.completeRecoveryRecord(transaction, input.recoveryId);
          return;
        }
        throw new Error("Invocation failure finalization conflict");
      }
      const released = await transaction.aiRuntimeReservation.updateMany({
        where: {
          id: input.runtime.reservation.id,
          workspaceId: input.workspaceId,
          ownerToken: input.runtime.reservation.ownerToken,
          status: "ACTIVE"
        },
        data: { status: "RELEASED", releasedAt: new Date() }
      });
      if (released.count !== 1) {
        throw new Error("Invocation reservation ownership conflict");
      }
      await transaction.aiRuntimeAccounting.create({
        data: {
          workspaceId: input.workspaceId,
          invocationId: input.invocationId,
          providerId: input.runtime.providerId,
          modelId: input.runtime.modelId,
          requestId: input.runtime.reservation.requestId,
          estimatedInputTokens: input.runtime.reservation.estimate.inputTokens,
          estimatedOutputTokens: input.runtime.reservation.estimate.outputTokens,
          estimatedTotalTokens: input.runtime.reservation.estimate.totalTokens,
          estimatedCost: input.runtime.reservation.estimate.estimatedCost,
          actualPromptTokens: 0,
          actualCompletionTokens: 0,
          actualCachedTokens: 0,
          actualTotalTokens: 0,
          actualCost: "0.000000",
          retryCount: input.runtime.retryCount,
          queueWaitMs: input.runtime.reservation.queueWaitMs,
          reservationMs: Date.now() - input.runtime.reservation.reservedAt,
          executionDurationMs: input.runtime.executionDurationMs,
          providerDurationMs: input.runtime.providerDurationMs,
          status: input.runtime.cancelled
            ? "CANCELLED"
            : input.runtime.timeoutReason
              ? "TIMED_OUT"
              : "FAILED",
          failureReason: input.runtime.failureReason,
          timeoutReason: input.runtime.timeoutReason,
          cancelled: input.runtime.cancelled
        }
      });
      await this.completeRecoveryRecord(transaction, input.recoveryId);
    }, { isolationLevel: "Serializable" });
  }

  stageSuccess(input: InvocationCompletionInput): Promise<string> {
    return this.stageFinalization(
      input.workspaceId,
      input.invocationId,
      input.runtime.reservation.requestId,
      "SUCCESS",
      input
    );
  }

  stageFailure(input: InvocationFailureInput): Promise<string> {
    return this.stageFinalization(
      input.workspaceId,
      input.invocationId,
      input.runtime.reservation.requestId,
      "FAILURE",
      input
    );
  }

  async recoverPendingFinalizations(batchSize: number): Promise<number> {
    const records = await this.prisma.aiRuntimeFinalization.findMany({
      where: { status: "PENDING" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true, kind: true, payload: true }
    });
    let completed = 0;
    for (const record of records) {
      try {
        if (record.kind === "SUCCESS") {
          await this.complete({
            ...this.restoreCompletion(record.payload),
            recoveryId: record.id
          });
        } else {
          await this.failWithRuntime({
            ...this.restoreFailure(record.payload),
            recoveryId: record.id
          });
        }
        completed += 1;
      } catch {
        await this.prisma.aiRuntimeFinalization.updateMany({
          where: { id: record.id, status: "PENDING" },
          data: {
            attempts: { increment: 1 },
            lastError: "Finalization replay failed"
          }
        });
      }
    }
    return completed;
  }

  private async stageFinalization(
    workspaceId: string,
    invocationId: string,
    requestId: string,
    kind: "SUCCESS" | "FAILURE",
    payload: InvocationCompletionInput | InvocationFailureInput
  ): Promise<string> {
    const serialized = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonObject;
    const record = await this.prisma.aiRuntimeFinalization.upsert({
      where: { invocationId },
      create: {
        workspaceId,
        invocationId,
        requestId,
        kind,
        payload: serialized
      },
      update: {
        kind,
        payload: serialized,
        lastError: null
      },
      select: { id: true }
    });
    return record.id;
  }

  private async completeRecoveryRecord(
    transaction: Prisma.TransactionClient,
    recoveryId: string | undefined
  ): Promise<void> {
    if (!recoveryId) return;
    await transaction.aiRuntimeFinalization.updateMany({
      where: { id: recoveryId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lastError: null
      }
    });
  }

  private restoreCompletion(payload: Prisma.JsonValue): InvocationCompletionInput {
    return this.restoreRuntimeDates(payload) as InvocationCompletionInput;
  }

  private restoreFailure(payload: Prisma.JsonValue): InvocationFailureInput {
    return this.restoreRuntimeDates(payload) as InvocationFailureInput;
  }

  private restoreRuntimeDates(payload: Prisma.JsonValue): unknown {
    const value = payload as unknown as {
      runtime: {
        reservation: {
          queuedAt: string;
          activatedAt: string;
          leaseExpiresAt: string;
        };
      };
    };
    return {
      ...value,
      runtime: {
        ...value.runtime,
        reservation: {
          ...value.runtime.reservation,
          queuedAt: new Date(value.runtime.reservation.queuedAt),
          activatedAt: new Date(value.runtime.reservation.activatedAt),
          leaseExpiresAt: new Date(value.runtime.reservation.leaseExpiresAt)
        }
      }
    };
  }
}
