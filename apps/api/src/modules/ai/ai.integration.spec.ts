import { Injectable, Logger, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import type { CanActivate, ExecutionContext, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AiController } from "./ai.controller";
import { AI_PROVIDER_ADAPTERS } from "./ai.tokens";
import { CostNormalizerService } from "./invocation/cost-normalizer.service";
import { ErrorNormalizerService } from "./invocation/error-normalizer.service";
import { InvocationOrchestratorService } from "./invocation/invocation-orchestrator.service";
import { InvocationRepository } from "./invocation/invocation.repository";
import { InvocationService } from "./invocation/invocation.service";
import { RequestNormalizerService } from "./invocation/request-normalizer.service";
import { ResponseNormalizerService } from "./invocation/response-normalizer.service";
import { UsageNormalizerService } from "./invocation/usage-normalizer.service";
import { RuntimeProtectionService } from "./runtime/runtime-protection.service";
import { CredentialRepository } from "./providers/credential.repository";
import type { AiProviderAdapter } from "./providers/provider-adapter.interface";
import { ProviderCredentialService } from "./providers/provider-credential.service";
import { ProviderDiscoveryService } from "./providers/provider-discovery.service";
import { ProviderFactory } from "./providers/provider.factory";
import { ProviderRegistry } from "./providers/provider.registry";
import { ProviderRepository } from "./providers/provider.repository";
import { CapabilityResolver } from "./router/capability.resolver";
import { EligibilityResolver } from "./router/eligibility.resolver";
import { FallbackEngine } from "./router/fallback.engine";
import { HealthResolver } from "./router/health.resolver";
import { PriorityEngine } from "./router/priority.engine";
import { RoutingRepository } from "./router/routing.repository";
import { RoutingService } from "./router/routing.service";
import { routingCandidate } from "./router/routing.test-fixtures";
import { ProviderCredentialCryptoService } from "./security/provider-credential-crypto.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { PermissionsGuard } from "../auth/auth.guard";
import { PermissionResolutionService } from "../platform-control/permission-resolution.service";
import { AiContractError } from "./contracts";
import type { ProviderExecutionResult } from "./contracts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const providerId = "33333333-3333-4333-8333-333333333333";
const modelId = "44444444-4444-4444-8444-444444444444";

@Injectable()
class IntegrationAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      tenantContext?: unknown;
    }>();
    if (request.headers.authorization !== "Bearer integration-token") {
      throw new UnauthorizedException();
    }
    request.tenantContext = {
      workspace: { id: workspaceId },
      user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      membership: { id: membershipId, status: "ACTIVE" },
      role: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Integration" },
      permissions: ["ai.configure", "ai.invoke"]
    };
    return true;
  }
}

