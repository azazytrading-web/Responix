import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProviderRuntimeStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  PrepareProviderRequestDto,
  ProviderRequestListQueryDto,
  ProviderRequestOptionsDto,
  ProviderSnapshotListQueryDto
} from "./dto/provider-runtime.dto";
import {
  ProviderRuntimeValidator,
  type ProviderCapabilityMetadata,
  type ProviderRuntimeDiagnostic
} from "./provider-runtime.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

class ProviderSourceError extends Error {
  constructor(readonly diagnostics: ProviderRuntimeDiagnostic[]) {
    super("Provider runtime configuration was rejected");
  }
}

@Injectable()
export class ProviderRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ProviderRuntimeValidator
  ) {}

  async prepare(workspaceId: string, actorId: string, dto: PrepareProviderRequestDto) {
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const assembled = await this.assemble(tx, workspaceId, dto);
        if (!assembled.validation.valid) {
          await this.auditFailure(tx, workspaceId, actorId, dto.compiledPromptId, assembled.validation);
          return { ok: false as const, validation: assembled.validation };
        }
        const request = await tx.providerRuntimeRequest.create({
          data: {
            workspaceId,
            createdById: actorId,
            ...assembled.identity,
            status: ProviderRuntimeStatus.PREPARED,
            preparationInput: json(dto),
            preparedRequest: json(assembled.requestPackage),
            capabilityMetadata: json(assembled.capabilities),
            validationResult: json(assembled.validation),
            requestHash: assembled.requestHash,
            checksum: assembled.checksum
          },
          select: this.requestSelect
        });
        await this.audit(tx, workspaceId, actorId, "provider.runtime.request_prepared",
          "ProviderRuntimeRequest", request.id, null, request);
        return { ok: true as const, request };
      });
      if (!outcome.ok) this.throwValidation(outcome.validation);
      return outcome.request;
    } catch (error) {
      return this.handleSourceError(workspaceId, actorId, dto.compiledPromptId, error);
    }
  }

  async validate(workspaceId: string, actorId: string, id: string) {
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const current = await this.requireRequest(tx, workspaceId, id);
        const dto = this.record(current.preparationInput) as unknown as PrepareProviderRequestDto;
        const assembled = await this.assemble(tx, workspaceId, dto);
        if (assembled.requestHash !== current.requestHash) {
          assembled.validation.diagnostics.push(this.diagnostic(
            "SOURCE_CONFIGURATION_CHANGED",
            "request",
            "Resolved provider sources no longer match the immutable prepared request"
          ));
          assembled.validation.valid = false;
        }
        const status = assembled.validation.valid
          ? ProviderRuntimeStatus.VALIDATED
          : ProviderRuntimeStatus.REJECTED;
        const updated = await tx.providerRuntimeRequest.update({
          where: { id: current.id },
          data: {
            status,
            validationResult: json(assembled.validation),
            validatedAt: new Date()
          },
          select: this.requestSelect
        });
        await this.audit(
          tx,
          workspaceId,
          actorId,
          assembled.validation.valid
            ? "provider.runtime.validation_passed"
            : "provider.runtime.validation_failed",
          "ProviderRuntimeRequest",
          id,
          { status: current.status, validationResult: current.validationResult },
          { status: updated.status, validationResult: updated.validationResult }
        );
        if (!assembled.validation.valid) {
          await this.audit(tx, workspaceId, actorId, "provider.runtime.configuration_rejected",
            "ProviderRuntimeRequest", id, null, assembled.validation);
        }
        return { request: updated, valid: assembled.validation.valid };
      });
      if (!outcome.valid) {
        this.throwValidation(this.record(outcome.request.validationResult));
      }
      return outcome.request;
    } catch (error) {
      return this.handleSourceError(workspaceId, actorId, id, error);
    }
  }

  async createSnapshot(workspaceId: string, actorId: string, requestId: string) {
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const current = await this.requireRequest(tx, workspaceId, requestId);
        const dto = this.record(current.preparationInput) as unknown as PrepareProviderRequestDto;
        const assembled = await this.assemble(tx, workspaceId, dto);
        if (assembled.requestHash !== current.requestHash) {
          assembled.validation.diagnostics.push(this.diagnostic(
            "SOURCE_CONFIGURATION_CHANGED",
            "request",
            "Resolved sources changed before snapshot creation"
          ));
          assembled.validation.valid = false;
        }
        if (!assembled.validation.valid) {
          await tx.providerRuntimeRequest.update({
            where: { id: current.id },
            data: {
              status: ProviderRuntimeStatus.REJECTED,
              validationResult: json(assembled.validation),
              validatedAt: new Date()
            }
          });
          await this.auditFailure(tx, workspaceId, actorId, requestId, assembled.validation);
          return { ok: false as const, validation: assembled.validation };
        }
        const revision = current.latestSnapshotRevision + 1;
        const snapshot = await tx.providerRequestSnapshot.create({
          data: {
            workspaceId,
            requestId,
            revision,
            createdById: actorId,
            compiledPromptId: current.compiledPromptId,
            agentRuntimeSnapshotId: current.agentRuntimeSnapshotId,
            providerId: current.providerId,
            providerConfigurationId: current.providerConfigurationId,
            modelId: current.modelId,
            executionProfileId: current.executionProfileId,
            executionProfileVersionId: current.executionProfileVersionId,
            providerType: current.providerType,
            providerVersion: current.providerVersion,
            modelVersion: current.modelVersion,
            requestPackage: json(current.preparedRequest),
            capabilityMetadata: json(current.capabilityMetadata),
            validationResult: json(assembled.validation),
            requestHash: current.requestHash,
            checksum: current.checksum
          },
          select: this.snapshotSelect
        });
        await tx.providerRuntimeRequest.update({
          where: { id: current.id },
          data: {
            status: ProviderRuntimeStatus.SNAPSHOTTED,
            latestSnapshotRevision: revision,
            validationResult: json(assembled.validation),
            validatedAt: new Date()
          }
        });
        await this.audit(tx, workspaceId, actorId, "provider.runtime.snapshot_created",
          "ProviderRequestSnapshot", snapshot.id, null, snapshot);
        return { ok: true as const, snapshot };
      });
      if (!outcome.ok) this.throwValidation(outcome.validation);
      return outcome.snapshot;
    } catch (error) {
      return this.handleSourceError(workspaceId, actorId, requestId, error);
    }
  }

  getRequest(workspaceId: string, id: string) {
    return this.requireRequest(this.prisma, workspaceId, id);
  }

  async listRequests(workspaceId: string, query: ProviderRequestListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.ProviderRuntimeRequestWhereInput = {
      workspaceId,
      status: query.status,
      providerId: query.providerId,
      modelId: query.modelId,
      executionRequestId: query.executionRequestId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.providerRuntimeRequest.findMany({
        where,
        select: this.requestSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.providerRuntimeRequest.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  getSnapshot(workspaceId: string, id: string) {
    return this.requireSnapshot(this.prisma, workspaceId, id);
  }

  async listSnapshots(workspaceId: string, query: ProviderSnapshotListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.ProviderRequestSnapshotWhereInput = {
      workspaceId,
      requestId: query.requestId,
      providerId: query.providerId,
      modelId: query.modelId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.providerRequestSnapshot.findMany({
        where,
        select: this.snapshotSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.providerRequestSnapshot.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async compareSnapshots(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await this.prisma.$transaction([
      this.prisma.providerRequestSnapshot.findFirst({
        where: { id: leftId, workspaceId },
        select: this.snapshotSelect
      }),
      this.prisma.providerRequestSnapshot.findFirst({
        where: { id: rightId, workspaceId },
        select: this.snapshotSelect
      })
    ]);
    if (!left || !right) {
      throw new NotFoundException("One or more provider request snapshots were not found");
    }
    return {
      identical: left.requestHash === right.requestHash && left.checksum === right.checksum,
      left: this.snapshotIdentity(left),
      right: this.snapshotIdentity(right),
      changed: {
        provider: left.providerId !== right.providerId || left.providerVersion !== right.providerVersion,
        model: left.modelId !== right.modelId || left.modelVersion !== right.modelVersion,
        prompt: left.compiledPromptId !== right.compiledPromptId,
        runtime: left.agentRuntimeSnapshotId !== right.agentRuntimeSnapshotId,
        executionProfile: left.executionProfileVersionId !== right.executionProfileVersionId,
        capabilities: this.stableStringify(left.capabilityMetadata) !==
          this.stableStringify(right.capabilityMetadata),
        requestPackage: this.stableStringify(left.requestPackage) !==
          this.stableStringify(right.requestPackage)
      }
    };
  }

  private async assemble(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    dto: PrepareProviderRequestDto
  ) {
    const workspace = await tx.workspace.findFirst({
      where: { id: workspaceId, status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true, slug: true, language: true, timezone: true }
    });
    if (!workspace) this.sourceError("WORKSPACE_UNAVAILABLE", "workspaceId",
      "Active workspace was not found");

    const runtime = await tx.agentRuntimeSnapshot.findFirst({
      where: { id: dto.agentRuntimeSnapshotId, workspaceId },
      select: {
        id: true, workspaceId: true, agentId: true, agentVersionId: true,
        providerId: true, modelId: true, providerConfigurationId: true,
        executionProfileId: true, executionProfileVersionId: true,
        executionRequestId: true, executionRunId: true, conversationId: true,
        correlationId: true, executionId: true, traceId: true,
        runtimeContext: true, promptReferences: true, runtimeVariables: true,
        runtimeMetadata: true, executionConfiguration: true, contentHash: true, createdAt: true
      }
    });
    if (!runtime) this.sourceError("RUNTIME_SNAPSHOT_NOT_FOUND", "agentRuntimeSnapshotId",
      "Agent Runtime snapshot was not found in the active workspace");

    const compiled = await tx.compiledPrompt.findFirst({
      where: { id: dto.compiledPromptId, workspaceId },
      select: {
        id: true, promptId: true, promptVersionId: true, agentVersionId: true,
        agentRuntimeSnapshotId: true, executionRequestId: true, conversationId: true,
        compilerVersion: true, compiledPackage: true, resolvedPrompt: true,
        hash: true, checksum: true, sizeBytes: true, compiledAt: true
      }
    });
    if (!compiled) this.sourceError("COMPILED_PROMPT_NOT_FOUND", "compiledPromptId",
      "Compiled prompt was not found in the active workspace");
    if (compiled.agentRuntimeSnapshotId !== runtime.id) {
      this.sourceError("RUNTIME_PROMPT_MISMATCH", "compiledPromptId",
        "Compiled prompt does not belong to the selected Agent Runtime snapshot");
    }
    if (compiled.agentVersionId && compiled.agentVersionId !== runtime.agentVersionId) {
      this.sourceError("AGENT_VERSION_MISMATCH", "compiledPromptId",
        "Compiled prompt and runtime snapshot reference different agent versions");
    }

    const [agent, agentVersion, prompt, promptVersion, providerConfiguration, provider, model,
      executionProfile, executionProfileVersion, executionRequest] = await Promise.all([
      tx.aiAgent.findFirst({
        where: {
          id: runtime.agentId, workspaceId, status: "PUBLISHED",
          archivedAt: null, deletedAt: null
        },
        select: { id: true, version: true, status: true }
      }),
      tx.aiAgentVersion.findFirst({
        where: { id: runtime.agentVersionId, agentId: runtime.agentId },
        select: { id: true, revision: true, publishedAt: true }
      }),
      tx.promptLibraryItem.findFirst({
        where: {
          id: compiled.promptId, workspaceId, status: "PUBLISHED", deletedAt: null
        },
        select: { id: true, revision: true, status: true }
      }),
      tx.promptLibraryVersion.findFirst({
        where: {
          id: compiled.promptVersionId, promptId: compiled.promptId,
          publishedAt: { not: null }, prompt: { workspaceId }
        },
        select: { id: true, revision: true, publishedAt: true }
      }),
      tx.aiProviderConfiguration.findFirst({
        where: {
          id: runtime.providerConfigurationId, workspaceId,
          providerId: runtime.providerId, enabled: true, deletedAt: null
        },
        select: { id: true, providerId: true, settings: true, updatedAt: true }
      }),
      tx.aiProvider.findFirst({
        where: { id: runtime.providerId, status: "ACTIVE" },
        select: {
          id: true, providerName: true, authenticationType: true,
          status: true, updatedAt: true
        }
      }),
      tx.aiModel.findFirst({
        where: { id: runtime.modelId, providerId: runtime.providerId, status: "ACTIVE" },
        select: {
          id: true, providerId: true, modelName: true, displayName: true,
          contextWindow: true, maxOutputTokens: true, supportsVision: true,
          supportsTools: true, supportsReasoning: true, supportsStreaming: true,
          supportsJson: true, status: true, updatedAt: true
        }
      }),
      tx.executionProfile.findFirst({
        where: {
          id: runtime.executionProfileId, workspaceId,
          status: "PUBLISHED", archivedAt: null, deletedAt: null
        },
        select: { id: true, revision: true, metadata: true, status: true }
      }),
      tx.executionProfileVersion.findFirst({
        where: {
          id: runtime.executionProfileVersionId,
          profileId: runtime.executionProfileId
        },
        select: { id: true, revision: true, snapshot: true, publishedAt: true }
      }),
      tx.executionRequest.findFirst({
        where: { id: runtime.executionRequestId, workspaceId },
        select: {
          id: true, correlationId: true, sourceType: true,
          sourceReferenceId: true, metadata: true, priority: true
        }
      })
    ]);

    if (!agent || !agentVersion) this.sourceError("AGENT_NOT_READY", "agentRuntimeSnapshotId",
      "Published Agent and immutable Agent version are required");
    if (!prompt || !promptVersion) this.sourceError("PROMPT_NOT_READY", "compiledPromptId",
      "Published prompt and immutable prompt version are required");
    if (!providerConfiguration) this.sourceError("PROVIDER_CONFIGURATION_NOT_READY", "providerConfiguration",
      "Enabled workspace provider configuration is required");
    if (!provider) this.sourceError("PROVIDER_NOT_READY", "provider", "Provider must be active");
    if (!model) this.sourceError("MODEL_NOT_READY", "model", "Model must be active and belong to the provider");
    if (!executionProfile || !executionProfileVersion) {
      this.sourceError("EXECUTION_PROFILE_NOT_READY", "executionProfile",
        "Published execution profile and immutable version are required");
    }
    if (!executionRequest) this.sourceError("EXECUTION_REQUEST_NOT_FOUND", "executionRequest",
      "Execution request was not found in the active workspace");

    if (runtime.executionRunId) {
      const run = await tx.executionRun.findFirst({
        where: {
          id: runtime.executionRunId, workspaceId,
          requestId: runtime.executionRequestId
        },
        select: { id: true }
      });
      if (!run) this.sourceError("EXECUTION_RUN_NOT_FOUND", "executionRunId",
        "Execution run was not found in the active workspace");
    }
    if (runtime.conversationId) {
      const conversation = await tx.conversation.findFirst({
        where: { id: runtime.conversationId, workspaceId, deletedAt: null },
        select: { id: true }
      });
      if (!conversation) this.sourceError("CONVERSATION_NOT_FOUND", "conversationId",
        "Conversation was not found in the active workspace");
    }

    const settings = this.record(providerConfiguration.settings);
    const executionConfiguration = this.record(runtime.executionConfiguration);
    const modelConfiguration = this.record(executionConfiguration.modelConfiguration);
    const providerType = this.firstString(settings, ["providerType", "type"]) ?? provider.providerName;
    const providerVersion = dto.providerVersion ??
      this.firstString(settings, ["providerVersion", "version"]) ?? "1";
    const modelVersion = dto.modelVersion ??
      this.firstString(modelConfiguration, ["modelVersion", "version"]) ?? model.modelName;
    const capabilities = this.capabilities(model, settings, modelConfiguration);
    const validation = this.validator.validate({
      options: dto,
      capabilities,
      promptSizeBytes: compiled.sizeBytes
    });
    const corePackage = {
      compiledPrompt: {
        id: compiled.id,
        promptId: compiled.promptId,
        promptVersionId: compiled.promptVersionId,
        compilerVersion: compiled.compilerVersion,
        package: compiled.compiledPackage,
        resolvedPrompt: compiled.resolvedPrompt,
        sizeBytes: compiled.sizeBytes,
        hash: compiled.hash,
        checksum: compiled.checksum
      },
      runtimeSnapshot: {
        id: runtime.id,
        agentId: runtime.agentId,
        agentVersionId: runtime.agentVersionId,
        variables: runtime.runtimeVariables,
        metadata: runtime.runtimeMetadata,
        contentHash: runtime.contentHash
      },
      executionSnapshot: {
        request: executionRequest,
        runId: runtime.executionRunId,
        profileId: executionProfile.id,
        profileVersionId: executionProfileVersion.id,
        profileRevision: executionProfileVersion.revision,
        profile: executionProfileVersion.snapshot,
        policies: dto.executionPolicies ?? {}
      },
      conversation: {
        id: runtime.conversationId,
        metadata: dto.conversationMetadata ?? {}
      },
      provider: {
        id: provider.id,
        type: providerType,
        version: providerVersion,
        name: provider.providerName,
        authenticationType: provider.authenticationType,
        configurationId: providerConfiguration.id
      },
      model: {
        id: model.id,
        version: modelVersion,
        name: model.modelName,
        displayName: model.displayName
      },
      capabilities,
      request: {
        options: this.options(dto),
        metadata: dto.requestMetadata ?? {}
      },
      safety: dto.safetyMetadata ?? {},
      trace: {
        correlationId: runtime.correlationId,
        executionId: runtime.executionId,
        traceId: runtime.traceId,
        metadata: dto.traceMetadata ?? {}
      },
      workspace: { id: workspace.id, slug: workspace.slug },
      versions: {
        agent: agentVersion.revision,
        prompt: promptVersion.revision,
        executionProfile: executionProfileVersion.revision,
        provider: providerVersion,
        model: modelVersion
      }
    };
    const requestHash = this.hash(corePackage);
    const checksum = this.hash({ requestHash, compiledChecksum: compiled.checksum, runtimeHash: runtime.contentHash });
    return {
      identity: {
        compiledPromptId: compiled.id,
        agentRuntimeSnapshotId: runtime.id,
        providerId: provider.id,
        providerConfigurationId: providerConfiguration.id,
        modelId: model.id,
        executionProfileId: executionProfile.id,
        executionProfileVersionId: executionProfileVersion.id,
        executionRequestId: executionRequest.id,
        executionRunId: runtime.executionRunId,
        conversationId: runtime.conversationId,
        providerType,
        providerVersion,
        modelVersion
      },
      capabilities,
      validation,
      requestHash,
      checksum,
      requestPackage: {
        ...corePackage,
        hashes: {
          requestHash,
          checksum,
          compiledPromptHash: compiled.hash,
          compiledPromptChecksum: compiled.checksum,
          runtimeSnapshotHash: runtime.contentHash
        },
        preparedAt: new Date().toISOString()
      }
    };
  }

  private capabilities(
    model: {
      contextWindow: number;
      maxOutputTokens: number | null;
      supportsVision: boolean;
      supportsTools: boolean;
      supportsReasoning: boolean;
      supportsStreaming: boolean;
      supportsJson: boolean;
    },
    settings: JsonRecord,
    modelConfiguration: JsonRecord
  ): ProviderCapabilityMetadata {
    const configured = {
      ...this.record(settings.capabilities),
      ...this.record(modelConfiguration.capabilities)
    };
    const maxOutputTokens = this.positiveInteger(configured.maxOutputTokens) ??
      model.maxOutputTokens ?? model.contextWindow;
    return {
      maxInputTokens: this.positiveInteger(configured.maxInputTokens) ??
        Math.max(0, model.contextWindow - maxOutputTokens),
      maxOutputTokens,
      contextWindow: this.positiveInteger(configured.contextWindow) ?? model.contextWindow,
      maxPromptBytes: this.positiveInteger(configured.maxPromptBytes) ?? 1000000,
      temperature: {
        min: this.number(configured.temperatureMin) ?? 0,
        max: this.number(configured.temperatureMax) ?? 2
      },
      topP: {
        min: this.number(configured.topPMin) ?? 0,
        max: this.number(configured.topPMax) ?? 1
      },
      presencePenalty: {
        supported: this.boolean(configured.presencePenaltySupported) ?? false,
        min: this.number(configured.presencePenaltyMin) ?? -2,
        max: this.number(configured.presencePenaltyMax) ?? 2
      },
      frequencyPenalty: {
        supported: this.boolean(configured.frequencyPenaltySupported) ?? false,
        min: this.number(configured.frequencyPenaltyMin) ?? -2,
        max: this.number(configured.frequencyPenaltyMax) ?? 2
      },
      stopSequences: {
        supported: this.boolean(configured.stopSequencesSupported) ?? true,
        maxItems: this.positiveInteger(configured.maxStopSequences) ?? 4
      },
      vision: this.boolean(configured.vision) ?? model.supportsVision,
      image: this.boolean(configured.image) ?? false,
      tools: this.boolean(configured.tools) ?? model.supportsTools,
      structuredOutput: this.boolean(configured.structuredOutput) ?? model.supportsJson,
      streaming: this.boolean(configured.streaming) ?? model.supportsStreaming,
      reasoning: this.boolean(configured.reasoning) ?? model.supportsReasoning
    };
  }

  private options(dto: ProviderRequestOptionsDto) {
    return {
      estimatedInputTokens: dto.estimatedInputTokens,
      maxOutputTokens: dto.maxOutputTokens,
      temperature: dto.temperature,
      topP: dto.topP,
      presencePenalty: dto.presencePenalty,
      frequencyPenalty: dto.frequencyPenalty,
      stopSequences: dto.stopSequences ?? [],
      structuredOutput: dto.structuredOutput ?? false,
      vision: dto.vision ?? false,
      image: dto.image ?? false,
      tools: dto.tools ?? false,
      streaming: dto.streaming ?? false,
      reasoning: dto.reasoning ?? false
    };
  }

  private readonly requestSelect = {
    id: true, workspaceId: true, createdById: true, compiledPromptId: true,
    agentRuntimeSnapshotId: true, providerId: true, providerConfigurationId: true,
    modelId: true, executionProfileId: true, executionProfileVersionId: true,
    executionRequestId: true, executionRunId: true, conversationId: true,
    providerType: true, providerVersion: true, modelVersion: true, status: true,
    preparationInput: true, preparedRequest: true, capabilityMetadata: true,
    validationResult: true, requestHash: true, checksum: true,
    latestSnapshotRevision: true, validatedAt: true, createdAt: true, updatedAt: true
  } as const;

  private readonly snapshotSelect = {
    id: true, workspaceId: true, requestId: true, revision: true, createdById: true,
    compiledPromptId: true, agentRuntimeSnapshotId: true, providerId: true,
    providerConfigurationId: true, modelId: true, executionProfileId: true,
    executionProfileVersionId: true, providerType: true, providerVersion: true,
    modelVersion: true, requestPackage: true, capabilityMetadata: true,
    validationResult: true, requestHash: true, checksum: true, createdAt: true
  } as const;

  private requireRequest(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.providerRuntimeRequest.findFirst({
      where: { id, workspaceId },
      select: this.requestSelect
    }).then((request) => {
      if (!request) throw new NotFoundException("Provider Runtime request was not found");
      return request;
    });
  }

  private requireSnapshot(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.providerRequestSnapshot.findFirst({
      where: { id, workspaceId },
      select: this.snapshotSelect
    }).then((snapshot) => {
      if (!snapshot) throw new NotFoundException("Provider request snapshot was not found");
      return snapshot;
    });
  }

  private snapshotIdentity(snapshot: {
    id: string;
    requestId: string;
    revision: number;
    requestHash: string;
    checksum: string;
    createdAt: Date;
  }) {
    return {
      id: snapshot.id,
      requestId: snapshot.requestId,
      revision: snapshot.revision,
      requestHash: snapshot.requestHash,
      checksum: snapshot.checksum,
      createdAt: snapshot.createdAt
    };
  }

  private async handleSourceError(
    workspaceId: string,
    actorId: string,
    entityId: string,
    error: unknown
  ): Promise<never> {
    if (!(error instanceof ProviderSourceError)) throw error;
    await this.prisma.$transaction(async (tx) => {
      await this.auditFailure(tx, workspaceId, actorId, entityId, {
        valid: false,
        diagnostics: error.diagnostics,
        checkedAt: new Date().toISOString()
      });
    });
    throw new BadRequestException({ message: error.message, diagnostics: error.diagnostics });
  }

  private async auditFailure(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    entityId: string,
    validation: unknown
  ) {
    await this.audit(tx, workspaceId, actorId, "provider.runtime.validation_failed",
      "ProviderRuntimeRequest", entityId, null, validation);
    await this.audit(tx, workspaceId, actorId, "provider.runtime.configuration_rejected",
      "ProviderRuntimeRequest", entityId, null, validation);
  }

  private throwValidation(validation: unknown): never {
    const record = this.record(validation);
    throw new BadRequestException({
      message: "Provider request failed validation",
      diagnostics: record.diagnostics ?? []
    });
  }

  private sourceError(code: string, path: string, message: string): never {
    throw new ProviderSourceError([this.diagnostic(code, path, message)]);
  }

  private diagnostic(code: string, path: string, message: string): ProviderRuntimeDiagnostic {
    return { severity: "ERROR", code, path, message };
  }

  private record(value: unknown): JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as JsonRecord
      : {};
  }

  private firstString(value: JsonRecord, keys: string[]) {
    for (const key of keys) {
      if (typeof value[key] === "string" && value[key]) return value[key];
    }
    return undefined;
  }

  private positiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
  }

  private hash(value: unknown) {
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
    return JSON.stringify(value) ?? "null";
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
