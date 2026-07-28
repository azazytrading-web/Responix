import { AgentRuntimeService } from "./agent-runtime.service";

describe("AgentRuntimeService", () => {
  const repository = {
    prepare: jest.fn(),
    validate: jest.fn(),
    createSnapshot: jest.fn(),
    get: jest.fn(),
    resolveRuntime: jest.fn(),
    getSnapshot: jest.fn(),
    list: jest.fn()
  };
  const service = new AgentRuntimeService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("delegates preparation, validation, and snapshot operations with tenant context", async () => {
    const dto = {
      agentId: "agent",
      executionProfileId: "profile",
      executionRequestId: "request",
      context: { traceId: "trace" }
    };
    await service.prepare("workspace", "actor", dto);
    await service.validate("workspace", "actor", "runtime");
    await service.createSnapshot("workspace", "actor", "runtime");
    expect(repository.prepare).toHaveBeenCalledWith("workspace", "actor", dto);
    expect(repository.validate).toHaveBeenCalledWith("workspace", "actor", "runtime");
    expect(repository.createSnapshot).toHaveBeenCalledWith("workspace", "actor", "runtime");
  });

  it("delegates workspace-isolated reads and resolution", async () => {
    await service.get("workspace", "runtime");
    await service.resolve("workspace", "actor", "runtime");
    await service.getSnapshot("workspace", "snapshot");
    await service.list("workspace", { page: 2 });
    expect(repository.get).toHaveBeenCalledWith("workspace", "runtime");
    expect(repository.resolveRuntime).toHaveBeenCalledWith("workspace", "actor", "runtime");
    expect(repository.list).toHaveBeenCalledWith("workspace", { page: 2 });
  });
});