describe("AI module production integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adapterMode: "success" | "failure" | "timeout";

  const provider = {
    id: providerId,
    providerName: "TestProvider",
    apiBaseUrl: null,
    authenticationType: "api_key",
    status: "ACTIVE" as const,
    priority: 10,
    configuration: { enabled: true, settings: { internal: "not-public" } },
    models: [
      {
        modelId,
        providerId,
        modelName: "test-model",
        displayName: "Test Model",
        status: "ACTIVE" as const,
        priority: 10,
        contextWindow: 32_000,
        maxOutputTokens: 4_096,
        supportsVision: true,
        supportsAudio: false,
        supportsTools: false,
        supportsReasoning: false,
        supportsStreaming: false
      }
    ]
  };
  const providerRepository = {
    discover: jest.fn().mockResolvedValue([provider]),
    findAvailableById: jest.fn().mockResolvedValue(provider)
  };
  const routingRepository = {
    findCandidates: jest.fn().mockImplementation((requestedWorkspaceId: string) =>
      Promise.resolve([
        routingCandidate({
          workspaceId: requestedWorkspaceId,
          providerId,
          providerName: "TestProvider",
          modelId,
          modelName: "test-model",
          capabilities: {
            modelId,
            providerId,
            contextWindow: 32_000,
            maxOutputTokens: 4_096,
            supportsVision: true,
            supportsAudio: false,
            supportsTools: false,
            supportsReasoning: false,
            supportsStreaming: false,
            supportsJson: false
          }
        })
      ])
    )
  };
  const credentialRepository = {
    findActiveEnvelope: jest.fn().mockResolvedValue({
      id: "credential-id",
      encryptedSecret: "encrypted-provider-secret"
    })
  };
  const crypto = {
    decrypt: jest.fn().mockReturnValue("plaintext-provider-secret")
  };
  const invocationRepository = {
    findModelPricing: jest.fn().mockResolvedValue({
      inputCostPerMillion: "1.000000",
      outputCostPerMillion: "2.000000",
      currency: "USD"
    }),
    start: jest.fn().mockResolvedValue({
      id: "invocation-id",
      requestId: "request-id",
      workspaceId,
      status: "PENDING"
    }),
    stageSuccess: jest.fn().mockResolvedValue("recovery-id"),
    stageFailure: jest.fn().mockResolvedValue("recovery-id"),
    complete: jest.fn().mockResolvedValue(undefined),
    failWithRuntime: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined)
  };
  const adapterInvoke = jest.fn(
    async (
      _request: Parameters<AiProviderAdapter["invoke"]>[0],
      credential: Parameters<AiProviderAdapter["invoke"]>[1]
    ) => {
      if (adapterMode === "timeout") {
        return new Promise<ProviderExecutionResult>(() => undefined);
      }
      if (adapterMode === "failure") {
        throw new AiContractError("PROVIDER_UNAVAILABLE", "AI provider is unavailable", {
          secret: credential.secret,
          providerPayload: "private"
        });
      }
      return {
        content: "Integrated response",
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 }
      };
    }
  );
  const adapter: AiProviderAdapter = {
    providerName: "TestProvider",
    invoke: adapterInvoke
  };
  const runtimeProtection = {
    begin: jest.fn().mockImplementation((request: { requestId: string; workspaceId: string }) =>
      Promise.resolve({
        id: "reservation-id",
        workspaceId: request.workspaceId,
        requestId: request.requestId,
        ownerToken: "11111111-1111-4111-8111-111111111111",
        status: "ACTIVE",
        estimate: {
          inputTokens: 2,
          outputTokens: 10,
          totalTokens: 12,
          estimatedCost: "0.000120"
        },
        queuedAt: new Date(),
        activatedAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + 60_000),
        queueWaitMs: 0,
        reservedAt: Date.now()
      })
    ),
    validateModel: jest.fn(),
    withLease: jest.fn(
      async (
        _reservation: unknown,
        operation: (signal: AbortSignal) => Promise<ProviderExecutionResult>
      ) => operation(new AbortController().signal)
    ),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        ProviderDiscoveryService,
        ProviderRegistry,
        ProviderFactory,
        ProviderCredentialService,
        CapabilityResolver,
        HealthResolver,
        EligibilityResolver,
        PriorityEngine,
        FallbackEngine,
        RoutingService,
        RequestNormalizerService,
        UsageNormalizerService,
        CostNormalizerService,
        ResponseNormalizerService,
        ErrorNormalizerService,
        InvocationOrchestratorService,
        InvocationService,
        PermissionsGuard,
        { provide: PermissionResolutionService, useValue: { resolve: jest.fn().mockResolvedValue(["ai.configure", "ai.invoke"]) } },
        { provide: ProviderRepository, useValue: providerRepository },
        { provide: RoutingRepository, useValue: routingRepository },
        { provide: CredentialRepository, useValue: credentialRepository },
        { provide: ProviderCredentialCryptoService, useValue: crypto },
        { provide: InvocationRepository, useValue: invocationRepository },
        { provide: RuntimeProtectionService, useValue: runtimeProtection },
        { provide: AI_PROVIDER_ADAPTERS, useValue: [adapter] },
        {
          provide: TenantContextService,
          useValue: {
            resolved: {
              workspace: { id: workspaceId },
              membership: { id: membershipId, status: "ACTIVE" }
            }
          }
        },
        { provide: ConfigService, useValue: { getOrThrow: () => 10 } },
        { provide: APP_GUARD, useClass: IntegrationAuthenticationGuard },
        { provide: APP_GUARD, useExisting: PermissionsGuard }
      ]
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    app.use(
      (
        request: { headers: Record<string, string | string[] | undefined>; id?: string },
        response: { setHeader(name: string, value: string): void },
        next: () => void
      ) => {
        const supplied = request.headers["x-request-id"];
        request.id = typeof supplied === "string" ? supplied : "generated-request-id";
        response.setHeader("x-request-id", request.id);
        next();
      }
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    adapterMode = "success";
    jest.clearAllMocks();
    providerRepository.discover.mockResolvedValue([provider]);
    providerRepository.findAvailableById.mockResolvedValue(provider);
    credentialRepository.findActiveEnvelope.mockResolvedValue({
      id: "credential-id",
      encryptedSecret: "encrypted-provider-secret"
    });
    invocationRepository.findModelPricing.mockResolvedValue({
      inputCostPerMillion: "1.000000",
      outputCostPerMillion: "2.000000",
      currency: "USD"
    });
    invocationRepository.start.mockResolvedValue({
      id: "invocation-id",
      requestId: "request-id",
      workspaceId,
      status: "PENDING"
    });
    invocationRepository.complete.mockResolvedValue(undefined);
    invocationRepository.stageSuccess.mockResolvedValue("recovery-id");
    invocationRepository.stageFailure.mockResolvedValue("recovery-id");
    invocationRepository.failWithRuntime.mockResolvedValue(undefined);
    invocationRepository.fail.mockResolvedValue(undefined);
  });

  afterAll(async () => app.close());

  it("executes Provider -> Routing -> Invocation -> HTTP with safe serialization", async () => {
    const response = await request("/ai/invocations", {
      method: "POST",
      requestId: "integration-request-id",
      body: {
        taskType: "completion",
        messages: [{ role: "user", content: "Hello" }],
        mode: "sync"
      }
    });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("integration-request-id");
    expect(body).toMatchObject({
      requestId: "integration-request-id",
      providerId,
      modelId,
      content: "Integrated response"
    });
    expect(providerRepository.findAvailableById).toHaveBeenCalledWith(workspaceId, providerId);
    expect(credentialRepository.findActiveEnvelope).toHaveBeenCalledWith(workspaceId, providerId);
    expect(invocationRepository.complete).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain("plaintext-provider-secret");
    expect(JSON.stringify(body)).not.toContain("encrypted-provider-secret");
    expect(JSON.stringify(body)).not.toContain("internal");
  });

  it("rejects forged tenant identifiers before execution", async () => {
    const response = await request("/ai/invocations", {
      method: "POST",
      body: {
        workspaceId: "forged-workspace",
        membershipId: "forged-membership",
        taskType: "completion",
        messages: [{ role: "user", content: "Hello" }],
        mode: "sync"
      }
    });

    expect(response.status).toBe(400);
    expect(adapterInvoke).not.toHaveBeenCalled();
    expect(invocationRepository.start).not.toHaveBeenCalled();
  });

  it("redacts provider failures and closes the invocation lifecycle", async () => {
    adapterMode = "failure";
    const log = jest.spyOn(Logger.prototype, "error");
    const response = await request("/ai/invocations", {
      method: "POST",
      body: {
        taskType: "completion",
        messages: [{ role: "user", content: "Hello" }],
        mode: "sync"
      }
    });
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toContain("PROVIDER_UNAVAILABLE");
    expect(serialized).not.toContain("plaintext-provider-secret");
    expect(serialized).not.toContain("providerPayload");
    expect(JSON.stringify(log.mock.calls)).not.toContain("plaintext-provider-secret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("providerPayload");
    expect(invocationRepository.failWithRuntime).toHaveBeenCalledTimes(1);
    expect(invocationRepository.complete).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("maps provider timeouts without leaking credentials", async () => {
    adapterMode = "timeout";
    const response = await request("/ai/invocations", {
      method: "POST",
      requestId: "timeout-request-id",
      body: {
        taskType: "completion",
        messages: [{ role: "user", content: "Hello" }],
        mode: "sync"
      }
    });
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toContain("AI provider request timed out");
    expect(serialized).not.toContain("plaintext-provider-secret");
    expect(invocationRepository.failWithRuntime).toHaveBeenCalledTimes(1);
  });

  it("requires authentication and exposes guarded Swagger operations", async () => {
    const unauthorized = await fetch(`${baseUrl}/ai/providers`);
    expect(unauthorized.status).toBe(401);

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build()
    );
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(["/ai/providers", "/ai/routing/resolve", "/ai/invocations"])
    );
    expect(document.paths["/ai/invocations"]?.post?.security).toEqual([{ bearer: [] }]);
  });

  async function request(
    path: string,
    options: {
      method: "POST";
      requestId?: string;
      body: Record<string, unknown>;
    }
  ): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: {
        authorization: "Bearer integration-token",
        "content-type": "application/json",
        ...(options.requestId ? { "x-request-id": options.requestId } : {})
      },
      body: JSON.stringify(options.body)
    });
  }
});
