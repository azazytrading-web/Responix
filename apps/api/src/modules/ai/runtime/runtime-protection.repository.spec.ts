import { Prisma } from "@prisma/client";
import { RuntimeProtectionRepository } from "./runtime-protection.repository";

const limits = {
  dailyRequestLimit: 10,
  monthlyRequestLimit: 100,
  dailyTokenLimit: 1_000,
  monthlyTokenLimit: 10_000,
  dailyCostLimit: "1.000000",
  monthlyCostLimit: "10.000000",
  maxConcurrentInvocations: 1,
  maxQueueDepth: 1,
  maxContextTokens: 100,
  maxOutputTokens: 20
};
const estimate = {
  inputTokens: 2,
  outputTokens: 10,
  totalTokens: 12,
  estimatedCost: "0.000120"
};

function createHarness(overrides: {
  accountingCount?: number;
  active?: number;
  queued?: number;
  actualTokens?: number;
  actualCost?: string;
  reservedCount?: number;
  reservedTokens?: number;
  reservedCost?: string;
} = {}) {
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    aiRuntimeReservation: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest
        .fn()
        .mockResolvedValueOnce(overrides.active ?? 0)
        .mockResolvedValueOnce(overrides.queued ?? 0),
      aggregate: jest.fn().mockResolvedValue({
        _count: { id: overrides.reservedCount ?? 0 },
        _sum: {
          estimatedTotalTokens: overrides.reservedTokens ?? null,
          estimatedCost:
            overrides.reservedCost === undefined
              ? null
              : new Prisma.Decimal(overrides.reservedCost)
        }
      }),
      create: jest.fn().mockResolvedValue({
        id: "reservation-id",
        workspaceId: "workspace-id",
      requestId: "request-id",
      ownerToken: "11111111-1111-4111-8111-111111111111",
        status: "ACTIVE",
        estimatedInputTokens: 2,
        estimatedOutputTokens: 10,
        estimatedTotalTokens: 12,
        estimatedCost: new Prisma.Decimal("0.000120"),
        queuedAt: new Date(),
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000)
      })
    },
    aiRuntimeAccounting: {
      count: jest.fn().mockResolvedValue(overrides.accountingCount ?? 0),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          actualTotalTokens: overrides.actualTokens ?? null,
          actualCost:
            overrides.actualCost === undefined
              ? null
              : new Prisma.Decimal(overrides.actualCost)
        }
      }),
      create: jest.fn().mockResolvedValue({})
    },
    aiRuntimeFinalization: {
      findMany: jest.fn().mockResolvedValue([])
    }
  };
  const prisma = {
    $transaction: jest.fn((operation: (tx: typeof transaction) => unknown) =>
      Promise.resolve(operation(transaction))
    ),
    aiRuntimeReservation: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([])
    }
  };
  return {
    repository: new RuntimeProtectionRepository(prisma as never),
    prisma,
    transaction
  };
}

