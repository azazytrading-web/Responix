import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConversationRuntimeStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  PromptExecutionListQueryDto, RenderPromptExecutionDto
} from "./dto/prompt-execution.dto";
import {
  PromptExecutionEngine, type PromptExecutionResult, type PromptExecutionSource
} from "./prompt-execution.engine";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class PromptExecutionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PromptExecutionEngine
  ) {}

  async render(workspaceId: string, actorId: string, dto: RenderPromptExecutionDto) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const source = await this.requireCompiledPrompt(tx, workspaceId, dto.compiledPromptId);
      const diagnostics = await this.validateReferences(tx, workspaceId, dto);
      const result = this.engine.render(source, dto);
      result.diagnostics.push(...diagnostics);
      result.valid = !result.diagnostics.some(({ severity }) => severity === "ERROR");
      if (!result.valid) {
        await this.audit(tx, workspaceId, actorId, "prompt.execution.rejected",
          "CompiledPrompt", source.id, null, result);
        return { ok: false as const, result };
      }
      const payload = await tx.promptExecutionPayload.create({
        data: {
          workspaceId, createdById: actorId, compiledPromptId: source.id,
          agentRuntimeSnapshotId: dto.agentRuntimeSnapshotId,
          conversationRuntimeSnapshotId: dto.conversationRuntimeSnapshotId,
          providerRuntimeSnapshotId: dto.providerRuntimeSnapshotId,
          executionPipelineSnapshotId: dto.executionPipelineSnapshotId,
          executionRequestId: dto.executionRequestId, executionRunId: dto.executionRunId,
          rendererVersion: PromptExecutionEngine.VERSION,
          messages: json(result.messages), resolvedVariables: json(result.resolvedVariables),
          contextMetadata: json(dto.runtimeMetadata ?? {}),
          executionPayload: json(result.payload), promptHash: result.promptHash,
          payloadHash: result.payloadHash, checksum: result.checksum,
          diagnostics: {
            create: result.diagnostics.map((diagnostic) => ({
              ...diagnostic, metadata: json({})
            }))
          }
        },
        select: this.payloadSelect
      });
      await this.audit(tx, workspaceId, actorId, "prompt.execution.rendered",
        "PromptExecutionPayload", payload.id, null, {
          compiledPromptId: source.id, payloadHash: result.payloadHash,
          diagnosticCount: result.diagnostics.length
        });
      return { ok: true as const, payload };
    });
    if (!outcome.ok) this.throwValidation(outcome.result);
    return outcome.payload;
  }

  async validate(workspaceId: string, actorId: string, dto: RenderPromptExecutionDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const source = await this.requireCompiledPrompt(tx, workspaceId, dto.compiledPromptId);
      const validation = this.engine.render(source, dto);
      validation.diagnostics.push(...await this.validateReferences(tx, workspaceId, dto));
      validation.valid = !validation.diagnostics.some(({ severity }) => severity === "ERROR");
      await this.audit(tx, workspaceId, actorId,
        validation.valid ? "prompt.execution.validated" : "prompt.execution.validation_failed",
        "CompiledPrompt", source.id, null, validation);
      return validation;
    });
    if (!result.valid) this.throwValidation(result);
    return result;
  }

  get(workspaceId: string, id: string) {
    return this.prisma.promptExecutionPayload.findFirst({
      where: { id, workspaceId }, select: this.payloadSelect
    }).then((value) => {
      if (!value) throw new NotFoundException("Prompt execution payload was not found");
      return value;
    });
  }

  async list(workspaceId: string, query: PromptExecutionListQueryDto) {
    const page = query.page ?? 1; const limit = query.limit ?? 25;
    const where: Prisma.PromptExecutionPayloadWhereInput = {
      workspaceId, compiledPromptId: query.compiledPromptId,
      executionRequestId: query.executionRequestId
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.promptExecutionPayload.findMany({
        where, select: this.payloadSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit, take: limit
      }),
      this.prisma.promptExecutionPayload.count({ where })
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async validateReferences(
    tx: Prisma.TransactionClient, workspaceId: string, dto: RenderPromptExecutionDto
  ) {
    const diagnostics: PromptExecutionResult["diagnostics"] = [];
    const check = async (
      value: string | undefined, path: string,
      lookup: () => Promise<{ id: string } | null>
    ) => {
      if (value && !await lookup()) diagnostics.push({
        severity: "ERROR", code: "REFERENCE_INVALID", path,
        message: `${path} was not found in the active workspace`
      });
    };
    await check(dto.agentRuntimeSnapshotId, "agentRuntimeSnapshotId", () =>
      tx.agentRuntimeSnapshot.findFirst({
        where: { id: dto.agentRuntimeSnapshotId, workspaceId }, select: { id: true }
      }));
    await check(dto.conversationRuntimeSnapshotId, "conversationRuntimeSnapshotId", () =>
      tx.conversationRuntimeSnapshot.findFirst({
        where: {
          id: dto.conversationRuntimeSnapshotId, workspaceId,
          runtime: {
            status: ConversationRuntimeStatus.PUBLISHED, archivedAt: null, deletedAt: null
          }
        }, select: { id: true }
      }));
    await check(dto.providerRuntimeSnapshotId, "providerRuntimeSnapshotId", () =>
      tx.providerRequestSnapshot.findFirst({
        where: { id: dto.providerRuntimeSnapshotId, workspaceId }, select: { id: true }
      }));
    await check(dto.executionPipelineSnapshotId, "executionPipelineSnapshotId", () =>
      tx.executionPipelineSnapshot.findFirst({
        where: { id: dto.executionPipelineSnapshotId, workspaceId }, select: { id: true }
      }));
    await check(dto.executionRequestId, "executionRequestId", () =>
      tx.executionRequest.findFirst({
        where: { id: dto.executionRequestId, workspaceId }, select: { id: true }
      }));
    await check(dto.executionRunId, "executionRunId", () =>
      tx.executionRun.findFirst({
        where: {
          id: dto.executionRunId, workspaceId,
          ...(dto.executionRequestId ? { requestId: dto.executionRequestId } : {})
        }, select: { id: true }
      }));
    return diagnostics;
  }

  private requireCompiledPrompt(
    client: Prisma.TransactionClient | PrismaService, workspaceId: string, id: string
  ): Promise<PromptExecutionSource> {
    return client.compiledPrompt.findFirst({
      where: { id, workspaceId },
      select: {
        id: true, workspaceId: true, hash: true, checksum: true, compilerVersion: true,
        compiledPackage: true, resolvedPrompt: true, variableMap: true,
        variableMetadata: true, placeholders: true
      }
    }).then((value) => {
      if (!value) throw new NotFoundException("Compiled Prompt was not found");
      return value;
    });
  }
  private readonly payloadSelect = {
    id: true, workspaceId: true, createdById: true, compiledPromptId: true,
    agentRuntimeSnapshotId: true, conversationRuntimeSnapshotId: true,
    providerRuntimeSnapshotId: true, executionPipelineSnapshotId: true,
    executionRequestId: true, executionRunId: true, rendererVersion: true,
    messages: true, resolvedVariables: true, contextMetadata: true,
    executionPayload: true, promptHash: true, payloadHash: true, checksum: true,
    createdAt: true, diagnostics: true
  } as const;
  private throwValidation(result: PromptExecutionResult): never {
    throw new BadRequestException({
      message: "Prompt execution validation failed", diagnostics: result.diagnostics
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
