import { ExecutionKernelStatus, ExecutionSourceType } from "@prisma/client";
import { AgentExecutionService } from "./agent-execution.service";

describe("AgentExecutionService", () => {
  const dto = {
    agentRuntimeSnapshotId: "11111111-1111-4111-8111-111111111111",
    promptExecutionPayloadId: "22222222-2222-4222-8222-222222222222",
    providerRuntimeSnapshotId: "33333333-3333-4333-8333-333333333333",
    conversationRuntimeSnapshotId: "44444444-4444-4444-8444-444444444444",
    executionPipelineSnapshotId: "55555555-5555-4555-8555-555555555555",
    correlationId: "correlation", idempotencyKey: "idempotency"
  };
  const assets = {
    agent: { id: dto.agentRuntimeSnapshotId },
    prompt: { id: dto.promptExecutionPayloadId },
    provider: { id: dto.providerRuntimeSnapshotId },
    conversation: { id: dto.conversationRuntimeSnapshotId },
    pipeline: { id: dto.executionPipelineSnapshotId }
  };
  const setup = (diagnostics: unknown[] = []) => {
    const repository = {
      persist: jest.fn().mockResolvedValue({
        id: "orchestration", executionRequestId: "request", executionRunId: "run",
        planHash: "hash", status: "READY", runtimeDiagnostics: []
      }),
      findByRequest: jest.fn().mockResolvedValue(null),
      get: jest.fn().mockResolvedValue({ id: "orchestration", executionRunId: "run" }),
      cancel: jest.fn().mockResolvedValue({ id: "orchestration", status: "CANCELLED" }),
      list: jest.fn()
    };
    const kernel = {
      createRequest: jest.fn().mockResolvedValue({ id: "request" }),
      createRun: jest.fn().mockResolvedValue({ id: "run", stateVersion: 0 }),
      transition: jest.fn().mockResolvedValue({ id: "run", stateVersion: 1 }),
      recordFailure: jest.fn(), appendEvent: jest.fn(),
      getRun: jest.fn().mockResolvedValue({ id: "run", stateVersion: 1 }),
      cancel: jest.fn()
    };
    const validator = { validate: jest.fn().mockReturnValue(diagnostics) };
    const memory = {
      resolve: jest.fn().mockResolvedValue({
        snapshots: [], packageHash: "memory-hash", resolvedAt: "now"
      }),
      commitWrite: jest.fn(), commitWrites: jest.fn()
    };
    const service = new AgentExecutionService(
      repository as never, validator as never, kernel as never,
      { getSnapshot: jest.fn().mockResolvedValue(assets.agent) } as never,
      { get: jest.fn().mockResolvedValue(assets.prompt) } as never,
      { getSnapshot: jest.fn().mockResolvedValue(assets.provider) } as never,
      { getSnapshot: jest.fn().mockResolvedValue(assets.conversation) } as never,
      { getSnapshot: jest.fn().mockResolvedValue(assets.pipeline) } as never,
      { invoke: jest.fn() } as never,
      { cacheCompiled: jest.fn().mockResolvedValue({ packageHash: "a".repeat(64) }),
        cacheRendered: jest.fn(), cacheRetrieval: jest.fn(), cacheMemory: jest.fn(),
        cacheImmutable: jest.fn().mockResolvedValue({ id: "cache", keyHash: "b".repeat(64) }),
        recordProviderOutcome: jest.fn() } as never,
      { create: jest.fn(), connect: jest.fn(), start: jest.fn(), append: jest.fn(), complete: jest.fn(), cancel: jest.fn(), fail: jest.fn(), get: jest.fn() } as never,
      memory as never,
      { execute: jest.fn().mockResolvedValue({ documents: [] }) } as never,
      { execute: jest.fn(), providerContracts: jest.fn().mockResolvedValue([]) } as never
    );
    return { service, repository, kernel, validator, memory };
  };
  it("creates and queues a kernel lifecycle before persisting a ready plan", async () => {
    const { service, kernel, repository } = setup();
    await service.prepare("workspace", "actor", dto);
    expect(kernel.createRequest).toHaveBeenCalledWith("workspace", "actor",
      expect.objectContaining({ sourceType: ExecutionSourceType.SYSTEM }));
    expect(kernel.transition).toHaveBeenCalledWith("workspace", "actor", "run",
      expect.objectContaining({ status: ExecutionKernelStatus.QUEUED }));
    expect(repository.persist).toHaveBeenCalled();
    expect(kernel.appendEvent).toHaveBeenCalledWith("workspace", "actor", "run",
      expect.objectContaining({ eventType: "agent.execution.ready" }));
  });
  it("returns the existing orchestration for an idempotent request retry", async () => {
    const { service, kernel, repository } = setup();
    repository.findByRequest.mockResolvedValue({ id: "existing" });
    await expect(service.prepare("workspace", "actor", dto)).resolves.toEqual({ id: "existing" });
    expect(kernel.createRun).not.toHaveBeenCalled();
    expect(repository.persist).not.toHaveBeenCalled();
  });
  it("records dependency validation failure in Execution Kernel", async () => {
    const diagnostic = {
      severity: "ERROR", code: "MISMATCH", path: "asset", message: "invalid"
    };
    const { service, kernel } = setup([diagnostic]);
    await service.prepare("workspace", "actor", dto);
    expect(kernel.recordFailure).toHaveBeenCalledWith("workspace", "actor", "run",
      expect.objectContaining({ code: "RUNTIME_DEPENDENCY_INVALID" }));
    expect(kernel.appendEvent).not.toHaveBeenCalled();
  });
  it("persists diagnostics and fails the kernel when asset loading fails", async () => {
    const state = setup();
    (state.service as unknown as { agentRuntime: { getSnapshot: jest.Mock } })
      .agentRuntime.getSnapshot.mockRejectedValue(new Error("wrong workspace"));
    await state.service.prepare("workspace", "actor", dto);
    expect(state.repository.persist).toHaveBeenCalledWith(
      "workspace", "actor", "request", "run", dto,
      expect.any(Object), expect.arrayContaining([
        expect.objectContaining({ code: "RUNTIME_ASSET_LOADING_FAILED" })
      ])
    );
    expect(state.kernel.recordFailure).toHaveBeenCalled();
  });
  it("coordinates cancellation through Execution Kernel before persistence", async () => {
    const { service, kernel, repository } = setup();
    await service.cancel("workspace", "actor", "orchestration", { reason: "user request" });
    expect(kernel.cancel).toHaveBeenCalledWith("workspace", "actor", "run",
      { reason: "user request", expectedStateVersion: 1 });
    expect(repository.cancel).toHaveBeenCalledWith("workspace", "actor", "orchestration");
  });
  it("delegates isolated reads and filtering", async () => {
    const { service, repository } = setup();
    await service.get("workspace", "id");
    await service.list("workspace", { page: 2, limit: 10 });
    expect(repository.get).toHaveBeenCalledWith("workspace", "id");
    expect(repository.list).toHaveBeenCalledWith("workspace", { page: 2, limit: 10 });
  });
  it("runs a validated immutable plan through the existing provider invocation service", async () => {
    const state = setup();
    const invocation = (state.service as unknown as {
      invocations: { invoke: jest.Mock };
      promptExecution: { get: jest.Mock };
      optimization: { cacheCompiled: jest.Mock };
    });
    invocation.promptExecution.get.mockResolvedValue({
      compiledPromptId: "compiled", messages: [{ role: "system", content: "Hello" }]
    });
    invocation.invocations.invoke.mockResolvedValue({
      requestId: "request", providerId: "provider", modelId: "model", content: "answer",
      usage: { inputTokens: 2, outputTokens: 1, cachedTokens: 0, totalTokens: 3 },
      cost: { inputCost: "0", outputCost: "0", totalCost: "0", currency: "USD" }
    });
    await expect(state.service.execute("workspace", "actor", {
      ...dto, taskType: "completion"
    })).resolves.toMatchObject({ executionId: "orchestration", answer: "answer" });
    expect(invocation.optimization.cacheCompiled).toHaveBeenCalledWith("workspace", "actor", {
      compiledPromptId: "compiled"
    });
    expect(invocation.invocations.invoke).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "request", mode: "sync", messages: [{ role: "system", content: "Hello" }]
    }));
  });
  it("resolves memory before prompt loading and commits buffered writes once after completion", async () => {
    const state = setup();
    const internals = state.service as unknown as {
      invocations: { invoke: jest.Mock };
      promptExecution: { get: jest.Mock };
      optimization: { cacheCompiled: jest.Mock; cacheMemory: jest.Mock };
    };
    internals.promptExecution.get.mockResolvedValue({
      compiledPromptId: "compiled", messages: [{ role: "user", content: "Question" }]
    });
    internals.invocations.invoke.mockResolvedValue({
      requestId: "request", providerId: "provider", modelId: "model",
      content: "answer", usage: { inputTokens: 2, outputTokens: 1, cachedTokens: 0, totalTokens: 3 },
      cost: { inputCost: "0", outputCost: "0", totalCost: "0", currency: "USD" }
    });
    state.memory.resolve.mockResolvedValue({
      snapshots: [{
        snapshotId: "memory-snapshot", runtimeId: "memory-runtime",
        identifier: "session.one", type: "SESSION", scopeKey: "session:one",
        revision: 1, content: { fact: "remembered" }, metadata: {}, packageHash: "hash"
      }],
      packageHash: "memory-hash", resolvedAt: "now"
    });
    const input = {
      ...dto, taskType: "completion",
      memoryRuntimeSnapshotIds: ["66666666-6666-4666-8666-666666666666"],
      memoryWrites: [{
        runtimeId: "77777777-7777-4777-8777-777777777777",
        content: { result: "answer" }, expectedStateVersion: 1
      }]
    };
    await state.service.execute("workspace", "actor", input);
    expect(state.memory.resolve.mock.invocationCallOrder[0])
      .toBeLessThan(internals.promptExecution.get.mock.invocationCallOrder.at(-1)!);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(internals.invocations.invoke).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system", content: expect.stringContaining("remembered") })
      ])
    }));
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(state.memory.commitWrites).toHaveBeenCalledTimes(1);
    expect(state.memory.commitWrites).toHaveBeenCalledWith("workspace", "actor", [{
      runtimeId: "77777777-7777-4777-8777-777777777777",
      content: { result: "answer" }, expectedStateVersion: 1, executionRunId: "run"
    }]);
  });
});
