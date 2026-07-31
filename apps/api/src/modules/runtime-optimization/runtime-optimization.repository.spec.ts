/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException, NotFoundException } from "@nestjs/common";
import { RuntimeOptimizationRepository } from "./runtime-optimization.repository";
import { RuntimeOptimizationValidator } from "./runtime-optimization.validator";
import { createHash } from "node:crypto";

const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` :
  value && typeof value === "object" ? `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}` :
    JSON.stringify(value);
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");

describe("RuntimeOptimizationRepository", () => {
  const metric = {
    version: 0, reuseCount: 0, totalLifetimeMs: 0n
  };
  const payload = { prompt: "Hello" }; const packageHash = hash(payload);
  const record = {
    id: "package", workspaceId: "workspace", type: "COMPILED_PROMPT",
    status: "ACTIVE", createdAt: new Date(), metric, payload, packageHash,
    checksum: hash({ packageHash, workspaceId: "workspace", type: "COMPILED_PROMPT" })
  };
  const setup = () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
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
        findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue(record),
        findUniqueOrThrow: jest.fn().mockResolvedValue(record),
        create: jest.fn().mockResolvedValue(record)
      },
      runtimeOptimizationMetric: { updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}) },
      runtimeOptimizationProviderOutcome: { create: jest.fn().mockResolvedValue({ id: "outcome" }) },
      aiModel: { findFirst: jest.fn().mockResolvedValue({ id: "model" }) },
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
      data: expect.objectContaining({ type: "COMPILED_PROMPT",
        metric: { create: { cacheMisses: 1, compileTimeMs: 0 } } })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "runtime.optimization.created" })
    }));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it("reuses identical hashes and increments optimistic metrics", async () => {
    const { repository, tx } = setup();
    tx.runtimeOptimizationPackage.findFirst.mockResolvedValue(record);
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
    tx.runtimeOptimizationPackage.findFirst.mockResolvedValue(record);
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
  it("invalidates a prior scope revision when a source hash changes", async () => {
    const { repository, tx } = setup();
    tx.runtimeOptimizationPackage.findMany.mockResolvedValue([{ id: "old" }]);
    await repository.cacheImmutable("workspace", "actor", { type: "WORKFLOW_PACKAGE",
      scopeKey: "workflow:one", sourceHash: "d".repeat(64), payload: { nodes: [] }, revision: 2 });
    expect(tx.runtimeOptimizationPackage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["old"] } }),
      data: expect.objectContaining({ status: "INVALIDATED", invalidationReason: "Source hash changed" })
    }));
    expect(tx.runtimeOptimizationPackage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revision: 2, scopeKey: "workflow:one" })
    }));
  });
  it("records native provider hits and internal fallback misses transactionally", async () => {
    const { repository, tx } = setup();
    tx.runtimeOptimizationPackage.findFirst.mockResolvedValue(record);
    await repository.recordProviderOutcome("workspace", "actor", { packageId: "package",
      providerId: "provider", modelId: "model", nativeSupported: true, cachedTokens: 20 });
    expect(tx.runtimeOptimizationProviderOutcome.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cacheHit: true, cachedTokens: 20, nativeSupported: true })
    }));
    expect(tx.runtimeOptimizationMetric.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerCacheHits: { increment: 1 } })
    }));
  });
  it("invalidates with optimistic locking and append-only audit", async () => {
    const { repository, tx } = setup();
    tx.runtimeOptimizationPackage.findFirst.mockResolvedValue({ ...record, version: 1 });
    await repository.invalidate("workspace", "actor", "package", "rollback");
    expect(tx.runtimeOptimizationPackage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", version: 1 }),
      data: expect.objectContaining({ invalidationReason: "rollback", version: { increment: 1 } })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "runtime.optimization.invalidated" })
    }));
  });
});
