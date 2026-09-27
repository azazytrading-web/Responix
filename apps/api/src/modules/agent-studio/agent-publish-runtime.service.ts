import { BadRequestException, Injectable } from "@nestjs/common";
import { ExecutionSourceType, MemoryRuntimeStatus, MemoryRuntimeType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AgentRuntimeService } from "../agent-runtime/agent-runtime.service";
import { PromptCompilerService } from "../prompt-compiler/prompt-compiler.service";
import { PromptExecutionService } from "../prompt-execution/prompt-execution.service";
import { ProviderRuntimeService } from "../provider-runtime/provider-runtime.service";
import { ExecutionPipelineService } from "../execution-pipeline/execution-pipeline.service";
import { ExecutionKernelService } from "../execution-kernel/execution-kernel.service";
import { AgentExecutionService } from "../agent-execution/agent-execution.service";
import { MemoryRuntimeService } from "../memory-runtime/memory-runtime.service";
import { PipelineAssetType } from "../execution-pipeline/dto/execution-pipeline.dto";

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

@Injectable()
export class AgentPublishRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kernel: ExecutionKernelService,
    private readonly agents: AgentRuntimeService,
    private readonly compiler: PromptCompilerService,
    private readonly prompts: PromptExecutionService,
    private readonly providers: ProviderRuntimeService,
    private readonly pipelines: ExecutionPipelineService,
    private readonly executions: AgentExecutionService,
    private readonly memory: MemoryRuntimeService
  ) {}

  async prepare(workspaceId: string, actorId: string, agentId: string, agentVersionId: string) {
    const snapshots = await this.prisma.agentRuntimeSnapshot.findMany({
      where: { workspaceId, agentId, agentVersionId }, select: { id: true }
    });
    const existing = await this.prisma.agentExecutionOrchestration.findFirst({
      where: { workspaceId, status: "READY", agentRuntimeSnapshotId: { in: snapshots.map(({ id }) => id) } },
      orderBy: { createdAt: "desc" }
    });
    if (existing) return existing;

    const source = await this.resolveSources(workspaceId, agentId, agentVersionId);
    const memorySnapshotIds = source.memoryEnabled
      ? [await this.ensureAgentMemorySnapshot(workspaceId, actorId, agentId, agentVersionId)]
      : [];
    const key = `agent-publish:${agentVersionId}`;
    const request = await this.kernel.createRequest(workspaceId, actorId, {
      sourceType: ExecutionSourceType.AGENT,
      sourceReferenceId: agentId,
      correlationId: key,
      idempotencyKey: key,
      metadata: { lifecycle: "agent.publish", agentId, agentVersionId }
    });
    const runtime = await this.agents.prepare(workspaceId, actorId, {
      agentId, agentVersionId,
      executionProfileId: source.profileId,
      executionProfileVersionId: source.profileVersionId,
      executionRequestId: request.id,
      context: { traceId: key, runtimeMetadata: { lifecycle: "agent.publish" } }
    });
    const agentSnapshot = await this.agents.createSnapshot(
      workspaceId, actorId, runtime.id
    );
    const compiled = await this.compiler.compile(workspaceId, actorId, {
      promptId: source.promptId,
      promptVersionId: source.promptVersionId,
      sections: source.promptSections,
      agentVersionId,
      agentRuntimeSnapshotId: agentSnapshot.id,
      executionRequestId: request.id
    });
    const providerRequest = await this.providers.prepare(workspaceId, actorId, {
      compiledPromptId: compiled.id,
      agentRuntimeSnapshotId: agentSnapshot.id,
      estimatedInputTokens: 0,
      maxOutputTokens: source.maxTokens,
      temperature: source.temperature,
      topP: source.topP ?? undefined,
      stopSequences: source.stopSequences,
      vision: source.visionEnabled === true,
      image: source.imageEnabled === true,
      tools: source.toolsEnabled === true,
      streaming: source.streamingEnabled,
      reasoning: source.reasoningEnabled === true
    });
    const providerSnapshot = await this.providers.createSnapshot(
      workspaceId, actorId, providerRequest.id
    );

    const pipelineSource = await this.pipelines.get(workspaceId, source.pipelineId);
    const plan = record(pipelineSource.plan);
    const nodes = Array.isArray(plan.nodes) ? plan.nodes.map((raw) => {
      const node = record(raw);
      const replacements: Partial<Record<PipelineAssetType, string>> = {
        [PipelineAssetType.EXECUTION_REQUEST]: request.id,
        [PipelineAssetType.AGENT_RUNTIME]: agentSnapshot.id,
        [PipelineAssetType.COMPILED_PROMPT]: compiled.id,
        [PipelineAssetType.PROVIDER_RUNTIME]: providerSnapshot.id,
        [PipelineAssetType.EXECUTION_PROFILE]: source.profileVersionId
      };
      const assetType = node.assetType as PipelineAssetType | undefined;
      return { ...node, ...(assetType && replacements[assetType]
        ? { assetId: replacements[assetType] } : {}) };
    }) : [];
    const pipeline = await this.pipelines.create(workspaceId, actorId, {
      ...plan,
      name: `${pipelineSource.name} / ${agentId} / ${agentVersionId}`,
      compatibilityVersion: pipelineSource.compatibilityVersion,
      nodes: nodes as never
    });
    const pipelineSnapshot = await this.pipelines.publish(workspaceId, actorId, pipeline.id);
    const promptPayload = await this.prompts.render(workspaceId, actorId, {
      compiledPromptId: compiled.id,
      agentRuntimeSnapshotId: agentSnapshot.id,
      providerRuntimeSnapshotId: providerSnapshot.id,
      executionPipelineSnapshotId: pipelineSnapshot.id,
      executionRequestId: request.id
    });
    const orchestration = await this.executions.prepare(workspaceId, actorId, {
      agentRuntimeSnapshotId: agentSnapshot.id,
      promptExecutionPayloadId: promptPayload.id,
      providerRuntimeSnapshotId: providerSnapshot.id,
      executionPipelineSnapshotId: pipelineSnapshot.id,
      ...(memorySnapshotIds.length ? {
        memoryRuntimeSnapshotIds: memorySnapshotIds,
        memoryCompatibilityVersion: "1.0"
      } : {}),
      correlationId: key,
      idempotencyKey: `${key}:orchestration`,
      metadata: { lifecycle: "agent.publish", agentVersionId }
    });
    if (orchestration.status !== "READY") {
      throw new BadRequestException({
        message: "Published agent runtime package is invalid",
        code: "AGENT_RUNTIME_PREPARATION_FAILED",
        diagnostics: orchestration.runtimeDiagnostics
      });
    }
    return orchestration;
  }

  private async resolveSources(workspaceId: string, agentId: string, agentVersionId: string) {
    const version = await this.prisma.aiAgentVersion.findFirst({
      where: { id: agentVersionId, agentId, agent: { workspaceId, status: "PUBLISHED" } },
      select: { snapshot: true }
    });
    if (!version) throw new BadRequestException("Published agent version was not found");
    const snapshot = record(version.snapshot);
    const runtime = record(snapshot.runtimeConfiguration);
    const pipelineId = runtime.executionPipelineId;
    if (typeof pipelineId !== "string") {
      throw new BadRequestException("A published execution pipeline must be selected before publishing the Agent");
    }
    const executionProfileId = runtime.executionProfileId;
    if (typeof executionProfileId !== "string") {
      throw new BadRequestException("A published execution profile must be selected before publishing the Agent");
    }
    const pipeline = await this.prisma.executionPipeline.findFirst({
      where: { id: pipelineId, workspaceId, status: "PUBLISHED", archivedAt: null, deletedAt: null },
      select: { id: true }
    });
    if (!pipeline) {
      throw new BadRequestException("The selected execution pipeline is not published in this workspace");
    }
    const profile = await this.prisma.executionProfile.findFirst({
      where: {
        id: executionProfileId, workspaceId, status: "PUBLISHED", archivedAt: null, deletedAt: null
      },
      select: { id: true, versions: { orderBy: { revision: "desc" }, take: 1, select: { id: true } } }
    });
    if (!profile?.versions[0]) {
      throw new BadRequestException("The selected execution profile is not published in this workspace");
    }
    const bindings = Array.isArray(snapshot.promptBindings) ? snapshot.promptBindings.map(record) : [];
    const primary = bindings.find((item) => item.role === "SYSTEM") ??
      (bindings.length === 1 ? bindings[0] : undefined);
    if (!primary || typeof primary.promptId !== "string") {
      throw new BadRequestException("A published SYSTEM prompt binding is required for runtime preparation");
    }
    const promptVersion = await this.prisma.promptLibraryVersion.findFirst({
      where: {
        promptId: primary.promptId,
        ...(typeof primary.promptVersionId === "string" ? { id: primary.promptVersionId } : {}),
        publishedAt: { not: null }, prompt: { workspaceId, deletedAt: null }
      },
      orderBy: { revision: "desc" }, select: { id: true, snapshot: true }
    });
    if (!promptVersion) {
      throw new BadRequestException("The selected SYSTEM prompt has no published version in this workspace");
    }
    const promptSnapshot = record(promptVersion.snapshot);
    const promptDraft = record(promptSnapshot.draft);
    const promptSections = record(promptDraft.sections);
    const section = (...values: unknown[]) => values.find(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    const resolvedPromptSections = {
      systemPrompt: section(promptSections.systemPrompt, promptDraft.systemPrompt, promptDraft.system_prompt),
      developerPrompt: section(promptSections.developerPrompt, promptDraft.developerPrompt, promptDraft.developer_prompt),
      userPrompt: section(promptSections.userPrompt, promptDraft.userPrompt, promptDraft.user_prompt, promptDraft.content, promptDraft.template)
    };
    if (!resolvedPromptSections.userPrompt) {
      throw new BadRequestException({
        message: "The selected SYSTEM Prompt is not valid for Agent compilation",
        code: "USER_PROMPT_MISSING",
        path: "sections.userPrompt",
        promptId: primary.promptId,
        promptVersionId: promptVersion.id
      });
    }
    return {
      profileId: profile.id, profileVersionId: profile.versions[0].id, pipelineId,
      promptId: primary.promptId, promptVersionId: promptVersion.id,
      promptSections: resolvedPromptSections,
      maxTokens: Number(snapshot.maxTokens), temperature: Number(snapshot.temperature),
      topP: snapshot.topP === null ? null : Number(snapshot.topP),
      stopSequences: Array.isArray(snapshot.stopSequences) ? snapshot.stopSequences as string[] : [],
      visionEnabled: snapshot.capabilities && record(snapshot.capabilities).visionEnabled === true,
      imageEnabled: snapshot.capabilities && record(snapshot.capabilities).imageEnabled === true,
      toolsEnabled: snapshot.capabilities && record(snapshot.capabilities).toolsEnabled === true,
      reasoningEnabled: snapshot.capabilities && record(snapshot.capabilities).reasoningEnabled === true,
      streamingEnabled: snapshot.streamingEnabled === true,
      memoryEnabled: record(snapshot.capabilities).memoryEnabled === true
    };
  }

  private async ensureAgentMemorySnapshot(
    workspaceId: string, actorId: string, agentId: string, agentVersionId: string
  ) {
    const identifier = `agent-memory-${agentId}`;
    let runtime = await this.prisma.memoryRuntime.findFirst({
      where: { workspaceId, identifier },
      select: { id: true, status: true, stateVersion: true,
        snapshots: { orderBy: { revision: "desc" }, take: 1, select: { id: true } } }
    });
    if (!runtime) {
      const created = await this.memory.create(workspaceId, actorId, {
        identifier, name: `Agent memory ${agentId}`, type: MemoryRuntimeType.AGENT,
        scopeKey: `agent:${agentId}`, content: {}, compatibilityVersion: "1.0",
        metadata: { agentId, agentVersionId }
      });
      const published = await this.memory.publish(workspaceId, actorId, created.id, created.stateVersion);
      return published.id;
    }
    if (runtime.status === MemoryRuntimeStatus.ARCHIVED) {
      throw new BadRequestException("The Agent memory runtime is archived and cannot be bound");
    }
    if (runtime.status === MemoryRuntimeStatus.DRAFT) {
      const published = await this.memory.publish(workspaceId, actorId, runtime.id, runtime.stateVersion);
      return published.id;
    }
    const snapshot = runtime.snapshots[0];
    if (!snapshot) throw new BadRequestException("Published Agent memory has no immutable snapshot");
    return snapshot.id;
  }
}
