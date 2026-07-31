/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { WorkflowRuntimeStatus } from "@prisma/client";
import { WorkflowRuntimeService } from "./workflow-runtime.service";
import { WorkflowRuntimeValidator } from "./workflow-runtime.validator";

describe("WorkflowRuntimeService", () => {
  const snapshot = { name: "Runtime", slug: "runtime", variables: [], inputs: [], outputs: [], branches: [],
    nodes: [{ id: "start", type: "START" }, { id: "end", type: "END" }],
    edges: [{ id: "route", sourceNodeId: "start", targetNodeId: "end" }] };
  let status: WorkflowRuntimeStatus;
  const execution = () => ({ id: "execution", executionRunId: "run", workflowVersionId: "version",
    status, timeoutMs: 5000, deadlineAt: new Date(Date.now() + 5000), depth: 0, maxDepth: 10,
    maxNodeExecutions: 100, traceId: "trace", pendingNodeKeys: [], completedNodeKeys: [], nodes: [],
    runtimeContext: {}, compensationPlan: [], output: {} });
  const repository = {
    findByIdempotency: jest.fn(), loadVersion: jest.fn(), create: jest.fn(), transition: jest.fn(),
    get: jest.fn(), startNode: jest.fn(), finishNode: jest.fn(), saveProgress: jest.fn(),
    diagnostic: jest.fn(), list: jest.fn(), history: jest.fn(), diagnostics: jest.fn(), metrics: jest.fn()
  };
  const kernel = { createRequest: jest.fn(), createRun: jest.fn(), transition: jest.fn(), getRun: jest.fn(),
    recordFailure: jest.fn(), cancel: jest.fn() };
  const agents = { execute: jest.fn(), stream: jest.fn() };
  const streams = { get: jest.fn() };
  const memory = { commitWrites: jest.fn() };
  const tools = { execute: jest.fn() };
  const service = new WorkflowRuntimeService(repository as never, new WorkflowRuntimeValidator(), kernel as never,
    agents as never, streams as never, memory as never, tools as never);

  beforeEach(() => {
    jest.clearAllMocks(); status = WorkflowRuntimeStatus.CREATED;
    repository.findByIdempotency.mockResolvedValue(null);
    repository.loadVersion.mockResolvedValue({ id: "version", workflowId: "workflow", snapshot,
      snapshotHash: "hash" });
    repository.create.mockImplementation(async () => execution());
    repository.transition.mockImplementation(async (_w: string, _a: string, _id: string, next: WorkflowRuntimeStatus) => {
      status = next; return execution();
    });
    repository.get.mockImplementation(async () => execution());
    repository.startNode.mockImplementation(async (_w: string, _a: string, _e: string, node: { id: string }) =>
      ({ id: `node-${node.id}` }));
    repository.finishNode.mockResolvedValue({}); repository.saveProgress.mockResolvedValue({});
    kernel.createRequest.mockResolvedValue({ id: "request" });
    kernel.createRun.mockResolvedValue({ id: "run", stateVersion: 0 });
    kernel.getRun.mockResolvedValue({ id: "run", status: "RUNNING", stateVersion: 3 });
    kernel.transition.mockResolvedValue({});
  });

  it("executes a sequential immutable graph through the Execution Kernel", async () => {
    const value = await service.execute("workspace", "actor", { workflowVersionId: crypto.randomUUID(),
      correlationId: "correlation", idempotencyKey: "idempotency" });
    expect(value.status).toBe(WorkflowRuntimeStatus.COMPLETED);
    expect(repository.startNode).toHaveBeenCalledTimes(2);
    expect(repository.finishNode).toHaveBeenCalledTimes(2);
    expect(repository.transition.mock.calls.map((call) => call[3])).toEqual([
      "QUEUED", "PREPARING", "RUNNING", "COMPLETED"
    ]);
    expect(kernel.createRun).toHaveBeenCalledWith("workspace", "actor", "request", expect.objectContaining({
      runtimeMetadata: expect.objectContaining({ orchestrationType: "WORKFLOW" })
    }));
    expect(kernel.transition).toHaveBeenLastCalledWith("workspace", "actor", "run", expect.objectContaining({
      status: "SUCCEEDED"
    }));
    expect(agents.execute).not.toHaveBeenCalled();
  });

  it("reuses a workspace-scoped idempotent execution without starting dependencies", async () => {
    repository.findByIdempotency.mockResolvedValue({ id: "existing", status: "COMPLETED" });
    await expect(service.execute("workspace", "actor", { workflowVersionId: crypto.randomUUID(),
      correlationId: "correlation", idempotencyKey: "same" })).resolves.toMatchObject({ id: "existing" });
    expect(repository.loadVersion).not.toHaveBeenCalled();
    expect(kernel.createRequest).not.toHaveBeenCalled();
  });
});
