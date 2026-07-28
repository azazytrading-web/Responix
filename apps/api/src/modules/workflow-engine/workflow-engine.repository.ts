import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  WorkflowStatus,
  WorkflowVisibility
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowBranchDto,
  WorkflowConditionDto,
  WorkflowEdgeDto,
  WorkflowLabelDto,
  WorkflowNamedSchemaDto,
  WorkflowNodeDto,
  WorkflowNoteDto,
  WorkflowPermissionDto,
  WorkflowTaxonomyDto,
  WorkflowVariableDto,
  UpdateWorkflowTaxonomyDto
} from "./dto/workflow-engine.dto";
import { WorkflowGraphValidator, type WorkflowGraph } from "./workflow-graph.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};

type WorkflowSnapshot = {
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  visibility: WorkflowVisibility;
  triggerType: string;
  metadata: JsonRecord;
  variables: WorkflowVariableDto[];
  parameters: WorkflowNamedSchemaDto[];
  inputs: WorkflowNamedSchemaDto[];
  outputs: WorkflowNamedSchemaDto[];
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
  conditions: WorkflowConditionDto[];
  branches: WorkflowBranchDto[];
  labels: WorkflowLabelDto[];
  tagIds: string[];
  notes: WorkflowNoteDto[];
  permissions: WorkflowPermissionDto[];
};

