import { QuotaService } from "./quota.service";

describe("QuotaService", () => {
  it("merges workspace overrides over configured defaults", async () => {
    const repository = {
      findWorkspaceLimits: jest.fn().mockResolvedValue({
        dailyRequestLimit: 5,
        monthlyRequestLimit: null,
        dailyTokenLimit: null,
        monthlyTokenLimit: null,
        dailyCostLimit: "2.000000",
        monthlyCostLimit: null,
        maxConcurrentInvocations: 1,
        maxQueueDepth: null,
        maxContextTokens: null,
        maxOutputTokens: 500
      })
    };
    const defaults: Record<string, unknown> = {
      "ai.runtime.dailyRequestLimit": 10,
      "ai.runtime.monthlyRequestLimit": 100,
      "ai.runtime.dailyTokenLimit": 1_000,
      "ai.runtime.monthlyTokenLimit": 10_000,
      "ai.runtime.dailyCostLimit": "10.000000",
      "ai.runtime.monthlyCostLimit": "100.000000",
      "ai.runtime.maxConcurrentInvocations": 2,
      "ai.runtime.maxQueueDepth": 3,
      "ai.runtime.maxContextTokens": 4_000,
      "ai.runtime.maxOutputTokens": 1_000
    };
    const service = new QuotaService(repository as never, {
      getOrThrow: (key: string) => defaults[key]
    } as never);

    await expect(service.limitsFor("workspace-id")).resolves.toEqual({
      dailyRequestLimit: 5,
      monthlyRequestLimit: 100,
      dailyTokenLimit: 1_000,
      monthlyTokenLimit: 10_000,
      dailyCostLimit: "2.000000",
      monthlyCostLimit: "100.000000",
      maxConcurrentInvocations: 1,
      maxQueueDepth: 3,
      maxContextTokens: 4_000,
      maxOutputTokens: 500
    });
  });
});
