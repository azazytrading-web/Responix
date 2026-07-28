import { BadRequestException, Injectable } from "@nestjs/common";
import { ExecutionKernelStatus } from "@prisma/client";

const transitions: Readonly<Record<ExecutionKernelStatus, readonly ExecutionKernelStatus[]>> = {
  REQUESTED: ["QUEUED", "FAILED", "CANCELLED"],
  QUEUED: ["STARTING", "FAILED", "CANCELLED", "TIMED_OUT"],
  STARTING: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  RUNNING: ["PAUSED", "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"],
  PAUSED: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: []
};

@Injectable()
export class ExecutionStateMachine {
  assertTransition(from: ExecutionKernelStatus, to: ExecutionKernelStatus): void {
    if (!transitions[from].includes(to)) {
      throw new BadRequestException(`Execution cannot transition from ${from} to ${to}`);
    }
  }

  isTerminal(status: ExecutionKernelStatus): boolean {
    return ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(status);
  }
}
