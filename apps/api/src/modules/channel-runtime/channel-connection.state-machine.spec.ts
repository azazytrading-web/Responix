import { BadRequestException } from "@nestjs/common";
import { ChannelConnectionStateMachine } from "./channel-connection.state-machine";

describe("ChannelConnectionStateMachine", () => {
  const machine = new ChannelConnectionStateMachine();

  it("supports connect, disconnect, reconnect, and degradation lifecycles", () => {
    expect(machine.assert("DISCONNECTED", "CONNECTING")).toBeUndefined();
    expect(machine.assert("CONNECTING", "CONNECTED")).toBeUndefined();
    expect(machine.assert("CONNECTED", "DEGRADED")).toBeUndefined();
    expect(machine.assert("DEGRADED", "CONNECTING")).toBeUndefined();
  });

  it("rejects invalid connection transitions", () => {
    expect(() => machine.assert("DISCONNECTED", "CONNECTED")).toThrow(BadRequestException);
  });
});
