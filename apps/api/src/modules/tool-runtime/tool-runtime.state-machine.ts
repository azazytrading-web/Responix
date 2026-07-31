import { BadRequestException, Injectable } from "@nestjs/common";
import { ToolRuntimeStatus } from "@prisma/client";

const transitions: Readonly<Record<ToolRuntimeStatus, readonly ToolRuntimeStatus[]>> = {
  CREATED: ["QUEUED", "FAILED", "CANCELLED"], QUEUED: ["PREPARING", "FAILED", "CANCELLED", "TIMED_OUT"],
  PREPARING: ["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"],
  RUNNING: ["STREAMING", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"],
  STREAMING: ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"],
  COMPLETED: [], CANCELLED: [], FAILED: [], TIMED_OUT: []
};
@Injectable()
export class ToolRuntimeStateMachine {
  assert(from: ToolRuntimeStatus, to: ToolRuntimeStatus) {
    if (!transitions[from].includes(to)) throw new BadRequestException(`Tool execution cannot transition from ${from} to ${to}`);
  }
  terminal(status: ToolRuntimeStatus) { return ["COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT"].includes(status); }
}