describe("RuntimeProtectionRepository", () => {
  it("serializes quota checks and reservation creation under a workspace lock", async () => {
    const harness = createHarness();

    await expect(
      harness.repository.reserve({
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "11111111-1111-4111-8111-111111111111",
        estimate,
        limits,
        expiresAt: new Date(Date.now() + 60_000),
        heartbeatTimeoutMs: 60_000
      })
    ).resolves.toMatchObject({ status: "ACTIVE", estimatedCost: "0.000120" });

    expect(harness.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    expect(harness.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(harness.transaction.aiRuntimeReservation.create).toHaveBeenCalledTimes(1);
  });

  it("rejects atomically when request quota would be exceeded", async () => {
    const harness = createHarness({ accountingCount: 10 });

    await expect(
      harness.repository.reserve({
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "11111111-1111-4111-8111-111111111111",
        estimate,
        limits,
        expiresAt: new Date(Date.now() + 60_000),
        heartbeatTimeoutMs: 60_000
      })
    ).rejects.toThrow("Daily AI request quota exceeded");

    expect(harness.transaction.aiRuntimeReservation.create).not.toHaveBeenCalled();
  });

  it("rejects when active and queued capacity are exhausted", async () => {
    const harness = createHarness({ active: 1, queued: 1 });

    await expect(
      harness.repository.reserve({
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "11111111-1111-4111-8111-111111111111",
        estimate,
        limits,
        expiresAt: new Date(Date.now() + 60_000),
        heartbeatTimeoutMs: 60_000
      })
    ).rejects.toThrow("AI runtime queue capacity exceeded");
  });

  it("records zero actual cost for provider failures", async () => {
    const harness = createHarness();
    const now = new Date();

    await harness.repository.recordFailure({
      reservation: {
        id: "reservation-id",
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "11111111-1111-4111-8111-111111111111",
        status: "ACTIVE",
        estimate,
        queuedAt: now,
        activatedAt: now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
        queueWaitMs: 0,
        reservedAt: Date.now()
      },
      retryCount: 0,
      executionDurationMs: 20,
      providerDurationMs: 10,
      failureReason: "PROVIDER_UNAVAILABLE",
      cancelled: false
    });

    expect(
      JSON.stringify(harness.transaction.aiRuntimeAccounting.create.mock.calls)
    ).toContain('"status":"FAILED"');
    expect(
      JSON.stringify(harness.transaction.aiRuntimeAccounting.create.mock.calls)
    ).toContain('"actualCost":"0.000000"');
  });

  it("reclaims an ACTIVE reservation only through the stale heartbeat predicate", async () => {
    const harness = createHarness({ active: 1, queued: 0 });

    await harness.repository.reserve({
      workspaceId: "workspace-id",
      requestId: "second-request-id",
      ownerToken: "22222222-2222-4222-8222-222222222222",
      estimate,
      limits,
      expiresAt: new Date(Date.now() + 60_000),
      heartbeatTimeoutMs: 60_000
    });

    expect(harness.transaction.aiRuntimeReservation.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-id",
        status: "ACTIVE",
        expiresAt: { lte: expect.any(Date) as Date },
        requestId: { notIn: [] },
        OR: [
          { heartbeatAt: null },
          { heartbeatAt: { lte: expect.any(Date) as Date } }
        ]
      },
      data: {
        status: "RELEASED",
        releasedAt: expect.any(Date) as Date
      }
    });
    expect(harness.transaction.aiRuntimeReservation.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          workspaceId: "workspace-id",
          status: "ACTIVE"
        }
      })
    );
  });

  it("rejects release when reservation ownership does not match", async () => {
    const harness = createHarness();
    harness.transaction.aiRuntimeReservation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      harness.repository.release(
        "workspace-id",
        "reservation-id",
        "22222222-2222-4222-8222-222222222222"
      )
    ).rejects.toThrow("AI runtime reservation ownership mismatch");
  });

  it("coordinates concurrent failure accounting under the workspace lock", async () => {
    const harness = createHarness();
    const now = new Date();
    const reservation = {
      id: "reservation-id",
      workspaceId: "workspace-id",
      requestId: "request-id",
      ownerToken: "11111111-1111-4111-8111-111111111111",
      status: "ACTIVE" as const,
      estimate,
      queuedAt: now,
      activatedAt: now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      queueWaitMs: 0,
      reservedAt: now.getTime()
    };

    await Promise.all([
      harness.repository.recordFailure({
        reservation,
        retryCount: 0,
        executionDurationMs: 10,
        providerDurationMs: 5,
        failureReason: "PROVIDER_UNAVAILABLE",
        cancelled: false
      }),
      harness.repository.recordFailure({
        reservation: { ...reservation, id: "reservation-id-2", requestId: "request-id-2" },
        retryCount: 0,
        executionDurationMs: 10,
        providerDurationMs: 5,
        failureReason: "PROVIDER_UNAVAILABLE",
        cancelled: false
      })
    ]);

    expect(harness.transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(harness.transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      harness.transaction.aiRuntimeReservation.updateMany.mock.invocationCallOrder[0]!
    );
  });

  it("recovers stale ACTIVE reservations independently under the workspace lock", async () => {
    const harness = createHarness();
    harness.prisma.aiRuntimeReservation.findMany.mockResolvedValue([
      { workspaceId: "workspace-id" }
    ]);

    await expect(
      harness.repository.recoverStaleReservations(60_000, 100)
    ).resolves.toBe(1);

    expect(harness.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(harness.transaction.aiRuntimeReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-id",
          status: "ACTIVE"
        }) as object
      })
    );
  });
});
