import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AiContractError } from "../contracts";
import type {
  RuntimeEstimate,
  RuntimeFailureAccounting,
  RuntimeLimits
} from "./runtime.types";
import { PrismaService } from "../../../database/prisma.service";

export interface WorkspaceRuntimeLimitOverride {
  dailyRequestLimit: number | null;
  monthlyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  dailyCostLimit: string | null;
  monthlyCostLimit: string | null;
  maxConcurrentInvocations: number | null;
  maxQueueDepth: number | null;
  maxContextTokens: number | null;
  maxOutputTokens: number | null;
}

export interface PersistedRuntimeReservation {
  id: string;
  workspaceId: string;
  requestId: string;
  ownerToken: string;
  status: "QUEUED" | "ACTIVE";
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCost: string;
  queuedAt: Date;
  activatedAt: Date | null;
  leaseExpiresAt: Date;
}

@Injectable()
export class RuntimeProtectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWorkspaceLimits(
    workspaceId: string
  ): Promise<WorkspaceRuntimeLimitOverride | null> {
    const record = await this.prisma.aiWorkspaceRuntimeLimit.findUnique({
      where: { workspaceId },
      select: {
        dailyRequestLimit: true,
        monthlyRequestLimit: true,
        dailyTokenLimit: true,
        monthlyTokenLimit: true,
        dailyCostLimit: true,
        monthlyCostLimit: true,
        maxConcurrentInvocations: true,
        maxQueueDepth: true,
        maxContextTokens: true,
        maxOutputTokens: true
      }
    });
    return record
      ? {
          ...record,
          dailyCostLimit: record.dailyCostLimit?.toFixed(6) ?? null,
          monthlyCostLimit: record.monthlyCostLimit?.toFixed(6) ?? null
        }
      : null;
  }

  reserve(input: {
    workspaceId: string;
    requestId: string;
    ownerToken: string;
    estimate: RuntimeEstimate;
    limits: RuntimeLimits;
    expiresAt: Date;
    heartbeatTimeoutMs: number;
  }): Promise<PersistedRuntimeReservation> {
    return this.prisma.$transaction(
      async (transaction) => {
        await this.lockWorkspace(transaction, input.workspaceId);
        await this.reclaimStaleActive(
          transaction,
          input.workspaceId,
          input.heartbeatTimeoutMs
        );
        await this.assertAtomicQuota(transaction, input);

        const active = await transaction.aiRuntimeReservation.count({
          where: {
            workspaceId: input.workspaceId,
            status: "ACTIVE"
          }
        });
        const queued = await transaction.aiRuntimeReservation.count({
          where: {
            workspaceId: input.workspaceId,
            status: "QUEUED",
            expiresAt: { gt: new Date() }
          }
        });
        if (
          active >= input.limits.maxConcurrentInvocations &&
          queued >= input.limits.maxQueueDepth
        ) {
          throw new AiContractError("RATE_LIMITED", "AI runtime queue capacity exceeded");
        }

        const status =
          active < input.limits.maxConcurrentInvocations ? "ACTIVE" : "QUEUED";
        const now = new Date();
        const record = await transaction.aiRuntimeReservation.create({
          data: {
            workspaceId: input.workspaceId,
            requestId: input.requestId,
            ownerToken: input.ownerToken,
            status,
            estimatedInputTokens: input.estimate.inputTokens,
            estimatedOutputTokens: input.estimate.outputTokens,
            estimatedTotalTokens: input.estimate.totalTokens,
            estimatedCost: input.estimate.estimatedCost,
            queuedAt: now,
            activatedAt: status === "ACTIVE" ? now : null,
            heartbeatAt: status === "ACTIVE" ? now : null,
            expiresAt: input.expiresAt
          },
          select: {
            id: true,
            workspaceId: true,
            requestId: true,
            ownerToken: true,
            status: true,
            estimatedInputTokens: true,
            estimatedOutputTokens: true,
            estimatedTotalTokens: true,
            estimatedCost: true,
            queuedAt: true,
            activatedAt: true,
            expiresAt: true
          }
        });
        return {
          ...record,
          status: record.status as "QUEUED" | "ACTIVE",
          estimatedCost: record.estimatedCost.toFixed(6),
          leaseExpiresAt: record.expiresAt
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  tryActivate(
    workspaceId: string,
    reservationId: string,
    ownerToken: string,
    maxConcurrentInvocations: number,
    leaseExpiresAt: Date,
    heartbeatTimeoutMs: number
  ): Promise<PersistedRuntimeReservation | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        await this.lockWorkspace(transaction, workspaceId);
        await this.reclaimStaleActive(
          transaction,
          workspaceId,
          heartbeatTimeoutMs
        );
        const active = await transaction.aiRuntimeReservation.count({
          where: { workspaceId, status: "ACTIVE" }
        });
        if (active >= maxConcurrentInvocations) return null;
        const firstQueued = await transaction.aiRuntimeReservation.findFirst({
          where: { workspaceId, status: "QUEUED", expiresAt: { gt: new Date() } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true }
        });
        if (firstQueued?.id !== reservationId) return null;
        const activatedAt = new Date();
        const updated = await transaction.aiRuntimeReservation.updateMany({
          where: { id: reservationId, workspaceId, ownerToken, status: "QUEUED" },
          data: {
            status: "ACTIVE",
            activatedAt,
            heartbeatAt: activatedAt,
            expiresAt: leaseExpiresAt
          }
        });
        if (updated.count !== 1) {
          throw new AiContractError(
            "AUTHORIZATION_FAILED",
            "AI runtime reservation ownership mismatch"
          );
        }
        const record = await transaction.aiRuntimeReservation.findFirstOrThrow({
          where: { id: reservationId, workspaceId, ownerToken, status: "ACTIVE" },
          select: {
            id: true,
            workspaceId: true,
            requestId: true,
            ownerToken: true,
            status: true,
            estimatedInputTokens: true,
            estimatedOutputTokens: true,
            estimatedTotalTokens: true,
            estimatedCost: true,
            queuedAt: true,
            activatedAt: true,
            expiresAt: true
          }
        });
        return {
          ...record,
          status: "ACTIVE",
          estimatedCost: record.estimatedCost.toFixed(6),
          leaseExpiresAt: record.expiresAt
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  release(workspaceId: string, reservationId: string, ownerToken: string): Promise<void> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspace(transaction, workspaceId);
      await this.releaseOwnedInTransaction(transaction, workspaceId, reservationId, ownerToken);
    });
  }

  renewLease(
    workspaceId: string,
    reservationId: string,
    ownerToken: string,
    leaseExpiresAt: Date
  ): Promise<void> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspace(transaction, workspaceId);
      const updated = await transaction.aiRuntimeReservation.updateMany({
        where: {
          id: reservationId,
          workspaceId,
          ownerToken,
          status: "ACTIVE"
        },
        data: { heartbeatAt: new Date(), expiresAt: leaseExpiresAt }
      });
      if (updated.count !== 1) {
        throw new AiContractError(
          "AUTHORIZATION_FAILED",
          "AI runtime reservation ownership mismatch"
        );
      }
    });
  }

  async recoverStaleReservations(
    heartbeatTimeoutMs: number,
    batchSize: number
  ): Promise<number> {
    const now = new Date();
    const staleHeartbeatBefore = new Date(now.getTime() - heartbeatTimeoutMs);
    const candidates = await this.prisma.aiRuntimeReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
        OR: [
          { heartbeatAt: null },
          { heartbeatAt: { lte: staleHeartbeatBefore } }
        ]
      },
      distinct: ["workspaceId"],
      orderBy: { expiresAt: "asc" },
      take: batchSize,
      select: { workspaceId: true }
    });
    let recovered = 0;
    for (const candidate of candidates) {
      recovered += await this.prisma.$transaction(async (transaction) => {
        await this.lockWorkspace(transaction, candidate.workspaceId);
        return this.reclaimStaleActive(
          transaction,
          candidate.workspaceId,
          heartbeatTimeoutMs
        );
      });
    }
    return recovered;
  }

  recordFailure(input: RuntimeFailureAccounting): Promise<void> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspace(transaction, input.reservation.workspaceId);
      await this.releaseOwnedInTransaction(
        transaction,
        input.reservation.workspaceId,
        input.reservation.id,
        input.reservation.ownerToken
      );
      await transaction.aiRuntimeAccounting.create({
        data: {
          workspaceId: input.reservation.workspaceId,
          invocationId: input.invocationId,
          providerId: input.providerId,
          modelId: input.modelId,
          requestId: input.reservation.requestId,
          estimatedInputTokens: input.reservation.estimate.inputTokens,
          estimatedOutputTokens: input.reservation.estimate.outputTokens,
          estimatedTotalTokens: input.reservation.estimate.totalTokens,
          estimatedCost: input.reservation.estimate.estimatedCost,
          actualPromptTokens: 0,
          actualCompletionTokens: 0,
          actualCachedTokens: 0,
          actualTotalTokens: 0,
          actualCost: "0.000000",
          retryCount: input.retryCount,
          queueWaitMs: input.reservation.queueWaitMs,
          reservationMs: Date.now() - input.reservation.reservedAt,
          executionDurationMs: input.executionDurationMs,
          providerDurationMs: input.providerDurationMs,
          status: input.cancelled
            ? "CANCELLED"
            : input.timeoutReason
              ? "TIMED_OUT"
              : "FAILED",
          failureReason: input.failureReason,
          timeoutReason: input.timeoutReason,
          cancelled: input.cancelled
        }
      });
    });
  }

  private async assertAtomicQuota(
    transaction: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      estimate: RuntimeEstimate;
      limits: RuntimeLimits;
    }
  ): Promise<void> {
    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [dailyRequests, monthlyRequests, dailyActual, monthlyActual, reserved] =
      await Promise.all([
        transaction.aiRuntimeAccounting.count({
          where: { workspaceId: input.workspaceId, recordedAt: { gte: dayStart } }
        }),
        transaction.aiRuntimeAccounting.count({
          where: { workspaceId: input.workspaceId, recordedAt: { gte: monthStart } }
        }),
        transaction.aiRuntimeAccounting.aggregate({
          where: {
            workspaceId: input.workspaceId,
            status: "SUCCEEDED",
            recordedAt: { gte: dayStart }
          },
          _sum: { actualTotalTokens: true, actualCost: true }
        }),
        transaction.aiRuntimeAccounting.aggregate({
          where: {
            workspaceId: input.workspaceId,
            status: "SUCCEEDED",
            recordedAt: { gte: monthStart }
          },
          _sum: { actualTotalTokens: true, actualCost: true }
        }),
        transaction.aiRuntimeReservation.aggregate({
          where: {
            workspaceId: input.workspaceId,
            OR: [
              { status: "ACTIVE" },
              { status: "QUEUED", expiresAt: { gt: now } }
            ]
          },
          _count: { id: true },
          _sum: { estimatedTotalTokens: true, estimatedCost: true }
        })
      ]);

    const reservedRequests = reserved._count.id;
    this.assertLimit(
      dailyRequests + reservedRequests + 1,
      input.limits.dailyRequestLimit,
      "Daily AI request quota exceeded"
    );
    this.assertLimit(
      monthlyRequests + reservedRequests + 1,
      input.limits.monthlyRequestLimit,
      "Monthly AI request quota exceeded"
    );
    this.assertLimit(
      (dailyActual._sum.actualTotalTokens ?? 0) +
        (reserved._sum.estimatedTotalTokens ?? 0) +
        input.estimate.totalTokens,
      input.limits.dailyTokenLimit,
      "Daily AI token quota exceeded"
    );
    this.assertLimit(
      (monthlyActual._sum.actualTotalTokens ?? 0) +
        (reserved._sum.estimatedTotalTokens ?? 0) +
        input.estimate.totalTokens,
      input.limits.monthlyTokenLimit,
      "Monthly AI token quota exceeded"
    );
    this.assertDecimalLimit(
      dailyActual._sum.actualCost,
      reserved._sum.estimatedCost,
      input.estimate.estimatedCost,
      input.limits.dailyCostLimit,
      "Daily AI cost quota exceeded"
    );
    this.assertDecimalLimit(
      monthlyActual._sum.actualCost,
      reserved._sum.estimatedCost,
      input.estimate.estimatedCost,
      input.limits.monthlyCostLimit,
      "Monthly AI cost quota exceeded"
    );
  }

  private assertLimit(value: number, limit: number, message: string): void {
    if (value > limit) throw new AiContractError("RATE_LIMITED", message);
  }

  private assertDecimalLimit(
    actual: Prisma.Decimal | null,
    reserved: Prisma.Decimal | null,
    estimate: string,
    limit: string,
    message: string
  ): void {
    const projected = (actual ?? new Prisma.Decimal(0))
      .plus(reserved ?? new Prisma.Decimal(0))
      .plus(estimate);
    if (projected.greaterThan(new Prisma.Decimal(limit))) {
      throw new AiContractError("RATE_LIMITED", message);
    }
  }

  private async releaseOwnedInTransaction(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    reservationId: string,
    ownerToken: string
  ): Promise<void> {
    const updated = await transaction.aiRuntimeReservation.updateMany({
      where: {
        id: reservationId,
        workspaceId,
        ownerToken,
        status: { in: ["QUEUED", "ACTIVE"] }
      },
      data: { status: "RELEASED", releasedAt: new Date() }
    });
    if (updated.count !== 1) {
      throw new AiContractError(
        "AUTHORIZATION_FAILED",
        "AI runtime reservation ownership mismatch"
      );
    }
  }

  private async reclaimStaleActive(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    heartbeatTimeoutMs: number
  ): Promise<number> {
    const now = new Date();
    const staleHeartbeatBefore = new Date(now.getTime() - heartbeatTimeoutMs);
    const pendingFinalizations = await transaction.aiRuntimeFinalization.findMany({
      where: { workspaceId, status: "PENDING" },
      select: { requestId: true }
    });
    const released = await transaction.aiRuntimeReservation.updateMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        expiresAt: { lte: now },
        requestId: {
          notIn: pendingFinalizations.map(({ requestId }) => requestId)
        },
        OR: [
          { heartbeatAt: null },
          { heartbeatAt: { lte: staleHeartbeatBefore } }
        ]
      },
      data: { status: "RELEASED", releasedAt: now }
    });
    return released.count;
  }

  private async lockWorkspace(
    transaction: Prisma.TransactionClient,
    workspaceId: string
  ): Promise<void> {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;
  }
}
