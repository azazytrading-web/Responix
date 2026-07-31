import { BadRequestException, Injectable } from "@nestjs/common";
import type { ChannelConnectionState } from "@prisma/client";

const transitions: Readonly<Record<ChannelConnectionState, readonly ChannelConnectionState[]>> = {
  DISCONNECTED: ["CONNECTING"], CONNECTING: ["CONNECTED", "DEGRADED", "FAILED", "DISCONNECTED"],
  CONNECTED: ["DEGRADED", "FAILED", "DISCONNECTED"], DEGRADED: ["CONNECTING", "CONNECTED", "FAILED", "DISCONNECTED"],
  FAILED: ["CONNECTING", "DISCONNECTED"]
};

@Injectable()
export class ChannelConnectionStateMachine {
  assert(from: ChannelConnectionState, to: ChannelConnectionState) {
    if (!transitions[from].includes(to)) throw new BadRequestException(`Invalid channel connection transition ${from} -> ${to}`);
  }
}
