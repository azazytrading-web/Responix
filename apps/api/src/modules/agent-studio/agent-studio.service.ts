import { Injectable } from "@nestjs/common";
import { AgentStudioRepository } from "./agent-studio.repository";
import { AgentPublishRuntimeService } from "./agent-publish-runtime.service";
import { RetrievalRuntimeService } from "../retrieval-runtime/retrieval-runtime.service";
import type {
  AgentListQueryDto,
  BindRetrievalRuntimeDto,
  CloneAgentDto,
  CreateAgentDto,
  PublishAgentDto,
  RollbackAgentDto,
  UpdateAgentDraftDto,
  UpdateConversationHistoryDto,
  UpdateOperationalPersonalityDto
  , UpdateAutomaticExecutionDto
} from "./dto/agent-studio.dto";

@Injectable()
export class AgentStudioService {
  constructor(
    private readonly repository: AgentStudioRepository,
    private readonly publishRuntime: AgentPublishRuntimeService,
    private readonly retrievalRuntime: RetrievalRuntimeService
  ) {}

  create(workspaceId: string, actorId: string, dto: CreateAgentDto) {
    return this.repository.create({ workspaceId, actorId, ...dto });
  }

  updateDraft(
    workspaceId: string,
    actorId: string,
    agentId: string,
    dto: UpdateAgentDraftDto
  ) {
    return this.repository.updateDraft({
      workspaceId,
      actorId,
      agentId,
      draft: dto
    });
  }

  async publish(workspaceId: string, actorId: string, agentId: string, dto: PublishAgentDto) {
    const published = await this.repository.publish({ workspaceId, actorId, agentId, ...dto });
    try {
      const runtime = await this.publishRuntime.prepare(
        workspaceId, actorId, published.agent.id, published.version.id
      );
      return { ...published, runtime };
    } catch (error) {
      await this.repository.revertFailedPublish(
        workspaceId, actorId, published.agent.id, published.version.id
      );
      throw error;
    }
  }

  rollback(workspaceId: string, actorId: string, agentId: string, dto: RollbackAgentDto) {
    return this.repository.rollback({ workspaceId, actorId, agentId, ...dto });
  }

  clone(workspaceId: string, actorId: string, agentId: string, dto: CloneAgentDto) {
    return this.repository.clone({ workspaceId, actorId, agentId, ...dto });
  }

  archive(workspaceId: string, actorId: string, agentId: string) {
    return this.repository.archive(workspaceId, actorId, agentId);
  }

  restore(workspaceId: string, actorId: string, agentId: string) {
    return this.repository.restore(workspaceId, actorId, agentId);
  }

  delete(workspaceId: string, actorId: string, agentId: string) {
    return this.repository.softDelete(workspaceId, actorId, agentId);
  }

  switchChannelAgent(
    workspaceId: string,
    actorId: string,
    agentId: string,
    connectionId: string,
    expectedStateVersion: number
  ) {
    return this.repository.switchChannelAgent(
      workspaceId,
      actorId,
      agentId,
      connectionId,
      expectedStateVersion
    );
  }

  async bindRetrievalRuntime(
    workspaceId: string,
    actorId: string,
    agentId: string,
    dto: BindRetrievalRuntimeDto
  ) {
    await this.retrievalRuntime.getPublishedSnapshot(workspaceId, dto.retrievalRuntimeId);
    const bound = await this.repository.bindRetrievalRuntime(
      workspaceId,
      actorId,
      agentId,
      dto.retrievalRuntimeId
    );
    return this.refreshActiveChannelBindings(workspaceId, actorId, bound);
  }

  async unbindRetrievalRuntime(workspaceId: string, actorId: string, agentId: string) {
    const unbound = await this.repository.unbindRetrievalRuntime(workspaceId, actorId, agentId);
    return this.refreshActiveChannelBindings(workspaceId, actorId, unbound);
  }

  updateOperationalPersonality(
    workspaceId: string, actorId: string, agentId: string, dto: UpdateOperationalPersonalityDto
  ) {
    return this.repository.updateOperationalPersonality(
      workspaceId, actorId, agentId, dto as unknown as Record<string, unknown>
    );
  }

  /**
   * Update the conversation-history working-context flag.  Because the channel
   * runtime reads this value from the connection's agentExecution (populated at
   * bind time), refresh every active channel binding so a change is picked up by
   * the same runtime path used at initial bind.
   */
  async updateOperationalConversationHistory(
    workspaceId: string, actorId: string, agentId: string, dto: UpdateConversationHistoryDto
  ) {
    const updated = await this.repository.updateOperationalConversationHistory(
      workspaceId, actorId, agentId, { enabled: dto.enabled }
    );
    return this.refreshActiveChannelBindings(workspaceId, actorId, updated);
  }

  async updateOperationalAutomaticExecution(workspaceId: string, actorId: string, agentId: string,
    dto: UpdateAutomaticExecutionDto) {
    return this.repository.updateOperationalAutomaticExecution(workspaceId, actorId, agentId, dto.enabled);
  }

  /**
   * Channel configurations contain immutable runtime snapshot IDs.  When the
   * persisted Agent binding changes, regenerate each existing channel binding
   * through the same switch path used for a new channel assignment so inbound
   * messages receive the newly selected snapshot (or no retrieval snapshot on
   * disconnect).  Draft agents cannot have a live channel configuration.
   */
  private async refreshActiveChannelBindings(
    workspaceId: string,
    actorId: string,
    agent: { id: string; status?: string }
  ) {
    if (agent.status !== "PUBLISHED") return agent;
    const current = await this.repository.get(workspaceId, agent.id);
    for (const channel of current.activeChannels) {
      await this.repository.switchChannelAgent(
        workspaceId,
        actorId,
        agent.id,
        channel.connectionId,
        channel.stateVersion
      );
    }
    return this.repository.get(workspaceId, agent.id);
  }

  get(workspaceId: string, agentId: string) {
    return this.repository.get(workspaceId, agentId);
  }

  history(workspaceId: string, agentId: string) {
    return this.repository.history(workspaceId, agentId);
  }

  list(workspaceId: string, query: AgentListQueryDto) {
    return this.repository.list({
      workspaceId,
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      search: query.search,
      status: query.status,
      visibility: query.visibility,
      category: query.category
    });
  }
}
