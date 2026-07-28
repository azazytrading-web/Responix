import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  AppendExecutionLogDto,
  CreateExecutionRequestDto,
  ExecutionRunListQueryDto,
  RecordExecutionStepDto,
  TransitionExecutionDto
} from "./dto/execution-kernel.dto";
import { ExecutionKernelController } from "./execution-kernel.controller";

describe("ExecutionKernelController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it("accepts validated request, transition, step, and structured log metadata", async () => {
    await expect(pipe.transform({
      sourceType: "WORKFLOW", sourceReferenceId: "11111111-1111-4111-8111-111111111111",
      correlationId: "correlation-1", idempotencyKey: "request-1",
      priority: 500, metadata: { origin: "api" }
    }, { type: "body", metatype: CreateExecutionRequestDto }))
      .resolves.toBeInstanceOf(CreateExecutionRequestDto);
    await expect(pipe.transform({
      status: "RUNNING", expectedStateVersion: 2, metadata: { node: "start" }
    }, { type: "body", metatype: TransitionExecutionDto }))
      .resolves.toBeInstanceOf(TransitionExecutionDto);
    const step = await pipe.transform({
      sequence: 1, stepType: "PREPARE", status: "SUCCEEDED",
      startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:00:01.000Z"
    }, { type: "body", metatype: RecordExecutionStepDto }) as RecordExecutionStepDto;
    expect(step.startedAt).toBeInstanceOf(Date);
    await expect(pipe.transform({
      level: "INFO", message: "Structured lifecycle log", metadata: { component: "kernel" }
    }, { type: "body", metatype: AppendExecutionLogDto }))
      .resolves.toBeInstanceOf(AppendExecutionLogDto);
  });

  it.each([
    { sourceType: "UNKNOWN", correlationId: "c", idempotencyKey: "k" },
    { sourceType: "MANUAL", correlationId: "bad value", idempotencyKey: "k" },
    { sourceType: "MANUAL", correlationId: "c", idempotencyKey: "k", priority: 1001 },
    { sourceType: "MANUAL", correlationId: "c", idempotencyKey: "k", unknown: true }
  ])("rejects invalid request payload %#", async (payload) => {
    await expect(pipe.transform(payload, { type: "body", metatype: CreateExecutionRequestDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates state enums, step sequences, and transforms run filters", async () => {
    await expect(pipe.transform(
      { status: "UNKNOWN" }, { type: "body", metatype: TransitionExecutionDto }
    )).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform(
      { sequence: 0, stepType: "STEP", status: "PENDING" },
      { type: "body", metatype: RecordExecutionStepDto }
    )).rejects.toBeInstanceOf(BadRequestException);
    const query = await pipe.transform(
      { page: "2", limit: "50", status: "RUNNING" },
      { type: "query", metatype: ExecutionRunListQueryDto }
    ) as ExecutionRunListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "RUNNING" });
  });

  it("declares dedicated Execution Kernel permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", ExecutionKernelController.prototype.createRequest)).toEqual(["execution.kernel.create"]);
    expect(reflector.get("permissions", ExecutionKernelController.prototype.listRequests)).toEqual(["execution.kernel.read"]);
    expect(reflector.get("permissions", ExecutionKernelController.prototype.transition)).toEqual(["execution.kernel.update"]);
    expect(reflector.get("permissions", ExecutionKernelController.prototype.cancel)).toEqual(["execution.kernel.manage"]);
    expect(reflector.get("permissions", ExecutionKernelController.prototype.appendEvent)).toEqual(["execution.kernel.audit"]);
    expect(reflector.get("permissions", ExecutionKernelController.prototype.appendLog)).toEqual(["execution.kernel.audit"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
