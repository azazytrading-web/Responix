import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import type {
  CompilePromptDto,
  CompiledPromptListQueryDto,
  CompilerVariableDto
} from "./dto/prompt-compiler.dto";
import {
  CompilerVariableSource,
  CompilerVariableType
} from "./dto/prompt-compiler.dto";
import {
  PromptCompilerEngine,
  type CompilerDiagnostic,
  type PromptCompilerInput,
  type PromptCompilerResult
} from "./prompt-compiler.engine";

type JsonRecord = Record<string, unknown>;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

class PromptCompilerSourceError extends Error {
  constructor(readonly diagnostics: CompilerDiagnostic[]) {
    super("Prompt compiler source validation failed");
  }
}

@Injectable()
export class PromptCompilerRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PromptCompilerEngine
  ) {}

  async compile(workspaceId: string, actorId: string, dto: CompilePromptDto) {
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const input = await this.buildInput(tx, workspaceId, dto);
        const result = this.engine.compile(input);
        if (!result.valid) {
          await this.auditDiagnostics(tx, workspaceId, actorId, dto.promptId, result, true);
          return { ok: false as const, result };
        }
        const compiled = await tx.compiledPrompt.create({
          data: {
            workspaceId,
            createdById: actorId,
            promptId: dto.promptId,
            promptVersionId: dto.promptVersionId,
            agentVersionId: input.agentVersionId,
            agentRuntimeSnapshotId: dto.agentRuntimeSnapshotId,
            executionRequestId: this.string(input.execution.requestId),
            conversationId: this.string(input.conversation.id),
            compilerVersion: result.compilerVersion,
            compiledPackage: json(result.package),
            resolvedPrompt: json(result.resolvedPrompt),
            variableMap: json(result.variableMap),
            variableMetadata: json(result.variableMetadata),
            promptMetadata: json(input.promptMetadata),
            diagnostics: json(result.diagnostics),
            dependencyMap: json(result.dependencyMap),
            placeholders: result.placeholders,
            hash: result.hash,
            checksum: result.checksum,
            sizeBytes: result.sizeBytes,
            compiledAt: new Date(result.compiledAt)
          },
          select: this.compiledSelect
        });
        await this.audit(
          tx,
          workspaceId,
          actorId,
          "prompt.compiler.compiled",
          "CompiledPrompt",
          compiled.id,
          null,
          compiled
        );
        await this.auditDiagnostics(tx, workspaceId, actorId, compiled.id, result, false);
        return { ok: true as const, compiled };
      });
      if (!outcome.ok) this.throwCompilation(outcome.result);
      return outcome.compiled;
    } catch (error) {
      return this.handleSourceError(workspaceId, actorId, dto.promptId, error);
    }
  }

  async preview(workspaceId: string, actorId: string, dto: CompilePromptDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const input = await this.buildInput(tx, workspaceId, dto);
        const result = this.engine.compile(input);
        await this.audit(
          tx,
          workspaceId,
          actorId,
          "prompt.compiler.previewed",
          "PromptLibraryItem",
          dto.promptId,
          null,
          { valid: result.valid, hash: result.hash, diagnostics: result.diagnostics }
        );
        await this.auditDiagnostics(tx, workspaceId, actorId, dto.promptId, result, false);
        return result;
      });
    } catch (error) {
      return this.handleSourceError(workspaceId, actorId, dto.promptId, error);
    }
  }

  async validate(workspaceId: string, actorId: string, dto: CompilePromptDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const input = await this.buildInput(tx, workspaceId, dto);
        const result = this.engine.compile(input);
        await this.audit(
          tx,
          workspaceId,
          actorId,
          "prompt.compiler.validated",
          "PromptLibraryItem",
          dto.promptId,
          null,
          {
            valid: result.valid,
            diagnostics: result.diagnostics,
            placeholders: result.placeholders,
            dependencyMap: result.dependencyMap
          }
        );
        await this.auditDiagnostics(tx, workspaceId, actorId, dto.promptId, result, false);
        return {
          valid: result.valid,
          diagnostics: result.diagnostics,
          placeholders: result.placeholders,
          dependencyMap: result.dependencyMap,
          sizeBytes: result.sizeBytes,
          compilerVersion: result.compilerVersion,
          checksum: result.checksum
        };
      });
    } catch (error) {
      return this.handleSourceError(workspaceId, actorId, dto.promptId, error);
    }
  }

  get(workspaceId: string, id: string) {
    return this.requireCompiled(this.prisma, workspaceId, id);
  }

  async list(workspaceId: string, query: CompiledPromptListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.CompiledPromptWhereInput = {
      workspaceId,
      promptId: query.promptId,
      promptVersionId: query.promptVersionId,
      agentVersionId: query.agentVersionId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.compiledPrompt.findMany({
        where,
        orderBy: [{ compiledAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: this.compiledSelect
      }),
      this.prisma.compiledPrompt.count({ where })
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async compare(workspaceId: string, leftId: string, rightId: string) {
    const [left, right] = await this.prisma.$transaction([
      this.prisma.compiledPrompt.findFirst({
        where: { id: leftId, workspaceId },
        select: this.compiledSelect
      }),
      this.prisma.compiledPrompt.findFirst({
        where: { id: rightId, workspaceId },
        select: this.compiledSelect
      })
    ]);
    if (!left || !right) {
      throw new NotFoundException("One or more compiled prompts were not found in the active workspace");
    }
    const leftVariables = this.record(left.variableMap);
    const rightVariables = this.record(right.variableMap);
    const leftKeys = Object.keys(leftVariables);
    const rightKeys = Object.keys(rightVariables);
    const shared = leftKeys.filter((key) => rightKeys.includes(key));
    return {
      identical: left.hash === right.hash,
      left: this.comparisonIdentity(left),
      right: this.comparisonIdentity(right),
      versions: {
        promptChanged: left.promptVersionId !== right.promptVersionId,
        agentChanged: left.agentVersionId !== right.agentVersionId,
        compilerChanged: left.compilerVersion !== right.compilerVersion
      },
      variables: {
        added: rightKeys.filter((key) => !leftKeys.includes(key)).sort(),
        removed: leftKeys.filter((key) => !rightKeys.includes(key)).sort(),
        changed: shared.filter((key) =>
          this.stableStringify(leftVariables[key]) !== this.stableStringify(rightVariables[key])
        ).sort()
      },
      promptSectionsChanged: this.changedPromptSections(
        this.record(left.resolvedPrompt),
        this.record(right.resolvedPrompt)
      )
    };
  }

  private async buildInput(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    dto: CompilePromptDto
  ): Promise<PromptCompilerInput> {
    const workspace = await tx.workspace.findFirst({
      where: { id: workspaceId, status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        name: true,
        language: true,
        timezone: true,
        country: true,
        currency: true,
        status: true
      }
    });
    if (!workspace) this.sourceError("WORKSPACE_UNAVAILABLE", "workspaceId", "Active workspace was not found");
    const prompt = await tx.promptLibraryItem.findFirst({
      where: {
        id: dto.promptId,
        workspaceId,
        status: "PUBLISHED",
        deletedAt: null
      },
      select: { id: true, name: true, slug: true, revision: true, metadata: true }
    });
    if (!prompt) {
      this.sourceError("PROMPT_NOT_READY", "promptId", "Prompt must be published and belong to the active workspace");
    }
    const promptVersion = await tx.promptLibraryVersion.findFirst({
      where: {
        id: dto.promptVersionId,
        promptId: prompt.id,
        publishedAt: { not: null },
        prompt: { workspaceId }
      },
      select: {
        id: true,
        promptId: true,
        revision: true,
        snapshot: true,
        publishedAt: true
      }
    });
    const snapshot = promptVersion && this.recordOrNull(promptVersion.snapshot);
    if (!promptVersion || !snapshot) {
      this.sourceError("PROMPT_VERSION_INVALID", "promptVersionId", "Prompt version is unpublished, inconsistent, or invalid");
    }
    const draft = this.recordOrNull(snapshot.draft);
    const definitions = Array.isArray(snapshot.variables)
      ? snapshot.variables.map((value) => this.engine.definition(value)).filter((value) => value !== null)
      : null;
    if (!draft || !definitions || !this.recordOrNull(snapshot.metadata)) {
      this.sourceError("PROMPT_SNAPSHOT_INVALID", "promptVersionId", "Published prompt snapshot is incomplete");
    }

    let agentVersion: { id: string; revision: number; snapshot: Prisma.JsonValue } | null = null;
    if (dto.agentVersionId) {
      agentVersion = await tx.aiAgentVersion.findFirst({
        where: {
          id: dto.agentVersionId,
          agent: {
            workspaceId,
            status: "PUBLISHED",
            archivedAt: null,
            deletedAt: null
          }
        },
        select: { id: true, revision: true, snapshot: true }
      });
      if (!agentVersion) {
        this.sourceError("AGENT_VERSION_INVALID", "agentVersionId", "Agent version does not belong to a published workspace agent");
      }
    }

    let runtimeSnapshot: {
      id: string;
      agentVersionId: string;
      executionRequestId: string;
      conversationId: string | null;
      runtimeVariables: Prisma.JsonValue;
      runtimeMetadata: Prisma.JsonValue;
      runtimeContext: Prisma.JsonValue;
      promptReferences: Prisma.JsonValue;
      contentHash: string;
    } | null = null;
    if (dto.agentRuntimeSnapshotId) {
      runtimeSnapshot = await tx.agentRuntimeSnapshot.findFirst({
        where: { id: dto.agentRuntimeSnapshotId, workspaceId },
        select: {
          id: true,
          agentVersionId: true,
          executionRequestId: true,
          conversationId: true,
          runtimeVariables: true,
          runtimeMetadata: true,
          runtimeContext: true,
          promptReferences: true,
          contentHash: true
        }
      });
      if (!runtimeSnapshot) {
        this.sourceError("AGENT_RUNTIME_SNAPSHOT_INVALID", "agentRuntimeSnapshotId", "Agent Runtime snapshot does not belong to the active workspace");
      }
    }

    const sourceDiagnostics: CompilerDiagnostic[] = [];
    if (runtimeSnapshot && dto.agentVersionId && runtimeSnapshot.agentVersionId !== dto.agentVersionId) {
      sourceDiagnostics.push(this.diagnostic(
        "VERSION_MISMATCH",
        "agentVersionId",
        "Agent version does not match the selected Agent Runtime snapshot"
      ));
    }
    if (runtimeSnapshot && !this.runtimeContainsPrompt(
      runtimeSnapshot.promptReferences,
      dto.promptId,
      dto.promptVersionId
    )) {
      sourceDiagnostics.push(this.diagnostic(
        "VERSION_MISMATCH",
        "promptVersionId",
        "Prompt version does not match the selected Agent Runtime snapshot"
      ));
    }

    const executionRequestId = dto.executionRequestId ?? runtimeSnapshot?.executionRequestId;
    const executionRequest = executionRequestId
      ? await tx.executionRequest.findFirst({
          where: { id: executionRequestId, workspaceId },
          select: { id: true, correlationId: true, priority: true, metadata: true }
        })
      : null;
    if (executionRequestId && !executionRequest) {
      this.sourceError("EXECUTION_REFERENCE_INVALID", "executionRequestId", "Execution request does not belong to the active workspace");
    }
    const conversationId = dto.conversationId ?? runtimeSnapshot?.conversationId ?? undefined;
    const conversation = conversationId
      ? await tx.conversation.findFirst({
          where: { id: conversationId, workspaceId, deletedAt: null },
          select: {
            id: true,
            status: true,
            channel: true,
            language: true,
            totalMessages: true,
            totalTokens: true
          }
        })
      : null;
    if (conversationId && !conversation) {
      this.sourceError("CONVERSATION_REFERENCE_INVALID", "conversationId", "Conversation does not belong to the active workspace");
    }

    const contextVariables: CompilerVariableDto[] = [
      {
        name: "workspace",
        type: CompilerVariableType.OBJECT,
        source: CompilerVariableSource.WORKSPACE,
        value: { ...workspace, ...(dto.workspaceMetadata ?? {}) }
      },
      {
        name: "conversation",
        type: CompilerVariableType.OBJECT,
        source: CompilerVariableSource.CONVERSATION,
        value: { ...(conversation ?? {}), ...(dto.conversationMetadata ?? {}) }
      },
      {
        name: "execution",
        type: CompilerVariableType.OBJECT,
        source: CompilerVariableSource.EXECUTION_METADATA,
        value: { ...(executionRequest ?? {}), ...(dto.executionMetadata ?? {}) }
      },
      {
        name: "environment",
        type: CompilerVariableType.OBJECT,
        source: CompilerVariableSource.ENVIRONMENT,
        value: dto.environmentMetadata ?? {}
      },
      {
        name: "runtime",
        type: CompilerVariableType.OBJECT,
        source: CompilerVariableSource.AGENT_RUNTIME,
        value: {
          ...this.record(runtimeSnapshot?.runtimeContext),
          ...this.record(runtimeSnapshot?.runtimeMetadata),
          ...(dto.runtimeMetadata ?? {})
        }
      },
      ...this.runtimeVariables(runtimeSnapshot?.runtimeVariables),
      ...this.metadataVariables(executionRequest?.metadata)
    ];
    const sections = {
      systemPrompt: dto.sections?.systemPrompt ?? this.firstString(draft, ["systemPrompt", "system"]),
      developerPrompt: dto.sections?.developerPrompt ?? this.firstString(draft, ["developerPrompt", "developer"]),
      userPrompt: dto.sections?.userPrompt ?? this.firstString(draft, ["userPrompt", "user", "content", "template"])
    };
    const promptMetadata = {
      id: prompt.id,
      name: prompt.name,
      slug: prompt.slug,
      revision: prompt.revision,
      ...this.record(prompt.metadata),
      ...this.record(snapshot.metadata)
    };
    const checksumSource = {
      promptId: prompt.id,
      promptVersionId: promptVersion.id,
      promptRevision: promptVersion.revision,
      snapshot,
      agentVersionId: agentVersion?.id ?? runtimeSnapshot?.agentVersionId ?? null,
      agentSnapshot: agentVersion?.snapshot ?? null,
      runtimeSnapshotHash: runtimeSnapshot?.contentHash ?? null,
      sections,
      variables: dto.variables ?? []
    };
    return {
      promptId: prompt.id,
      promptVersionId: promptVersion.id,
      promptRevision: promptVersion.revision,
      agentVersionId: agentVersion?.id ?? runtimeSnapshot?.agentVersionId ?? null,
      agentRevision: agentVersion?.revision ?? null,
      workspaceId,
      sections,
      assistantHistory: dto.assistantHistory ?? [],
      metadataBlocks: dto.metadataBlocks ?? [],
      conditions: dto.conditions ?? [],
      variables: dto.variables ?? [],
      contextVariables,
      definitions,
      promptMetadata,
      workspaceMetadata: { ...workspace, ...(dto.workspaceMetadata ?? {}) },
      conversationMetadata: dto.conversationMetadata ?? {},
      runtimeMetadata: {
        ...this.record(runtimeSnapshot?.runtimeMetadata),
        ...(dto.runtimeMetadata ?? {})
      },
      executionMetadata: dto.executionMetadata ?? {},
      environmentMetadata: dto.environmentMetadata ?? {},
      execution: executionRequest
        ? { requestId: executionRequest.id, correlationId: executionRequest.correlationId }
        : {},
      conversation: conversation ? { id: conversation.id } : {},
      sourceChecksum: this.hash(checksumSource),
      maxPromptSizeBytes: dto.maxPromptSizeBytes ?? 100000,
      sourceDiagnostics
    };
  }

  private readonly compiledSelect = {
    id: true,
    workspaceId: true,
    createdById: true,
    promptId: true,
    promptVersionId: true,
    agentVersionId: true,
    agentRuntimeSnapshotId: true,
    executionRequestId: true,
    conversationId: true,
    compilerVersion: true,
    compiledPackage: true,
    resolvedPrompt: true,
    variableMap: true,
    variableMetadata: true,
    promptMetadata: true,
    diagnostics: true,
    dependencyMap: true,
    placeholders: true,
    hash: true,
    checksum: true,
    sizeBytes: true,
    compiledAt: true,
    createdAt: true
  } as const;

  private requireCompiled(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.compiledPrompt.findFirst({
      where: { id, workspaceId },
      select: this.compiledSelect
    }).then((compiled) => {
      if (!compiled) throw new NotFoundException("Compiled prompt was not found");
      return compiled;
    });
  }

  private runtimeVariables(value: unknown): CompilerVariableDto[] {
    const items: unknown[] = Array.isArray(value) ? value : [];
    return items.flatMap((item) => {
      const variable = this.recordOrNull(item);
      if (!variable || typeof variable.name !== "string") return [];
      return [{
        name: variable.name,
        type: this.compilerType(variable.type),
        source: CompilerVariableSource.AGENT_RUNTIME,
        value: variable.value
      }];
    });
  }

  private metadataVariables(value: unknown): CompilerVariableDto[] {
    const record = this.record(value);
    const items: unknown[] = Array.isArray(record.variables) ? record.variables : [];
    return items.flatMap((item) => {
      const variable = this.recordOrNull(item);
      if (!variable || typeof variable.name !== "string") return [];
      return [{
        name: variable.name,
        type: this.compilerType(variable.type),
        source: CompilerVariableSource.EXECUTION_METADATA,
        value: variable.value
      }];
    });
  }

  private compilerType(value: unknown): CompilerVariableType {
    const normalized = typeof value === "string" ? value.toUpperCase() : "JSON";
    if (normalized === "INTEGER" || normalized === "FLOAT") return CompilerVariableType.NUMBER;
    if (normalized === "ANY") return CompilerVariableType.JSON;
    return Object.values(CompilerVariableType).includes(normalized as CompilerVariableType)
      ? normalized as CompilerVariableType
      : CompilerVariableType.JSON;
  }

  private runtimeContainsPrompt(value: unknown, promptId: string, versionId: string): boolean {
    return Array.isArray(value) && value.some((item) => {
      const reference = this.recordOrNull(item);
      return reference?.promptId === promptId && reference.promptVersionId === versionId;
    });
  }

  private firstString(record: JsonRecord, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string") return value;
    }
    return undefined;
  }

  private changedPromptSections(left: JsonRecord, right: JsonRecord): string[] {
    const leftSections = this.record(left.sections);
    const rightSections = this.record(right.sections);
    return ["systemPrompt", "developerPrompt", "userPrompt", "assistantHistory"]
      .filter((key) => this.stableStringify(leftSections[key]) !== this.stableStringify(rightSections[key]));
  }

  private comparisonIdentity(value: {
    id: string;
    hash: string;
    checksum: string;
    promptVersionId: string;
    agentVersionId: string | null;
    compilerVersion: string;
    compiledAt: Date;
  }) {
    return {
      id: value.id,
      hash: value.hash,
      checksum: value.checksum,
      promptVersionId: value.promptVersionId,
      agentVersionId: value.agentVersionId,
      compilerVersion: value.compilerVersion,
      compiledAt: value.compiledAt
    };
  }

  private async auditDiagnostics(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    entityId: string,
    result: PromptCompilerResult,
    rejected: boolean
  ) {
    if (rejected) {
      await this.audit(tx, workspaceId, actorId, "prompt.compiler.rejected", "PromptLibraryItem", entityId, null, {
        diagnostics: result.diagnostics
      });
    }
    if (result.diagnostics.some(({ code }) => code.includes("VARIABLE") || code.includes("PLACEHOLDER"))) {
      await this.audit(tx, workspaceId, actorId, "prompt.compiler.variable_failed", "PromptLibraryItem", entityId, null, {
        diagnostics: result.diagnostics
      });
    }
    if (result.diagnostics.length) {
      await this.audit(tx, workspaceId, actorId, "prompt.compiler.diagnostics", "PromptLibraryItem", entityId, null, {
        valid: result.valid,
        diagnostics: result.diagnostics
      });
    }
  }

  private async handleSourceError(
    workspaceId: string,
    actorId: string,
    promptId: string,
    error: unknown
  ): Promise<never> {
    if (!(error instanceof PromptCompilerSourceError)) throw error;
    await this.prisma.$transaction(async (tx) => {
      await this.audit(tx, workspaceId, actorId, "prompt.compiler.rejected", "PromptLibraryItem", promptId, null, {
        diagnostics: error.diagnostics
      });
      await this.audit(tx, workspaceId, actorId, "prompt.compiler.diagnostics", "PromptLibraryItem", promptId, null, {
        valid: false,
        diagnostics: error.diagnostics
      });
    });
    throw new BadRequestException({
      message: error.message,
      diagnostics: error.diagnostics
    });
  }

  private throwCompilation(result: PromptCompilerResult): never {
    throw new BadRequestException({
      message: "Prompt compilation failed validation",
      diagnostics: result.diagnostics
    });
  }

  private sourceError(code: string, path: string, message: string): never {
    throw new PromptCompilerSourceError([this.diagnostic(code, path, message)]);
  }

  private diagnostic(code: string, path: string, message: string): CompilerDiagnostic {
    return { severity: "ERROR", code, path, message };
  }

  private record(value: unknown): JsonRecord {
    return this.recordOrNull(value) ?? {};
  }

  private recordOrNull(value: unknown): JsonRecord | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as JsonRecord
      : null;
  }

  private string(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private hash(value: unknown): string {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (this.recordOrNull(value)) {
      return `{${Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
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
