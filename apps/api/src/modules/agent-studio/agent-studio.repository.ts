import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPromptRole,
  AgentStatus,
  AgentVisibility,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AgentCapabilitiesDto,
  AgentConfigurationDto,
  AgentPromptBindingDto
} from "./dto/agent-studio.dto";

type JsonRecord = Record<string, unknown>;

export type AgentDraftInput = {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  avatarMetadata?: JsonRecord;
  colorMetadata?: JsonRecord;
  iconMetadata?: JsonRecord;
  visibility?: AgentVisibility;
  configuration?: AgentConfigurationDto;
  capabilities?: AgentCapabilitiesDto;
  promptBindings?: AgentPromptBindingDto[];
};

type AgentSnapshot = {
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  avatarMetadata: JsonRecord;
  colorMetadata: JsonRecord;
  iconMetadata: JsonRecord;
  visibility: AgentVisibility;
  providerId: string;
  modelId: string;
  providerConfigurationId: string | null;
  providerConfiguration: JsonRecord;
  modelConfiguration: JsonRecord;
  runtimeConfiguration: JsonRecord;
  temperature: number;
  topP: number | null;
  maxTokens: number;
  stopSequences: string[];
  streamingEnabled: boolean;
  timeoutMs: number;
  retryPolicy: JsonRecord;
  fallbackStrategy: JsonRecord;
  capabilities: {
    knowledgeEnabled: boolean;
    toolsEnabled: boolean;
    memoryEnabled: boolean;
    visionEnabled: boolean;
    reasoningEnabled: boolean;
    voiceEnabled: boolean;
    imageEnabled: boolean;
    moderationEnabled: boolean;
    metadata: JsonRecord;
  };
  promptBindings: Array<{
    role: AgentPromptRole;
    promptId: string;
    promptVersionId: string | null;
    variableMetadata: unknown[];
    metadata: JsonRecord;
  }>;
};

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

