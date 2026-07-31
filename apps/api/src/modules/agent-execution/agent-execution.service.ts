import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ExecutionKernelStatus, ExecutionSourceType } from "@prisma/client";
import { AI_INVOCATION_SERVICE } from "../ai/ai.tokens";
import type { InvocationService } from "../ai/invocation/invocation.service";
import { AgentRuntimeService } from "../agent-runtime/agent-runtime.service";
import { ConversationRuntimeService } from "../conversation-runtime/conversation-runtime.service";
import { ExecutionKernelService } from "../execution-kernel/execution-kernel.service";
import { ExecutionPipelineService } from "../execution-pipeline/execution-pipeline.service";
import { PromptExecutionService } from "../prompt-execution/prompt-execution.service";
import { ProviderRuntimeService } from "../provider-runtime/provider-runtime.service";
import { RuntimeOptimizationService } from "../runtime-optimization/runtime-optimization.service";
import { StreamingRuntimeService } from "../streaming-runtime/streaming-runtime.service";
import { MemoryRuntimeService } from "../memory-runtime/memory-runtime.service";
import type { ResolvedMemoryPackage } from "../memory-runtime/memory-runtime.types";
import { RetrievalExecutionService } from "../retrieval-execution/retrieval-execution.service";
import type { RetrievalKnowledgePackage } from "../retrieval-execution/retrieval-execution.types";
import type {
  AgentExecutionListQueryDto, CancelAgentExecutionDto, ExecuteAgentExecutionDto,
  PrepareAgentExecutionDto, StreamAgentExecutionDto
} from "./dto/agent-execution.dto";
import { AgentExecutionRepository } from "./agent-execution.repository";
import {
  AgentExecutionValidator, type AgentExecutionAssetSet
} from "./agent-execution.validator";

@Injectable()
export class AgentExecutionService {
  private readonly streamControllers = new Map<string, AbortController>();
  constructor(
    private readonly repository: AgentExecutionRepository,
    private readonly validator: AgentExecutionValidator,
    private readonly kernel: ExecutionKernelService,
    private readonly agentRuntime: AgentRuntimeService,
    private readonly promptExecution: PromptExecutionService,
    private readonly providerRuntime: ProviderRuntimeService,
    private readonly conversationRuntime: ConversationRuntimeService,
    private readonly executionPipeline: ExecutionPipelineService,
    @Inject(AI_INVOCATION_SERVICE) private readonly invocations: InvocationService,
    private readonly optimization: RuntimeOptimizationService,
    private readonly streaming: StreamingRuntimeService,
    private readonly memory: MemoryRuntimeService,
    private readonly retrievalExecution: RetrievalExecutionService
  ) {}

