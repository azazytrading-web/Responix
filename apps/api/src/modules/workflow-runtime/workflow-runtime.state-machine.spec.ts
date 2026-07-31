import { BadRequestException } from "@nestjs/common";
import { WorkflowRuntimeStatus } from "@prisma/client";
import { WorkflowRuntimeStateMachine } from "./workflow-runtime.state-machine";

describe("WorkflowRuntimeStateMachine", () => {
  const machine = new WorkflowRuntimeStateMachine();
  it("accepts the complete execution lifecycle including approval and compensation", () => {
    expect(() => machine.assert(WorkflowRuntimeStatus.CREATED, WorkflowRuntimeStatus.QUEUED)).not.toThrow();
    expect(() => machine.assert(WorkflowRuntimeStatus.RUNNING, WorkflowRuntimeStatus.WAITING)).not.toThrow();
    expect(() => machine.assert(WorkflowRuntimeStatus.WAITING, WorkflowRuntimeStatus.RUNNING)).not.toThrow();
    expect(() => machine.assert(WorkflowRuntimeStatus.FAILED, WorkflowRuntimeStatus.COMPENSATED)).not.toThrow();
  });
  it("rejects illegal and terminal transitions", () => {
    expect(() => machine.assert(WorkflowRuntimeStatus.CREATED, WorkflowRuntimeStatus.COMPLETED))
      .toThrow(BadRequestException);
    expect(() => machine.assert(WorkflowRuntimeStatus.COMPLETED, WorkflowRuntimeStatus.RUNNING))
      .toThrow(BadRequestException);
    expect(machine.terminal(WorkflowRuntimeStatus.TIMED_OUT)).toBe(true);
  });
});
