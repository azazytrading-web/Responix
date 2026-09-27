import type { AiResponseContract } from "./contracts";
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { AiController } from "./ai.controller";

describe("AiController", () => {
  const providers = { discover: jest.fn() };
  const providerManagement = { get: jest.fn(), configure: jest.fn(), validate: jest.fn() };
  const routing = { route: jest.fn() };
  const invocations = { invoke: jest.fn() };
  const controller = new AiController(providers as never, providerManagement as never, routing as never, invocations as never);

  beforeEach(() => jest.clearAllMocks());

  it("discovers providers only for the authenticated workspace", async () => {
    providers.discover.mockResolvedValue([]);

    await expect(controller.discover({ id: "trusted-workspace" })).resolves.toEqual([]);
    expect(providers.discover).toHaveBeenCalledWith("trusted-workspace");
  });

  it("scopes provider configuration and validation to tenant context", async()=>{
    providerManagement.get.mockResolvedValue({});providerManagement.configure.mockResolvedValue({});providerManagement.validate.mockResolvedValue({});
    const request={tenantContext:{workspace:{id:"w1"},user:{id:"u1"}}} as never;
    await controller.providerConfiguration({id:"w1"},"p1");await controller.configureProvider(request,"p1",{enabled:true});await controller.validateProvider(request,"p1");
    expect(providerManagement.get).toHaveBeenCalledWith("w1","p1");expect(providerManagement.configure).toHaveBeenCalledWith("w1","u1","p1",{enabled:true});expect(providerManagement.validate).toHaveBeenCalledWith("w1","u1","p1");
    expect(Reflect.getMetadata("permissions",AiController.prototype.providerConfiguration)).toEqual(["ai.providers.read"]);expect(Reflect.getMetadata("permissions",AiController.prototype.configureProvider)).toEqual(["ai.providers.write"]);expect(Reflect.getMetadata("permissions",AiController.prototype.validateProvider)).toEqual(["ai.providers.validate"]);
  });

  it("resolves routes using the authenticated workspace", async () => {
    routing.route.mockResolvedValue({
      providerId: "provider-id",
      modelId: "model-id",
      decisionFactors: {},
      fallbacks: []
    });

    await controller.resolveRoute({ id: "trusted-workspace" }, { vision: true });

    expect(routing.route).toHaveBeenCalledWith({
      workspaceId: "trusted-workspace",
      vision: true
    });
  });

  it("uses the HTTP request ID and never supplies tenant identifiers", async () => {
    const response: AiResponseContract = {
      requestId: "http-request-id",
      providerId: "provider-id",
      modelId: "model-id",
      content: "Response",
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
      cost: {
        inputCost: "0.000001",
        outputCost: "0.000001",
        totalCost: "0.000002",
        currency: "USD"
      },
      routing: { providerId: "provider-id", modelId: "model-id", decisionFactors: {} }
    };
    invocations.invoke.mockResolvedValue(response);

    await controller.invoke(
      { id: "http-request-id" },
      {
        taskType: "completion",
        messages: [{ role: "user", content: "Hello" }],
        mode: "sync"
      }
    );

    expect(invocations.invoke).toHaveBeenCalledWith({
      requestId: "http-request-id",
      taskType: "completion",
      messages: [{ role: "user", content: "Hello" }],
      mode: "sync",
      signal: expect.any(AbortSignal)
    });
    expect(JSON.stringify(invocations.invoke.mock.calls)).not.toContain("workspaceId");
    expect(JSON.stringify(invocations.invoke.mock.calls)).not.toContain("membershipId");
  });
});
