import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AgentExecutionOrchestrationStatus, Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  AgentExecutionListQueryDto, PrepareAgentExecutionDto
} from "./dto/agent-execution.dto";
import type {
  AgentExecutionAssetSet, AgentExecutionDiagnostic
} from "./agent-execution.validator";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class AgentExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  persist(
    workspaceId: string, actorId: string, requestId: string, runId: string,
    dto: PrepareAgentExecutionDto, assets: AgentExecutionAssetSet,
    diagnostics: AgentExecutionDiagnostic[]
  ) {
    return this.prisma.$transaction(async (tx) => {
      const valid = !diagnostics.some(({ severity }) => severity === "ERROR");
      const plan = {
        version: "1.0.0", executionRequestId: requestId, executionRunId: runId,
        assets: {
          agentRuntimeSnapshotId: dto.agentRuntimeSnapshotId,
          promptExecutionPayloadId: dto.promptExecutionPayloadId,
          providerRuntimeSnapshotId: dto.providerRuntimeSnapshotId,
          conversationRuntimeSnapshotId: dto.conversationRuntimeSnapshotId ?? null,
          executionPipelineSnapshotId: dto.executionPipelineSnapshotId
        },
        dependencies: [
          ["agentRuntime", "promptExecution"],
          ["promptExecution", "providerRuntime"],
          ["executionPipeline", "providerRuntime"]
        ],
        hashes: {
          agent: assets.agent.contentHash ?? null,
          prompt: assets.prompt.payloadHash ?? null,
          provider: assets.provider.requestHash ?? null,
          conversation: assets.conversation?.packageHash ?? null,
          pipeline: assets.pipeline.planHash ?? null
        }
      };
      const planHash = this.hash(plan);
      const status = valid
        ? AgentExecutionOrchestrationStatus.READY
        : AgentExecutionOrchestrationStatus.FAILED;
      const record = await tx.agentExecutionOrchestration.create({
        data: {
          workspaceId, createdById: actorId, executionRequestId: requestId,
          executionRunId: runId, agentRuntimeSnapshotId: dto.agentRuntimeSnapshotId,
          promptExecutionPayloadId: dto.promptExecutionPayloadId,
          providerRuntimeSnapshotId: dto.providerRuntimeSnapshotId,
          conversationRuntimeSnapshotId: dto.conversationRuntimeSnapshotId,
          executionPipelineSnapshotId: dto.executionPipelineSnapshotId,
          status, correlationId: dto.correlationId, orchestrationPlan: json(plan),
          runtimeDiagnostics: json(diagnostics), metadata: json(dto.metadata ?? {}),
          planHash, checksum: this.hash({ planHash, workspaceId }),
          readyAt: valid ? new Date() : undefined, failedAt: valid ? undefined : new Date(),
          diagnostics: {
            create: diagnostics.map((diagnostic) => ({
              ...diagnostic, metadata: json({})
            }))
          }
        },
        select: this.select
      });
      await this.audit(tx, workspaceId, actorId,
        valid ? "agent.execution.ready" : "agent.execution.failed", record.id, record);
      return record;
    });
  }

  cancel(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.agentExecutionOrchestration.findFirst({
        where: { id, workspaceId }, select: this.select
      });
      if (!before) throw new NotFoundException("Agent execution was not found");
      const record = await tx.agentExecutionOrchestration.update({
        where: { id }, data: {
          status: AgentExecutionOrchestrationStatus.CANCELLED, cancelledAt: new Date()
        }, select: this.select
      });
      await this.audit(tx, workspaceId, actorId, "agent.execution.cancelled", id, record);
      return record;
    });
  }

  get(workspaceId: string, id: string) {
    return this.prisma.agentExecutionOrchestration.findFirst({
      where: { id, workspaceId }, select: this.select
    }).then((value) => {
      if (!value) throw new NotFoundException("Agent execution was not found");
      return value;
    });
  }

  findByRequest(workspaceId: string, executionRequestId: string) {
    return this.prisma.agentExecutionOrchestration.findFirst({
      where: { workspaceId, executionRequestId }, select: this.select
    });
  }

  async list(workspaceId: string, query: AgentExecutionListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.AgentExecutionOrchestrationWhereInput = {
      workspaceId, status: query.status, correlationId: query.correlationId,
      executionRequestId: query.executionRequestId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.agentExecutionOrchestration.findMany({
        where, select: this.select, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.agentExecutionOrchestration.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private hash(value: unknown) {
    return createHash("sha256").update(this.stable(value)).digest("hex");
  }
  private stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stable(item)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stable(item)}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }
  private audit(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    action: string, entityId: string, after: unknown
  ) {
    return tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action,
      entityType: "AgentExecutionOrchestration", entityId,
      oldValues: Prisma.JsonNull, newValues: json(after)
    } });
  }
  private readonly select = {
    id: true, workspaceId: true, createdById: true, executionRequestId: true,
    executionRunId: true, agentRuntimeSnapshotId: true, promptExecutionPayloadId: true,
    providerRuntimeSnapshotId: true, conversationRuntimeSnapshotId: true,
    executionPipelineSnapshotId: true, status: true, correlationId: true,
    orchestrationPlan: true, runtimeDiagnostics: true, metadata: true,
    planHash: true, checksum: true, readyAt: true, failedAt: true,
    cancelledAt: true, createdAt: true, updatedAt: true, diagnostics: true
  } as const;
}
