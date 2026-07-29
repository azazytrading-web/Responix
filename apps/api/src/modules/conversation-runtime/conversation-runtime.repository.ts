import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ConversationRuntimeParticipantType,
  ConversationRuntimeStateType,
  ConversationRuntimeStatus,
  Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  CloneConversationRuntimeDto,
  ConversationContextDto,
  ConversationParticipantDto,
  ConversationRuntimeListQueryDto,
  ConversationSnapshotListQueryDto,
  PrepareConversationRuntimeDto,
  TransitionConversationStateDto
} from "./dto/conversation-runtime.dto";
import {
  ConversationRuntimeValidator,
  type ConversationRuntimeDiagnostic,
  type ConversationValidationResult
} from "./conversation-runtime.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const jsonValue = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === null ? Prisma.JsonNull : json(value);

@Injectable()
export class ConversationRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ConversationRuntimeValidator
  ) {}

  async prepare(workspaceId: string, actorId: string, dto: PrepareConversationRuntimeDto) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const assembled = await this.assemble(tx, workspaceId, dto);
      if (!assembled.validation.valid) {
        await this.audit(tx, workspaceId, actorId, "conversation.runtime.rejected",
          "ConversationRuntime", dto.sourceConversationId ?? workspaceId, null, assembled.validation);
        return { ok: false as const, validation: assembled.validation };
      }
      const runtime = await this.createRuntime(tx, workspaceId, actorId, assembled.normalized, assembled.package);
      await this.mutationAudit(tx, workspaceId, actorId, runtime.id,
        "conversation.runtime.created", null, runtime, assembled.normalized.auditMetadata);
      return { ok: true as const, runtime };
    });
    if (!outcome.ok) this.throwValidation(outcome.validation);
    return outcome.runtime;
  }

  async validate(workspaceId: string, actorId: string, id: string) {
    const validation = await this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, id);
      const input = this.readInput(runtime.runtimePackage);
      const assembled = await this.assemble(tx, workspaceId, input);
      const storedInputHash = this.hash(this.record(runtime.runtimePackage).input);
      const currentInputHash = this.hash(assembled.package.input);
      if (storedInputHash !== currentInputHash) {
        assembled.validation.diagnostics.push(this.error("SNAPSHOT_INTEGRITY_FAILED", "runtimePackage",
          "Stored normalized input does not match current normalized metadata"));
        assembled.validation.valid = false;
      }
      await this.mutationAudit(tx, workspaceId, actorId, id,
        assembled.validation.valid ? "conversation.runtime.validated" : "conversation.runtime.validation_failed",
        null, assembled.validation);
      return assembled.validation;
    });
    if (!validation.valid) this.throwValidation(validation);
    return validation;
  }

  async transition(
    workspaceId: string,
    actorId: string,
    id: string,
    dto: TransitionConversationStateDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, id);
      this.assertMutable(runtime);
      if (!runtime.state) throw new BadRequestException("Conversation Runtime state metadata is missing");
      this.validator.assertTransition(runtime.state.state, dto.state);
      const nextState = {
        state: dto.state,
        sequence: runtime.state.sequence + 1,
        metadata: dto.metadata ?? {}
      };
      const currentPackage = this.record(runtime.runtimePackage);
      const corePackage: JsonRecord = { ...currentPackage, state: nextState };
      delete corePackage.hashes;
      delete corePackage.preparedAt;
      const packageHash = this.hash(corePackage);
      const checksum = this.hash({ packageHash, compatibilityVersion: runtime.compatibilityVersion });
      await tx.conversationRuntimeState.update({
        where: { runtimeId: runtime.id },
        data: {
          state: dto.state,
          sequence: nextState.sequence,
          metadata: json(nextState.metadata),
          updatedById: actorId
        }
      });
      const updated = await tx.conversationRuntime.update({
        where: { id: runtime.id },
        data: {
          updatedById: actorId,
          runtimePackage: json({
            ...corePackage,
            hashes: { packageHash, checksum },
            preparedAt: new Date().toISOString()
          }),
          packageHash,
          checksum
        },
        select: this.runtimeSelect
      });
      await this.mutationAudit(tx, workspaceId, actorId, id, "conversation.runtime.state_changed",
        runtime.state, nextState);
      return updated;
    });
  }

  async publish(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, id);
      this.assertPublishable(runtime);
      const revision = runtime.revision + 1;
      const snapshot = await tx.conversationRuntimeSnapshot.create({
        data: {
          workspaceId,
          runtimeId: runtime.id,
          revision,
          createdById: actorId,
          compatibilityVersion: runtime.compatibilityVersion,
          snapshot: json(runtime.runtimePackage),
          packageHash: runtime.packageHash,
          checksum: runtime.checksum
        },
        select: this.snapshotSelect
      });
      await tx.conversationRuntimeVersion.create({
        data: {
          runtimeId: runtime.id,
          revision,
          compatibilityVersion: runtime.compatibilityVersion,
          snapshot: json(runtime.runtimePackage),
          packageHash: runtime.packageHash,
          checksum: runtime.checksum,
          createdById: actorId
        }
      });
      await tx.conversationRuntime.update({
        where: { id: runtime.id },
        data: {
          status: ConversationRuntimeStatus.PUBLISHED,
          revision,
          publishedAt: new Date(),
          updatedById: actorId
        }
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        "conversation.runtime.published", { revision: runtime.revision }, snapshot);
      return snapshot;
    });
  }

  async rollback(workspaceId: string, actorId: string, id: string, versionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const runtime = await this.requireRuntime(tx, workspaceId, id);
      this.assertPublishable(runtime);
      const source = await tx.conversationRuntimeVersion.findFirst({
        where: { id: versionId, runtimeId: runtime.id },
        select: {
          id: true, revision: true, compatibilityVersion: true, snapshot: true,
          packageHash: true, checksum: true
        }
      });
      if (!source) throw new NotFoundException("Conversation Runtime version was not found");
      if (source.revision > runtime.revision) {
        throw new BadRequestException("Rollback source revision cannot exceed the current revision");
      }
      const revision = runtime.revision + 1;
      const snapshot = await tx.conversationRuntimeSnapshot.create({
        data: {
          workspaceId,
          runtimeId: runtime.id,
          revision,
          createdById: actorId,
          compatibilityVersion: source.compatibilityVersion,
          snapshot: json(source.snapshot),
          packageHash: source.packageHash,
          checksum: source.checksum
        },
        select: this.snapshotSelect
      });
      await tx.conversationRuntimeVersion.create({
        data: {
          runtimeId: runtime.id,
          revision,
          sourceRevision: source.revision,
          compatibilityVersion: source.compatibilityVersion,
          snapshot: json(source.snapshot),
          packageHash: source.packageHash,
          checksum: source.checksum,
          createdById: actorId
        }
      });
      const sourceState = this.record(this.record(source.snapshot).state);
      if (Object.values(ConversationRuntimeStateType).includes(
        sourceState.state as ConversationRuntimeStateType
      )) {
        await tx.conversationRuntimeState.update({
          where: { runtimeId: runtime.id },
          data: {
            state: sourceState.state as ConversationRuntimeStateType,
            sequence: typeof sourceState.sequence === "number" ? sourceState.sequence : 0,
            metadata: json(this.record(sourceState.metadata)),
            updatedById: actorId
          }
        });
      }
      await tx.conversationRuntime.update({
        where: { id: runtime.id },
        data: {
          status: ConversationRuntimeStatus.PUBLISHED,
          revision,
          compatibilityVersion: source.compatibilityVersion,
          runtimePackage: json(source.snapshot),
          packageHash: source.packageHash,
          checksum: source.checksum,
          publishedAt: new Date(),
          updatedById: actorId
        }
      });
      await this.mutationAudit(tx, workspaceId, actorId, id, "conversation.runtime.rolled_back",
        { revision: runtime.revision }, { revision, sourceRevision: source.revision });
      return snapshot;
    });
  }

  async clone(
    workspaceId: string,
    actorId: string,
    id: string,
    dto: CloneConversationRuntimeDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const source = await this.requireRuntime(tx, workspaceId, id);
      if (source.status === ConversationRuntimeStatus.DELETED) {
        throw new BadRequestException("Deleted Conversation Runtime cannot be cloned");
      }
      const input = this.readInput(source.runtimePackage);
      const cloneInput = { ...input, name: dto.name ?? `${input.name} Copy` };
      const assembled = await this.assemble(tx, workspaceId, cloneInput);
      if (!assembled.validation.valid) this.throwValidation(assembled.validation);
      const cloned = await this.createRuntime(
        tx, workspaceId, actorId, assembled.normalized, assembled.package, source.id
      );
      await this.mutationAudit(tx, workspaceId, actorId, cloned.id,
        "conversation.runtime.cloned", { sourceId: source.id }, cloned);
      return cloned;
    });
  }

  archive(workspaceId: string, actorId: string, id: string) {
    return this.lifecycle(workspaceId, actorId, id, ConversationRuntimeStatus.ARCHIVED,
      "conversation.runtime.archived", { archivedAt: new Date(), deletedAt: null });
  }

  async restore(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id, true);
      if (current.status !== ConversationRuntimeStatus.ARCHIVED &&
        current.status !== ConversationRuntimeStatus.DELETED) {
        throw new BadRequestException("Only archived or deleted Conversation Runtime records can be restored");
      }
      const status = current.revision > 0
        ? ConversationRuntimeStatus.PUBLISHED
        : ConversationRuntimeStatus.DRAFT;
      const updated = await tx.conversationRuntime.update({
        where: { id: current.id },
        data: {
          status, archivedAt: null, deletedAt: null, updatedById: actorId
        },
        select: this.runtimeSelect
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        "conversation.runtime.restored", current, updated);
      return updated;
    });
  }

  softDelete(workspaceId: string, actorId: string, id: string) {
    return this.lifecycle(workspaceId, actorId, id, ConversationRuntimeStatus.DELETED,
      "conversation.runtime.deleted", { archivedAt: null, deletedAt: new Date() });
  }

  get(workspaceId: string, id: string) {
    return this.requireRuntime(this.prisma, workspaceId, id);
  }

  getSnapshot(workspaceId: string, id: string) {
    return this.requireSnapshot(this.prisma, workspaceId, id);
  }

  async list(workspaceId: string, query: ConversationRuntimeListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.ConversationRuntimeWhereInput = {
      workspaceId,
      deletedAt: query.status === ConversationRuntimeStatus.DELETED ? { not: null } : null,
      status: query.status,
      sourceConversationId: query.sourceConversationId,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.conversationRuntime.findMany({
        where, select: this.runtimeSelect, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.conversationRuntime.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listSnapshots(workspaceId: string, query: ConversationSnapshotListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.ConversationRuntimeSnapshotWhereInput = {
      workspaceId, runtimeId: query.runtimeId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.conversationRuntimeSnapshot.findMany({
        where, select: this.snapshotSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.conversationRuntimeSnapshot.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async compare(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await this.prisma.$transaction([
      this.prisma.conversationRuntimeSnapshot.findFirst({
        where: { id: leftId, workspaceId }, select: this.snapshotSelect
      }),
      this.prisma.conversationRuntimeSnapshot.findFirst({
        where: { id: rightId, workspaceId }, select: this.snapshotSelect
      })
    ]);
    if (!left || !right) throw new NotFoundException("One or more conversation snapshots were not found");
    const leftPackage = this.record(left.snapshot);
    const rightPackage = this.record(right.snapshot);
    return {
      identical: left.packageHash === right.packageHash && left.checksum === right.checksum,
      left: this.snapshotIdentity(left),
      right: this.snapshotIdentity(right),
      changed: {
        compatibilityVersion: left.compatibilityVersion !== right.compatibilityVersion,
        context: this.changed(leftPackage, rightPackage, "contexts"),
        variables: this.changed(leftPackage, rightPackage, "variables"),
        messages: this.changed(leftPackage, rightPackage, "messages"),
        participants: this.changed(leftPackage, rightPackage, "participants"),
        attachments: this.changed(leftPackage, rightPackage, "attachments"),
        settings: this.changed(leftPackage, rightPackage, "settings"),
        state: this.changed(leftPackage, rightPackage, "state")
      }
    };
  }

  private async createRuntime(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    dto: PrepareConversationRuntimeDto,
    runtimePackage: JsonRecord,
    clonedFromId?: string
  ) {
    const packageHash = this.hash(this.packageCore(runtimePackage));
    const checksum = this.hash({ packageHash, compatibilityVersion: dto.compatibilityVersion });
    const data = {
        workspaceId, createdById: actorId, updatedById: actorId,
        sourceConversationId: dto.sourceConversationId, clonedFromId,
        name: dto.name, compatibilityVersion: dto.compatibilityVersion,
        metadata: json(dto.metadata ?? {}),
        runtimePackage: json({
          ...this.packageCore(runtimePackage),
          hashes: { packageHash, checksum },
          preparedAt: new Date().toISOString()
        }),
        packageHash, checksum,
        contexts: { create: (dto.contexts ?? []).map((item) => ({
          contextKey: item.contextKey,
          agentRuntimeSnapshotId: item.agentRuntimeSnapshotId,
          retrievalSnapshotId: item.retrievalSnapshotId,
          compiledPromptId: item.compiledPromptId,
          providerSnapshotId: item.providerSnapshotId,
          executionRequestId: item.executionRequestId,
          executionRunId: item.executionRunId,
          locale: item.locale, timezone: item.timezone, correlationId: item.correlationId,
          metadata: json(item.metadata ?? {})
        })) },
        variables: { create: (dto.variables ?? []).map((item) => ({
          name: item.name, type: item.type, value: jsonValue(item.value), metadata: json(item.metadata ?? {})
        })) },
        participants: { create: (dto.participants ?? []).map((item) => ({
          participantKey: item.participantKey, type: item.type, referenceId: item.referenceId,
          displayMetadata: json(item.displayMetadata ?? {}), metadata: json(item.metadata ?? {})
        })) },
        messages: { create: (dto.messages ?? []).map((item) => ({
          messageIdentifier: item.messageIdentifier, ordinal: item.ordinal, role: item.role,
          participantKey: item.participantKey, contentHash: item.contentHash,
          metadata: json(item.metadata ?? {}), tokenMetadata: json(item.tokenMetadata ?? {})
        })) },
        attachments: { create: (dto.attachments ?? []).map((item) => ({
          attachmentIdentifier: item.attachmentIdentifier, messageIdentifier: item.messageIdentifier,
          type: item.type, mimeType: item.mimeType, fileName: item.fileName,
          sizeBytes: item.sizeBytes === undefined ? undefined : BigInt(item.sizeBytes),
          checksum: item.checksum, metadata: json(item.metadata ?? {})
        })) },
        labels: { create: (dto.labels ?? []).map((item) => ({
          value: item.value, metadata: json(item.metadata ?? {})
        })) },
        tags: { create: (dto.tags ?? []).map((item) => ({
          value: item.value, metadata: json(item.metadata ?? {})
        })) },
        notes: { create: (dto.notes ?? []).map((item) => ({
          noteKey: item.noteKey, metadata: json(item.metadata ?? {})
        })) },
        settings: { create: {
          compatibilityVersion: dto.compatibilityVersion,
          settings: json(dto.settings ?? {})
        } },
        state: { create: {
          state: dto.initialState ?? ConversationRuntimeStateType.READY,
          sequence: 0,
          metadata: json(dto.stateMetadata ?? {}),
          updatedById: actorId
        } },
        auditMetadata: { create: {
          actorId, eventType: "conversation.runtime.created",
          metadata: json(dto.auditMetadata ?? {})
        } }
      };
    return tx.conversationRuntime.create({
      data: data as never,
      select: this.runtimeSelect
    });
  }

  private async assemble(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    input: PrepareConversationRuntimeDto
  ) {
    const normalized = this.validator.normalize(input);
    const diagnostics: ConversationRuntimeDiagnostic[] = [];
    if (normalized.sourceConversationId) {
      const conversation = await tx.conversation.findFirst({
        where: { id: normalized.sourceConversationId, workspaceId, deletedAt: null },
        select: { id: true, channel: true, status: true, language: true }
      });
      if (!conversation) diagnostics.push(this.error("CONVERSATION_REFERENCE_INVALID", "sourceConversationId",
        "Conversation must belong to the active workspace"));
    }
    for (const [index, context] of (normalized.contexts ?? []).entries()) {
      await this.validateContext(tx, workspaceId, context, index, diagnostics);
    }
    for (const [index, participant] of (normalized.participants ?? []).entries()) {
      await this.validateParticipant(tx, workspaceId, participant, index, diagnostics);
    }
    const validation = this.validator.validate(normalized, diagnostics);
    const runtimePackage = {
      input: normalized,
      workspaceId,
      sourceConversationId: normalized.sourceConversationId ?? null,
      contexts: normalized.contexts ?? [],
      variables: normalized.variables ?? [],
      participants: normalized.participants ?? [],
      messages: normalized.messages ?? [],
      attachments: normalized.attachments ?? [],
      labels: normalized.labels ?? [],
      tags: normalized.tags ?? [],
      notes: normalized.notes ?? [],
      settings: normalized.settings ?? {},
      state: {
        state: normalized.initialState ?? ConversationRuntimeStateType.READY,
        sequence: 0,
        metadata: normalized.stateMetadata ?? {}
      },
      metadata: normalized.metadata ?? {},
      compatibilityVersion: normalized.compatibilityVersion,
      validation
    };
    return { normalized, validation, package: runtimePackage };
  }

  private async validateContext(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    context: ConversationContextDto,
    index: number,
    diagnostics: ConversationRuntimeDiagnostic[]
  ) {
    const checks: Array<[string | undefined, string, Promise<{ id: string } | null>]> = [
      [context.agentRuntimeSnapshotId, "agentRuntimeSnapshotId",
        context.agentRuntimeSnapshotId ? tx.agentRuntimeSnapshot.findFirst({
          where: { id: context.agentRuntimeSnapshotId, workspaceId }, select: { id: true }
        }) : Promise.resolve(null)],
      [context.retrievalSnapshotId, "retrievalSnapshotId",
        context.retrievalSnapshotId ? tx.retrievalRuntimeSnapshot.findFirst({
          where: { id: context.retrievalSnapshotId, workspaceId }, select: { id: true }
        }) : Promise.resolve(null)],
      [context.compiledPromptId, "compiledPromptId",
        context.compiledPromptId ? tx.compiledPrompt.findFirst({
          where: { id: context.compiledPromptId, workspaceId }, select: { id: true }
        }) : Promise.resolve(null)],
      [context.providerSnapshotId, "providerSnapshotId",
        context.providerSnapshotId ? tx.providerRequestSnapshot.findFirst({
          where: { id: context.providerSnapshotId, workspaceId }, select: { id: true }
        }) : Promise.resolve(null)],
      [context.executionRequestId, "executionRequestId",
        context.executionRequestId ? tx.executionRequest.findFirst({
          where: { id: context.executionRequestId, workspaceId }, select: { id: true }
        }) : Promise.resolve(null)],
      [context.executionRunId, "executionRunId",
        context.executionRunId ? tx.executionRun.findFirst({
          where: { id: context.executionRunId, workspaceId }, select: { id: true }
        }) : Promise.resolve(null)]
    ];
    for (const [id, key, query] of checks) {
      if (id && !(await query)) diagnostics.push(this.error("CONTEXT_REFERENCE_INVALID",
        `contexts.${index}.${key}`, "Referenced runtime resource was not found in the active workspace"));
    }
  }

  private async validateParticipant(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    participant: ConversationParticipantDto,
    index: number,
    diagnostics: ConversationRuntimeDiagnostic[]
  ) {
    if (!participant.referenceId ||
      participant.type === ConversationRuntimeParticipantType.SYSTEM ||
      participant.type === ConversationRuntimeParticipantType.EXTERNAL) return;
    let found: { id: string } | null = null;
    if (participant.type === ConversationRuntimeParticipantType.CUSTOMER) {
      found = await tx.customer.findFirst({
        where: { id: participant.referenceId, workspaceId, deletedAt: null }, select: { id: true }
      });
    } else if (participant.type === ConversationRuntimeParticipantType.USER) {
      const membership = await tx.workspaceMembership.findFirst({
        where: { userId: participant.referenceId, workspaceId, status: "ACTIVE" }, select: { userId: true }
      });
      found = membership ? { id: membership.userId } : null;
    } else if (participant.type === ConversationRuntimeParticipantType.AGENT) {
      found = await tx.aiAgent.findFirst({
        where: {
          id: participant.referenceId, workspaceId, status: "PUBLISHED",
          archivedAt: null, deletedAt: null
        },
        select: { id: true }
      });
    }
    if (!found) diagnostics.push(this.error("PARTICIPANT_REFERENCE_INVALID",
      `participants.${index}.referenceId`, "Participant reference is unavailable in the active workspace"));
  }

  private async lifecycle(
    workspaceId: string,
    actorId: string,
    id: string,
    status: ConversationRuntimeStatus,
    action: string,
    dates: { archivedAt: Date | null; deletedAt: Date | null }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id, true);
      if (current.status === status) throw new BadRequestException(`Conversation Runtime is already ${status}`);
      const updated = await tx.conversationRuntime.update({
        where: { id: current.id },
        data: { status, ...dates, updatedById: actorId },
        select: this.runtimeSelect
      });
      await this.mutationAudit(tx, workspaceId, actorId, id, action, current, updated);
      return updated;
    });
  }

  private assertMutable(runtime: { status: ConversationRuntimeStatus }) {
    if (runtime.status === ConversationRuntimeStatus.ARCHIVED ||
      runtime.status === ConversationRuntimeStatus.DELETED) {
      throw new BadRequestException("Archived or deleted Conversation Runtime is immutable");
    }
  }

  private assertPublishable(runtime: {
    status: ConversationRuntimeStatus;
    state: { state: ConversationRuntimeStateType } | null;
  }) {
    this.assertMutable(runtime);
    if (!runtime.state || runtime.state.state === ConversationRuntimeStateType.INITIALIZED) {
      throw new BadRequestException("Conversation Runtime must be ready before publishing");
    }
  }

  private readonly runtimeSelect = {
    id: true, workspaceId: true, createdById: true, updatedById: true,
    sourceConversationId: true, clonedFromId: true, name: true, status: true,
    revision: true, compatibilityVersion: true, metadata: true, runtimePackage: true,
    packageHash: true, checksum: true, publishedAt: true, archivedAt: true,
    deletedAt: true, createdAt: true, updatedAt: true,
    contexts: true, variables: true, messages: true, participants: true,
    attachments: true, labels: true, tags: true, notes: true, settings: true,
    state: true, versions: true, auditMetadata: true
  } as const;

  private readonly snapshotSelect = {
    id: true, workspaceId: true, runtimeId: true, revision: true, createdById: true,
    compatibilityVersion: true, snapshot: true, packageHash: true, checksum: true, createdAt: true
  } as const;

  private requireRuntime(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    includeDeleted = false
  ) {
    return client.conversationRuntime.findFirst({
      where: { id, workspaceId, deletedAt: includeDeleted ? undefined : null },
      select: this.runtimeSelect
    }).then((runtime) => {
      if (!runtime) throw new NotFoundException("Conversation Runtime was not found");
      return runtime;
    });
  }

  private requireSnapshot(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.conversationRuntimeSnapshot.findFirst({
      where: { id, workspaceId }, select: this.snapshotSelect
    }).then((snapshot) => {
      if (!snapshot) throw new NotFoundException("Conversation Runtime snapshot was not found");
      return snapshot;
    });
  }

  private packageCore(runtimePackage: JsonRecord) {
    const core = { ...runtimePackage };
    delete core.hashes;
    delete core.preparedAt;
    return core;
  }

  private readInput(value: Prisma.JsonValue): PrepareConversationRuntimeDto {
    const input = this.record(value).input;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Stored Conversation Runtime input is invalid");
    }
    return input as unknown as PrepareConversationRuntimeDto;
  }

  private changed(left: JsonRecord, right: JsonRecord, key: string) {
    return this.stableStringify(left[key]) !== this.stableStringify(right[key]);
  }

  private snapshotIdentity(snapshot: {
    id: string; runtimeId: string; revision: number; compatibilityVersion: string;
    packageHash: string; checksum: string; createdAt: Date;
  }) {
    return {
      id: snapshot.id, runtimeId: snapshot.runtimeId, revision: snapshot.revision,
      compatibilityVersion: snapshot.compatibilityVersion, packageHash: snapshot.packageHash,
      checksum: snapshot.checksum, createdAt: snapshot.createdAt
    };
  }

  private throwValidation(validation: ConversationValidationResult): never {
    throw new BadRequestException({
      message: "Conversation Runtime validation failed",
      diagnostics: validation.diagnostics
    });
  }

  private error(code: string, path: string, message: string): ConversationRuntimeDiagnostic {
    return { severity: "ERROR", code, path, message };
  }

  private record(value: unknown): JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as JsonRecord : {};
  }

  private hash(value: unknown) {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }

  private async mutationAudit(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    runtimeId: string,
    action: string,
    before: unknown,
    after: unknown,
    metadata: unknown = {}
  ) {
    await this.audit(tx, workspaceId, actorId, action, "ConversationRuntime", runtimeId, before, after);
    await tx.conversationRuntimeAuditMetadata.create({
      data: {
        runtimeId, actorId, eventType: action,
        metadata: json(metadata)
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
        workspaceId, userId: actorId, action, entityType, entityId,
        oldValues: before === null ? Prisma.JsonNull : json(before),
        newValues: after === null ? Prisma.JsonNull : json(after)
      }
    });
  }
}
