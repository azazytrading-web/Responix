import { randomUUID } from "node:crypto";
import { MemoryRuntimeType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AgentExecutionService } from "../agent-execution/agent-execution.service";
import { ExecutionKernelRepository } from "../execution-kernel/execution-kernel.repository";
import { ExecutionKernelService } from "../execution-kernel/execution-kernel.service";
import { ExecutionStateMachine } from "../execution-kernel/execution-state-machine";
import { MemoryRuntimeRepository } from "./memory-runtime.repository";
import { MemoryRuntimeService } from "./memory-runtime.service";
import { MemoryRuntimeValidator } from "./memory-runtime.validator";

const enabled = process.env.RUN_MEMORY_RUNTIME_DB_TEST === "1";
const describeDb = enabled ? describe : describe.skip;

describeDb("Memory runtime PostgreSQL integration", () => {
  const prisma = new PrismaService();
  const repository = new MemoryRuntimeRepository(prisma, new MemoryRuntimeValidator());
  const memory = new MemoryRuntimeService(repository, repository);
  const created = { runtimeIds: [] as string[], snapshotIds: [] as string[], requestIds: [] as string[], runIds: [] as string[] };

  afterAll(async () => {
    if (created.runtimeIds.length) {
      await prisma.memoryRuntimeDiagnostic.deleteMany({ where: { runtimeId: { in: created.runtimeIds } } });
      await prisma.memoryRuntimeLifecycle.deleteMany({ where: { runtimeId: { in: created.runtimeIds } } });
      await prisma.memoryRuntimeVersion.deleteMany({ where: { runtimeId: { in: created.runtimeIds } } });
      await prisma.memoryRuntimeSnapshot.deleteMany({ where: { runtimeId: { in: created.runtimeIds } } });
      await prisma.memoryRuntimeMetric.deleteMany({ where: { runtimeId: { in: created.runtimeIds } } });
      await prisma.auditLog.deleteMany({ where: { entityType: "MemoryRuntime", entityId: { in: created.runtimeIds } } });
      await prisma.memoryRuntime.deleteMany({ where: { id: { in: created.runtimeIds } } });
    }
    if (created.runIds.length) {
      await prisma.executionEvent.deleteMany({ where: { runId: { in: created.runIds } } });
      await prisma.executionLog.deleteMany({ where: { runId: { in: created.runIds } } });
      await prisma.executionStep.deleteMany({ where: { runId: { in: created.runIds } } });
      await prisma.executionRun.deleteMany({ where: { id: { in: created.runIds } } });
    }
    if (created.requestIds.length) await prisma.executionRequest.deleteMany({ where: { id: { in: created.requestIds } } });
    await prisma.$disconnect();
  });

  it("publishes and resolves the latest scoped memory snapshot after an explicit write", async () => {
    const owner = await prisma.channelConnection.findFirst({
      select: { workspaceId: true, createdById: true }
    });
    if (!owner?.createdById) throw new Error("A development ChannelConnection with an actor is required");
    const agentId = randomUUID();
    const runtime = await memory.create(owner.workspaceId, owner.createdById, {
      identifier: `memory-e2e-${randomUUID()}`,
      name: "Disposable Agent Memory",
      type: MemoryRuntimeType.AGENT,
      scopeKey: `agent:${agentId}`,
      content: {},
      metadata: { agentId, disposable: true },
      compatibilityVersion: "1.0"
    });
    created.runtimeIds.push(runtime.id);
    const initial = await memory.publish(owner.workspaceId, owner.createdById, runtime.id, runtime.stateVersion);
    created.snapshotIds.push(initial.id);
    const kernel = new ExecutionKernelService(new ExecutionKernelRepository(prisma, new ExecutionStateMachine()));
    const createRun = async (turn: string) => {
      const request = await kernel.createRequest(owner.workspaceId, owner.createdById!, {
        sourceType: "SYSTEM", correlationId: `memory-e2e:${turn}`,
        idempotencyKey: `memory-e2e:${turn}:${randomUUID()}`, metadata: { disposable: true }
      });
      const run = await kernel.createRun(owner.workspaceId, owner.createdById!, request.id, { runtimeMetadata: { disposable: true } });
      created.requestIds.push(request.id); created.runIds.push(run.id);
      return { request, run };
    };
    const turn1 = await createRun("turn-1");
    const conversationA = randomUUID(), conversationB = randomUUID();
    const scopedA = await memory.ensureConversationRuntime(owner.workspaceId, owner.createdById, conversationA, runtime.id);
    const scopedB = await memory.ensureConversationRuntime(owner.workspaceId, owner.createdById, conversationB, runtime.id);
    created.runtimeIds.push(scopedA.runtimeId, scopedB.runtimeId);
    const scopedAState = await memory.get(owner.workspaceId, scopedA.runtimeId);
    const written = await memory.commitWrite(owner.workspaceId, owner.createdById, {
      runtimeId: scopedA.runtimeId, content: { facts: { name: "Alice" } },
      expectedStateVersion: scopedAState.stateVersion, executionRunId: turn1.run.id,
      metadata: { channelConversationId: conversationA, disposable: true }
    });
    if (!written) throw new Error("Memory write did not produce a snapshot");
    created.snapshotIds.push(written.id);
    const latestIds = await memory.latestSnapshots(owner.workspaceId, [runtime.id, scopedA.runtimeId]);
    const resolved = await memory.resolve(owner.workspaceId, owner.createdById, {
      snapshotIds: latestIds, compatibilityVersion: "1.0", executionRunId: turn1.run.id
    });
    expect(latestIds).toEqual([initial.id, written.id]);
    expect(resolved.snapshots).toEqual(expect.arrayContaining([expect.objectContaining({
      runtimeId: scopedA.runtimeId, type: "CONVERSATION", scopeKey: `conversation:${conversationA}`,
      content: { facts: { name: "Alice" } }
    })]));
    const otherSnapshotIds = await memory.latestSnapshots(owner.workspaceId, [runtime.id, scopedB.runtimeId]);
    const other = await memory.resolve(owner.workspaceId, owner.createdById, {
      snapshotIds: otherSnapshotIds, compatibilityVersion: "1.0", executionRunId: turn1.run.id
    });
    expect(other.snapshots.some((snapshot) => JSON.stringify(snapshot.content).includes("Alice"))).toBe(false);
    console.log(JSON.stringify({ agentId, memoryRuntimeId: runtime.id,
      initialSnapshotId: initial.id, conversationRuntimeAId: scopedA.runtimeId,
      conversationRuntimeBId: scopedB.runtimeId, latestSnapshotId: written.id,
      resolvedContent: resolved.snapshots.map((snapshot) => snapshot.content) }));
  });

  it("passes the latest conversation memory through AgentExecutionService to the provider invocation", async () => {
    const owner = await prisma.channelConnection.findFirst({ select: { workspaceId: true, createdById: true } });
    if (!owner?.createdById) throw new Error("A development ChannelConnection with an actor is required");
    const agentMemory = await memory.create(owner.workspaceId, owner.createdById, {
      identifier: `memory-invocation-${randomUUID()}`, name: "Disposable invocation memory",
      type: MemoryRuntimeType.AGENT, scopeKey: `agent:${randomUUID()}`, content: {},
      metadata: { disposable: true }, compatibilityVersion: "1.0"
    });
    created.runtimeIds.push(agentMemory.id);
    const baseSnapshot = await memory.publish(owner.workspaceId, owner.createdById, agentMemory.id, agentMemory.stateVersion);
    const conversation = await memory.ensureConversationRuntime(owner.workspaceId, owner.createdById, randomUUID(), agentMemory.id);
    created.runtimeIds.push(conversation.runtimeId);
    const conversationState = await memory.get(owner.workspaceId, conversation.runtimeId);
    const kernel = new ExecutionKernelService(new ExecutionKernelRepository(prisma, new ExecutionStateMachine()));
    const request = await kernel.createRequest(owner.workspaceId, owner.createdById, {
      sourceType: "SYSTEM", correlationId: `memory-invocation:${randomUUID()}`,
      idempotencyKey: `memory-invocation:${randomUUID()}`, metadata: { disposable: true }
    });
    const run = await kernel.createRun(owner.workspaceId, owner.createdById, request.id, { runtimeMetadata: { disposable: true } });
    created.requestIds.push(request.id); created.runIds.push(run.id);
    await memory.commitWrite(owner.workspaceId, owner.createdById, {
      runtimeId: conversation.runtimeId, content: { facts: { name: "Alice" } },
      expectedStateVersion: conversationState.stateVersion, executionRunId: run.id
    });
    const snapshotIds = await memory.latestSnapshots(owner.workspaceId, [agentMemory.id, conversation.runtimeId]);
    const invocation = { invoke: jest.fn().mockResolvedValue({ requestId: request.id, providerId: "provider", modelId: "model",
      content: "Your name is Alice.", usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
      cost: { inputCost: "0", outputCost: "0", totalCost: "0", currency: "USD" } }) };
    const execution = new AgentExecutionService(
      { findByRequest: jest.fn().mockResolvedValue(null), persist: jest.fn().mockResolvedValue({
        id: "orchestration", status: "READY", executionRequestId: request.id, executionRunId: run.id, planHash: "plan", runtimeDiagnostics: []
      }) } as never,
      { validate: jest.fn().mockReturnValue([]) } as never,
      { createRequest: jest.fn().mockResolvedValue(request), createRun: jest.fn().mockResolvedValue(run),
        transition: jest.fn().mockResolvedValue({ stateVersion: 1 }), getRun: jest.fn().mockResolvedValue(run),
        appendEvent: jest.fn() } as never,
      { getSnapshot: jest.fn().mockResolvedValue({}) } as never,
      { get: jest.fn().mockResolvedValue({ compiledPromptId: "compiled", messages: [{ role: "system", content: "System" }] }) } as never,
      { getSnapshot: jest.fn().mockResolvedValue({}) } as never,
      { getSnapshot: jest.fn().mockResolvedValue({}) } as never,
      { getSnapshot: jest.fn().mockResolvedValue({}) } as never,
      invocation as never,
      { cacheMemory: jest.fn(), cacheCompiled: jest.fn().mockResolvedValue({ id: "cache", keyHash: "cache" }),
        cacheImmutable: jest.fn().mockResolvedValue({ id: "cache", keyHash: "cache" }), recordProviderOutcome: jest.fn() } as never,
      {} as never, memory, { execute: jest.fn() } as never, { execute: jest.fn(), providerContracts: jest.fn() } as never,
      { invoke: jest.fn() } as never
    );
    await execution.execute(owner.workspaceId, owner.createdById, {
      agentRuntimeSnapshotId: randomUUID(), promptExecutionPayloadId: randomUUID(), providerRuntimeSnapshotId: randomUUID(),
      executionPipelineSnapshotId: randomUUID(), correlationId: `memory-invocation:${randomUUID()}`,
      idempotencyKey: `memory-invocation:${randomUUID()}`, taskType: "channel.message", userMessage: "What is my name?",
      memoryRuntimeSnapshotIds: snapshotIds, memoryCompatibilityVersion: "1.0"
    });
    const messages = invocation.invoke.mock.calls[0]?.[0].messages as Array<{ role: string; content: string }>;
    expect(messages.some((message) => message.role === "system" && message.content.includes("Alice"))).toBe(true);
    console.log(JSON.stringify({ memoryRuntimeId: agentMemory.id, memorySnapshotIds: snapshotIds,
      executionRequestId: request.id, executionRunId: run.id,
      invocationRoles: messages.map((message) => message.role),
      memoryReachedInvocation: messages.some((message) => message.content.includes("Alice")) }));
  });
});
