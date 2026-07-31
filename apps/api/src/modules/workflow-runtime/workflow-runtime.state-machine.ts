import { BadRequestException, Injectable } from "@nestjs/common";
import { WorkflowRuntimeStatus } from "@prisma/client";

const transitions: Readonly<Record<WorkflowRuntimeStatus, readonly WorkflowRuntimeStatus[]>> = {
  CREATED: ["QUEUED", "FAILED", "CANCELLED"], QUEUED: ["PREPARING", "FAILED", "CANCELLED", "TIMED_OUT"],
  PREPARING: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  RUNNING: ["WAITING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT", "COMPENSATED"],
  WAITING: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  PAUSED: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  COMPLETED: [], CANCELLED: [], FAILED: ["COMPENSATED"], TIMED_OUT: ["COMPENSATED"], COMPENSATED: []
};
@Injectable()
export class WorkflowRuntimeStateMachine {
  assert(from: WorkflowRuntimeStatus, to: WorkflowRuntimeStatus) {
    if (!transitions[from].includes(to)) throw new BadRequestException(`Workflow execution cannot transition from ${from} to ${to}`);
  }
  terminal(status: WorkflowRuntimeStatus) {
    return ["COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT", "COMPENSATED"].includes(status);
  }
}