@Injectable()
export class WorkflowEngineRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphValidator: WorkflowGraphValidator
  ) {}

  createCategory(workspaceId: string, actorId: string, dto: WorkflowTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const category = await tx.workflowCategory.create({
        data: {
          workspaceId, name: dto.name, slug: dto.slug, description: dto.description,
          metadata: json(dto.metadata ?? {})
        },
        select: this.categorySelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.category.created", "WorkflowCategory", category.id, null, category);
      return category;
    }));
  }

  updateCategory(workspaceId: string, actorId: string, id: string, dto: UpdateWorkflowTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const current = await this.requireCategory(tx, workspaceId, id);
      const category = await tx.workflowCategory.update({
        where: { id },
        data: {
          name: dto.name, slug: dto.slug, description: dto.description,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
        },
        select: this.categorySelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.category.updated", "WorkflowCategory", id, current, category);
      return category;
    }));
  }

  listCategories(workspaceId: string) {
    return this.prisma.workflowCategory.findMany({
      where: { workspaceId }, orderBy: { name: "asc" }, select: this.categorySelect
    });
  }

  deleteCategory(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireCategory(tx, workspaceId, id);
      if (await tx.workflow.count({ where: { workspaceId, categoryId: id, deletedAt: null } })) {
        throw new ConflictException("Workflow category is in use");
      }
      await tx.workflowCategory.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "workflow.category.deleted", "WorkflowCategory", id, current, null);
    });
  }

  createTag(workspaceId: string, actorId: string, dto: WorkflowTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const tag = await tx.workflowTag.create({
        data: {
          workspaceId, name: dto.name, slug: dto.slug,
          metadata: json(dto.metadata ?? {})
        },
        select: this.tagSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.tag.created", "WorkflowTag", tag.id, null, tag);
      return tag;
    }));
  }

  updateTag(workspaceId: string, actorId: string, id: string, dto: UpdateWorkflowTaxonomyDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const current = await this.requireTag(tx, workspaceId, id);
      const tag = await tx.workflowTag.update({
        where: { id },
        data: {
          name: dto.name, slug: dto.slug,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata)
        },
        select: this.tagSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.tag.updated", "WorkflowTag", id, current, tag);
      return tag;
    }));
  }

  listTags(workspaceId: string) {
    return this.prisma.workflowTag.findMany({
      where: { workspaceId }, orderBy: { name: "asc" }, select: this.tagSelect
    });
  }

  deleteTag(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireTag(tx, workspaceId, id);
      if (await tx.workflowTagAssignment.count({ where: { tagId: id, workflow: { workspaceId } } })) {
        throw new ConflictException("Workflow tag is in use");
      }
      await tx.workflowTag.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "workflow.tag.deleted", "WorkflowTag", id, current, null);
    });
  }

  create(workspaceId: string, actorId: string, dto: CreateWorkflowDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const snapshot = this.fromDto(dto);
      await this.validateSnapshot(tx, workspaceId, snapshot, undefined, false);
      const workflow = await tx.workflow.create({
        data: {
          workspaceId, ...this.scalarData(snapshot), status: "DRAFT", version: 0,
          workflowJson: json(this.graph(snapshot)), createdById: actorId, updatedById: actorId,
          ...this.childCreates(snapshot)
        },
        select: this.workflowSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.definition.created", "Workflow", workflow.id, null, workflow);
      return workflow;
    }));
  }

  updateDraft(workspaceId: string, actorId: string, workflowId: string, dto: UpdateWorkflowDto) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const current = await this.requireWorkflow(tx, workspaceId, workflowId);
      this.assertDraft(current.status);
      const snapshot = this.mergeSnapshot(this.snapshot(current), dto);
      await this.validateSnapshot(tx, workspaceId, snapshot, workflowId, false);
      const workflow = await tx.workflow.update({
        where: { id: workflowId },
        data: {
          ...this.scalarData(snapshot), workflowJson: json(this.graph(snapshot)), updatedById: actorId,
          ...this.childReplacements(snapshot)
        },
        select: this.workflowSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.definition.draft_updated", "Workflow", workflow.id, current, workflow);
      return workflow;
    }));
  }

  publish(workspaceId: string, actorId: string, workflowId: string, changeSummary?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireWorkflow(tx, workspaceId, workflowId);
      this.assertDraft(current.status);
      const snapshot = this.snapshot(current);
      await this.validateSnapshot(tx, workspaceId, snapshot, workflowId, true);
      const revision = current.version + 1;
      const version = await tx.workflowVersion.create({
        data: {
          workflowId, revision, snapshot: json(snapshot), changeSummary,
          createdById: actorId, publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const workflow = await tx.workflow.update({
        where: { id: workflowId },
        data: {
          status: "PUBLISHED", version: revision, publishedAt: new Date(),
          workflowJson: json(this.graph(snapshot)), updatedById: actorId
        },
        select: this.workflowSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.definition.published", "Workflow", workflow.id, current, { workflow, version });
      return { workflow, version };
    });
  }

  rollback(
    workspaceId: string,
    actorId: string,
    workflowId: string,
    sourceRevision: number,
    changeSummary?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireWorkflow(tx, workspaceId, workflowId, true);
      const source = await tx.workflowVersion.findFirst({
        where: { workflowId, revision: sourceRevision, workflow: { workspaceId } },
        select: this.versionSelect
      });
      if (!source) throw new NotFoundException("Published workflow version was not found");
      const snapshot = this.readSnapshot(source.snapshot);
      await this.validateSnapshot(tx, workspaceId, snapshot, workflowId, true);
      const revision = current.version + 1;
      const version = await tx.workflowVersion.create({
        data: {
          workflowId, revision, snapshot: json(snapshot),
          changeSummary: changeSummary ?? `Rollback to revision ${sourceRevision}`,
          createdById: actorId, publishedAt: new Date()
        },
        select: this.versionSelect
      });
      const workflow = await tx.workflow.update({
        where: { id: workflowId },
        data: {
          ...this.scalarData(snapshot), ...this.childReplacements(snapshot),
          workflowJson: json(this.graph(snapshot)), status: "PUBLISHED", version: revision,
          publishedAt: new Date(), archivedAt: null, deletedAt: null, updatedById: actorId
        },
        select: this.workflowSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.definition.rolled_back", "Workflow", workflow.id, current, { sourceRevision, workflow, version });
      return { workflow, version };
    });
  }

  clone(workspaceId: string, actorId: string, workflowId: string, name: string, slug: string) {
    return this.withUniqueErrors(() => this.prisma.$transaction(async (tx) => {
      const source = await this.requireWorkflow(tx, workspaceId, workflowId, true);
      const snapshot = { ...this.snapshot(source), name, slug };
      await this.validateSnapshot(tx, workspaceId, snapshot, workflowId, snapshot.nodes.length > 0);
      const workflow = await tx.workflow.create({
        data: {
          workspaceId, ...this.scalarData(snapshot), ...this.childCreates(snapshot),
          workflowJson: json(this.graph(snapshot)), status: "DRAFT", version: 0,
          publishedAt: null, archivedAt: null, deletedAt: null,
          createdById: actorId, updatedById: actorId
        },
        select: this.workflowSelect
      });
      await this.audit(tx, workspaceId, actorId, "workflow.definition.cloned", "Workflow", workflow.id, null, { sourceWorkflowId: source.id, workflow });
      return workflow;
    }));
  }

  archive(workspaceId: string, actorId: string, workflowId: string) {
    return this.stateMutation(workspaceId, actorId, workflowId, "archive");
  }

  restore(workspaceId: string, actorId: string, workflowId: string) {
    return this.stateMutation(workspaceId, actorId, workflowId, "restore");
  }

  softDelete(workspaceId: string, actorId: string, workflowId: string) {
    return this.stateMutation(workspaceId, actorId, workflowId, "delete");
  }

  get(workspaceId: string, workflowId: string) {
    return this.requireWorkflow(this.prisma, workspaceId, workflowId);
  }

  async history(workspaceId: string, workflowId: string) {
    await this.requireWorkflow(this.prisma, workspaceId, workflowId, true);
    return this.prisma.workflowVersion.findMany({
      where: { workflowId, workflow: { workspaceId } },
      orderBy: { revision: "desc" },
      select: this.versionSelect
    });
  }

  async list(input: {
    workspaceId: string;
    page: number;
    limit: number;
    search?: string;
    status?: WorkflowStatus;
    visibility?: WorkflowVisibility;
    categoryId?: string;
    tagId?: string;
    sortBy: "name" | "createdAt" | "updatedAt" | "publishedAt";
    sortOrder: "asc" | "desc";
  }) {
    const where: Prisma.WorkflowWhereInput = {
      workspaceId: input.workspaceId,
      deletedAt: null,
      status: input.status,
      visibility: input.visibility,
      categoryId: input.categoryId,
      ...(input.tagId ? { tagLinks: { some: { tagId: input.tagId, tag: { workspaceId: input.workspaceId } } } } : {}),
      ...(input.search ? {
        OR: [
          { name: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } }
        ]
      } : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        orderBy: [{ [input.sortBy]: input.sortOrder }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: this.workflowSelect
      }),
      this.prisma.workflow.count({ where })
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

  private readonly categorySelect = {
    id: true, workspaceId: true, name: true, slug: true, description: true,
    metadata: true, createdAt: true, updatedAt: true
  } as const;

  private readonly tagSelect = {
    id: true, workspaceId: true, name: true, slug: true,
    metadata: true, createdAt: true, updatedAt: true
  } as const;

  private readonly workflowSelect = {
    id: true, workspaceId: true, categoryId: true, name: true, slug: true,
    description: true, version: true, status: true, visibility: true,
    triggerType: true, workflowJson: true, metadata: true, publishedAt: true,
    createdById: true, updatedById: true, createdAt: true, updatedAt: true,
    archivedAt: true, deletedAt: true,
    variables: { orderBy: { sortOrder: "asc" as const } },
    parameters: { orderBy: { sortOrder: "asc" as const } },
    inputs: { orderBy: { sortOrder: "asc" as const } },
    outputs: { orderBy: { sortOrder: "asc" as const } },
    nodes: { orderBy: { sortOrder: "asc" as const } },
    edges: { orderBy: { sortOrder: "asc" as const } },
    conditions: { orderBy: { sortOrder: "asc" as const } },
    branches: { orderBy: { sortOrder: "asc" as const } },
    labels: { orderBy: { name: "asc" as const } },
    tagLinks: { select: { tag: { select: this.tagSelect } }, orderBy: { tag: { name: "asc" as const } } },
    notes: { orderBy: { sortOrder: "asc" as const } },
    permissions: { orderBy: { permissionCode: "asc" as const } }
  } as const;

  private readonly versionSelect = {
    id: true, workflowId: true, revision: true, snapshot: true,
    changeSummary: true, createdById: true, createdAt: true, publishedAt: true
  } as const;

  private requireCategory(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.workflowCategory.findFirst({
      where: { id, workspaceId }, select: this.categorySelect
    }).then((category) => {
      if (!category) throw new NotFoundException("Workflow category was not found");
      return category;
    });
  }

  private requireTag(client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string) {
    return client.workflowTag.findFirst({
      where: { id, workspaceId }, select: this.tagSelect
    }).then((tag) => {
      if (!tag) throw new NotFoundException("Workflow tag was not found");
      return tag;
    });
  }

  private requireWorkflow(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    includeDeleted = false
  ) {
    return client.workflow.findFirst({
      where: { id, workspaceId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: this.workflowSelect
    }).then((workflow) => {
      if (!workflow) throw new NotFoundException("Workflow was not found");
      return workflow;
    });
  }

  private fromDto(dto: CreateWorkflowDto): WorkflowSnapshot {
    return {
      categoryId: dto.categoryId ?? null,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      visibility: dto.visibility ?? "WORKSPACE",
      triggerType: dto.triggerType ?? "MANUAL",
      metadata: dto.metadata ?? {},
      variables: dto.variables ?? [],
      parameters: dto.parameters ?? [],
      inputs: dto.inputs ?? [],
      outputs: dto.outputs ?? [],
      nodes: dto.nodes ?? [],
      edges: dto.edges ?? [],
      conditions: dto.conditions ?? [],
      branches: dto.branches ?? [],
      labels: dto.labels ?? [],
      tagIds: dto.tagIds ?? [],
      notes: dto.notes ?? [],
      permissions: dto.permissions ?? []
    };
  }

  private mergeSnapshot(current: WorkflowSnapshot, dto: UpdateWorkflowDto): WorkflowSnapshot {
    return {
      categoryId: dto.categoryId === undefined ? current.categoryId : dto.categoryId,
      name: dto.name ?? current.name,
      slug: dto.slug ?? current.slug,
      description: dto.description === undefined ? current.description : dto.description,
      visibility: dto.visibility ?? current.visibility,
      triggerType: dto.triggerType ?? current.triggerType,
      metadata: dto.metadata ?? current.metadata,
      variables: dto.variables ?? current.variables,
      parameters: dto.parameters ?? current.parameters,
      inputs: dto.inputs ?? current.inputs,
      outputs: dto.outputs ?? current.outputs,
      nodes: dto.nodes ?? current.nodes,
      edges: dto.edges ?? current.edges,
      conditions: dto.conditions ?? current.conditions,
      branches: dto.branches ?? current.branches,
      labels: dto.labels ?? current.labels,
      tagIds: dto.tagIds ?? current.tagIds,
      notes: dto.notes ?? current.notes,
      permissions: dto.permissions ?? current.permissions
    };
  }

  private graph(snapshot: WorkflowSnapshot): WorkflowGraph {
    return {
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      conditions: snapshot.conditions,
      branches: snapshot.branches
    };
  }

  private async validateSnapshot(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    snapshot: WorkflowSnapshot,
    workflowId: string | undefined,
    requireCompleteGraph: boolean
  ) {
    if (snapshot.categoryId) await this.requireCategory(tx, workspaceId, snapshot.categoryId);
    await this.validateTags(tx, workspaceId, snapshot.tagIds);
    this.unique(snapshot.variables.map((item) => item.name), "Workflow variables");
    this.unique(snapshot.parameters.map((item) => item.name), "Workflow parameters");
    this.unique(snapshot.inputs.map((item) => item.name), "Workflow inputs");
    this.unique(snapshot.outputs.map((item) => item.name), "Workflow outputs");
    this.unique(snapshot.labels.map((item) => item.name), "Workflow labels");
    this.unique(snapshot.permissions.map((item) => item.permissionCode), "Workflow permissions");
    if (snapshot.permissions.length) {
      const count = await tx.permission.count({
        where: { code: { in: snapshot.permissions.map((item) => item.permissionCode) } }
      });
      if (count !== snapshot.permissions.length) {
        throw new BadRequestException("One or more workflow permissions are not registered");
      }
    }
    if (requireCompleteGraph || snapshot.nodes.length || snapshot.edges.length || snapshot.conditions.length || snapshot.branches.length) {
      this.graphValidator.validate(this.graph(snapshot));
      await this.validateNodeReferences(tx, workspaceId, workflowId, snapshot.nodes);
    }
  }

  private async validateTags(tx: Prisma.TransactionClient, workspaceId: string, tagIds: string[]) {
    this.unique(tagIds, "Workflow tags");
    if (!tagIds.length) return;
    const count = await tx.workflowTag.count({ where: { id: { in: tagIds }, workspaceId } });
    if (count !== tagIds.length) throw new BadRequestException("One or more workflow tags are outside the workspace");
  }

  private async validateNodeReferences(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    workflowId: string | undefined,
    nodes: WorkflowNodeDto[]
  ) {
    const referenceTypes = new Set(["AGENT", "PROMPT", "KNOWLEDGE", "TOOL", "SUBFLOW"]);
    for (const node of nodes) {
      if (referenceTypes.has(node.type) && !node.referenceId) {
        throw new BadRequestException(`${node.type} node ${node.id} requires a referenceId`);
      }
      if (!referenceTypes.has(node.type) && node.referenceId) {
        throw new BadRequestException(`${node.type} node ${node.id} cannot have a referenceId`);
      }
    }
    const ids = (type: string) => [...new Set(nodes.filter((node) => node.type === type).map((node) => node.referenceId!))];
    await Promise.all([
      this.assertReferences(ids("AGENT"), (values) => tx.aiAgent.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Agent"),
      this.assertReferences(ids("PROMPT"), (values) => tx.promptLibraryItem.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Prompt"),
      this.assertReferences(ids("KNOWLEDGE"), (values) => tx.knowledgeDocument.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Knowledge document"),
      this.assertReferences(ids("TOOL"), (values) => tx.toolDefinition.findMany({
        where: { id: { in: values }, workspaceId, deletedAt: null }, select: { id: true }
      }), "Tool"),
      this.assertReferences(ids("SUBFLOW"), (values) => tx.workflow.findMany({
        where: {
          id: { in: values },
          workspaceId,
          deletedAt: null,
          ...(workflowId ? { NOT: { id: workflowId } } : {})
        },
        select: { id: true }
      }), "Subflow")
    ]);
  }

  private async assertReferences(
    ids: string[],
    query: (ids: string[]) => Promise<Array<{ id: string }>>,
    label: string
  ) {
    if (!ids.length) return;
    const found = await query(ids);
    if (found.length !== ids.length) {
      throw new BadRequestException(`${label} node references must belong to the active workspace`);
    }
  }

  private scalarData(snapshot: WorkflowSnapshot) {
    return {
      categoryId: snapshot.categoryId,
      name: snapshot.name,
      slug: snapshot.slug,
      description: snapshot.description,
      visibility: snapshot.visibility,
      triggerType: snapshot.triggerType,
      metadata: json(snapshot.metadata)
    };
  }

  private childCreates(snapshot: WorkflowSnapshot) {
    return {
      variables: { create: this.variableData(snapshot.variables) },
      parameters: { create: this.namedSchemaData(snapshot.parameters) },
      inputs: { create: this.namedSchemaData(snapshot.inputs) },
      outputs: { create: this.outputData(snapshot.outputs) },
      nodes: { create: this.nodeData(snapshot.nodes) },
      edges: { create: this.edgeData(snapshot.edges) },
      conditions: { create: this.conditionData(snapshot.conditions) },
      branches: { create: this.branchData(snapshot.branches) },
      labels: { create: this.labelData(snapshot.labels) },
      tagLinks: { create: snapshot.tagIds.map((tagId) => ({ tagId })) },
      notes: { create: this.noteData(snapshot.notes) },
      permissions: { create: this.permissionData(snapshot.permissions) }
    };
  }

  private childReplacements(snapshot: WorkflowSnapshot) {
    const creates = this.childCreates(snapshot);
    return Object.fromEntries(
      Object.entries(creates).map(([key, value]) => [key, { deleteMany: {}, ...value }])
    );
  }

  private namedSchemaData(items: WorkflowNamedSchemaDto[]) {
    return items.map((item) => ({
      name: item.name, schema: json(item.schema), required: item.required ?? false,
      metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }

  private variableData(items: WorkflowVariableDto[]) {
    return items.map((item) => ({
      ...this.namedSchemaData([item])[0]!,
      defaultValue: item.defaultValue === undefined ? undefined : json(item.defaultValue)
    }));
  }

  private outputData(items: WorkflowNamedSchemaDto[]) {
    return items.map((item) => ({
      name: item.name, schema: json(item.schema), metadata: json(item.metadata ?? {}),
      sortOrder: item.sortOrder ?? 0
    }));
  }

  private nodeData(items: WorkflowNodeDto[]) {
    return items.map((item) => ({
      nodeKey: item.id, type: item.type, name: item.name, referenceId: item.referenceId,
      configuration: json(item.configuration ?? {}), position: json(item.position ?? {}),
      metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }

  private edgeData(items: WorkflowEdgeDto[]) {
    return items.map((item) => ({
      edgeKey: item.id, sourceNodeKey: item.sourceNodeId, targetNodeKey: item.targetNodeId,
      label: item.label, metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }

  private conditionData(items: WorkflowConditionDto[]) {
    return items.map((item) => ({
      key: item.key, nodeKey: item.nodeId, edgeKey: item.edgeId,
      expression: json(item.expression), metadata: json(item.metadata ?? {}),
      sortOrder: item.sortOrder ?? 0
    }));
  }

  private branchData(items: WorkflowBranchDto[]) {
    return items.map((item) => ({
      nodeKey: item.nodeId, branchKey: item.key, label: item.label,
      condition: json(item.condition), targetNodeKey: item.targetNodeId,
      metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }

  private labelData(items: WorkflowLabelDto[]) {
    return items.map((item) => ({
      name: item.name, color: item.color, metadata: json(item.metadata ?? {})
    }));
  }

  private noteData(items: WorkflowNoteDto[]) {
    return items.map((item) => ({
      content: item.content, metadata: json(item.metadata ?? {}), sortOrder: item.sortOrder ?? 0
    }));
  }

  private permissionData(items: WorkflowPermissionDto[]) {
    return items.map((item) => ({
      permissionCode: item.permissionCode, metadata: json(item.metadata ?? {})
    }));
  }

  private snapshot(workflow: Awaited<ReturnType<WorkflowEngineRepository["requireWorkflow"]>>): WorkflowSnapshot {
    return {
      categoryId: workflow.categoryId,
      name: workflow.name,
      slug: workflow.slug,
      description: workflow.description,
      visibility: workflow.visibility,
      triggerType: workflow.triggerType,
      metadata: record(workflow.metadata),
      variables: workflow.variables.map((item) => ({
        name: item.name, schema: record(item.schema), required: item.required,
        defaultValue: item.defaultValue, metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      parameters: workflow.parameters.map((item) => this.namedSchema(item)),
      inputs: workflow.inputs.map((item) => this.namedSchema(item)),
      outputs: workflow.outputs.map((item) => ({
        name: item.name, schema: record(item.schema), metadata: record(item.metadata),
        sortOrder: item.sortOrder
      })),
      nodes: workflow.nodes.map((item) => ({
        id: item.nodeKey, type: item.type, name: item.name ?? undefined,
        referenceId: item.referenceId ?? undefined, configuration: record(item.configuration),
        position: record(item.position), metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      edges: workflow.edges.map((item) => ({
        id: item.edgeKey, sourceNodeId: item.sourceNodeKey, targetNodeId: item.targetNodeKey,
        label: item.label ?? undefined, metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      conditions: workflow.conditions.map((item) => ({
        key: item.key, nodeId: item.nodeKey ?? undefined, edgeId: item.edgeKey ?? undefined,
        expression: record(item.expression), metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      branches: workflow.branches.map((item) => ({
        nodeId: item.nodeKey, key: item.branchKey, label: item.label ?? undefined,
        condition: record(item.condition), targetNodeId: item.targetNodeKey,
        metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      labels: workflow.labels.map((item) => ({
        name: item.name, color: item.color ?? undefined, metadata: record(item.metadata)
      })),
      tagIds: workflow.tagLinks.map((item) => item.tag.id),
      notes: workflow.notes.map((item) => ({
        content: item.content, metadata: record(item.metadata), sortOrder: item.sortOrder
      })),
      permissions: workflow.permissions.map((item) => ({
        permissionCode: item.permissionCode, metadata: record(item.metadata)
      }))
    };
  }

  private namedSchema(item: {
    name: string;
    schema: Prisma.JsonValue;
    required: boolean;
    metadata: Prisma.JsonValue;
    sortOrder: number;
  }): WorkflowNamedSchemaDto {
    return {
      name: item.name, schema: record(item.schema), required: item.required,
      metadata: record(item.metadata), sortOrder: item.sortOrder
    };
  }

  private readSnapshot(value: Prisma.JsonValue): WorkflowSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("Published workflow version has an invalid snapshot");
    }
    const item = value as Record<string, unknown>;
    const arrays = ["variables", "parameters", "inputs", "outputs", "nodes", "edges", "conditions", "branches", "labels", "tagIds", "notes", "permissions"];
    if (
      typeof item.name !== "string" ||
      typeof item.slug !== "string" ||
      typeof item.triggerType !== "string" ||
      arrays.some((key) => !Array.isArray(item[key]))
    ) {
      throw new ConflictException("Published workflow version has an invalid snapshot");
    }
    return item as WorkflowSnapshot;
  }

  private stateMutation(
    workspaceId: string,
    actorId: string,
    workflowId: string,
    operation: "archive" | "restore" | "delete"
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireWorkflow(tx, workspaceId, workflowId, operation === "restore");
      if (operation === "restore" && current.status !== "ARCHIVED" && !current.deletedAt) {
        throw new ConflictException("Only archived or deleted workflows can be restored");
      }
      const now = new Date();
      const data = operation === "restore"
        ? {
            status: current.version > 0 ? "PUBLISHED" as const : "DRAFT" as const,
            archivedAt: null, deletedAt: null, updatedById: actorId
          }
        : {
            status: "ARCHIVED" as const, archivedAt: now,
            deletedAt: operation === "delete" ? now : undefined, updatedById: actorId
          };
      const workflow = await tx.workflow.update({
        where: { id: workflowId }, data, select: this.workflowSelect
      });
      const suffix = operation === "delete" ? "deleted" : operation === "archive" ? "archived" : "restored";
      await this.audit(tx, workspaceId, actorId, `workflow.definition.${suffix}`, "Workflow", workflow.id, current, workflow);
      return workflow;
    });
  }

  private assertDraft(status: WorkflowStatus) {
    if (status !== "DRAFT") throw new BadRequestException("Only draft workflows can be modified");
  }

  private unique(values: string[], label: string) {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`${label} must be unique`);
    }
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

  private async withUniqueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A workflow resource with this slug or key already exists");
      }
      throw error;
    }
  }
}
