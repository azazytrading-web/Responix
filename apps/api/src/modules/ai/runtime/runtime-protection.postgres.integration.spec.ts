import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../database/prisma.service";
import { InvocationRepository } from "../invocation/invocation.repository";
import { RuntimeProtectionRepository } from "./runtime-protection.repository";
import { RuntimeRecoveryService } from "./runtime-recovery.service";

const databaseUrl = process.env.POSTGRES_INTEGRATION_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

const estimate = {
  inputTokens: 2,
  outputTokens: 3,
  totalTokens: 5,
  estimatedCost: "0.000050"
};

function limits(maxConcurrentInvocations: number, maxQueueDepth: number) {
  return {
    dailyRequestLimit: 1_000,
    monthlyRequestLimit: 10_000,
    dailyTokenLimit: 1_000_000,
    monthlyTokenLimit: 10_000_000,
    dailyCostLimit: "100.000000",
    monthlyCostLimit: "1000.000000",
    maxConcurrentInvocations,
    maxQueueDepth,
    maxContextTokens: 10_000,
    maxOutputTokens: 1_000
  };
}

describePostgres("Runtime protection PostgreSQL concurrency", () => {
  let prisma: PrismaService;
  let runtime: RuntimeProtectionRepository;
  let invocations: InvocationRepository;
  const workspaceIds: string[] = [];
  const providerIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService({ datasourceUrl: databaseUrl! });
    await prisma.$connect();
    runtime = new RuntimeProtectionRepository(prisma);
    invocations = new InvocationRepository(prisma);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.aiRuntimeFinalization.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.aiRuntimeAccounting.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.aiRoutingMetadata.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.aiUsageRecord.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.aiCostRecord.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.aiInvocationLog.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.aiRuntimeReservation.deleteMany({
      where: { workspaceId: { in: workspaceIds } }
    });
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.aiModel.deleteMany({
      where: { providerId: { in: providerIds } }
    });
    await prisma.aiProvider.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.$disconnect();
  });

  async function createWorkspace(label: string): Promise<string> {
    const record = await prisma.workspace.create({
      data: {
        name: `Runtime integration ${label}`,
        slug: `runtime-${label}-${randomUUID()}`
      },
      select: { id: true }
    });
    workspaceIds.push(record.id);
    return record.id;
  }

  async function createStaleActive(
    workspaceId: string,
    requestId: string
  ): Promise<void> {
    const stale = new Date(Date.now() - 120_000);
    await prisma.aiRuntimeReservation.create({
      data: {
        workspaceId,
        requestId,
        ownerToken: randomUUID(),
        status: "ACTIVE",
        estimatedInputTokens: estimate.inputTokens,
        estimatedOutputTokens: estimate.outputTokens,
        estimatedTotalTokens: estimate.totalTokens,
        estimatedCost: estimate.estimatedCost,
        activatedAt: stale,
        heartbeatAt: stale,
        expiresAt: stale
      }
    });
  }

  async function reserve(
    workspaceId: string,
    requestId: string,
    ownerToken: string,
    maxConcurrentInvocations: number,
    maxQueueDepth: number
  ) {
    return runtime.reserve({
      workspaceId,
      requestId,
      ownerToken,
      estimate,
      limits: limits(maxConcurrentInvocations, maxQueueDepth),
      expiresAt: new Date(Date.now() + 60_000),
      heartbeatTimeoutMs: 60_000
    });
  }

  it("serializes concurrent reclaim and leaves exactly one ACTIVE owner", async () => {
    const workspaceId = await createWorkspace("reclaim");
    await createStaleActive(workspaceId, `stale-${randomUUID()}`);

    const owners = [randomUUID(), randomUUID()];
    const results = await Promise.all(
      owners.map(async (ownerToken, index) => {
        const reclaimed = await runtime.recoverStaleReservations(60_000, 100);
        const reservation = await reserve(
          workspaceId,
          `replacement-${index}-${randomUUID()}`,
          ownerToken,
          1,
          1
        );
        return { reclaimed, reservation };
      })
    );

    const rows = await prisma.aiRuntimeReservation.findMany({
      where: { workspaceId, status: { in: ["ACTIVE", "QUEUED"] } },
      select: { status: true, ownerToken: true }
    });
    expect(results.reduce((total, result) => total + result.reclaimed, 0)).toBe(1);
    expect(rows.filter(({ status }) => status === "ACTIVE")).toHaveLength(1);
    expect(new Set(rows.map(({ ownerToken }) => ownerToken)).size).toBe(rows.length);
  });

  it("enforces concurrency and queue depth across simultaneous reserve calls", async () => {
    const workspaceId = await createWorkspace("burst");
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        reserve(
          workspaceId,
          `burst-${index}-${randomUUID()}`,
          randomUUID(),
          2,
          3
        )
      )
    );

    const rows = await prisma.aiRuntimeReservation.findMany({
      where: { workspaceId, status: { in: ["ACTIVE", "QUEUED"] } },
      select: { id: true, status: true, ownerToken: true }
    });
    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(5);
    expect(rows.filter(({ status }) => status === "ACTIVE")).toHaveLength(2);
    expect(rows.filter(({ status }) => status === "QUEUED")).toHaveLength(3);
    expect(new Set(rows.map(({ ownerToken }) => ownerToken)).size).toBe(rows.length);
  });

  it("runs concurrent workers with one reclaim and exactly-once finalization", async () => {
    const workspaceId = await createWorkspace("workers");

    const provider = await prisma.aiProvider.create({
      data: { providerName: `RuntimeProvider-${randomUUID()}` },
      select: { id: true }
    });
    providerIds.push(provider.id);
    const model = await prisma.aiModel.create({
      data: {
        providerId: provider.id,
        modelName: `runtime-model-${randomUUID()}`,
        displayName: "Runtime integration model",
        contextWindow: 8_192
      },
      select: { id: true }
    });
    const requestId = `finalization-${randomUUID()}`;
    const reservation = await reserve(
      workspaceId,
      requestId,
      randomUUID(),
      2,
      2
    );
    const invocation = await invocations.start({
      requestId,
      workspaceId,
      providerId: provider.id,
      modelId: model.id,
      taskType: "completion",
      messageCount: 1
    });
    await invocations.stageSuccess({
      invocationId: invocation.id,
      workspaceId,
      providerId: provider.id,
      modelId: model.id,
      routing: {
        providerId: provider.id,
        modelId: model.id,
        decisionFactors: {},
        fallbacks: []
      },
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        cachedTokens: 0,
        totalTokens: 5
      },
      cost: {
        inputCost: "0.000020",
        outputCost: "0.000030",
        totalCost: "0.000050",
        currency: "USD"
      },
      runtime: {
        reservation: {
          id: reservation.id,
          workspaceId,
          requestId,
          ownerToken: reservation.ownerToken,
          status: "ACTIVE",
          estimate,
          queuedAt: reservation.queuedAt,
          activatedAt: reservation.activatedAt!,
          leaseExpiresAt: reservation.leaseExpiresAt,
          queueWaitMs: 0,
          reservedAt: Date.now()
        },
        invocationId: invocation.id,
        providerId: provider.id,
        modelId: model.id,
        usage: {
          inputTokens: 2,
          outputTokens: 3,
          cachedTokens: 0,
          totalTokens: 5
        },
        cost: {
          inputCost: "0.000020",
          outputCost: "0.000030",
          totalCost: "0.000050",
          currency: "USD"
        },
        retryCount: 0,
        executionDurationMs: 10,
        providerDurationMs: 5
      }
    });
    await createStaleActive(workspaceId, `orphan-${randomUUID()}`);

    const config = {
      getOrThrow: (key: string) =>
        key.endsWith("recoveryBatchSize") ? 100 : 60_000
    };
    const workers = [
      new RuntimeRecoveryService(runtime, invocations, config as never),
      new RuntimeRecoveryService(runtime, invocations, config as never)
    ];
    await Promise.all(workers.map((worker) => worker.recover()));

    const [accounting, finalization, active, releasedOrphans] = await Promise.all([
      prisma.aiRuntimeAccounting.count({ where: { invocationId: invocation.id } }),
      prisma.aiRuntimeFinalization.findUnique({
        where: { invocationId: invocation.id },
        select: { status: true }
      }),
      prisma.aiRuntimeReservation.count({
        where: { workspaceId, status: "ACTIVE" }
      }),
      prisma.aiRuntimeReservation.count({
        where: {
          workspaceId,
          requestId: { startsWith: "orphan-" },
          status: "RELEASED"
        }
      })
    ]);
    expect(accounting).toBe(1);
    expect(finalization?.status).toBe("COMPLETED");
    expect(active).toBe(0);
    expect(releasedOrphans).toBe(1);
  });

  it("allows only one replacement owner during a crash recovery race", async () => {
    const workspaceId = await createWorkspace("crash");
    await createStaleActive(workspaceId, `crashed-${randomUUID()}`);

    await Promise.all([
      runtime.recoverStaleReservations(60_000, 100),
      runtime.recoverStaleReservations(60_000, 100)
    ]);
    await Promise.all([
      reserve(workspaceId, `node-b-${randomUUID()}`, randomUUID(), 1, 1),
      reserve(workspaceId, `node-c-${randomUUID()}`, randomUUID(), 1, 1)
    ]);

    const active = await prisma.aiRuntimeReservation.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { ownerToken: true }
    });
    expect(active).toHaveLength(1);
    expect(new Set(active.map(({ ownerToken }) => ownerToken)).size).toBe(1);
  });
});