@Injectable()
export class AgentStudioRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    workspaceId: string;
    actorId: string;
    name: string;
    slug: string;
    description?: string;
    category?: string;
    avatarMetadata?: JsonRecord;
    colorMetadata?: JsonRecord;
    iconMetadata?: JsonRecord;
    visibility?: AgentVisibility;
    configuration: AgentConfigurationDto;
    capabilities?: AgentCapabilitiesDto;
    promptBindings?: AgentPromptBindingDto[];
  }) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        await this.validateConfiguration(
          tx,
          input.workspaceId,
          input.configuration,
          input.capabilities
        );
        await this.validateBindings(tx, input.workspaceId, input.promptBindings ?? []);
        const agent = await tx.aiAgent.create({
          data: {
            workspaceId: input.workspaceId,
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            avatarMetadata: json(input.avatarMetadata ?? {}),
            colorMetadata: json(input.colorMetadata ?? {}),
            iconMetadata: json(input.iconMetadata ?? {}),
            visibility: input.visibility ?? "WORKSPACE",
            personality: null,
            prompt: "",
            ...this.configurationData(input.configuration),
            ...this.capabilityData(input.capabilities),
            status: "DRAFT",
            version: 0,
            createdById: input.actorId,
            updatedById: input.actorId,
            promptBindings: {
              create: this.bindingData(input.promptBindings ?? [])
            }
          },
          select: this.agentSelect
        });
        await this.audit(
          tx,
          input.workspaceId,
          input.actorId,
          "agent.studio.created",
          agent.id,
          null,
          agent
        );
        return agent;
      })
    );
  }

  updateDraft(input: {
    workspaceId: string;
    actorId: string;
    agentId: string;
    draft: AgentDraftInput;
  }) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireAgent(tx, input.workspaceId, input.agentId);
        this.assertDraft(current.status);
        if (input.draft.configuration) {
          await this.validateConfiguration(
            tx,
            input.workspaceId,
            input.draft.configuration,
            input.draft.capabilities ?? {
              knowledgeEnabled: current.knowledgeEnabled,
              toolsEnabled: current.toolsEnabled,
              memoryEnabled: current.memoryEnabled,
              visionEnabled: current.visionEnabled,
              reasoningEnabled: current.reasoningEnabled,
              voiceEnabled: current.voiceEnabled,
              imageEnabled: current.imageEnabled,
              streamingEnabled: current.streamingEnabled,
              moderationEnabled: current.moderationEnabled,
              metadata: record(current.capabilitiesMetadata)
            }
          );
        } else if (input.draft.capabilities) {
          await this.validateCapabilitiesAgainstModel(
            tx,
            current.modelId,
            current.maxTokens,
            input.draft.capabilities
          );
        }
        if (input.draft.promptBindings) {
          await this.validateBindings(tx, input.workspaceId, input.draft.promptBindings);
        }
        const agent = await tx.aiAgent.update({
          where: { id: current.id },
          data: {
            name: input.draft.name,
            slug: input.draft.slug,
            description: input.draft.description,
            category: input.draft.category,
            avatarMetadata:
              input.draft.avatarMetadata === undefined
                ? undefined
                : json(input.draft.avatarMetadata),
            colorMetadata:
              input.draft.colorMetadata === undefined ? undefined : json(input.draft.colorMetadata),
            iconMetadata:
              input.draft.iconMetadata === undefined ? undefined : json(input.draft.iconMetadata),
            visibility: input.draft.visibility,
            ...(input.draft.configuration
              ? this.configurationData(input.draft.configuration)
              : {}),
            ...(input.draft.capabilities ? this.capabilityData(input.draft.capabilities) : {}),
            updatedById: input.actorId,
            promptBindings:
              input.draft.promptBindings === undefined
                ? undefined
                : {
                    deleteMany: {},
                    create: this.bindingData(input.draft.promptBindings)
                  }
          },
          select: this.agentSelect
        });
        await this.audit(
          tx,
          input.workspaceId,
          input.actorId,
          "agent.studio.draft_updated",
          agent.id,
          current,
          agent
        );
        return agent;
      })
    );
  }

  publish(input: {
    workspaceId: string;
    actorId: string;
    agentId: string;
    changeSummary?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireAgent(tx, input.workspaceId, input.agentId);
      this.assertDraft(current.status);
      const revision = current.version + 1;
      const snapshot = this.snapshot(current);
      const version = await tx.aiAgentVersion.create({
        data: {
          agentId: current.id,
          revision,
          snapshot: json(snapshot),
          changeSummary: input.changeSummary,
          createdById: input.actorId,
          publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const agent = await tx.aiAgent.update({
        where: { id: current.id },
        data: {
          status: "PUBLISHED",
          version: revision,
          updatedById: input.actorId
        },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        input.workspaceId,
        input.actorId,
        "agent.studio.published",
        agent.id,
        current,
        { agent, version }
      );
      return { agent, version };
    });
  }

  rollback(input: {
    workspaceId: string;
    actorId: string;
    agentId: string;
    revision: number;
    changeSummary?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireAgent(tx, input.workspaceId, input.agentId);
      const source = await tx.aiAgentVersion.findFirst({
        where: {
          agentId: current.id,
          revision: input.revision,
          agent: { workspaceId: input.workspaceId }
        },
        select: this.versionSelect
      });
      if (!source) throw new NotFoundException("Published agent version was not found");
      const snapshot = this.readSnapshot(source.snapshot);
      await this.validateSnapshotReferences(tx, input.workspaceId, snapshot);
      const revision = current.version + 1;
      const version = await tx.aiAgentVersion.create({
        data: {
          agentId: current.id,
          revision,
          snapshot: json(snapshot),
          changeSummary: input.changeSummary ?? `Rollback to revision ${input.revision}`,
          createdById: input.actorId,
          publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const agent = await tx.aiAgent.update({
        where: { id: current.id },
        data: {
          ...this.snapshotData(snapshot),
          status: "PUBLISHED",
          version: revision,
          updatedById: input.actorId,
          archivedAt: null,
          deletedAt: null,
          promptBindings: {
            deleteMany: {},
            create: this.bindingData(snapshot.promptBindings)
          }
        },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        input.workspaceId,
        input.actorId,
        "agent.studio.rolled_back",
        agent.id,
        current,
        { sourceRevision: input.revision, agent, version }
      );
      return { agent, version };
    });
  }

  clone(input: {
    workspaceId: string;
    actorId: string;
    agentId: string;
    name: string;
    slug: string;
  }) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const source = await this.requireAgent(tx, input.workspaceId, input.agentId, true);
        const snapshot = this.snapshot(source);
        await this.validateSnapshotReferences(tx, input.workspaceId, snapshot);
        const agent = await tx.aiAgent.create({
          data: {
            workspaceId: input.workspaceId,
            ...this.snapshotData({ ...snapshot, name: input.name, slug: input.slug }),
            name: input.name,
            slug: input.slug,
            personality: null,
            prompt: "",
            status: "DRAFT",
            version: 0,
            createdById: input.actorId,
            updatedById: input.actorId,
            archivedAt: null,
            deletedAt: null,
            promptBindings: {
              create: this.bindingData(snapshot.promptBindings)
            }
          },
          select: this.agentSelect
        });
        await this.audit(
          tx,
          input.workspaceId,
          input.actorId,
          "agent.studio.cloned",
          agent.id,
          null,
          { sourceAgentId: source.id, agent }
        );
        return agent;
      })
    );
  }

  archive(workspaceId: string, actorId: string, agentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireAgent(tx, workspaceId, agentId);
      const agent = await tx.aiAgent.update({
        where: { id: current.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedById: actorId
        },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.archived",
        agent.id,
        current,
        agent
      );
      return agent;
    });
  }

  restore(workspaceId: string, actorId: string, agentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireAgent(tx, workspaceId, agentId, true);
      if (current.status !== "ARCHIVED" && current.deletedAt === null) {
        throw new ConflictException("Only archived or deleted agents can be restored");
      }
      const agent = await tx.aiAgent.update({
        where: { id: current.id },
        data: {
          status: current.version > 0 ? "PUBLISHED" : "DRAFT",
          archivedAt: null,
          deletedAt: null,
          updatedById: actorId
        },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.restored",
        agent.id,
        current,
        agent
      );
      return agent;
    });
  }

  softDelete(workspaceId: string, actorId: string, agentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireAgent(tx, workspaceId, agentId);
      const now = new Date();
      const agent = await tx.aiAgent.update({
        where: { id: current.id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
          deletedAt: now,
          updatedById: actorId
        },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.deleted",
        agent.id,
        current,
        agent
      );
      return agent;
    });
  }

  get(workspaceId: string, agentId: string) {
    return this.requireAgent(this.prisma, workspaceId, agentId);
  }

  async history(workspaceId: string, agentId: string) {
    await this.requireAgent(this.prisma, workspaceId, agentId, true);
    return this.prisma.aiAgentVersion.findMany({
      where: { agentId, agent: { workspaceId } },
      orderBy: { revision: "desc" },
      select: this.versionSelect
    });
  }

  async list(input: {
    workspaceId: string;
    page: number;
    limit: number;
    search?: string;
    status?: AgentStatus;
    visibility?: AgentVisibility;
    category?: string;
  }) {
    const where: Prisma.AiAgentWhereInput = {
      workspaceId: input.workspaceId,
      deletedAt: null,
      status: input.status,
      visibility: input.visibility,
      category: input.category,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.aiAgent.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: this.agentSelect
      }),
      this.prisma.aiAgent.count({ where })
    ]);
    return {
      data,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit)
      }
    };
  }

  private readonly bindingSelect = {
    id: true,
    role: true,
    promptId: true,
    promptVersionId: true,
    variableMetadata: true,
    metadata: true,
    createdAt: true,
    updatedAt: true
  } as const;

  private readonly agentSelect = {
    id: true,
    workspaceId: true,
    name: true,
    slug: true,
    description: true,
    category: true,
    avatarMetadata: true,
    colorMetadata: true,
    iconMetadata: true,
    status: true,
    visibility: true,
    providerId: true,
    modelId: true,
    providerConfigurationId: true,
    providerConfiguration: true,
    modelConfiguration: true,
    runtimeConfiguration: true,
    temperature: true,
    topP: true,
    maxTokens: true,
    stopSequences: true,
    streamingEnabled: true,
    timeoutMs: true,
    retryPolicy: true,
    fallbackStrategy: true,
    memoryEnabled: true,
    knowledgeEnabled: true,
    toolsEnabled: true,
    visionEnabled: true,
    reasoningEnabled: true,
    voiceEnabled: true,
    imageEnabled: true,
    moderationEnabled: true,
    capabilitiesMetadata: true,
    version: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
    deletedAt: true,
    promptBindings: {
      select: this.bindingSelect,
      orderBy: { role: "asc" as const }
    }
  } as const;

  private readonly versionSelect = {
    id: true,
    agentId: true,
    revision: true,
    snapshot: true,
    changeSummary: true,
    createdById: true,
    createdAt: true,
    publishedAt: true
  } as const;

  private requireAgent(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    agentId: string,
    includeDeleted = false
  ) {
    return client.aiAgent
      .findFirst({
        where: { id: agentId, workspaceId, ...(includeDeleted ? {} : { deletedAt: null }) },
        select: this.agentSelect
      })
      .then((agent) => {
        if (!agent) throw new NotFoundException("Agent was not found");
        return agent;
      });
  }

  private async validateConfiguration(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    configuration: AgentConfigurationDto,
    capabilities?: AgentCapabilitiesDto
  ) {
    const model = await tx.aiModel.findFirst({
      where: {
        id: configuration.modelId,
        providerId: configuration.providerId,
        status: { not: "DEPRECATED" },
        provider: { status: { not: "DISABLED" } }
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
    if (!model) throw new BadRequestException("Provider and model configuration is invalid");
    if (configuration.maxTokens > (model.maxOutputTokens ?? Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException("Max tokens exceeds the selected model limit");
    }
    if (configuration.providerConfigurationId) {
      const providerConfiguration = await tx.aiProviderConfiguration.findFirst({
        where: {
          id: configuration.providerConfigurationId,
          workspaceId,
          providerId: configuration.providerId,
          enabled: true,
          deletedAt: null
        },
        select: { id: true }
      });
      if (!providerConfiguration) {
        throw new BadRequestException(
          "Provider configuration is not available in this workspace"
        );
      }
    }
    this.assertCapabilities(model, capabilities, configuration.streaming);
  }

  private async validateCapabilitiesAgainstModel(
    tx: Prisma.TransactionClient,
    modelId: string,
    maxTokens: number,
    capabilities: AgentCapabilitiesDto
  ) {
    const model = await tx.aiModel.findFirst({
      where: { id: modelId },
      select: {
        maxOutputTokens: true,
        supportsVision: true,
        supportsAudio: true,
        supportsTools: true,
        supportsReasoning: true,
        supportsStreaming: true
      }
    });
    if (!model) throw new BadRequestException("Configured model was not found");
    if (maxTokens > (model.maxOutputTokens ?? Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException("Max tokens exceeds the selected model limit");
    }
    this.assertCapabilities(model, capabilities, capabilities.streamingEnabled);
  }

  private assertCapabilities(
    model: {
      supportsVision: boolean;
      supportsAudio: boolean;
      supportsTools: boolean;
      supportsReasoning: boolean;
      supportsStreaming: boolean;
    },
    capabilities?: AgentCapabilitiesDto,
    streaming?: boolean
  ) {
    if (capabilities?.visionEnabled && !model.supportsVision) {
      throw new BadRequestException("Selected model does not support vision");
    }
    if (capabilities?.voiceEnabled && !model.supportsAudio) {
      throw new BadRequestException("Selected model does not support voice");
    }
    if (capabilities?.toolsEnabled && !model.supportsTools) {
      throw new BadRequestException("Selected model does not support tools");
    }
    if (capabilities?.reasoningEnabled && !model.supportsReasoning) {
      throw new BadRequestException("Selected model does not support reasoning");
    }
    if ((streaming || capabilities?.streamingEnabled) && !model.supportsStreaming) {
      throw new BadRequestException("Selected model does not support streaming");
    }
  }

  private async validateBindings(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    bindings: AgentPromptBindingDto[]
  ) {
    const keys = bindings.map((binding) => `${binding.role}:${binding.promptId}`);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException("Agent prompt bindings must be unique by role and prompt");
    }
    for (const role of [
      AgentPromptRole.SYSTEM,
      AgentPromptRole.DEVELOPER,
      AgentPromptRole.USER_TEMPLATE
    ]) {
      if (bindings.filter((binding) => binding.role === role).length > 1) {
        throw new BadRequestException(`Only one ${role} prompt binding is allowed`);
      }
    }
    if (bindings.length === 0) return;
    const promptIds = [...new Set(bindings.map((binding) => binding.promptId))];
    const promptCount = await tx.promptLibraryItem.count({
      where: { workspaceId, id: { in: promptIds }, deletedAt: null }
    });
    if (promptCount !== promptIds.length) {
      throw new BadRequestException("One or more prompts are not available in this workspace");
    }
    const versionBindings = bindings.filter(
      (binding): binding is AgentPromptBindingDto & { promptVersionId: string } =>
        binding.promptVersionId !== undefined
    );
    if (versionBindings.length) {
      const validVersions = await tx.promptLibraryVersion.findMany({
        where: {
          OR: versionBindings.map((binding) => ({
            id: binding.promptVersionId,
            promptId: binding.promptId,
            publishedAt: { not: null },
            prompt: { workspaceId }
          }))
        },
        select: { id: true }
      });
      if (validVersions.length !== new Set(versionBindings.map((item) => item.promptVersionId)).size) {
        throw new BadRequestException("One or more prompt versions are invalid");
      }
    }
  }

  private validateSnapshotReferences(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    snapshot: AgentSnapshot
  ) {
    return Promise.all([
      this.validateConfiguration(
        tx,
        workspaceId,
        {
          providerId: snapshot.providerId,
          modelId: snapshot.modelId,
          providerConfigurationId: snapshot.providerConfigurationId ?? undefined,
          providerConfiguration: snapshot.providerConfiguration,
          modelConfiguration: snapshot.modelConfiguration,
          runtimeConfiguration: snapshot.runtimeConfiguration,
          temperature: snapshot.temperature,
          topP: snapshot.topP ?? undefined,
          maxTokens: snapshot.maxTokens,
          stopSequences: snapshot.stopSequences,
          streaming: snapshot.streamingEnabled,
          timeoutMs: snapshot.timeoutMs,
          retryPolicy: snapshot.retryPolicy as unknown as AgentConfigurationDto["retryPolicy"],
          fallbackStrategy: snapshot.fallbackStrategy
        },
        {
          ...snapshot.capabilities,
          streamingEnabled: snapshot.streamingEnabled,
          metadata: snapshot.capabilities.metadata
        }
      ),
      this.validateBindings(
        tx,
        workspaceId,
        snapshot.promptBindings.map((binding) => ({
          ...binding,
          promptVersionId: binding.promptVersionId ?? undefined,
          variableMetadata:
            binding.variableMetadata as AgentPromptBindingDto["variableMetadata"]
        }))
      )
    ]);
  }

  private configurationData(configuration: AgentConfigurationDto) {
    return {
      providerId: configuration.providerId,
      modelId: configuration.modelId,
      providerConfigurationId: configuration.providerConfigurationId,
      providerConfiguration: json(configuration.providerConfiguration ?? {}),
      modelConfiguration: json(configuration.modelConfiguration ?? {}),
      runtimeConfiguration: json(configuration.runtimeConfiguration ?? {}),
      temperature: configuration.temperature,
      topP: configuration.topP,
      maxTokens: configuration.maxTokens,
      stopSequences: configuration.stopSequences ?? [],
      streamingEnabled: configuration.streaming ?? false,
      timeoutMs: configuration.timeoutMs ?? 30000,
      retryPolicy: json(configuration.retryPolicy ?? {}),
      fallbackStrategy: json(configuration.fallbackStrategy ?? {}),
      fallbackEnabled: Object.keys(configuration.fallbackStrategy ?? {}).length > 0
    };
  }

  private capabilityData(capabilities?: AgentCapabilitiesDto) {
    return {
      knowledgeEnabled: capabilities?.knowledgeEnabled ?? false,
      toolsEnabled: capabilities?.toolsEnabled ?? false,
      memoryEnabled: capabilities?.memoryEnabled ?? false,
      visionEnabled: capabilities?.visionEnabled ?? false,
      reasoningEnabled: capabilities?.reasoningEnabled ?? false,
      voiceEnabled: capabilities?.voiceEnabled ?? false,
      imageEnabled: capabilities?.imageEnabled ?? false,
      moderationEnabled: capabilities?.moderationEnabled ?? false,
      capabilitiesMetadata: json(capabilities?.metadata ?? {}),
      ...(capabilities?.streamingEnabled === undefined
        ? {}
        : { streamingEnabled: capabilities.streamingEnabled })
    };
  }

  private bindingData(
    bindings: Array<{
      role: AgentPromptRole;
      promptId: string;
      promptVersionId?: string | null;
      variableMetadata?: unknown[];
      metadata?: JsonRecord;
    }>
  ) {
    return bindings.map((binding) => ({
      role: binding.role,
      promptId: binding.promptId,
      promptVersionId: binding.promptVersionId ?? undefined,
      variableMetadata: json(binding.variableMetadata ?? []),
      metadata: json(binding.metadata ?? {})
    }));
  }

  private snapshot(agent: Awaited<ReturnType<AgentStudioRepository["requireAgent"]>>): AgentSnapshot {
    return {
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      category: agent.category,
      avatarMetadata: record(agent.avatarMetadata),
      colorMetadata: record(agent.colorMetadata),
      iconMetadata: record(agent.iconMetadata),
      visibility: agent.visibility,
      providerId: agent.providerId,
      modelId: agent.modelId,
      providerConfigurationId: agent.providerConfigurationId,
      providerConfiguration: record(agent.providerConfiguration),
      modelConfiguration: record(agent.modelConfiguration),
      runtimeConfiguration: record(agent.runtimeConfiguration),
      temperature: agent.temperature.toNumber(),
      topP: agent.topP?.toNumber() ?? null,
      maxTokens: agent.maxTokens,
      stopSequences: agent.stopSequences,
      streamingEnabled: agent.streamingEnabled,
      timeoutMs: agent.timeoutMs,
      retryPolicy: record(agent.retryPolicy),
      fallbackStrategy: record(agent.fallbackStrategy),
      capabilities: {
        knowledgeEnabled: agent.knowledgeEnabled,
        toolsEnabled: agent.toolsEnabled,
        memoryEnabled: agent.memoryEnabled,
        visionEnabled: agent.visionEnabled,
        reasoningEnabled: agent.reasoningEnabled,
        voiceEnabled: agent.voiceEnabled,
        imageEnabled: agent.imageEnabled,
        moderationEnabled: agent.moderationEnabled,
        metadata: record(agent.capabilitiesMetadata)
      },
      promptBindings: agent.promptBindings.map((binding) => ({
        role: binding.role,
        promptId: binding.promptId,
        promptVersionId: binding.promptVersionId,
        variableMetadata: Array.isArray(binding.variableMetadata)
          ? binding.variableMetadata
          : [],
        metadata: record(binding.metadata)
      }))
    };
  }

  private snapshotData(snapshot: AgentSnapshot) {
    return {
      name: snapshot.name,
      slug: snapshot.slug,
      description: snapshot.description,
      category: snapshot.category,
      avatarMetadata: json(snapshot.avatarMetadata),
      colorMetadata: json(snapshot.colorMetadata),
      iconMetadata: json(snapshot.iconMetadata),
      visibility: snapshot.visibility,
      providerId: snapshot.providerId,
      modelId: snapshot.modelId,
      providerConfigurationId: snapshot.providerConfigurationId,
      providerConfiguration: json(snapshot.providerConfiguration),
      modelConfiguration: json(snapshot.modelConfiguration),
      runtimeConfiguration: json(snapshot.runtimeConfiguration),
      temperature: snapshot.temperature,
      topP: snapshot.topP,
      maxTokens: snapshot.maxTokens,
      stopSequences: snapshot.stopSequences,
      streamingEnabled: snapshot.streamingEnabled,
      timeoutMs: snapshot.timeoutMs,
      retryPolicy: json(snapshot.retryPolicy),
      fallbackStrategy: json(snapshot.fallbackStrategy),
      fallbackEnabled: Object.keys(snapshot.fallbackStrategy).length > 0,
      knowledgeEnabled: snapshot.capabilities.knowledgeEnabled,
      toolsEnabled: snapshot.capabilities.toolsEnabled,
      memoryEnabled: snapshot.capabilities.memoryEnabled,
      visionEnabled: snapshot.capabilities.visionEnabled,
      reasoningEnabled: snapshot.capabilities.reasoningEnabled,
      voiceEnabled: snapshot.capabilities.voiceEnabled,
      imageEnabled: snapshot.capabilities.imageEnabled,
      moderationEnabled: snapshot.capabilities.moderationEnabled,
      capabilitiesMetadata: json(snapshot.capabilities.metadata)
    };
  }

  private readSnapshot(value: Prisma.JsonValue): AgentSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("Published agent version has an invalid snapshot");
    }
    const snapshot = value as Record<string, unknown>;
    const requiredStrings = ["name", "providerId", "modelId"];
    const valid =
      requiredStrings.every((key) => typeof snapshot[key] === "string") &&
      typeof snapshot.maxTokens === "number" &&
      typeof snapshot.temperature === "number" &&
      typeof snapshot.streamingEnabled === "boolean" &&
      typeof snapshot.timeoutMs === "number" &&
      Array.isArray(snapshot.stopSequences) &&
      Array.isArray(snapshot.promptBindings) &&
      snapshot.capabilities !== null &&
      typeof snapshot.capabilities === "object";
    if (!valid) throw new ConflictException("Published agent version has an invalid snapshot");
    return snapshot as AgentSnapshot;
  }

  private assertDraft(status: AgentStatus) {
    if (status !== "DRAFT") throw new BadRequestException("Only draft agents can be modified");
  }

  private async audit(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    action: string,
    agentId: string,
    before: unknown,
    after: unknown
  ) {
    await tx.auditLog.create({
      data: {
        workspaceId,
        userId: actorId,
        action,
        entityType: "AiAgent",
        entityId: agentId,
        oldValues: before === null ? Prisma.JsonNull : json(before),
        newValues: after === null ? Prisma.JsonNull : json(after)
      }
    });
  }

  private async withUniqueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An agent with this name or slug already exists");
      }
      throw error;
    }
  }
}
