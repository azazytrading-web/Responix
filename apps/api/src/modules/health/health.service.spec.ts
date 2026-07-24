import { HealthCheckError } from "@nestjs/terminus";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  const prisma = { $queryRaw: jest.fn() };
  const config = { get: jest.fn() };
  const service = new HealthService(prisma as never, config as never);

  beforeEach(() => jest.resetAllMocks());

  it("reports PostgreSQL as available when a query succeeds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    await expect(service.checkDatabase()).resolves.toEqual({ database: { status: "up" } });
  });

  it("reports PostgreSQL as unavailable without crashing the process", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    await expect(service.checkDatabase()).rejects.toBeInstanceOf(HealthCheckError);
  });

  it("does not require Redis health probing when Redis is not configured", async () => {
    config.get.mockReturnValue(undefined);

    await expect(service.checkRedis()).resolves.toEqual({
      redis: { status: "up", configured: false }
    });
  });
});
