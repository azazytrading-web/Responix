import { BadRequestException, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ExecutionKernelStatus, ExecutionSourceType, WorkflowNodeRuntimeStatus,
  WorkflowNodeType, WorkflowRuntimeStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AgentExecutionService } from "../agent-execution/agent-execution.service";
import type { ExecuteAgentExecutionDto } from "../agent-execution/dto/agent-execution.dto";
import { ExecutionKernelService } from "../execution-kernel/execution-kernel.service";
import { MemoryRuntimeService } from "../memory-runtime/memory-runtime.service";
import type { CommitMemoryWritesDto } from "../memory-runtime/dto/memory-runtime.dto";
import { StreamingRuntimeService } from "../streaming-runtime/streaming-runtime.service";
import type { CancelWorkflowExecutionDto, ExecuteWorkflowDto, ResolveApprovalDto,
  WorkflowExecutionListQueryDto } from "./dto/workflow-runtime.dto";
import { WorkflowRuntimeRepository } from "./workflow-runtime.repository";
import type { WorkflowExecutionContext, WorkflowRuntimeNode,
  WorkflowRuntimeSnapshot } from "./workflow-runtime.types";
import { WorkflowRuntimeValidator } from "./workflow-runtime.validator";

type NodeResult = { node: WorkflowRuntimeNode; nodeExecutionId: string; output: unknown;
  next: string[]; selectedBranch?: string; wait?: boolean; agentExecutionId?: string;
  streamSessionId?: string; compensation?: Record<string, unknown> };

