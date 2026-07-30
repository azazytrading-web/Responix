import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AgentExecutionController, UnifiedAgentExecutionController } from "./agent-execution.controller";
import {
  AgentExecutionListQueryDto, PrepareAgentExecutionDto
} from "./dto/agent-execution.dto";

describe("AgentExecutionController", () => {
const service = {
    prepare: jest.fn(), execute: jest.fn(), cancel: jest.fn(), get: jest.fn(), list: jest.fn()
  };
  const controller = new AgentExecutionController(service as never);
  const request = {
    tenantContext: {
      workspace: { id: "workspace" }, user: { id: "actor" }
    }
  };
  beforeEach(() => jest.clearAllMocks());
  it("passes tenant context to preparation", async () => {
    const dto = { correlationId: "trace", idempotencyKey: "key" } as PrepareAgentExecutionDto;
    await controller.prepare(request as never, dto);
    expect(service.prepare).toHaveBeenCalledWith("workspace", "actor", dto);
  });
  it("passes tenant context through cancellation", async () => {
    await controller.cancel(request as never, "id", { reason: "stop" });
    expect(service.cancel).toHaveBeenCalledWith("workspace", "actor", "id", { reason: "stop" });
  });
  it("delegates isolated list and get operations", async () => {
    await controller.list(request as never, { page: 1 });
    await controller.get(request as never, "id");
    expect(service.list).toHaveBeenCalledWith("workspace", { page: 1 });
    expect(service.get).toHaveBeenCalledWith("workspace", "id");
  });
  it.each([
    ["prepare", "agent.execution.create"],
    ["cancel", "agent.execution.cancel"],
    ["list", "agent.execution.read"],
    ["get", "agent.execution.read"]
  ])("declares %s permission metadata", (method, permission) => {
    const handler = Object.getOwnPropertyDescriptor(
      AgentExecutionController.prototype, method
    )?.value as object;
    expect(Reflect.getMetadata("permissions", handler)).toEqual([permission]);
  });
  it("rejects malformed IDs and identifiers", async () => {
    const value = plainToInstance(PrepareAgentExecutionDto, {
      agentRuntimeSnapshotId: "bad", promptExecutionPayloadId: "bad",
      providerRuntimeSnapshotId: "bad", executionPipelineSnapshotId: "bad",
      correlationId: "contains spaces", idempotencyKey: ""
    });
    expect((await validate(value)).length).toBeGreaterThanOrEqual(6);
  });
  it("accepts a complete valid preparation DTO", async () => {
    const value = plainToInstance(PrepareAgentExecutionDto, {
      agentRuntimeSnapshotId: "11111111-1111-4111-8111-111111111111",
      promptExecutionPayloadId: "22222222-2222-4222-8222-222222222222",
      providerRuntimeSnapshotId: "33333333-3333-4333-8333-333333333333",
      executionPipelineSnapshotId: "44444444-4444-4444-8444-444444444444",
      correlationId: "trace-1", idempotencyKey: "agent-execution-1", priority: 10
    });
    expect(await validate(value)).toEqual([]);
  });
  it("transforms and validates pagination bounds", async () => {
    const value = plainToInstance(AgentExecutionListQueryDto, {
      page: "2", limit: "10", status: "READY"
    });
    expect(await validate(value)).toEqual([]);
    expect(value).toMatchObject({ page: 2, limit: 10, status: "READY" });
  });
  it("exposes the unified execution endpoint with both execution permissions", async () => {
    const unified = new UnifiedAgentExecutionController(service as never);
    const dto = { taskType: "completion" } as never;
    await unified.execute(request as never, dto);
    expect(service.execute).toHaveBeenCalledWith("workspace", "actor", dto);
    const handler = Object.getOwnPropertyDescriptor(
      UnifiedAgentExecutionController.prototype, "execute"
    )?.value as object;
    expect(Reflect.getMetadata("permissions", handler)).toEqual([
      "agent.execution.create", "ai.invoke"
    ]);
  });
});
