import { AiContractError } from "../contracts";
import { ReservationService } from "./reservation.service";

const limits = {
  dailyRequestLimit: 100,
  monthlyRequestLimit: 1_000,
  dailyTokenLimit: 10_000,
  monthlyTokenLimit: 100_000,
  dailyCostLimit: "10.000000",
  monthlyCostLimit: "100.000000",
  maxConcurrentInvocations: 1,
  maxQueueDepth: 1,
  maxContextTokens: 4_000,
  maxOutputTokens: 1_000
};
const estimate = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
  estimatedCost: "0.000300"
};

describe("ReservationService", () => {
  it("returns an active runtime reservation", async () => {
    const now = new Date();
    const repository = {
      reserve: jest.fn().mockResolvedValue({
        id: "reservation-id",
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "owner-token",
        status: "ACTIVE",
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
        estimatedTotalTokens: 30,
        estimatedCost: "0.000300",
        queuedAt: now,
        activatedAt: now,
        leaseExpiresAt: new Date(now.getTime() + 60_000)
      }),
      release: jest.fn()
    };
    const service = new ReservationService(repository as never, {
      getOrThrow: (key: string) => (key.endsWith("reservationTtlMs") ? 60_000 : 1)
    } as never);
    await expect(
      service.reserve({
        workspaceId: "workspace-id",
        requestId: "request-id",
        estimate,
        limits
      })
    ).resolves.toMatchObject({ status: "ACTIVE", estimate });
  });

  it("activates queued work in bounded polling order", async () => {
    const queuedAt = new Date();
    const activatedAt = new Date(queuedAt.getTime() + 5);
    const repository = {
      reserve: jest.fn().mockResolvedValue({
        id: "reservation-id",
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "owner-token",
        status: "QUEUED",
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
        estimatedTotalTokens: 30,
        estimatedCost: "0.000300",
        queuedAt,
        activatedAt: null,
        leaseExpiresAt: new Date(queuedAt.getTime() + 60_000)
      }),
      tryActivate: jest.fn().mockResolvedValue({
        id: "reservation-id",
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "owner-token",
        status: "ACTIVE",
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
        estimatedTotalTokens: 30,
        estimatedCost: "0.000300",
        queuedAt,
        activatedAt,
        leaseExpiresAt: new Date(activatedAt.getTime() + 60_000)
      }),
      release: jest.fn()
    };
    const values: Record<string, number> = {
      "ai.runtime.reservationTtlMs": 60_000,
      "ai.runtime.queueWaitTimeoutMs": 100,
      "ai.runtime.queuePollIntervalMs": 1
    };
    const service = new ReservationService(repository as never, {
      getOrThrow: (key: string) => values[key]
    } as never);
    await expect(
      service.reserve({
        workspaceId: "workspace-id",
        requestId: "request-id",
        estimate,
        limits
      })
    ).resolves.toMatchObject({ status: "ACTIVE", queueWaitMs: 5 });
  });

  it("releases a queued reservation after timeout", async () => {
    const repository = {
      reserve: jest.fn().mockResolvedValue({
        id: "reservation-id",
        workspaceId: "workspace-id",
        requestId: "request-id",
        ownerToken: "owner-token",
        status: "QUEUED",
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
        estimatedTotalTokens: 30,
        estimatedCost: "0.000300",
        queuedAt: new Date(),
        activatedAt: null,
        leaseExpiresAt: new Date(Date.now() + 60_000)
      }),
      tryActivate: jest.fn().mockResolvedValue(null),
      release: jest.fn().mockResolvedValue(undefined)
    };
    const values: Record<string, number> = {
      "ai.runtime.reservationTtlMs": 60_000,
      "ai.runtime.queueWaitTimeoutMs": 2,
      "ai.runtime.queuePollIntervalMs": 1
    };
    const service = new ReservationService(repository as never, {
      getOrThrow: (key: string) => values[key]
    } as never);
    await expect(
      service.reserve({
        workspaceId: "workspace-id",
        requestId: "request-id",
        estimate,
        limits
      })
    ).rejects.toBeInstanceOf(AiContractError);
    expect(repository.release).toHaveBeenCalledWith(
      "workspace-id",
      "reservation-id",
      expect.any(String)
    );
  });

  it("renews an owned ACTIVE lease throughout a long execution", async () => {
    jest.useFakeTimers();
    try {
      const repository = {
        renewLease: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
      };
      const service = new ReservationService(repository as never, {
        getOrThrow: () => 30
      } as never);
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
        leaseExpiresAt: new Date(now.getTime() + 30),
        queueWaitMs: 0,
        reservedAt: now.getTime()
      };

      const execution = service.withLease(
        reservation,
        () => new Promise<string>((resolve) => setTimeout(() => resolve("done"), 75))
      );
      await jest.advanceTimersByTimeAsync(75);

      await expect(execution).resolves.toBe("done");
      expect(repository.renewLease.mock.calls.length).toBeGreaterThanOrEqual(7);
      expect(repository.release).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
