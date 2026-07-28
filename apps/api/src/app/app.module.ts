import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import { ConfigModule } from "../config/config.module";
import { PrismaModule } from "../database/prisma.module";
import { HealthModule } from "../modules/health/health.module";
import { AuthModule } from "../modules/auth/auth.module";
import { JwtAuthGuard, PermissionsGuard } from "../modules/auth/auth.guard";
import { WorkspaceModule } from "../modules/workspace/workspace.module";
import { MembershipGuard } from "../modules/tenant/membership.guard";
import { TenantGuard } from "../modules/tenant/tenant.guard";
import { TenantModule } from "../modules/tenant/tenant.module";
import { AiModule } from "../modules/ai/ai.module";
import { PlatformControlModule } from "../modules/platform-control/platform-control.module";
import { DashboardRuntimeModule } from "../modules/dashboard-runtime/dashboard-runtime.module";
import { StudioProjectModule } from "../modules/studio-project/studio-project.module";
import { PromptLibraryModule } from "../modules/prompt-library/prompt-library.module";
import { AgentStudioModule } from "../modules/agent-studio/agent-studio.module";
import { KnowledgeBaseModule } from "../modules/knowledge-base/knowledge-base.module";
import { ToolRegistryModule } from "../modules/tool-registry/tool-registry.module";
import { WorkflowEngineModule } from "../modules/workflow-engine/workflow-engine.module";
import { RuntimeOrchestrationModule } from "../modules/runtime-orchestration/runtime-orchestration.module";
import { SecretRedactionExceptionFilter } from "../common/secret-redaction-exception.filter";
import { redactLogArguments } from "../common/secret-redaction";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie"
          ],
          censor: "[REDACTED]"
        },
        hooks: {
          logMethod(arguments_, method) {
            method.apply(
              this,
              redactLogArguments(arguments_) as Parameters<typeof method>
            );
          }
        },
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
    WorkspaceModule,
    AiModule,
    PlatformControlModule,
    DashboardRuntimeModule,
    StudioProjectModule,
    PromptLibraryModule,
    AgentStudioModule,
    KnowledgeBaseModule,
    ToolRegistryModule,
    WorkflowEngineModule,
    RuntimeOrchestrationModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SecretRedactionExceptionFilter
    },
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
