import { ExecutionKernelService } from "./execution-kernel.service";

describe("ExecutionKernelService", () => {
  const repository = {
    createRequest: jest.fn(), createRun: jest.fn(), transition: jest.fn(),
    cancel: jest.fn(), recordFailure: jest.fn(), recordStep: jest.fn(),
    appendEvent: jest.fn(), appendLog: jest.fn(), getRequest: jest.fn(),
    getRun: jest.fn(), listRequests: jest.fn(), listRuns: jest.fn()
  };
  const service = new ExecutionKernelService(repository as never);
  beforeEach(() => jest.clearAllMocks());

  it("delegates lifecycle commands with workspace and actor context", async () => {
    await service.createRequest("workspace", "actor", {
      sourceType: "MANUAL", correlationId: "correlation", idempotencyKey: "key"
    });
    await service.createRun("workspace", "actor", "request", {});
    await service.transition("workspace", "actor", "run", { status: "QUEUED" });
    await service.cancel("workspace", "actor", "run", { reason: "User request" });
    await service.recordFailure("workspace", "actor", "run", { code: "FAILED", message: "Failure" });
    await service.recordStep("workspace", "actor", "run", {
      sequence: 1, stepType: "PREPARE", status: "PENDING"
    });
    expect(repository.createRequest).toHaveBeenCalledWith("workspace", "actor", expect.anything());
    expect(repository.transition).toHaveBeenCalledWith("workspace", "actor", "run", { status: "QUEUED" });
    expect(repository.cancel).toHaveBeenCalledWith("workspace", "actor", "run", { reason: "User request" });
  });

  it("delegates append-only diagnostics", async () => {
    await service.appendEvent("workspace", "actor", "run", { eventType: "diagnostic" });
    await service.appendLog("workspace", "actor", "run", { level: "INFO", message: "Ready" });
    expect(repository.appendEvent).toHaveBeenCalled();
    expect(repository.appendLog).toHaveBeenCalled();
  });

  it("applies stable pagination defaults", async () => {
    await service.listRequests("workspace", {});
    await service.listRuns("workspace", {});
    expect(repository.listRequests).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace", page: 1, limit: 25
    }));
    expect(repository.listRuns).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace", page: 1, limit: 25
    }));
  });
});
