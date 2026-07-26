import { AiContractError } from "../contracts";
import type { AiRequestContract, ProviderExecutionResult } from "../contracts";
import { CostNormalizerService } from "./cost-normalizer.service";
import { ErrorNormalizerService } from "./error-normalizer.service";
import { InvocationOrchestratorService } from "./invocation-orchestrator.service";
import { RequestNormalizerService } from "./request-normalizer.service";
import { ResponseNormalizerService } from "./response-normalizer.service";
import { UsageNormalizerService } from "./usage-normalizer.service";

const request: AiRequestContract = {
  requestId: "request-id",
  workspaceId: "forged-workspace",
  membershipId: "forged-membership",
  taskType: "completion",
  messages: [{ role: "user", content: "Hello" }],
  mode: "sync"
};
const command = new RequestNormalizerService().normalize(request, {
  workspace: { id: "workspace-id" },
  membership: { id: "membership-id" }
} as never);

function createHarness(options: {
  providerResult?: ProviderExecutionResult;
  timeoutMs?: number;
  neverResolve?: boolean;
}) {
  const invoke = jest.fn(
    options.neverResolve
      ? () => new Promise<ProviderExecutionResult>(() => undefined)
      : () =>
          Promise.resolve(
            options.providerResult ?? {
              content: "Response",
              finishReason: "stop",
              usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 }
            }
          )
  );
  const routing = {
    route: jest.fn().mockResolvedValue({
      providerId: "provider-id",
      modelId: "model-id",
      decisionFactors: {},
      fallbacks: []
    })
  };
  const providers = {
    create: jest.fn().mockResolvedValue({
      provider: {
        apiBaseUrl: null,
        models: [{ modelId: "model-id", modelName: "model-name" }]
      },
      adapter: { providerName: "OpenAI", invoke }
    })
  };
  const credentials = {
    useCredential: jest.fn(
      async (
        _workspaceId: string,
        _providerId: string,
        operation: (credential: { id: string; secret: string }) => Promise<void>
      ) => operation({ id: "credential-id", secret: "provider-secret" })
    )
  };
  const repository = {
    findModelPricing: jest.fn().mockResolvedValue({
      inputCostPerMillion: "1.000000",
      outputCostPerMillion: "2.000000",
      currency: "USD"
    }),
    start: jest.fn().mockResolvedValue({
      id: "invocation-id",
      requestId: "request-id",
      workspaceId: "workspace-id",
      status: "PENDING"
    }),
    stageSuccess: jest.fn().mockResolvedValue("recovery-id"),
    stageFailure: jest.fn().mockResolvedValue("recovery-id"),
    complete: jest.fn().mockResolvedValue(undefined),
    failWithRuntime: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined)
  };
  const reservation = {
    id: "reservation-id",
    workspaceId: "workspace-id",
    requestId: "request-id",
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
  };
  const runtime = {
    begin: jest.fn().mockResolvedValue(reservation),
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
  const service = new InvocationOrchestratorService(
    routing as never,
    providers as never,
    credentials as never,
    repository as never,
    new UsageNormalizerService(),
    new CostNormalizerService(),
    new ResponseNormalizerService(),
    new ErrorNormalizerService(),
    {
      getOrThrow: jest.fn().mockReturnValue(options.timeoutMs ?? 1_000)
    } as never,
    runtime as never
  );
  return { service, routing, providers, credentials, repository, invoke, runtime };
}

