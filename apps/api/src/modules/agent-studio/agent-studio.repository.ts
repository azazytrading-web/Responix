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
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  AgentCapabilitiesDto,
  AgentConfigurationDto,
  AgentPromptBindingDto,
  ConversationHistoryConfigDto
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
  retrievalRuntimeId: string | null;
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
    conversationHistory?: ConversationHistoryConfigDto;
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
            // Conversation history is an operational working-context flag stored
            // in runtimeConfiguration (no dedicated column). New Agents default
            // to OFF so history is explicit opt-in under the Context Isolation
            // architecture; the user can enable it from Agent Studio.
            runtimeConfiguration: json({
              ...record(input.configuration.runtimeConfiguration),
              conversationHistory: input.conversationHistory ?? { enabled: false }
            }),
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

  async revertFailedPublish(
    workspaceId: string,
    actorId: string,
    agentId: string,
    versionId: string
  ) {
    await this.prisma.$transaction(async (tx) => {
      const version = await tx.aiAgentVersion.findFirst({
        where: { id: versionId, agentId, agent: { workspaceId } },
        select: { revision: true }
      });
      if (!version) return;
      await tx.aiAgent.updateMany({
        where: { id: agentId, workspaceId, version: version.revision, status: "PUBLISHED" },
        data: { status: "DRAFT", updatedById: actorId }
      });
      // Keep the immutable failed revision: runtime preparation may already have
      // persisted assets that correctly reference it. A retry publishes the next
      // revision, while the mutable Agent is never left advertised as PUBLISHED.
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
      await this.assertNotActiveOnChannel(tx, workspaceId, current.id);
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
      if (current.status !== "DRAFT" && current.status !== "ARCHIVED") {
        throw new BadRequestException("Only draft or archived agents can be deleted");
      }
      await this.assertNotActiveOnChannel(tx, workspaceId, current.id);
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

  async switchChannelAgent(
    workspaceId: string,
    actorId: string,
    agentId: string,
    connectionId: string,
    expectedStateVersion: number
  ) {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.requireAgent(tx, workspaceId, agentId);
      if (target.status !== "PUBLISHED") {
        throw new ConflictException({
          message: "Only published agents can be bound to a channel connection",
          code: "AGENT_NOT_PUBLISHED"
        });
      }
      const connection = await tx.channelConnection.findFirst({
        where: { id: connectionId, workspaceId },
        select: { id: true, channelId: true, stateVersion: true }
      });
      if (!connection) throw new NotFoundException("Channel connection was not found");
      if (connection.stateVersion !== expectedStateVersion) {
        throw new ConflictException({
          message: "Channel connection state changed",
          code: "CHANNEL_CONNECTION_STATE_CHANGED"
        });
      }
      const targetSnapshots = await tx.agentRuntimeSnapshot.findMany({
        where: { workspaceId, agentId: target.id }, select: { id: true }
      });
      const orchestration = targetSnapshots.length
        ? await tx.agentExecutionOrchestration.findFirst({
            where: {
              workspaceId,
              status: "READY",
              agentRuntimeSnapshotId: { in: targetSnapshots.map((snapshot) => snapshot.id) }
            },
            orderBy: { createdAt: "desc" },
            select: {
              agentRuntimeSnapshotId: true,
              promptExecutionPayloadId: true,
              providerRuntimeSnapshotId: true,
              conversationRuntimeSnapshotId: true,
              executionPipelineSnapshotId: true,
              orchestrationPlan: true
            }
          })
        : null;
      if (!orchestration) {
        throw new ConflictException({
          message: "Agent has no valid runtime package and cannot be bound to this channel yet",
          code: "AGENT_NOT_CHANNEL_READY"
        });
      }
      const latest = await tx.channelConfiguration.findFirst({
        where: { connectionId },
        orderBy: { revision: "desc" },
        select: { revision: true, configuration: true }
      });
      const current = record(latest?.configuration);
      const orchestrationPlan = record(orchestration.orchestrationPlan);
      const orchestrationAssets = record(orchestrationPlan.assets);
      const memorySnapshotIds = Array.isArray(orchestrationAssets.memoryRuntimeSnapshotIds)
        ? orchestrationAssets.memoryRuntimeSnapshotIds.filter((id): id is string => typeof id === "string")
        : [];
      const memorySnapshots = memorySnapshotIds.length
        ? await tx.memoryRuntimeSnapshot.findMany({
            where: { workspaceId, id: { in: memorySnapshotIds } },
            select: { id: true, runtimeId: true }
          })
        : [];
      if (memorySnapshots.length !== memorySnapshotIds.length) {
        throw new ConflictException("Agent memory runtime package is incomplete");
      }
      const memoryRuntimeIdsBySnapshot = new Map(memorySnapshots.map((snapshot) => [snapshot.id, snapshot.runtimeId]));
      const memoryRuntimeIds = memorySnapshotIds.map((id) => memoryRuntimeIdsBySnapshot.get(id)!);
      let retrievalRuntimeSnapshotId: string | undefined;
      if (target.knowledgeEnabled && target.retrievalRuntimeId) {
        const retrievalSnapshot = await tx.retrievalRuntimeSnapshot.findFirst({
          where: { workspaceId, runtimeId: target.retrievalRuntimeId },
          orderBy: { revision: "desc" },
          select: { id: true }
        });
        if (!retrievalSnapshot) {
          throw new ConflictException({
            message:
              "Agent has a bound retrieval runtime without a published snapshot and cannot be bound to this channel yet",
            code: "RETRIEVAL_RUNTIME_NOT_PUBLISHED"
          });
        }
        retrievalRuntimeSnapshotId = retrievalSnapshot.id;
      }
      // Conversation-history working-context flag: carried from the Agent's
      // operational runtimeConfiguration into the connection's agentExecution so
      // the channel runtime reads the same authoritative value. Absent/other
      // values mean OFF; only an explicit enabled: true turns history on.
      const conversationHistoryEnabled =
        record(record(target.runtimeConfiguration).conversationHistory).enabled === true;
      const agentExecution: JsonRecord = {
        agentId: target.id,
        agentName: target.name,
        agentRuntimeSnapshotId: orchestration.agentRuntimeSnapshotId,
        promptExecutionPayloadId: orchestration.promptExecutionPayloadId,
        providerRuntimeSnapshotId: orchestration.providerRuntimeSnapshotId,
        ...(orchestration.conversationRuntimeSnapshotId
          ? { conversationRuntimeSnapshotId: orchestration.conversationRuntimeSnapshotId }
          : {}),
        executionPipelineSnapshotId: orchestration.executionPipelineSnapshotId,
        conversationHistory: { enabled: conversationHistoryEnabled },
        ...(memoryRuntimeIds.length ? { memoryRuntimeIds } : {}),
        ...(retrievalRuntimeSnapshotId ? { retrievalRuntimeSnapshotId } : {})
      };
      const existingExecution = record(current.agentExecution);
      const preserved = Object.fromEntries(
        Object.entries(existingExecution).filter(
          ([key]) =>
            ![
              "agentId",
              "agentName",
              "agentRuntimeSnapshotId",
              "promptExecutionPayloadId",
              "providerRuntimeSnapshotId",
              "conversationRuntimeSnapshotId",
              "executionPipelineSnapshotId",
              "memoryRuntimeIds",
              "memoryRuntimeSnapshotIds",
              "retrievalRuntimeSnapshotId"
            ].includes(key)
        )
      );
      const nextConfiguration = {
        ...current,
        agentExecution: { ...preserved, ...agentExecution }
      };
      const revision = (latest?.revision ?? 0) + 1;
      const hash = this.stableHash(nextConfiguration);
      await tx.channelConfiguration.create({
        data: {
          connectionId,
          revision,
          configuration: json(nextConfiguration),
          hash,
          checksum: this.stableHash({ connectionId, hash }),
          createdById: actorId
        }
      });
      const updated = await tx.channelConnection.updateMany({
        where: { id: connectionId, workspaceId, stateVersion: expectedStateVersion },
        data: { stateVersion: { increment: 1 } }
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          message: "Channel connection state changed",
          code: "CHANNEL_CONNECTION_STATE_CHANGED"
        });
      }
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.channel_switched",
        target.id,
        { connectionId, previousAgentId: undefined },
        { connectionId, agentId: target.id, revision }
      );
      return {
        connectionId,
        channelId: connection.channelId,
        agentId: target.id,
        newStateVersion: connection.stateVersion + 1,
        newRevision: revision,
        agentExecution: nextConfiguration.agentExecution
      };
    });
  }

  async bindRetrievalRuntime(
    workspaceId: string,
    actorId: string,
    agentId: string,
    retrievalRuntimeId: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await this.requireAgent(tx, workspaceId, agentId);
      const updated = await tx.aiAgent.update({
        where: { id: agent.id },
        data: { retrievalRuntimeId, updatedById: actorId },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.retrieval_runtime_bound",
        agent.id,
        agent,
        { retrievalRuntimeId, agent: updated }
      );
      return updated;
    });
  }

  async unbindRetrievalRuntime(workspaceId: string, actorId: string, agentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await this.requireAgent(tx, workspaceId, agentId);
      const updated = await tx.aiAgent.update({
        where: { id: agent.id },
        data: { retrievalRuntimeId: null, updatedById: actorId },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.retrieval_runtime_unbound",
        agent.id,
        agent,
        { agent: updated }
      );
      return updated;
    });
  }

  /** Operational controls are intentionally the sole published-Agent write. */
  async updateOperationalPersonality(
    workspaceId: string,
    actorId: string,
    agentId: string,
    personality: Record<string, unknown>
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await this.requireAgent(tx, workspaceId, agentId);
      const runtimeConfiguration = { ...record(agent.runtimeConfiguration), personality };
      const updated = await tx.aiAgent.update({
        where: { id: agent.id },
        data: { runtimeConfiguration: json(runtimeConfiguration), updatedById: actorId },
        select: this.agentSelect
      });
      await this.audit(tx, workspaceId, actorId, "agent.studio.operational_personality_updated",
        agent.id, { personality: record(agent.runtimeConfiguration).personality }, { personality });
      return updated;
    });
  }

  /**
   * Operational control for the conversation-history working-context flag.
   * Like personality, this is a published-Agent write that does not touch the
   * immutable Agent definition and never deletes stored conversation data.
   */
  async updateOperationalConversationHistory(
    workspaceId: string,
    actorId: string,
    agentId: string,
    conversationHistory: { enabled: boolean }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await this.requireAgent(tx, workspaceId, agentId);
      const runtimeConfiguration = {
        ...record(agent.runtimeConfiguration),
        conversationHistory
      };
      const updated = await tx.aiAgent.update({
        where: { id: agent.id },
        data: { runtimeConfiguration: json(runtimeConfiguration), updatedById: actorId },
        select: this.agentSelect
      });
      await this.audit(
        tx,
        workspaceId,
        actorId,
        "agent.studio.conversation_history_updated",
        agent.id,
        { conversationHistory: record(agent.runtimeConfiguration).conversationHistory },
        { conversationHistory }
      );
      return updated;
    });
  }

  async updateOperationalAutomaticExecution(
    workspaceId: string, actorId: string, agentId: string, enabled: boolean
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await this.requireAgent(tx, workspaceId, agentId);
      const runtimeConfiguration = {
        ...record(agent.runtimeConfiguration), automaticExecution: { enabled }
      };
      const updated = await tx.aiAgent.update({ where: { id: agent.id },
        data: { runtimeConfiguration: json(runtimeConfiguration), updatedById: actorId }, select: this.agentSelect });
      await this.audit(tx, workspaceId, actorId, "agent.studio.automatic_execution_updated", agent.id,
        { automaticExecution: record(agent.runtimeConfiguration).automaticExecution }, { automaticExecution: { enabled } });
      return updated;
    });
  }

  async get(workspaceId: string, agentId: string) {
    const agent = await this.requireAgent(this.prisma, workspaceId, agentId);
    return this.withActiveChannels(workspaceId, agent);
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
    const agentIds = data.map((agent) => agent.id);
    const snapshots = agentIds.length
      ? await this.prisma.agentRuntimeSnapshot.findMany({
          where: { workspaceId: input.workspaceId, agentId: { in: agentIds } },
          select: { agentId: true, id: true }
        })
      : [];
    const agentBySnapshot = new Map(snapshots.map((item) => [item.id, item.agentId]));
    const references = snapshots.length
      ? await this.activeChannelReferences(this.prisma, input.workspaceId, snapshots.map((s) => s.id))
      : [];
    const activeByAgent = new Map<string, Array<{ connectionId: string; channelId: string; stateVersion: number }>>();
    for (const reference of references) {
      const agentId = agentBySnapshot.get(reference.snapshotId);
      if (!agentId) continue;
      const current = activeByAgent.get(agentId);
      const entry = {
        connectionId: reference.connectionId,
        channelId: reference.channelId,
        stateVersion: reference.stateVersion
      };
      if (current) current.push(entry);
      else activeByAgent.set(agentId, [entry]);
    }
    const enriched = data.map((agent) => ({
      ...agent,
      activeChannels: activeByAgent.get(agent.id) ?? []
    }));
    return {
      data: enriched,
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
    retrievalRuntimeId: true,
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

  private async assertNotActiveOnChannel(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    agentId: string
  ) {
    const snapshots = await tx.agentRuntimeSnapshot.findMany({
      where: { workspaceId, agentId }, select: { id: true }
    });
    const references = await this.activeChannelReferences(tx, workspaceId, snapshots.map((s) => s.id));
    if (references.length) {
      throw new ConflictException({
        message: "Agent is active on channel connections and must be replaced before this lifecycle operation",
        code: "AGENT_ACTIVE_CHANNEL_REFERENCE",
        connections: references.map((reference) => ({
          connectionId: reference.connectionId,
          channelId: reference.channelId
        }))
      });
    }
  }

  private async activeChannelReferences(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    snapshotIds: string[]
  ): Promise<Array<{ snapshotId: string; connectionId: string; channelId: string; stateVersion: number }>> {
    if (!snapshotIds.length) return [];
    const snapshotIdSet = new Set(snapshotIds);
    const configurations = await client.channelConfiguration.findMany({
      where: { connection: { workspaceId } },
      select: {
        connectionId: true,
        configuration: true,
        connection: { select: { channelId: true, stateVersion: true } }
      },
      orderBy: [{ connectionId: "asc" }, { revision: "desc" }]
    });
    const latestByConnection = new Map<string, typeof configurations[number]>();
    for (const configuration of configurations) {
      if (!latestByConnection.has(configuration.connectionId)) {
        latestByConnection.set(configuration.connectionId, configuration);
      }
    }
    return [...latestByConnection.values()].flatMap((configuration) => {
      const root = record(configuration.configuration);
      const execution = record(root.agentExecution);
      const snapshotId = execution.agentRuntimeSnapshotId;
      return typeof snapshotId === "string" && snapshotIdSet.has(snapshotId)
        ? [{
            snapshotId,
            connectionId: configuration.connectionId,
            channelId: configuration.connection.channelId,
            stateVersion: configuration.connection.stateVersion
          }]
        : [];
    });
  }

  private async withActiveChannels<T extends { id: string }>(
    workspaceId: string,
    agent: T
  ): Promise<T & { activeChannels: Array<{ connectionId: string; channelId: string; stateVersion: number }> }> {
    const snapshots = await this.prisma.agentRuntimeSnapshot.findMany({
      where: { workspaceId, agentId: agent.id }, select: { id: true }
    });
    const references = await this.activeChannelReferences(
      this.prisma,
      workspaceId,
      snapshots.map((s) => s.id)
    );
    return {
      ...agent,
      activeChannels: references.map((reference) => ({
        connectionId: reference.connectionId,
        channelId: reference.channelId,
        stateVersion: reference.stateVersion
      }))
    };
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
    const compilationBindings = bindings.filter((binding) => binding.role === AgentPromptRole.SYSTEM);
    if (compilationBindings.length === 0 && bindings.length === 1) compilationBindings.push(bindings[0]!);
    for (const binding of compilationBindings) {
      const version = await tx.promptLibraryVersion.findFirst({
        where: {
          promptId: binding.promptId,
          ...(binding.promptVersionId ? { id: binding.promptVersionId } : {}),
          publishedAt: { not: null },
          prompt: { workspaceId, deletedAt: null }
        },
        orderBy: { revision: "desc" },
        select: { id: true, snapshot: true }
      });
      if (!version) {
        throw new BadRequestException("Agent prompt bindings require a published Prompt version");
      }
      const snapshot = record(version.snapshot);
      const draft = record(snapshot.draft);
      const sections = record(draft.sections);
      const userPrompt = [
        sections.userPrompt, draft.userPrompt, draft.user_prompt, draft.content, draft.template
      ].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (!userPrompt) {
        throw new BadRequestException({
          message: "The selected Prompt is not valid for Agent compilation",
          code: "USER_PROMPT_MISSING",
          path: "sections.userPrompt",
          promptId: binding.promptId,
          promptVersionId: version.id
        });
      }
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
      })),
      retrievalRuntimeId: agent.retrievalRuntimeId
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
      capabilitiesMetadata: json(snapshot.capabilities.metadata),
      retrievalRuntimeId: snapshot.retrievalRuntimeId
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
    return {
      ...snapshot,
      retrievalRuntimeId:
        typeof snapshot.retrievalRuntimeId === "string" ? snapshot.retrievalRuntimeId : null
    } as AgentSnapshot;
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

  private stableHash(value: unknown): string {
    return createHash("sha256").update(this.stableSerialize(value)).digest("hex");
  }

  private stableSerialize(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableSerialize(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }
}
