import { RuntimeRecoveryService } from "./runtime-recovery.service";

describe("RuntimeRecoveryService", () => {
  it("replays durable finalizations before reclaiming stale reservations", async () => {
    const order: string[] = [];
    const runtime = {
      recoverStaleReservations: jest.fn(() => {
        order.push("reservations");
        return Promise.resolve(1);
      })
    };
    const invocations = {
      recoverPendingFinalizations: jest.fn(() => {
        order.push("finalizations");
        return Promise.resolve(1);
      })
    };
    const values: Record<string, number> = {
      "ai.runtime.recoveryBatchSize": 100,
      "ai.runtime.reservationTtlMs": 60_000
    };
    const service = new RuntimeRecoveryService(
      runtime as never,
      invocations as never,
      { getOrThrow: (key: string) => values[key] } as never
    );

    await service.recover();

    expect(order).toEqual(["finalizations", "reservations"]);
  });

  it("prevents overlapping recovery cycles on the same node", async () => {
    let resolveReplay!: () => void;
    const invocations = {
      recoverPendingFinalizations: jest.fn(
        () => new Promise<number>((resolve) => {
          resolveReplay = () => resolve(1);
        })
      )
    };
    const runtime = {
      recoverStaleReservations: jest.fn().mockResolvedValue(1)
    };
    const service = new RuntimeRecoveryService(
      runtime as never,
      invocations as never,
      {
        getOrThrow: (key: string) =>
          key.endsWith("recoveryBatchSize") ? 100 : 60_000
      } as never
    );

    const first = service.recover();
    await service.recover();
    resolveReplay();
    await first;

    expect(invocations.recoverPendingFinalizations).toHaveBeenCalledTimes(1);
  });
});
