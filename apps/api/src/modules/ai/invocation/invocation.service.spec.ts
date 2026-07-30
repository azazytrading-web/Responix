import { UnauthorizedException } from "@nestjs/common";
import type { AiRequestContract } from "../contracts";
import { InvocationService } from "./invocation.service";
import { RequestNormalizerService } from "./request-normalizer.service";

const request: AiRequestContract = {
  requestId: "request-id",
  workspaceId: "forged-workspace",
  membershipId: "forged-membership",
  taskType: "completion",
  messages: [{ role: "user", content: "Hello" }],
  mode: "sync"
};

function tenant(workspaceId: string, membershipId: string) {
  return {
    workspace: { id: workspaceId },
    membership: { id: membershipId }
  };
}

describe("InvocationService", () => {
  it("delegates workspace-scoped history queries", async () => {
    const repository = { list: jest.fn().mockResolvedValue({ data: [], pagination: {} }) };
    const service = new InvocationService(
      { resolved: tenant("workspace", "membership") } as never,
      new RequestNormalizerService(),
      { invoke: jest.fn() } as never,
      repository as never
    );
    await service.list("workspace", { page: 2, limit: 10 });
    expect(repository.list).toHaveBeenCalledWith("workspace", { page: 2, limit: 10 });
  });
  it("uses the authenticated request-scoped tenant and ignores caller identifiers", async () => {
    const orchestrator = { invoke: jest.fn().mockResolvedValue({ requestId: "request-id" }) };
    const tenantContext = { resolved: tenant("authenticated-workspace", "active-membership") };
    const service = new InvocationService(
      tenantContext as never,
      new RequestNormalizerService(),
      orchestrator as never,
      { list: jest.fn() } as never
    );

    await service.invoke(request);

    expect(orchestrator.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "authenticated-workspace",
        membershipId: "active-membership"
      })
    );
    expect(orchestrator.invoke).not.toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "forged-workspace" })
    );
  });

  it("keeps tenant enforcement request-scoped", async () => {
    const firstOrchestrator = { invoke: jest.fn().mockResolvedValue({}) };
    const secondOrchestrator = { invoke: jest.fn().mockResolvedValue({}) };
    const first = new InvocationService(
      { resolved: tenant("workspace-one", "membership-one") } as never,
      new RequestNormalizerService(),
      firstOrchestrator as never,
      { list: jest.fn() } as never
    );
    const second = new InvocationService(
      { resolved: tenant("workspace-two", "membership-two") } as never,
      new RequestNormalizerService(),
      secondOrchestrator as never,
      { list: jest.fn() } as never
    );

    await first.invoke(request);
    await second.invoke(request);

    expect(firstOrchestrator.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-one" })
    );
    expect(secondOrchestrator.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "workspace-two" })
    );
  });

  it("cannot execute without a resolved authenticated tenant", () => {
    const tenantContext = {
      get resolved(): never {
        throw new UnauthorizedException("Tenant context has not been resolved");
      }
    };
    const orchestrator = { invoke: jest.fn() };
    const service = new InvocationService(
      tenantContext as never,
      new RequestNormalizerService(),
      orchestrator as never,
      { list: jest.fn() } as never
    );

    expect(() => service.invoke(request)).toThrow(UnauthorizedException);
    expect(orchestrator.invoke).not.toHaveBeenCalled();
  });
});
