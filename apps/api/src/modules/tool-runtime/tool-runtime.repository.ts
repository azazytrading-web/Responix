import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ToolAttemptStatus, ToolExecutionMode, ToolRuntimeStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type { ToolExecutionListQueryDto } from "./dto/tool-runtime.dto";
import type { ToolExecutionContext, ToolRuntimeSnapshot } from "./tool-runtime.types";
import type { ResolvedToolPolicy } from "./tool-policy.validator";
import { ToolRuntimeStateMachine } from "./tool-runtime.state-machine";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class ToolRuntimeRepository {
  constructor(private readonly prisma: PrismaService, private readonly machine: ToolRuntimeStateMachine) {}

  findByIdempotency(workspaceId: string, key: string) {
    return this.prisma.toolRuntimeExecution.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } }, select: this.select
    });
  }

  actorIdentity(workspaceId: string, actorId: string) {
    return this.prisma.workspaceMembership.findFirst({ where: {
      workspaceId, userId: actorId, status: "ACTIVE", removedAt: null, suspendedAt: null
    }, select: { userId: true, roleId: true, role: { select: { name: true } } } }).then((identity) => {
      if (!identity) throw new NotFoundException("Active workspace actor was not found");
      return { userId: identity.userId, roleId: identity.roleId, roleName: identity.role.name };
    });
  }

  create(input: { workspaceId: string; actorId: string; toolId: string; toolVersionId: string;
    requestId: string; runId: string; parentExecutionId?: string; parentRunId?: string;
    correlationId: string; traceId: string; idempotencyKey: string; mode: ToolExecutionMode;
    rawInput: Record<string, unknown>; normalizedInput: Record<string, unknown>;
    context: ToolExecutionContext; snapshot: ToolRuntimeSnapshot; snapshotHash: string;
    policy: ResolvedToolPolicy; timeoutMs: number; metadata: Record<string, unknown> }) {
    const inputHash = this.hash(input.normalizedInput); const contextHash = this.hash(input.context);
    return this.prisma.$transaction(async (tx) => {
      const execution = await tx.toolRuntimeExecution.create({ data: {
        workspaceId: input.workspaceId, actorId: input.actorId, toolId: input.toolId,
        toolVersionId: input.toolVersionId, executionRequestId: input.requestId,
        executionRunId: input.runId, parentExecutionId: input.parentExecutionId,
        parentExecutionRunId: input.parentRunId, status: ToolRuntimeStatus.CREATED, mode: input.mode,
        correlationId: input.correlationId, traceId: input.traceId,
        idempotencyKey: input.idempotencyKey, input: json(input.rawInput),
        normalizedInput: json(input.normalizedInput), contextSnapshot: json(input.context),
        toolSnapshot: json(input.snapshot), policySnapshot: json(input.policy),
        toolSnapshotHash: input.snapshotHash, inputHash, contextHash,
        checksum: this.hash({ workspaceId: input.workspaceId, toolVersionId: input.toolVersionId,
          snapshotHash: input.snapshotHash, inputHash, contextHash }), timeoutMs: input.timeoutMs,
        deadlineAt: new Date(Date.now() + input.timeoutMs),
        states: { create: { sequence: 1, toStatus: ToolRuntimeStatus.CREATED,
          actorId: input.actorId, metadata: json(input.metadata) } }, metric: { create: {
          requestBytes: Buffer.byteLength(JSON.stringify(input.normalizedInput))
        } }, events: { create: { sequence: 1, type: "tool.execution.created",
          payload: json({ traceId: input.traceId, toolVersionId: input.toolVersionId }) } }
      }, select: this.select });
      await this.audit(tx, input.workspaceId, input.actorId, "tool.runtime.created", execution.id,
        { toolId: input.toolId, toolVersionId: input.toolVersionId, traceId: input.traceId });
      return execution;
    });
  }

  transition(workspaceId: string, actorId: string, id: string, to: ToolRuntimeStatus,
    reason?: string, extra: Prisma.ToolRuntimeExecutionUpdateManyMutationInput = {}) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.require(tx, workspaceId, id); this.machine.assert(current.status, to);
      const now = new Date(); const terminal = this.machine.terminal(to);
      const updated = await tx.toolRuntimeExecution.updateMany({ where: {
        id, workspaceId, stateVersion: current.stateVersion
      }, data: { status: to, stateVersion: { increment: 1 },
        ...((to === ToolRuntimeStatus.RUNNING || to === ToolRuntimeStatus.STREAMING) && !current.startedAt ? { startedAt: now } : {}),
        ...(terminal ? { endedAt: now, durationMs: current.startedAt ? now.getTime() - current.startedAt.getTime() : 0 } : {}),
        ...extra } });
      if (updated.count !== 1) throw new ConflictException("Tool execution state changed");
      await tx.toolRuntimeStateHistory.create({ data: { executionId: id,
        sequence: current.stateVersion + 2, fromStatus: current.status, toStatus: to,
        actorId, reason, metadata: json(extra) } });
      await this.appendEventTx(tx, id, `tool.execution.${to.toLowerCase()}`, { reason });
      if (terminal) await tx.toolRuntimeMetric.update({ where: { executionId: id }, data: {
        executionDurationMs: current.startedAt ? now.getTime() - current.startedAt.getTime() : 0
      } });
      await this.audit(tx, workspaceId, actorId, `tool.runtime.${to.toLowerCase()}`, id,
        { from: current.status, to, reason });
      return this.require(tx, workspaceId, id);
    });
  }

  startAttempt(workspaceId: string, actorId: string, executionId: string, attempt: number, request: unknown) {
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, workspaceId, executionId);
      const value = await tx.toolRuntimeAttempt.create({ data: { executionId, attempt, request: json(request) } });
      await tx.toolRuntimeExecution.update({ where: { id: executionId }, data: { attemptCount: attempt } });
      await tx.toolRuntimeMetric.update({ where: { executionId }, data: { attemptCount: { increment: 1 },
        ...(attempt > 1 ? { retryCount: { increment: 1 } } : {}) } });
      await this.appendEventTx(tx, executionId, "tool.attempt.started", { attempt });
      await this.audit(tx, workspaceId, actorId, "tool.runtime.attempt.started", value.id, { executionId, attempt });
      return value;
    });
  }

  finishAttempt(workspaceId: string, actorId: string, id: string, status: ToolAttemptStatus,
    response: unknown, options: { error?: unknown; responseBytes?: number; retryDelayMs?: number;
      transportDurationMs?: number } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.toolRuntimeAttempt.findFirst({ where: { id,
        execution: { workspaceId } } });
      if (!current) throw new NotFoundException("Tool execution attempt was not found");
      const endedAt = new Date();
      const value = await tx.toolRuntimeAttempt.update({ where: { id }, data: { status,
        response: response === undefined ? undefined : json(response), error: json(options.error ?? {}),
        responseBytes: options.responseBytes ?? 0, retryDelayMs: options.retryDelayMs ?? 0,
        endedAt, durationMs: endedAt.getTime() - current.startedAt.getTime() } });
      await tx.toolRuntimeMetric.update({ where: { executionId: current.executionId }, data: {
        responseBytes: { increment: options.responseBytes ?? 0 },
        ...(options.transportDurationMs !== undefined ? { transportDurationMs: { increment: options.transportDurationMs } } : {})
      } });
      await this.appendEventTx(tx, current.executionId, `tool.attempt.${status.toLowerCase()}`, { attempt: current.attempt });
      await this.audit(tx, workspaceId, actorId, `tool.runtime.attempt.${status.toLowerCase()}`, id,
        { executionId: current.executionId, attempt: current.attempt });
      return value;
    });
  }

  saveOutput(workspaceId: string, actorId: string, id: string, output: unknown, partial = false) {
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, workspaceId, id);
      const value = await tx.toolRuntimeExecution.update({ where: { id }, data:
        partial ? { partialOutput: json(output) } : { output: json(output) }, select: this.select });
      await this.appendEventTx(tx, id, partial ? "tool.output.partial" : "tool.output.completed", output);
      await this.audit(tx, workspaceId, actorId, partial ? "tool.runtime.output.partial" : "tool.runtime.output.saved", id,
        { outputHash: this.hash(output) });
      return value;
    });
  }

  diagnostic(workspaceId: string, actorId: string, executionId: string, input: {
    attempt?: number; severity: string; code: string; path?: string; message: string;
    metadata?: Record<string, unknown> }) {
    return this.prisma.$transaction(async (tx) => {
      await this.require(tx, workspaceId, executionId);
      const value = await tx.toolRuntimeDiagnostic.create({ data: { executionId,
        attempt: input.attempt, severity: input.severity, code: input.code, path: input.path,
        message: input.message, metadata: json(input.metadata ?? {}) } });
      await this.appendEventTx(tx, executionId, "tool.diagnostic", { code: input.code, severity: input.severity });
      await this.audit(tx, workspaceId, actorId, "tool.runtime.diagnostic", value.id, input);
      return value;
    });
  }

  event(workspaceId: string, executionId: string, type: string, payload: unknown) {
    return this.prisma.$transaction(async (tx) => { await this.require(tx, workspaceId, executionId);
      return this.appendEventTx(tx, executionId, type, payload); });
  }
  get(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id); }
  history(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.states); }
  diagnostics(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.diagnostics); }
  metrics(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.metric); }
  events(workspaceId: string, id: string) { return this.require(this.prisma, workspaceId, id).then((v) => v.events); }
  async list(workspaceId: string, query: ToolExecutionListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.ToolRuntimeExecutionWhereInput = { workspaceId, status: query.status,
      toolId: query.toolId, toolVersionId: query.toolVersionId, correlationId: query.correlationId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.toolRuntimeExecution.findMany({ where, select: this.select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit }),
      this.prisma.toolRuntimeExecution.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  expired(limit = 100) { return this.prisma.toolRuntimeExecution.findMany({ where: {
    status: { in: ["QUEUED", "PREPARING", "RUNNING", "STREAMING"] }, deadlineAt: { lte: new Date() }
  }, select: { id: true, workspaceId: true, actorId: true, executionRunId: true },
  orderBy: { deadlineAt: "asc" }, take: limit }); }

  hash(value: unknown) { return createHash("sha256").update(this.stable(value)).digest("hex"); }
  private require(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.toolRuntimeExecution.findFirst({ where: { id, workspaceId }, select: this.select })
      .then((value) => { if (!value) throw new NotFoundException("Tool execution was not found"); return value; });
  }
  private async appendEventTx(tx: Prisma.TransactionClient, executionId: string, type: string, payload: unknown) {
    const last = await tx.toolRuntimeEvent.findFirst({ where: { executionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    return tx.toolRuntimeEvent.create({ data: { executionId, sequence: (last?.sequence ?? 0) + 1,
      type, payload: json(payload ?? {}) } });
  }
  private audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    action: string, entityId: string, value: unknown) {
    return tx.auditLog.create({ data: { workspaceId, userId: actorId, action,
      entityType: "ToolRuntimeExecution", entityId, oldValues: Prisma.JsonNull, newValues: json(value) } });
  }
  private stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map((item) => this.stable(item)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stable(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null"; }
  private readonly select = Prisma.validator<Prisma.ToolRuntimeExecutionSelect>()({
    id: true, workspaceId: true, actorId: true, toolId: true, toolVersionId: true,
    executionRequestId: true, executionRunId: true, parentExecutionId: true,
    parentExecutionRunId: true, status: true, mode: true, stateVersion: true,
    correlationId: true, traceId: true, idempotencyKey: true, input: true,
    normalizedInput: true, contextSnapshot: true, toolSnapshot: true, policySnapshot: true,
    output: true, partialOutput: true, toolSnapshotHash: true, inputHash: true,
    contextHash: true, checksum: true, attemptCount: true, timeoutMs: true, deadlineAt: true,
    failureCode: true, failureMessage: true, cancellationReason: true, startedAt: true,
    endedAt: true, durationMs: true, createdAt: true, updatedAt: true,
    attempts: { orderBy: { attempt: "asc" } }, states: { orderBy: { sequence: "asc" } },
    diagnostics: { orderBy: { createdAt: "asc" } }, events: { orderBy: { sequence: "asc" } }, metric: true
  });
}
