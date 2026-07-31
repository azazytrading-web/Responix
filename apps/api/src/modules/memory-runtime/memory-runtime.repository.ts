import {
  BadRequestException, ConflictException, Injectable, NotFoundException
} from "@nestjs/common";
import {
  MemoryRuntimeStatus, Prisma
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  CommitMemoryWritesDto, CreateMemoryRuntimeDto, MemoryRuntimeListQueryDto,
  MemorySnapshotListQueryDto, UpdateMemoryRuntimeDto
} from "./dto/memory-runtime.dto";
import { MemoryRuntimeValidator } from "./memory-runtime.validator";
import type { MemoryRuntimeStore, ResolvedMemoryPackage } from "./memory-runtime.types";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
type RecordValue = Record<string, unknown>;

@Injectable()
export class MemoryRuntimeRepository implements MemoryRuntimeStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: MemoryRuntimeValidator
  ) {}

  async create(workspaceId: string, actorId: string, dto: CreateMemoryRuntimeDto) {
    this.validator.validateIdentifier(dto.identifier);
    this.validator.validateReferences(dto.references);
    return this.prisma.$transaction(async (tx) => {
      await this.validateOwnership(tx, workspaceId, dto);
      await this.validateReferenceGraph(tx, workspaceId, undefined, dto.references ?? []);
      const packageValue = this.package(dto.content, dto.metadata ?? {}, dto.compatibilityVersion);
      const packageHash = this.hash(packageValue);
      const created = await tx.memoryRuntime.create({
        data: {
          workspaceId, createdById: actorId, updatedById: actorId,
          identifier: dto.identifier, name: dto.name, type: dto.type, scopeKey: dto.scopeKey,
          compatibilityVersion: dto.compatibilityVersion,
          executionRequestId: dto.executionRequestId, executionRunId: dto.executionRunId,
          content: json(dto.content), metadata: json(dto.metadata ?? {}),
          packageHash, checksum: this.hash({ packageHash, workspaceId }),
          references: { create: (dto.references ?? []).map((reference) => ({
            targetRuntimeId: reference.targetRuntimeId,
            targetRevision: reference.targetRevision, referenceKey: reference.referenceKey,
            kind: reference.kind, required: reference.required ?? true,
            metadata: json(reference.metadata ?? {})
          })) },
          metric: { create: {} },
          diagnostics: { create: {
            severity: "INFO", code: "MEMORY_RUNTIME_VALID",
            path: "runtime", message: "Memory runtime package passed dependency and compatibility validation"
          } },
          lifecycle: { create: {
            actorId, toStatus: MemoryRuntimeStatus.DRAFT, stateVersion: 0
          } }
        }, select: this.runtimeSelect
      });
      await this.audit(tx, workspaceId, actorId, "memory.runtime.created", created.id, null, created);
      return created;
    });
  }

  async update(workspaceId: string, actorId: string, id: string, dto: UpdateMemoryRuntimeDto) {
    this.validator.validateReferences(dto.references);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id);
      if (current.status !== MemoryRuntimeStatus.DRAFT) {
        throw new BadRequestException("Published or archived memory is immutable");
      }
      await this.validateReferenceGraph(tx, workspaceId, id, dto.references ?? []);
      const packageValue = this.package(
        dto.content, dto.metadata ?? this.record(current.metadata), current.compatibilityVersion
      );
      const packageHash = this.hash(packageValue);
      const updated = await tx.memoryRuntime.updateMany({
        where: { id, workspaceId, stateVersion: dto.expectedStateVersion },
        data: {
          content: json(dto.content), metadata: json(dto.metadata ?? current.metadata),
          packageHash, checksum: this.hash({ packageHash, workspaceId }),
          stateVersion: { increment: 1 }, updatedById: actorId
        }
      });
      if (updated.count !== 1) throw new ConflictException("Memory state version changed");
      if (dto.references) {
        await tx.memoryRuntimeReference.deleteMany({ where: { runtimeId: id } });
        await tx.memoryRuntimeReference.createMany({ data: dto.references.map((reference) => ({
          runtimeId: id, targetRuntimeId: reference.targetRuntimeId,
          targetRevision: reference.targetRevision, referenceKey: reference.referenceKey,
          kind: reference.kind, required: reference.required ?? true,
          metadata: json(reference.metadata ?? {})
        })) });
      }
      const value = await this.requireRuntime(tx, workspaceId, id);
      await this.audit(tx, workspaceId, actorId, "memory.runtime.updated", id, current, value);
      return value;
    });
  }

  async publish(workspaceId: string, actorId: string, id: string, expectedStateVersion?: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id);
      if (current.status === MemoryRuntimeStatus.ARCHIVED) {
        throw new BadRequestException("Archived memory cannot be published");
      }
      if (expectedStateVersion !== undefined && current.stateVersion !== expectedStateVersion) {
        throw new ConflictException("Memory state version changed");
      }
      await this.validateStoredReferences(tx, workspaceId, current);
      const revision = current.revision + 1;
      const version = current.status === MemoryRuntimeStatus.PUBLISHED
        ? current.version + 1 : current.version;
      const immutable = this.snapshotValue(current);
      const snapshot = await tx.memoryRuntimeSnapshot.create({
        data: {
          workspaceId, runtimeId: id, version, revision, createdById: actorId,
          compatibilityVersion: current.compatibilityVersion, snapshot: json(immutable),
          metadata: json(current.metadata), packageHash: current.packageHash,
          checksum: current.checksum
        }, select: this.snapshotSelect
      });
      await tx.memoryRuntimeVersion.create({ data: {
        runtimeId: id, version, revision, snapshot: json(immutable),
        packageHash: current.packageHash, checksum: current.checksum, createdById: actorId
      } });
      const nextState = current.stateVersion + 1;
      await tx.memoryRuntime.update({ where: { id }, data: {
        status: MemoryRuntimeStatus.PUBLISHED, version, revision, stateVersion: nextState,
        publishedAt: new Date(), updatedById: actorId
      } });
      await tx.memoryRuntimeLifecycle.create({ data: {
        runtimeId: id, actorId, fromStatus: current.status,
        toStatus: MemoryRuntimeStatus.PUBLISHED, stateVersion: nextState
      } });
      await this.audit(tx, workspaceId, actorId, "memory.runtime.published", id, current, snapshot);
      return snapshot;
    });
  }

  async rollback(workspaceId: string, actorId: string, id: string, versionId: string,
    expectedStateVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id);
      if (current.stateVersion !== expectedStateVersion) {
        throw new ConflictException("Memory state version changed");
      }
      const source = await tx.memoryRuntimeVersion.findFirst({
        where: { id: versionId, runtimeId: id }
      });
      if (!source) throw new NotFoundException("Memory version was not found");
      if (source.revision > current.revision) {
        throw new BadRequestException("Invalid future memory revision");
      }
      const revision = current.revision + 1;
      const version = current.version + 1;
      const value = this.record(source.snapshot);
      const content = this.record(value.content);
      const metadata = this.record(value.metadata);
      const packageValue = this.package(content, metadata, current.compatibilityVersion);
      const packageHash = this.hash(packageValue);
      const checksum = this.hash({ packageHash, workspaceId });
      const snapshot = await tx.memoryRuntimeSnapshot.create({ data: {
        workspaceId, runtimeId: id, version, revision, createdById: actorId,
        compatibilityVersion: current.compatibilityVersion, snapshot: json(packageValue),
        metadata: json(metadata), packageHash, checksum
      }, select: this.snapshotSelect });
      await tx.memoryRuntimeVersion.create({ data: {
        runtimeId: id, version, revision, sourceRevision: source.revision,
        snapshot: json(packageValue), packageHash, checksum, createdById: actorId
      } });
      await tx.memoryRuntime.update({ where: { id }, data: {
        content: json(content), metadata: json(metadata), packageHash, checksum,
        version, revision, stateVersion: { increment: 1 }, updatedById: actorId
      } });
      await this.audit(tx, workspaceId, actorId, "memory.runtime.rolled_back", id, current, snapshot);
      return snapshot;
    });
  }

  async archive(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireRuntime(tx, workspaceId, id);
      if (current.status === MemoryRuntimeStatus.ARCHIVED) return current;
      const nextState = current.stateVersion + 1;
      const updated = await tx.memoryRuntime.update({ where: { id }, data: {
        status: MemoryRuntimeStatus.ARCHIVED, archivedAt: new Date(),
        stateVersion: nextState, updatedById: actorId
      }, select: this.runtimeSelect });
      await tx.memoryRuntimeLifecycle.create({ data: {
        runtimeId: id, actorId, fromStatus: current.status,
        toStatus: MemoryRuntimeStatus.ARCHIVED, stateVersion: nextState
      } });
      await this.audit(tx, workspaceId, actorId, "memory.runtime.archived", id, current, updated);
      return updated;
    });
  }

  async loadResolved(workspaceId: string, actorId: string, snapshotIds: string[],
    compatibilityVersion: string, executionRequestId?: string,
    executionRunId?: string): Promise<ResolvedMemoryPackage> {
    const started = Date.now();
    if (new Set(snapshotIds).size !== snapshotIds.length) {
      throw new BadRequestException("Duplicate memory snapshot references");
    }
    return this.prisma.$transaction(async (tx) => {
      if (executionRequestId) await this.requireExecution(tx, workspaceId, executionRequestId, "request");
      if (executionRunId) await this.requireExecution(tx, workspaceId, executionRunId, "run");
      const rows = await tx.memoryRuntimeSnapshot.findMany({
        where: { id: { in: snapshotIds }, workspaceId },
        include: { runtime: { select: {
          id: true, identifier: true, type: true, scopeKey: true, status: true
        } } }
      });
      if (rows.length !== snapshotIds.length) {
        throw new NotFoundException("One or more memory snapshots were not found");
      }
      const ordered = snapshotIds.map((id) => rows.find((row) => row.id === id)!);
      const snapshots = ordered.map((row) => {
        this.validator.assertCompatibility(compatibilityVersion, row.compatibilityVersion);
        this.validator.assertIntegrity(row.snapshot, row.packageHash, row.checksum,
          (value) => this.hash(value), workspaceId);
        if (row.runtime.status === MemoryRuntimeStatus.ARCHIVED) {
          throw new BadRequestException("Archived memory cannot be resolved");
        }
        const value = this.record(row.snapshot);
        return Object.freeze({
          snapshotId: row.id, runtimeId: row.runtimeId, identifier: row.runtime.identifier,
          type: row.runtime.type, scopeKey: row.runtime.scopeKey, revision: row.revision,
          content: Object.freeze(this.record(value.content)),
          metadata: Object.freeze(this.record(value.metadata)), packageHash: row.packageHash
        });
      });
      const packageHash = this.hash(snapshots.map(({ snapshotId, packageHash }) => ({
        snapshotId, packageHash
      })));
      await Promise.all(ordered.flatMap((row) => [
        tx.memoryRuntimeMetric.update({
          where: { runtimeId: row.runtimeId }, data: {
            loadCount: { increment: 1 }, resolutionDurationMs: { increment: Date.now() - started },
            lastResolvedAt: new Date()
          }
        }),
        tx.memoryRuntimeDiagnostic.create({ data: {
          runtimeId: row.runtimeId, severity: "INFO", code: "MEMORY_RESOLVED",
          path: "snapshot", message: "Immutable memory snapshot resolved for execution",
          metadata: json({ snapshotId: row.id, executionRequestId, executionRunId })
        } })
      ]));
      await this.audit(tx, workspaceId, actorId, "memory.runtime.resolved",
        executionRunId ?? executionRequestId ?? workspaceId, null,
        { snapshotIds, packageHash, executionRequestId, executionRunId });
      return Object.freeze({
        snapshots: Object.freeze(snapshots), packageHash, resolvedAt: new Date().toISOString()
      });
    });
  }

  async commitWrite(workspaceId: string, actorId: string, dto: CommitMemoryWritesDto) {
    const values = await this.commitWrites(workspaceId, actorId, [dto]);
    return values[0];
  }

  commitWrites(workspaceId: string, actorId: string, writes: CommitMemoryWritesDto[]) {
    return this.prisma.$transaction(async (tx) => {
      const executionRunIds = [...new Set(writes.map((write) => write.executionRunId))];
      for (const executionRunId of executionRunIds) {
        await this.requireExecution(tx, workspaceId, executionRunId, "run");
      }
      const values = [];
      for (const dto of writes) {
        values.push(await this.commitWriteInTransaction(tx, workspaceId, actorId, dto));
      }
      return values;
    });
  }

  private async commitWriteInTransaction(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    dto: CommitMemoryWritesDto
  ) {
      const current = await this.requireRuntime(tx, workspaceId, dto.runtimeId);
      if (current.status === MemoryRuntimeStatus.ARCHIVED) {
        throw new BadRequestException("Archived memory cannot accept runtime writes");
      }
      if (current.stateVersion !== dto.expectedStateVersion) {
        throw new ConflictException("Memory state version changed");
      }
      const metadata = { ...this.record(current.metadata), ...dto.metadata,
        lastExecutionRunId: dto.executionRunId };
      const packageValue = this.package(dto.content, metadata, current.compatibilityVersion);
      const packageHash = this.hash(packageValue);
      const checksum = this.hash({ packageHash, workspaceId });
      const revision = current.revision + 1;
      const version = current.version + 1;
      const snapshot = await tx.memoryRuntimeSnapshot.create({ data: {
        workspaceId, runtimeId: current.id, version, revision, createdById: actorId,
        compatibilityVersion: current.compatibilityVersion, snapshot: json(packageValue),
        metadata: json(metadata), packageHash, checksum
      }, select: this.snapshotSelect });
      await tx.memoryRuntimeVersion.create({ data: {
        runtimeId: current.id, version, revision, snapshot: json(packageValue),
        packageHash, checksum, createdById: actorId
      } });
      await tx.memoryRuntime.update({ where: { id: current.id }, data: {
        content: json(dto.content), metadata: json(metadata), packageHash, checksum,
        version, revision, stateVersion: { increment: 1 }, updatedById: actorId
      } });
      await tx.memoryRuntimeMetric.update({ where: { runtimeId: current.id },
        data: { writeCount: { increment: 1 } } });
      await this.audit(tx, workspaceId, actorId, "memory.runtime.write_committed",
        current.id, current, snapshot);
      return snapshot;
  }

  get(workspaceId: string, id: string) {
    return this.requireRuntime(this.prisma, workspaceId, id);
  }
  getSnapshot(workspaceId: string, id: string) {
    return this.prisma.memoryRuntimeSnapshot.findFirst({
      where: { id, workspaceId }, select: this.snapshotSelect
    }).then((value) => {
      if (!value) throw new NotFoundException("Memory snapshot was not found");
      return value;
    });
  }
  diagnostics(workspaceId: string, id: string) {
    return this.requireRuntime(this.prisma, workspaceId, id).then((value) => value.diagnostics);
  }
  metrics(workspaceId: string, id: string) {
    return this.requireRuntime(this.prisma, workspaceId, id).then((value) => value.metric);
  }
  history(workspaceId: string, id: string) {
    return this.requireRuntime(this.prisma, workspaceId, id).then((value) => value.versions);
  }
  async list(workspaceId: string, query: MemoryRuntimeListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.MemoryRuntimeWhereInput = {
      workspaceId, type: query.type, status: query.status, scopeKey: query.scopeKey,
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { identifier: { contains: query.search, mode: "insensitive" } }
      ] } : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.memoryRuntime.findMany({ where, select: this.runtimeSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit }),
      this.prisma.memoryRuntime.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async listSnapshots(workspaceId: string, query: MemorySnapshotListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where = { workspaceId, runtimeId: query.runtimeId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.memoryRuntimeSnapshot.findMany({ where, select: this.snapshotSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit }),
      this.prisma.memoryRuntimeSnapshot.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async compare(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await Promise.all([
      this.getSnapshot(workspaceId, leftId), this.getSnapshot(workspaceId, rightId)
    ]);
    const a = this.record(left.snapshot); const b = this.record(right.snapshot);
    return {
      identical: left.packageHash === right.packageHash && left.checksum === right.checksum,
      left: { id: left.id, runtimeId: left.runtimeId, version: left.version, revision: left.revision },
      right: { id: right.id, runtimeId: right.runtimeId, version: right.version, revision: right.revision },
      changed: {
        content: this.hash(a.content) !== this.hash(b.content),
        metadata: this.hash(a.metadata) !== this.hash(b.metadata),
        compatibility: left.compatibilityVersion !== right.compatibilityVersion
      }
    };
  }

  private async validateOwnership(tx: Prisma.TransactionClient, workspaceId: string,
    dto: CreateMemoryRuntimeDto) {
    if (dto.executionRequestId) await this.requireExecution(tx, workspaceId, dto.executionRequestId, "request");
    if (dto.executionRunId) await this.requireExecution(tx, workspaceId, dto.executionRunId, "run");
  }
  private async requireExecution(tx: Prisma.TransactionClient, workspaceId: string,
    id: string, kind: "request" | "run") {
    const value = kind === "request"
      ? await tx.executionRequest.findFirst({ where: { id, workspaceId }, select: { id: true } })
      : await tx.executionRun.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!value) throw new BadRequestException(`Memory ${kind} ownership validation failed`);
  }
  private async validateStoredReferences(tx: Prisma.TransactionClient, workspaceId: string,
    runtime: Awaited<ReturnType<MemoryRuntimeRepository["requireRuntime"]>>) {
    await this.validateReferenceGraph(tx, workspaceId, runtime.id,
      runtime.references.map((r) => ({
        referenceKey: r.referenceKey, targetRuntimeId: r.targetRuntimeId,
        targetRevision: r.targetRevision ?? undefined, kind: r.kind,
        required: r.required, metadata: this.record(r.metadata)
      })));
  }
  private async validateReferenceGraph(tx: Prisma.TransactionClient, workspaceId: string,
    sourceId: string | undefined, references: CreateMemoryRuntimeDto["references"]) {
    for (const reference of references ?? []) {
      if (sourceId === reference.targetRuntimeId) {
        throw new BadRequestException("Circular memory reference detected");
      }
      const target = await tx.memoryRuntime.findFirst({
        where: { id: reference.targetRuntimeId, workspaceId },
        select: { id: true, revision: true, compatibilityVersion: true }
      });
      if (!target) throw new BadRequestException("Broken memory reference");
      if (reference.targetRevision !== undefined &&
        (reference.targetRevision < 1 || reference.targetRevision > target.revision)) {
        throw new BadRequestException("Invalid memory reference revision");
      }
      if (sourceId && await this.reaches(tx, reference.targetRuntimeId, sourceId, new Set())) {
        throw new BadRequestException("Circular memory reference detected");
      }
    }
  }
  private async reaches(tx: Prisma.TransactionClient, current: string, sought: string,
    visited: Set<string>): Promise<boolean> {
    if (current === sought) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const edges = await tx.memoryRuntimeReference.findMany({
      where: { runtimeId: current }, select: { targetRuntimeId: true }
    });
    for (const edge of edges) {
      if (await this.reaches(tx, edge.targetRuntimeId, sought, visited)) return true;
    }
    return false;
  }
  private requireRuntime(client: PrismaService | Prisma.TransactionClient,
    workspaceId: string, id: string) {
    return client.memoryRuntime.findFirst({
      where: { id, workspaceId }, select: this.runtimeSelect
    }).then((value) => {
      if (!value) throw new NotFoundException("Memory Runtime was not found");
      return value;
    });
  }
  private package(content: RecordValue, metadata: RecordValue, compatibilityVersion: string) {
    return { content, metadata, compatibilityVersion };
  }
  private snapshotValue(value: { content: unknown; metadata: unknown; compatibilityVersion: string }) {
    return this.package(this.record(value.content), this.record(value.metadata), value.compatibilityVersion);
  }
  private record(value: unknown): RecordValue {
    return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
  }
  private hash(value: unknown) {
    return createHash("sha256").update(this.stable(value)).digest("hex");
  }
  private stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stable(item)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stable(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
  }
  private audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    action: string, entityId: string, before: unknown, after: unknown) {
    return tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action, entityType: "MemoryRuntime", entityId,
      oldValues: before === null ? Prisma.JsonNull : json(before),
      newValues: after === null ? Prisma.JsonNull : json(after)
    } });
  }
  private readonly snapshotSelect = {
    id: true, workspaceId: true, runtimeId: true, version: true, revision: true,
    createdById: true, compatibilityVersion: true, snapshot: true, metadata: true,
    packageHash: true, checksum: true, createdAt: true
  } as const;
  private readonly runtimeSelect = {
    id: true, workspaceId: true, createdById: true, updatedById: true,
    identifier: true, name: true, type: true, scopeKey: true, status: true,
    version: true, revision: true, stateVersion: true, compatibilityVersion: true,
    executionRequestId: true, executionRunId: true, content: true, metadata: true,
    packageHash: true, checksum: true, publishedAt: true, archivedAt: true,
    createdAt: true, updatedAt: true, references: true, diagnostics: true,
    metric: true, versions: true, lifecycle: true
  } as const;
}
