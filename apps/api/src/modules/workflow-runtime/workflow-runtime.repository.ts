import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WorkflowNodeRuntimeStatus, WorkflowRuntimeStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type { WorkflowExecutionListQueryDto } from "./dto/workflow-runtime.dto";
import type { WorkflowExecutionContext, WorkflowRuntimeSnapshot } from "./workflow-runtime.types";
import { WorkflowRuntimeStateMachine } from "./workflow-runtime.state-machine";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class WorkflowRuntimeRepository {
  constructor(private readonly prisma: PrismaService, private readonly states: WorkflowRuntimeStateMachine) {}

  async loadVersion(workspaceId: string, versionId: string) {
    const version = await this.prisma.workflowVersion.findFirst({ where: {
      id: versionId, workflow: { workspaceId, status: "PUBLISHED", archivedAt: null, deletedAt: null }
    }, include: { workflow: { select: { id: true, workspaceId: true, status: true } } } });
    if (!version) throw new NotFoundException("Published workflow version was not found");
    if (!version.snapshotHash || !version.checksum || !version.compatibilityVersion ||
      this.hash(version.snapshot) !== version.snapshotHash ||
      this.hash({ snapshotHash: version.snapshotHash, workspaceId, workflowId: version.workflowId,
        revision: version.revision }) !== version.checksum) {
      throw new ConflictException("Workflow version integrity validation failed");
    }
    return { ...version, snapshot: version.snapshot as unknown as WorkflowRuntimeSnapshot };
  }

  findByIdempotency(workspaceId: string, idempotencyKey: string) {
    return this.prisma.workflowRuntimeExecution.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } }, select: this.select
    });
  }

  create(input: { workspaceId: string; actorId: string; workflowId: string; versionId: string;
    requestId: string; runId: string; parentExecutionId?: string; correlationId: string; traceId: string;
    idempotencyKey: string; depth: number; maxDepth: number; maxNodeExecutions: number;
    timeoutMs: number; context: WorkflowExecutionContext; snapshotHash: string; metadata: Record<string, unknown> }) {
    const contextHash = this.hash(input.context);
    return this.prisma.$transaction(async (tx) => {
      const execution = await tx.workflowRuntimeExecution.create({ data: {
        workspaceId: input.workspaceId, createdById: input.actorId, workflowId: input.workflowId,
        workflowVersionId: input.versionId, executionRequestId: input.requestId,
        executionRunId: input.runId, parentExecutionId: input.parentExecutionId,
        correlationId: input.correlationId, traceId: input.traceId, idempotencyKey: input.idempotencyKey,
        depth: input.depth, maxDepth: input.maxDepth, maxNodeExecutions: input.maxNodeExecutions,
        timeoutMs: input.timeoutMs, deadlineAt: new Date(Date.now() + input.timeoutMs),
        input: json(input.context.input), contextSnapshot: json(input.context), runtimeContext: json(input.context),
        workflowSnapshotHash: input.snapshotHash, contextHash,
        checksum: this.hash({ contextHash, workflowSnapshotHash: input.snapshotHash,
          workspaceId: input.workspaceId, versionId: input.versionId }),
        states: { create: { sequence: 1, toStatus: WorkflowRuntimeStatus.CREATED,
          actorId: input.actorId, metadata: json(input.metadata) } }, metric: { create: {} }
      }, select: this.select });
      await this.audit(tx, input.workspaceId, input.actorId, "workflow.runtime.created", execution.id,
        { workflowId: input.workflowId, versionId: input.versionId, traceId: input.traceId });
      return execution;
    });
  }

  transition(workspaceId: string, actorId: string, id: string, to: WorkflowRuntimeStatus,
    reason?: string, extra: Record<string, unknown> = {}) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.require(tx, workspaceId, id); this.states.assert(current.status, to);
      const terminal = this.states.terminal(to); const now = new Date();
      const updated = await tx.workflowRuntimeExecution.updateMany({ where: {
        id, workspaceId, stateVersion: current.stateVersion
      }, data: { status: to, stateVersion: { increment: 1 },
        ...(to === WorkflowRuntimeStatus.RUNNING && !current.startedAt ? { startedAt: now } : {}),
        ...(terminal ? { endedAt: now, durationMs: current.startedAt ? now.getTime() - current.startedAt.getTime() : 0 } : {}),
        ...(extra as Prisma.WorkflowRuntimeExecutionUpdateManyMutationInput) } });
      if (updated.count !== 1) throw new ConflictException("Workflow execution state changed");
      await tx.workflowRuntimeStateHistory.create({ data: { executionId: id,
        sequence: current.stateVersion + 2, fromStatus: current.status, toStatus: to,
        actorId, reason, metadata: json(extra) } });
      if (terminal) await tx.workflowRuntimeMetric.update({ where: { executionId: id }, data: {
        executionDurationMs: current.startedAt ? now.getTime() - current.startedAt.getTime() : 0
      } });
      await this.audit(tx, workspaceId, actorId, `workflow.runtime.${to.toLowerCase()}`, id,
        { from: current.status, to, reason });
      return this.require(tx, workspaceId, id);
    });
  }

  startNode(workspaceId: string, actorId: string, executionId: string,
    node: { id: string; type: Prisma.WorkflowRuntimeNodeExecutionCreateInput["nodeType"] },
    attempt: number, input: unknown) {
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, workspaceId, executionId);
      const value = await tx.workflowRuntimeNodeExecution.create({ data: { executionId,
        nodeKey: node.id, nodeType: node.type, attempt, status: WorkflowNodeRuntimeStatus.RUNNING,
        input: json(input), startedAt: new Date() } });
      await this.audit(tx, workspaceId, actorId, "workflow.runtime.node.started", value.id,
        { executionId, nodeKey: node.id, attempt });
      return value;
    });
  }

  finishNode(workspaceId: string, actorId: string, nodeExecutionId: string,
    status: WorkflowNodeRuntimeStatus, output: unknown, options: { error?: unknown;
      selectedBranch?: string; agentExecutionId?: string; streamSessionId?: string;
      retryDelayMs?: number } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.workflowRuntimeNodeExecution.findFirst({ where: {
        id: nodeExecutionId, execution: { workspaceId }
      } });
      if (!current) throw new NotFoundException("Workflow node execution was not found");
      const endedAt = new Date();
      const value = await tx.workflowRuntimeNodeExecution.update({ where: { id: nodeExecutionId }, data: {
        status, output: json(output), error: json(options.error ?? {}),
        selectedBranch: options.selectedBranch, agentExecutionId: options.agentExecutionId,
        streamSessionId: options.streamSessionId, retryDelayMs: options.retryDelayMs ?? 0,
        endedAt, durationMs: current.startedAt ? endedAt.getTime() - current.startedAt.getTime() : 0
      } });
      await tx.workflowRuntimeMetric.update({ where: { executionId: current.executionId }, data: {
        ...(status === WorkflowNodeRuntimeStatus.COMPLETED ? { completedNodeCount: { increment: 1 } } : {}),
        ...(status === WorkflowNodeRuntimeStatus.FAILED ? { failedNodeCount: { increment: 1 } } : {}),
        ...(current.attempt > 1 ? { retryCount: { increment: 1 } } : {}),
        ...(current.nodeType === "AGENT" ? { agentNodeCount: { increment: 1 } } : {}),
        ...(options.streamSessionId ? { streamedNodeCount: { increment: 1 } } : {})
      } });
      await this.audit(tx, workspaceId, actorId, `workflow.runtime.node.${status.toLowerCase()}`, value.id,
        { executionId: current.executionId, nodeKey: current.nodeKey, attempt: current.attempt });
      return value;
    });
  }

  saveProgress(workspaceId: string, actorId: string, id: string, context: WorkflowExecutionContext,
    pending: string[], completed: string[], output?: Record<string, unknown>, compensationPlan?: unknown[]) {
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, workspaceId, id);
      const value = await tx.workflowRuntimeExecution.update({ where: { id }, data: {
        runtimeContext: json(context), pendingNodeKeys: pending, completedNodeKeys: completed,
        ...(output ? { output: json(output) } : {}),
        ...(compensationPlan ? { compensationPlan: json(compensationPlan) } : {})
      }, select: this.select });
      await this.audit(tx, workspaceId, actorId, "workflow.runtime.progressed", id,
        { pending, completedCount: completed.length });
      return value;
    });
  }

  diagnostic(workspaceId: string, actorId: string, executionId: string, input: {
    nodeKey?: string; severity: string; code: string; message: string; metadata?: Record<string, unknown> }) {
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, workspaceId, executionId);
      const diagnostic = await tx.workflowRuntimeDiagnostic.create({ data: { executionId,
        nodeKey: input.nodeKey, severity: input.severity, code: input.code, message: input.message,
        metadata: json(input.metadata ?? {}) } });
      await this.audit(tx, workspaceId, actorId, "workflow.runtime.diagnostic", diagnostic.id, input);
      return diagnostic;
    });
  }

  get(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id); }
  history(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.states); }
  diagnostics(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.diagnostics); }
  metrics(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.metric); }
  expired(limit = 100) {
    return this.prisma.workflowRuntimeExecution.findMany({ where: {
      status: { in: [WorkflowRuntimeStatus.QUEUED, WorkflowRuntimeStatus.PREPARING,
        WorkflowRuntimeStatus.RUNNING, WorkflowRuntimeStatus.WAITING, WorkflowRuntimeStatus.PAUSED] },
      deadlineAt: { lte: new Date() }
    }, select: { id: true, workspaceId: true, createdById: true, executionRunId: true,
      workflowVersionId: true }, orderBy: { deadlineAt: "asc" }, take: limit });
  }
  async list(workspaceId: string, query: WorkflowExecutionListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.WorkflowRuntimeExecutionWhereInput = { workspaceId, status: query.status,
      workflowId: query.workflowId, workflowVersionId: query.workflowVersionId,
      correlationId: query.correlationId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflowRuntimeExecution.findMany({ where, select: this.select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit }),
      this.prisma.workflowRuntimeExecution.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private require(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.workflowRuntimeExecution.findFirst({ where: { id, workspaceId }, select: this.select })
      .then((value) => { if (!value) throw new NotFoundException("Workflow execution was not found"); return value; });
  }
  private audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    action: string, entityId: string, value: unknown) {
    return tx.auditLog.create({ data: { workspaceId, userId: actorId, action,
      entityType: "WorkflowRuntimeExecution", entityId, oldValues: Prisma.JsonNull, newValues: json(value) } });
  }
  hash(value: unknown) { return createHash("sha256").update(this.stable(value)).digest("hex"); }
  private stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map((v) => this.stable(v)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${this.stable(v)}`).join(",")}}`;
    if (typeof value === "bigint") return JSON.stringify(value.toString()); return JSON.stringify(value) ?? "null"; }
  private readonly select = Prisma.validator<Prisma.WorkflowRuntimeExecutionSelect>()({ id: true, workspaceId: true, createdById: true, workflowId: true,
    workflowVersionId: true, executionRequestId: true, executionRunId: true, parentExecutionId: true,
    status: true, stateVersion: true, correlationId: true, traceId: true, idempotencyKey: true,
    depth: true, maxDepth: true, maxNodeExecutions: true, timeoutMs: true, deadlineAt: true,
    input: true, contextSnapshot: true, runtimeContext: true, output: true, pendingNodeKeys: true,
    completedNodeKeys: true, compensationPlan: true, workflowSnapshotHash: true, contextHash: true,
    checksum: true, failureCode: true, failureMessage: true, cancellationReason: true,
    startedAt: true, endedAt: true, durationMs: true, createdAt: true, updatedAt: true,
    nodes: { orderBy: [{ createdAt: "asc" }, { attempt: "asc" }] },
    states: { orderBy: { sequence: "asc" } }, diagnostics: { orderBy: { createdAt: "asc" } },
    metric: true });
}
