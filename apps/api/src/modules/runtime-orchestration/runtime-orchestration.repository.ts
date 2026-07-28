import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ExecutionBindingTarget,
  ExecutionProfileVisibility,
  Prisma,
  RuntimeOrchestrationStatus
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateExecutionProfileDto,
  ExecutionBindingDto,
  ExecutionConcurrencyPolicyDto,
  ExecutionContextDto,
  ExecutionDependencyDto,
  ExecutionFallbackPolicyDto,
  ExecutionLabelDto,
  ExecutionLimitDto,
  ExecutionNamedSchemaDto,
  ExecutionNoteDto,
  ExecutionPolicyDto,
  ExecutionPriorityLevelDto,
  ExecutionRetryPolicyDto,
  ExecutionStrategyPolicyDto,
  ExecutionTimeoutDto,
  ExecutionVariableDto,
  OrchestrationTaxonomyDto,
  UpdateExecutionPriorityLevelDto,
  UpdateExecutionProfileDto,
  UpdateOrchestrationTaxonomyDto
} from "./dto/runtime-orchestration.dto";
import { RuntimeOrchestrationValidator } from "./runtime-orchestration.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

type ProfileSnapshot = {
  queueDefinitionId: string | null;
  priorityLevelId: string | null;
  name: string;
  slug: string;
  description: string | null;
  visibility: ExecutionProfileVisibility;
  metadata: JsonRecord;
  policy?: ExecutionPolicyDto;
  limits?: ExecutionLimitDto;
  timeouts?: ExecutionTimeoutDto;
  retryPolicy?: ExecutionRetryPolicyDto;
  failurePolicy?: ExecutionStrategyPolicyDto;
  fallbackPolicy?: ExecutionFallbackPolicyDto;
  concurrencyPolicy?: ExecutionConcurrencyPolicyDto;
  contexts: ExecutionContextDto[];
  variables: ExecutionVariableDto[];
  inputs: ExecutionNamedSchemaDto[];
  outputs: ExecutionNamedSchemaDto[];
  bindings: ExecutionBindingDto[];
  dependencies: ExecutionDependencyDto[];
  labels: ExecutionLabelDto[];
  tagIds: string[];
  notes: ExecutionNoteDto[];
};

