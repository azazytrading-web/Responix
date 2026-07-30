import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StreamSessionStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateStreamSessionDto, StreamSessionListQueryDto
} from "./dto/streaming-runtime.dto";
import { StreamStateMachine } from "./stream-state-machine";
import type {
  StreamingChunkInput, StreamingCompletion
} from "./streaming-runtime.types";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class StreamingRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly states: StreamStateMachine
  ) {}

  async create(workspaceId: string, actorId: string, dto: CreateStreamSessionDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.streamSession.create({
        data: {
          workspaceId, createdById: actorId, providerId: dto.providerId,
          modelId: dto.modelId, requestHash: dto.requestHash,
          conversationId: dto.conversationId, agentRuntimeId: dto.agentRuntimeId,
          executionRequestId: dto.executionRequestId, executionRunId: dto.executionRunId,
          timeoutMs: dto.timeoutMs ?? 30_000,
          providerMetadata: json(dto.providerMetadata ?? {}),
          metric: { create: {} },
          snapshots: { create: {
            revision: 1,
            snapshot: json({
              requestHash: dto.requestHash, providerId: dto.providerId,
              modelId: dto.modelId, metadata: dto.providerMetadata ?? {}
            }),
            snapshotHash: this.hash(dto),
            checksum: this.hash({ workspaceId, dto })
          } }
        },
        select: this.select
      });
      await this.audit(tx, workspaceId, actorId, "stream.started", session.id, null, session);
      return session;
    });
  }

  async transition(
    workspaceId: string, actorId: string, id: string, to: StreamSessionStatus,
    expectedVersion: number, diagnostic?: { code: string; message: string }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.streamSession.findFirst({
        where: { id, workspaceId }, select: this.select
      });
      if (!before) throw new NotFoundException("Stream session was not found");
      this.states.assert(before.status, to);
      const now = new Date();
      const updated = await tx.streamSession.updateMany({
        where: { id, workspaceId, stateVersion: expectedVersion, status: before.status },
        data: {
          status: to, stateVersion: { increment: 1 },
          ...(to === "CONNECTING" ? { startedAt: now } : {}),
          ...(to === "FAILED" || to === "TIMED_OUT" ? {
            finishedAt: now, runtimeCompletedAt: now
          } : {}),
          ...(to === "CANCELLED" ? {
            cancelledAt: now, finishedAt: now, runtimeCompletedAt: now
          } : {}),
          ...(to === "DISCONNECTED" ? { disconnectedAt: now } : {})
        }
      });
      if (updated.count !== 1) throw new ConflictException("Stream session was updated");
      if (diagnostic) {
        await tx.streamDiagnostic.create({
          data: { sessionId: id, code: diagnostic.code, message: diagnostic.message }
        });
      }
      if (to === "CANCELLED") {
        await tx.streamMetric.update({
          where: { sessionId: id }, data: { cancellationCount: { increment: 1 } }
        });
      }
      const session = await tx.streamSession.findUniqueOrThrow({
        where: { id }, select: this.select
      });
      await this.audit(
        tx, workspaceId, actorId, this.auditAction(to), id, before, session
      );
      return session;
    });
  }

  async appendChunk(
    workspaceId: string, actorId: string, id: string, input: StreamingChunkInput
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.streamSession.findFirst({
          where: { id, workspaceId },
          select: {
            id: true, status: true, startedAt: true, firstTokenAt: true,
            metric: { select: { chunkCount: true } }
          }
        });
        if (!session) throw new NotFoundException("Stream session was not found");
        if (session.status !== "STREAMING") {
          throw new ConflictException("Stream session is not streaming");
        }
        if (input.sequence !== (session.metric?.chunkCount ?? 0)) {
          throw new ConflictException("Stream chunk sequence is not contiguous");
        }
        const now = new Date();
        const chunk = await tx.streamChunk.create({
          data: {
            sessionId: id, sequence: input.sequence, content: input.content,
            role: input.role, delta: input.delta ?? true,
            finishReason: input.finishReason,
            providerMetadata: json(input.providerMetadata ?? {})
          }
        });
        const first = session.firstTokenAt === null;
        await tx.streamSession.update({
          where: { id },
          data: {
            ...(first ? { firstTokenAt: now } : {}),
            lastTokenAt: now
          }
        });
        await tx.streamMetric.update({
          where: { sessionId: id },
          data: {
            chunkCount: { increment: 1 },
            characters: { increment: input.content.length },
            ...(first && session.startedAt ? {
              timeToFirstByteMs: Math.max(0, now.getTime() - session.startedAt.getTime())
            } : {})
          }
        });
        if (first) {
          await this.audit(tx, workspaceId, actorId, "stream.first_token", id, null, {
            sequence: input.sequence, timestamp: now
          });
        }
        await this.audit(tx, workspaceId, actorId, "stream.chunk", id, null, {
          id: chunk.id, sequence: chunk.sequence, createdAt: chunk.createdAt
        });
        return chunk;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Stream chunk sequence already exists");
      }
      throw error;
    }
  }

  async complete(
    workspaceId: string, actorId: string, id: string, expectedVersion: number,
    completion: StreamingCompletion
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.streamSession.findFirst({
        where: { id, workspaceId }, select: this.select
      });
      if (!before) throw new NotFoundException("Stream session was not found");
      if (before.status === "COMPLETED") return before;
      this.states.assert(before.status, "COMPLETED");
      const now = new Date();
      const updated = await tx.streamSession.updateMany({
        where: {
          id, workspaceId, status: before.status, stateVersion: expectedVersion,
          invocationId: null
        },
        data: {
          status: "COMPLETED", stateVersion: { increment: 1 },
          invocationId: completion.invocationId,
          responseContent: completion.responseContent,
          usageStatus: completion.usage ? "AVAILABLE" : "UNKNOWN",
          inputTokens: completion.usage?.inputTokens,
          outputTokens: completion.usage?.outputTokens,
          cachedTokens: completion.usage?.cachedTokens,
          totalTokens: completion.usage?.totalTokens,
          inputCost: completion.cost?.inputCost,
          outputCost: completion.cost?.outputCost,
          totalCost: completion.cost?.totalCost,
          costCurrency: completion.cost?.currency ?? completion.pricing.currency,
          pricingMetadata: json({
            inputCostPerMillion: completion.pricing.inputCostPerMillion,
            outputCostPerMillion: completion.pricing.outputCostPerMillion,
            currency: completion.pricing.currency
          }),
          providerCompletedAt: completion.providerCompletedAt,
          runtimeCompletedAt: now, finishedAt: now
        }
      });
      if (updated.count !== 1) {
        throw new ConflictException("Stream completion conflict");
      }
      const lastChunk = await tx.streamChunk.findFirst({
        where: { sessionId: id }, orderBy: { sequence: "desc" },
        select: { sequence: true, createdAt: true }
      });
      if (lastChunk) {
        await this.audit(tx, workspaceId, actorId, "stream.last_token", id, null, lastChunk);
      }
      await tx.streamMetric.update({
        where: { sessionId: id },
        data: {
          totalDurationMs: before.startedAt
            ? Math.max(0, now.getTime() - before.startedAt.getTime())
            : 0
        }
      });
      const session = await tx.streamSession.findUniqueOrThrow({
        where: { id }, select: this.select
      });
      await this.audit(tx, workspaceId, actorId, "stream.provider_completed", id, null, {
        timestamp: completion.providerCompletedAt,
        usageStatus: session.usageStatus
      });
      await this.audit(tx, workspaceId, actorId, "stream.completed", id, before, session);
      return session;
    }, { isolationLevel: "Serializable" });
  }

  get(workspaceId: string, id: string) {
    return this.prisma.streamSession.findFirst({
      where: { id, workspaceId }, select: this.select
    }).then((value) => {
      if (!value) throw new NotFoundException("Stream session was not found");
      return value;
    });
  }

  async list(workspaceId: string, query: StreamSessionListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.StreamSessionWhereInput = {
      workspaceId, status: query.status, executionRunId: query.executionRunId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.streamSession.findMany({
        where, select: this.select, skip: (page - 1) * limit, take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }]
      }),
      this.prisma.streamSession.count({ where })
    ]);
    return {
      data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  diagnostics(workspaceId: string, id: string) {
    return this.prisma.streamSession.findFirst({
      where: { id, workspaceId },
      select: { diagnostics: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
    }).then((value) => {
      if (!value) throw new NotFoundException("Stream session was not found");
      return value.diagnostics;
    });
  }

  metrics(workspaceId: string, id: string) {
    return this.prisma.streamSession.findFirst({
      where: { id, workspaceId }, select: { metric: true }
    }).then((value) => {
      if (!value) throw new NotFoundException("Stream session was not found");
      return value.metric;
    });
  }

  chunks(workspaceId: string, id: string) {
    return this.prisma.streamSession.findFirst({
      where: { id, workspaceId },
      select: { chunks: { orderBy: [{ sequence: "asc" }] } }
    }).then((value) => {
      if (!value) throw new NotFoundException("Stream session was not found");
      return value.chunks;
    });
  }

  async compare(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await this.prisma.$transaction([
      this.prisma.streamSnapshot.findFirst({
        where: { id: leftId, session: { workspaceId } }
      }),
      this.prisma.streamSnapshot.findFirst({
        where: { id: rightId, session: { workspaceId } }
      })
    ]);
    if (!left || !right) {
      throw new NotFoundException("One or more stream snapshots were not found");
    }
    return {
      identical: left.snapshotHash === right.snapshotHash &&
        left.checksum === right.checksum,
      left, right
    };
  }

  private auditAction(status: StreamSessionStatus): string {
    switch (status) {
      case "CANCELLED": return "stream.cancelled";
      case "TIMED_OUT": return "stream.timeout";
      case "FAILED": return "stream.provider_failed";
      default: return `stream.${status.toLowerCase()}`;
    }
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private async audit(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    action: string, id: string, before: unknown, after: unknown
  ) {
    await tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action,
      entityType: "StreamSession", entityId: id,
      oldValues: before === null ? Prisma.JsonNull : json(before),
      newValues: after === null ? Prisma.JsonNull : json(after)
    } });
  }

  private readonly select = {
    id: true, workspaceId: true, status: true, stateVersion: true,
    requestHash: true, invocationId: true, providerId: true, modelId: true,
    executionRunId: true, timeoutMs: true, startedAt: true, firstTokenAt: true,
    lastTokenAt: true, providerCompletedAt: true, runtimeCompletedAt: true,
    finishedAt: true, cancelledAt: true, disconnectedAt: true,
    reconnectCount: true, retryCount: true, responseContent: true,
    usageStatus: true, inputTokens: true, outputTokens: true, cachedTokens: true,
    totalTokens: true, inputCost: true, outputCost: true, totalCost: true,
    costCurrency: true, pricingMetadata: true, providerMetadata: true,
    createdAt: true, updatedAt: true, metric: true, snapshots: true
  } as const;
}
