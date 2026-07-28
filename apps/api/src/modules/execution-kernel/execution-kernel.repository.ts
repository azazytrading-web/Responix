import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ExecutionKernelStatus,
  ExecutionSourceType,
  ExecutionStepStatus,
  Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  AppendExecutionEventDto,
  AppendExecutionLogDto,
  CreateExecutionRequestDto,
  CreateExecutionRunDto,
  RecordExecutionFailureDto,
  RecordExecutionStepDto,
  TransitionExecutionDto
} from "./dto/execution-kernel.dto";
import { ExecutionStateMachine } from "./execution-state-machine";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class ExecutionKernelRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: ExecutionStateMachine
  ) {}

  async createRequest(
    workspaceId: string,
    actorId: string,
    dto: CreateExecutionRequestDto
  ) {
    const payloadHash = this.hashRequest(actorId, dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.executionRequest.findFirst({
          where: { workspaceId, idempotencyKey: dto.idempotencyKey },
          select: this.requestSelect
        });
        if (existing) return this.resolveIdempotency(existing, payloadHash);
        await this.validateSourceReference(tx, workspaceId, dto.sourceType, dto.sourceReferenceId);
        this.assertPriority(dto.priority ?? 0);
        const request = await tx.executionRequest.create({
          data: {
            workspaceId, requestedById: actorId, sourceType: dto.sourceType,
            sourceReferenceId: dto.sourceReferenceId, metadata: json(dto.metadata ?? {}),
            correlationId: dto.correlationId, idempotencyKey: dto.idempotencyKey,
            payloadHash, priority: dto.priority ?? 0
          },
          select: this.requestSelect
        });
        await this.audit(tx, workspaceId, actorId, "execution.kernel.request.created", "ExecutionRequest", request.id, null, request);
        return request;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.executionRequest.findFirst({
          where: { workspaceId, idempotencyKey: dto.idempotencyKey },
          select: this.requestSelect
        });
        if (existing) return this.resolveIdempotency(existing, payloadHash);
      }
      throw error;
    }
  }

  createRun(
    workspaceId: string,
    actorId: string,
    requestId: string,
    dto: CreateExecutionRunDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.requireRequest(tx, workspaceId, requestId);
      if (dto.parentRunId) {
        const parent = await this.requireRun(tx, workspaceId, dto.parentRunId);
        if (parent.requestId !== requestId) {
          throw new BadRequestException("Parent execution run must belong to the same request");
        }
      }
      const run = await tx.executionRun.create({
        data: {
          workspaceId, requestId, parentRunId: dto.parentRunId,
          status: "REQUESTED", stateVersion: 0, eventSequence: 1,
          runtimeMetadata: json(dto.runtimeMetadata ?? {}),
          events: {
            create: {
              workspaceId, sequence: 1, eventType: "execution.run.created",
              currentStatus: "REQUESTED", actorType: "USER", actorId,
              metadata: json({})
            }
          }
        },
        select: this.runSelect
      });
      await this.audit(tx, workspaceId, actorId, "execution.kernel.run.created", "ExecutionRun", run.id, null, run);
      return run;
    });
  }

  transition(
    workspaceId: string,
    actorId: string,
    runId: string,
    dto: TransitionExecutionDto
  ) {
    if (dto.status === "FAILED") {
      throw new BadRequestException("Use the failure endpoint to transition an execution to FAILED");
    }
    if (dto.status === "CANCELLED") {
      throw new BadRequestException("Use the cancellation endpoint to transition an execution to CANCELLED");
    }
    return this.transitionMutation(workspaceId, actorId, runId, dto, "execution.kernel.state.changed");
  }

  cancel(
    workspaceId: string,
    actorId: string,
    runId: string,
    input: { expectedStateVersion?: number; reason?: string; metadata?: Record<string, unknown> }
  ) {
    return this.transitionMutation(
      workspaceId,
      actorId,
      runId,
      {
        status: "CANCELLED",
        expectedStateVersion: input.expectedStateVersion,
        message: input.reason,
        metadata: input.metadata
      },
      "execution.kernel.cancellation.requested"
    );
  }

  recordFailure(
    workspaceId: string,
    actorId: string,
    runId: string,
    dto: RecordExecutionFailureDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireRun(tx, workspaceId, runId);
      this.stateMachine.assertTransition(before.status, "FAILED");
      this.assertExpectedVersion(before.stateVersion, dto.expectedStateVersion);
      const now = new Date();
      const result = await tx.executionRun.updateMany({
        where: {
          id: runId, workspaceId, stateVersion: before.stateVersion,
          eventSequence: before.eventSequence
        },
        data: {
          status: "FAILED", stateVersion: { increment: 1 }, eventSequence: { increment: 1 },
          endedAt: now, durationMs: this.duration(before.startedAt, now),
          failureCode: dto.code, failureMessage: dto.message,
          failureMetadata: json(dto.metadata ?? {})
        }
      });
      if (result.count !== 1) throw new ConflictException("Execution state changed concurrently");
      const run = await this.requireRun(tx, workspaceId, runId);
      await tx.executionEvent.create({
        data: {
          workspaceId, runId, sequence: run.eventSequence,
          eventType: "execution.run.failed", previousStatus: before.status,
          currentStatus: "FAILED", message: dto.message, actorType: "USER",
          actorId, metadata: json({ code: dto.code, ...(dto.metadata ?? {}) })
        },
        select: this.eventSelect
      });
      await this.audit(tx, workspaceId, actorId, "execution.kernel.failure.recorded", "ExecutionRun", runId, before, run);
      return run;
    });
  }

  recordStep(
    workspaceId: string,
    actorId: string,
    runId: string,
    dto: RecordExecutionStepDto
  ) {
    this.validateStep(dto);
    return this.withUniqueStepErrors(() => this.prisma.$transaction(async (tx) => {
      const run = await this.requireRun(tx, workspaceId, runId);
      if (this.stateMachine.isTerminal(run.status)) {
        throw new ConflictException("Steps cannot be recorded after execution is terminal");
      }
      const step = await tx.executionStep.create({
        data: {
          workspaceId, runId, sequence: dto.sequence, stepType: dto.stepType,
          name: dto.name, status: dto.status,
          inputMetadata: json(dto.inputMetadata ?? {}),
          outputMetadata: json(dto.outputMetadata ?? {}),
          errorMetadata: json(dto.errorMetadata ?? {}),
          startedAt: dto.startedAt, endedAt: dto.endedAt,
          durationMs: dto.startedAt && dto.endedAt ? this.duration(dto.startedAt, dto.endedAt) : undefined,
          metadata: json(dto.metadata ?? {})
        },
        select: this.stepSelect
      });
      await this.audit(tx, workspaceId, actorId, "execution.kernel.step.recorded", "ExecutionStep", step.id, null, step);
      return step;
    }));
  }

  appendEvent(
    workspaceId: string,
    actorId: string,
    runId: string,
    dto: AppendExecutionEventDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const run = await this.requireRun(tx, workspaceId, runId);
      const result = await tx.executionRun.updateMany({
        where: { id: runId, workspaceId, eventSequence: run.eventSequence },
        data: { eventSequence: { increment: 1 } }
      });
      if (result.count !== 1) throw new ConflictException("Execution timeline changed concurrently");
      const event = await tx.executionEvent.create({
        data: {
          workspaceId, runId, sequence: run.eventSequence + 1,
          eventType: dto.eventType, message: dto.message,
          actorType: "USER", actorId, metadata: json(dto.metadata ?? {})
        },
        select: this.eventSelect
      });
      await this.audit(tx, workspaceId, actorId, "execution.kernel.event.appended", "ExecutionEvent", event.id, null, event);
      return event;
    });
  }

  appendLog(
    workspaceId: string,
    actorId: string,
    runId: string,
    dto: AppendExecutionLogDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const run = await this.requireRun(tx, workspaceId, runId);
      if (dto.stepId) {
        const step = await tx.executionStep.findFirst({
          where: { id: dto.stepId, runId, workspaceId }, select: { id: true }
        });
        if (!step) throw new NotFoundException("Execution step was not found");
      }
      const log = await tx.executionLog.create({
        data: {
          workspaceId, runId, stepId: dto.stepId, level: dto.level,
          message: dto.message, correlationId: run.request.correlationId,
          metadata: json(dto.metadata ?? {})
        },
        select: this.logSelect
      });
      await this.audit(tx, workspaceId, actorId, "execution.kernel.log.appended", "ExecutionLog", log.id, null, log);
      return log;
    });
  }

  getRequest(workspaceId: string, requestId: string) {
    return this.requireRequest(this.prisma, workspaceId, requestId, true);
  }

  getRun(workspaceId: string, runId: string) {
    return this.requireRun(this.prisma, workspaceId, runId, true);
  }

  async listRequests(input: {
    workspaceId: string; page: number; limit: number;
    sourceType?: ExecutionSourceType; correlationId?: string; requestedById?: string;
  }) {
    const where: Prisma.ExecutionRequestWhereInput = {
      workspaceId: input.workspaceId, sourceType: input.sourceType,
      correlationId: input.correlationId, requestedById: input.requestedById
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionRequest.findMany({
        where, orderBy: [{ requestedAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit, take: input.limit,
        select: this.requestSelect
      }),
      this.prisma.executionRequest.count({ where })
    ]);
    return this.page(data, total, input.page, input.limit);
  }

  async listRuns(input: {
    workspaceId: string; page: number; limit: number;
    status?: ExecutionKernelStatus; requestId?: string; correlationId?: string;
  }) {
    const where: Prisma.ExecutionRunWhereInput = {
      workspaceId: input.workspaceId, status: input.status, requestId: input.requestId,
      ...(input.correlationId ? { request: { correlationId: input.correlationId, workspaceId: input.workspaceId } } : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionRun.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit, take: input.limit,
        select: this.runSelect
      }),
      this.prisma.executionRun.count({ where })
    ]);
    return this.page(data, total, input.page, input.limit);
  }

  private readonly requestSelect = {
    id: true, workspaceId: true, requestedById: true, sourceType: true,
    sourceReferenceId: true, metadata: true, correlationId: true,
    idempotencyKey: true, payloadHash: true, priority: true,
    requestedAt: true, createdAt: true
  } as const;
  private readonly eventSelect = {
    id: true, workspaceId: true, runId: true, sequence: true, eventType: true,
    previousStatus: true, currentStatus: true, message: true, actorType: true,
    actorId: true, metadata: true, occurredAt: true, createdAt: true
  } as const;
  private readonly stepSelect = {
    id: true, workspaceId: true, runId: true, sequence: true, stepType: true,
    name: true, status: true, inputMetadata: true, outputMetadata: true,
    errorMetadata: true, startedAt: true, endedAt: true, durationMs: true,
    metadata: true, createdAt: true
  } as const;
  private readonly logSelect = {
    id: true, workspaceId: true, runId: true, stepId: true, level: true,
    message: true, correlationId: true, metadata: true, createdAt: true
  } as const;
  private readonly runSelect = {
    id: true, workspaceId: true, requestId: true, parentRunId: true,
    status: true, stateVersion: true, eventSequence: true, startedAt: true,
    endedAt: true, durationMs: true, failureCode: true, failureMessage: true,
    failureMetadata: true, runtimeMetadata: true, createdAt: true, updatedAt: true,
    request: { select: this.requestSelect }
  } as const;
  private readonly requestHistorySelect = {
    ...this.requestSelect,
    runs: { select: this.runSelect, orderBy: { createdAt: "asc" as const } }
  } as const;
  private readonly runHistorySelect = {
    ...this.runSelect,
    steps: { select: this.stepSelect, orderBy: { sequence: "asc" as const } },
    events: { select: this.eventSelect, orderBy: { sequence: "asc" as const } },
    logs: { select: this.logSelect, orderBy: { createdAt: "asc" as const } }
  } as const;

  private requireRequest(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    history = false
  ) {
    return client.executionRequest.findFirst({
      where: { id, workspaceId },
      select: history ? this.requestHistorySelect : this.requestSelect
    }).then((item) => {
      if (!item) throw new NotFoundException("Execution request was not found");
      return item;
    });
  }

  private requireRun(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    history = false
  ) {
    return client.executionRun.findFirst({
      where: { id, workspaceId, request: { workspaceId } },
      select: history ? this.runHistorySelect : this.runSelect
    }).then((item) => {
      if (!item) throw new NotFoundException("Execution run was not found");
      return item;
    });
  }

  private transitionMutation(
    workspaceId: string,
    actorId: string,
    runId: string,
    dto: TransitionExecutionDto,
    auditAction: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireRun(tx, workspaceId, runId);
      this.stateMachine.assertTransition(before.status, dto.status);
      this.assertExpectedVersion(before.stateVersion, dto.expectedStateVersion);
      const now = new Date();
      const terminal = this.stateMachine.isTerminal(dto.status);
      const startedAt = before.startedAt ??
        (["STARTING", "RUNNING"].includes(dto.status) ? now : undefined);
      const result = await tx.executionRun.updateMany({
        where: {
          id: runId, workspaceId, stateVersion: before.stateVersion,
          eventSequence: before.eventSequence
        },
        data: {
          status: dto.status, stateVersion: { increment: 1 },
          eventSequence: { increment: 1 }, startedAt,
          endedAt: terminal ? now : undefined,
          durationMs: terminal ? this.duration(startedAt ?? null, now) : undefined
        }
      });
      if (result.count !== 1) throw new ConflictException("Execution state changed concurrently");
      const run = await this.requireRun(tx, workspaceId, runId);
      await tx.executionEvent.create({
        data: {
          workspaceId, runId, sequence: run.eventSequence,
          eventType: `execution.run.${dto.status.toLowerCase()}`,
          previousStatus: before.status, currentStatus: dto.status,
          message: dto.message, actorType: "USER", actorId,
          metadata: json(dto.metadata ?? {})
        },
        select: this.eventSelect
      });
      await this.audit(tx, workspaceId, actorId, auditAction, "ExecutionRun", runId, before, run);
      return run;
    });
  }

  private async validateSourceReference(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    type: ExecutionSourceType,
    referenceId?: string
  ) {
    if (["MANUAL", "SYSTEM"].includes(type)) {
      if (referenceId) throw new BadRequestException(`${type} requests cannot have a source reference`);
      return;
    }
    if (!referenceId) throw new BadRequestException(`${type} requests require a source reference`);
    if (type === "WORKSPACE") {
      if (referenceId !== workspaceId) throw new BadRequestException("Workspace source must reference the active workspace");
      return;
    }
    const query: Record<Exclude<ExecutionSourceType, "MANUAL" | "SYSTEM" | "WORKSPACE">, () => Promise<Array<{ id: string }>>> = {
      PROFILE: () => tx.executionProfile.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } }),
      WORKFLOW: () => tx.workflow.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } }),
      AGENT: () => tx.aiAgent.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } }),
      PROMPT: () => tx.promptLibraryItem.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } }),
      KNOWLEDGE: () => tx.knowledgeDocument.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } }),
      TOOL: () => tx.toolDefinition.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } }),
      PROVIDER: () => tx.aiProviderConfiguration.findMany({ where: { id: referenceId, workspaceId, deletedAt: null }, select: { id: true } })
    };
    const referencedType = type as keyof typeof query;
    const values = await query[referencedType]();
    if (values.length !== 1) throw new BadRequestException(`${type} source must belong to the active workspace`);
  }

  private validateStep(dto: RecordExecutionStepDto) {
    if (dto.startedAt && dto.endedAt && dto.endedAt < dto.startedAt) {
      throw new BadRequestException("Execution step endedAt cannot precede startedAt");
    }
    if (dto.status === "RUNNING" && (!dto.startedAt || dto.endedAt)) {
      throw new BadRequestException("Running execution steps require startedAt and cannot have endedAt");
    }
    const terminal: ExecutionStepStatus[] = ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"];
    if (terminal.includes(dto.status) && !dto.endedAt) {
      throw new BadRequestException("Terminal execution steps require endedAt");
    }
    if (dto.status === "FAILED" && Object.keys(dto.errorMetadata ?? {}).length === 0) {
      throw new BadRequestException("Failed execution steps require error metadata");
    }
  }

  private assertExpectedVersion(actual: number, expected?: number) {
    if (expected !== undefined && actual !== expected) {
      throw new ConflictException("Execution state version is stale");
    }
  }
  private assertPriority(priority: number) {
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
      throw new BadRequestException("Execution priority must be an integer between 0 and 1000");
    }
  }
  private duration(startedAt: Date | null, endedAt: Date): number | undefined {
    return startedAt ? Math.max(0, endedAt.getTime() - startedAt.getTime()) : undefined;
  }
  private resolveIdempotency<T extends { payloadHash: string }>(existing: T, payloadHash: string): T {
    if (existing.payloadHash !== payloadHash) {
      throw new ConflictException("Idempotency key was already used with a different execution request");
    }
    return existing;
  }
  private hashRequest(actorId: string, dto: CreateExecutionRequestDto): string {
    return createHash("sha256").update(this.stableStringify({
      actorId, sourceType: dto.sourceType, sourceReferenceId: dto.sourceReferenceId ?? null,
      correlationId: dto.correlationId, priority: dto.priority ?? 0, metadata: dto.metadata ?? {}
    })).digest("hex");
  }
  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }
  private page<T>(data: T[], total: number, page: number, limit: number) {
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  private async audit(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown
  ) {
    await tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action, entityType, entityId,
      oldValues: before === null ? Prisma.JsonNull : json(before),
      newValues: after === null ? Prisma.JsonNull : json(after)
    } });
  }
  private async withUniqueStepErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Execution step sequence already exists");
      }
      throw error;
    }
  }
}
