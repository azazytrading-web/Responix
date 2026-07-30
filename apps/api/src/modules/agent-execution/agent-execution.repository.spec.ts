/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from "@nestjs/common";
import { AgentExecutionRepository } from "./agent-execution.repository";

describe("AgentExecutionRepository", () => {
  const dto = {
    agentRuntimeSnapshotId: "agent", promptExecutionPayloadId: "prompt",
    providerRuntimeSnapshotId: "provider", conversationRuntimeSnapshotId: "conversation",
    executionPipelineSnapshotId: "pipeline", correlationId: "correlation",
    idempotencyKey: "key", metadata: { source: "test" }
  };
  const assets = {
    agent: { id: "agent", contentHash: "a" },
    prompt: { id: "prompt", payloadHash: "p" },
    provider: { id: "provider", requestHash: "r" },
    conversation: { id: "conversation", packageHash: "c" },
    pipeline: { id: "pipeline", planHash: "e" }
  };
  const setup = () => {
    const created = {
      id: "orchestration", status: "READY", executionRunId: "run", planHash: "hash"
    };
    const tx = {
      agentExecutionOrchestration: {
        create: jest.fn().mockResolvedValue(created),
        findFirst: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockResolvedValue({ ...created, status: "CANCELLED" })
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      $transaction: jest.fn((argument: unknown) =>
        typeof argument === "function"
          ? (argument as (client: typeof tx) => unknown)(tx)
          : Promise.resolve([{ id: "one" }, 1])),
      agentExecutionOrchestration: {
        findFirst: jest.fn().mockResolvedValue(created),
        findMany: jest.fn(), count: jest.fn()
      }
    };
    return { repository: new AgentExecutionRepository(prisma as never), prisma, tx, created };
  };
  it("persists an immutable ready plan and transactional audit", async () => {
    const { repository, tx } = setup();
    await repository.persist("workspace", "actor", "request", "run", dto, assets, []);
    expect(tx.agentExecutionOrchestration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "READY", executionRequestId: "request" })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "agent.execution.ready" })
    }));
  });
  it("persists failed diagnostics transactionally", async () => {
    const { repository, tx } = setup();
    await repository.persist("workspace", "actor", "request", "run", dto, assets, [{
      severity: "ERROR", code: "INVALID", path: "asset", message: "invalid"
    }]);
    expect(tx.agentExecutionOrchestration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED", failedAt: expect.any(Date) })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "agent.execution.failed" })
    }));
  });
  it("uses a single transaction for persistence and audit rollback", async () => {
    const { repository, prisma, tx } = setup();
    tx.auditLog.create.mockRejectedValue(new Error("audit failed"));
    await expect(repository.persist(
      "workspace", "actor", "request", "run", dto, assets, []
    )).rejects.toThrow("audit failed");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it("isolates loads by workspace", async () => {
    const { repository, prisma } = setup();
    await repository.get("workspace", "id");
    expect(prisma.agentExecutionOrchestration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "id", workspaceId: "workspace" } })
    );
  });
  it("rejects missing or cross-workspace records", async () => {
    const { repository, prisma } = setup();
    prisma.agentExecutionOrchestration.findFirst.mockResolvedValue(null);
    await expect(repository.get("other", "id")).rejects.toBeInstanceOf(NotFoundException);
  });
  it("resolves idempotent orchestration requests inside the workspace", async () => {
    const { repository, prisma } = setup();
    await repository.findByRequest("workspace", "request");
    expect(prisma.agentExecutionOrchestration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace", executionRequestId: "request" }
      })
    );
  });
  it("paginates and filters in the workspace", async () => {
    const { repository, prisma } = setup();
    const result = await repository.list("workspace", {
      page: 2, limit: 10, status: "READY", correlationId: "correlation"
    });
    expect(prisma.agentExecutionOrchestration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "workspace", status: "READY" }),
        skip: 10, take: 10
      })
    );
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
  });
  it("cancels and audits atomically", async () => {
    const { repository, tx } = setup();
    await repository.cancel("workspace", "actor", "orchestration");
    expect(tx.agentExecutionOrchestration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) })
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
