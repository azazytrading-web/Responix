import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPromptRole,
  Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  AgentRuntimeListQueryDto,
  PrepareAgentRuntimeDto,
  RuntimeVariableDto
} from "./dto/agent-runtime.dto";
import {
  RuntimeVariableSource,
  RuntimeVariableType
} from "./dto/agent-runtime.dto";
import {
  AgentRuntimeValidator,
  type RuntimeValidationIssue,
  type RuntimeVariableDefinition
} from "./agent-runtime.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

type ResolvedRuntime = {
  agentId: string;
  agentVersionId: string;
  providerId: string;
  modelId: string;
  providerConfigurationId: string;
  executionProfileId: string;
  executionProfileVersionId: string;
  executionRequestId: string;
  executionRunId: string | null;
  conversationId: string | null;
  locale: string;
  timezone: string;
  correlationId: string;
  executionId: string;
  traceId: string;
  runtimeContext: JsonRecord;
  promptReferences: JsonRecord[];
  promptStructure: JsonRecord;
  runtimeVariables: RuntimeVariableDto[];
  validationResult: JsonRecord;
  executionConfiguration: JsonRecord;
  runtimeMetadata: JsonRecord;
  conversation: {
    conversationId: string | null;
    parentExecutionRunId: string | null;
    historyReferences: JsonRecord[];
    memoryReferences: JsonRecord[];
    participantMetadata: JsonRecord;
    tokenAccountingMetadata: JsonRecord;
  };
};

class RuntimeResolutionError extends Error {
  constructor(readonly issues: RuntimeValidationIssue[]) {
    super("Agent runtime configuration is not ready");
  }
}

