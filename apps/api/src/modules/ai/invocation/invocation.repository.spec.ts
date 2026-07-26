import { InvocationRepository } from "./invocation.repository";

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
      aiInvocationLog: {
        updateMany
      },
      aiUsageRecord: { create: jest.fn().mockResolvedValue({}) },
      aiCostRecord: { create: jest.fn().mockResolvedValue({}) },
      aiRoutingMetadata: { create: jest.fn().mockResolvedValue({}) }
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
      }
    });

    expect(executeTransaction).toHaveBeenCalledTimes(1);
    const updateInput = updateMany.mock.calls[0]![0];
    expect(updateInput.where.workspaceId).toBe("workspace-id");
    expect(transaction.aiUsageRecord.create).toHaveBeenCalledTimes(1);
    expect(transaction.aiCostRecord.create).toHaveBeenCalledTimes(1);
    expect(transaction.aiRoutingMetadata.create).toHaveBeenCalledTimes(1);
  });

  it("propagates a transaction failure without writing later records", async () => {
    const transaction = {
      aiInvocationLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      aiUsageRecord: { create: jest.fn().mockResolvedValue({}) },
      aiCostRecord: {
        create: jest.fn().mockRejectedValue(new Error("cost write failed"))
      },
      aiRoutingMetadata: { create: jest.fn() }
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
        }
      })
    ).rejects.toThrow("cost write failed");
    expect(transaction.aiRoutingMetadata.create).not.toHaveBeenCalled();
  });
});