@Injectable()
export class RuntimeOrchestrationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: RuntimeOrchestrationValidator
  ) {}

  createQueue(workspaceId: string, actorId: string, dto: OrchestrationTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const item = await tx.queueDefinition.create({
        data: {
          workspaceId, name: dto.name, slug: dto.slug, description: dto.description,
          metadata: json(dto.metadata ?? {})
        },
        select: this.queueSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.queue.created", "QueueDefinition", item.id, null, item);
      return item;
    }));
  }

  updateQueue(workspaceId: string, actorId: string, id: string, dto: UpdateOrchestrationTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const before = await this.requireQueue(tx, workspaceId, id);
      const item = await tx.queueDefinition.update({
        where: { id },
        data: {
          name: dto.name, slug: dto.slug, description: dto.description,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
        },
        select: this.queueSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.queue.updated", "QueueDefinition", id, before, item);
      return item;
    }));
  }

  listQueues(workspaceId: string) {
    return this.prisma.queueDefinition.findMany({
      where: { workspaceId }, orderBy: { name: "asc" }, select: this.queueSelect
    });
  }

  deleteQueue(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireQueue(tx, workspaceId, id);
      if (await tx.executionProfile.count({ where: { workspaceId, queueDefinitionId: id, deletedAt: null } })) {
        throw new ConflictException("Queue definition is in use");
      }
      await tx.queueDefinition.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.queue.deleted", "QueueDefinition", id, before, null);
    });
  }

  createPriority(workspaceId: string, actorId: string, dto: ExecutionPriorityLevelDto) {
    this.assertPriorityValue(dto.value);
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const item = await tx.executionPriorityLevel.create({
        data: {
          workspaceId, name: dto.name, slug: dto.slug, value: dto.value,
          description: dto.description, metadata: json(dto.metadata ?? {})
        },
        select: this.prioritySelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.priority.created", "ExecutionPriorityLevel", item.id, null, item);
      return item;
    }));
  }

  updatePriority(workspaceId: string, actorId: string, id: string, dto: UpdateExecutionPriorityLevelDto) {
    if (dto.value !== undefined) this.assertPriorityValue(dto.value);
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const before = await this.requirePriority(tx, workspaceId, id);
      const item = await tx.executionPriorityLevel.update({
        where: { id },
        data: {
          name: dto.name, slug: dto.slug, value: dto.value, description: dto.description,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
        },
        select: this.prioritySelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.priority.updated", "ExecutionPriorityLevel", id, before, item);
      return item;
    }));
  }

  listPriorities(workspaceId: string) {
    return this.prisma.executionPriorityLevel.findMany({
      where: { workspaceId }, orderBy: { value: "desc" }, select: this.prioritySelect
    });
  }

  deletePriority(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requirePriority(tx, workspaceId, id);
      if (await tx.executionProfile.count({ where: { workspaceId, priorityLevelId: id, deletedAt: null } })) {
        throw new ConflictException("Priority level is in use");
      }
      await tx.executionPriorityLevel.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.priority.deleted", "ExecutionPriorityLevel", id, before, null);
    });
  }

  createTag(workspaceId: string, actorId: string, dto: OrchestrationTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const item = await tx.executionTag.create({
        data: { workspaceId, name: dto.name, slug: dto.slug, metadata: json(dto.metadata ?? {}) },
        select: this.tagSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.tag.created", "ExecutionTag", item.id, null, item);
      return item;
    }));
  }

  updateTag(workspaceId: string, actorId: string, id: string, dto: UpdateOrchestrationTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const before = await this.requireTag(tx, workspaceId, id);
      const item = await tx.executionTag.update({
        where: { id },
        data: {
          name: dto.name, slug: dto.slug,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
        },
        select: this.tagSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.tag.updated", "ExecutionTag", id, before, item);
      return item;
    }));
  }

  listTags(workspaceId: string) {
    return this.prisma.executionTag.findMany({
      where: { workspaceId }, orderBy: { name: "asc" }, select: this.tagSelect
    });
  }

  deleteTag(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireTag(tx, workspaceId, id);
      if (await tx.executionTagAssignment.count({ where: { tagId: id, profile: { workspaceId } } })) {
        throw new ConflictException("Execution tag is in use");
      }
      await tx.executionTag.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.tag.deleted", "ExecutionTag", id, before, null);
    });
  }

  create(workspaceId: string, actorId: string, dto: CreateExecutionProfileDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const snapshot = this.fromDto(dto);
      await this.validateSnapshot(tx, workspaceId, snapshot);
      await this.assertUniqueName(tx, workspaceId, snapshot.name);
      const profile = await tx.executionProfile.create({
        data: {
          workspaceId, ...this.scalarData(snapshot), status: "DRAFT", revision: 0,
          createdById: actorId, updatedById: actorId, ...this.childCreates(snapshot)
        },
        select: this.profileSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.profile.created", "ExecutionProfile", profile.id, null, profile);
      return profile;
    }));
  }

  updateDraft(workspaceId: string, actorId: string, profileId: string, dto: UpdateExecutionProfileDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const before = await this.requireProfile(tx, workspaceId, profileId);
      this.assertDraft(before.status);
      const snapshot = this.mergeSnapshot(this.snapshot(before), dto);
      await this.validateSnapshot(tx, workspaceId, snapshot);
      await this.assertUniqueName(tx, workspaceId, snapshot.name, profileId);
      await this.deletePolicyRecords(tx, profileId);
      const profile = await tx.executionProfile.update({
        where: { id: profileId },
        data: {
          ...this.scalarData(snapshot), updatedById: actorId,
          ...this.childReplacements(snapshot), ...this.policyCreates(snapshot)
        },
        select: this.profileSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.profile.draft_updated", "ExecutionProfile", profile.id, before, profile);
      return profile;
    }));
  }

  publish(workspaceId: string, actorId: string, profileId: string, changeSummary?: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireProfile(tx, workspaceId, profileId);
      this.assertDraft(before.status);
      const snapshot = this.snapshot(before);
      await this.validateSnapshot(tx, workspaceId, snapshot);
      const revision = before.revision + 1;
      const version = await tx.executionProfileVersion.create({
        data: {
          profileId, revision, snapshot: json(snapshot), changeSummary,
          createdById: actorId, publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const profile = await tx.executionProfile.update({
        where: { id: profileId },
        data: { status: "PUBLISHED", revision, publishedAt: new Date(), updatedById: actorId },
        select: this.profileSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.profile.published", "ExecutionProfile", profile.id, before, { profile, version });
      return { profile, version };
    });
  }

  rollback(
    workspaceId: string,
    actorId: string,
    profileId: string,
    sourceRevision: number,
    changeSummary?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireProfile(tx, workspaceId, profileId, true);
      const source = await tx.executionProfileVersion.findFirst({
        where: { profileId, revision: sourceRevision, profile: { workspaceId } },
        select: this.versionSelect
      });
      if (!source) throw new NotFoundException("Published execution profile version was not found");
      const snapshot = this.readSnapshot(source.snapshot);
      await this.validateSnapshot(tx, workspaceId, snapshot);
      await this.assertUniqueName(tx, workspaceId, snapshot.name, profileId);
      const revision = before.revision + 1;
      const version = await tx.executionProfileVersion.create({
        data: {
          profileId, revision, snapshot: json(snapshot),
          changeSummary: changeSummary ?? `Rollback to revision ${sourceRevision}`,
          createdById: actorId, publishedAt: new Date()
        },
        select: this.versionSelect
      });
      await this.deletePolicyRecords(tx, profileId);
      const profile = await tx.executionProfile.update({
        where: { id: profileId },
        data: {
          ...this.scalarData(snapshot), ...this.childReplacements(snapshot),
          ...this.policyCreates(snapshot), status: "PUBLISHED", revision,
          publishedAt: new Date(), archivedAt: null, deletedAt: null, updatedById: actorId
        },
        select: this.profileSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.profile.rolled_back", "ExecutionProfile", profile.id, before, { sourceRevision, profile, version });
      return { profile, version };
    });
  }

  clone(workspaceId: string, actorId: string, profileId: string, name: string, slug: string) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const source = await this.requireProfile(tx, workspaceId, profileId, true);
      const snapshot = { ...this.snapshot(source), name, slug };
      await this.validateSnapshot(tx, workspaceId, snapshot);
      await this.assertUniqueName(tx, workspaceId, name);
      const profile = await tx.executionProfile.create({
        data: {
          workspaceId, ...this.scalarData(snapshot), ...this.childCreates(snapshot),
          status: "DRAFT", revision: 0, publishedAt: null, archivedAt: null,
          deletedAt: null, createdById: actorId, updatedById: actorId
        },
        select: this.profileSelect
      });
      await this.audit(tx, workspaceId, actorId, "runtime.orchestration.profile.cloned", "ExecutionProfile", profile.id, null, { sourceProfileId: source.id, profile });
      return profile;
    }));
  }

  archive(workspaceId: string, actorId: string, profileId: string) {
    return this.stateMutation(workspaceId, actorId, profileId, "archive");
  }
  restore(workspaceId: string, actorId: string, profileId: string) {
    return this.stateMutation(workspaceId, actorId, profileId, "restore");
  }
  softDelete(workspaceId: string, actorId: string, profileId: string) {
    return this.stateMutation(workspaceId, actorId, profileId, "delete");
  }
  get(workspaceId: string, profileId: string) {
    return this.requireProfile(this.prisma, workspaceId, profileId);
  }
  async history(workspaceId: string, profileId: string) {
    await this.requireProfile(this.prisma, workspaceId, profileId, true);
    return this.prisma.executionProfileVersion.findMany({
      where: { profileId, profile: { workspaceId } },
      orderBy: { revision: "desc" }, select: this.versionSelect
    });
  }

  async list(input: {
    workspaceId: string;
    page: number;
    limit: number;
    search?: string;
    status?: RuntimeOrchestrationStatus;
    visibility?: ExecutionProfileVisibility;
    queueDefinitionId?: string;
    priorityLevelId?: string;
    tagId?: string;
    sortBy: "name" | "createdAt" | "updatedAt" | "publishedAt";
    sortOrder: "asc" | "desc";
  }) {
    const where: Prisma.ExecutionProfileWhereInput = {
      workspaceId: input.workspaceId, deletedAt: null, status: input.status,
      visibility: input.visibility, queueDefinitionId: input.queueDefinitionId,
      priorityLevelId: input.priorityLevelId,
      ...(input.tagId ? { tagLinks: { some: { tagId: input.tagId, tag: { workspaceId: input.workspaceId } } } } : {}),
      ...(input.search ? { OR: [
        { name: { contains: input.search, mode: "insensitive" } },
        { slug: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } }
      ] } : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionProfile.findMany({
        where, orderBy: [{ [input.sortBy]: input.sortOrder }, { id: "asc" }],
        skip: (input.page - 1) * input.limit, take: input.limit, select: this.profileSelect
      }),
      this.prisma.executionProfile.count({ where })
    ]);
    return {
      data,
      pagination: {
        page: input.page, limit: input.limit, total,
        totalPages: Math.ceil(total / input.limit)
      }
    };
  }

  private readonly queueSelect = {
    id: true, workspaceId: true, name: true, slug: true, description: true,
    metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly prioritySelect = {
    id: true, workspaceId: true, name: true, slug: true, value: true,
    description: true, metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly tagSelect = {
    id: true, workspaceId: true, name: true, slug: true,
    metadata: true, createdAt: true, updatedAt: true
  } as const;
  private readonly profileSelect = {
    id: true, workspaceId: true, queueDefinitionId: true, priorityLevelId: true,
    name: true, slug: true, description: true, status: true, visibility: true,
    revision: true, metadata: true, createdById: true, updatedById: true,
    createdAt: true, updatedAt: true, publishedAt: true, archivedAt: true, deletedAt: true,
    policy: true, limits: true, timeouts: true, retryPolicy: true,
    failurePolicy: true, fallbackPolicy: true, concurrency: true,
    contexts: { orderBy: { sortOrder: "asc" as const } },
    variables: { orderBy: { sortOrder: "asc" as const } },
    inputs: { orderBy: { sortOrder: "asc" as const } },
    outputs: { orderBy: { sortOrder: "asc" as const } },
    bindings: { orderBy: { sortOrder: "asc" as const } },
    dependencies: { orderBy: { bindingKey: "asc" as const } },
    labels: { orderBy: { name: "asc" as const } },
    tagLinks: { select: { tag: { select: this.tagSelect } }, orderBy: { tag: { name: "asc" as const } } },
    notes: { orderBy: { sortOrder: "asc" as const } }
  } as const;
  private readonly versionSelect = {
    id: true, profileId: true, revision: true, snapshot: true, changeSummary: true,
    createdById: true, createdAt: true, publishedAt: true
  } as const;

  private requireQueue(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.queueDefinition.findFirst({ where: { id, workspaceId }, select: this.queueSelect }).then((item) => {
      if (!item) throw new NotFoundException("Queue definition was not found");
      return item;
    });
  }
  private requirePriority(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.executionPriorityLevel.findFirst({ where: { id, workspaceId }, select: this.prioritySelect }).then((item) => {
      if (!item) throw new NotFoundException("Execution priority level was not found");
      return item;
    });
  }
  private requireTag(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.executionTag.findFirst({ where: { id, workspaceId }, select: this.tagSelect }).then((item) => {
      if (!item) throw new NotFoundException("Execution tag was not found");
      return item;
    });
  }
  private requireProfile(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    includeDeleted = false
  ) {
    return client.executionProfile.findFirst({
      where: { id, workspaceId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: this.profileSelect
    }).then((item) => {
      if (!item) throw new NotFoundException("Execution profile was not found");
      return item;
    });
  }

  private async assertUniqueName(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    name: string,
    excludeId?: string
  ) {
    const duplicate = await tx.executionProfile.findFirst({
      where: {
        workspaceId, name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: { id: true }
    });
    if (duplicate) throw new ConflictException("An execution profile with this name already exists");
  }

  private async validateSnapshot(tx: Prisma.TransactionClient, workspaceId: string, snapshot: ProfileSnapshot) {
    if (snapshot.queueDefinitionId) await this.requireQueue(tx, workspaceId, snapshot.queueDefinitionId);
    if (snapshot.priorityLevelId) await this.requirePriority(tx, workspaceId, snapshot.priorityLevelId);
    this.unique(snapshot.contexts.map((item) => item.name), "Execution contexts");
    this.unique(snapshot.variables.map((item) => item.name), "Execution variables");
    this.unique(snapshot.inputs.map((item) => item.name), "Execution inputs");
    this.unique(snapshot.outputs.map((item) => item.name), "Execution outputs");
    this.unique(snapshot.labels.map((item) => item.name), "Execution labels");
    this.validator.validate(snapshot);
    await this.validateTags(tx, workspaceId, snapshot.tagIds);
    await this.validateBindings(tx, workspaceId, snapshot.bindings);
    if (snapshot.fallbackPolicy?.targetType && snapshot.fallbackPolicy.targetReferenceId) {
      await this.validateBindings(tx, workspaceId, [{
        key: "fallback", targetType: snapshot.fallbackPolicy.targetType,
        referenceId: snapshot.fallbackPolicy.targetReferenceId
      }]);
    }
  }

  private async validateTags(tx: Prisma.TransactionClient, workspaceId: string, tagIds: string[]) {
    this.unique(tagIds, "Execution tags");
    if (!tagIds.length) return;
    if (await tx.executionTag.count({ where: { id: { in: tagIds }, workspaceId } }) !== tagIds.length) {
      throw new BadRequestException("One or more execution tags are outside the workspace");
    }
  }

  private async validateBindings(tx: Prisma.TransactionClient, workspaceId: string, bindings: ExecutionBindingDto[]) {
    const ids = (type: ExecutionBindingTarget) =>
      [...new Set(bindings.filter((item) => item.targetType === type).map((item) => item.referenceId))];
    const workspaceIds = ids("WORKSPACE");
    if (workspaceIds.some((id) => id !== workspaceId)) {
      throw new BadRequestException("Workspace bindings must reference the active workspace");
    }
    await Promise.all([
      this.assertReferences(ids("WORKFLOW"), (values) => tx.workflow.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Workflow"),
      this.assertReferences(ids("AGENT"), (values) => tx.aiAgent.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Agent"),
      this.assertReferences(ids("PROMPT"), (values) => tx.promptLibraryItem.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Prompt"),
      this.assertReferences(ids("KNOWLEDGE"), (values) => tx.knowledgeDocument.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Knowledge"),
      this.assertReferences(ids("TOOL"), (values) => tx.toolDefinition.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Tool"),
      this.assertReferences(ids("PROVIDER"), (values) => tx.aiProviderConfiguration.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Provider configuration")
    ]);
  }

  private async assertReferences(
    ids: string[],
    query: (ids: string[]) => Promise<Array<{ id: string }>>,
    label: string
  ) {
    if (ids.length && (await query(ids)).length !== ids.length) {
      throw new BadRequestException(`${label} bindings must belong to the active workspace`);
    }
  }

  private fromDto(dto: CreateExecutionProfileDto): ProfileSnapshot {
    return {
      queueDefinitionId: dto.queueDefinitionId ?? null,
      priorityLevelId: dto.priorityLevelId ?? null,
      name: dto.name, slug: dto.slug, description: dto.description ?? null,
      visibility: dto.visibility ?? "WORKSPACE", metadata: dto.metadata ?? {},
      policy: dto.policy, limits: dto.limits, timeouts: dto.timeouts,
      retryPolicy: dto.retryPolicy, failurePolicy: dto.failurePolicy,
      fallbackPolicy: dto.fallbackPolicy, concurrencyPolicy: dto.concurrencyPolicy,
      contexts: dto.contexts ?? [], variables: dto.variables ?? [],
      inputs: dto.inputs ?? [], outputs: dto.outputs ?? [], bindings: dto.bindings ?? [],
      dependencies: dto.dependencies ?? [], labels: dto.labels ?? [],
      tagIds: dto.tagIds ?? [], notes: dto.notes ?? []
    };
  }

  private mergeSnapshot(current: ProfileSnapshot, dto: UpdateExecutionProfileDto): ProfileSnapshot {
    return {
      queueDefinitionId: dto.queueDefinitionId === undefined ? current.queueDefinitionId : dto.queueDefinitionId,
      priorityLevelId: dto.priorityLevelId === undefined ? current.priorityLevelId : dto.priorityLevelId,
      name: dto.name ?? current.name, slug: dto.slug ?? current.slug,
      description: dto.description === undefined ? current.description : dto.description,
      visibility: dto.visibility ?? current.visibility, metadata: dto.metadata ?? current.metadata,
      policy: dto.policy ?? current.policy, limits: dto.limits ?? current.limits,
      timeouts: dto.timeouts ?? current.timeouts, retryPolicy: dto.retryPolicy ?? current.retryPolicy,
      failurePolicy: dto.failurePolicy ?? current.failurePolicy,
      fallbackPolicy: dto.fallbackPolicy ?? current.fallbackPolicy,
      concurrencyPolicy: dto.concurrencyPolicy ?? current.concurrencyPolicy,
      contexts: dto.contexts ?? current.contexts, variables: dto.variables ?? current.variables,
      inputs: dto.inputs ?? current.inputs, outputs: dto.outputs ?? current.outputs,
      bindings: dto.bindings ?? current.bindings, dependencies: dto.dependencies ?? current.dependencies,
      labels: dto.labels ?? current.labels, tagIds: dto.tagIds ?? current.tagIds,
      notes: dto.notes ?? current.notes
    };
  }

  private scalarData(snapshot: ProfileSnapshot) {
    return {
      queueDefinitionId: snapshot.queueDefinitionId,
      priorityLevelId: snapshot.priorityLevelId,
      name: snapshot.name, slug: snapshot.slug, description: snapshot.description,
      visibility: snapshot.visibility, metadata: json(snapshot.metadata)
    };
  }

  private childCreates(snapshot: ProfileSnapshot) {
    return {
      ...this.policyCreates(snapshot),
      contexts: { create: this.contextData(snapshot.contexts) },
      variables: { create: this.variableData(snapshot.variables) },
      inputs: { create: this.namedSchemaData(snapshot.inputs) },
      outputs: { create: this.outputData(snapshot.outputs) },
      bindings: { create: this.bindingData(snapshot.bindings) },
      dependencies: { create: this.dependencyData(snapshot.dependencies) },
      labels: { create: this.labelData(snapshot.labels) },
      tagLinks: { create: snapshot.tagIds.map((tagId) => ({ tagId })) },
      notes: { create: this.noteData(snapshot.notes) }
    };
  }

  private childReplacements(snapshot: ProfileSnapshot) {
    return {
      contexts: { deleteMany: {}, create: this.contextData(snapshot.contexts) },
      variables: { deleteMany: {}, create: this.variableData(snapshot.variables) },
      inputs: { deleteMany: {}, create: this.namedSchemaData(snapshot.inputs) },
      outputs: { deleteMany: {}, create: this.outputData(snapshot.outputs) },
      bindings: { deleteMany: {}, create: this.bindingData(snapshot.bindings) },
      dependencies: { deleteMany: {}, create: this.dependencyData(snapshot.dependencies) },
      labels: { deleteMany: {}, create: this.labelData(snapshot.labels) },
      tagLinks: { deleteMany: {}, create: snapshot.tagIds.map((tagId) => ({ tagId })) },
      notes: { deleteMany: {}, create: this.noteData(snapshot.notes) }
    };
  }

  private policyCreates(snapshot: ProfileSnapshot) {
    return {
      policy: snapshot.policy ? { create: { config: json(snapshot.policy.config), metadata: json(snapshot.policy.metadata ?? {}) } } : undefined,
      limits: snapshot.limits ? { create: this.limitData(snapshot.limits) } : undefined,
      timeouts: snapshot.timeouts ? { create: this.timeoutData(snapshot.timeouts) } : undefined,
      retryPolicy: snapshot.retryPolicy ? { create: this.retryData(snapshot.retryPolicy) } : undefined,
      failurePolicy: snapshot.failurePolicy ? { create: this.strategyData(snapshot.failurePolicy) } : undefined,
      fallbackPolicy: snapshot.fallbackPolicy ? { create: this.fallbackData(snapshot.fallbackPolicy) } : undefined,
      concurrency: snapshot.concurrencyPolicy ? { create: this.concurrencyData(snapshot.concurrencyPolicy) } : undefined
    };
  }

  private async deletePolicyRecords(tx: Prisma.TransactionClient, profileId: string) {
    await Promise.all([
      tx.executionPolicy.deleteMany({ where: { profileId } }),
      tx.executionLimit.deleteMany({ where: { profileId } }),
      tx.executionTimeout.deleteMany({ where: { profileId } }),
      tx.executionRetryPolicy.deleteMany({ where: { profileId } }),
      tx.executionFailurePolicy.deleteMany({ where: { profileId } }),
      tx.executionFallbackPolicy.deleteMany({ where: { profileId } }),
      tx.executionConcurrencyPolicy.deleteMany({ where: { profileId } })
    ]);
  }

  private contextData(items: ExecutionContextDto[]) {
    return items.map((item) => ({
      name: item.name, schema: json(item.schema),
      value: item.value === undefined ? undefined : json(item.value),
      metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }
  private namedSchemaData(items: ExecutionNamedSchemaDto[]) {
    return items.map((item) => ({
      name: item.name, schema: json(item.schema), required: item.required ?? false,
      metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }
  private variableData(items: ExecutionVariableDto[]) {
    return items.map((item) => ({
      ...this.namedSchemaData([item])[0]!,
      defaultValue: item.defaultValue === undefined ? undefined : json(item.defaultValue)
    }));
  }
  private outputData(items: ExecutionNamedSchemaDto[]) {
    return items.map((item) => ({
      name: item.name, schema: json(item.schema), metadata: json(item.metadata ?? {}),
      sortOrder: item.sortOrder ?? 0
    }));
  }
  private bindingData(items: ExecutionBindingDto[]) {
    return items.map((item) => ({
      key: item.key, targetType: item.targetType, referenceId: item.referenceId,
      required: item.required ?? true, config: json(item.config ?? {}),
      metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }
  private dependencyData(items: ExecutionDependencyDto[]) {
    return items.map((item) => ({
      bindingKey: item.bindingKey, dependsOnBindingKey: item.dependsOnBindingKey,
      metadata: json(item.metadata ?? {})
    }));
  }
  private labelData(items: ExecutionLabelDto[]) {
    return items.map((item) => ({
      name: item.name, color: item.color, metadata: json(item.metadata ?? {})
    }));
  }
  private noteData(items: ExecutionNoteDto[]) {
    return items.map((item) => ({
      content: item.content, metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }
  private limitData(item: ExecutionLimitDto) {
    return {
      maxSteps: item.maxSteps, maxTokens: item.maxTokens, maxCostMinor: item.maxCostMinor,
      maxPayloadBytes: item.maxPayloadBytes, metadata: json(item.metadata ?? {})
    };
  }
  private timeoutData(item: ExecutionTimeoutDto) {
    return {
      totalMs: item.totalMs, stepMs: item.stepMs, idleMs: item.idleMs,
      metadata: json(item.metadata ?? {})
    };
  }
  private retryData(item: ExecutionRetryPolicyDto) {
    return {
      maxAttempts: item.maxAttempts, initialDelayMs: item.initialDelayMs,
      maxDelayMs: item.maxDelayMs, multiplier: item.multiplier, jitter: item.jitter ?? false,
      retryOn: item.retryOn ?? [], metadata: json(item.metadata ?? {})
    };
  }
  private strategyData(item: ExecutionStrategyPolicyDto) {
    return {
      strategy: item.strategy, config: json(item.config ?? {}), metadata: json(item.metadata ?? {})
    };
  }
  private fallbackData(item: ExecutionFallbackPolicyDto) {
    return {
      ...this.strategyData(item), targetType: item.targetType,
      targetReferenceId: item.targetReferenceId
    };
  }
  private concurrencyData(item: ExecutionConcurrencyPolicyDto) {
    return {
      maxParallel: item.maxParallel, maxQueued: item.maxQueued, strategy: item.strategy,
      keyTemplate: item.keyTemplate, metadata: json(item.metadata ?? {})
    };
  }

  private snapshot(profile: Awaited<ReturnType<RuntimeOrchestrationRepository["requireProfile"]>>): ProfileSnapshot {
    return {
      queueDefinitionId: profile.queueDefinitionId,
      priorityLevelId: profile.priorityLevelId,
      name: profile.name, slug: profile.slug, description: profile.description,
      visibility: profile.visibility, metadata: record(profile.metadata),
      policy: profile.policy ? { config: record(profile.policy.config), metadata: record(profile.policy.metadata) } : undefined,
      limits: profile.limits ? {
        maxSteps: profile.limits.maxSteps ?? undefined, maxTokens: profile.limits.maxTokens ?? undefined,
        maxCostMinor: profile.limits.maxCostMinor ?? undefined,
        maxPayloadBytes: profile.limits.maxPayloadBytes ?? undefined, metadata: record(profile.limits.metadata)
      } : undefined,
      timeouts: profile.timeouts ? {
        totalMs: profile.timeouts.totalMs, stepMs: profile.timeouts.stepMs ?? undefined,
        idleMs: profile.timeouts.idleMs ?? undefined, metadata: record(profile.timeouts.metadata)
      } : undefined,
      retryPolicy: profile.retryPolicy ? {
        maxAttempts: profile.retryPolicy.maxAttempts, initialDelayMs: profile.retryPolicy.initialDelayMs,
        maxDelayMs: profile.retryPolicy.maxDelayMs, multiplier: Number(profile.retryPolicy.multiplier),
        jitter: profile.retryPolicy.jitter, retryOn: profile.retryPolicy.retryOn,
        metadata: record(profile.retryPolicy.metadata)
      } : undefined,
      failurePolicy: profile.failurePolicy ? {
        strategy: profile.failurePolicy.strategy, config: record(profile.failurePolicy.config),
        metadata: record(profile.failurePolicy.metadata)
      } : undefined,
      fallbackPolicy: profile.fallbackPolicy ? {
        strategy: profile.fallbackPolicy.strategy,
        targetType: profile.fallbackPolicy.targetType ?? undefined,
        targetReferenceId: profile.fallbackPolicy.targetReferenceId ?? undefined,
        config: record(profile.fallbackPolicy.config), metadata: record(profile.fallbackPolicy.metadata)
      } : undefined,
      concurrencyPolicy: profile.concurrency ? {
        maxParallel: profile.concurrency.maxParallel, maxQueued: profile.concurrency.maxQueued,
        strategy: profile.concurrency.strategy, keyTemplate: profile.concurrency.keyTemplate ?? undefined,
        metadata: record(profile.concurrency.metadata)
      } : undefined,
      contexts: profile.contexts.map((item) => ({
        name: item.name, schema: record(item.schema), value: item.value,
        metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      variables: profile.variables.map((item) => ({
        name: item.name, schema: record(item.schema), defaultValue: item.defaultValue,
        required: item.required, metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      inputs: profile.inputs.map((item) => this.namedSchema(item)),
      outputs: profile.outputs.map((item) => ({
        name: item.name, schema: record(item.schema), metadata: record(item.metadata),
        sortOrder: item.sortOrder
      })),
      bindings: profile.bindings.map((item) => ({
        key: item.key, targetType: item.targetType, referenceId: item.referenceId,
        required: item.required, config: record(item.config), metadata: record(item.metadata),
        sortOrder: item.sortOrder
      })),
      dependencies: profile.dependencies.map((item) => ({
        bindingKey: item.bindingKey, dependsOnBindingKey: item.dependsOnBindingKey,
        metadata: record(item.metadata)
      })),
      labels: profile.labels.map((item) => ({
        name: item.name, color: item.color ?? undefined, metadata: record(item.metadata)
      })),
      tagIds: profile.tagLinks.map((item) => item.tag.id),
      notes: profile.notes.map((item) => ({
        content: item.content, metadata: record(item.metadata), sortOrder: item.sortOrder
      }))
    };
  }

  private namedSchema(item: {
    name: string; schema: Prisma.JsonValue; required: boolean;
    metadata: Prisma.JsonValue; sortOrder: number;
  }): ExecutionNamedSchemaDto {
    return {
      name: item.name, schema: record(item.schema), required: item.required,
      metadata: record(item.metadata), sortOrder: item.sortOrder
    };
  }

  private readSnapshot(value: Prisma.JsonValue): ProfileSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("Published execution profile has an invalid snapshot");
    }
    const item = value as Record<string, unknown>;
    const arrays = ["contexts", "variables", "inputs", "outputs", "bindings", "dependencies", "labels", "tagIds", "notes"];
    if (typeof item.name !== "string" || typeof item.slug !== "string" || arrays.some((key) => !Array.isArray(item[key]))) {
      throw new ConflictException("Published execution profile has an invalid snapshot");
    }
    return item as ProfileSnapshot;
  }

  private stateMutation(
    workspaceId: string,
    actorId: string,
    profileId: string,
    operation: "archive" | "restore" | "delete"
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.requireProfile(tx, workspaceId, profileId, operation === "restore");
      if (operation === "restore" && before.status !== "ARCHIVED" && !before.deletedAt) {
        throw new ConflictException("Only archived or deleted execution profiles can be restored");
      }
      const now = new Date();
      const data = operation === "restore"
        ? {
            status: before.revision > 0 ? "PUBLISHED" as const : "DRAFT" as const,
            archivedAt: null, deletedAt: null, updatedById: actorId
          }
        : {
            status: "ARCHIVED" as const, archivedAt: now,
            deletedAt: operation === "delete" ? now : undefined, updatedById: actorId
          };
      const profile = await tx.executionProfile.update({
        where: { id: profileId }, data, select: this.profileSelect
      });
      const suffix = operation === "delete" ? "deleted" : operation === "archive" ? "archived" : "restored";
      await this.audit(tx, workspaceId, actorId, `runtime.orchestration.profile.${suffix}`, "ExecutionProfile", profile.id, before, profile);
      return profile;
    });
  }

  private assertDraft(status: RuntimeOrchestrationStatus) {
    if (status !== "DRAFT") throw new BadRequestException("Only draft execution profiles can be modified");
  }
  private assertPriorityValue(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      throw new BadRequestException("Execution priority value must be an integer between 0 and 1000");
    }
  }
  private unique(values: string[], label: string) {
    if (new Set(values).size !== values.length) throw new BadRequestException(`${label} must be unique`);
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
    await tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action, entityType, entityId,
      oldValues: before === null ? Prisma.JsonNull : json(before),
      newValues: after === null ? Prisma.JsonNull : json(after)
    } });
  }
  private async withUniqueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A runtime orchestration resource with this name, slug, or priority already exists");
      }
      throw error;
    }
  }
}
