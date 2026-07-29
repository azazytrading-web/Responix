/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  ConversationRuntimeMessageRole,
  ConversationRuntimeParticipantType,
  ConversationRuntimeStateType
} from "@prisma/client";
import type { PrepareConversationRuntimeDto } from "./dto/conversation-runtime.dto";
import { ConversationVariableType } from "./dto/conversation-runtime.dto";
import { ConversationRuntimeRepository } from "./conversation-runtime.repository";
import { ConversationRuntimeValidator } from "./conversation-runtime.validator";

const now = new Date("2026-07-28T00:00:00.000Z");
const dto = (overrides: Partial<PrepareConversationRuntimeDto> = {}): PrepareConversationRuntimeDto => ({
  name: "Support Conversation",
  compatibilityVersion: "1.0.0",
  sourceConversationId: "conversation",
  initialState: ConversationRuntimeStateType.READY,
  contexts: [{ contextKey: "primary", correlationId: "correlation" }],
  participants: [{
    participantKey: "system", type: ConversationRuntimeParticipantType.SYSTEM
  }],
  messages: [{
    messageIdentifier: "message", ordinal: 0,
    role: ConversationRuntimeMessageRole.SYSTEM, participantKey: "system", contentHash: "hash"
  }],
  variables: [{ name: "customer_name", type: ConversationVariableType.STRING, value: "Ada" }],
  ...overrides
});

