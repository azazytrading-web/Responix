import { AiContractError } from "../contracts";
import { RuntimeProtectionService } from "./runtime-protection.service";

const request = {
  requestId: "request-id",
  workspaceId: "workspace-id",
  membershipId: "membership-id",
  taskType: "completion",
  messages: [{ role: "user", content: "Hello" }],
  mode: "sync"
} as const;

function createHarness(enabled = true) {
  const estimate = {
    inputTokens: 2,
    outputTokens: 10,
    totalTokens: 12,
    estimatedCost: "0.000120"
  };
  const limits = {
    dailyRequestLimit: 10,
    monthlyRequestLimit: 100,
    dailyTokenLimit: 1_000,
    monthlyTokenLimit: 10_000,
    dailyCostLimit: "1.000000",
    monthlyCostLimit: "10.000000",
    maxConcurrentInvocations: 2,
    maxQueueDepth: 2,
    maxContextTokens: 100,
    maxOutputTokens: 20
  };
  const reservation = {
    id: "reservation-id",
    workspaceId: "workspace-id",
    requestId: "request-id",
    ownerToken: "11111111-1111-4111-8111-111111111111",
    status: "ACTIVE",
    estimate,
    queuedAt: new Date(),
    activatedAt: new Date(),
    leaseExpiresAt: new Date(Date.now() + 60_000),
    queueWaitMs: 0,
    reservedAt: Date.now()
  };
  const estimator = { estimate: jest.fn().mockReturnValue(estimate) };
  const quotas = { limitsFor: jest.fn().mockResolvedValue(limits) };
  const capabilities = {
    validateWorkspaceEstimate: jest.fn(),
    validateModel: jest.fn()
  };
  const reservations = {
    reserve: jest.fn().mockResolvedValue(reservation),
    release: jest.fn().mockResolvedValue(undefined)
  };
  const accounting = {
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined)
  };
  const service = new RuntimeProtectionService(
    { getOrThrow: jest.fn().mockReturnValue(enabled) } as never,
    estimator as never,
    quotas as never,
    capabilities,
    reservations as never,
    accounting as never
  );
  return {
    service,
    estimator,
    quotas,
    capabilities,
    reservations,
    accounting,
    estimate,
    limits,
    reservation
  };
}

describe("RuntimeProtectionService", () => {
  it("rejects immediately when the global kill switch is disabled", async () => {
    const harness = createHarness(false);

    await expect(harness.service.begin(request as never)).rejects.toEqual(
      new AiContractError("PROVIDER_UNAVAILABLE", "AI runtime is disabled")
    );

    expect(harness.estimator.estimate).not.toHaveBeenCalled();
    expect(harness.quotas.limitsFor).not.toHaveBeenCalled();
    expect(harness.reservations.reserve).not.toHaveBeenCalled();
  });

  it("validates estimates before creating an atomic reservation", async () => {
    const harness = createHarness();

    await expect(harness.service.begin(request as never)).resolves.toBe(
      harness.reservation
    );

    expect(harness.quotas.limitsFor).toHaveBeenCalledWith("workspace-id");
    expect(harness.capabilities.validateWorkspaceEstimate).toHaveBeenCalledWith(
      harness.estimate,
      harness.limits
    );
    expect(harness.reservations.reserve).toHaveBeenCalledWith({
      workspaceId: "workspace-id",
      requestId: "request-id",
      estimate: harness.estimate,
      limits: harness.limits
    });
  });

  it("does not reserve when capability validation rejects the request", async () => {
    const harness = createHarness();
    harness.capabilities.validateWorkspaceEstimate.mockImplementation(() => {
      throw new AiContractError("CONTEXT_LIMIT_EXCEEDED", "Context token limit exceeded");
    });

    await expect(harness.service.begin(request as never)).rejects.toThrow(
      "Context token limit exceeded"
    );
    expect(harness.reservations.reserve).not.toHaveBeenCalled();
  });
});
