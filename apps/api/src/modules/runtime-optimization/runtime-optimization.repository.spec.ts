/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException, NotFoundException } from "@nestjs/common";
import { RuntimeOptimizationRepository } from "./runtime-optimization.repository";
import { RuntimeOptimizationValidator } from "./runtime-optimization.validator";

describe("RuntimeOptimizationRepository", () => {
  const metric = {
    version: 0, reuseCount: 0, totalLifetimeMs: 0n
  };
  const record = {
    id: "package", workspaceId: "workspace", type: "COMPILED_PROMPT",
    createdAt: new Date(), metric, packageHash: "hash"
  };
  const setup = () => {
    const tx = {
      compiledPrompt: { findFirst: jest.fn().mockResolvedValue({
        id: "compiled", hash: "a".repeat(64), checksum: "checksum",
        compiledPackage: { prompt: "Hello" }, resolvedPrompt: {
          orderedMessages: [
            { role: "SYSTEM", content: "Brand {{brand}}" },
            { role: "USER", content: "Private {{user.message}}" }
          ]
        }, variableMetadata: [], promptVersionId: "version", sizeBytes: 100
      }) },
      retrievalRuntimeSnapshot: { findFirst: jest.fn().mockResolvedValue({
        id: "retrieval", runtimeId: "runtime", revision: 1,
        retrievalPackage: { filters: [] }, packageHash: "b".repeat(64), checksum: "c"
      }) },
      runtimeOptimizationPackage: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(record),
        create: jest.fn().mockResolvedValue(record)
      },
      runtimeOptimizationMetric: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      workspace: { findFirst: jest.fn() },
      agentRuntimeSnapshot: { findFirst: jest.fn() },
      providerRequestSnapshot: { findFirst: jest.fn() },
      conversationRuntimeSnapshot: { findFirst: jest.fn() },
      executionPipelineSnapshot: { findFirst: jest.fn() },
      executionProfileVersion: { findFirst: jest.fn() }
    };
    const prisma = {
      $transaction: jest.fn((input: unknown) => typeof input === "function"
        ? (input as (client: typeof tx) => unknown)(tx)
        : Promise.resolve([[], 0])),
      runtimeOptimizationPackage: {
        findFirst: jest.fn().mockResolvedValue(record), findMany: jest.fn(), count: jest.fn()
      }
    };
    return {
      repository: new RuntimeOptimizationRepository(
        prisma as never, new RuntimeOptimizationValidator()
      ), prisma, tx
    };
  };
  it("creates an immutable compiled prompt cache miss with audit", async () => {
    const { repository, tx } = setup();
    await repository.cacheCompiled("workspace", "actor", "compiled");
    expect(tx.runtimeOptimizationPackage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "COMPILED_PROMPT", metric: { create: { cacheMisses: 1 } } })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "runtime.optimization.created" })
    }));
  });
  it("reuses identical hashes and increments optimistic metrics", async () => {
    const { repository, tx } = setup();
    tx.runtimeOptimizationPackage.findUnique.mockResolvedValue(record);
    await repository.cacheCompiled("workspace", "actor", "compiled");
    expect(tx.runtimeOptimizationPackage.create).not.toHaveBeenCalled();
    expect(tx.runtimeOptimizationMetric.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { packageId: "package", version: 0 },
        data: expect.objectContaining({ cacheHits: { increment: 1 }, reuseCount: { increment: 1 } })
      })
    );
  });
  it("rejects an optimistic metric conflict", async () => {
    const { repository, tx } = setup();
    tx.runtimeOptimizationPackage.findUnique.mockResolvedValue(record);
    tx.runtimeOptimizationMetric.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.cacheCompiled("workspace", "actor", "compiled"))
      .rejects.toBeInstanceOf(ConflictException);
  });
  it("never caches user messages in deterministic rendered packages", async () => {
    const { repository, tx } = setup();
    await repository.cacheRendered("workspace", "actor", {
      compiledPromptId: "compiled", staticVariables: { brand: "Responix" }
    });
    const data = tx.runtimeOptimizationPackage.create.mock.calls[0]?.[0].data;
    expect(JSON.stringify(data.payload)).toContain("Brand Responix");
    expect(JSON.stringify(data.payload)).not.toContain("Private");
  });
  it("creates query-independent retrieval packages", async () => {
    const { repository, tx } = setup();
    await repository.cacheRetrieval("workspace", "actor", {
      retrievalRuntimeSnapshotId: "retrieval", languages: ["en"],
      searchConfiguration: { limit: 10 }
    });
    expect(tx.runtimeOptimizationPackage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "RETRIEVAL_RUNTIME" })
    }));
  });
  it("isolates package reads by workspace", async () => {
    const { repository, prisma } = setup();
    await repository.get("workspace", "package");
    expect(prisma.runtimeOptimizationPackage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "package", workspaceId: "workspace" } })
    );
    prisma.runtimeOptimizationPackage.findFirst.mockResolvedValue(null);
    await expect(repository.get("other", "package")).rejects.toBeInstanceOf(NotFoundException);
  });
  it("paginates and filters immutable package history", async () => {
    const { repository, prisma } = setup();
    await repository.list("workspace", {
      page: 2, limit: 10, type: "RUNTIME_CONTEXT"
    });
    expect(prisma.runtimeOptimizationPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
  it("rolls back creation when append-only audit fails", async () => {
    const { repository, tx } = setup();
    tx.auditLog.create.mockRejectedValue(new Error("audit failed"));
    await expect(repository.cacheCompiled("workspace", "actor", "compiled"))
      .rejects.toThrow("audit failed");
  });
});