@Injectable()
export class WorkflowRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly controllers = new Map<string, AbortController>();
  private expiryTimer?: ReturnType<typeof setInterval>;
  constructor(private readonly repository: WorkflowRuntimeRepository,
    private readonly validator: WorkflowRuntimeValidator, private readonly kernel: ExecutionKernelService,
    private readonly agents: AgentExecutionService, private readonly streams: StreamingRuntimeService,
    private readonly memory: MemoryRuntimeService) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => { void this.expireExecutions(); }, 1000);
    this.expiryTimer.unref();
  }
  onModuleDestroy() { if (this.expiryTimer) clearInterval(this.expiryTimer); }

  execute(workspaceId: string, actorId: string, dto: ExecuteWorkflowDto) {
    return this.executeInternal(workspaceId, actorId, dto, 0);
  }

  private async executeInternal(workspaceId: string, actorId: string, dto: ExecuteWorkflowDto,
    depth: number, parentExecutionId?: string, parentRunId?: string) {
    const existing = await this.repository.findByIdempotency(workspaceId, dto.idempotencyKey);
    if (existing) return existing;
    const version = await this.repository.loadVersion(workspaceId, dto.workflowVersionId);
    const snapshot = version.snapshot; this.validator.validateSnapshot(snapshot);
    this.validator.validateInput(snapshot, dto.input ?? {});
    const maxDepth = dto.maxDepth ?? 10;
    if (depth > maxDepth) throw new BadRequestException("Workflow maximum subworkflow depth exceeded");
    const traceId = dto.traceId ?? randomUUID();
    const request = await this.kernel.createRequest(workspaceId, actorId, {
      sourceType: ExecutionSourceType.WORKFLOW, sourceReferenceId: version.workflowId,
      correlationId: dto.correlationId, idempotencyKey: dto.idempotencyKey,
      metadata: { ...dto.metadata, workflowVersionId: version.id, traceId, depth }
    });
    const run = await this.kernel.createRun(workspaceId, actorId, request.id, {
      parentRunId, runtimeMetadata: { orchestrationType: "WORKFLOW", workflowVersionId: version.id, traceId }
    });
    const context = this.validator.initialContext(snapshot, dto.input ?? {}, dto.metadata ?? {});
    let execution = await this.repository.create({ workspaceId, actorId, workflowId: version.workflowId,
      versionId: version.id, requestId: request.id, runId: run.id, parentExecutionId,
      correlationId: dto.correlationId, traceId, idempotencyKey: dto.idempotencyKey, depth,
      maxDepth, maxNodeExecutions: dto.maxNodeExecutions ?? 1000, timeoutMs: dto.timeoutMs ?? 300_000,
      context, snapshotHash: version.snapshotHash, metadata: dto.metadata ?? {} });
    const controller = new AbortController(); this.controllers.set(execution.id, controller);
    const timeout = setTimeout(() => controller.abort(new Error("Workflow execution timed out")), execution.timeoutMs);
    try {
      execution = await this.repository.transition(workspaceId, actorId, execution.id, WorkflowRuntimeStatus.QUEUED);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.QUEUED,
        expectedStateVersion: run.stateVersion, message: "Workflow execution queued" });
      execution = await this.repository.transition(workspaceId, actorId, execution.id, WorkflowRuntimeStatus.PREPARING);
      const queuedRun = await this.kernel.getRun(workspaceId, run.id);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.STARTING,
        expectedStateVersion: queuedRun.stateVersion, message: "Workflow execution preparing" });
      execution = await this.repository.transition(workspaceId, actorId, execution.id, WorkflowRuntimeStatus.RUNNING);
      const startingRun = await this.kernel.getRun(workspaceId, run.id);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.RUNNING,
        expectedStateVersion: startingRun.stateVersion, message: "Workflow execution running" });
      return await this.runGraph(workspaceId, actorId, execution.id, run.id, snapshot, context,
        snapshot.nodes.filter((node) => node.type === WorkflowNodeType.START).map((node) => node.id),
        new Set<string>(), [], controller.signal);
    } catch (error) {
      return this.fail(workspaceId, actorId, execution.id, run.id, snapshot, error, controller.signal.aborted);
    } finally { clearTimeout(timeout); this.controllers.delete(execution.id); }
  }

  private async runGraph(workspaceId: string, actorId: string, executionId: string, runId: string,
    snapshot: WorkflowRuntimeSnapshot, context: WorkflowExecutionContext, initial: string[],
    completed: Set<string>, compensations: Record<string, unknown>[], signal: AbortSignal) {
    let pending = [...new Set(initial)]; let count = completed.size;
    const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
    while (pending.length) {
      this.checkSignal(signal); const execution = await this.repository.get(workspaceId, executionId);
      if (Date.now() >= execution.deadlineAt.getTime()) throw new Error("Workflow execution timed out");
      if (count + pending.length > execution.maxNodeExecutions) throw new Error("Workflow loop protection limit exceeded");
      const ready = pending.filter((key) => this.ready(key, snapshot, completed));
      if (!ready.length) throw new Error("Workflow merge synchronization deadlock detected");
      const deferred = pending.filter((key) => !ready.includes(key));
      const results = await Promise.all(ready.map(async (key) => {
        const node = byId.get(key); if (!node) throw new Error(`Workflow node ${key} was not found`);
        return this.executeWithRetry(workspaceId, actorId, executionId, runId, snapshot, node,
          structuredClone(context), execution.depth, execution.maxDepth, signal);
      }));
      const next = [...deferred];
      for (const result of results) {
        count += 1;
        if (result.wait) {
          await this.repository.saveProgress(workspaceId, actorId, executionId, context,
            [result.node.id], [...completed], undefined, compensations);
          await this.repository.transition(workspaceId, actorId, executionId, WorkflowRuntimeStatus.WAITING,
            `Approval required at ${result.node.id}`);
          const currentRun = await this.kernel.getRun(workspaceId, runId);
          await this.kernel.transition(workspaceId, actorId, runId, { status: ExecutionKernelStatus.PAUSED,
            expectedStateVersion: currentRun.stateVersion, message: "Workflow waiting for approval" });
          return this.repository.get(workspaceId, executionId);
        }
        completed.add(result.node.id); context.nodes[result.node.id] = result.output;
        if (result.node.type === WorkflowNodeType.VARIABLE) this.applyVariable(result.node, result.output, context);
        if (result.compensation) compensations.push(result.compensation);
        next.push(...result.next);
      }
      pending = [...new Set(next.filter((key) => !completed.has(key)))];
      await this.repository.saveProgress(workspaceId, actorId, executionId, context, pending,
        [...completed], undefined, compensations);
    }
    context.output = this.buildOutput(snapshot, context);
    await this.commitDeferredMemory(workspaceId, actorId, compensations, runId);
    await this.repository.saveProgress(workspaceId, actorId, executionId, context, [], [...completed],
      context.output, compensations);
    const finished = await this.repository.transition(workspaceId, actorId, executionId,
      WorkflowRuntimeStatus.COMPLETED, "Workflow graph completed");
    const kernelRun = await this.kernel.getRun(workspaceId, runId);
    await this.kernel.transition(workspaceId, actorId, runId, { status: ExecutionKernelStatus.SUCCEEDED,
      expectedStateVersion: kernelRun.stateVersion, message: "Workflow execution completed",
      metadata: { workflowExecutionId: executionId, traceId: finished.traceId } });
    return finished;
  }

  private async executeWithRetry(workspaceId: string, actorId: string, executionId: string,
    runId: string, snapshot: WorkflowRuntimeSnapshot, node: WorkflowRuntimeNode,
    context: WorkflowExecutionContext, depth: number, maxDepth: number, signal: AbortSignal): Promise<NodeResult> {
    const retry = this.record(node.configuration?.retry); const maxAttempts = Number(retry.maxAttempts ?? 1);
    const delayMs = Number(retry.delayMs ?? 0); const multiplier = Number(retry.backoffMultiplier ?? 1);
    let last: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.checkSignal(signal); const record = await this.repository.startNode(workspaceId, actorId,
        executionId, { id: node.id, type: node.type }, attempt, context);
      try {
        const result = await this.executeNodeWithinTimeout(workspaceId, actorId, executionId, runId,
          snapshot, node, context, depth, maxDepth, signal, record.id);
        await this.repository.finishNode(workspaceId, actorId, record.id,
          result.wait ? WorkflowNodeRuntimeStatus.WAITING : WorkflowNodeRuntimeStatus.COMPLETED,
          result.output, { selectedBranch: result.selectedBranch,
            agentExecutionId: result.agentExecutionId, streamSessionId: result.streamSessionId });
        return { ...result, nodeExecutionId: record.id };
      } catch (error) {
        last = error; const retrying = attempt < maxAttempts;
        const wait = Math.round(delayMs * Math.pow(multiplier, attempt - 1));
        await this.repository.finishNode(workspaceId, actorId, record.id,
          WorkflowNodeRuntimeStatus.FAILED, {}, { error: this.error(error), retryDelayMs: retrying ? wait : 0 });
        await this.repository.diagnostic(workspaceId, actorId, executionId, { nodeKey: node.id,
          severity: retrying ? "WARNING" : "ERROR", code: retrying ? "NODE_RETRY" : "NODE_FAILED",
          message: error instanceof Error ? error.message : "Workflow node failed",
          metadata: { attempt, maxAttempts, retryDelayMs: retrying ? wait : 0 } });
        if (retrying) await this.delay(wait, signal);
      }
    }
    throw last;
  }

  private async executeNode(workspaceId: string, actorId: string, executionId: string, runId: string,
    snapshot: WorkflowRuntimeSnapshot, node: WorkflowRuntimeNode, context: WorkflowExecutionContext,
    depth: number, maxDepth: number, signal: AbortSignal, nodeExecutionId: string): Promise<Omit<NodeResult,"nodeExecutionId">> {
    const outgoing = snapshot.edges.filter((edge) => edge.sourceNodeId === node.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((edge) => edge.targetNodeId);
    const base = { node, output: {}, next: outgoing };
    if (node.type === WorkflowNodeType.START || node.type === WorkflowNodeType.END ||
      node.type === WorkflowNodeType.PARALLEL || node.type === WorkflowNodeType.MERGE) return base;
    if (node.type === WorkflowNodeType.DELAY) {
      await this.delay(Number(node.configuration?.delayMs ?? 0), signal); return { ...base, output: { delayed: true } };
    }
    if (node.type === WorkflowNodeType.APPROVAL) return { ...base, output: { requestedAt: new Date().toISOString() }, next: [], wait: true };
    if (node.type === WorkflowNodeType.CONDITION || node.type === WorkflowNodeType.DECISION) {
      const branch = snapshot.branches.filter((item) => item.nodeId === node.id)
        .find((item) => this.validator.evaluate(item.condition, context));
      if (!branch) throw new Error(`No condition branch matched node ${node.id}`);
      return { ...base, output: { branch: branch.key }, next: [branch.targetNodeId], selectedBranch: branch.key };
    }
    if (node.type === WorkflowNodeType.VARIABLE) {
      const assignment = this.record(node.configuration?.assignment);
      if (typeof assignment.key !== "string") throw new Error(`Variable node ${node.id} requires assignment.key`);
      const value = this.validator.resolve(assignment.value, context);
      return { ...base, output: { key: assignment.key, scope: assignment.scope ?? "global", value } };
    }
    if (node.type === WorkflowNodeType.AGENT) {
      const execution = this.validator.resolve(node.configuration?.execution, context) as ExecuteAgentExecutionDto;
      const memoryWrites = execution.memoryWrites ?? []; const stream = node.configuration?.stream === true;
      const dto = { ...execution, memoryWrites: undefined, parentExecutionRunId: runId,
        correlationId: `${execution.correlationId ?? executionId}:${node.id}`,
        idempotencyKey: `${execution.idempotencyKey ?? executionId}:${node.id}:${nodeExecutionId}` };
      if (stream) {
        const session = await this.agents.stream(workspaceId, actorId, dto);
        const terminal = await this.awaitStream(workspaceId, session.id, signal);
        if (terminal.status !== "COMPLETED") throw new Error(`Agent stream ${terminal.status}`);
        return { ...base, output: { streamSessionId: session.id, status: terminal.status },
          streamSessionId: session.id, compensation: { nodeKey: node.id,
            compensation: node.configuration?.compensation, memoryWrites } };
      }
      const result = await this.agents.execute(workspaceId, actorId, dto);
      return { ...base, output: result, agentExecutionId: result.executionId,
        compensation: { nodeKey: node.id, compensation: node.configuration?.compensation, memoryWrites } };
    }
    if (node.type === WorkflowNodeType.SUBFLOW || node.type === WorkflowNodeType.SUBWORKFLOW) {
      const versionId = String(node.configuration?.workflowVersionId);
      const child = await this.executeInternal(workspaceId, actorId, { workflowVersionId: versionId,
        correlationId: `${executionId}:${node.id}`, idempotencyKey: `${executionId}:${node.id}`,
        traceId: (await this.repository.get(workspaceId, executionId)).traceId,
        input: this.validator.resolve(node.configuration?.input ?? {}, context) as Record<string, unknown>,
        timeoutMs: Number(node.configuration?.timeoutMs ?? 300_000), maxDepth,
        maxNodeExecutions: Number(node.configuration?.maxNodeExecutions ?? 1000) }, depth + 1,
        executionId, runId);
      if (child.status !== WorkflowRuntimeStatus.COMPLETED && child.status !== WorkflowRuntimeStatus.COMPENSATED) {
        throw new Error(`Subworkflow ended in ${child.status}`);
      }
      return { ...base, output: child.output };
    }
    throw new Error(`Unsupported workflow node type ${node.type}`);
  }

  private async executeNodeWithinTimeout(workspaceId: string, actorId: string, executionId: string,
    runId: string, snapshot: WorkflowRuntimeSnapshot, node: WorkflowRuntimeNode,
    context: WorkflowExecutionContext, depth: number, maxDepth: number, parentSignal: AbortSignal,
    nodeExecutionId: string) {
    const controller = new AbortController();
    const propagate = () => controller.abort(this.abortError(parentSignal));
    parentSignal.addEventListener("abort", propagate, { once: true });
    const timeoutMs = Number(node.configuration?.timeoutMs ?? 300_000);
    const timer = setTimeout(() => controller.abort(new Error(`Workflow node ${node.id} timed out`)), timeoutMs);
    try {
      return await this.executeNode(workspaceId, actorId, executionId, runId, snapshot, node,
        context, depth, maxDepth, controller.signal, nodeExecutionId);
    } finally {
      clearTimeout(timer); parentSignal.removeEventListener("abort", propagate);
    }
  }

  async resolveApproval(workspaceId: string, actorId: string, id: string, dto: ResolveApprovalDto) {
    const execution = await this.repository.get(workspaceId, id);
    if (execution.status !== WorkflowRuntimeStatus.WAITING || execution.pendingNodeKeys.length !== 1) {
      throw new BadRequestException("Workflow execution is not waiting for one approval");
    }
    const nodeKey = execution.pendingNodeKeys[0]!;
    const pending = [...execution.nodes].reverse().find((node) => node.nodeKey === nodeKey && node.status === "WAITING");
    if (!pending) throw new BadRequestException("Pending approval node was not found");
    if (!dto.approved) {
      await this.repository.finishNode(workspaceId, actorId, pending.id, WorkflowNodeRuntimeStatus.FAILED,
        {}, { error: { reason: dto.reason ?? "Approval rejected" } });
      return this.fail(workspaceId, actorId, id, execution.executionRunId,
        (await this.repository.loadVersion(workspaceId, execution.workflowVersionId)).snapshot,
        new Error(dto.reason ?? "Workflow approval rejected"), false);
    }
    await this.repository.finishNode(workspaceId, actorId, pending.id, WorkflowNodeRuntimeStatus.COMPLETED,
      dto.output ?? { approved: true });
    const snapshot = (await this.repository.loadVersion(workspaceId, execution.workflowVersionId)).snapshot;
    const context = execution.runtimeContext as unknown as WorkflowExecutionContext;
    context.nodes[nodeKey] = dto.output ?? { approved: true };
    const next = snapshot.edges.filter((edge) => edge.sourceNodeId === nodeKey).map((edge) => edge.targetNodeId);
    const completed = new Set([...execution.completedNodeKeys, nodeKey]);
    await this.repository.transition(workspaceId, actorId, id, WorkflowRuntimeStatus.RUNNING, "Approval granted");
    const kernelRun = await this.kernel.getRun(workspaceId, execution.executionRunId);
    await this.kernel.transition(workspaceId, actorId, execution.executionRunId, { status: ExecutionKernelStatus.RUNNING,
      expectedStateVersion: kernelRun.stateVersion, message: "Workflow approval granted" });
    const controller = new AbortController(); this.controllers.set(id, controller);
    const timeout = setTimeout(() => controller.abort(new Error("Workflow execution timed out")),
      Math.max(1, execution.deadlineAt.getTime() - Date.now()));
    try { return await this.runGraph(workspaceId, actorId, id, execution.executionRunId, snapshot,
      context, next, completed, execution.compensationPlan as Record<string, unknown>[], controller.signal); }
    catch (error) { return this.fail(workspaceId, actorId, id, execution.executionRunId, snapshot, error, controller.signal.aborted); }
    finally { clearTimeout(timeout); this.controllers.delete(id); }
  }

  async cancel(workspaceId: string, actorId: string, id: string, dto: CancelWorkflowExecutionDto) {
    const execution = await this.repository.get(workspaceId, id);
    if (["COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT", "COMPENSATED"].includes(execution.status)) return execution;
    this.controllers.get(id)?.abort(new DOMException(dto.reason ?? "Workflow cancelled", "AbortError"));
    const run = await this.kernel.getRun(workspaceId, execution.executionRunId);
    await this.kernel.cancel(workspaceId, actorId, run.id, { expectedStateVersion: run.stateVersion, reason: dto.reason });
    return this.repository.transition(workspaceId, actorId, id, WorkflowRuntimeStatus.CANCELLED,
      dto.reason, { cancellationReason: dto.reason ?? "Cancelled" });
  }

  private async fail(workspaceId: string, actorId: string, id: string, runId: string,
    snapshot: WorkflowRuntimeSnapshot, error: unknown, aborted: boolean) {
    const current = await this.repository.get(workspaceId, id);
    if (current.status === WorkflowRuntimeStatus.CANCELLED) return current;
    const message = error instanceof Error ? error.message : "Workflow execution failed";
    const timedOut = aborted && /timed out/i.test(message);
    await this.repository.diagnostic(workspaceId, actorId, id, { severity: "ERROR",
      code: timedOut ? "WORKFLOW_TIMEOUT" : "WORKFLOW_FAILURE", message });
    const compensated = await this.compensate(workspaceId, actorId, id, runId, snapshot,
      current.compensationPlan as Record<string, unknown>[]);
    const status = compensated ? WorkflowRuntimeStatus.COMPENSATED : timedOut ?
      WorkflowRuntimeStatus.TIMED_OUT : WorkflowRuntimeStatus.FAILED;
    const run = await this.kernel.getRun(workspaceId, runId);
    if (!['FAILED','CANCELLED','TIMED_OUT','SUCCEEDED'].includes(run.status)) {
      if (timedOut) await this.kernel.transition(workspaceId, actorId, runId, { status: ExecutionKernelStatus.TIMED_OUT,
        expectedStateVersion: run.stateVersion, message });
      else await this.kernel.recordFailure(workspaceId, actorId, runId, { code: "WORKFLOW_EXECUTION_FAILED",
        message, expectedStateVersion: run.stateVersion });
    }
    const baseStatus = timedOut ? WorkflowRuntimeStatus.TIMED_OUT : WorkflowRuntimeStatus.FAILED;
    let failed = await this.repository.transition(workspaceId, actorId, id, baseStatus, message,
      { failureCode: timedOut ? "WORKFLOW_TIMEOUT" : "WORKFLOW_EXECUTION_FAILED", failureMessage: message });
    if (status === WorkflowRuntimeStatus.COMPENSATED) failed = await this.repository.transition(workspaceId,
      actorId, id, WorkflowRuntimeStatus.COMPENSATED, "Workflow compensation completed");
    return failed;
  }

  private async compensate(workspaceId: string, actorId: string, executionId: string, runId: string,
    _snapshot: WorkflowRuntimeSnapshot, plans: Record<string, unknown>[]) {
    const runnable = [...plans].reverse().filter((plan) => this.record(plan.compensation));
    if (!runnable.length) return false;
    for (const plan of runnable) {
      const dto = this.record(plan.compensation) as unknown as ExecuteAgentExecutionDto;
      await this.agents.execute(workspaceId, actorId, { ...dto, parentExecutionRunId: runId,
        correlationId: `${executionId}:compensate:${String(plan.nodeKey)}`,
        idempotencyKey: `${executionId}:compensate:${String(plan.nodeKey)}` });
    }
    return true;
  }

  private async commitDeferredMemory(workspaceId: string, actorId: string,
    plans: Record<string, unknown>[], runId: string) {
    const writes: CommitMemoryWritesDto[] = plans.flatMap((plan) => Array.isArray(plan.memoryWrites) ?
      plan.memoryWrites.filter((write): write is CommitMemoryWritesDto => this.isMemoryWrite(write)) : []);
    if (writes.length) await this.memory.commitWrites(workspaceId, actorId,
      writes.map((write) => ({ ...write, executionRunId: runId })));
  }
  private async expireExecutions() {
    const expired = await this.repository.expired();
    await Promise.allSettled(expired.map(async (execution) => {
      const version = await this.repository.loadVersion(execution.workspaceId, execution.workflowVersionId);
      await this.fail(execution.workspaceId, execution.createdById, execution.id,
        execution.executionRunId, version.snapshot, new Error("Workflow execution timed out"), true);
    }));
  }
  private applyVariable(node: WorkflowRuntimeNode, output: unknown, context: WorkflowExecutionContext) {
    const value = this.record(output); const key = String(value.key); const scope = value.scope;
    if (scope === "output") context.output[key] = value.value;
    else if (scope === "node") context.nodes[node.id] = value.value;
    else context.globals[key] = value.value;
  }
  private buildOutput(snapshot: WorkflowRuntimeSnapshot, context: WorkflowExecutionContext) {
    return Object.fromEntries(snapshot.outputs.map((output) => [output.name,
      context.output[output.name] ?? context.globals[output.name] ?? context.nodes[output.name]]));
  }
  private ready(key: string, snapshot: WorkflowRuntimeSnapshot, completed: Set<string>) {
    const node = snapshot.nodes.find((item) => item.id === key);
    if (node?.type !== WorkflowNodeType.MERGE) return true;
    const inbound = snapshot.edges.filter((edge) => edge.targetNodeId === key).map((edge) => edge.sourceNodeId);
    return inbound.every((source) => completed.has(source));
  }
  private async awaitStream(workspaceId: string, id: string, signal: AbortSignal) {
    for (;;) { this.checkSignal(signal); const value = await this.streams.get(workspaceId, id);
      if (["COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT"].includes(value.status)) return value;
      await this.delay(25, signal); }
  }
  private delay(ms: number, signal: AbortSignal) { return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(this.abortError(signal));
    const timer = setTimeout(resolve, ms); signal.addEventListener("abort", () => {
      clearTimeout(timer); reject(this.abortError(signal));
    }, { once: true });
  }); }
  private abortError(signal: AbortSignal) {
    return signal.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError");
  }
  private isMemoryWrite(value: unknown): value is CommitMemoryWritesDto {
    const write = this.record(value);
    return typeof write.runtimeId === "string" && typeof write.content === "object" &&
      Number.isInteger(write.expectedStateVersion);
  }
  private checkSignal(signal: AbortSignal) { if (signal.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError"); }
  private record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private error(value: unknown) { return { message: value instanceof Error ? value.message : String(value) }; }
  get(workspaceId: string, id: string) { return this.repository.get(workspaceId, id); }
  list(workspaceId: string, query: WorkflowExecutionListQueryDto) { return this.repository.list(workspaceId, query); }
  history(workspaceId: string, id: string) { return this.repository.history(workspaceId, id); }
  diagnostics(workspaceId: string, id: string) { return this.repository.diagnostics(workspaceId, id); }
  metrics(workspaceId: string, id: string) { return this.repository.metrics(workspaceId, id); }
}
