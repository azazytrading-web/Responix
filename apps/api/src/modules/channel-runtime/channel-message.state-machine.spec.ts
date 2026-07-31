import { ChannelMessageStateMachine } from "./channel-message.state-machine";

describe("ChannelMessageStateMachine", () => {
  const machine = new ChannelMessageStateMachine();
  it("accepts the complete delivery lifecycle and retry path", () => {
    expect(() => machine.assert("QUEUED", "PREPARING")).not.toThrow();
    expect(() => machine.assert("PREPARING", "SENDING")).not.toThrow();
    expect(() => machine.assert("SENDING", "SENT")).not.toThrow();
    expect(() => machine.assert("SENT", "DELIVERED")).not.toThrow();
    expect(() => machine.assert("DELIVERED", "READ")).not.toThrow();
    expect(() => machine.assert("FAILED", "RETRIED")).not.toThrow();
    expect(() => machine.assert("RETRIED", "PREPARING")).not.toThrow();
  });
  it("rejects invalid and regressive transitions", () => {
    expect(() => machine.assert("READ", "SENDING")).toThrow("Invalid channel message transition");
    expect(() => machine.assert("DELETED", "RETRIED")).toThrow("Invalid channel message transition");
  });
});

