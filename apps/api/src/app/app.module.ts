import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import { ConfigModule } from "../config/config.module";
import { HealthModule } from "../modules/health/health.module";
import { AuthModule } from "../modules/auth/auth.module";
import { JwtAuthGuard, PermissionsGuard } from "../modules/auth/auth.guard";
import { WorkspaceModule } from "../modules/workspace/workspace.module";
import { MembershipGuard } from "../modules/tenant/membership.guard";
import { TenantGuard } from "../modules/tenant/tenant.guard";
import { TenantModule } from "../modules/tenant/tenant.module";

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        genReqId: (request, response) => {
          const suppliedRequestId = request.headers["x-request-id"];
          const requestId =
            typeof suppliedRequestId === "string" &&
            /^[A-Za-z0-9._-]{1,128}$/.test(suppliedRequestId)
              ? suppliedRequestId
              : randomUUID();

          response.setHeader("x-request-id", requestId);
          return requestId;
        }
      }
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.getOrThrow<number>("api.rateLimit.ttlMs"),
            limit: configService.getOrThrow<number>("api.rateLimit.maxRequests")
          }
        ]
      })
    }),
    HealthModule,
    TenantModule,
    AuthModule,
    WorkspaceModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useExisting: TenantGuard
    },
    {
      provide: APP_GUARD,
      useExisting: MembershipGuard
    },
    {
      provide: APP_GUARD,
      useExisting: PermissionsGuard
    }
  ]
})
export class AppModule {}
