import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthCheckError, HealthIndicatorResult } from "@nestjs/terminus";
import Redis from "ioredis";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  checkApi(): Promise<HealthIndicatorResult> {
    return Promise.resolve({
      api: {
        status: "up"
      }
    });
  }

  async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: "up" } };
    } catch {
      throw new HealthCheckError("PostgreSQL is unavailable", {
        database: { status: "down" }
      });
    }
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) {
      return { redis: { status: "up", configured: false } };
    }

    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null
    });
    redis.on("error", () => undefined);

    try {
      await redis.connect();
      if ((await redis.ping()) !== "PONG") throw new Error("Unexpected Redis response");
      return { redis: { status: "up" } };
    } catch {
      throw new HealthCheckError("Redis is unavailable", { redis: { status: "down" } });
    } finally {
      redis.disconnect();
    }
  }
}
