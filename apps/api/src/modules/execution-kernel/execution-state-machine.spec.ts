import { BadRequestException } from "@nestjs/common";
import { ExecutionStateMachine } from "./execution-state-machine";

describe("ExecutionStateMachine", () => {
  const machine = new ExecutionStateMachine();

  it.each([
    ["REQUESTED", "QUEUED"],
    ["QUEUED", "STARTING"],
    ["STARTING", "RUNNING"],
    ["RUNNING", "PAUSED"],
    ["PAUSED", "RUNNING"],
    ["RUNNING", "SUCCEEDED"],
    ["RUNNING", "FAILED"],
    ["QUEUED", "CANCELLED"],
    ["RUNNING", "TIMED_OUT"]
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() => machine.assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ["REQUESTED", "RUNNING"],
    ["QUEUED", "SUCCEEDED"],
    ["PAUSED", "SUCCEEDED"],
    ["SUCCEEDED", "RUNNING"],
    ["FAILED", "QUEUED"],
    ["CANCELLED", "RUNNING"],
    ["TIMED_OUT", "QUEUED"]
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(() => machine.assertTransition(from, to)).toThrow(BadRequestException);
  });

  it("identifies terminal states", () => {
    expect(machine.isTerminal("SUCCEEDED")).toBe(true);
    expect(machine.isTerminal("FAILED")).toBe(true);
    expect(machine.isTerminal("CANCELLED")).toBe(true);
    expect(machine.isTerminal("TIMED_OUT")).toBe(true);
    expect(machine.isTerminal("PAUSED")).toBe(false);
  });
});
