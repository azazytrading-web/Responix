import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ExecutionPipelineStatus, Prisma, RetrievalRuntimeStatus, ConversationRuntimeStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import {
  CloneExecutionPipelineDto, CreateExecutionPipelineDto, ExecutionPipelineListQueryDto,
  ExecutionPipelineSnapshotQueryDto, PipelineAssetType, UpdateExecutionPipelineDto
} from "./dto/execution-pipeline.dto";
import {
  ExecutionPipelineValidator, PipelineDiagnostic, PipelineValidationResult
} from "./execution-pipeline.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const jsonValue = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === null ? Prisma.JsonNull : json(value);

@Injectable()
export class ExecutionPipelineRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ExecutionPipelineValidator
  ) {}

  async create(workspaceId: string, actorId: string, dto: CreateExecutionPipelineDto) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const assembled = await this.assemble(tx, workspaceId, dto);
      if (!assembled.validation.valid) {
        await this.audit(tx, workspaceId, actorId, "execution.pipeline.rejected",
          "ExecutionPipeline", workspaceId, null, assembled.validation);
        return { ok: false as const, validation: assembled.validation };
      }
      const pipeline = await this.createRecord(tx, workspaceId, actorId, assembled.input, assembled.plan);
      await this.mutationAudit(tx, workspaceId, actorId, pipeline.id,
        "execution.pipeline.created", null, pipeline);
      return { ok: true as const, pipeline };
    });
    if (!outcome.ok) this.throwValidation(outcome.validation);
    return outcome.pipeline;
  }

  async update(
    workspaceId: string, actorId: string, id: string, dto: UpdateExecutionPipelineDto
  ) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const current = await this.requirePipeline(tx, workspaceId, id);
      this.assertDraft(current);
      const assembled = await this.assemble(tx, workspaceId, dto);
      if (!assembled.validation.valid) {
        await this.mutationAudit(tx, workspaceId, actorId, id,
          "execution.pipeline.validation_failed", current, assembled.validation);
        return { ok: false as const, validation: assembled.validation };
      }
      const hashes = this.hashPlan(assembled.plan, dto.compatibilityVersion);
      await this.replaceChildren(tx, id, dto);
      const updated = await tx.executionPipeline.update({
        where: { id },
        data: {
          name: dto.name, compatibilityVersion: dto.compatibilityVersion,
          metadata: json(dto.metadata ?? {}), plan: json(assembled.plan),
          ...hashes, updatedById: actorId
        },
        select: this.pipelineSelect
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        "execution.pipeline.updated", current, updated);
      return { ok: true as const, pipeline: updated };
    });
    if (!outcome.ok) this.throwValidation(outcome.validation);
    return outcome.pipeline;
  }

  async validate(workspaceId: string, actorId: string, id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const pipeline = await this.requirePipeline(tx, workspaceId, id);
      const input = this.readInput(pipeline.plan);
      const assembled = await this.assemble(tx, workspaceId, input);
      if (this.hash(assembled.plan) !== this.hash(pipeline.plan)) {
        assembled.validation.diagnostics.push(this.error(
          "PLAN_INTEGRITY_FAILED", "plan", "Stored plan differs from normalized pipeline metadata"
        ));
        assembled.validation.valid = false;
      }
      await tx.pipelineValidation.create({
        data: { pipelineId: id, valid: assembled.validation.valid, result: json(assembled.validation) }
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        assembled.validation.valid ? "execution.pipeline.validated" : "execution.pipeline.validation_failed",
        null, assembled.validation);
      return assembled.validation;
    });
    if (!result.valid) this.throwValidation(result);
    return result;
  }

  async publish(workspaceId: string, actorId: string, id: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const pipeline = await this.requirePipeline(tx, workspaceId, id);
      this.assertDraft(pipeline);
      const assembled = await this.assemble(tx, workspaceId, this.readInput(pipeline.plan));
      if (!assembled.validation.valid) {
        await this.mutationAudit(tx, workspaceId, actorId, id,
          "execution.pipeline.publish_rejected", pipeline, assembled.validation);
        return { ok: false as const, validation: assembled.validation };
      }
      const revision = pipeline.revision + 1;
      const snapshot = await tx.executionPipelineSnapshot.create({
        data: {
          workspaceId, pipelineId: id, revision, createdById: actorId,
          snapshot: json(pipeline.plan), planHash: pipeline.planHash, checksum: pipeline.checksum
        },
        select: this.snapshotSelect
      });
      await tx.executionPipelineRevision.create({
        data: {
          pipelineId: id, revision, createdById: actorId, plan: json(pipeline.plan),
          planHash: pipeline.planHash, checksum: pipeline.checksum
        }
      });
      await tx.executionPipeline.update({
        where: { id },
        data: {
          status: ExecutionPipelineStatus.PUBLISHED, revision,
          publishedAt: new Date(), updatedById: actorId
        }
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        "execution.pipeline.published", { revision: pipeline.revision }, snapshot);
      return { ok: true as const, snapshot };
    });
    if (!outcome.ok) this.throwValidation(outcome.validation);
    return outcome.snapshot;
  }

  async rollback(workspaceId: string, actorId: string, id: string, revisionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pipeline = await this.requirePipeline(tx, workspaceId, id);
      this.assertPublished(pipeline);
      const source = await tx.executionPipelineRevision.findFirst({
        where: { id: revisionId, pipelineId: id }
      });
      if (!source) throw new NotFoundException("Execution Pipeline revision was not found");
      const revision = pipeline.revision + 1;
      const snapshot = await tx.executionPipelineSnapshot.create({
        data: {
          workspaceId, pipelineId: id, revision, createdById: actorId,
          snapshot: json(source.plan), planHash: source.planHash, checksum: source.checksum
        },
        select: this.snapshotSelect
      });
      await tx.executionPipelineRevision.create({
        data: {
          pipelineId: id, revision, sourceRevision: source.revision, createdById: actorId,
          plan: json(source.plan), planHash: source.planHash, checksum: source.checksum
        }
      });
      await tx.executionPipeline.update({
        where: { id },
        data: {
          status: ExecutionPipelineStatus.PUBLISHED, revision, plan: json(source.plan),
          planHash: source.planHash, checksum: source.checksum, publishedAt: new Date(),
          updatedById: actorId
        }
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        "execution.pipeline.rolled_back", { revision: pipeline.revision },
        { revision, sourceRevision: source.revision });
      return snapshot;
    });
  }

  async clone(
    workspaceId: string, actorId: string, id: string, dto: CloneExecutionPipelineDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const source = await this.requirePipeline(tx, workspaceId, id);
      if (source.status === ExecutionPipelineStatus.DELETED) {
        throw new BadRequestException("Deleted Execution Pipeline cannot be cloned");
      }
      const input = this.readInput(source.plan);
      input.name = dto.name ?? `${source.name} Copy`;
      const assembled = await this.assemble(tx, workspaceId, input);
      if (!assembled.validation.valid) this.throwValidation(assembled.validation);
      const cloned = await this.createRecord(tx, workspaceId, actorId, input, assembled.plan, source.id);
      await this.mutationAudit(tx, workspaceId, actorId, cloned.id,
        "execution.pipeline.cloned", { sourceId: source.id }, cloned);
      return cloned;
    });
  }

  archive(workspaceId: string, actorId: string, id: string) {
    return this.lifecycle(workspaceId, actorId, id, ExecutionPipelineStatus.ARCHIVED,
      "execution.pipeline.archived", { archivedAt: new Date(), deletedAt: null });
  }
  async restore(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePipeline(tx, workspaceId, id, true);
      if (current.status !== ExecutionPipelineStatus.ARCHIVED &&
        current.status !== ExecutionPipelineStatus.DELETED) {
        throw new BadRequestException("Only archived or deleted pipelines can be restored");
      }
      const status = current.revision ? ExecutionPipelineStatus.PUBLISHED : ExecutionPipelineStatus.DRAFT;
      const updated = await tx.executionPipeline.update({
        where: { id }, data: { status, archivedAt: null, deletedAt: null, updatedById: actorId },
        select: this.pipelineSelect
      });
      await this.mutationAudit(tx, workspaceId, actorId, id,
        "execution.pipeline.restored", current, updated);
      return updated;
    });
  }
  softDelete(workspaceId: string, actorId: string, id: string) {
    return this.lifecycle(workspaceId, actorId, id, ExecutionPipelineStatus.DELETED,
      "execution.pipeline.deleted", { archivedAt: null, deletedAt: new Date() });
  }
  get(workspaceId: string, id: string) {
    return this.requirePipeline(this.prisma, workspaceId, id);
  }
  getSnapshot(workspaceId: string, id: string) {
    return this.requireSnapshot(this.prisma, workspaceId, id);
  }
  async list(workspaceId: string, query: ExecutionPipelineListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.ExecutionPipelineWhereInput = {
      workspaceId,
      deletedAt: query.status === ExecutionPipelineStatus.DELETED ? { not: null } : null,
      status: query.status,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionPipeline.findMany({
        where, select: this.pipelineSelect, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.executionPipeline.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async listSnapshots(workspaceId: string, query: ExecutionPipelineSnapshotQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.ExecutionPipelineSnapshotWhereInput = {
      workspaceId, pipelineId: query.pipelineId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionPipelineSnapshot.findMany({
        where, select: this.snapshotSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.executionPipelineSnapshot.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async compare(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await this.prisma.$transaction([
      this.prisma.executionPipelineSnapshot.findFirst({
        where: { id: leftId, workspaceId }, select: this.snapshotSelect
      }),
      this.prisma.executionPipelineSnapshot.findFirst({
        where: { id: rightId, workspaceId }, select: this.snapshotSelect
      })
    ]);
    if (!left || !right) throw new NotFoundException("One or more pipeline snapshots were not found");
    const leftPlan = this.record(left.snapshot); const rightPlan = this.record(right.snapshot);
    return {
      identical: left.planHash === right.planHash && left.checksum === right.checksum,
      left: this.snapshotIdentity(left), right: this.snapshotIdentity(right),
      changed: {
        nodes: this.changed(leftPlan, rightPlan, "nodes"),
        dependencies: this.changed(leftPlan, rightPlan, "dependencies"),
        variables: this.changed(leftPlan, rightPlan, "variables"),
        assets: this.changed(leftPlan, rightPlan, "resolvedAssets"),
        metadata: this.changed(leftPlan, rightPlan, "metadata")
      }
    };
  }

  private async assemble(
    tx: Prisma.TransactionClient, workspaceId: string, dto: CreateExecutionPipelineDto
  ) {
    const input = this.validator.normalize(dto);
    const validation = this.validator.validate(input);
    const resolvedAssets: JsonRecord[] = [];
    for (const [index, node] of input.nodes.entries()) {
      if (!node.assetType || !node.assetId) continue;
      const asset = await this.resolveAsset(tx, workspaceId, node.assetType, node.assetId);
      if (!asset) {
        validation.diagnostics.push(this.error(
          "ASSET_NOT_PUBLISHED", `nodes.${index}.assetId`,
          `${node.assetType} asset was not found as a published immutable workspace resource`
        ));
        validation.valid = false;
      } else {
        resolvedAssets.push({ nodeKey: node.nodeKey, type: node.assetType, ...asset });
      }
    }
    const versions = new Set(resolvedAssets.map((item) => item.compatibilityVersion)
      .filter((item): item is string => typeof item === "string"));
    if (versions.size > 1) {
      validation.diagnostics.push(this.error(
        "INCOMPATIBLE_RUNTIME_ASSETS", "nodes", "Referenced runtime assets have incompatible versions"
      ));
      validation.valid = false;
    }
    const plan = {
      compiler: "responix-execution-pipeline/1.0.0",
      input, nodes: input.nodes, dependencies: input.dependencies ?? [],
      variables: input.variables ?? [], resolvedAssets,
      metadata: input.metadata ?? {}, compatibilityVersion: input.compatibilityVersion
    };
    return { input, validation, plan };
  }

  private async resolveAsset(
    tx: Prisma.TransactionClient, workspaceId: string, type: PipelineAssetType, id: string
  ): Promise<JsonRecord | null> {
    switch (type) {
      case PipelineAssetType.EXECUTION_REQUEST:
        return tx.executionRequest.findFirst({ where: { id, workspaceId },
          select: { id: true, sourceType: true, correlationId: true } });
      case PipelineAssetType.AGENT_RUNTIME:
        return tx.agentRuntimeSnapshot.findFirst({ where: { id, workspaceId },
          select: { id: true, contentHash: true } });
      case PipelineAssetType.COMPILED_PROMPT:
        return tx.compiledPrompt.findFirst({ where: { id, workspaceId },
          select: { id: true, compilerVersion: true, hash: true } });
      case PipelineAssetType.PROVIDER_RUNTIME:
        return tx.providerRequestSnapshot.findFirst({ where: { id, workspaceId },
          select: { id: true, providerId: true, modelId: true, providerVersion: true, modelVersion: true } });
      case PipelineAssetType.RETRIEVAL_RUNTIME:
        return tx.retrievalRuntimeSnapshot.findFirst({
          where: { id, workspaceId, runtime: { status: RetrievalRuntimeStatus.PUBLISHED, archivedAt: null } },
          select: { id: true, packageHash: true }
        });
      case PipelineAssetType.CONVERSATION_RUNTIME:
        return tx.conversationRuntimeSnapshot.findFirst({
          where: {
            id, workspaceId,
            runtime: { status: ConversationRuntimeStatus.PUBLISHED, archivedAt: null, deletedAt: null }
          },
          select: { id: true, compatibilityVersion: true, packageHash: true }
        });
      case PipelineAssetType.WORKFLOW:
        return tx.workflowVersion.findFirst({
          where: { id, workflow: { workspaceId, status: "PUBLISHED", archivedAt: null, deletedAt: null } },
          select: { id: true, revision: true }
        });
      case PipelineAssetType.EXECUTION_PROFILE:
        return tx.executionProfileVersion.findFirst({
          where: { id, profile: { workspaceId, status: "PUBLISHED", archivedAt: null, deletedAt: null } },
          select: { id: true, revision: true }
        });
    }
  }

  private async createRecord(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    dto: CreateExecutionPipelineDto, plan: JsonRecord, clonedFromId?: string
  ) {
    const hashes = this.hashPlan(plan, dto.compatibilityVersion);
    const data = {
      workspaceId, createdById: actorId, updatedById: actorId, clonedFromId,
      name: dto.name, compatibilityVersion: dto.compatibilityVersion,
      metadata: json(dto.metadata ?? {}), plan: json(plan), ...hashes,
      nodes: { create: dto.nodes.map((item) => ({
        nodeKey: item.nodeKey, stage: item.stage, ordinal: item.ordinal,
        assetType: item.assetType, assetId: item.assetId, metadata: json(item.metadata ?? {})
      })) },
      dependencies: { create: (dto.dependencies ?? []).map((item) => ({
        dependencyKey: item.dependencyKey, fromNodeKey: item.fromNodeKey,
        toNodeKey: item.toNodeKey, required: item.required ?? true, metadata: json(item.metadata ?? {})
      })) },
      variables: { create: (dto.variables ?? []).map((item) => ({
        name: item.name, type: item.type, value: jsonValue(item.value), required: item.required ?? false
      })) },
      metadataItems: { create: (dto.metadataItems ?? []).map((item) => ({
        key: item.key, value: jsonValue(item.value)
      })) },
      labels: { create: (dto.labels ?? []).map(({ value }) => ({ value })) },
      tags: { create: (dto.tags ?? []).map(({ value }) => ({ value })) }
    };
    return tx.executionPipeline.create({ data: data as never, select: this.pipelineSelect });
  }
  private async replaceChildren(
    tx: Prisma.TransactionClient, id: string, dto: CreateExecutionPipelineDto
  ) {
    await tx.pipelineDiagnostic.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineValidation.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineDependency.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineNode.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineVariable.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineMetadata.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineLabel.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineTag.deleteMany({ where: { pipelineId: id } });
    await tx.pipelineNode.createMany({ data: dto.nodes.map((item) => ({
      pipelineId: id, nodeKey: item.nodeKey, stage: item.stage, ordinal: item.ordinal,
      assetType: item.assetType, assetId: item.assetId, metadata: json(item.metadata ?? {})
    })) });
    if (dto.dependencies?.length) await tx.pipelineDependency.createMany({
      data: dto.dependencies.map((item) => ({
        pipelineId: id, dependencyKey: item.dependencyKey, fromNodeKey: item.fromNodeKey,
        toNodeKey: item.toNodeKey, required: item.required ?? true, metadata: json(item.metadata ?? {})
      }))
    });
    if (dto.variables?.length) await tx.pipelineVariable.createMany({
      data: dto.variables.map((item) => ({
        pipelineId: id, name: item.name, type: item.type,
        value: jsonValue(item.value), required: item.required ?? false
      }))
    });
    if (dto.metadataItems?.length) await tx.pipelineMetadata.createMany({
      data: dto.metadataItems.map((item) => ({
        pipelineId: id, key: item.key, value: jsonValue(item.value)
      }))
    });
    if (dto.labels?.length) await tx.pipelineLabel.createMany({
      data: dto.labels.map(({ value }) => ({ pipelineId: id, value }))
    });
    if (dto.tags?.length) await tx.pipelineTag.createMany({
      data: dto.tags.map(({ value }) => ({ pipelineId: id, value }))
    });
  }
  private lifecycle(
    workspaceId: string, actorId: string, id: string, status: ExecutionPipelineStatus,
    action: string, dates: { archivedAt: Date | null; deletedAt: Date | null }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePipeline(tx, workspaceId, id, true);
      if (current.status === status) throw new BadRequestException(`Pipeline is already ${status}`);
      const updated = await tx.executionPipeline.update({
        where: { id }, data: { status, ...dates, updatedById: actorId }, select: this.pipelineSelect
      });
      await this.mutationAudit(tx, workspaceId, actorId, id, action, current, updated);
      return updated;
    });
  }
  private assertDraft(value: { status: ExecutionPipelineStatus }) {
    if (value.status !== ExecutionPipelineStatus.DRAFT) {
      throw new BadRequestException("Only draft Execution Pipelines are editable or publishable");
    }
  }
  private assertPublished(value: { status: ExecutionPipelineStatus }) {
    if (value.status !== ExecutionPipelineStatus.PUBLISHED) {
      throw new BadRequestException("Only published Execution Pipelines can be rolled back");
    }
  }
  private requirePipeline(
    client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string,
    includeDeleted = false
  ) {
    return client.executionPipeline.findFirst({
      where: { id, workspaceId, deletedAt: includeDeleted ? undefined : null },
      select: this.pipelineSelect
    }).then((value) => {
      if (!value) throw new NotFoundException("Execution Pipeline was not found");
      return value;
    });
  }
  private requireSnapshot(
    client: PrismaService | Prisma.TransactionClient, workspaceId: string, id: string
  ) {
    return client.executionPipelineSnapshot.findFirst({
      where: { id, workspaceId }, select: this.snapshotSelect
    }).then((value) => {
      if (!value) throw new NotFoundException("Execution Pipeline snapshot was not found");
      return value;
    });
  }
  private readonly pipelineSelect = {
    id: true, workspaceId: true, createdById: true, updatedById: true, clonedFromId: true,
    name: true, status: true, revision: true, compatibilityVersion: true, metadata: true,
    plan: true, planHash: true, checksum: true, publishedAt: true, archivedAt: true,
    deletedAt: true, createdAt: true, updatedAt: true, nodes: true, dependencies: true,
    validations: true, audits: true, metadataItems: true, labels: true, tags: true,
    variables: true, diagnostics: true, revisions: true
  } as const;
  private readonly snapshotSelect = {
    id: true, workspaceId: true, pipelineId: true, revision: true, createdById: true,
    snapshot: true, planHash: true, checksum: true, createdAt: true
  } as const;
  private readInput(plan: Prisma.JsonValue): CreateExecutionPipelineDto {
    const input = this.record(plan).input;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Stored Execution Pipeline input is invalid");
    }
    return input as unknown as CreateExecutionPipelineDto;
  }
  private hashPlan(plan: JsonRecord, compatibilityVersion: string) {
    const planHash = this.hash(plan);
    return { planHash, checksum: this.hash({ planHash, compatibilityVersion }) };
  }
  private changed(left: JsonRecord, right: JsonRecord, key: string) {
    return this.stableStringify(left[key]) !== this.stableStringify(right[key]);
  }
  private snapshotIdentity(value: {
    id: string; pipelineId: string; revision: number; planHash: string; checksum: string; createdAt: Date;
  }) {
    return {
      id: value.id, pipelineId: value.pipelineId, revision: value.revision,
      planHash: value.planHash, checksum: value.checksum, createdAt: value.createdAt
    };
  }
  private throwValidation(validation: PipelineValidationResult): never {
    throw new BadRequestException({ message: "Execution Pipeline validation failed",
      diagnostics: validation.diagnostics });
  }
  private error(code: string, path: string, message: string): PipelineDiagnostic {
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
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value as JsonRecord).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }
  private async mutationAudit(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string, pipelineId: string,
    action: string, before: unknown, after: unknown
  ) {
    await this.audit(tx, workspaceId, actorId, action, "ExecutionPipeline", pipelineId, before, after);
    await tx.pipelineAudit.create({
      data: { pipelineId, actorId, eventType: action, metadata: json({}) }
    });
  }
  private async audit(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string, action: string,
    entityType: string, entityId: string, before: unknown, after: unknown
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
