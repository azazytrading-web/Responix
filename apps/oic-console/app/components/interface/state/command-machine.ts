export type CommandStatus =
  | "IDLE" | "READY" | "ARMED" | "EXECUTING" | "SUCCEEDED" | "FAILED" | "PARTIAL"
  | "CANCELLED" | "BLOCKED" | "DENIED" | "CONFLICT" | "UNKNOWN_RESULT";

export type CommandEvent =
  | "PREPARE" | "ARM" | "DISARM" | "EXECUTE" | "SUCCEED" | "FAIL" | "PARTIAL"
  | "CANCEL" | "BLOCK" | "DENY" | "CONFLICT" | "AMBIGUOUS" | "RESET";

const transitions: Record<CommandStatus, Partial<Record<CommandEvent, CommandStatus>>> = {
  IDLE: { PREPARE: "READY", BLOCK: "BLOCKED", DENY: "DENIED" },
  READY: { ARM: "ARMED", EXECUTE: "EXECUTING", BLOCK: "BLOCKED", DENY: "DENIED", RESET: "IDLE" },
  ARMED: { DISARM: "READY", EXECUTE: "EXECUTING", BLOCK: "BLOCKED", DENY: "DENIED", RESET: "IDLE" },
  EXECUTING: { SUCCEED: "SUCCEEDED", FAIL: "FAILED", PARTIAL: "PARTIAL", CANCEL: "CANCELLED", BLOCK: "BLOCKED", DENY: "DENIED", CONFLICT: "CONFLICT", AMBIGUOUS: "UNKNOWN_RESULT" },
  SUCCEEDED: { RESET: "IDLE" },
  FAILED: { PREPARE: "READY", RESET: "IDLE" },
  PARTIAL: { PREPARE: "READY", RESET: "IDLE" },
  CANCELLED: { PREPARE: "READY", RESET: "IDLE" },
  BLOCKED: { PREPARE: "READY", RESET: "IDLE" },
  DENIED: { RESET: "IDLE" },
  CONFLICT: { RESET: "IDLE" },
  UNKNOWN_RESULT: { RESET: "IDLE" }
};

export function transitionCommand(current: CommandStatus, event: CommandEvent): CommandStatus {
  return transitions[current][event] ?? current;
}

export function canTransitionCommand(current: CommandStatus, event: CommandEvent): boolean {
  return transitions[current][event] !== undefined;
}