describe("InvocationOrchestratorService", () => {
  it("executes the lifecycle and never propagates credential material", async () => {
    const harness = createHarness({});

    const response = await harness.service.invoke(command);

    expect(harness.routing.route).toHaveBeenCalledWith({
      workspaceId: "workspace-id"
    });
    expect(harness.credentials.useCredential).toHaveBeenCalledWith(
      "workspace-id",
      "provider-id",
      expect.any(Function)
    );
    expect(harness.repository.complete).toHaveBeenCalledTimes(1);
    expect(harness.repository.fail).not.toHaveBeenCalled();
    expect(harness.runtime.begin).toHaveBeenCalledWith(command);
    expect(harness.runtime.validateModel).toHaveBeenCalledTimes(1);
    expect(harness.runtime.recordFailure).not.toHaveBeenCalled();
    expect(harness.runtime.release).not.toHaveBeenCalled();
    expect(JSON.stringify(harness.invoke.mock.calls)).toContain('"maxOutputTokens":10');
    expect(JSON.stringify(response)).not.toContain("provider-secret");
    expect(JSON.stringify(harness.repository.complete.mock.calls)).not.toContain("provider-secret");
  });

  it("classifies timeout failures and closes the pending lifecycle", async () => {
    const harness = createHarness({ neverResolve: true, timeoutMs: 5 });

    await expect(harness.service.invoke(command)).rejects.toThrow("AI provider request timed out");
    expect(harness.repository.failWithRuntime).toHaveBeenCalledTimes(1);
    expect(harness.repository.complete).not.toHaveBeenCalled();
    expect(JSON.stringify(harness.repository.failWithRuntime.mock.calls)).toContain(
      '"id":"reservation-id"'
    );
    expect(JSON.stringify(harness.repository.failWithRuntime.mock.calls)).toContain(
      '"timeoutReason":"AI provider request timed out"'
    );
    expect(harness.runtime.release).not.toHaveBeenCalled();
  });

  it("rejects before routing and provider execution when pre-flight protection fails", async () => {
    const harness = createHarness({});
    harness.runtime.begin.mockRejectedValue(
      new AiContractError("RATE_LIMITED", "AI runtime quota exceeded")
    );

    await expect(harness.service.invoke(command)).rejects.toThrow(
      "AI runtime quota exceeded"
    );

    expect(harness.routing.route).not.toHaveBeenCalled();
    expect(harness.providers.create).not.toHaveBeenCalled();
    expect(harness.credentials.useCredential).not.toHaveBeenCalled();
    expect(harness.invoke).not.toHaveBeenCalled();
    expect(harness.repository.start).not.toHaveBeenCalled();
  });

  it("retains ownership when durable failure finalization is deferred", async () => {
    const harness = createHarness({ neverResolve: true, timeoutMs: 5 });
    harness.repository.failWithRuntime.mockRejectedValue(
      new Error("persistence unavailable")
    );

    await expect(harness.service.invoke(command)).rejects.toThrow(
      "persistence unavailable"
    );

    expect(harness.repository.failWithRuntime).toHaveBeenCalledTimes(2);
    expect(harness.runtime.release).not.toHaveBeenCalled();
  });

  it("rejects provider output that exceeds the reserved maximum", async () => {
    const harness = createHarness({
      providerResult: {
        content: "Oversized",
        usage: { inputTokens: 10, outputTokens: 11, cachedTokens: 0 }
      }
    });

    await expect(harness.service.invoke(command)).rejects.toThrow(
      "AI provider output exceeded the reserved token limit"
    );

    expect(harness.repository.failWithRuntime).toHaveBeenCalledTimes(1);
    expect(harness.repository.complete).not.toHaveBeenCalled();
  });

  it("does not release or finalize the reservation before provider completion", async () => {
    const harness = createHarness({});
    let resolveProvider!: (result: ProviderExecutionResult) => void;
    harness.invoke.mockImplementation(
      () =>
        new Promise<ProviderExecutionResult>((resolve) => {
          resolveProvider = resolve;
        })
    );

    const invocation = harness.service.invoke(command);
    await new Promise((resolve) => setImmediate(resolve));

    expect(harness.runtime.recordFailure).not.toHaveBeenCalled();
    expect(harness.runtime.release).not.toHaveBeenCalled();

    resolveProvider({
      content: "Response",
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 }
    });
    await expect(invocation).resolves.toMatchObject({ content: "Response" });
    expect(harness.repository.complete).toHaveBeenCalledTimes(1);
    expect(harness.runtime.release).not.toHaveBeenCalled();
  });

  it("recovers a transient atomic completion failure through idempotent replay", async () => {
    const harness = createHarness({});
    harness.repository.complete
      .mockRejectedValueOnce(new Error("commit acknowledgement lost"))
      .mockResolvedValueOnce(undefined);

    await expect(harness.service.invoke(command)).resolves.toMatchObject({
      content: "Response"
    });

    expect(harness.repository.complete).toHaveBeenCalledTimes(2);
    expect(harness.runtime.recordFailure).not.toHaveBeenCalled();
    expect(harness.runtime.release).not.toHaveBeenCalled();
  });
});
