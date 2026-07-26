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
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined)
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
    } as never
  );
  return { service, routing, providers, credentials, repository, invoke };
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
    expect(JSON.stringify(response)).not.toContain("provider-secret");
    expect(JSON.stringify(harness.repository.complete.mock.calls)).not.toContain("provider-secret");
  });

  it("classifies timeout failures and closes the pending lifecycle", async () => {
    const harness = createHarness({ neverResolve: true, timeoutMs: 5 });

    await expect(harness.service.invoke(command)).rejects.toThrow("AI provider request timed out");
    expect(harness.repository.fail).toHaveBeenCalledWith("invocation-id", "workspace-id", {
      code: "PROVIDER_UNAVAILABLE",
      message: "AI provider request timed out",
      status: "FAILED"
    });
    expect(harness.repository.complete).not.toHaveBeenCalled();
  });
});