describe("ConversationRuntimeRepository", () => {
  let stored: Record<string, unknown> | null;
  let createSequence: number;
  const prisma = {
    conversation: { findFirst: jest.fn() },
    agentRuntimeSnapshot: { findFirst: jest.fn() },
    retrievalRuntimeSnapshot: { findFirst: jest.fn() },
    compiledPrompt: { findFirst: jest.fn() },
    providerRequestSnapshot: { findFirst: jest.fn() },
    executionRequest: { findFirst: jest.fn() },
    executionRun: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn() },
    workspaceMembership: { findFirst: jest.fn() },
    aiAgent: { findFirst: jest.fn() },
    conversationRuntime: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn()
    },
    conversationRuntimeState: { update: jest.fn() },
    conversationRuntimeSnapshot: {
      create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn()
    },
    conversationRuntimeVersion: { create: jest.fn(), findFirst: jest.fn() },
    conversationRuntimeAuditMetadata: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new ConversationRuntimeRepository(prisma as never, new ConversationRuntimeValidator());

  beforeEach(() => {
    jest.clearAllMocks();
    stored = null;
    createSequence = 0;
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      const before = stored;
      try {
        return await (input as (tx: typeof prisma) => Promise<unknown>)(prisma);
      } catch (error) {
        stored = before;
        throw error;
      }
    });
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation", channel: "WEB", status: "OPEN", language: "en"
    });
    prisma.agentRuntimeSnapshot.findFirst.mockResolvedValue({ id: "agent-snapshot" });
    prisma.retrievalRuntimeSnapshot.findFirst.mockResolvedValue({ id: "retrieval-snapshot" });
    prisma.compiledPrompt.findFirst.mockResolvedValue({ id: "compiled" });
    prisma.providerRequestSnapshot.findFirst.mockResolvedValue({ id: "provider-snapshot" });
    prisma.executionRequest.findFirst.mockResolvedValue({ id: "request" });
    prisma.executionRun.findFirst.mockResolvedValue({ id: "run" });
    prisma.customer.findFirst.mockResolvedValue({ id: "customer" });
    prisma.workspaceMembership.findFirst.mockResolvedValue({ userId: "user" });
    prisma.aiAgent.findFirst.mockResolvedValue({ id: "agent" });
    prisma.conversationRuntime.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        createSequence += 1;
        stored = {
          id: `runtime-${createSequence}`, ...data, status: "DRAFT", revision: 0,
          publishedAt: null, archivedAt: null, deletedAt: null, createdAt: now, updatedAt: now,
          contexts: [], variables: [], messages: [], participants: [], attachments: [],
          labels: [], tags: [], notes: [], settings: {},
          state: { state: "READY", sequence: 0, metadata: {} },
          versions: [], auditMetadata: []
        };
        return Promise.resolve(stored);
      }
    );
    prisma.conversationRuntime.findFirst.mockImplementation(() => Promise.resolve(stored));
    prisma.conversationRuntime.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        stored = { ...stored, ...data, updatedAt: now };
        return Promise.resolve(stored);
      }
    );
    prisma.conversationRuntime.findMany.mockResolvedValue([]);
    prisma.conversationRuntime.count.mockResolvedValue(0);
    prisma.conversationRuntimeState.update.mockResolvedValue({});
    prisma.conversationRuntimeSnapshot.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        id: `snapshot-${String(data.revision)}`, ...data, createdAt: now
      })
    );
    prisma.conversationRuntimeSnapshot.findMany.mockResolvedValue([]);
    prisma.conversationRuntimeSnapshot.count.mockResolvedValue(0);
    prisma.conversationRuntimeVersion.create.mockResolvedValue({});
    prisma.conversationRuntimeVersion.findFirst.mockResolvedValue({
      id: "version-1", revision: 1, compatibilityVersion: "1.0.0",
      snapshot: { input: dto(), state: { state: "READY", sequence: 0, metadata: {} } },
      packageHash: "old-hash", checksum: "old-checksum"
    });
    prisma.conversationRuntimeAuditMetadata.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("transactionally persists normalized metadata and both audit forms", async () => {
    const result = await repository.prepare("workspace", "actor", dto());
    expect(result).toMatchObject({ id: "runtime-1", workspaceId: "workspace", status: "DRAFT" });
    expect(result.packageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.conversationRuntime.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        messages: expect.objectContaining({ create: expect.arrayContaining([
          expect.objectContaining({ messageIdentifier: "message", contentHash: "hash" })
        ]) }),
        variables: expect.objectContaining({ create: expect.arrayContaining([
          expect.objectContaining({ name: "customer_name" })
        ]) })
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.conversationRuntimeAuditMetadata.create).toHaveBeenCalled();
  });

  it("rejects cross-workspace source and runtime references transactionally", async () => {
    prisma.conversation.findFirst.mockResolvedValueOnce(null);
    await expect(repository.prepare("other-workspace", "actor", dto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.conversationRuntime.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "conversation.runtime.rejected" })
    }));
  });

  it("validates published participant and context references", async () => {
    prisma.aiAgent.findFirst.mockResolvedValueOnce(null);
    prisma.compiledPrompt.findFirst.mockResolvedValueOnce(null);
    await expect(repository.prepare("workspace", "actor", dto({
      participants: [{
        participantKey: "agent",
        type: ConversationRuntimeParticipantType.AGENT,
        referenceId: "11111111-1111-4111-8111-111111111111"
      }],
      contexts: [{
        contextKey: "primary",
        compiledPromptId: "22222222-2222-4222-8222-222222222222"
      }],
      messages: []
    }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("publishes immutable snapshot and version records in one transaction", async () => {
    await repository.prepare("workspace", "actor", dto());
    const snapshot = await repository.publish("workspace", "actor", "runtime-1");
    expect(snapshot).toMatchObject({ revision: 1 });
    expect(prisma.conversationRuntimeSnapshot.create).toHaveBeenCalled();
    expect(prisma.conversationRuntimeVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 1 })
    }));
    expect("update" in prisma.conversationRuntimeSnapshot).toBe(false);
  });

  it("rolls back by creating a new published revision", async () => {
    await repository.prepare("workspace", "actor", dto());
    stored = { ...stored, revision: 2, status: "PUBLISHED" };
    const snapshot = await repository.rollback("workspace", "actor", "runtime-1", "version-1");
    expect(snapshot).toMatchObject({ revision: 3, packageHash: "old-hash" });
    expect(prisma.conversationRuntimeVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 3, sourceRevision: 1 })
    }));
    expect(prisma.conversationRuntimeState.update).toHaveBeenCalled();
  });

  it("clones all metadata with fresh runtime and nested identities", async () => {
    const original = await repository.prepare("workspace", "actor", dto());
    const clone = await repository.clone("workspace", "actor", original.id, { name: "Clone" });
    expect(clone).toMatchObject({
      id: "runtime-2", name: "Clone", clonedFromId: "runtime-1", status: "DRAFT"
    });
    expect(clone.id).not.toBe(original.id);
  });

  it("enforces state transitions and persists normalized state hashes", async () => {
    await repository.prepare("workspace", "actor", dto());
    await expect(repository.transition("workspace", "actor", "runtime-1", {
      state: ConversationRuntimeStateType.ACTIVE
    })).resolves.toMatchObject({ packageHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(prisma.conversationRuntimeState.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: "ACTIVE", sequence: 1 })
    }));
    stored = { ...stored, state: { state: "CLOSED", sequence: 2, metadata: {} } };
    await expect(repository.transition("workspace", "actor", "runtime-1", {
      state: ConversationRuntimeStateType.ACTIVE
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("archives, restores, and soft deletes without removing history", async () => {
    await repository.prepare("workspace", "actor", dto());
    await repository.publish("workspace", "actor", "runtime-1");
    await expect(repository.archive("workspace", "actor", "runtime-1"))
      .resolves.toMatchObject({ status: "ARCHIVED" });
    await expect(repository.restore("workspace", "actor", "runtime-1"))
      .resolves.toMatchObject({ status: "PUBLISHED" });
    await expect(repository.softDelete("workspace", "actor", "runtime-1"))
      .resolves.toMatchObject({ status: "DELETED" });
    expect(prisma.conversationRuntimeSnapshot.create).toHaveBeenCalledTimes(1);
  });

  it("rolls back all persistence when audit creation fails", async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(repository.prepare("workspace", "actor", dto())).rejects.toThrow("audit failed");
    expect(stored).toBeNull();
  });

  it("enforces workspace isolation and soft-delete visibility", async () => {
    stored = null;
    prisma.conversationRuntimeSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.get("other-workspace", "runtime")).rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.getSnapshot("other-workspace", "snapshot"))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversationRuntime.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "runtime", workspaceId: "other-workspace", deletedAt: null }
    }));
  });

  it("supports workspace filtering and pagination", async () => {
    await repository.list("workspace", {
      page: 2, limit: 10, status: "PUBLISHED", sourceConversationId: "conversation", search: "support"
    });
    await repository.listSnapshots("workspace", { page: 3, limit: 5, runtimeId: "runtime" });
    expect(prisma.conversationRuntime.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", sourceConversationId: "conversation" }),
      skip: 10, take: 10
    }));
    expect(prisma.conversationRuntimeSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace", runtimeId: "runtime" }, skip: 10, take: 5
    }));
  });

  it("compares snapshot integrity and rejects missing snapshots", async () => {
    const snapshot = {
      id: "left", workspaceId: "workspace", runtimeId: "runtime", revision: 1,
      createdById: "actor", compatibilityVersion: "1.0.0",
      snapshot: { contexts: [], variables: [], messages: [], participants: [], attachments: [] },
      packageHash: "hash", checksum: "checksum", createdAt: now
    };
    prisma.conversationRuntimeSnapshot.findFirst
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ ...snapshot, id: "right", revision: 2 });
    await expect(repository.compare("workspace", "left", "right"))
      .resolves.toMatchObject({ identical: true });
    prisma.conversationRuntimeSnapshot.findFirst.mockResolvedValue(null);
    await expect(repository.compare("workspace", "left", "missing"))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
