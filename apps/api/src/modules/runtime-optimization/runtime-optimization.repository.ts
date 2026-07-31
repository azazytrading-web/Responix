import {
  BadRequestException, ConflictException, Injectable, NotFoundException
} from "@nestjs/common";
import {
  Prisma, RuntimeOptimizationPackageStatus, RuntimeOptimizationPackageType
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  CacheImmutablePackageDto, CacheMemoryRuntimeDto, CacheRenderedPromptDto, CacheRetrievalRuntimeDto,
  CreateRuntimeContextSnapshotDto, RuntimeOptimizationListQueryDto
} from "./dto/runtime-optimization.dto";
import { RuntimeOptimizationValidator } from "./runtime-optimization.validator";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class RuntimeOptimizationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: RuntimeOptimizationValidator
  ) {}

  cacheCompiled(workspaceId: string, actorId: string, compiledPromptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const prompt = await tx.compiledPrompt.findFirst({
        where: { id: compiledPromptId, workspaceId },
        select: {
          id: true, hash: true, checksum: true, compiledPackage: true,
          promptVersionId: true, sizeBytes: true
        }
      });
      if (!prompt) throw new NotFoundException("Compiled Prompt was not found");
      return this.reuseOrCreate(tx, workspaceId, actorId, {
        type: RuntimeOptimizationPackageType.COMPILED_PROMPT,
        scopeKey: `compiled:${prompt.id}`,
        keyHash: prompt.hash, sourceHash: prompt.hash, payload: prompt.compiledPackage,
        references: { compiledPromptId: prompt.id, promptVersionId: prompt.promptVersionId },
        savedTokens: prompt.sizeBytes, operation: "compilation"
      });
    });
  }

  cacheRendered(
    workspaceId: string, actorId: string, dto: CacheRenderedPromptDto
  ) {
    this.validator.validateStaticVariables(dto.staticVariables);
    return this.prisma.$transaction(async (tx) => {
      const prompt = await tx.compiledPrompt.findFirst({
        where: { id: dto.compiledPromptId, workspaceId },
        select: {
          id: true, hash: true, promptVersionId: true,
          resolvedPrompt: true, variableMetadata: true
        }
      });
      if (!prompt) throw new NotFoundException("Compiled Prompt was not found");
      const variablesHash = this.hash(dto.staticVariables);
      const deterministicSections = this.staticSections(prompt.resolvedPrompt);
      const payload = {
        compiledPromptHash: prompt.hash,
        staticVariables: dto.staticVariables,
        sections: this.render(deterministicSections, dto.staticVariables)
      };
      return this.reuseOrCreate(tx, workspaceId, actorId, {
        type: RuntimeOptimizationPackageType.RENDERED_PROMPT,
        scopeKey: `rendered:${prompt.id}`,
        keyHash: this.hash({ compiledPromptHash: prompt.hash, variablesHash }),
        sourceHash: prompt.hash, staticVariablesHash: variablesHash, payload,
        references: { compiledPromptId: prompt.id, promptVersionId: prompt.promptVersionId },
        savedTokens: JSON.stringify(payload).length, operation: "rendering"
      });
    });
  }

  createContext(
    workspaceId: string, actorId: string, dto: CreateRuntimeContextSnapshotDto
  ) {
    this.validator.validateContext(dto);
    return this.prisma.$transaction(async (tx) => {
      const assets: Record<string, unknown> = {};
      const references: Record<string, string> = {};
      const load = async (
        name: string, id: string | undefined,
        query: () => Promise<Record<string, unknown> | null>
      ) => {
        if (!id) return;
        const value = await query();
        if (!value) throw new NotFoundException(`${name} was not found in the workspace`);
        assets[name] = value; references[`${name}Id`] = id;
      };
      await load("agentRuntimeSnapshot", dto.agentRuntimeSnapshotId, async () =>
        tx.agentRuntimeSnapshot.findFirst({
          where: { id: dto.agentRuntimeSnapshotId, workspaceId }
        }));
      await load("compiledPrompt", dto.compiledPromptId, async () =>
        tx.compiledPrompt.findFirst({
          where: { id: dto.compiledPromptId, workspaceId }
        }));
      await load("providerRuntimeSnapshot", dto.providerRuntimeSnapshotId, async () =>
        tx.providerRequestSnapshot.findFirst({
          where: { id: dto.providerRuntimeSnapshotId, workspaceId }
        }));
      await load("conversationRuntimeSnapshot", dto.conversationRuntimeSnapshotId, async () =>
        tx.conversationRuntimeSnapshot.findFirst({
          where: { id: dto.conversationRuntimeSnapshotId, workspaceId }
        }));
      await load("retrievalRuntimeSnapshot", dto.retrievalRuntimeSnapshotId, async () =>
        tx.retrievalRuntimeSnapshot.findFirst({
          where: { id: dto.retrievalRuntimeSnapshotId, workspaceId }
        }));
      await load("executionPipelineSnapshot", dto.executionPipelineSnapshotId, async () =>
        tx.executionPipelineSnapshot.findFirst({
          where: { id: dto.executionPipelineSnapshotId, workspaceId }
        }));
      await load("executionProfileVersion", dto.executionProfileVersionId, async () =>
        tx.executionProfileVersion.findFirst({
          where: { id: dto.executionProfileVersionId, profile: { workspaceId } }
        }));
      const workspace = await tx.workspace.findFirst({
        where: { id: workspaceId, deletedAt: null },
        select: {
          id: true, name: true, slug: true, companyName: true, language: true,
          timezone: true, currency: true, primaryColor: true, secondaryColor: true
        }
      });
      if (!workspace) throw new NotFoundException("Workspace was not found");
      const payload = {
        assets, workspaceRuntimeSettings: workspace,
        immutableMetadata: dto.immutableMetadata ?? {}
      };
      const sourceHash = this.hash({ references, hashes: this.assetHashes(assets), workspace });
      return this.reuseOrCreate(tx, workspaceId, actorId, {
        type: RuntimeOptimizationPackageType.RUNTIME_CONTEXT,
        scopeKey: `context:${this.hash(references)}`,
        keyHash: sourceHash, sourceHash, payload, references,
        savedTokens: JSON.stringify(payload).length, operation: "snapshot"
      });
    });
  }

  cacheRetrieval(
    workspaceId: string, actorId: string, dto: CacheRetrievalRuntimeDto
  ) {
    this.validator.validateRetrieval(dto);
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.retrievalRuntimeSnapshot.findFirst({
        where: { id: dto.retrievalRuntimeSnapshotId, workspaceId, runtime: { status: "PUBLISHED" } },
        select: {
          id: true, runtimeId: true, revision: true, retrievalPackage: true,
          packageHash: true, checksum: true
        }
      });
      if (!snapshot) throw new NotFoundException("Retrieval runtime snapshot was not found");
      const configHash = this.hash({
        languages: dto.languages ?? [], searchConfiguration: dto.searchConfiguration ?? {}
      });
      const payload = {
        retrievalSnapshot: snapshot.retrievalPackage, languages: dto.languages ?? [],
        searchConfiguration: dto.searchConfiguration ?? {}
      };
      return this.reuseOrCreate(tx, workspaceId, actorId, {
        type: RuntimeOptimizationPackageType.RETRIEVAL_RUNTIME,
        scopeKey: `retrieval:${snapshot.runtimeId}`,
        keyHash: this.hash({ packageHash: snapshot.packageHash, configHash }),
        sourceHash: snapshot.packageHash, payload,
        references: {
          retrievalRuntimeSnapshotId: snapshot.id, retrievalRuntimeId: snapshot.runtimeId
        }, savedTokens: JSON.stringify(payload).length, operation: "retrieval"
      });
    });
  }

  cacheMemory(workspaceId: string, actorId: string, dto: CacheMemoryRuntimeDto) {
    return this.prisma.$transaction(async (tx) => {
      const uniqueIds = [...new Set(dto.memoryRuntimeSnapshotIds)];
      if (uniqueIds.length !== dto.memoryRuntimeSnapshotIds.length) {
        throw new ConflictException("Duplicate memory cache references");
      }
      const snapshots = await tx.memoryRuntimeSnapshot.findMany({
        where: { id: { in: uniqueIds }, workspaceId, runtime: { status: "PUBLISHED" } },
        select: { id: true, runtimeId: true, revision: true, snapshot: true,
          packageHash: true, checksum: true }
      });
      if (snapshots.length !== uniqueIds.length) {
        throw new NotFoundException("Memory runtime snapshot was not found");
      }
      const ordered = uniqueIds.map((id) => snapshots.find((item) => item.id === id)!);
      const sourceHash = this.hash(ordered.map((item) => ({
        id: item.id, packageHash: item.packageHash
      })));
      return this.reuseOrCreate(tx, workspaceId, actorId, {
        type: RuntimeOptimizationPackageType.MEMORY_RUNTIME,
        scopeKey: `memory:${uniqueIds.join(":")}`,
        keyHash: sourceHash, sourceHash, payload: ordered,
        references: Object.fromEntries(ordered.map((item, index) => [
          `memoryRuntimeSnapshot${index}Id`, item.id
        ])),
        savedTokens: JSON.stringify(ordered).length, operation: "memory"
      });
    });
  }

  cacheImmutable(workspaceId: string, actorId: string, dto: CacheImmutablePackageDto) {
    this.validator.validateImmutablePackage(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.validateReferences(tx, workspaceId, dto.references ?? {});
      return this.reuseOrCreate(tx, workspaceId, actorId, {
      type: dto.type, scopeKey: dto.scopeKey,
      keyHash: this.hash({ type: dto.type, sourceHash: dto.sourceHash, payload: dto.payload }),
      sourceHash: dto.sourceHash, payload: dto.payload, references: dto.references ?? {},
      savedTokens: dto.savedTokens ?? JSON.stringify(dto.payload).length,
      compileTimeMs: dto.compileTimeMs ?? 0, revision: dto.revision ?? 1,
      operation: dto.type === RuntimeOptimizationPackageType.WORKFLOW_PACKAGE ? "workflow" :
        dto.type === RuntimeOptimizationPackageType.TOOL_DEFINITION ? "tool" :
        dto.type === RuntimeOptimizationPackageType.EXECUTION_PLAN ? "plan" : "snapshot"
      });
    });
  }

  invalidate(workspaceId: string, actorId: string, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.runtimeOptimizationPackage.findFirst({ where: { id, workspaceId },
        select: this.select });
      if (!current) throw new NotFoundException("Runtime optimization package was not found");
      if (current.status === RuntimeOptimizationPackageStatus.INVALIDATED) return current;
      const updated = await tx.runtimeOptimizationPackage.updateMany({ where: { id, workspaceId,
        status: RuntimeOptimizationPackageStatus.ACTIVE, version: current.version }, data: {
        status: RuntimeOptimizationPackageStatus.INVALIDATED, version: { increment: 1 },
        invalidatedAt: new Date(), invalidatedById: actorId, invalidationReason: reason
      } });
      if (updated.count !== 1) throw new ConflictException("Optimization package was updated concurrently");
      await this.audit(tx, workspaceId, actorId, "runtime.optimization.invalidated", id, { reason });
      return tx.runtimeOptimizationPackage.findFirstOrThrow({ where: { id, workspaceId }, select: this.select });
    });
  }

  recordProviderOutcome(workspaceId: string, actorId: string, input: { packageId: string;
    providerId: string; modelId: string; nativeSupported: boolean; cachedTokens: number;
    providerCacheId?: string; ttlSeconds?: number; savedCost?: number; latencyGainMs?: number }) {
    return this.prisma.$transaction(async (tx) => {
      const cache = await tx.runtimeOptimizationPackage.findFirst({ where: { id: input.packageId,
        workspaceId, status: RuntimeOptimizationPackageStatus.ACTIVE } });
      if (!cache) throw new NotFoundException("Active optimization package was not found");
      const model = await tx.aiModel.findFirst({ where: { id: input.modelId,
        providerId: input.providerId, status: "ACTIVE", provider: { status: "ACTIVE",
          configurations: { some: { workspaceId, enabled: true } } } }, select: { id: true } });
      if (!model) throw new NotFoundException("Active workspace provider model was not found");
      const hit = input.cachedTokens > 0;
      const outcome = await tx.runtimeOptimizationProviderOutcome.create({ data: {
        packageId: cache.id, workspaceId, providerId: input.providerId, modelId: input.modelId,
        nativeSupported: input.nativeSupported, cacheHit: hit, cachedTokens: input.cachedTokens,
        providerCacheId: input.providerCacheId, ttlSeconds: input.ttlSeconds
      } });
      await tx.runtimeOptimizationMetric.update({ where: { packageId: cache.id }, data: {
        providerCacheAvailable: input.nativeSupported, providerCacheUsage: { increment: 1 },
        ...(hit ? { providerCacheHits: { increment: 1 } } : { providerCacheMisses: { increment: 1 } }),
        estimatedSavedTokens: { increment: input.cachedTokens },
        estimatedSavedCost: { increment: input.savedCost ?? 0 },
        estimatedLatencyGainMs: { increment: BigInt(input.latencyGainMs ?? 0) }
      } });
      await this.audit(tx, workspaceId, actorId, hit ? "runtime.optimization.provider.hit" :
        "runtime.optimization.provider.miss", outcome.id, input);
      return outcome;
    });
  }

  get(workspaceId: string, id: string) {
    return this.prisma.runtimeOptimizationPackage.findFirst({
      where: { id, workspaceId }, select: this.select
    }).then((value) => {
      if (!value) throw new NotFoundException("Runtime optimization package was not found");
      this.verify(value); return value;
    });
  }
  async list(workspaceId: string, query: RuntimeOptimizationListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.RuntimeOptimizationPackageWhereInput = {
      workspaceId, type: query.type, sourceHash: query.sourceHash,
      scopeKey: query.scopeKey, status: query.status
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.runtimeOptimizationPackage.findMany({
        where, select: this.select, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.runtimeOptimizationPackage.count({ where })
    ]);
    data.forEach((item) => this.verify(item));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  getMetrics(workspaceId: string, id: string) {
    return this.prisma.runtimeOptimizationPackage.findFirst({
      where: { id, workspaceId }, select: this.select
    }).then((value) => {
      if (!value) throw new NotFoundException("Runtime optimization package was not found");
      this.verify(value);
      return value.metric;
    });
  }

  private async reuseOrCreate(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    input: {
      type: RuntimeOptimizationPackageType; keyHash: string; sourceHash: string;
      scopeKey?: string; revision?: number; compileTimeMs?: number;
      staticVariablesHash?: string; payload: unknown; references: Record<string, string>;
      savedTokens: number; operation: "compilation" | "rendering" | "snapshot" | "retrieval" | "memory" | "workflow" | "tool" | "plan";
    }
  ) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(
      ${`${workspaceId}:${input.type}:${input.keyHash}`}, 0))`);
    const existing = await tx.runtimeOptimizationPackage.findFirst({ where: {
      workspaceId, type: input.type, keyHash: input.keyHash,
      status: RuntimeOptimizationPackageStatus.ACTIVE
    }, select: this.select });
    if (existing && existing.status === RuntimeOptimizationPackageStatus.ACTIVE) {
      this.verify(existing);
      const metric = existing.metric!;
      const lifetime = Math.max(0, Date.now() - existing.createdAt.getTime());
      const updated = await tx.runtimeOptimizationMetric.updateMany({
        where: { packageId: existing.id, version: metric.version },
        data: {
          version: { increment: 1 }, cacheHits: { increment: 1 },
          reuseCount: { increment: 1 }, lastAccessedAt: new Date(),
          totalLifetimeMs: { increment: BigInt(lifetime) },
          averageCacheLifetimeMs: Math.round(
            (Number(metric.totalLifetimeMs) + lifetime) / (metric.reuseCount + 1)
          ),
          estimatedSavedTokens: { increment: input.savedTokens },
          estimatedSavedRequests: { increment: 1 },
          ...(input.operation === "compilation"
            ? {
              compiledPromptReuse: { increment: 1 },
              estimatedSavedCompilationOperations: { increment: 1 }
            } : {}),
          ...(input.operation === "rendering"
            ? {
              renderedPromptReuse: { increment: 1 },
              estimatedSavedRenderingOperations: { increment: 1 }
            } : {}),
          ...(input.operation === "snapshot"
            ? { runtimeSnapshotReuse: { increment: 1 } } : {}),
          ...(input.operation === "retrieval" || input.operation === "memory"
            ? { retrievalPackageReuse: { increment: 1 } } : {})
        }
      });
      if (updated.count !== 1) throw new ConflictException("Optimization metric was updated");
      await this.audit(tx, workspaceId, actorId, "runtime.optimization.reused", existing.id, {
        type: input.type, keyHash: input.keyHash
      });
      return tx.runtimeOptimizationPackage.findUniqueOrThrow({
        where: { id: existing.id }, select: this.select
      });
    }
    if (input.scopeKey) {
      const stale = await tx.runtimeOptimizationPackage.findMany({ where: { workspaceId,
        type: input.type, scopeKey: input.scopeKey, status: RuntimeOptimizationPackageStatus.ACTIVE,
        NOT: { keyHash: input.keyHash } }, select: { id: true } });
      if (stale.length) {
        await tx.runtimeOptimizationPackage.updateMany({ where: { id: { in: stale.map(({ id }) => id) },
          status: RuntimeOptimizationPackageStatus.ACTIVE }, data: { status: RuntimeOptimizationPackageStatus.INVALIDATED,
          invalidatedAt: new Date(), invalidatedById: actorId,
          invalidationReason: "Source hash changed" } });
        for (const item of stale) await this.audit(tx, workspaceId, actorId,
          "runtime.optimization.invalidated", item.id, { reason: "Source hash changed", successorKeyHash: input.keyHash });
      }
    }
    const packageHash = this.hash(input.payload);
    const created = await tx.runtimeOptimizationPackage.create({
      data: {
        workspaceId, createdById: actorId, publisherId: actorId, type: input.type,
        scopeKey: input.scopeKey, revision: input.revision ?? 1,
        keyHash: input.keyHash, sourceHash: input.sourceHash,
        staticVariablesHash: input.staticVariablesHash,
        payload: json(input.payload), assetReferences: json(input.references),
        packageHash, checksum: this.hash({ packageHash, workspaceId, type: input.type }),
        metric: { create: { cacheMisses: 1, compileTimeMs: input.compileTimeMs ?? 0 } }
      }, select: this.select
    });
    await this.audit(tx, workspaceId, actorId, "runtime.optimization.created", created.id, {
      type: input.type, keyHash: input.keyHash
    });
    return created;
  }
  private staticSections(value: unknown): unknown {
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.orderedMessages)) {
      return {
        ...record,
        orderedMessages: record.orderedMessages.filter((message) => {
          if (!message || typeof message !== "object") return false;
          const role = (message as Record<string, unknown>).role;
          return role === "SYSTEM" || role === "DEVELOPER" ||
            role === "system" || role === "developer";
        })
      };
    }
    return record;
  }
  private async validateReferences(tx: Prisma.TransactionClient, workspaceId: string,
    references: Record<string, string>) {
    for (const [name, id] of Object.entries(references)) {
      let found: unknown;
      if (name === "compiledPromptId") found = await tx.compiledPrompt.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else if (name === "agentRuntimeSnapshotId") found = await tx.agentRuntimeSnapshot.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else if (name === "providerRuntimeSnapshotId") found = await tx.providerRequestSnapshot.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else if (name === "conversationRuntimeSnapshotId") found = await tx.conversationRuntimeSnapshot.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else if (name === "retrievalRuntimeSnapshotId") found = await tx.retrievalRuntimeSnapshot.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else if (name === "executionPipelineSnapshotId") found = await tx.executionPipelineSnapshot.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else if (name === "workflowVersionId") found = await tx.workflowVersion.findFirst({ where: { id, workflow: { workspaceId } }, select: { id: true } });
      else if (/^toolVersion\d*Id$/.test(name)) found = await tx.toolVersion.findFirst({ where: { id, tool: { workspaceId } }, select: { id: true } });
      else if (/^memoryRuntimeSnapshot\d*Id$/.test(name)) found = await tx.memoryRuntimeSnapshot.findFirst({ where: { id, workspaceId }, select: { id: true } });
      else throw new BadRequestException(`Unsupported cache reference ${name}`);
      if (!found) throw new NotFoundException(`Cache reference ${name} was not found in the workspace`);
    }
  }
  private render(value: unknown, variables: Record<string, unknown>): unknown {
    if (typeof value === "string") return value.replace(
      /\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*\}\}/g,
      (match, name: string) => {
        const resolved = variables[name];
        if (resolved === undefined) return match;
        return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
      }
    );
    if (Array.isArray(value)) return value.map((item) => this.render(item, variables));
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.render(item, variables)])
    );
    return value;
  }
  private assetHashes(assets: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(assets).map(([name, asset]) => {
      const record = asset as Record<string, unknown>;
      return [name, record.contentHash ?? record.hash ?? record.requestHash ??
        record.packageHash ?? record.planHash ?? record.checksum ?? this.hash(asset)];
    }));
  }
  private hash(value: unknown) {
    return createHash("sha256").update(this.stable(value)).digest("hex");
  }
  private verify(value: { workspaceId: string; type: RuntimeOptimizationPackageType;
    payload: unknown; packageHash: string; checksum: string }) {
    if (this.hash(value.payload) !== value.packageHash || this.hash({ packageHash: value.packageHash,
      workspaceId: value.workspaceId, type: value.type }) !== value.checksum) {
      throw new ConflictException("Runtime optimization package integrity validation failed");
    }
  }
  private stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stable(item)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stable(item)}`).join(",")}}`;
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    return JSON.stringify(value);
  }
  private audit(
    tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    action: string, entityId: string, after: unknown
  ) {
    return tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action,
      entityType: "RuntimeOptimizationPackage", entityId,
      oldValues: Prisma.JsonNull, newValues: json(after)
    } });
  }
  private readonly select = {
    id: true, workspaceId: true, createdById: true, publisherId: true, type: true,
    status: true, scopeKey: true, keyHash: true,
    sourceHash: true, staticVariablesHash: true, payload: true, assetReferences: true,
    packageHash: true, checksum: true, version: true, revision: true, invalidatedAt: true,
    invalidatedById: true, invalidationReason: true, createdAt: true, metric: true,
    providerOutcomes: { orderBy: { createdAt: "desc" as const } }
  } as const;
}