@Injectable()
export class AgentRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: AgentRuntimeValidator
  ) {}

  async prepare(
    workspaceId: string,
    actorId: string,
    dto: PrepareAgentRuntimeDto
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const resolved = await this.resolve(tx, workspaceId, actorId, dto);
        const runtime = await tx.agentRuntimePreparation.create({
          data: {
            workspaceId,
            actorId,
            ...this.referenceData(resolved),
            status: "PREPARED",
            locale: resolved.locale,
            timezone: resolved.timezone,
            correlationId: resolved.correlationId,
            executionId: resolved.executionId,
            traceId: resolved.traceId,
            preparationInput: json(this.clean(dto)),
            runtimeContext: json(resolved.runtimeContext),
            promptStructure: json(resolved.promptStructure),
            runtimeVariables: json(resolved.runtimeVariables),
            validationResult: json(resolved.validationResult),
            executionConfiguration: json(resolved.executionConfiguration),
            runtimeMetadata: json(resolved.runtimeMetadata),
            conversationContext: {
              create: {
                workspaceId,
                conversationId: resolved.conversation.conversationId,
                parentExecutionRunId: resolved.conversation.parentExecutionRunId,
                historyReferences: json(resolved.conversation.historyReferences),
                memoryReferences: json(resolved.conversation.memoryReferences),
                participantMetadata: json(resolved.conversation.participantMetadata),
                tokenAccountingMetadata: json(resolved.conversation.tokenAccountingMetadata)
              }
            }
          },
          select: this.runtimeSelect
        });
        await this.audit(tx, workspaceId, actorId, "agent.runtime.prepared", "AgentRuntimePreparation", runtime.id, null, runtime);
        return runtime;
      });
    } catch (error) {
      if (error instanceof RuntimeResolutionError) {
        await this.auditRejected(workspaceId, actorId, dto.agentId, "agent.runtime.configuration_rejected", error.issues);
        throw new BadRequestException({
          message: error.message,
          validation: this.validation(false, error.issues)
        });
      }
      throw error;
    }
  }

  async validate(workspaceId: string, actorId: string, runtimeId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireRuntime(tx, workspaceId, runtimeId);
      const dto = this.readInput(before.preparationInput);
      try {
        const resolved = await this.resolve(tx, workspaceId, actorId, dto);
        const validation = this.validation(true, []);
        const runtime = await tx.agentRuntimePreparation.update({
          where: { id: runtimeId },
          data: {
            status: "VALIDATED",
            validationResult: json(validation),
            validatedAt: new Date()
          },
          select: this.runtimeSelect
        });
        await this.audit(tx, workspaceId, actorId, "agent.runtime.validated", "AgentRuntimePreparation", runtimeId, before, runtime);
        return { runtime, resolved, validation };
      } catch (error) {
        if (!(error instanceof RuntimeResolutionError)) throw error;
        const validation = this.validation(false, error.issues);
        const runtime = await tx.agentRuntimePreparation.update({
          where: { id: runtimeId },
          data: {
            status: "REJECTED",
            validationResult: json(validation),
            validatedAt: new Date()
          },
          select: this.runtimeSelect
        });
        await this.audit(tx, workspaceId, actorId, "agent.runtime.validation_failed", "AgentRuntimePreparation", runtimeId, before, runtime);
        return { runtime, validation };
      }
    });
    return { runtime: result.runtime, validation: result.validation };
  }

  async createSnapshot(workspaceId: string, actorId: string, runtimeId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await this.requireRuntime(tx, workspaceId, runtimeId);
      const existing = await tx.agentRuntimeSnapshot.findFirst({
        where: { runtimeId, workspaceId },
        select: this.snapshotSelect
      });
      if (existing) throw new ConflictException("Agent runtime already has an immutable snapshot");
      const dto = this.readInput(before.preparationInput);
      try {
        const resolved = await this.resolve(tx, workspaceId, actorId, dto);
        const content = {
          runtimeContext: resolved.runtimeContext,
          promptReferences: resolved.promptReferences,
          promptStructure: resolved.promptStructure,
          runtimeVariables: resolved.runtimeVariables,
          runtimeMetadata: resolved.runtimeMetadata,
          executionConfiguration: resolved.executionConfiguration
        };
        const snapshot = await tx.agentRuntimeSnapshot.create({
          data: {
            workspaceId,
            runtimeId,
            createdById: actorId,
            ...this.referenceData(resolved),
            correlationId: resolved.correlationId,
            executionId: resolved.executionId,
            traceId: resolved.traceId,
            runtimeContext: json(resolved.runtimeContext),
            promptReferences: json(resolved.promptReferences),
            promptStructure: json(resolved.promptStructure),
            runtimeVariables: json(resolved.runtimeVariables),
            runtimeMetadata: json(resolved.runtimeMetadata),
            executionConfiguration: json(resolved.executionConfiguration),
            contentHash: this.hash(content)
          },
          select: this.snapshotSelect
        });
        await tx.agentRuntimePreparation.update({
          where: { id: runtimeId },
          data: {
            status: "SNAPSHOTTED",
            validationResult: json(this.validation(true, [])),
            validatedAt: new Date()
          }
        });
        await this.audit(tx, workspaceId, actorId, "agent.runtime.snapshot_created", "AgentRuntimeSnapshot", snapshot.id, null, snapshot);
        return { snapshot };
      } catch (error) {
        if (!(error instanceof RuntimeResolutionError)) throw error;
        const validation = this.validation(false, error.issues);
        const runtime = await tx.agentRuntimePreparation.update({
          where: { id: runtimeId },
          data: { status: "REJECTED", validationResult: json(validation), validatedAt: new Date() },
          select: this.runtimeSelect
        });
        await this.audit(tx, workspaceId, actorId, "agent.runtime.validation_failed", "AgentRuntimePreparation", runtimeId, before, runtime);
        return { failure: validation };
      }
    });
    if ("failure" in result) {
      throw new BadRequestException({
        message: "Agent runtime configuration is no longer ready",
        validation: result.failure
      });
    }
    return result.snapshot;
  }

  get(workspaceId: string, runtimeId: string) {
    return this.requireRuntime(this.prisma, workspaceId, runtimeId, true);
  }

  async resolveRuntime(workspaceId: string, actorId: string, runtimeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, runtimeId);
      try {
        return await this.resolve(tx, workspaceId, actorId, this.readInput(runtime.preparationInput));
      } catch (error) {
        if (error instanceof RuntimeResolutionError) {
          throw new BadRequestException({
            message: error.message,
            validation: this.validation(false, error.issues)
          });
        }
        throw error;
      }
    });
  }

  getSnapshot(workspaceId: string, snapshotId: string) {
    return this.prisma.agentRuntimeSnapshot.findFirst({
      where: { id: snapshotId, workspaceId, runtime: { workspaceId } },
      select: this.snapshotSelect
    }).then((snapshot) => {
      if (!snapshot) throw new NotFoundException("Agent runtime snapshot was not found");
      return snapshot;
    });
  }

  async list(workspaceId: string, query: AgentRuntimeListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.AgentRuntimePreparationWhereInput = {
      workspaceId,
      status: query.status,
      agentId: query.agentId,
      conversationId: query.conversationId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.agentRuntimePreparation.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: this.runtimeSelect
      }),
      this.prisma.agentRuntimePreparation.count({ where })
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  private async resolve(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    dto: PrepareAgentRuntimeDto
  ): Promise<ResolvedRuntime> {
    const workspace = await tx.workspace.findFirst({
      where: { id: workspaceId, status: "ACTIVE", deletedAt: null },
      select: { id: true, language: true, timezone: true, status: true }
    });
    if (!workspace) this.fail("WORKSPACE_UNAVAILABLE", "workspaceId", "Active workspace was not found");

    const request = await tx.executionRequest.findFirst({
      where: { id: dto.executionRequestId, workspaceId },
      select: { id: true, workspaceId: true, requestedById: true, correlationId: true, metadata: true }
    });
    if (!request) this.fail("EXECUTION_REQUEST_INVALID", "executionRequestId", "Execution request must belong to the active workspace");
    if (request.requestedById !== actorId) {
      this.fail("EXECUTION_ACTOR_MISMATCH", "executionRequestId", "Execution request actor does not match the runtime actor");
    }
    if (dto.executionRunId) {
      const run = await tx.executionRun.findFirst({
        where: { id: dto.executionRunId, workspaceId, requestId: request.id },
        select: { id: true }
      });
      if (!run) this.fail("EXECUTION_RUN_INVALID", "executionRunId", "Execution run must belong to the request and active workspace");
    }

    const agent = await tx.aiAgent.findFirst({
      where: {
        id: dto.agentId,
        workspaceId,
        status: "PUBLISHED",
        archivedAt: null,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!agent) this.fail("AGENT_NOT_READY", "agentId", "Agent must be published, active, and belong to the workspace");
    const agentVersion = await tx.aiAgentVersion.findFirst({
      where: {
        agentId: agent.id,
        ...(dto.agentVersionId ? { id: dto.agentVersionId } : {})
      },
      orderBy: { revision: "desc" },
      select: { id: true, revision: true, snapshot: true, publishedAt: true }
    });
    if (!agentVersion) this.fail("AGENT_VERSION_MISSING", "agentVersionId", "Published agent version was not found");
    const agentSnapshot = this.agentSnapshot(agentVersion.snapshot);

    const providerConfigId = this.string(agentSnapshot.providerConfigurationId);
    if (!providerConfigId) {
      this.fail("PROVIDER_CONFIGURATION_MISSING", "agentVersion.providerConfigurationId", "Published agent must select a workspace provider configuration");
    }
    const providerId = this.requiredString(agentSnapshot.providerId, "agentVersion.providerId");
    const modelId = this.requiredString(agentSnapshot.modelId, "agentVersion.modelId");
    const providerConfiguration = await tx.aiProviderConfiguration.findFirst({
      where: {
        id: providerConfigId,
        workspaceId,
        providerId,
        enabled: true,
        deletedAt: null
      },
      select: { id: true, settings: true }
    });
    if (!providerConfiguration) {
      this.fail("PROVIDER_CONFIGURATION_INVALID", "agentVersion.providerConfigurationId", "Provider configuration is disabled, deleted, or belongs to another workspace");
    }
    const model = await tx.aiModel.findFirst({
      where: {
        id: modelId,
        providerId,
        status: "ACTIVE",
        provider: { status: "ACTIVE" }
      },
      select: {
        id: true,
        maxOutputTokens: true,
        supportsVision: true,
        supportsAudio: true,
        supportsTools: true,
        supportsReasoning: true,
        supportsStreaming: true
      }
    });
    if (!model) this.fail("MODEL_NOT_READY", "agentVersion.modelId", "Provider and model must be active");
    this.assertAgentConfiguration(agentSnapshot, model);

    const profile = await tx.executionProfile.findFirst({
      where: {
        id: dto.executionProfileId,
        workspaceId,
        status: "PUBLISHED",
        archivedAt: null,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!profile) this.fail("EXECUTION_PROFILE_NOT_READY", "executionProfileId", "Execution profile must be published and belong to the workspace");
    const profileVersion = await tx.executionProfileVersion.findFirst({
      where: {
        profileId: profile.id,
        ...(dto.executionProfileVersionId ? { id: dto.executionProfileVersionId } : {})
      },
      orderBy: { revision: "desc" },
      select: { id: true, revision: true, snapshot: true }
    });
    if (!profileVersion || !this.validator.isRecord(profileVersion.snapshot)) {
      this.fail("EXECUTION_PROFILE_VERSION_INVALID", "executionProfileVersionId", "Published execution profile version is missing or invalid");
    }

    await this.validateConversation(tx, workspaceId, dto);
    const prompts = await this.resolvePrompts(tx, workspaceId, agentSnapshot);
    const normalized = this.resolveVariables(dto, workspace, request.metadata, agentSnapshot, prompts.definitions);
    if (normalized.issues.length) throw new RuntimeResolutionError(normalized.issues);

    const locale = dto.context.locale ?? workspace.language;
    const timezone = dto.context.timezone ?? workspace.timezone;
    const executionId = dto.executionRunId ?? request.id;
    const runtimeContext = {
      workspace: { id: workspace.id, language: workspace.language, timezone: workspace.timezone },
      execution: {
        requestId: request.id,
        runId: dto.executionRunId ?? null,
        id: executionId,
        correlationId: request.correlationId
      },
      actor: { id: actorId },
      conversation: {
        id: dto.conversation?.conversationId ?? null,
        parentExecutionRunId: dto.conversation?.parentExecutionRunId ?? null
      },
      request: dto.context.requestMetadata ?? {},
      environment: dto.context.environmentMetadata ?? {},
      tenant: dto.context.tenantMetadata ?? {},
      locale,
      timezone,
      traceId: dto.context.traceId
    };
    const promptStructure = {
      systemPrompt: prompts.references.find((item) => item.role === AgentPromptRole.SYSTEM) ?? null,
      developerPrompt: prompts.references.find((item) => item.role === AgentPromptRole.DEVELOPER) ?? null,
      userPrompt: prompts.references.find((item) => item.role === AgentPromptRole.USER_TEMPLATE) ?? null,
      libraryPrompts: prompts.references.filter((item) => item.role === AgentPromptRole.LIBRARY),
      assistantHistory: dto.prompt?.assistantHistory ?? [],
      metadataBlocks: dto.prompt?.metadataBlocks ?? [],
      attachments: dto.prompt?.attachments ?? [],
      templateReferences: dto.prompt?.templateReferences ?? []
    };
    const executionConfiguration = {
      agent: {
        revision: agentVersion.revision,
        runtimeConfiguration: this.record(agentSnapshot.runtimeConfiguration),
        temperature: agentSnapshot.temperature,
        topP: agentSnapshot.topP ?? null,
        maxTokens: agentSnapshot.maxTokens,
        stopSequences: Array.isArray(agentSnapshot.stopSequences) ? agentSnapshot.stopSequences : [],
        streamingEnabled: agentSnapshot.streamingEnabled === true,
        timeoutMs: agentSnapshot.timeoutMs,
        retryPolicy: this.record(agentSnapshot.retryPolicy),
        fallbackStrategy: this.record(agentSnapshot.fallbackStrategy),
        capabilities: this.record(agentSnapshot.capabilities)
      },
      provider: {
        providerId,
        modelId,
        providerConfigurationId: providerConfigId,
        settings: providerConfiguration.settings,
        providerConfiguration: this.record(agentSnapshot.providerConfiguration),
        modelConfiguration: this.record(agentSnapshot.modelConfiguration)
      },
      profile: {
        id: profile.id,
        versionId: profileVersion.id,
        revision: profileVersion.revision,
        snapshot: profileVersion.snapshot
      }
    };
    return {
      agentId: agent.id,
      agentVersionId: agentVersion.id,
      providerId,
      modelId,
      providerConfigurationId: providerConfigId,
      executionProfileId: profile.id,
      executionProfileVersionId: profileVersion.id,
      executionRequestId: request.id,
      executionRunId: dto.executionRunId ?? null,
      conversationId: dto.conversation?.conversationId ?? null,
      locale,
      timezone,
      correlationId: request.correlationId,
      executionId,
      traceId: dto.context.traceId,
      runtimeContext,
      promptReferences: prompts.references,
      promptStructure,
      runtimeVariables: normalized.variables,
      validationResult: this.validation(true, []),
      executionConfiguration,
      runtimeMetadata: {
        ...(dto.context.runtimeMetadata ?? {}),
        executionMetadata: dto.context.executionMetadata ?? {}
      },
      conversation: {
        conversationId: dto.conversation?.conversationId ?? null,
        parentExecutionRunId: dto.conversation?.parentExecutionRunId ?? null,
        historyReferences: dto.conversation?.historyReferences ?? [],
        memoryReferences: dto.conversation?.memoryReferences ?? [],
        participantMetadata: dto.conversation?.participantMetadata ?? {},
        tokenAccountingMetadata: dto.conversation?.tokenAccountingMetadata ?? {}
      }
    };
  }

  private async resolvePrompts(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    agentSnapshot: JsonRecord
  ) {
    const bindings = Array.isArray(agentSnapshot.promptBindings)
      ? agentSnapshot.promptBindings
      : [];
    const references: JsonRecord[] = [];
    const definitions: RuntimeVariableDefinition[] = [];
    for (const raw of bindings) {
      if (!this.validator.isRecord(raw)) {
        this.fail("PROMPT_BINDING_INVALID", "agentVersion.promptBindings", "Published agent contains an invalid prompt binding");
      }
      const promptId = this.requiredString(raw.promptId, "agentVersion.promptBindings.promptId");
      const role = this.requiredString(raw.role, "agentVersion.promptBindings.role");
      const prompt = await tx.promptLibraryItem.findFirst({
        where: {
          id: promptId,
          workspaceId,
          status: "PUBLISHED",
          deletedAt: null
        },
        select: { id: true, name: true, metadata: true }
      });
      if (!prompt) {
        this.fail("PROMPT_NOT_READY", `prompts.${promptId}`, "Prompt is deleted, archived, unpublished, or belongs to another workspace");
      }
      const promptVersionId = this.string(raw.promptVersionId);
      const version = await tx.promptLibraryVersion.findFirst({
        where: {
          promptId,
          publishedAt: { not: null },
          ...(promptVersionId ? { id: promptVersionId } : {})
        },
        orderBy: { revision: "desc" },
        select: { id: true, revision: true, snapshot: true, publishedAt: true }
      });
      if (!version || !this.validator.isRecord(version.snapshot)) {
        this.fail("PROMPT_VERSION_INVALID", `prompts.${promptId}.version`, "Published prompt version is missing or invalid");
      }
      const versionVariables = Array.isArray(version.snapshot.variables)
        ? version.snapshot.variables
        : [];
      const bindingVariables = Array.isArray(raw.variableMetadata)
        ? raw.variableMetadata
        : [];
      for (const value of versionVariables) {
        const definition = this.validator.definition(value);
        if (definition) definitions.push(definition);
      }
      for (const value of bindingVariables) {
        const definition = this.validator.definition(value);
        if (definition) definitions.push(definition);
      }
      references.push({
        role,
        promptId: prompt.id,
        promptVersionId: version.id,
        revision: version.revision,
        name: prompt.name,
        template: version.snapshot.draft ?? {},
        variables: versionVariables,
        metadata: {
          ...this.record(prompt.metadata),
          ...this.record(version.snapshot.metadata),
          binding: this.record(raw.metadata)
        }
      });
    }
    return { references, definitions };
  }

  private resolveVariables(
    dto: PrepareAgentRuntimeDto,
    workspace: { id: string; language: string; timezone: string },
    requestMetadata: Prisma.JsonValue,
    agentSnapshot: JsonRecord,
    definitions: RuntimeVariableDefinition[]
  ) {
    const requestVariables = this.arrayFromRecord(requestMetadata, "variables")
      .map((value) => this.validator.variable(value, RuntimeVariableSource.EXECUTION_REQUEST))
      .filter((value): value is RuntimeVariableDto => value !== null);
    const agentVariables = this.arrayFromRecord(agentSnapshot.runtimeConfiguration, "variables")
      .map((value) => this.validator.variable(value, RuntimeVariableSource.AGENT))
      .filter((value): value is RuntimeVariableDto => value !== null);
    const builtIns: RuntimeVariableDto[] = [
      { name: "workspace.id", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.WORKSPACE, value: workspace.id },
      { name: "workspace.locale", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.WORKSPACE, value: dto.context.locale ?? workspace.language },
      { name: "workspace.timezone", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.WORKSPACE, value: dto.context.timezone ?? workspace.timezone },
      { name: "execution.requestId", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.EXECUTION, value: dto.executionRequestId },
      { name: "execution.id", type: RuntimeVariableType.STRING, source: RuntimeVariableSource.EXECUTION, value: dto.executionRunId ?? dto.executionRequestId }
    ];
    return this.validator.normalizeVariables({
      supplied: [...requestVariables, ...(dto.variables ?? [])],
      defaults: agentVariables,
      definitions,
      builtIns
    });
  }

  private async validateConversation(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    dto: PrepareAgentRuntimeDto
  ) {
    if (dto.conversation?.conversationId) {
      const conversation = await tx.conversation.findFirst({
        where: {
          id: dto.conversation.conversationId,
          workspaceId,
          deletedAt: null
        },
        select: { id: true }
      });
      if (!conversation) {
        this.fail("CONVERSATION_INVALID", "conversation.conversationId", "Conversation must belong to the active workspace");
      }
    }
    if (dto.conversation?.parentExecutionRunId) {
      const parent = await tx.executionRun.findFirst({
        where: {
          id: dto.conversation.parentExecutionRunId,
          workspaceId
        },
        select: { id: true }
      });
      if (!parent) {
        this.fail("PARENT_EXECUTION_INVALID", "conversation.parentExecutionRunId", "Parent execution must belong to the active workspace");
      }
    }
  }

  private assertAgentConfiguration(
    snapshot: JsonRecord,
    model: {
      maxOutputTokens: number | null;
      supportsVision: boolean;
      supportsAudio: boolean;
      supportsTools: boolean;
      supportsReasoning: boolean;
      supportsStreaming: boolean;
    }
  ) {
    const maxTokens = this.number(snapshot.maxTokens);
    const timeoutMs = this.number(snapshot.timeoutMs);
    const temperature = this.number(snapshot.temperature);
    const topP = snapshot.topP === null ? null : this.number(snapshot.topP);
    if (!maxTokens || maxTokens <= 0 || maxTokens > (model.maxOutputTokens ?? Number.MAX_SAFE_INTEGER)) {
      this.fail("MAX_TOKENS_INVALID", "agentVersion.maxTokens", "Agent maxTokens is outside the model limit");
    }
    if (!timeoutMs || timeoutMs < 100 || timeoutMs > 900000) {
      this.fail("TIMEOUT_INVALID", "agentVersion.timeoutMs", "Agent timeout must be between 100 and 900000 milliseconds");
    }
    if (temperature === null || temperature < 0 || temperature > 2) {
      this.fail("TEMPERATURE_INVALID", "agentVersion.temperature", "Agent temperature must be between 0 and 2");
    }
    if (topP !== null && (topP < 0 || topP > 1)) {
      this.fail("TOP_P_INVALID", "agentVersion.topP", "Agent topP must be between 0 and 1");
    }
    const capabilities = this.record(snapshot.capabilities);
    if (capabilities.visionEnabled === true && !model.supportsVision) this.fail("CAPABILITY_INVALID", "agentVersion.capabilities.visionEnabled", "Model does not support vision");
    if (capabilities.voiceEnabled === true && !model.supportsAudio) this.fail("CAPABILITY_INVALID", "agentVersion.capabilities.voiceEnabled", "Model does not support voice");
    if (capabilities.toolsEnabled === true && !model.supportsTools) this.fail("CAPABILITY_INVALID", "agentVersion.capabilities.toolsEnabled", "Model does not support tools");
    if (capabilities.reasoningEnabled === true && !model.supportsReasoning) this.fail("CAPABILITY_INVALID", "agentVersion.capabilities.reasoningEnabled", "Model does not support reasoning");
    if (snapshot.streamingEnabled === true && !model.supportsStreaming) this.fail("CAPABILITY_INVALID", "agentVersion.streamingEnabled", "Model does not support streaming");
    if (!this.validator.isRecord(snapshot.retryPolicy) || !this.validator.isRecord(snapshot.fallbackStrategy)) {
      this.fail("POLICY_INVALID", "agentVersion", "Agent retry and fallback policies must be objects");
    }
  }

  private readonly runtimeSelect = {
    id: true,
    workspaceId: true,
    actorId: true,
    agentId: true,
    agentVersionId: true,
    providerId: true,
    modelId: true,
    providerConfigurationId: true,
    executionProfileId: true,
    executionProfileVersionId: true,
    executionRequestId: true,
    executionRunId: true,
    conversationId: true,
    status: true,
    locale: true,
    timezone: true,
    correlationId: true,
    executionId: true,
    traceId: true,
    preparationInput: true,
    runtimeContext: true,
    promptStructure: true,
    runtimeVariables: true,
    validationResult: true,
    executionConfiguration: true,
    runtimeMetadata: true,
    createdAt: true,
    updatedAt: true,
    validatedAt: true
  } as const;

  private readonly snapshotSelect = {
    id: true,
    workspaceId: true,
    runtimeId: true,
    createdById: true,
    agentId: true,
    agentVersionId: true,
    providerId: true,
    modelId: true,
    providerConfigurationId: true,
    executionProfileId: true,
    executionProfileVersionId: true,
    executionRequestId: true,
    executionRunId: true,
    conversationId: true,
    correlationId: true,
    executionId: true,
    traceId: true,
    runtimeContext: true,
    promptReferences: true,
    promptStructure: true,
    runtimeVariables: true,
    runtimeMetadata: true,
    executionConfiguration: true,
    contentHash: true,
    createdAt: true
  } as const;

  private requireRuntime(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    runtimeId: string,
    includeRelated = false
  ) {
    return client.agentRuntimePreparation.findFirst({
      where: { id: runtimeId, workspaceId },
      select: includeRelated
        ? {
            ...this.runtimeSelect,
            conversationContext: true,
            snapshot: { select: this.snapshotSelect }
          }
        : this.runtimeSelect
    }).then((runtime) => {
      if (!runtime) throw new NotFoundException("Agent runtime was not found");
      return runtime;
    });
  }

  private referenceData(resolved: ResolvedRuntime) {
    return {
      agentId: resolved.agentId,
      agentVersionId: resolved.agentVersionId,
      providerId: resolved.providerId,
      modelId: resolved.modelId,
      providerConfigurationId: resolved.providerConfigurationId,
      executionProfileId: resolved.executionProfileId,
      executionProfileVersionId: resolved.executionProfileVersionId,
      executionRequestId: resolved.executionRequestId,
      executionRunId: resolved.executionRunId,
      conversationId: resolved.conversationId
    };
  }

  private validation(valid: boolean, issues: RuntimeValidationIssue[]): JsonRecord {
    return {
      valid,
      issues,
      validatedAt: new Date().toISOString()
    };
  }

  private readInput(value: Prisma.JsonValue): PrepareAgentRuntimeDto {
    if (!this.validator.isRecord(value) || typeof value.agentId !== "string") {
      throw new ConflictException("Stored agent runtime preparation input is invalid");
    }
    return value as unknown as PrepareAgentRuntimeDto;
  }

  private agentSnapshot(value: Prisma.JsonValue): JsonRecord {
    if (!this.validator.isRecord(value)) {
      this.fail("AGENT_VERSION_INVALID", "agentVersion", "Published agent version snapshot is invalid");
    }
    return value;
  }

  private record(value: unknown): JsonRecord {
    return this.validator.isRecord(value) ? value : {};
  }

  private arrayFromRecord(value: unknown, key: string): unknown[] {
    const record = this.record(value);
    return Array.isArray(record[key]) ? record[key] : [];
  }

  private string(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private requiredString(value: unknown, path: string): string {
    const result = this.string(value);
    if (!result) this.fail("CONFIGURATION_INVALID", path, "Required published configuration value is missing");
    return result;
  }

  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private fail(code: string, path: string, message: string): never {
    throw new RuntimeResolutionError([{ code, path, message }]);
  }

  private clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private hash(value: unknown): string {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private async auditRejected(
    workspaceId: string,
    actorId: string,
    agentId: string,
    action: string,
    issues: RuntimeValidationIssue[]
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        userId: actorId,
        action,
        entityType: "AiAgent",
        entityId: agentId,
        oldValues: Prisma.JsonNull,
        newValues: json({ validation: this.validation(false, issues) })
      }
    });
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
    await tx.auditLog.create({
      data: {
        workspaceId,
        userId: actorId,
        action,
        entityType,
        entityId,
        oldValues: before === null ? Prisma.JsonNull : json(before),
        newValues: after === null ? Prisma.JsonNull : json(after)
      }
    });
  }
}
