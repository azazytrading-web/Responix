import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CreateExecutionProfileDto,
  ExecutionPriorityLevelDto,
  ExecutionProfileListQueryDto,
  RollbackExecutionProfileDto
} from "./dto/runtime-orchestration.dto";
import { RuntimeOrchestrationController } from "./runtime-orchestration.controller";

describe("RuntimeOrchestrationController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it("accepts complete orchestration-only metadata", async () => {
    await expect(pipe.transform({
      name: "Production", slug: "production", visibility: "WORKSPACE",
      queueDefinitionId: "11111111-1111-4111-8111-111111111111",
      priorityLevelId: "22222222-2222-4222-8222-222222222222",
      metadata: { environment: "production" },
      policy: { config: { approvalRequired: true } },
      limits: { maxSteps: 100, maxTokens: 100000, maxPayloadBytes: 1048576 },
      timeouts: { totalMs: 30000, stepMs: 5000, idleMs: 10000 },
      retryPolicy: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, multiplier: 2, jitter: true },
      failurePolicy: { strategy: "STOP", config: { preserveContext: true } },
      fallbackPolicy: {
        strategy: "USE_TARGET", targetType: "AGENT",
        targetReferenceId: "33333333-3333-4333-8333-333333333333"
      },
      concurrencyPolicy: { maxParallel: 10, maxQueued: 100, strategy: "QUEUE" },
      contexts: [{ name: "tenant", schema: { type: "object" }, value: { region: "eu" } }],
      variables: [{ name: "attempt", schema: { type: "number" }, defaultValue: 0 }],
      inputs: [{ name: "payload", schema: { type: "object" }, required: true }],
      outputs: [{ name: "result", schema: { type: "object" } }],
      bindings: [{
        key: "workflow", targetType: "WORKFLOW",
        referenceId: "44444444-4444-4444-8444-444444444444"
      }],
      dependencies: [], labels: [{ name: "Production", color: "#3366FF" }],
      notes: [{ content: "Metadata only" }]
    }, { type: "body", metatype: CreateExecutionProfileDto }))
      .resolves.toBeInstanceOf(CreateExecutionProfileDto);
  });

  it.each([
    { name: "Bad", slug: "Bad Slug" },
    { name: "Bad", slug: "bad", visibility: "PUBLIC" },
    { name: "Bad", slug: "bad", timeouts: { totalMs: 10 } },
    { name: "Bad", slug: "bad", retryPolicy: { maxAttempts: 0, initialDelayMs: 0, maxDelayMs: 0, multiplier: 1 } },
    { name: "Bad", slug: "bad", concurrencyPolicy: { maxParallel: 0, maxQueued: 0, strategy: "QUEUE" } },
    { name: "Bad", slug: "bad", bindings: [{ key: "bad key", targetType: "WORKFLOW", referenceId: "x" }] },
    { name: "Bad", slug: "bad", unknown: true }
  ])("rejects invalid profile DTO payload %#", async (payload) => {
    await expect(pipe.transform(payload, { type: "body", metatype: CreateExecutionProfileDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates priorities, rollback, and list transformations", async () => {
    await expect(pipe.transform(
      { name: "Invalid", slug: "invalid", value: 1001 },
      { type: "body", metatype: ExecutionPriorityLevelDto }
    )).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ revision: 0 }, { type: "body", metatype: RollbackExecutionProfileDto }))
      .rejects.toBeInstanceOf(BadRequestException);
    const query = await pipe.transform(
      { page: "2", limit: "50", status: "PUBLISHED", sortBy: "name", sortOrder: "asc" },
      { type: "query", metatype: ExecutionProfileListQueryDto }
    ) as ExecutionProfileListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "PUBLISHED", sortBy: "name" });
  });

  it("declares dedicated runtime orchestration permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.list)).toEqual(["runtime.orchestration.read"]);
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.create)).toEqual(["runtime.orchestration.write"]);
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.publish)).toEqual(["runtime.orchestration.publish"]);
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.rollback)).toEqual(["runtime.orchestration.rollback"]);
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.archive)).toEqual(["runtime.orchestration.archive"]);
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.delete)).toEqual(["runtime.orchestration.delete"]);
    expect(reflector.get("permissions", RuntimeOrchestrationController.prototype.createQueue)).toEqual(["runtime.orchestration.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