  async prepare(workspaceId: string, actorId: string, dto: PrepareAgentExecutionDto) {
    const request = await this.kernel.createRequest(workspaceId, actorId, {
      sourceType: ExecutionSourceType.SYSTEM, correlationId: dto.correlationId,
      idempotencyKey: dto.idempotencyKey, priority: dto.priority,
      metadata: { ...dto.metadata, orchestrationType: "AGENT" }
    });
    const existing = await this.repository.findByRequest(workspaceId, request.id);
    if (existing) return existing;
    const run = await this.kernel.createRun(workspaceId, actorId, request.id, {
      runtimeMetadata: { orchestrationType: "AGENT" }
    });
    const queued = await this.kernel.transition(workspaceId, actorId, run.id, {
      status: ExecutionKernelStatus.QUEUED, expectedStateVersion: run.stateVersion,
      message: "Agent execution assets are being coordinated"
    });
    let assets: AgentExecutionAssetSet;
    try {
      const [agent, prompt, provider, conversation, pipeline] = await Promise.all([
        this.agentRuntime.getSnapshot(workspaceId, dto.agentRuntimeSnapshotId),
        this.promptExecution.get(workspaceId, dto.promptExecutionPayloadId),
        this.providerRuntime.getSnapshot(workspaceId, dto.providerRuntimeSnapshotId),
        dto.conversationRuntimeSnapshotId
          ? this.conversationRuntime.getSnapshot(workspaceId, dto.conversationRuntimeSnapshotId)
          : Promise.resolve(undefined),
        this.executionPipeline.getSnapshot(workspaceId, dto.executionPipelineSnapshotId)
      ]);
      assets = {
        agent: agent,
        prompt: prompt,
        provider: provider,
        conversation: conversation,
        pipeline: pipeline
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime asset loading failed";
      const diagnostics = [{
        severity: "ERROR" as const, code: "RUNTIME_ASSET_LOADING_FAILED",
        path: "runtimeAssets",
        message
      }];
      const failed = await this.repository.persist(
        workspaceId, actorId, request.id, run.id, dto,
        { agent: {}, prompt: {}, provider: {}, pipeline: {} }, diagnostics
      );
      await this.kernel.recordFailure(workspaceId, actorId, run.id, {
        code: "RUNTIME_ASSET_LOADING_FAILED", message,
        expectedStateVersion: queued.stateVersion
      });
      return failed;
    }
    const diagnostics = this.validator.validate(assets);
    const record = await this.repository.persist(
      workspaceId, actorId, request.id, run.id, dto, assets, diagnostics
    );
    if (diagnostics.some(({ severity }) => severity === "ERROR")) {
      await this.kernel.recordFailure(workspaceId, actorId, run.id, {
        code: "RUNTIME_DEPENDENCY_INVALID",
        message: "Agent execution runtime dependencies are incompatible",
        expectedStateVersion: queued.stateVersion, metadata: { diagnostics }
      });
      return record;
    }
    await this.kernel.appendEvent(workspaceId, actorId, run.id, {
      eventType: "agent.execution.ready",
      message: "Immutable agent execution plan is ready",
      metadata: { orchestrationId: record.id, planHash: record.planHash }
    });
    return record;
  }

  async cancel(
    workspaceId: string, actorId: string, id: string, dto: CancelAgentExecutionDto
  ) {
    const execution = await this.repository.get(workspaceId, id);
    const run = await this.kernel.getRun(workspaceId, execution.executionRunId);
    await this.kernel.cancel(workspaceId, actorId, run.id, {
      reason: dto.reason, expectedStateVersion: run.stateVersion
    });
    return this.repository.cancel(workspaceId, actorId, id);
  }

  async execute(workspaceId: string, actorId: string, dto: ExecuteAgentExecutionDto) {
    const orchestration = await this.prepare(workspaceId, actorId, dto);
    if (orchestration.status !== "READY") {
      throw new BadRequestException({
        message: "Agent execution dependencies are invalid",
        diagnostics: orchestration.runtimeDiagnostics
      });
    }
    const run = await this.kernel.getRun(workspaceId, orchestration.executionRunId);
    const starting = await this.kernel.transition(workspaceId, actorId, run.id, {
      status: ExecutionKernelStatus.STARTING, expectedStateVersion: run.stateVersion,
      message: "Provider invocation is starting"
    });
    const running = await this.kernel.transition(workspaceId, actorId, run.id, {
      status: ExecutionKernelStatus.RUNNING, expectedStateVersion: starting.stateVersion,
      message: "Provider invocation is running"
    });
    try {
      const memory = await this.resolveMemory(workspaceId, actorId, dto,
        orchestration.executionRequestId, orchestration.executionRunId);
      const retrieval = await this.resolveRetrieval(workspaceId, actorId, dto,
        orchestration.executionRequestId, orchestration.executionRunId, memory);
      const payload = await this.promptExecution.get(workspaceId, dto.promptExecutionPayloadId);
      const messages = this.messages(payload.messages, dto.userMessage, memory, retrieval);
      await this.optimization.cacheCompiled(workspaceId, actorId, {
        compiledPromptId: payload.compiledPromptId
      });
      if (dto.staticVariables) {
        await this.optimization.cacheRendered(workspaceId, actorId, {
          compiledPromptId: payload.compiledPromptId, staticVariables: dto.staticVariables
        });
      }
      const response = await this.invocations.invoke({
        requestId: orchestration.executionRequestId, taskType: dto.taskType, messages,
        mode: "sync", ...(dto.language ? { language: dto.language } : {})
      });
      const completed = await this.kernel.transition(workspaceId, actorId, run.id, {
        status: ExecutionKernelStatus.SUCCEEDED, expectedStateVersion: running.stateVersion,
        message: "Provider invocation completed",
        metadata: { providerId: response.providerId, modelId: response.modelId, usage: response.usage }
      });
      await this.kernel.appendEvent(workspaceId, actorId, run.id, {
        eventType: "agent.execution.completed", message: "Unified agent execution completed",
        metadata: { orchestrationId: orchestration.id, invocationRequestId: response.requestId }
      });
      await this.commitMemoryWrites(workspaceId, actorId, dto, run.id);
      return {
        executionId: orchestration.id, answer: response.content, provider: response.providerId,
        model: response.modelId, finishReason: response.finishReason ?? null,
        usage: response.usage, latency: response.metadata?.providerDurationMs ?? null,
        executionTime: completed.durationMs ?? null, cacheHit: false,
        diagnostics: orchestration.runtimeDiagnostics
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider invocation failed";
      await this.kernel.recordFailure(workspaceId, actorId, run.id, {
        code: "AGENT_EXECUTION_FAILED", message,
        expectedStateVersion: running.stateVersion
      });
      throw error;
    }
  }

  async stream(workspaceId: string, actorId: string, dto: StreamAgentExecutionDto) {
    const orchestration = await this.prepare(workspaceId, actorId, dto);
    if (orchestration.status !== "READY") throw new BadRequestException("Agent execution dependencies are invalid");
    const memory = await this.resolveMemory(workspaceId, actorId, dto,
      orchestration.executionRequestId, orchestration.executionRunId);
    const retrieval = await this.resolveRetrieval(workspaceId, actorId, dto,
      orchestration.executionRequestId, orchestration.executionRunId, memory);
    const provider = await this.providerRuntime.getSnapshot(workspaceId, dto.providerRuntimeSnapshotId);
    const payload = await this.promptExecution.get(workspaceId, dto.promptExecutionPayloadId);
    const messages = this.messages(payload.messages, dto.userMessage, memory, retrieval);
    await this.optimization.cacheCompiled(workspaceId, actorId, { compiledPromptId: payload.compiledPromptId });
    if (dto.staticVariables) await this.optimization.cacheRendered(workspaceId, actorId, {
      compiledPromptId: payload.compiledPromptId, staticVariables: dto.staticVariables
    });
    const session = await this.streaming.create(workspaceId, actorId, {
      providerId: provider.providerId, modelId: provider.modelId, requestHash: orchestration.planHash,
      agentRuntimeId: dto.agentRuntimeSnapshotId, executionRequestId: orchestration.executionRequestId,
      executionRunId: orchestration.executionRunId, timeoutMs: dto.timeoutMs,
      ...(dto.conversationRuntimeSnapshotId ? { conversationId: dto.conversationRuntimeSnapshotId } : {}),
      providerMetadata: { orchestrationId: orchestration.id, providerRuntimeSnapshotId: provider.id }
    });
    const controller = new AbortController(); this.streamControllers.set(session.id, controller);
    void this.runStream(workspaceId, actorId, session.id, orchestration.executionRunId, dto, messages, controller);
    return session;
  }

  async cancelStream(workspaceId: string, actorId: string, sessionId: string) {
    const current = await this.streaming.get(workspaceId, sessionId);
    if (["COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT"].includes(current.status)) {
      return current;
    }
    this.streamControllers.get(sessionId)?.abort(new DOMException("Stream cancelled", "AbortError"));
    const session = await this.streaming.cancel(workspaceId, actorId, sessionId, { reason: "Cancelled by client" });
    const run = await this.kernel.getRun(workspaceId, session.executionRunId!);
    await this.kernel.cancel(workspaceId, actorId, run.id, { reason: "Stream cancelled", expectedStateVersion: run.stateVersion });
    return session;
  }

  private async runStream(workspaceId: string, actorId: string, sessionId: string, runId: string,
    dto: StreamAgentExecutionDto, messages: ReturnType<AgentExecutionService["messages"]>, controller: AbortController) {
    let sequence = 0;
    const timeout = setTimeout(
      () => controller.abort(new Error("Stream timeout")),
      dto.timeoutMs ?? 30_000
    );
    try {
      const connected = await this.streaming.connect(workspaceId, actorId, sessionId, 0);
      const started = await this.streaming.start(workspaceId, actorId, sessionId, connected.stateVersion);
      const run = await this.kernel.getRun(workspaceId, runId);
      const starting = await this.kernel.transition(workspaceId, actorId, runId, { status: ExecutionKernelStatus.STARTING, expectedStateVersion: run.stateVersion, message: "Provider stream is connecting" });
      await this.kernel.transition(workspaceId, actorId, runId, { status: ExecutionKernelStatus.RUNNING, expectedStateVersion: starting.stateVersion, message: "Provider stream is active" });
      const completion = await this.invocations.stream({ requestId: runId, taskType: dto.taskType, messages, mode: "stream", signal: controller.signal, ...(dto.language ? { language: dto.language } : {}) }, async (event) => {
        if (event.type === "delta" && event.content) {
          await this.streaming.append(workspaceId, actorId, sessionId, {
            sequence: sequence++, content: event.content, role: event.role, delta: true,
            finishReason: event.finishReason, providerMetadata: event.providerMetadata
          });
        }
      });
      await this.streaming.complete(
        workspaceId, actorId, sessionId, started.stateVersion, completion
      );
      const current = await this.kernel.getRun(workspaceId, runId);
      await this.kernel.transition(workspaceId, actorId, runId, { status: ExecutionKernelStatus.SUCCEEDED, expectedStateVersion: current.stateVersion, message: "Provider stream completed" });
      await this.commitMemoryWrites(workspaceId, actorId, dto, runId);
    } catch (error) {
      const session = await this.streaming.get(workspaceId, sessionId).catch(() => undefined);
      if (session && session.status !== "CANCELLED") {
        const timedOut = /timeout/i.test(error instanceof Error ? error.message : "");
        await this.streaming.fail(workspaceId, actorId, sessionId, session.stateVersion, timedOut ? "STREAM_TIMEOUT" : "STREAM_FAILURE", error instanceof Error ? error.message : "Provider stream failed", timedOut);
      }
      const run = await this.kernel.getRun(workspaceId, runId).catch(() => undefined);
      if (run && run.status !== ExecutionKernelStatus.CANCELLED) await this.kernel.recordFailure(workspaceId, actorId, runId, { code: "STREAM_FAILURE", message: error instanceof Error ? error.message : "Provider stream failed", expectedStateVersion: run.stateVersion });
    } finally {
      clearTimeout(timeout);
      this.streamControllers.delete(sessionId);
    }
  }

  async observeStream(workspaceId: string, sessionId: string) {
    await this.streaming.get(workspaceId, sessionId);
    return this.streaming.observe(sessionId);
  }

  private messages(value: unknown, userMessage?: string, memory?: ResolvedMemoryPackage,
    retrieval?: RetrievalKnowledgePackage) {
    if (!Array.isArray(value)) {
      throw new BadRequestException("Prompt execution payload messages are invalid");
    }
    const messages = value.map((message) => {
      if (!message || typeof message !== "object") {
        throw new BadRequestException("Prompt execution payload messages are invalid");
      }
      const record = message as Record<string, unknown>;
      if ((record.role !== "system" && record.role !== "user" && record.role !== "assistant") ||
          typeof record.content !== "string" || !record.content.trim()) {
        throw new BadRequestException("Prompt execution payload messages are invalid");
      }
      return { role: record.role, content: record.content } as const;
    });
    if (memory?.snapshots.length) {
      messages.unshift({
        role: "system",
        content: JSON.stringify({
          memory: memory.snapshots.map((snapshot) => ({
            identifier: snapshot.identifier, type: snapshot.type,
            scopeKey: snapshot.scopeKey, revision: snapshot.revision,
            content: snapshot.content
          })),
          packageHash: memory.packageHash
        })
      });
    }
    if (retrieval?.documents.length) {
      messages.unshift({ role: "system", content: JSON.stringify({
        retrieval: { query: retrieval.query, documents: retrieval.documents.map((document) => ({
          documentId: document.documentId, versionId: document.versionId, name: document.name,
          score: document.score, content: document.content, citation: document.citation
        })), citations: retrieval.citations, packageHash: retrieval.packageHash,
        tokenBudget: retrieval.budget }
      }) });
    }
    if (userMessage?.trim()) messages.push({ role: "user", content: userMessage });
    if (!messages.length) throw new BadRequestException("Prompt execution payload has no messages");
    return messages;
  }
  private async resolveMemory(
    workspaceId: string, actorId: string, dto: ExecuteAgentExecutionDto,
    executionRequestId: string, executionRunId: string
  ) {
    if (!dto.memoryRuntimeSnapshotIds?.length) return undefined;
    const resolved = await this.memory.resolve(workspaceId, actorId, {
      snapshotIds: dto.memoryRuntimeSnapshotIds,
      compatibilityVersion: dto.memoryCompatibilityVersion ?? "1.0",
      executionRequestId, executionRunId
    });
    await this.optimization.cacheMemory(workspaceId, actorId, {
      memoryRuntimeSnapshotIds: dto.memoryRuntimeSnapshotIds
    });
    return resolved;
  }
  private async resolveRetrieval(
    workspaceId: string, actorId: string, dto: ExecuteAgentExecutionDto,
    executionRequestId: string, executionRunId: string, memory?: ResolvedMemoryPackage
  ) {
    if (!dto.retrievalRuntimeSnapshotId) return undefined;
    const query = [dto.userMessage?.trim(), memory?.snapshots.map((item) =>
      JSON.stringify(item.content)).join(" ")].filter(Boolean).join(" ");
    if (!query) throw new BadRequestException("Retrieval execution requires a query or user message");
    await this.optimization.cacheRetrieval(workspaceId, actorId, {
      retrievalRuntimeSnapshotId: dto.retrievalRuntimeSnapshotId
    });
    return this.retrievalExecution.execute(workspaceId, actorId, {
      retrievalRuntimeSnapshotId: dto.retrievalRuntimeSnapshotId, query,
      mode: dto.retrievalMode, topK: dto.retrievalTopK,
      maxTokens: dto.retrievalTokenBudget, executionRequestId, executionRunId,
      compatibilityVersion: "1.0"
    });
  }
  private async commitMemoryWrites(
    workspaceId: string, actorId: string, dto: ExecuteAgentExecutionDto,
    executionRunId: string
  ) {
    if (!dto.memoryWrites?.length) return;
    await this.memory.commitWrites(workspaceId, actorId,
      dto.memoryWrites.map((write) => ({ ...write, executionRunId })));
  }
  get(workspaceId: string, id: string) { return this.repository.get(workspaceId, id); }
  list(workspaceId: string, query: AgentExecutionListQueryDto) {
    return this.repository.list(workspaceId, query);
  }
}
