/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ExecutionKernelRepository } from "./execution-kernel.repository";
import { ExecutionStateMachine } from "./execution-state-machine";

const now = new Date("2026-01-01T00:00:00.000Z");
const request = (overrides: Record<string, unknown> = {}) => ({
  id: "request", workspaceId: "workspace", requestedById: "actor", sourceType: "MANUAL",
  sourceReferenceId: null, metadata: { origin: "api" }, correlationId: "correlation",
  idempotencyKey: "idempotency", payloadHash: "hash", priority: 100,
  requestedAt: now, createdAt: now, ...overrides
});
const run = (overrides: Record<string, unknown> = {}) => ({
  id: "run", workspaceId: "workspace", requestId: "request", parentRunId: null,
  status: "REQUESTED", stateVersion: 0, eventSequence: 1, startedAt: null,
  endedAt: null, durationMs: null, failureCode: null, failureMessage: null,
  failureMetadata: null, runtimeMetadata: {}, createdAt: now, updatedAt: now,
  request: request(), ...overrides
});

describe("ExecutionKernelRepository", () => {
  const prisma = {
    executionRequest: {
      findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn()
    },
    executionRun: {
      findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(),
      findMany: jest.fn(), count: jest.fn()
    },
    executionEvent: { create: jest.fn() },
    executionStep: { create: jest.fn(), findFirst: jest.fn() },
    executionLog: { create: jest.fn() },
    executionProfile: { findMany: jest.fn() }, workflow: { findMany: jest.fn() },
    aiAgent: { findMany: jest.fn() }, promptLibraryItem: { findMany: jest.fn() },
    knowledgeDocument: { findMany: jest.fn() }, toolDefinition: { findMany: jest.fn() },
    aiProviderConfiguration: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new ExecutionKernelRepository(prisma as never, new ExecutionStateMachine());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof prisma) => unknown)(prisma);
    });
    prisma.executionRequest.findFirst.mockResolvedValue(request());
    prisma.executionRequest.create.mockResolvedValue(request());
    prisma.executionRun.findFirst.mockResolvedValue(run());
    prisma.executionRun.create.mockResolvedValue(run());
    prisma.executionRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.executionEvent.create.mockResolvedValue({
      id: "event", workspaceId: "workspace", runId: "run", sequence: 2
    });
    prisma.executionStep.create.mockResolvedValue({
      id: "step", workspaceId: "workspace", runId: "run", sequence: 1,
      stepType: "PREPARE", status: "PENDING"
    });
    prisma.executionLog.create.mockResolvedValue({
      id: "log", workspaceId: "workspace", runId: "run", level: "INFO"
    });
    prisma.auditLog.create.mockResolvedValue({});
    for (const source of [
      prisma.executionProfile, prisma.workflow, prisma.aiAgent,
      prisma.promptLibraryItem, prisma.knowledgeDocument, prisma.toolDefinition,
      prisma.aiProviderConfiguration
    ]) source.findMany.mockResolvedValue([]);
  });

  it("creates an immutable idempotent request and audit in one transaction", async () => {
    prisma.executionRequest.findFirst.mockResolvedValueOnce(null);
    await repository.createRequest("workspace", "actor", requestDto());
    expect(prisma.executionRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace", requestedById: "actor", sourceType: "MANUAL",
        correlationId: "correlation", idempotencyKey: "idempotency",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/), priority: 100
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "execution.kernel.request.created" })
    }));
  });

  it("returns identical idempotent requests and rejects key reuse with different payload", async () => {
    prisma.executionRequest.findFirst.mockResolvedValueOnce(null);
    let payloadHash = "";
    prisma.executionRequest.create.mockImplementationOnce(
      (input: { data: { payloadHash: string } }) => {
        payloadHash = input.data.payloadHash;
        return Promise.resolve(request({ payloadHash }));
      }
    );
    await repository.createRequest("workspace", "actor", requestDto());
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (tx: typeof prisma) => unknown) => Promise.resolve(operation(prisma))
    );
    prisma.executionRequest.findFirst.mockResolvedValue(request({ payloadHash }));
    await expect(repository.createRequest("workspace", "actor", requestDto())).resolves.toMatchObject({ id: "request" });
    expect(prisma.executionRequest.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();

    prisma.executionRequest.findFirst.mockResolvedValue(request({ payloadHash: "different" }));
    await expect(repository.createRequest("workspace", "actor", requestDto()))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects missing and cross-workspace source references", async () => {
    prisma.executionRequest.findFirst.mockResolvedValue(null);
    await expect(repository.createRequest("workspace", "actor", {
      ...requestDto(), sourceType: "WORKFLOW"
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(repository.createRequest("workspace", "actor", {
      ...requestDto(), sourceType: "WORKFLOW",
      sourceReferenceId: "11111111-1111-4111-8111-111111111111"
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflow.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace", deletedAt: null })
    }));
  });

  it("creates a requested run with the first append-only event and audit", async () => {
    await repository.createRun("workspace", "actor", "request", { runtimeMetadata: { profile: "default" } });
    expect(prisma.executionRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace", requestId: "request", status: "REQUESTED",
        stateVersion: 0, eventSequence: 1,
        events: { create: expect.objectContaining({
          sequence: 1, eventType: "execution.run.created", currentStatus: "REQUESTED"
        }) }
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "execution.kernel.run.created" })
    }));
  });

  it("rejects parent runs from another request", async () => {
    prisma.executionRun.findFirst.mockResolvedValue(run({ requestId: "other-request" }));
    await expect(repository.createRun("workspace", "actor", "request", {
      parentRunId: "11111111-1111-4111-8111-111111111111"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists valid state transitions with optimistic versioning and timeline events", async () => {
    prisma.executionRun.findFirst
      .mockResolvedValueOnce(run())
      .mockResolvedValueOnce(run({ status: "QUEUED", stateVersion: 1, eventSequence: 2 }));
    const result = await repository.transition("workspace", "actor", "run", {
      status: "QUEUED", expectedStateVersion: 0, message: "Accepted"
    });
    expect(result.status).toBe("QUEUED");
    expect(prisma.executionRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stateVersion: 0, eventSequence: 1 }),
      data: expect.objectContaining({
        status: "QUEUED", stateVersion: { increment: 1 }, eventSequence: { increment: 1 }
      })
    }));
    expect(prisma.executionEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sequence: 2, previousStatus: "REQUESTED", currentStatus: "QUEUED"
      })
    }));
  });

  it("rejects invalid, stale, and concurrently changed transitions", async () => {
    expect(() => repository.transition("workspace", "actor", "run", {
      status: "FAILED"
    })).toThrow(BadRequestException);
    expect(() => repository.transition("workspace", "actor", "run", {
      status: "CANCELLED"
    })).toThrow(BadRequestException);
    await expect(repository.transition("workspace", "actor", "run", { status: "RUNNING" }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(repository.transition("workspace", "actor", "run", {
      status: "QUEUED", expectedStateVersion: 4
    })).rejects.toBeInstanceOf(ConflictException);
    prisma.executionRun.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.transition("workspace", "actor", "run", { status: "QUEUED" }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it("records terminal failure details transactionally", async () => {
    prisma.executionRun.findFirst
      .mockResolvedValueOnce(run({ status: "RUNNING", stateVersion: 2, eventSequence: 3, startedAt: now }))
      .mockResolvedValueOnce(run({
        status: "FAILED", stateVersion: 3, eventSequence: 4, startedAt: now,
        endedAt: new Date(), failureCode: "STEP_FAILED", failureMessage: "Step failed"
      }));
    await repository.recordFailure("workspace", "actor", "run", {
      code: "STEP_FAILED", message: "Step failed", expectedStateVersion: 2,
      metadata: { step: 1 }
    });
    expect(prisma.executionRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "FAILED", failureCode: "STEP_FAILED",
        failureMessage: "Step failed", failureMetadata: { step: 1 }
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "execution.kernel.failure.recorded" })
    }));
  });

  it("records cancellation through its dedicated transition and audit event", async () => {
    prisma.executionRun.findFirst
      .mockResolvedValueOnce(run({ status: "QUEUED", stateVersion: 1, eventSequence: 2 }))
      .mockResolvedValueOnce(run({
        status: "CANCELLED", stateVersion: 2, eventSequence: 3, endedAt: new Date()
      }));
    await repository.cancel("workspace", "actor", "run", {
      expectedStateVersion: 1, reason: "User request"
    });
    expect(prisma.executionEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        previousStatus: "QUEUED", currentStatus: "CANCELLED",
        message: "User request"
      })
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "execution.kernel.cancellation.requested" })
    }));
  });

  it("validates and appends immutable ordered step records", async () => {
    await repository.recordStep("workspace", "actor", "run", {
      sequence: 1, stepType: "PREPARE", status: "PENDING"
    });
    expect(prisma.executionStep.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: "workspace", runId: "run", sequence: 1 })
    }));
    expect(() => repository.recordStep("workspace", "actor", "run", {
      sequence: 2, stepType: "CALL", status: "FAILED", endedAt: new Date()
    })).toThrow(BadRequestException);
    prisma.executionRun.findFirst.mockResolvedValue(run({ status: "SUCCEEDED" }));
    await expect(repository.recordStep("workspace", "actor", "run", {
      sequence: 2, stepType: "FINAL", status: "PENDING"
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("appends sequenced diagnostic events and structured logs", async () => {
    await repository.appendEvent("workspace", "actor", "run", {
      eventType: "diagnostic.checkpoint", metadata: { checkpoint: 1 }
    });
    expect(prisma.executionRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { eventSequence: { increment: 1 } }
    }));
    await repository.appendLog("workspace", "actor", "run", {
      level: "INFO", message: "Checkpoint"
    });
    expect(prisma.executionLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace", runId: "run",
        correlationId: "correlation", level: "INFO"
      })
    }));
  });

  it("enforces workspace isolation and propagates audit transaction failures", async () => {
    prisma.executionRun.findFirst.mockResolvedValueOnce(null);
    await expect(repository.getRun("other-workspace", "run")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.executionRun.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "other-workspace" })
    }));
    prisma.executionRequest.findFirst.mockResolvedValueOnce(null);
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(repository.createRequest("workspace", "actor", requestDto()))
      .rejects.toThrow("audit unavailable");
  });
});

function requestDto() {
  return {
    sourceType: "MANUAL" as const, correlationId: "correlation",
    idempotencyKey: "idempotency", priority: 100, metadata: { origin: "api" }
  };
}
