import { BadRequestException } from "@nestjs/common";
import { ToolRuntimeStatus } from "@prisma/client";
import { ToolRuntimeStateMachine } from "./tool-runtime.state-machine";

describe("ToolRuntimeStateMachine", () => {
  const state = new ToolRuntimeStateMachine();
  it("allows lifecycle progress and recognizes every terminal state", () => {
    expect(() => state.assert(ToolRuntimeStatus.CREATED, ToolRuntimeStatus.QUEUED)).not.toThrow();
    for (const status of [ToolRuntimeStatus.COMPLETED, ToolRuntimeStatus.CANCELLED,
      ToolRuntimeStatus.FAILED, ToolRuntimeStatus.TIMED_OUT]) expect(state.terminal(status)).toBe(true);
  });
  it("rejects mutation of immutable terminal executions", () => {
    expect(() => state.assert(ToolRuntimeStatus.COMPLETED, ToolRuntimeStatus.RUNNING))
      .toThrow(BadRequestException);
  });
});
