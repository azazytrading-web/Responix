import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { requireNormalizedCustomProviderName } from "./custom-provider-name";

@Injectable()
export class CustomProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDefinition(input: {
    workspaceId: string;
    displayName: string;
    protocolId: string;
    baseUrl: string;
    validationModelId: string;
    supportsStreaming?: boolean;
    supportsTools?: boolean;
    actorId?: string;
  }) {
    const normalizedName = requireNormalizedCustomProviderName(input.displayName);
    const { actorId, ...definition } = input;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const provider = await tx.customAiProvider.create({
          data: { ...definition, normalizedName, status: "DISABLED" },
          select: this.safeSelect
        });
        if (actorId) await this.audit(tx, input.workspaceId, actorId, "ai.custom-provider.created", provider.id, null, provider);
        return provider;
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) throw new ConflictException("A Custom Provider with this name already exists in this workspace");
      throw error;
    }
  }

  async list(workspaceId: string) {
    return this.prisma.customAiProvider.findMany({
      where: { workspaceId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: this.safeSelect
    });
  }

  async get(workspaceId: string, id: string) {
    const value = await this.prisma.customAiProvider.findFirst({ where: { id, workspaceId }, select: this.safeSelect });
    if (!value) throw new NotFoundException("Custom Provider was not found");
    return value;
  }

  async updateDefinition(input: {
    workspaceId: string; actorId: string; id: string;
    data: { displayName?: string; normalizedName?: string; baseUrl?: string; validationModelId?: string; supportsStreaming?: boolean; supportsTools?: boolean };
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.customAiProvider.findFirst({ where: { id: input.id, workspaceId: input.workspaceId }, select: this.safeSelect });
        if (!before || before.status === "ARCHIVED") throw new NotFoundException("Custom Provider was not found");
        const after = await tx.customAiProvider.update({ where: { id: input.id, workspaceId: input.workspaceId }, data: input.data, select: this.safeSelect });
        await this.audit(tx, input.workspaceId, input.actorId, "ai.custom-provider.updated", input.id, before, after);
        if (before.baseUrl !== after.baseUrl) await this.audit(tx, input.workspaceId, input.actorId, "ai.custom-provider.destination.changed", input.id, { baseUrl: before.baseUrl }, { baseUrl: after.baseUrl });
        return after;
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) throw new ConflictException("A Custom Provider with this name already exists in this workspace");
      throw error;
    }
  }

  async transition(input: { workspaceId: string; actorId: string; id: string; action: "enable" | "disable" | "archive" | "restore" }) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.customAiProvider.findFirst({ where: { id: input.id, workspaceId: input.workspaceId }, select: this.safeSelect });
      if (!before) throw new NotFoundException("Custom Provider was not found");
      const status = input.action === "enable" ? "ACTIVE" : input.action === "disable" ? "DISABLED" : input.action === "archive" ? "ARCHIVED" : "DISABLED";
      if (input.action === "enable" && before.status === "ARCHIVED") throw new ConflictException("Archived Custom Providers cannot be enabled");
      if (input.action === "disable" && before.status === "ARCHIVED") throw new ConflictException("Archived Custom Providers cannot be disabled");
      if (input.action === "restore" && before.status !== "ARCHIVED") throw new ConflictException("Custom Provider is not archived");
      if (input.action === "archive" && before.status === "ARCHIVED") return before;
      const after = await tx.customAiProvider.update({
        where: { id: input.id, workspaceId: input.workspaceId },
        data: { status, archivedAt: input.action === "archive" ? new Date() : null },
        select: this.safeSelect
      });
      await this.audit(tx, input.workspaceId, input.actorId, `ai.custom-provider.${input.action}d`, input.id, before, after);
      return after;
    });
  }

  async rename(workspaceId: string, id: string, displayName: string) {
    const normalizedName = requireNormalizedCustomProviderName(displayName);
    try {
      return await this.prisma.customAiProvider.update({
        where: { id, workspaceId },
        data: { displayName, normalizedName },
        select: { id: true, workspaceId: true, displayName: true, normalizedName: true }
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) throw new ConflictException("A Custom Provider with this name already exists in this workspace");
      throw error;
    }
  }

  findActiveDefinition(workspaceId: string, id: string) {
    return this.prisma.customAiProvider.findFirst({
      where: { id, workspaceId, status: "ACTIVE" },
      select: {
        id: true,
        workspaceId: true,
        displayName: true,
        normalizedName: true,
        protocolId: true,
        baseUrl: true,
        validationModelId: true,
        status: true
      }
    });
  }

  private isUniqueConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }

  async auditEvent(workspaceId: string, actorId: string, action: string, entityId: string, values: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: {
      workspaceId, userId: actorId, action, entityType: "CustomAiProvider", entityId,
      oldValues: Prisma.JsonNull, newValues: values as Prisma.InputJsonValue
    } });
  }

  private readonly safeSelect = {
    id: true, workspaceId: true, displayName: true, normalizedName: true, protocolId: true,
    baseUrl: true, validationModelId: true, supportsStreaming: true, supportsTools: true,
    status: true, archivedAt: true, createdAt: true, updatedAt: true
  } as const;

  private async audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    const safe = (value: unknown) => value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
    await tx.auditLog.create({ data: {
      workspaceId, userId: actorId, action, entityType: "CustomAiProvider", entityId,
      oldValues: safe(oldValue), newValues: safe(newValue)
    } });
  }
}
