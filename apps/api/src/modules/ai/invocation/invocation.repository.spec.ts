import { InvocationRepository } from "./invocation.repository";

const runtime = {
  reservation: {
    id: "reservation-id",
    workspaceId: "workspace-id",
    requestId: "request-id",
    ownerToken: "11111111-1111-4111-8111-111111111111",
    status: "ACTIVE" as const,
    estimate: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      estimatedCost: "0.000020"
    },
    queuedAt: new Date(),
    activatedAt: new Date(),
    leaseExpiresAt: new Date(Date.now() + 60_000),
    queueWaitMs: 0,
    reservedAt: Date.now()
  },
  invocationId: "invocation-id",
  providerId: "provider-id",
  modelId: "model-id",
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    cachedTokens: 0,
    totalTokens: 15
  },
  cost: {
    inputCost: "0.000010",
    outputCost: "0.000010",
    totalCost: "0.000020",
    currency: "USD"
  },
  retryCount: 0,
  executionDurationMs: 20,
  providerDurationMs: 10
};

describe("InvocationRepository", () => {
  it("creates a workspace-scoped pending invocation with safe metadata", async () => {
    interface CreateInput {
      data: { workspaceId: string; inputMetadata: { messageCount: number } };
    }
    const create = jest.fn<Promise<unknown>, [CreateInput]>().mockResolvedValue({
      id: "invocation-id",
      requestId: "request-id",
      workspaceId: "workspace-id",
      status: "PENDING"
    });
    const repository = new InvocationRepository({
      aiInvocationLog: { create }
    } as never);

    await repository.start({
      requestId: "request-id",
      workspaceId: "workspace-id",
      providerId: "provider-id",
      modelId: "model-id",
      taskType: "completion",
      messageCount: 2
    });

    const createInput = create.mock.calls[0]![0];
    expect(createInput.data.workspaceId).toBe("workspace-id");
    expect(createInput.data.inputMetadata).toEqual({ messageCount: 2 });
  });

  it("persists lifecycle, usage, cost, and routing in one transaction", async () => {
    interface UpdateInput {
      where: { workspaceId: string };
    }
    const updateMany = jest
      .fn<Promise<{ count: number }>, [UpdateInput]>()
      .mockResolvedValue({ count: 1 });
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      aiInvocationLog: {
        updateMany
      },
      aiUsageRecord: { create: jest.fn().mockResolvedValue({}) },
      aiCostRecord: { create: jest.fn().mockResolvedValue({}) },
      aiRoutingMetadata: { create: jest.fn().mockResolvedValue({}) },
      aiRuntimeReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      aiRuntimeAccounting: { create: jest.fn().mockResolvedValue({}) }
    };
    const executeTransaction = jest.fn((operation: (client: typeof transaction) => Promise<void>) =>
      operation(transaction)
    );
    const repository = new InvocationRepository({
      $transaction: executeTransaction
    } as never);

    await repository.complete({
      invocationId: "invocation-id",
      workspaceId: "workspace-id",
      providerId: "provider-id",
      modelId: "model-id",
      routing: {
        providerId: "provider-id",
        modelId: "model-id",
        decisionFactors: {},
        fallbacks: []
      },
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        cachedTokens: 0,
        totalTokens: 15
      },
      cost: {
        inputCost: "0.000010",
        outputCost: "0.000010",
        totalCost: "0.000020",
        currency: "USD"
      },
      runtime
    });

    expect(executeTransaction).toHaveBeenCalledTimes(1);
    const updateInput = updateMany.mock.calls[0]![0];
    expect(updateInput.where.workspaceId).toBe("workspace-id");
    expect(transaction.aiUsageRecord.create).toHaveBeenCalledTimes(1);
    expect(transaction.aiCostRecord.create).toHaveBeenCalledTimes(1);
    expect(transaction.aiRoutingMetadata.create).toHaveBeenCalledTimes(1);
    expect(transaction.aiRuntimeReservation.updateMany).toHaveBeenCalledTimes(1);
    expect(transaction.aiRuntimeAccounting.create).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("propagates a transaction failure without writing later records", async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      aiInvocationLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      aiUsageRecord: { create: jest.fn().mockResolvedValue({}) },
      aiCostRecord: {
        create: jest.fn().mockRejectedValue(new Error("cost write failed"))
      },
      aiRoutingMetadata: { create: jest.fn() },
      aiRuntimeReservation: { updateMany: jest.fn() },
      aiRuntimeAccounting: { create: jest.fn() }
    };
    const repository = new InvocationRepository({
      $transaction: (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
    } as never);

    await expect(
      repository.complete({
        invocationId: "invocation-id",
        workspaceId: "workspace-id",
        providerId: "provider-id",
        modelId: "model-id",
        routing: {
          providerId: "provider-id",
          modelId: "model-id",
          decisionFactors: {},
          fallbacks: []
        },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          cachedTokens: 0,
          totalTokens: 2
        },
      cost: {
          inputCost: "0.000001",
          outputCost: "0.000001",
          totalCost: "0.000002",
        currency: "USD"
        },
        runtime
      })
    ).rejects.toThrow("cost write failed");
    expect(transaction.aiRoutingMetadata.create).not.toHaveBeenCalled();
  });

  it("rolls back the whole completion outcome when runtime accounting fails", async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      aiInvocationLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      aiUsageRecord: { create: jest.fn().mockResolvedValue({}) },
      aiCostRecord: { create: jest.fn().mockResolvedValue({}) },
      aiRoutingMetadata: { create: jest.fn().mockResolvedValue({}) },
      aiRuntimeReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      aiRuntimeAccounting: {
        create: jest.fn().mockRejectedValue(new Error("accounting failed"))
      }
    };
    const repository = new InvocationRepository({
      $transaction: (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
    } as never);

    await expect(
      repository.complete({
        invocationId: "invocation-id",
        workspaceId: "workspace-id",
        providerId: "provider-id",
        modelId: "model-id",
        routing: {
          providerId: "provider-id",
          modelId: "model-id",
          decisionFactors: {},
          fallbacks: []
        },
        usage: runtime.usage,
        cost: runtime.cost,
        runtime
      })
    ).rejects.toThrow("accounting failed");
  });

  it("accepts idempotent replay after a committed completion", async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      aiInvocationLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: "invocation-id" })
      },
      aiRuntimeAccounting: {
        findUnique: jest.fn().mockResolvedValue({ id: "accounting-id" }),
        create: jest.fn()
      },
      aiUsageRecord: { create: jest.fn() },
      aiCostRecord: { create: jest.fn() },
      aiRoutingMetadata: { create: jest.fn() },
      aiRuntimeReservation: { updateMany: jest.fn() }
    };
    const repository = new InvocationRepository({
      $transaction: (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
    } as never);

    await expect(
      repository.complete({
        invocationId: "invocation-id",
        workspaceId: "workspace-id",
        providerId: "provider-id",
        modelId: "model-id",
        routing: {
          providerId: "provider-id",
          modelId: "model-id",
          decisionFactors: {},
          fallbacks: []
        },
        usage: runtime.usage,
        cost: runtime.cost,
        runtime
      })
    ).resolves.toBeUndefined();

    expect(transaction.aiRuntimeAccounting.create).not.toHaveBeenCalled();
    expect(transaction.aiRuntimeReservation.updateMany).not.toHaveBeenCalled();
  });

  it("stages and deterministically replays a durable success finalization", async () => {
    const serialized = JSON.parse(
      JSON.stringify({
        invocationId: "invocation-id",
        workspaceId: "workspace-id",
        providerId: "provider-id",
        modelId: "model-id",
        routing: {
          providerId: "provider-id",
          modelId: "model-id",
          decisionFactors: {},
          fallbacks: []
        },
        usage: runtime.usage,
        cost: runtime.cost,
        runtime
      })
    ) as object;
    const prisma = {
      aiRuntimeFinalization: {
        upsert: jest.fn().mockResolvedValue({ id: "recovery-id" }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "recovery-id",
            kind: "SUCCESS",
            payload: serialized
          }
        ]),
        updateMany: jest.fn()
      }
    };
    const repository = new InvocationRepository(prisma as never);
    const completion = {
      invocationId: "invocation-id",
      workspaceId: "workspace-id",
      providerId: "provider-id",
      modelId: "model-id",
      routing: {
        providerId: "provider-id",
        modelId: "model-id",
        decisionFactors: {},
        fallbacks: []
      },
      usage: runtime.usage,
      cost: runtime.cost,
      runtime
    };
    const complete = jest
      .spyOn(repository, "complete")
      .mockResolvedValue(undefined);

    await expect(repository.stageSuccess(completion)).resolves.toBe(
      "recovery-id"
    );
    await expect(repository.recoverPendingFinalizations(100)).resolves.toBe(1);

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryId: "recovery-id" })
    );
  });
});
