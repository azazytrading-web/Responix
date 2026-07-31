import { BadRequestException, ForbiddenException, Injectable, type OnModuleDestroy,
  type OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { ExecutionKernelStatus, ExecutionSourceType, ToolAttemptStatus,
  ToolExecutionMode, ToolRuntimeStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ReplaySubject } from "rxjs";
import { AgentExecutionService } from "../agent-execution/agent-execution.service";
import type { ExecuteAgentExecutionDto } from "../agent-execution/dto/agent-execution.dto";
import { ProviderHttpClient } from "../ai/security/provider-http-client.service";
import { ExecutionKernelService } from "../execution-kernel/execution-kernel.service";
import { MemoryRuntimeService } from "../memory-runtime/memory-runtime.service";
import { PermissionResolutionService } from "../platform-control/permission-resolution.service";
import { RetrievalExecutionService } from "../retrieval-execution/retrieval-execution.service";
import { RuntimeOptimizationService } from "../runtime-optimization/runtime-optimization.service";
import { ToolRegistryService } from "../tool-registry/tool-registry.service";
import { WorkflowRuntimeService } from "../workflow-runtime/workflow-runtime.service";
import type { ExecuteToolDto, ToolExecutionListQueryDto } from "./dto/tool-runtime.dto";
import { ToolInternalExecutorRegistry } from "./tool-internal-executor.registry";
import { ToolPolicyValidator, type ResolvedToolPolicy } from "./tool-policy.validator";
import { ToolRuntimeRepository } from "./tool-runtime.repository";
import type { ProviderNeutralToolContract, ToolExecutionContext, ToolExecutorResult,
  ToolRuntimeSnapshot } from "./tool-runtime.types";
import { ToolRuntimeValidator } from "./tool-runtime.validator";

type ToolEvent = { id: string; event: string; data: unknown };
class ToolHttpStatusError extends Error { constructor(readonly status: number) { super(`Tool HTTP request failed with status ${status}`); } }

@Injectable()
export class ToolRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly controllers = new Map<string, AbortController>();
  private readonly subjects = new Map<string, ReplaySubject<ToolEvent>>();
  private readonly rateWindows = new Map<string, number[]>();
  private expiryTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly repository: ToolRuntimeRepository,
    private readonly registry: ToolRegistryService, private readonly validator: ToolRuntimeValidator,
    private readonly policies: ToolPolicyValidator, private readonly executors: ToolInternalExecutorRegistry,
    private readonly kernel: ExecutionKernelService, private readonly http: ProviderHttpClient,
    private readonly permissions: PermissionResolutionService, private readonly memory: MemoryRuntimeService,
    private readonly retrieval: RetrievalExecutionService, private readonly optimization: RuntimeOptimizationService,
    private readonly moduleRef: ModuleRef) {}

  onModuleInit() { this.expiryTimer = setInterval(() => { void this.expire(); }, 1000); this.expiryTimer.unref(); }
  onModuleDestroy() { if (this.expiryTimer) clearInterval(this.expiryTimer); }

  async execute(workspaceId: string, actorId: string, dto: ExecuteToolDto) {
    const existing = await this.repository.findByIdempotency(workspaceId, dto.idempotencyKey);
    if (existing) return existing;
    const version = await this.registry.publishedVersion(workspaceId, dto.toolVersionId);
    const snapshot = version.snapshot as unknown as ToolRuntimeSnapshot;
    this.validator.validateSnapshot(snapshot); this.validator.assertCompatibility(snapshot);
    await this.assertPermissions(workspaceId, actorId, snapshot);
    const normalizedInput = this.validator.normalizeInput(snapshot, dto.input);
    const policy = this.policies.resolve(snapshot);
    const timeoutMs = Math.min(dto.timeoutMs ?? policy.maximumExecutionMs, policy.maximumExecutionMs);
    const traceId = dto.traceId ?? randomUUID();
    const request = await this.kernel.createRequest(workspaceId, actorId, {
      sourceType: ExecutionSourceType.TOOL, sourceReferenceId: version.toolId,
      correlationId: dto.correlationId, idempotencyKey: dto.idempotencyKey,
      metadata: { ...dto.metadata, toolVersionId: version.id, traceId }
    });
    const run = await this.kernel.createRun(workspaceId, actorId, request.id, {
      parentRunId: dto.parentExecutionRunId, runtimeMetadata: { orchestrationType: "TOOL",
        toolVersionId: version.id, traceId }
    });
    const context: ToolExecutionContext = { workspaceId, actorId, executionId: "pending",
      executionRunId: run.id, correlationId: dto.correlationId, traceId, input: normalizedInput,
      promptVariables: structuredClone(dto.promptVariables ?? {}), metadata: structuredClone(dto.metadata ?? {}) };
    let execution = await this.repository.create({ workspaceId, actorId, toolId: version.toolId,
      toolVersionId: version.id, requestId: request.id, runId: run.id,
      parentExecutionId: dto.parentExecutionId, parentRunId: dto.parentExecutionRunId,
      correlationId: dto.correlationId, traceId, idempotencyKey: dto.idempotencyKey,
      mode: dto.mode ?? ToolExecutionMode.SYNC, rawInput: dto.input, normalizedInput,
      context, snapshot, snapshotHash: version.snapshotHash, policy, timeoutMs, metadata: dto.metadata ?? {} });
    context.executionId = execution.id;
    const controller = new AbortController(); this.controllers.set(execution.id, controller);
    this.subjects.set(execution.id, new ReplaySubject<ToolEvent>(256));
    const timer = setTimeout(() => controller.abort(new Error("Tool execution timed out")), timeoutMs);
    try {
      execution = await this.repository.transition(workspaceId, actorId, execution.id, ToolRuntimeStatus.QUEUED);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.QUEUED,
        expectedStateVersion: run.stateVersion, message: "Tool execution queued" });
      execution = await this.repository.transition(workspaceId, actorId, execution.id, ToolRuntimeStatus.PREPARING);
      const queued = await this.kernel.getRun(workspaceId, run.id);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.STARTING,
        expectedStateVersion: queued.stateVersion, message: "Tool execution preparing" });
      if (dto.retrieval) context.retrieval = await this.retrieval.execute(workspaceId, actorId, {
        retrievalRuntimeSnapshotId: dto.retrieval.retrievalRuntimeSnapshotId, query: dto.retrieval.query,
        topK: dto.retrieval.topK, maxTokens: dto.retrieval.tokenBudget,
        executionRequestId: request.id, executionRunId: run.id,
        metadata: { toolExecutionId: execution.id }
      }, controller.signal);
      await this.optimization.createContext(workspaceId, actorId, { immutableMetadata: {
        toolVersionId: version.id, toolSnapshotHash: version.snapshotHash, toolCompatibilityVersion: version.compatibilityVersion
      } });
      execution = await this.repository.transition(workspaceId, actorId, execution.id, ToolRuntimeStatus.RUNNING);
      const starting = await this.kernel.getRun(workspaceId, run.id);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.RUNNING,
        expectedStateVersion: starting.stateVersion, message: "Tool execution running" });
      if ((dto.mode ?? ToolExecutionMode.SYNC) === ToolExecutionMode.STREAM) {
        execution = await this.repository.transition(workspaceId, actorId, execution.id, ToolRuntimeStatus.STREAMING);
        this.emit(execution.id, "started", execution);
      }
      const result = await this.executeWithRetry(snapshot, policy, context, version.id,
        dto, controller.signal);
      this.validator.validateOutput(snapshot, result.output);
      for (const partial of result.partialOutputs ?? []) {
        await this.repository.saveOutput(workspaceId, actorId, execution.id, partial, true);
        this.emit(execution.id, "partial", partial);
      }
      await this.repository.saveOutput(workspaceId, actorId, execution.id, result.output);
      if (dto.memoryWrites?.length) await this.memory.commitWrites(workspaceId, actorId,
        dto.memoryWrites.map((write) => ({ ...write, executionRunId: run.id })));
      execution = await this.repository.transition(workspaceId, actorId, execution.id, ToolRuntimeStatus.COMPLETED,
        "Tool completed");
      const kernelRun = await this.kernel.getRun(workspaceId, run.id);
      await this.kernel.transition(workspaceId, actorId, run.id, { status: ExecutionKernelStatus.SUCCEEDED,
        expectedStateVersion: kernelRun.stateVersion, message: "Tool execution completed",
        metadata: { toolExecutionId: execution.id, traceId } });
      this.close(execution.id, "completed", execution); return execution;
    } catch (error) {
      return this.fail(workspaceId, actorId, execution.id, run.id, error, controller.signal.aborted);
    } finally { clearTimeout(timer); this.controllers.delete(execution.id); }
  }

  private async executeWithRetry(snapshot: ToolRuntimeSnapshot, policy: ResolvedToolPolicy,
    context: ToolExecutionContext, versionId: string, dto: ExecuteToolDto, signal: AbortSignal) {
    const retry = this.record(snapshot.retryPolicyMetadata); const attempts = this.integer(retry.maxAttempts, 1, 1, 10);
    const delayMs = this.integer(retry.delayMs, 0, 0, 300_000);
    const multiplier = this.number(retry.backoffMultiplier, 1, 1, 10); let last: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      this.check(signal); this.rateLimit(context.workspaceId, versionId, policy);
      const record = await this.repository.startAttempt(context.workspaceId, context.actorId,
        context.executionId, attempt, context.input); const started = Date.now();
      try {
        const result = await this.dispatch(snapshot, policy, context, dto, signal);
        await this.repository.finishAttempt(context.workspaceId, context.actorId, record.id,
          ToolAttemptStatus.COMPLETED, result.output, { responseBytes: result.responseBytes,
            transportDurationMs: Date.now() - started });
        return result;
      } catch (error) {
        last = error; const retrying = attempt < attempts && this.retryable(error);
        const wait = Math.round(delayMs * Math.pow(multiplier, attempt - 1));
        const status = signal.aborted ? (/timed out/i.test(this.message(error)) ?
          ToolAttemptStatus.TIMED_OUT : ToolAttemptStatus.CANCELLED) : ToolAttemptStatus.FAILED;
        await this.repository.finishAttempt(context.workspaceId, context.actorId, record.id, status,
          undefined, { error: { message: this.message(error) }, retryDelayMs: retrying ? wait : 0,
            transportDurationMs: Date.now() - started });
        await this.repository.diagnostic(context.workspaceId, context.actorId, context.executionId,
          { attempt, severity: retrying ? "WARNING" : "ERROR", code: retrying ? "TOOL_RETRY" : "TOOL_ATTEMPT_FAILED",
            message: this.message(error), metadata: { retryDelayMs: retrying ? wait : 0 } });
        if (!retrying) break;
        await this.delay(wait, signal);
      }
    }
    throw last;
  }

  private dispatch(snapshot: ToolRuntimeSnapshot, policy: ResolvedToolPolicy,
    context: ToolExecutionContext, dto: ExecuteToolDto, signal: AbortSignal): Promise<ToolExecutorResult> {
    if (["HTTP", "REST", "WEBHOOK", "OPENAPI"].includes(snapshot.type)) return this.httpExecute(snapshot, policy, context, signal);
    if (["INTERNAL", "INTERNAL_SERVICE", "FUNCTION", "DATABASE", "FILE", "STORAGE"].includes(snapshot.type)) {
      const handler = String(snapshot.providerMetadata.handler ?? snapshot.providerMetadata.service ?? snapshot.providerMetadata.function);
      return this.executors.resolve(handler).execute(context, signal);
    }
    if (snapshot.type === "WORKFLOW") return this.workflowExecute(snapshot, context, signal);
    if (snapshot.type === "AGENT") return this.agentExecute(snapshot, context, signal);
    if (snapshot.type === "COMPOSITE") return this.compositeExecute(snapshot, context, dto, signal);
    if (snapshot.type === "MCP") throw new BadRequestException("MCP execution requires a future connector adapter");
    throw new BadRequestException(`Tool type ${snapshot.type} is unsupported`);
  }

  private async httpExecute(snapshot: ToolRuntimeSnapshot, policy: ResolvedToolPolicy,
    context: ToolExecutionContext, signal: AbortSignal): Promise<ToolExecutorResult> {
    let endpoint = this.text(snapshot.providerMetadata.endpoint, "Tool endpoint");
    const rawMethod = snapshot.providerMetadata.method;
    const method = (rawMethod === undefined ? (snapshot.type === "WEBHOOK" ? "POST" : "GET") :
      this.text(rawMethod, "Tool HTTP method")).toUpperCase();
    const query = new URLSearchParams(); const headers: Record<string, string> = {};
    const bodies: Record<string, unknown> = {};
    for (const parameter of [...snapshot.parameters].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
      const value = context.input[parameter.name]; if (value === undefined) continue;
      if (parameter.location === "PATH") endpoint = endpoint.replaceAll(`{${parameter.name}}`, encodeURIComponent(this.scalar(value, parameter.name)));
      else if (parameter.location === "QUERY") query.append(parameter.name, this.scalar(value, parameter.name));
      else if (parameter.location === "HEADER") headers[parameter.name] = this.scalar(value, parameter.name);
      else if (parameter.location === "BODY") bodies[parameter.name] = value;
    }
    const url = new URL(endpoint); for (const [key, value] of query) url.searchParams.append(key, value);
    const contentType = snapshot.providerMetadata.contentType === undefined ? "application/json" :
      this.text(snapshot.providerMetadata.contentType, "Tool content type");
    let body: string | Buffer | undefined;
    if (method !== "GET" && method !== "DELETE") {
      if (contentType === "application/octet-stream") {
        const binary = Object.values(bodies)[0]; if (typeof binary !== "string") throw new BadRequestException("Binary tool body must be base64 text");
        body = Buffer.from(binary, "base64");
      } else if (contentType.startsWith("multipart/form-data")) {
        const boundary = `responix-${randomUUID()}`; headers["content-type"] = `multipart/form-data; boundary=${boundary}`;
        body = Object.entries(bodies).map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${this.scalar(value, key)}\r\n`).join("") + `--${boundary}--\r\n`;
      } else body = JSON.stringify(bodies);
    }
    this.policies.validateHttp(snapshot, method, url.toString(), headers, headers["content-type"] ?? contentType, policy);
    const response = await this.http.request({ label: `Tool:${snapshot.slug}`, url: url.toString(),
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE", headers, body,
      contentType: headers["content-type"] ?? contentType,
      responseType: snapshot.providerMetadata.responseType === "binary" ? "binary" : "text",
      maximumResponseBytes: policy.maximumResponseBytes, signal });
    if (response.status < 200 || response.status >= 300) throw new ToolHttpStatusError(response.status);
    const responseType = snapshot.providerMetadata.responseType;
    let output: unknown = { body: response.body, encoding: response.encoding, status: response.status };
    if (responseType === "json" || (!responseType && this.header(response.headers, "content-type")?.includes("json"))) {
      try { output = JSON.parse(response.body) as unknown; }
      catch { throw new BadRequestException("Tool returned invalid JSON"); }
    }
    return { output, responseBytes: response.bytes, metadata: { status: response.status } };
  }

  private async workflowExecute(snapshot: ToolRuntimeSnapshot, context: ToolExecutionContext, signal: AbortSignal) {
    this.check(signal); const workflows = this.moduleRef.get(WorkflowRuntimeService, { strict: false });
    const result = await workflows.execute(context.workspaceId, context.actorId, {
      workflowVersionId: String(snapshot.providerMetadata.workflowVersionId), input: context.input,
      correlationId: `${context.correlationId}:workflow`, idempotencyKey: `${context.executionId}:workflow`,
      traceId: context.traceId, parentExecutionId: context.executionId,
      parentExecutionRunId: context.executionRunId
    });
    return { output: result.output ?? result };
  }

  private async agentExecute(snapshot: ToolRuntimeSnapshot, context: ToolExecutionContext, signal: AbortSignal) {
    this.check(signal); const agents = this.moduleRef.get(AgentExecutionService, { strict: false });
    const configured = this.record(snapshot.providerMetadata.execution) as unknown as ExecuteAgentExecutionDto;
    const result = await agents.execute(context.workspaceId, context.actorId, { ...configured,
      staticVariables: { ...configured.staticVariables, toolInput: context.input,
        retrieval: context.retrieval, ...context.promptVariables }, parentExecutionRunId: context.executionRunId,
      correlationId: `${context.correlationId}:agent`, idempotencyKey: `${context.executionId}:agent` });
    return { output: result };
  }

  private async compositeExecute(snapshot: ToolRuntimeSnapshot, context: ToolExecutionContext,
    dto: ExecuteToolDto, signal: AbortSignal): Promise<ToolExecutorResult> {
    const configured = Array.isArray(snapshot.providerMetadata.steps) ? snapshot.providerMetadata.steps :
      (snapshot.providerMetadata.toolVersionIds as string[]).map((toolVersionId) => ({ toolVersionId }));
    let previous: unknown; const outputs: unknown[] = [];
    for (let index = 0; index < configured.length; index += 1) {
      this.check(signal); const step = this.record(configured[index]); const toolVersionId = String(step.toolVersionId);
      const input = this.resolve(step.input ?? context.input, previous) as Record<string, unknown>;
      const child = await this.execute(context.workspaceId, context.actorId, { toolVersionId, input,
        correlationId: `${context.correlationId}:step:${index}`, idempotencyKey: `${context.executionId}:step:${index}`,
        traceId: context.traceId, parentExecutionId: context.executionId,
        parentExecutionRunId: context.executionRunId, mode: ToolExecutionMode.SYNC,
        promptVariables: dto.promptVariables, metadata: { compositeIndex: index } });
      if (child.status !== ToolRuntimeStatus.COMPLETED) throw new Error(`Composite tool step ${index} ended in ${child.status}`);
      previous = child.output; outputs.push(previous);
    }
    return { output: previous ?? {}, partialOutputs: outputs };
  }

  async cancel(workspaceId: string, actorId: string, id: string, reason?: string) {
    const execution = await this.repository.get(workspaceId, id);
    if (["COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT"].includes(execution.status)) return execution;
    this.controllers.get(id)?.abort(new DOMException(reason ?? "Tool execution cancelled", "AbortError"));
    const run = await this.kernel.getRun(workspaceId, execution.executionRunId);
    await this.kernel.cancel(workspaceId, actorId, run.id, { expectedStateVersion: run.stateVersion, reason });
    const value = await this.repository.transition(workspaceId, actorId, id, ToolRuntimeStatus.CANCELLED,
      reason, { cancellationReason: reason ?? "Cancelled" });
    this.close(id, "cancelled", value); return value;
  }

  async providerContracts(workspaceId: string, versionIds: string[]): Promise<ProviderNeutralToolContract[]> {
    return Promise.all(versionIds.map(async (id) => { const version = await this.registry.publishedVersion(workspaceId, id);
      const snapshot = version.snapshot as unknown as ToolRuntimeSnapshot; this.validator.validateSnapshot(snapshot);
      return { name: snapshot.slug, description: snapshot.description ?? snapshot.name,
        inputSchema: snapshot.schemas.find(({ kind }) => kind === "INPUT")!.schema,
        version: version.compatibilityVersion,
        capabilities: snapshot.capabilities.filter(({ enabled }) => enabled).map(({ code }) => code) }; }));
  }

  private async fail(workspaceId: string, actorId: string, id: string, runId: string,
    error: unknown, aborted: boolean) {
    const current = await this.repository.get(workspaceId, id);
    if (current.status === ToolRuntimeStatus.CANCELLED) return current;
    const message = this.message(error); const timedOut = aborted && /timed out/i.test(message);
    await this.repository.diagnostic(workspaceId, actorId, id, { severity: "ERROR",
      code: timedOut ? "TOOL_TIMEOUT" : "TOOL_EXECUTION_FAILED", message });
    const run = await this.kernel.getRun(workspaceId, runId);
    if (!["FAILED", "CANCELLED", "TIMED_OUT", "SUCCEEDED"].includes(run.status)) {
      if (timedOut) await this.kernel.transition(workspaceId, actorId, runId, {
        status: ExecutionKernelStatus.TIMED_OUT, expectedStateVersion: run.stateVersion, message });
      else await this.kernel.recordFailure(workspaceId, actorId, runId, {
        code: "TOOL_EXECUTION_FAILED", message, expectedStateVersion: run.stateVersion });
    }
    const value = await this.repository.transition(workspaceId, actorId, id,
      timedOut ? ToolRuntimeStatus.TIMED_OUT : ToolRuntimeStatus.FAILED, message,
      { failureCode: timedOut ? "TOOL_TIMEOUT" : "TOOL_EXECUTION_FAILED", failureMessage: message });
    this.close(id, timedOut ? "timeout" : "failed", value); return value;
  }

  private async assertPermissions(workspaceId: string, actorId: string, snapshot: ToolRuntimeSnapshot) {
    const identity = await this.repository.actorIdentity(workspaceId, actorId);
    const granted = new Set(await this.permissions.resolve({ workspaceId, userId: actorId,
      roleId: identity.roleId, roleName: identity.roleName }));
    const missing = snapshot.permissions.map(({ permissionCode }) => permissionCode)
      .find((permission) => !granted.has(permission));
    if (missing) throw new ForbiddenException(`Tool permission ${missing} is required`);
  }
  private rateLimit(workspaceId: string, versionId: string, policy: ResolvedToolPolicy) {
    const requests = this.integer(policy.rateLimit.requests, 0, 0, 1_000_000);
    const seconds = this.integer(policy.rateLimit.windowSeconds, 60, 1, 86_400);
    if (!requests) return; const key = `${workspaceId}:${versionId}`; const threshold = Date.now() - seconds * 1000;
    const values = (this.rateWindows.get(key) ?? []).filter((time) => time > threshold);
    if (values.length >= requests) throw new BadRequestException("Tool rate limit exceeded");
    values.push(Date.now()); this.rateWindows.set(key, values);
  }
  private async expire() { const expired = await this.repository.expired(); await Promise.allSettled(expired.map((execution) =>
    this.fail(execution.workspaceId, execution.actorId, execution.id, execution.executionRunId,
      new Error("Tool execution timed out"), true))); }
  observe(workspaceId: string, id: string) { return this.repository.get(workspaceId, id).then(() => {
    let subject = this.subjects.get(id); if (!subject) { subject = new ReplaySubject<ToolEvent>(256); this.subjects.set(id, subject); }
    return subject.asObservable(); }); }
  private emit(id: string, event: string, data: unknown) { this.subjects.get(id)?.next({ id: randomUUID(), event, data }); }
  private close(id: string, event: string, data: unknown) { const subject = this.subjects.get(id);
    subject?.next({ id: "final", event, data }); subject?.complete(); }
  private retryable(error: unknown) { return !(error instanceof BadRequestException) &&
    (!(error instanceof ToolHttpStatusError) || error.status === 408 || error.status === 429 || error.status >= 500); }
  private delay(ms: number, signal: AbortSignal) { return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(this.abortError(signal)); const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(this.abortError(signal)); }, { once: true }); }); }
  private check(signal: AbortSignal) { if (signal.aborted) throw this.abortError(signal); }
  private abortError(signal: AbortSignal) { return signal.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError"); }
  private message(error: unknown) { return error instanceof Error ? error.message : "Tool execution failed"; }
  private record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private text(value: unknown, label: string): string {
    if (typeof value !== "string") throw new BadRequestException(`${label} must be text`);
    return value;
  }
  private scalar(value: unknown, label: string): string {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    throw new BadRequestException(`Tool parameter ${label} must be scalar`);
  }
  private integer(value: unknown, fallback: number, min: number, max: number) { const result = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(result) || result < min || result > max) throw new BadRequestException("Tool integer configuration is invalid"); return result; }
  private number(value: unknown, fallback: number, min: number, max: number) { const result = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(result) || result < min || result > max) throw new BadRequestException("Tool numeric configuration is invalid"); return result; }
  private header(headers: Readonly<Record<string, string | string[] | undefined>>, key: string) { const value = headers[key]; return Array.isArray(value) ? value.join(",") : value; }
  private resolve(value: unknown, previous: unknown): unknown { if (value === "$previous") return previous;
    if (Array.isArray(value)) return value.map((item) => this.resolve(item, previous));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.resolve(item, previous)])); return value; }
  get(workspaceId: string, id: string) { return this.repository.get(workspaceId, id); }
  list(workspaceId: string, query: ToolExecutionListQueryDto) { return this.repository.list(workspaceId, query); }
  history(workspaceId: string, id: string) { return this.repository.history(workspaceId, id); }
  diagnostics(workspaceId: string, id: string) { return this.repository.diagnostics(workspaceId, id); }
  metrics(workspaceId: string, id: string) { return this.repository.metrics(workspaceId, id); }
  events(workspaceId: string, id: string) { return this.repository.events(workspaceId, id); }
}
