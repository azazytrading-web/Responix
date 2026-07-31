import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RetrievalExecutionMode, RetrievalExecutionStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type { ExecuteRetrievalDto, RetrievalExecutionListQueryDto } from "./dto/retrieval-execution.dto";
import type { RetrievalExecutionStore, RetrievalKnowledgePackage } from "./retrieval-execution.types";
import { RetrievalExecutionValidator } from "./retrieval-execution.validator";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class RetrievalExecutionRepository implements RetrievalExecutionStore {
  constructor(private readonly prisma: PrismaService, private readonly validator: RetrievalExecutionValidator) {}

  async execute(workspaceId: string, actorId: string, input: ExecuteRetrievalDto,
    signal?: AbortSignal): Promise<RetrievalKnowledgePackage> {
    const started = Date.now();
    this.validator.validate(input);
    this.validator.assertCompatibility(input.compatibilityVersion ?? "1.0");
    const normalizedQuery = this.validator.normalizeQuery(input.query);
    this.assertNotCancelled(signal);
    const mode = input.mode ?? RetrievalExecutionMode.HYBRID;
    const topK = input.topK ?? 10; const minScore = input.minScore ?? 0;
    const maxTokens = input.maxTokens ?? 4000;
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.retrievalRuntimeSnapshot.findFirst({
        where: { id: input.retrievalRuntimeSnapshotId, workspaceId },
        include: { runtime: { select: { id: true, status: true, archivedAt: true } } }
      });
      if (!snapshot) throw new NotFoundException("Retrieval Runtime snapshot was not found");
      if (snapshot.runtime.archivedAt || snapshot.runtime.status !== "PUBLISHED") {
        throw new BadRequestException("Retrieval Runtime snapshot is not executable");
      }
      const runtimePackage = this.record(snapshot.retrievalPackage);
      const sources = this.records(runtimePackage.sources);
      const sourceVersions = sources.map((source) => this.string(source.versionId)).filter(Boolean);
      if (this.hash(snapshot.retrievalPackage) !== snapshot.packageHash ||
        this.hash({ packageHash: snapshot.packageHash, sourceVersions }) !== snapshot.checksum) {
        throw new BadRequestException("Retrieval Runtime snapshot integrity validation failed");
      }
      await this.requireExecutionDependencies(tx, workspaceId, input.executionRequestId, input.executionRunId);
      const requestHash = this.hash({ snapshotId: snapshot.id, sourceHash: snapshot.packageHash,
        query: normalizedQuery, mode, topK, minScore, maxTokens, filters: input.filters ?? [] });
      const lookupStarted = Date.now();
      const cached = await tx.retrievalExecution.findFirst({
        where: { workspaceId, requestHash, sourceHash: snapshot.packageHash,
          status: RetrievalExecutionStatus.COMPLETED }, orderBy: { createdAt: "desc" }
      });
      const cacheLookupMs = Date.now() - lookupStarted;
      if (cached) {
        this.assertNotCancelled(signal);
        const cachedPackage = this.record(cached.retrievalPackage) as RetrievalKnowledgePackage;
        const created = await this.persist(tx, workspaceId, actorId, input, {
          mode, normalizedQuery, requestHash, sourceHash: snapshot.packageHash,
          packageValue: cachedPackage, cacheHit: true, started,
          candidateCount: cached.candidateCount, tokenCount: cached.tokenCount,
          diagnostics: [{ severity: "INFO", code: "RETRIEVAL_CACHE_HIT", path: "cache",
            message: "Immutable retrieval package reused by request and source hash" }],
          timings: { cacheLookupMs, queryDurationMs: 0, filterDurationMs: 0,
            rankingDurationMs: 0, packagingDurationMs: 0 }
        });
        return this.freeze(this.record(created.retrievalPackage) as RetrievalKnowledgePackage);
      }
      const queryStarted = Date.now();
      const versionRows = sourceVersions.length ? await tx.knowledgeVersion.findMany({
        where: { id: { in: sourceVersions }, document: { workspaceId } },
        include: { document: { include: { chunks: { orderBy: { ordinal: "asc" } } } } }
      }) : [];
      const queryDurationMs = Date.now() - queryStarted;
      if (versionRows.length !== sourceVersions.length) {
        throw new BadRequestException("One or more immutable retrieval source versions are unavailable");
      }
      this.assertNotCancelled(signal);
      const filterStarted = Date.now();
      const filtered = versionRows.filter(({ document }) => this.matches(document, input.filters ?? []));
      const filterDurationMs = Date.now() - filterStarted;
      const terms = [...new Set(normalizedQuery.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean))];
      const rankingStarted = Date.now();
      const ranked = filtered.map((row) => ({ row, score: this.score(row.snapshot, row.document, terms, mode) }))
        .filter(({ score }) => score >= minScore)
        .sort((a, b) => b.score - a.score || a.row.document.id.localeCompare(b.row.document.id))
        .slice(0, topK);
      const rankingDurationMs = Date.now() - rankingStarted;
      const packagingStarted = Date.now();
      let usedTokens = 0; let truncated = false;
      const documents = ranked.flatMap(({ row, score }, index) => {
        const estimated = row.document.chunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0) ||
          Math.ceil(JSON.stringify(row.snapshot).length / 4);
        if (usedTokens + estimated > maxTokens) { truncated = true; return []; }
        usedTokens += estimated;
        const source = sources.find((candidate) => candidate.versionId === row.id) ?? {};
        const citation = Object.freeze({ index: index + 1, documentId: row.document.id,
          versionId: row.id, label: row.document.name ?? row.document.fileName });
        return [Object.freeze({ documentId: row.document.id, versionId: row.id,
          ...(row.document.collectionId ? { collectionId: row.document.collectionId } : {}),
          name: row.document.name ?? row.document.fileName, mimeType: row.document.mimeType,
          ...(row.document.language ? { language: row.document.language } : {}), score,
          content: row.snapshot, chunks: Object.freeze(row.document.chunks.map((chunk) => Object.freeze({
            id: chunk.id, ordinal: chunk.ordinal, ...(chunk.tokenCount === null ? {} : { tokenCount: chunk.tokenCount }),
            ...(chunk.checksum ? { checksum: chunk.checksum } : {}), metadata: Object.freeze(this.record(chunk.metadata))
          }))), citation, metadata: Object.freeze({ ...this.record(row.document.metadata), ...this.record(source.metadata) }) })];
      });
      const base = { schemaVersion: "1.0" as const, compatibilityVersion: input.compatibilityVersion ?? "1.0",
        mode, query: normalizedQuery, queryTerms: Object.freeze(terms), snapshotId: snapshot.id,
        runtimeId: snapshot.runtimeId, knowledgeBaseId: snapshot.knowledgeBaseId,
        documents: Object.freeze(documents), citations: Object.freeze(documents.map(({ citation }) => citation)),
        preparation: Object.freeze({ keyword: mode !== RetrievalExecutionMode.SEMANTIC,
          semantic: mode !== RetrievalExecutionMode.KEYWORD, hybrid: mode === RetrievalExecutionMode.HYBRID,
          connectorContractVersion: "1.0" as const }),
        budget: Object.freeze({ maxTokens, usedTokens, truncated }), sourceHash: snapshot.packageHash,
        createdAt: new Date().toISOString() };
      const packageValue = Object.freeze({ ...base, packageHash: this.hash(base) });
      const packagingDurationMs = Date.now() - packagingStarted;
      const diagnostics = [{ severity: "INFO" as const, code: "RETRIEVAL_EXECUTED", path: "execution",
        message: "Immutable retrieval context was prepared for prompt execution" },
        ...(mode === RetrievalExecutionMode.SEMANTIC || mode === RetrievalExecutionMode.HYBRID ? [{
          severity: "INFO" as const, code: "SEMANTIC_RETRIEVAL_PREPARED", path: "preparation.semantic",
          message: "Provider-neutral semantic connector inputs were prepared; ranking used available persisted content metadata"
        }] : []), ...(truncated ? [{ severity: "WARNING" as const, code: "TOKEN_BUDGET_TRUNCATED",
          path: "budget", message: "Retrieval results were truncated to the prompt token budget" }] : [])];
      const created = await this.persist(tx, workspaceId, actorId, input, {
        mode, normalizedQuery, requestHash, sourceHash: snapshot.packageHash, packageValue,
        cacheHit: false, started, candidateCount: filtered.length, tokenCount: usedTokens,
        diagnostics, timings: { cacheLookupMs, queryDurationMs, filterDurationMs,
          rankingDurationMs, packagingDurationMs }
      });
      return this.freeze(this.record(created.retrievalPackage) as RetrievalKnowledgePackage);
    });
  }

  get(workspaceId: string, id: string) { return this.requireExecution(workspaceId, id); }
  async recordFailure(workspaceId: string, actorId: string, input: ExecuteRetrievalDto,
    error: unknown, cancelled: boolean) {
    const snapshot = await this.prisma.retrievalRuntimeSnapshot.findFirst({
      where: { id: input.retrievalRuntimeSnapshotId, workspaceId }, select: { id: true, packageHash: true }
    });
    if (!snapshot) return;
    const normalizedQuery = input.query.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
    const message = error instanceof Error ? error.message : "Retrieval execution failed";
    const status = cancelled ? RetrievalExecutionStatus.CANCELLED : RetrievalExecutionStatus.FAILED;
    const emptyPackage = { schemaVersion: "1.0", status, documents: [], citations: [] };
    const packageHash = this.hash(emptyPackage);
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.retrievalExecution.create({ data: { workspaceId, createdById: actorId,
        retrievalRuntimeSnapshotId: snapshot.id, executionRequestId: input.executionRequestId,
        executionRunId: input.executionRunId, mode: input.mode ?? RetrievalExecutionMode.HYBRID,
        status, normalizedQuery, requestHash: this.hash({ snapshotId: snapshot.id, normalizedQuery,
          mode: input.mode ?? RetrievalExecutionMode.HYBRID }), sourceHash: snapshot.packageHash,
        compatibilityVersion: input.compatibilityVersion ?? "1.0", retrievalPackage: json(emptyPackage),
        packageHash, checksum: this.hash({ packageHash, workspaceId, sourceHash: snapshot.packageHash }),
        durationMs: 0, failureCode: cancelled ? "RETRIEVAL_CANCELLED" : "RETRIEVAL_EXECUTION_FAILED",
        failureMessage: message, metadata: json(input.metadata ?? {}),
        diagnostics: { create: { severity: "ERROR", code: cancelled ? "RETRIEVAL_CANCELLED" : "RETRIEVAL_EXECUTION_FAILED",
          path: "execution", message } }, metric: { create: {} } }, select: { id: true } });
      await tx.auditLog.create({ data: { workspaceId, userId: actorId,
        action: cancelled ? "retrieval.execution.cancelled" : "retrieval.execution.failed",
        entityType: "RetrievalExecution", entityId: created.id, oldValues: Prisma.JsonNull,
        newValues: json({ status, message }) } });
    });
  }
  diagnostics(workspaceId: string, id: string) { return this.requireExecution(workspaceId, id).then((v) => v.diagnostics); }
  metrics(workspaceId: string, id: string) { return this.requireExecution(workspaceId, id).then((v) => v.metric); }
  async list(workspaceId: string, query: RetrievalExecutionListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.RetrievalExecutionWhereInput = { workspaceId, status: query.status,
      mode: query.mode, retrievalRuntimeSnapshotId: query.retrievalRuntimeSnapshotId,
      normalizedQuery: query.search ? { contains: query.search, mode: "insensitive" } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.retrievalExecution.findMany({ where, select: this.select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit }),
      this.prisma.retrievalExecution.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async persist(tx: Prisma.TransactionClient, workspaceId: string, actorId: string,
    input: ExecuteRetrievalDto, data: { mode: RetrievalExecutionMode; normalizedQuery: string;
      requestHash: string; sourceHash: string; packageValue: RetrievalKnowledgePackage; cacheHit: boolean;
      started: number; candidateCount: number; tokenCount: number;
      diagnostics: Array<{ severity: string; code: string; path: string; message: string }>;
      timings: { queryDurationMs: number; filterDurationMs: number; rankingDurationMs: number;
        packagingDurationMs: number; cacheLookupMs: number } }) {
    const packageHash = this.hash(data.packageValue);
    const created = await tx.retrievalExecution.create({ data: { workspaceId, createdById: actorId,
      retrievalRuntimeSnapshotId: input.retrievalRuntimeSnapshotId,
      executionRequestId: input.executionRequestId, executionRunId: input.executionRunId,
      mode: data.mode, status: RetrievalExecutionStatus.COMPLETED, normalizedQuery: data.normalizedQuery,
      requestHash: data.requestHash, sourceHash: data.sourceHash,
      compatibilityVersion: input.compatibilityVersion ?? "1.0", retrievalPackage: json(data.packageValue),
      packageHash, checksum: this.hash({ packageHash, workspaceId, sourceHash: data.sourceHash }),
      cacheHit: data.cacheHit, durationMs: Date.now() - data.started,
      candidateCount: data.candidateCount, resultCount: data.packageValue.documents.length,
      tokenCount: data.tokenCount, metadata: json(input.metadata ?? {}),
      diagnostics: { create: data.diagnostics.map((diagnostic) => ({ ...diagnostic })) },
      metric: { create: data.timings } }, select: this.select });
    await tx.auditLog.create({ data: { workspaceId, userId: actorId,
      action: data.cacheHit ? "retrieval.execution.reused" : "retrieval.execution.completed",
      entityType: "RetrievalExecution", entityId: created.id, oldValues: Prisma.JsonNull,
      newValues: json({ requestHash: data.requestHash, packageHash, cacheHit: data.cacheHit,
        executionRequestId: input.executionRequestId, executionRunId: input.executionRunId }) } });
    return created;
  }

  private async requireExecutionDependencies(tx: Prisma.TransactionClient, workspaceId: string,
    requestId?: string, runId?: string) {
    if (requestId && !(await tx.executionRequest.findFirst({ where: { id: requestId, workspaceId } })))
      throw new NotFoundException("Execution request was not found");
    if (runId && !(await tx.executionRun.findFirst({ where: { id: runId, workspaceId,
      ...(requestId ? { requestId } : {}) } }))) throw new NotFoundException("Execution run was not found");
  }
  private requireExecution(workspaceId: string, id: string) {
    return this.prisma.retrievalExecution.findFirst({ where: { id, workspaceId }, select: this.select })
      .then((value) => { if (!value) throw new NotFoundException("Retrieval execution was not found"); return value; });
  }
  private matches(document: JsonRecord, filters: ReadonlyArray<{ key: string; operator: string; value: unknown }>) {
    return filters.every((filter) => { const actual = this.field(document, filter.key);
      if (filter.operator === "EXISTS") return (actual !== undefined) === (filter.value !== false);
      if (filter.operator === "IN") return Array.isArray(filter.value) && filter.value.includes(actual);
      if (filter.operator === "NOT_IN") return Array.isArray(filter.value) && !filter.value.includes(actual);
      return filter.operator === "NOT_EQUALS" ? actual !== filter.value : actual === filter.value; });
  }
  private field(document: JsonRecord, key: string): unknown {
    const normalized = key.startsWith("document.") ? key.slice(9) : key;
    return normalized.split(".").reduce<unknown>((value, part) => this.record(value)[part], document);
  }
  private score(snapshot: unknown, document: JsonRecord, terms: string[], mode: RetrievalExecutionMode) {
    if (!terms.length) return 1;
    const text = `${JSON.stringify(snapshot)} ${JSON.stringify(document)}`.toLocaleLowerCase("und");
    const lexical = terms.filter((term) => text.includes(term)).length / terms.length;
    return mode === RetrievalExecutionMode.SEMANTIC ? (lexical || 0) : lexical;
  }
  private assertNotCancelled(signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Retrieval cancelled", "AbortError");
  }
  private records(value: unknown): JsonRecord[] { return Array.isArray(value) ? value.map((v) => this.record(v)) : []; }
  private record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
  private string(value: unknown) { return typeof value === "string" ? value : ""; }
  private hash(value: unknown) { return createHash("sha256").update(this.stable(value)).digest("hex"); }
  private stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map((v) => this.stable(v)).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${this.stable(v)}`).join(",")}}`;
    if (typeof value === "bigint") return JSON.stringify(value.toString()); return JSON.stringify(value) ?? "null"; }
  private freeze<T>(value: T): T { if (value && typeof value === "object") {
    (Object.values(value) as unknown[]).forEach((item) => { this.freeze(item); }); Object.freeze(value);
  } return value; }
  private readonly select = { id: true, workspaceId: true, createdById: true,
    retrievalRuntimeSnapshotId: true, executionRequestId: true, executionRunId: true,
    mode: true, status: true, normalizedQuery: true, requestHash: true, sourceHash: true,
    compatibilityVersion: true, retrievalPackage: true, packageHash: true, checksum: true,
    cacheHit: true, durationMs: true, candidateCount: true, resultCount: true, tokenCount: true,
    failureCode: true, failureMessage: true, metadata: true, createdAt: true,
    diagnostics: true, metric: true } as const;
}
