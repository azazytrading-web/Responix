/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AiContractError } from "../contracts";
import type {
  AiRequestContract, ProviderExecutionRequest, ProviderExecutionResult
} from "../contracts";
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
  const invoke = jest.fn<Promise<ProviderExecutionResult>, [ProviderExecutionRequest]>(
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
    }),
    isCandidateEligible: jest.fn().mockResolvedValue(true)
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
    recordProviderTransition: jest.fn().mockResolvedValue(undefined),
    complete: jest.fn().mockResolvedValue(undefined),
    completeUnknownUsage: jest.fn().mockResolvedValue(undefined),
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
      getOrThrow: jest.fn().mockReturnValue(options.timeoutMs ?? 1_000),
      get: jest.fn((key: string) => key === "ai.retry.maxAttempts" ? 3 : 0)
    } as never,
    runtime as never
  );
  return { service, routing, providers, credentials, repository, invoke, runtime };
}

describe("InvocationOrchestratorService", () => {
  it("completes with explicit UNKNOWN usage without fabricating token counts or cost", async () => {
    const harness = createHarness({});
    const stream = jest.fn(async (
      _request: ProviderExecutionRequest,
      _credential: unknown,
      emit: (event: { type: "delta" | "completed"; content?: string }) => Promise<void>
    ) => {
      await emit({ type: "delta", content: "Hello" });
      await emit({ type: "completed" });
    });
    harness.providers.create.mockResolvedValue({
      provider: {
        apiBaseUrl: null,
        models: [{ modelId: "model-id", modelName: "model-name" }]
      },
      adapter: { providerName: "OpenAI", stream }
    });
    const streamed = new RequestNormalizerService().normalizeStream(
      { ...request, mode: "stream" },
      {
        workspace: { id: "workspace-id" },
        membership: { id: "membership-id" }
      } as never
    );

    const result = await harness.service.stream(streamed, jest.fn());

    expect(result.usage).toBeNull();
    expect(result.cost).toBeNull();
    expect(harness.repository.completeUnknownUsage).toHaveBeenCalledWith(
      expect.objectContaining({ responseContent: "Hello" })
    );
    expect(harness.repository.complete).not.toHaveBeenCalled();
  });

  it("persists exactly one final usage and cost record after provider stream completion", async () => {
    const harness = createHarness({});
    const stream = jest.fn(async (
      _request: ProviderExecutionRequest,
      _credential: unknown,
      emit: (event: { type: "delta" | "completed"; usage?: ProviderExecutionResult["usage"]; content?: string }) => Promise<void>
    ) => {
      await emit({ type: "delta", content: "Hello" });
      await emit({ type: "completed", usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 1 } });
    });
    harness.providers.create.mockResolvedValue({
      provider: { apiBaseUrl: null, models: [{ modelId: "model-id", modelName: "model-name" }] },
      adapter: { providerName: "OpenAI", stream }
    });
    const streamed = new RequestNormalizerService().normalizeStream({ ...request, mode: "stream" }, {
      workspace: { id: "workspace-id" }, membership: { id: "membership-id" }
    } as never);
    await harness.service.stream(streamed, jest.fn());
    expect(harness.repository.complete).toHaveBeenCalledTimes(1);
    expect(harness.repository.complete).toHaveBeenCalledWith(expect.objectContaining({
      usage: expect.objectContaining({ inputTokens: 10, outputTokens: 5, cachedTokens: 1 }),
      responseContent: "Hello"
    }));
    expect(harness.repository.failWithRuntime).not.toHaveBeenCalled();
  });

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
    harness.routing.route.mockResolvedValue({
      providerId: "provider-id", modelId: "model-id", decisionFactors: {},
      fallbacks: [{ providerId: "fallback-provider", modelId: "fallback-model" }]
    });

    await expect(harness.service.invoke(command)).rejects.toThrow(
      "AI provider output exceeded the reserved token limit"
    );

    expect(harness.repository.failWithRuntime).toHaveBeenCalledTimes(1);
    expect(harness.repository.complete).not.toHaveBeenCalled();
    expect(harness.routing.isCandidateEligible).not.toHaveBeenCalled();
    expect(harness.invoke).toHaveBeenCalledTimes(1);
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

  it("retries bounded transient provider failures and accounts for attempts", async () => {
    const harness = createHarness({});
    harness.invoke
      .mockRejectedValueOnce(new AiContractError("RATE_LIMITED", "Retry"))
      .mockResolvedValueOnce({
        content: "Recovered", usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 }
      });
    await expect(harness.service.invoke(command)).resolves.toMatchObject({ content: "Recovered" });
    expect(harness.invoke).toHaveBeenCalledTimes(2);
    expect(harness.repository.complete).toHaveBeenCalledWith(expect.objectContaining({
      runtime: expect.objectContaining({ retryCount: 1 })
    }));
  });

  it("uses the locked one-second and three-second retry delays", async () => {
    const harness = createHarness({});
    const retryDelay = (harness.service as unknown as {
      retryDelay: (count: number, lease: AbortSignal, request?: AbortSignal) => Promise<void>
    }).retryDelay;
    const lease = new AbortController().signal;
    jest.useFakeTimers();
    try {
      let firstComplete = false;
      const first = retryDelay.call(harness.service, 1, lease).then(() => { firstComplete = true; });
      await jest.advanceTimersByTimeAsync(999);
      expect(firstComplete).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await first;
      expect(firstComplete).toBe(true);

      let secondComplete = false;
      const second = retryDelay.call(harness.service, 2, lease).then(() => { secondComplete = true; });
      await jest.advanceTimersByTimeAsync(2_999);
      expect(secondComplete).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await second;
      expect(secondComplete).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not retry non-transient provider validation failures", async () => {
    const harness = createHarness({});
    harness.invoke.mockRejectedValue(new AiContractError("RESPONSE_INVALID", "Invalid"));
    await expect(harness.service.invoke(command)).rejects.toThrow("Invalid");
    expect(harness.invoke).toHaveBeenCalledTimes(1);
  });

  it("executes the ordered fallback candidate and persists the provider transition", async () => {
    const harness = createHarness({});
    harness.routing.route.mockResolvedValue({
      providerId: "provider-id", modelId: "model-id", decisionFactors: {},
      fallbacks: [{ providerId: "fallback-provider", modelId: "fallback-model" }]
    });
    harness.invoke
      .mockRejectedValueOnce(new AiContractError("CREDENTIAL_UNAVAILABLE", "No credential"))
      .mockResolvedValueOnce({ content: "Fallback response", usage: { inputTokens: 2, outputTokens: 2 } });
    harness.providers.create.mockImplementation((_workspaceId: string, selectedProviderId: string) => ({
      provider: { apiBaseUrl: null, models: [{ modelId: selectedProviderId === "provider-id" ? "model-id" : "fallback-model", modelName: "model-name" }] },
      adapter: { providerName: "OpenAI", invoke: harness.invoke }
    }) as never);

    await expect(harness.service.invoke(command)).resolves.toMatchObject({
      providerId: "fallback-provider", modelId: "fallback-model", content: "Fallback response"
    });
    expect(harness.routing.isCandidateEligible).toHaveBeenCalledWith(
      { workspaceId: "workspace-id" }, { providerId: "fallback-provider", modelId: "fallback-model" }
    );
    expect(harness.repository.recordProviderTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromProviderId: "provider-id", toProviderId: "fallback-provider", fallbackIndex: 1
    }));
    expect(harness.repository.complete).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "fallback-provider", modelId: "fallback-model"
    }));
  });

  it("falls back to the next provider when streaming fails before visible output", async () => {
    const harness = createHarness({});
    harness.routing.route.mockResolvedValue({
      providerId: "provider-id", modelId: "model-id", decisionFactors: {},
      fallbacks: [{ providerId: "fallback-provider", modelId: "fallback-model" }]
    });
    const primaryStream = jest.fn().mockRejectedValue(
      new AiContractError("PROVIDER_UNAVAILABLE", "Stream disconnected")
    );
    const fallbackStream = jest.fn(async (
      _request: ProviderExecutionRequest,
      _credential: unknown,
      emit: (event: { type: "delta" | "completed"; content?: string }) => Promise<void>
    ) => {
      await emit({ type: "delta", content: "Fallback stream" });
      await emit({ type: "completed" });
    });
    harness.providers.create.mockImplementation((_workspaceId: string, selectedProviderId: string) => ({
      provider: {
        apiBaseUrl: null,
        models: [{ modelId: selectedProviderId === "provider-id" ? "model-id" : "fallback-model", modelName: "model-name" }]
      },
      adapter: { providerName: "OpenAI", stream: selectedProviderId === "provider-id" ? primaryStream : fallbackStream }
    }) as never);
    const streamed = new RequestNormalizerService().normalizeStream({ ...request, mode: "stream" }, {
      workspace: { id: "workspace-id" }, membership: { id: "membership-id" }
    } as never);

    await expect(harness.service.stream(streamed, jest.fn())).resolves.toMatchObject({
      providerId: "fallback-provider", modelId: "fallback-model", responseContent: "Fallback stream"
    });
    expect(harness.repository.recordProviderTransition).toHaveBeenCalledTimes(1);
    expect(fallbackStream).toHaveBeenCalledTimes(1);
  });

  it("never replays a stream after user-visible output has been emitted", async () => {
    const harness = createHarness({});
    harness.routing.route.mockResolvedValue({
      providerId: "provider-id", modelId: "model-id", decisionFactors: {},
      fallbacks: [{ providerId: "fallback-provider", modelId: "fallback-model" }]
    });
    const primaryStream = jest.fn(async (
      _request: ProviderExecutionRequest,
      _credential: unknown,
      emit: (event: { type: "delta" | "completed"; content?: string }) => Promise<void>
    ) => {
      await emit({ type: "delta", content: "Partial output" });
      throw new AiContractError("PROVIDER_UNAVAILABLE", "Stream disconnected");
    });
    harness.providers.create.mockImplementation(() => ({
      provider: { apiBaseUrl: null, models: [{ modelId: "model-id", modelName: "model-name" }] },
      adapter: { providerName: "OpenAI", stream: primaryStream }
    }) as never);
    const streamed = new RequestNormalizerService().normalizeStream({ ...request, mode: "stream" }, {
      workspace: { id: "workspace-id" }, membership: { id: "membership-id" }
    } as never);

    await expect(harness.service.stream(streamed, jest.fn())).rejects.toThrow("Stream disconnected");
    expect(harness.providers.create).toHaveBeenCalledTimes(1);
    expect(harness.repository.recordProviderTransition).not.toHaveBeenCalled();
  });

  it("propagates request cancellation into provider execution and accounting", async () => {
    const harness = createHarness({ timeoutMs: 1_000 });
    const controller = new AbortController();
    harness.invoke.mockImplementation(({ signal }: { signal: AbortSignal }) =>
      new Promise<ProviderExecutionResult>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("cancelled");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      })
    );
    const invocation = harness.service.invoke({ ...command, signal: controller.signal });
    controller.abort();
    await expect(invocation).rejects.toThrow("AI invocation was cancelled");
    expect(harness.repository.failWithRuntime).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: "CANCELLED", status: "CANCELLED" }),
      runtime: expect.objectContaining({ cancelled: true })
    }));
  });
});
