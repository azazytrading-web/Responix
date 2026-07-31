import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CancelWorkflowExecutionDto, ExecuteWorkflowDto, WorkflowExecutionListQueryDto } from "./dto/workflow-runtime.dto";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";

describe("WorkflowRuntimeController contracts", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  it("validates execution, cancellation, and paginated filtering DTOs", async () => {
    await expect(pipe.transform({ workflowVersionId: crypto.randomUUID(), correlationId: "trace:1",
      idempotencyKey: "workflow:1", timeoutMs: 1000 }, { type: "body", metatype: ExecuteWorkflowDto }))
      .resolves.toBeInstanceOf(ExecuteWorkflowDto);
    await expect(pipe.transform({ workflowVersionId: "bad", correlationId: "bad space",
      idempotencyKey: "x" }, { type: "body", metatype: ExecuteWorkflowDto }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ reason: "operator" }, { type: "body", metatype: CancelWorkflowExecutionDto }))
      .resolves.toBeInstanceOf(CancelWorkflowExecutionDto);
    const query = await pipe.transform({ page: "2", limit: "50", status: "FAILED" },
      { type: "query", metatype: WorkflowExecutionListQueryDto }) as WorkflowExecutionListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "FAILED" });
  });

  it("declares dedicated execution, runtime, and history permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", WorkflowRuntimeController.prototype.execute)).toEqual(["workflow.execution.execute"]);
    expect(reflector.get("permissions", WorkflowRuntimeController.prototype.cancel)).toEqual(["workflow.execution.cancel"]);
    expect(reflector.get("permissions", WorkflowRuntimeController.prototype.approve)).toEqual(["workflow.runtime.approve"]);
    expect(reflector.get("permissions", WorkflowRuntimeController.prototype.get)).toEqual(["workflow.runtime.read"]);
    expect(reflector.get("permissions", WorkflowRuntimeController.prototype.history)).toEqual(["workflow.history.read"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
